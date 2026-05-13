import { runCoreLearningEngine } from "@/core/learning/learning-engine";
import { buildCoreExecutionJobs } from "@/core/runtime/job-planner";
import {
  executeRuntimeOperationWithTimeout,
  formatRuntimeExecutionError,
  isRuntimeExecutionTimeoutError
} from "@/core/runtime/execution-helpers";
import { recordCompanyAuditEvent } from "@/lib/governance";
import {
  buildExperimentArtifacts,
  executeRealLowRiskActionAdapter,
  simulateExecutionAdapter
} from "@/lib/agents/execution-dispatch";
import {
  evaluateExecutionCircuitBreaker,
  markExecutionIntent,
  prepareExecutionIntent,
  recordExecutionCircuitFailure,
  recordExecutionCircuitSuccess
} from "@/lib/agents/runtime-guards";
import type {
  AutomationOutcome,
  AutomationRun,
  CompanyContext,
  ExecutionJob,
  Experiment,
  FeedbackResult,
  PolicyDecision,
  PrioritizedAction
} from "@/lib/agents/types";

type ExecutionEngineResult = {
  jobs: ExecutionJob[];
  outcomes: AutomationOutcome[];
  experiments: Experiment[];
};

export function buildExecutionJobs(
  actions: PrioritizedAction[],
  decisions: PolicyDecision[]
): ExecutionJob[] {
  return buildCoreExecutionJobs(actions, decisions);
}

