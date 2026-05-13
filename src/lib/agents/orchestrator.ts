import {
  acquirePersistedCompanyAutomationLock,
  releasePersistedCompanyAutomationLock
} from "@/infrastructure/persistence/company-automation-storage";
import { createTenantAutomationRepository } from "@/infrastructure/persistence/tenant-automation-repository";
import { buildApprovalRequests } from "@/lib/agents/approvals";
import { runCmoAgent } from "@/lib/agents/cmo-agent";
import { runDecisionEngine } from "@/lib/agents/decision-engine";
import {
  buildExecutionJobs,
  runExecutionEngine,
  runFeedbackEngine
} from "@/lib/agents/execution-engine";
import { runDiagnosticEngine } from "@/lib/agents/diagnostic-engine";
import {
  buildCompanyContext,
  buildCompanyMemory,
  getCompanyMemorySummary,
  persistCompanyMemory
} from "@/lib/agents/memory-engine";
import { buildDecisionProvenanceRecord } from "@/core/audit/decision-provenance";
import { sanitizeErrorMessage } from "@/core/observability/redaction";
import {
  createDraftAutomationRun,
  createFailedAutomationRun,
  finalizeAutomationRun
} from "@/core/runtime/automation-run";
import {
  inferLearningRecordsFromRun,
  toStoredAutomationRun
} from "@/core/runtime/job-planner";
import { evaluatePolicyDecisions } from "@/lib/agents/policy-engine";
import { enqueueAutomationRunRetry } from "@/lib/agents/reliability";
import {
  AGENT_STATE_SEQUENCE,
  assertAgentTransition,
  getInitialAgentState
} from "@/lib/agents/state-machine";
import type {
  AutomationRun,
  DiagnosticResult,
  DecisionResult,
  TriggerEvent,
  TriggerEventType
} from "@/lib/agents/types";
import type { CompanyWorkspace } from "@/lib/domain";
import { recordCompanyAuditEvent } from "@/lib/governance";
import { syncCompanyLearningMemory } from "@/lib/learning";
import {
  isManagedAutomationStoreConfigured,
  listManagedAutomationLocks,
  removeManagedAutomationLock,
  upsertManagedAutomationLock,
  upsertManagedAutomationRun
} from "@/infrastructure/persistence/managed-automation-store";
import { assertAutomationStoreMutationAllowed } from "@/infrastructure/persistence/automation-store-mode";

type AgentCycleInput = {
  workspace: CompanyWorkspace;
  trigger: TriggerEvent;
  actor?: string;
  enqueueRetryOnFailure?: boolean;
};

type BuildTriggerEventInput = {
  triggerType?: TriggerEventType;
  actor?: string;
  summary?: string;
};

type LearnFromRunInput = {
  workspace: CompanyWorkspace;
  run: AutomationRun;
};

const DEFAULT_TRIGGER_SUMMARY: Record<TriggerEventType, string> = {
  manual_run: "Execucao manual do ciclo autonomo.",
  scheduled_cycle: "Ciclo autonomo disparado pelo scheduler.",
  metric_anomaly: "Anomalia de metrica solicitou nova leitura do contexto.",
  alert_recheck: "Revisao de alerta operacional pendente.",
  approval_resolution: "Mudanca de aprovacao pediu novo ciclo de decisao.",
  api_preview: "Preview de diagnostico/decisao pela API."
};

const tenantAutomationRepository = createTenantAutomationRepository();

export function buildTriggerEvent(
  companySlug: string,
  input: BuildTriggerEventInput = {}
): TriggerEvent {
  const createdAt = new Date().toISOString();
  const type = input.triggerType ?? "manual_run";

  return {
    id: `agent-trigger-${companySlug}-${Date.now()}`,
    companySlug,
    type,
    actor: input.actor?.trim() || "agent-lion",
    summary: input.summary?.trim() || DEFAULT_TRIGGER_SUMMARY[type],
    createdAt
  };
}

export function runAgentDiagnostics(input: AgentCycleInput): DiagnosticResult {
  const context = buildCompanyContext({
    workspace: input.workspace,
    trigger: input.trigger
  });
  const findings = runDiagnosticEngine(context);

  return {
    context,
    findings
  };
}

export function runAgentDecision(input: AgentCycleInput): DecisionResult {
  const diagnosticResult = runAgentDiagnostics(input);
  const cmoDecision = runCmoAgent(diagnosticResult.context);
  return runDecisionEngine(diagnosticResult.context, diagnosticResult.findings, cmoDecision);
}

