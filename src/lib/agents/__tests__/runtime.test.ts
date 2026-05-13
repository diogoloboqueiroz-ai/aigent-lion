import test from "node:test";
import assert from "node:assert/strict";
import { buildAutomationRuntimeHealth } from "../runtime";

test("runtime health separates queued runs from queued retries", () => {
  const health = buildAutomationRuntimeHealth({
    companySlug: "acme",
    queue: [
      {
        id: "retry-1",
        companySlug: "acme",
        kind: "run_retry",
        status: "queued",
        sourceRunId: "run-1",
        trigger: {
          id: "trigger-retry",
          companySlug: "acme",
          type: "alert_recheck",
          actor: "system",
          summary: "retry",
          createdAt: "2026-04-22T10:00:00.000Z"
        },
        actor: "system",
        reason: "falha",
        attemptCount: 0,
        maxAttempts: 3,
        availableAt: "2026-04-22T10:10:00.000Z",
        createdAt: "2026-04-22T10:00:00.000Z",
        updatedAt: "2026-04-22T10:00:00.000Z"
      },
      {
        id: "run-queue-1",
        companySlug: "acme",
        kind: "run_cycle",
        status: "queued",
        sourceRunId: "trigger-cycle",
        trigger: {
          id: "trigger-cycle",
          companySlug: "acme",
          type: "scheduled_cycle",
          actor: "scheduler",
          summary: "cycle",
          createdAt: "2026-04-22T11:00:00.000Z"
        },
        actor: "scheduler",
        reason: "pulso",
        attemptCount: 0,
        maxAttempts: 3,
        availableAt: "2026-04-22T10:05:00.000Z",
        createdAt: "2026-04-22T10:00:00.000Z",
        updatedAt: "2026-04-22T10:00:00.000Z"
      },
      {
        id: "run-queue-2",
        companySlug: "acme",
        kind: "run_cycle",
        status: "running",
        sourceRunId: "trigger-cycle-2",
        trigger: {
          id: "trigger-cycle-2",
          companySlug: "acme",
          type: "manual_run",
          actor: "operator",
          summary: "manual",
          createdAt: "2026-04-22T11:10:00.000Z"
        },
        actor: "operator",
        reason: "manual",
        attemptCount: 0,
        maxAttempts: 3,
        availableAt: "2026-04-22T10:06:00.000Z",
        createdAt: "2026-04-22T10:00:00.000Z",
        updatedAt: "2026-04-22T10:00:00.000Z"
      }
    ],
    deadLetters: [
      {
        id: "dead-1",
        companySlug: "acme",
        sourceQueueItemId: "retry-9",
        sourceRunId: "run-9",
        kind: "run_retry",
        reason: "erro",
        lastError: "timeout",
        attemptCount: 3,
        createdAt: "2026-04-21T10:00:00.000Z",
        deadLetteredAt: "2026-04-22T09:00:00.000Z"
      }
    ],
    executionIntents: [
      {
        id: "intent-1",
        companySlug: "acme",
        jobId: "job-1",
        actionType: "queue_social_sync",
        title: "Sync",
        connectorKey: "social-runtime",
        executorKey: "social-runtime",
        status: "running",
        correlationId: "corr-1",
        idempotencyKey: "idem-1",
        timeoutMs: 45000,
        attemptCount: 1,
        createdAt: "2026-04-22T10:00:00.000Z",
        updatedAt: "2026-04-22T10:00:00.000Z"
      },
      {
        id: "intent-2",
        companySlug: "acme",
        jobId: "job-2",
        actionType: "follow_up_leads",
        title: "CRM",
        connectorKey: "crm",
        executorKey: "crm",
        status: "timed_out",
        correlationId: "corr-2",
        idempotencyKey: "idem-2",
        timeoutMs: 45000,
        attemptCount: 2,
        createdAt: "2026-04-22T09:00:00.000Z",
        updatedAt: "2026-04-22T09:30:00.000Z"
      }
    ],
    connectorCircuitBreakers: [
      {
        id: "breaker-1",
        companySlug: "acme",
        connectorKey: "crm",
        state: "open",
        failureCount: 3,
        successCount: 0,
        threshold: 3,
        openedAt: "2026-04-22T09:30:00.000Z",
        nextAttemptAt: "2026-04-22T10:30:00.000Z",
        updatedAt: "2026-04-22T09:30:00.000Z"
      }
    ],
    referenceTime: "2026-04-22T10:02:00.000Z"
  });

  assert.equal(health.queuedRetries, 1);
  assert.equal(health.queuedRuns, 1);
  assert.equal(health.runningRuns, 1);
  assert.equal(health.deadLetters, 1);
  assert.equal(health.activeExecutionIntents, 1);
  assert.equal(health.timedOutExecutionIntents, 1);
  assert.equal(health.openCircuitBreakers, 1);
  assert.equal(health.nextRunAt, "2026-04-22T10:05:00.000Z");
  assert.equal(health.nextRetryAt, "2026-04-22T10:10:00.000Z");
  assert.equal(health.stalledQueueItems, 0);
  assert.equal(health.overdueExecutionIntents, 1);
  assert.equal(health.oldestQueuedAt, "2026-04-22T10:00:00.000Z");
  assert.equal(health.healthScore, 49);
  assert.equal(health.status, "critical");
});

test("runtime health marks expired leases as stalled work", () => {
  const health = buildAutomationRuntimeHealth({
    companySlug: "acme",
    queue: [
      {
        id: "run-lease-1",
        companySlug: "acme",
        kind: "run_cycle",
        status: "running",
        sourceRunId: "trigger-cycle",
        trigger: {
          id: "trigger-cycle",
          companySlug: "acme",
          type: "scheduled_cycle",
          actor: "scheduler",
          summary: "cycle",
          createdAt: "2026-04-22T11:00:00.000Z"
        },
        actor: "scheduler",
        reason: "pulso",
        attemptCount: 0,
        maxAttempts: 3,
        availableAt: "2026-04-22T10:05:00.000Z",
        leaseExpiresAt: "2026-04-22T10:01:00.000Z",
        createdAt: "2026-04-22T10:00:00.000Z",
        updatedAt: "2026-04-22T10:00:00.000Z"
      }
    ],
    deadLetters: [],
    executionIntents: [],
    connectorCircuitBreakers: [],
    referenceTime: "2026-04-22T10:03:00.000Z"
  });

  assert.equal(health.stalledQueueItems, 1);
  assert.equal(health.healthScore, 90);
  assert.equal(health.status, "healthy");
});