export async function runExecutionEngine(
  context: CompanyContext,
  jobs: ExecutionJob[]
): Promise<ExecutionEngineResult> {
  const nextJobs: ExecutionJob[] = [];
  const outcomes: AutomationOutcome[] = [];
  const experiments: Experiment[] = [];

  for (const job of jobs) {
    if (job.type === "launch_experiment") {
      experiments.push(buildExperimentArtifacts(job));
    }

    if (job.status === "blocked") {
      const blockedIntent = markExecutionIntent(
        prepareExecutionIntent(job, {
          blockedBy: "policy"
        }),
        "blocked",
        new Date().toISOString(),
        "Bloqueado pelo policy engine."
      );
      const audit = recordCompanyAuditEvent({
        companySlug: context.companySlug,
        connector: "system",
        kind: "warning",
        title: "Job do agente bloqueado",
        details: `${job.title} foi bloqueado pelo policy engine.`
      });
      nextJobs.push({
        ...job,
        executionIntentId: blockedIntent.id,
        auditReferences: [...job.auditReferences, audit.id]
      });
      outcomes.push({
        jobId: job.id,
        companySlug: context.companySlug,
        status: "blocked",
        summary: "O job nao foi executado porque ficou bloqueado pelo policy engine.",
        outputs: {
          autonomyMode: job.autonomyMode,
          blockedBy: "policy"
        },
        executionIntentId: blockedIntent.id,
        executionIntentStatus: blockedIntent.status,
        correlationId: blockedIntent.correlationId,
        connectorKey: blockedIntent.connectorKey,
        executorKey: blockedIntent.executorKey,
        durationMs: 0,
        startedAt: job.createdAt,
        finishedAt: new Date().toISOString(),
        auditReferences: [audit.id]
      });
      continue;
    }

    if (job.status === "approval_pending") {
      nextJobs.push(job);
      continue;
    }

    const startedAt = new Date().toISOString();
    const preparedIntent = prepareExecutionIntent(job, {
      autonomyMode: job.autonomyMode
    });
    const circuitGate =
      preparedIntent.executorKey === "simulated"
        ? null
        : evaluateExecutionCircuitBreaker(job, startedAt);

    if (circuitGate && !circuitGate.allowed) {
      const breakerAudit = recordCompanyAuditEvent({
        companySlug: context.companySlug,
        connector: "system",
        kind: "warning",
        title: "Circuit breaker bloqueou execucao",
        details: `${job.title} foi bloqueado porque ${circuitGate.connectorKey} esta aberto.`
      });
      const blockedIntent = markExecutionIntent(
        preparedIntent,
        "blocked",
        new Date().toISOString(),
        "Circuit breaker aberto para este conector."
      );

      nextJobs.push({
        ...job,
        status: "blocked",
        executionIntentId: blockedIntent.id,
        correlationId: blockedIntent.correlationId,
        connectorKey: blockedIntent.connectorKey,
        executorKey: blockedIntent.executorKey,
        startedAt,
        finishedAt: blockedIntent.finishedAt,
        auditReferences: [...job.auditReferences, breakerAudit.id]
      });
      outcomes.push({
        jobId: job.id,
        companySlug: context.companySlug,
        status: "blocked",
        summary: "A execucao foi bloqueada pelo circuit breaker deste conector.",
        outputs: {
          executor: blockedIntent.executorKey,
          blockedBy: "circuit_breaker",
          connectorKey: blockedIntent.connectorKey
        },
        executionIntentId: blockedIntent.id,
        executionIntentStatus: blockedIntent.status,
        correlationId: blockedIntent.correlationId,
        connectorKey: blockedIntent.connectorKey,
        executorKey: blockedIntent.executorKey,
        durationMs: 0,
        startedAt,
        finishedAt: blockedIntent.finishedAt ?? new Date().toISOString(),
        auditReferences: [breakerAudit.id]
      });
      continue;
    }

    const runningIntent = markExecutionIntent(preparedIntent, "running", startedAt);
    const audit = recordCompanyAuditEvent({
      companySlug: context.companySlug,
      connector: "system",
      kind: "decision",
      title: "Job autoexecutado pelo Agent Lion",
      details: `${job.title} foi executado em modo adaptador para preparar a proxima acao operacional.`
    });
    try {
      const outcome =
        (await executeRuntimeOperationWithTimeout(
          () => executeRealLowRiskActionAdapter(context, job, startedAt, audit.id),
          runningIntent.timeoutMs
        )) ??
        simulateExecutionAdapter(context, job, startedAt, audit.id);
      const completedIntent = markExecutionIntent(
        runningIntent,
        "completed",
        outcome.finishedAt
      );

      if (circuitGate) {
        recordExecutionCircuitSuccess(circuitGate.breaker, outcome.finishedAt);
      }

      nextJobs.push({
        ...job,
        status: outcome.status === "completed" ? "completed" : outcome.status,
        executionIntentId: completedIntent.id,
        correlationId: completedIntent.correlationId,
        connectorKey: completedIntent.connectorKey,
        executorKey: completedIntent.executorKey,
        startedAt,
        finishedAt: outcome.finishedAt,
        auditReferences: [...job.auditReferences, audit.id]
      });
      outcomes.push({
        ...outcome,
        executionIntentId: completedIntent.id,
        executionIntentStatus: completedIntent.status,
        correlationId: completedIntent.correlationId,
        connectorKey: completedIntent.connectorKey,
        executorKey: completedIntent.executorKey,
        durationMs:
          new Date(outcome.finishedAt).getTime() - new Date(startedAt).getTime()
      });
    } catch (error) {
      const failureAudit = recordCompanyAuditEvent({
        companySlug: context.companySlug,
        connector: "system",
        kind: "warning",
        title: "Job do agente falhou",
        details: `${job.title} falhou durante a execucao: ${formatRuntimeExecutionError(error, false, runningIntent.timeoutMs)}.`
      });
      const finishedAt = new Date().toISOString();
      const timedOut = isRuntimeExecutionTimeoutError(error);
      const errorMessage = formatRuntimeExecutionError(error, timedOut, runningIntent.timeoutMs);
      const failedIntent = markExecutionIntent(
        runningIntent,
        timedOut ? "timed_out" : "failed",
        finishedAt,
        errorMessage
      );

      if (circuitGate) {
        recordExecutionCircuitFailure(
          circuitGate.breaker,
          errorMessage,
          finishedAt
        );
      }

      nextJobs.push({
        ...job,
        status: "failed",
        executionIntentId: failedIntent.id,
        correlationId: failedIntent.correlationId,
        connectorKey: failedIntent.connectorKey,
        executorKey: failedIntent.executorKey,
        startedAt,
        finishedAt,
        auditReferences: [...job.auditReferences, audit.id, failureAudit.id]
      });
      outcomes.push({
        jobId: job.id,
        companySlug: context.companySlug,
        status: "failed",
        summary: errorMessage,
        outputs: {
          executor: failedIntent.executorKey,
          timedOut
        },
        executionIntentId: failedIntent.id,
        executionIntentStatus: failedIntent.status,
        correlationId: failedIntent.correlationId,
        connectorKey: failedIntent.connectorKey,
        executorKey: failedIntent.executorKey,
        durationMs: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
        startedAt,
        finishedAt,
        auditReferences: [audit.id, failureAudit.id]
      });
    }
  }

  return {
    jobs: nextJobs,
    outcomes,
    experiments
  };
}

export function runFeedbackEngine(
  context: CompanyContext,
  run: AutomationRun
): FeedbackResult {
  return runCoreLearningEngine(context, run);
}
