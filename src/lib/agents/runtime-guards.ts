import {
  createRuntimeExecutionIntent,
  evaluateRuntimeExecutionGate,
  registerRuntimeExecutionFailure,
  registerRuntimeExecutionSuccess,
  transitionRuntimeExecutionIntent
} from "@/core/runtime/execution-runtime";
import {
  inferCoreExecutionConnectorKey,
  inferCoreExecutionExecutorKey
} from "@/core/runtime/job-planner";
import {
  createTenantRuntimeGuardRepository,
  resolveRuntimeTenantId
} from "@/infrastructure/persistence/tenant-runtime-guard-repository";
import type {
  ConnectorCircuitBreaker,
  ExecutionIntent,
  ExecutionIntentStatus,
  ExecutionJob
} from "@/lib/agents/types";

const tenantRuntimeGuardRepository = createTenantRuntimeGuardRepository();

export function listExecutionIntents(companySlug: string) {
  return tenantRuntimeGuardRepository.listExecutionIntents(resolveRuntimeTenantId(companySlug));
}

export function listConnectorCircuitBreakers(companySlug: string) {
  return tenantRuntimeGuardRepository.listConnectorCircuitBreakers(resolveRuntimeTenantId(companySlug));
}

export function prepareExecutionIntent(
  job: ExecutionJob,
  metadata?: Record<string, unknown>
): ExecutionIntent {
  const descriptor = buildRuntimeDescriptor(job);
  const existing = listExecutionIntents(job.companySlug).find((intent) => intent.jobId === job.id);
  const baseIntent = existing
    ? {
        ...existing,
        attemptCount: existing.attemptCount + 1,
        updatedAt: new Date().toISOString(),
        status: "prepared" as ExecutionIntentStatus,
        startedAt: undefined,
        finishedAt: undefined,
        lastError: undefined,
        metadata: {
          ...existing.metadata,
          ...metadata
        }
      }
    : toExecutionIntent(
        createRuntimeExecutionIntent({
          job: descriptor,
          metadata
        }),
        job.type
      );

  tenantRuntimeGuardRepository.upsertExecutionIntent(baseIntent);
  return baseIntent;
}

export function markExecutionIntent(
  intent: ExecutionIntent,
  status: ExecutionIntentStatus,
  timestamp: string,
  error?: string
) {
  const nextIntent = toExecutionIntent(
    transitionRuntimeExecutionIntent(intent, {
      status,
      timestamp,
      error
    }),
    intent.actionType
  );
  tenantRuntimeGuardRepository.upsertExecutionIntent(nextIntent);
  return nextIntent;
}

export function evaluateExecutionCircuitBreaker(job: ExecutionJob, now = new Date().toISOString()) {
  const descriptor = buildRuntimeDescriptor(job);
  const existingBreaker = listConnectorCircuitBreakers(job.companySlug).find(
    (breaker) => breaker.connectorKey === descriptor.connectorKey
  );
  const gate = evaluateRuntimeExecutionGate({
    breaker: existingBreaker,
    companySlug: job.companySlug,
    connectorKey: descriptor.connectorKey,
    now
  });

  tenantRuntimeGuardRepository.upsertConnectorCircuitBreaker(gate.breaker);
  return {
    allowed: gate.allowed,
    reasonCode: gate.reasonCode,
    breaker: gate.breaker,
    connectorKey: descriptor.connectorKey,
    executorKey: descriptor.executorKey
  };
}

export function recordExecutionCircuitSuccess(
  breaker: ConnectorCircuitBreaker,
  now = new Date().toISOString()
) {
  const nextBreaker = registerRuntimeExecutionSuccess(breaker, now);
  tenantRuntimeGuardRepository.upsertConnectorCircuitBreaker(nextBreaker);
  return nextBreaker;
}

export function recordExecutionCircuitFailure(
  breaker: ConnectorCircuitBreaker,
  errorMessage: string,
  now = new Date().toISOString()
) {
  const nextBreaker = registerRuntimeExecutionFailure(breaker, {
    now,
    error: errorMessage
  });
  tenantRuntimeGuardRepository.upsertConnectorCircuitBreaker(nextBreaker);
  return nextBreaker;
}

export function inferExecutionConnectorKey(job: Pick<ExecutionJob, "type" | "targetPlatform">) {
  return inferCoreExecutionConnectorKey(job);
}

export function inferExecutionExecutorKey(job: Pick<ExecutionJob, "type">) {
  return inferCoreExecutionExecutorKey(job);
}

function buildRuntimeDescriptor(job: ExecutionJob) {
  return {
    companySlug: job.companySlug,
    jobId: job.id,
    actionType: job.type,
    title: job.title,
    connectorKey: job.connectorKey ?? inferExecutionConnectorKey(job),
    executorKey: job.executorKey ?? inferExecutionExecutorKey(job),
    correlationId: job.correlationId ?? `corr-${job.id}`,
    idempotencyKey: job.idempotencyKey ?? `intent:${job.companySlug}:${job.id}`,
    createdAt: job.createdAt
  };
}

function toExecutionIntent(
  intent: Omit<ExecutionIntent, "actionType"> & {
    actionType: string;
  },
  jobType: ExecutionJob["type"]
): ExecutionIntent {
  return {
    ...intent,
    actionType: jobType
  };
}
