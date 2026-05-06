import {
  buildRunMetrics,
  buildRunSummary,
  toStoredAutomationRun
} from "@/core/runtime/job-planner";
import type { DecisionProvenanceRecord } from "@/core/domain/agent-core";
import type {
  AutomationRun,
  LearningRecord,
  TriggerEvent
} from "@/lib/agents/types";
import type { CompanyCmoStrategicDecision } from "@/lib/domain";

type DraftAutomationRunInput = {
  runId: string;
  companySlug: string;
  trigger: TriggerEvent;
  state: AutomationRun["state"];
  startedAt: string;
  diagnostics: AutomationRun["diagnostics"];
  opportunities: AutomationRun["opportunities"];
  actions: AutomationRun["actions"];
  jobs: AutomationRun["jobs"];
  approvals: AutomationRun["approvals"];
  policyDecisions: AutomationRun["policyDecisions"];
  outcomes: AutomationRun["outcomes"];
  experiments: AutomationRun["experiments"];
  cmoDecision?: CompanyCmoStrategicDecision;
  auditReferences: string[];
  decisionProvenance?: DecisionProvenanceRecord;
};

type FinalizeAutomationRunInput = {
  draftRun: AutomationRun;
  state: AutomationRun["state"];
  finishedAt: string;
  learningRecords: LearningRecord[];
  experimentResults: AutomationRun["experimentResults"];
  actor: string;
  findingsCount: number;
  approvalsCount: number;
  outcomesCount: number;
  dominantConstraint: string;
};

type FailedAutomationRunInput = {
  runId: string;
  companySlug: string;
  trigger: TriggerEvent;
  state: AutomationRun["state"];
  startedAt: string;
  finishedAt: string;
  diagnostics: AutomationRun["diagnostics"];
  opportunities: AutomationRun["opportunities"];
  actions: AutomationRun["actions"];
  jobs: AutomationRun["jobs"];
  approvals: AutomationRun["approvals"];
  policyDecisions: AutomationRun["policyDecisions"];
  outcomes: AutomationRun["outcomes"];
  experiments: AutomationRun["experiments"];
  cmoDecision?: CompanyCmoStrategicDecision;
  errorMessage: string;
  auditReferences: string[];
};

export function createDraftAutomationRun(input: DraftAutomationRunInput): AutomationRun {
  return {
    id: input.runId,
    companySlug: input.companySlug,
    trigger: input.trigger,
    state: input.state,
    startedAt: input.startedAt,
    diagnostics: input.diagnostics,
    opportunities: input.opportunities,
    actions: input.actions,
    jobs: input.jobs,
    approvals: input.approvals,
    policyDecisions: input.policyDecisions,
    outcomes: input.outcomes,
    learningRecords: [],
    experiments: input.experiments,
    experimentResults: [],
    cmoDecision: input.cmoDecision,
    metrics: buildRunMetrics({
      startedAt: input.startedAt,
      jobs: input.jobs,
      outcomes: input.outcomes,
      cmoDecision: input.cmoDecision
    }),
    summary: "",
    auditReferences: input.auditReferences,
    nextSuggestedRunAt: undefined,
    decisionProvenance: input.decisionProvenance
  };
}

export function finalizeAutomationRun(input: FinalizeAutomationRunInput): AutomationRun {
  return {
    ...input.draftRun,
    state: input.state,
    finishedAt: input.finishedAt,
    learningRecords: input.learningRecords,
    experimentResults: input.experimentResults,
    metrics: buildRunMetrics({
      startedAt: input.draftRun.startedAt,
      finishedAt: input.finishedAt,
      jobs: input.draftRun.jobs,
      outcomes: input.draftRun.outcomes,
      cmoDecision: input.draftRun.cmoDecision
    }),
    summary: buildRunSummary({
      findingsCount: input.findingsCount,
      approvalsCount: input.approvalsCount,
      outcomesCount: input.outcomesCount,
      actor: input.actor,
      dominantConstraint: input.dominantConstraint
    }),
    nextSuggestedRunAt: new Date(new Date(input.finishedAt).getTime() + 24 * 60 * 60 * 1000).toISOString()
  };
}

export function createFailedAutomationRun(input: FailedAutomationRunInput) {
  return toStoredAutomationRun({
    id: input.runId,
    companySlug: input.companySlug,
    trigger: input.trigger,
    state: input.state,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    diagnostics: input.diagnostics,
    opportunities: input.opportunities,
    actions: input.actions,
    jobs: input.jobs,
    approvals: input.approvals,
    policyDecisions: input.policyDecisions,
    outcomes: input.outcomes,
    learningRecords: [],
    experiments: input.experiments,
    experimentResults: [],
    cmoDecision: input.cmoDecision,
    metrics: buildRunMetrics({
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      jobs: input.jobs,
      outcomes: input.outcomes,
      cmoDecision: input.cmoDecision
    }),
    summary: `O ciclo autonomo falhou em ${input.state}: ${input.errorMessage}.`,
    auditReferences: input.auditReferences,
    nextSuggestedRunAt: undefined
  });
}
