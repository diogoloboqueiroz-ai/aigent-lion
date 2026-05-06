import { sanitizeErrorMessage, sanitizeStructuredPayload } from "@/core/observability/redaction";

export type RuntimeExecutionIntentStatus =
  | "prepared"
  | "blocked"
  | "running"
  | "completed"
  | "failed"
  | "timed_out";

export type RuntimeCircuitBreakerState = "closed" | "open" | "half_open";

export type RuntimeJobDescriptor = {
  companySlug: string;
  jobId: string;
  actionType: string;
  title: string;
  connectorKey: string;
  executorKey: string;
  correlationId: string;
  idempotencyKey: string;
  createdAt: string;
};

export type RuntimeExecutionIntent = {
  id: string;
  companySlug: string;
  jobId: string;
  actionType: string;
  title: string;
  connectorKey: string;
  executorKey: string;
  status: RuntimeExecutionIntentStatus;
  correlationId: string;
  idempotencyKey: string;
  timeoutMs: number;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  lastError?: string;
  metadata?: Record<string, unknown>;
};

export type RuntimeConnectorCircuitBreaker = {
  id: string;
  companySlug: string;
  connectorKey: string;
  state: RuntimeCircuitBreakerState;
  failureCount: number;
  successCount: number;
  threshold: number;
  openedAt?: string;
  nextAttemptAt?: string;
  lastFailureAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  updatedAt: string;
};

export type RuntimeExecutionGate = {
  allowed: boolean;
  reasonCode?: "CIRCUIT_OPEN";
  breaker: RuntimeConnectorCircuitBreaker;
};

export function createRuntimeExecutionIntent(input: {
  job: RuntimeJobDescriptor;
  timeoutMs?: number;
  attemptCount?: number;
  metadata?: Record<string, unknown>;
}): RuntimeExecutionIntent {
  const timeoutMs = input.timeoutMs ?? 45_000;

  return {
    id: `intent-${input.job.jobId}`,
    companySlug: input.job.companySlug,
    jobId: input.job.jobId,
    actionType: input.job.actionType,
    title: input.job.title,
    connectorKey: input.job.connectorKey,
    executorKey: input.job.executorKey,
    status: "prepared",
    correlationId: input.job.correlationId,
    idempotencyKey: input.job.idempotencyKey,
    timeoutMs,
    attemptCount: input.attemptCount ?? 1,
    createdAt: input.job.createdAt,
    updatedAt: input.job.createdAt,
    metadata: input.metadata ? sanitizeStructuredPayload(input.metadata) : undefined
  };
}

export function transitionRuntimeExecutionIntent(
  intent: RuntimeExecutionIntent,
  transition: {
    status: RuntimeExecutionIntentStatus;
    timestamp: string;
    error?: string;
  }
): RuntimeExecutionIntent {
  return {
    ...intent,
    status: transition.status,
    updatedAt: transition.timestamp,
    startedAt:
      transition.status === "running"
        ? transition.timestamp
        : intent.startedAt,
    finishedAt:
      transition.status === "completed" ||
      transition.status === "failed" ||
      transition.status === "blocked" ||
      transition.status === "timed_out"
        ? transition.timestamp
        : intent.finishedAt,
    lastError: transition.error ? sanitizeErrorMessage(transition.error, intent.lastError) : intent.lastError
  };
}

export function createRuntimeCircuitBreaker(input: {
  companySlug: string;
  connectorKey: string;
  threshold?: number;
  updatedAt: string;
}): RuntimeConnectorCircuitBreaker {
  return {
    id: `breaker-${input.companySlug}-${sanitizeKey(input.connectorKey)}`,
    companySlug: input.companySlug,
    connectorKey: input.connectorKey,
    state: "closed",
    failureCount: 0,
    successCount: 0,
    threshold: input.threshold ?? 3,
    updatedAt: input.updatedAt
  };
}

export function evaluateRuntimeExecutionGate(input: {
  breaker?: RuntimeConnectorCircuitBreaker;
  companySlug: string;
  connectorKey: string;
  now: string;
}): RuntimeExecutionGate {
  const breaker =
    input.breaker ??
    createRuntimeCircuitBreaker({
      companySlug: input.companySlug,
      connectorKey: input.connectorKey,
      updatedAt: input.now
    });

  if (breaker.state === "open" && breaker.nextAttemptAt && breaker.nextAttemptAt > input.now) {
    return {
      allowed: false,
      reasonCode: "CIRCUIT_OPEN",
      breaker
    };
  }

  if (breaker.state === "open" && (!breaker.nextAttemptAt || breaker.nextAttemptAt <= input.now)) {
    return {
      allowed: true,
      breaker: {
        ...breaker,
        state: "half_open",
        updatedAt: input.now
      }
    };
  }

  return {
    allowed: true,
    breaker
  };
}

export function registerRuntimeExecutionSuccess(
  breaker: RuntimeConnectorCircuitBreaker,
  now: string
): RuntimeConnectorCircuitBreaker {
  return {
    ...breaker,
    state: "closed",
    failureCount: 0,
    successCount: breaker.successCount + 1,
    nextAttemptAt: undefined,
    openedAt: undefined,
    lastSuccessAt: now,
    lastError: undefined,
    updatedAt: now
  };
}

export function registerRuntimeExecutionFailure(
  breaker: RuntimeConnectorCircuitBreaker,
  input: {
    now: string;
    error: string;
  }
): RuntimeConnectorCircuitBreaker {
  const nextFailureCount = breaker.failureCount + 1;
  const shouldOpen = breaker.state === "half_open" || nextFailureCount >= breaker.threshold;

  return {
    ...breaker,
    state: shouldOpen ? "open" : "closed",
    failureCount: nextFailureCount,
    nextAttemptAt: shouldOpen ? computeNextAttemptAt(input.now, nextFailureCount) : undefined,
    openedAt: shouldOpen ? input.now : breaker.openedAt,
    lastFailureAt: input.now,
    lastError: sanitizeErrorMessage(input.error),
    updatedAt: input.now
  };
}

function computeNextAttemptAt(now: string, failureCount: number) {
  const backoffMinutes = failureCount >= 5 ? 60 : failureCount >= 4 ? 30 : 10;
  return new Date(new Date(now).getTime() + backoffMinutes * 60 * 1000).toISOString();
}

function sanitizeKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-");
}