export async function runAgentOrchestrator(input: AgentCycleInput): Promise<AutomationRun> {
  assertAutomationStoreMutationAllowed("executar e persistir um ciclo autonomo do Agent Lion");

  const runId = `agent-run-${input.workspace.company.slug}-${Date.now()}`;
  const startedAt = new Date().toISOString();
  const auditReferences: string[] = [];
  let state = getInitialAgentState();
  let latestCmoDecision: AutomationRun["cmoDecision"];
  let latestDiagnostics: AutomationRun["diagnostics"] = [];
  let latestOpportunities: AutomationRun["opportunities"] = [];
  let latestActions: AutomationRun["actions"] = [];
  let latestJobs: AutomationRun["jobs"] = [];
  let latestApprovals: AutomationRun["approvals"] = [];
  let latestPolicyDecisions: AutomationRun["policyDecisions"] = [];
  let latestOutcomes: AutomationRun["outcomes"] = [];
  let latestExperiments: AutomationRun["experiments"] = [];
  const lock = {
    companySlug: input.workspace.company.slug,
    runId,
    actor: input.actor ?? input.trigger.actor,
    lockedAt: startedAt,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
  };
  const lockResult = await acquireAutomationRunLock(lock);

  if (!lockResult.acquired) {
    const audit = recordCompanyAuditEvent({
      companySlug: input.workspace.company.slug,
      connector: "system",
      kind: "warning",
      title: "Agent run lock active",
      details: `Ja existe um ciclo autonomo em andamento para esta empresa desde ${lockResult.lock.lockedAt}.`
    });
    throw new Error(`Outro ciclo autonomo ja esta em andamento. Audit: ${audit.id}`);
  }

  try {
    const runStartedAudit = recordCompanyAuditEvent({
      companySlug: input.workspace.company.slug,
      connector: "system",
      kind: "info",
      title: "Agent run started",
      details: `${input.trigger.actor} iniciou o ciclo autonomo do Agent Lion.`
    });
    auditReferences.push(runStartedAudit.id);

    moveState("analyze");
    const context = buildCompanyContext({
      workspace: input.workspace,
      trigger: input.trigger
    });
    const cmoDecision = runCmoAgent(context);
    latestCmoDecision = cmoDecision;
    const cmoAudit = recordCompanyAuditEvent({
      companySlug: context.companySlug,
      connector: "system",
      kind: "decision",
      title: "CMO thesis defined",
      details: `${cmoDecision.dominantConstraint} virou o gargalo dominante do ciclo. Tese: ${cmoDecision.weeklyThesis}`
    });
    auditReferences.push(cmoAudit.id);

    moveState("diagnose");
    const findings = runDiagnosticEngine(context);
    latestDiagnostics = findings;
    const diagnosticsAudit = recordCompanyAuditEvent({
      companySlug: context.companySlug,
      connector: "system",
      kind: "info",
      title: "Diagnostics completed",
      details: `${findings.length} findings foram produzidos para este ciclo.`
    });
    auditReferences.push(diagnosticsAudit.id);

    moveState("prioritize");
    const decisionResult = runDecisionEngine(context, findings, cmoDecision);
    latestOpportunities = decisionResult.opportunities;

    moveState("propose");
    const policyResult = evaluatePolicyDecisions(context, decisionResult.actions);
    latestActions = policyResult.actions;
    const jobs = buildExecutionJobs(policyResult.actions, policyResult.decisions);
    latestJobs = jobs;
    const approvals = buildApprovalRequests(jobs);
    latestApprovals = approvals;
    latestPolicyDecisions = policyResult.decisions;
    const policyAudit = recordCompanyAuditEvent({
      companySlug: context.companySlug,
      connector: "system",
      kind: "decision",
      title: "Policy decisions completed",
      details: `${policyResult.decisions.length} decisoes de autonomia foram avaliadas no ciclo.`
    });
    auditReferences.push(policyAudit.id);

    moveState("approve_if_needed");
    moveState("execute");
    const executionResult = await runExecutionEngine(context, jobs);
    latestOutcomes = executionResult.outcomes;
    latestExperiments = executionResult.experiments;
    const executionAudit = recordCompanyAuditEvent({
      companySlug: context.companySlug,
      connector: "system",
      kind: "decision",
      title: "Execution completed",
      details: `${executionResult.outcomes.length} outcomes foram registrados pelo execution engine.`
    });
    auditReferences.push(executionAudit.id);

    moveState("observe");
    moveState("evaluate");
    const decisionProvenance = decisionResult.coreDecision
      ? buildDecisionProvenanceRecord({
          context,
          trigger: input.trigger,
          decisionCore: decisionResult.coreDecision,
          policyDecisions: policyResult.decisions,
          outcomes: executionResult.outcomes
        })
      : undefined;
    const draftRun = createDraftAutomationRun({
      runId,
      companySlug: context.companySlug,
      trigger: input.trigger,
      state,
      startedAt,
      diagnostics: findings,
      opportunities: decisionResult.opportunities,
      actions: policyResult.actions,
      jobs: executionResult.jobs,
      approvals,
      policyDecisions: policyResult.decisions,
      outcomes: executionResult.outcomes,
      experiments: executionResult.experiments,
      cmoDecision,
      auditReferences,
      decisionProvenance
    });

    moveState("learn");
    const feedback = runFeedbackEngine(context, draftRun);
    const persistedLearningRecords = persistCompanyMemory({
      workspace: input.workspace,
      learningRecords: feedback.learnings
    });
    const learningAudit = recordCompanyAuditEvent({
      companySlug: context.companySlug,
      connector: "system",
      kind: "info",
      title: "Learning persisted",
      details: `${persistedLearningRecords.length} learnings foram persistidos no vault da empresa.`
    });
    auditReferences.push(learningAudit.id);

    moveState("schedule_next_cycle");
    const finishedAt = new Date().toISOString();

    const finalRun = finalizeAutomationRun({
      draftRun,
      state,
      finishedAt,
      learningRecords: persistedLearningRecords,
      experimentResults: feedback.experimentResults,
      actor: input.actor ?? input.trigger.actor,
      findingsCount: findings.length,
      approvalsCount: approvals.length,
      outcomesCount: executionResult.outcomes.length,
      dominantConstraint: cmoDecision.dominantConstraint
    });

    syncCompanyLearningMemory({
      workspace: input.workspace,
      latestRun: toStoredAutomationRun(finalRun),
      experimentResults: feedback.experimentResults
    });

    tenantAutomationRepository.appendRun(toStoredAutomationRun(finalRun));
    if (isManagedAutomationStoreConfigured()) {
      await upsertManagedAutomationRun(toStoredAutomationRun(finalRun));
    }
    return finalRun;
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const errorMessage = sanitizeErrorMessage(error, "Falha inesperada no ciclo autonomo.");
    const failureAudit = recordCompanyAuditEvent({
      companySlug: input.workspace.company.slug,
      connector: "system",
      kind: "warning",
      title: "Agent run failed",
      details: errorMessage
    });
    auditReferences.push(failureAudit.id);

    if (input.enqueueRetryOnFailure !== false) {
      enqueueAutomationRunRetry({
        companySlug: input.workspace.company.slug,
        sourceRunId: runId,
        trigger: input.trigger,
        actor: input.actor ?? input.trigger.actor,
        reason: errorMessage
      });
    }

    const failedRun = createFailedAutomationRun({
      runId,
      companySlug: input.workspace.company.slug,
      trigger: input.trigger,
      state,
      startedAt,
      finishedAt,
      diagnostics: latestDiagnostics,
      opportunities: latestOpportunities,
      actions: latestActions,
      jobs: latestJobs,
      approvals: latestApprovals,
      policyDecisions: latestPolicyDecisions,
      outcomes: latestOutcomes,
      experiments: latestExperiments,
      cmoDecision: latestCmoDecision,
      errorMessage,
      auditReferences
    });

    tenantAutomationRepository.appendRun(failedRun);
    if (isManagedAutomationStoreConfigured()) {
      await upsertManagedAutomationRun(failedRun);
    }

    throw error;
  } finally {
    await releaseAutomationRunLock(input.workspace.company.slug, runId);
  }

  function moveState(nextState: (typeof AGENT_STATE_SEQUENCE)[number]) {
    assertAgentTransition(state, nextState);
    state = nextState;
  }
}

