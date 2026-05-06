import test from "node:test";
import assert from "node:assert/strict";
import { buildAutomationControlTowerSummary } from "../runtime";

test("control tower summarizes runs, queue pressure and executors", () => {
  const workspace = {
    company: {
      slug: "acme",
      name: "Acme"
    },
    automationRuns: [
      {
        id: "run-success",
        companySlug: "acme",
        trigger: {
          id: "trigger-1",
          companySlug: "acme",
          type: "scheduled_cycle",
          actor: "scheduler",
          summary: "ok",
          createdAt: "2026-04-22T09:00:00.000Z"
        },
        state: "schedule_next_cycle",
        startedAt: "2026-04-22T09:00:00.000Z",
        finishedAt: "2026-04-22T09:01:00.000Z",
        diagnostics: [],
        opportunities: [],
        actions: [],
        jobs: [],
        approvals: [],
        policyDecisions: [],
        outcomes: [
          {
            jobId: "job-1",
            companySlug: "acme",
            status: "completed",
            summary: "ok",
            outputs: {
              executor: "google-data-sync"
            },
            startedAt: "2026-04-22T09:00:00.000Z",
            finishedAt: "2026-04-22T09:01:00.000Z",
            auditReferences: []
          }
        ],
        learningRecords: [],
        experiments: [],
        experimentResults: [
          {
            id: "result-1",
            experimentId: "exp-1",
            companySlug: "acme",
            status: "won",
            summary: "Venceu",
            observedMetrics: [],
            createdAt: "2026-04-22T09:00:30.000Z"
          }
        ],
        cmoDecision: {
          id: "cmo-1",
          companySlug: "acme",
          dominantConstraint: "acquisition",
          weeklyThesis: "foco",
          primaryBet: "bet",
          supportingBets: [],
          delegatedModules: ["strategy"],
          focusMetric: "cpa",
          confidence: 0.8,
          rationale: "ok",
          winningChannels: [],
          losingChannels: [],
          scorecards: [],
          recommendedExperiments: [],
          createdAt: "2026-04-22T09:00:00.000Z"
        },
        metrics: {
          totalJobs: 1,
          completedJobs: 1,
          blockedJobs: 0,
          failedJobs: 0,
          approvalPendingJobs: 0,
          autoExecutedJobs: 1,
          timedOutJobs: 0,
          blockedByCircuitBreaker: 0,
          durationMs: 60000,
          dominantConstraint: "acquisition",
          delegatedModules: ["strategy"],
          realExecutorsUsed: ["google-data-sync"]
        },
        summary: "Run concluido",
        auditReferences: [],
        nextSuggestedRunAt: "2026-04-23T09:00:00.000Z"
      },
      {
        id: "run-failed",
        companySlug: "acme",
        trigger: {
          id: "trigger-2",
          companySlug: "acme",
          type: "scheduled_cycle",
          actor: "scheduler",
          summary: "fail",
          createdAt: "2026-04-22T08:00:00.000Z"
        },
        state: "execute",
        startedAt: "2026-04-22T08:00:00.000Z",
        finishedAt: "2026-04-22T08:01:00.000Z",
        diagnostics: [],
        opportunities: [],
        actions: [],
        jobs: [],
        approvals: [],
        policyDecisions: [],
        outcomes: [
          {
            jobId: "job-2",
            companySlug: "acme",
            status: "failed",
            summary: "erro",
            outputs: {
              executor: "failed"
            },
            startedAt: "2026-04-22T08:00:00.000Z",
            finishedAt: "2026-04-22T08:01:00.000Z",
            auditReferences: []
          }
        ],
        learningRecords: [],
        experiments: [],
        experimentResults: [
          {
            id: "result-2",
            experimentId: "exp-2",
            companySlug: "acme",
            status: "lost",
            summary: "Perdeu",
            observedMetrics: [],
            createdAt: "2026-04-22T08:00:30.000Z"
          }
        ],
        metrics: {
          totalJobs: 1,
          completedJobs: 0,
          blockedJobs: 0,
          failedJobs: 1,
          approvalPendingJobs: 0,
          autoExecutedJobs: 0,
          timedOutJobs: 1,
          blockedByCircuitBreaker: 0,
          durationMs: 60000,
          delegatedModules: [],
          realExecutorsUsed: []
        },
        summary: "O ciclo autonomo falhou em execute: timeout.",
        auditReferences: [],
        nextSuggestedRunAt: undefined
      }
    ],
    automationQueue: [
      {
        id: "queue-1",
        companySlug: "acme",
        kind: "run_cycle",
        status: "queued",
        sourceRunId: "trigger-3",
        trigger: {
          id: "trigger-3",
          companySlug: "acme",
          type: "manual_run",
          actor: "operator",
          summary: "manual",
          createdAt: "2026-04-22T10:00:00.000Z"
        },
        actor: "operator",
        reason: "manual",
        attemptCount: 0,
        maxAttempts: 3,
        availableAt: "2026-04-22T10:05:00.000Z",
        createdAt: "2026-04-22T10:00:00.000Z",
        updatedAt: "2026-04-22T10:00:00.000Z"
      }
    ],
    automationDeadLetters: [
      {
        id: "dead-1",
        companySlug: "acme",
        sourceQueueItemId: "queue-dead-1",
        sourceRunId: "run-dead-1",
        kind: "run_retry",
        reason: "timeout",
        lastError: "Timeout talking to provider.",
        attemptCount: 3,
        createdAt: "2026-04-22T07:00:00.000Z",
        deadLetteredAt: "2026-04-22T07:15:00.000Z"
      }
    ],
    automationRuntimeHealth: {
      companySlug: "acme",
      queuedRetries: 0,
      runningRetries: 0,
      waitingRetries: 0,
      queuedRuns: 1,
      runningRuns: 0,
      waitingRuns: 0,
      deadLetters: 1,
      activeExecutionIntents: 0,
      failedExecutionIntents: 1,
      timedOutExecutionIntents: 1,
      openCircuitBreakers: 0,
      halfOpenCircuitBreakers: 0,
      stalledQueueItems: 0,
      overdueExecutionIntents: 1,
      oldestQueuedAt: "2026-04-22T10:00:00.000Z",
      healthScore: 72,
      status: "warning",
      nextRunAt: "2026-04-22T10:05:00.000Z",
      latestDeadLetterAt: "2026-04-22T07:15:00.000Z"
    },
    executionIntents: [
      {
        id: "intent-1",
        companySlug: "acme",
        jobId: "job-2",
        actionType: "queue_social_sync",
        title: "sync",
        connectorKey: "social-runtime",
        executorKey: "social-runtime",
        status: "failed",
        correlationId: "corr-1",
        idempotencyKey: "idem-1",
        timeoutMs: 45000,
        attemptCount: 2,
        createdAt: "2026-04-22T08:00:00.000Z",
        updatedAt: "2026-04-22T08:02:00.000Z",
        startedAt: "2026-04-22T08:00:10.000Z",
        finishedAt: "2026-04-22T08:01:00.000Z",
        lastError: "Timeout talking to provider."
      }
    ],
    connectorCircuitBreakers: [
      {
        id: "breaker-1",
        companySlug: "acme",
        connectorKey: "social-runtime",
        state: "open",
        failureCount: 3,
        successCount: 0,
        threshold: 3,
        openedAt: "2026-04-22T08:01:00.000Z",
        nextAttemptAt: "2026-04-22T09:01:00.000Z",
        lastFailureAt: "2026-04-22T08:01:00.000Z",
        updatedAt: "2026-04-22T08:01:00.000Z",
        lastError: "Timeout talking to provider."
      }
    ],
    observabilityDeliveries: [
      {
        id: "obs-in-1",
        companySlug: "acme",
        direction: "inbound",
        sink: "collector",
        format: "json",
        status: "received",
        metricCount: 10,
        generatedAt: "2026-04-22T09:01:00.000Z",
        createdAt: "2026-04-22T09:01:05.000Z",
        deliveredAt: "2026-04-22T09:01:05.000Z",
        endpoint: "/api/agent/observability/collector"
      },
      {
        id: "obs-out-1",
        companySlug: "acme",
        direction: "outbound",
        sink: "forwarder",
        format: "json",
        status: "delivered",
        metricCount: 10,
        generatedAt: "2026-04-22T09:01:00.000Z",
        createdAt: "2026-04-22T09:01:06.000Z",
        deliveredAt: "2026-04-22T09:01:06.000Z",
        endpoint: "https://collector.example.com/lion"
      }
    ],
    observabilityMode: "collector_forwarder",
    observabilityTargetHost: "collector.example.com",
    workerExpectedMode: "external",
    referenceTime: "2026-04-22T09:02:00.000Z",
    workerHeartbeats: [
      {
        id: "worker-1:acme",
        workerId: "worker-1",
        companySlug: "acme",
        status: "idle",
        executionPlane: "external",
        storeProvider: "postgres-managed",
        startedAt: "2026-04-22T09:00:00.000Z",
        lastSeenAt: "2026-04-22T09:01:30.000Z",
        intervalMs: 15000,
        processed: 1,
        completed: 1,
        requeued: 0,
        deadLettered: 0,
        lastCompletedRunId: "run-success"
      }
    ]
  } as unknown as Parameters<typeof buildAutomationControlTowerSummary>[0];

  const summary = buildAutomationControlTowerSummary(workspace);

  assert.equal(summary.totals.runs, 2);
  assert.equal(summary.totals.failedRuns, 1);
  assert.equal(summary.queuePressure.queuedRuns, 1);
  assert.equal(summary.health.averageDurationMs, 60000);
  assert.equal(summary.health.autoExecutionRate, 0.5);
  assert.equal(summary.health.failedExecutionRate, 0.5);
  assert.equal(summary.health.experimentWinRate, 0.5);
  assert.equal(summary.health.experimentLossRate, 0.5);
  assert.equal(summary.health.connectorHealthScore, 73);
  assert.equal(summary.health.trustScore, 67);
  assert.equal(summary.health.runtimeHealthScore, 72);
  assert.equal(summary.health.runtimeStatus, "warning");
  assert.equal(summary.topExecutors[0]?.executor, "google-data-sync");
  assert.equal(summary.dominantConstraints[0]?.constraint, "acquisition");
  assert.equal(summary.topFailures[0]?.reason, "Timeout talking to provider");
  assert.equal(summary.recentDeadLetters[0]?.replayHint.includes("timeout"), true);
  assert.equal(summary.executionIntentStatusBreakdown[0]?.status, "failed");
  assert.equal(summary.connectorBreakers[0]?.state, "open");
  assert.equal(summary.executorBreakdown[0]?.executor, "google-data-sync");
  assert.equal(summary.observabilityChannel.mode, "collector_forwarder");
  assert.equal(summary.observabilityChannel.health, "healthy");
  assert.equal(summary.observabilityChannel.targetHost, "collector.example.com");
  assert.equal(summary.workerHealth.status, "healthy");
  assert.equal(summary.workerHealth.activeWorkers, 1);
});
