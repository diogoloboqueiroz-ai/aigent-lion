import assert from "node:assert/strict";
import test from "node:test";
import {
  createRuntimeCircuitBreaker,
  createRuntimeExecutionIntent,
  evaluateRuntimeExecutionGate,
  registerRuntimeExecutionFailure,
  registerRuntimeExecutionSuccess,
  transitionRuntimeExecutionIntent
} from "@/core/runtime/execution-runtime";

test("runtime intent keeps deterministic correlation and idempotency metadata", () => {
  const intent = createRuntimeExecutionIntent({
    job: {
      companySlug: "tenant-a",
      jobId: "job-1",
      actionType: "queue_social_sync",
      title: "Sync",
      connectorKey: "social-runtime",
      executorKey: "social-runtime",
      correlationId: "corr-job-1",
      idempotencyKey: "idem-job-1",
      createdAt: "2026-04-22T10:00:00.000Z"
    }
  });

  assert.equal(intent.status, "prepared");
  assert.equal(intent.correlationId, "corr-job-1");
  assert.equal(intent.idempotencyKey, "idem-job-1");
});

test("runtime gate blocks while circuit breaker is open and cooldown is active", () => {
  const breaker = {
    ...createRuntimeCircuitBreaker({
      companySlug: "tenant-a",
      connectorKey: "crm",
      updatedAt: "2026-04-22T10:00:00.000Z"
    }),
    state: "open" as const,
    nextAttemptAt: "2026-04-22T10:15:00.000Z"
  };

  const gate = evaluateRuntimeExecutionGate({
    breaker,
    companySlug: "tenant-a",
    connectorKey: "crm",
    now: "2026-04-22T10:10:00.000Z"
  });

  assert.equal(gate.allowed, false);
  assert.equal(gate.reasonCode, "CIRCUIT_OPEN");
});

test("runtime gate reopens circuit breaker after a failed half-open probe", () => {
  const halfOpenBreaker = {
    ...createRuntimeCircuitBreaker({
      companySlug: "tenant-a",
      connectorKey: "crm",
      updatedAt: "2026-04-22T10:00:00.000Z"
    }),
    state: "half_open" as const,
    failureCount: 3
  };

  const failed = registerRuntimeExecutionFailure(halfOpenBreaker, {
    now: "2026-04-22T10:20:00.000Z",
    error: "timeout"
  });

  assert.equal(failed.state, "open");
  assert.equal(failed.lastError, "timeout");
  assert.ok(failed.nextAttemptAt);
});

test("runtime success closes breaker and finalizes intent", () => {
  const failedBreaker = registerRuntimeExecutionFailure(
    createRuntimeCircuitBreaker({
      companySlug: "tenant-a",
      connectorKey: "crm",
      updatedAt: "2026-04-22T10:00:00.000Z"
    }),
    {
      now: "2026-04-22T10:05:00.000Z",
      error: "connector timeout"
    }
  );
  const recovered = registerRuntimeExecutionSuccess(failedBreaker, "2026-04-22T10:30:00.000Z");
  const completedIntent = transitionRuntimeExecutionIntent(
    transitionRuntimeExecutionIntent(
      createRuntimeExecutionIntent({
        job: {
          companySlug: "tenant-a",
          jobId: "job-2",
          actionType: "follow_up_leads",
          title: "CRM sync",
          connectorKey: "crm",
          executorKey: "crm",
          correlationId: "corr-job-2",
          idempotencyKey: "idem-job-2",
          createdAt: "2026-04-22T10:00:00.000Z"
        }
      }),
      {
        status: "running",
        timestamp: "2026-04-22T10:31:00.000Z"
      }
    ),
    {
      status: "completed",
      timestamp: "2026-04-22T10:32:00.000Z"
    }
  );

  assert.equal(recovered.state, "closed");
  assert.equal(recovered.failureCount, 0);
  assert.equal(completedIntent.status, "completed");
  assert.equal(completedIntent.finishedAt, "2026-04-22T10:32:00.000Z");
});