export function learnFromAutomationRun(input: LearnFromRunInput) {
  tenantAutomationRepository.appendRun(toStoredAutomationRun(input.run));
    const learnings = inferLearningRecordsFromRun(input.run);
  const persistedLearnings = persistCompanyMemory({
    workspace: input.workspace,
    learningRecords: learnings
  });
  syncCompanyLearningMemory({
    workspace: input.workspace,
    latestRun: toStoredAutomationRun(input.run),
    experimentResults: input.run.experimentResults
  });
  const refreshedMemory =
    getCompanyMemorySummary(input.workspace.company.slug) ?? buildCompanyMemory(input.workspace);

  return {
    companySlug: input.workspace.company.slug,
    learnings: persistedLearnings,
    memory: refreshedMemory
  };
}

async function acquireAutomationRunLock(
  lock: Parameters<typeof acquirePersistedCompanyAutomationLock>[0]
) {
  if (isManagedAutomationStoreConfigured()) {
    const now = new Date().toISOString();
    const managedLock = (await listManagedAutomationLocks(lock.companySlug)).find(
      (entry) => entry.companySlug === lock.companySlug && entry.expiresAt > now
    );

    if (managedLock) {
      return {
        acquired: false as const,
        lock: managedLock
      };
    }

    await upsertManagedAutomationLock(lock);
  }

  const result = acquirePersistedCompanyAutomationLock(lock);

  if (!result.acquired && isManagedAutomationStoreConfigured()) {
    await removeManagedAutomationLock(lock.companySlug, lock.runId);
  }

  return result;
}

async function releaseAutomationRunLock(companySlug: string, runId?: string) {
  releasePersistedCompanyAutomationLock(companySlug, runId);

  if (isManagedAutomationStoreConfigured()) {
    await removeManagedAutomationLock(companySlug, runId);
  }
}
