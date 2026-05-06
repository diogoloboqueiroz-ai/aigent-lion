import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAutomationObservabilityExport,
  formatObservabilityExportAsPrometheus
} from "@/core/observability/metrics-export";
import type { CompanyAutomationControlTowerSummary } from "@/lib/domain";

test("observability export serializes control tower metrics and prometheus output", () => {
  const summary: CompanyAutomationControlTowerSummary = {
    companySlug: "acme",
    totals: {
      runs: 4,
      completedRuns: 3,
      failedRuns: 1,
      queuedItems: 2,
      deadLetters: 1
    },
    health: {
      failureRate: 0.25,
      averageDurationMs: 42000,
      averageDecisionLatencyMs: 3000,
      averageExecutionLatencyMs: 12000,
      longestExecutionLatencyMs: 28000,
      autoExecutionRate: 0.6,
      approvalRate: 0.2,
      blockRate: 0.1,
      failedExecutionRate: 0.1,
      timedOutExecutionRate: 0.05,
      outcomeCoverageRate: 0.9,
      deadLetterRate: 0.25,
      experimentWinRate: 0.5,
      experimentLossRate: 0.25,
      connectorHealthScore: 82,
      trustScore: 74,
      runtimeHealthScore: 76,
      runtimeStatus: "warning",
      autoExecutedJobs: 6,
      approvalPendingJobs: 2,
      timedOutJobs: 1,
      blockedByCircuitBreaker: 1
    },
    queuePressure: {
      queuedRetries: 1,
      runningRetries: 0,
      waitingRetries: 0,
      queuedRuns: 1,
      runningRuns: 0,
      waitingRuns: 0,
      activeExecutionIntents: 1,
      openCircuitBreakers: 1,
      halfOpenCircuitBreakers: 0,
      stalledQueueItems: 0,
      overdueExecutionIntents: 0
    },
    latest: {
      lastRunAt: "2026-04-23T10:00:00.000Z",
      lastSuccessfulRunAt: "2026-04-23T10:02:00.000Z",
      lastFailedRunAt: "2026-04-23T09:00:00.000Z",
      latestRunId: "run-1",
      latestFailureReason: "Timeout"
    },
    autonomyDistribution: [{ mode: "auto_execute", count: 6 }],
    executionIntentStatusBreakdown: [{ status: "completed", count: 4 }],
    topExecutors: [{ executor: "google-data-sync", count: 3 }],
    executorBreakdown: [
      {
        executor: "google-data-sync",
        totalOutcomes: 3,
        completedCount: 3,
        blockedCount: 0,
        failedCount: 0,
        timedOutCount: 0,
        averageExecutionLatencyMs: 9000
      }
    ],
    actionBreakdown: [
      {
        actionType: "prepare_growth_report",
        totalJobs: 3,
        autoExecuteCount: 3,
        approvalCount: 0,
        policyReviewCount: 0,
        blockedCount: 0,
        completedCount: 3,
        failedCount: 0,
        averageExecutionLatencyMs: 9000
      }
    ],
    dominantConstraints: [{ constraint: "acquisition", count: 2 }],
    topFailures: [{ reason: "Timeout", count: 1 }],
    recentRuns: [],
    recentDeadLetters: [],
    recentExecutionIntents: [],
    connectorBreakers: [
      {
        connectorKey: "google-ads",
        state: "open",
        failureCount: 3,
        successCount: 0,
        threshold: 3,
        nextAttemptAt: "2026-04-23T11:00:00.000Z"
      }
    ],
    observabilityChannel: {
      mode: "direct_webhook",
      configured: true,
      targetHost: "collector.example.com",
      recentDeliveries: 2,
      successfulDeliveries: 2,
      failedDeliveries: 0,
      receivedDeliveries: 0,
      lastDeliveredAt: "2026-04-23T10:03:00.000Z",
      health: "healthy"
    },
    workerHealth: {
      status: "healthy",
      expectedMode: "external",
      activeWorkers: 1,
      staleWorkers: 0,
      latestHeartbeatAt: "2026-04-23T10:03:00.000Z",
      workers: []
    }
  };

  const exportBundle = buildAutomationObservabilityExport(summary);
  const output = formatObservabilityExportAsPrometheus(exportBundle);

  assert.equal(exportBundle.companySlug, "acme");
  assert.ok(exportBundle.metrics.some((metric) => metric.name === "lion_trust_score" && metric.value === 74));
  assert.ok(exportBundle.metrics.some((metric) => metric.name === "lion_worker_health" && metric.value === 100));
  assert.ok(output.includes("# HELP lion_trust_score"));
  assert.ok(output.includes('lion_connector_breaker_state{company_slug="acme",connector_key="google-ads",state="open"} 2'));
});
