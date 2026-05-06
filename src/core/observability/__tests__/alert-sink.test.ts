import assert from "node:assert/strict";
import test from "node:test";
import { buildAutomationObservabilityAlertCandidates } from "@/core/observability/alert-sink";
import type { CompanyAutomationControlTowerSummary } from "@/lib/domain";

function buildSummary(): CompanyAutomationControlTowerSummary {
  return {
    companySlug: "acme",
    totals: {
      runs: 8,
      completedRuns: 5,
      failedRuns: 3,
      queuedItems: 4,
      deadLetters: 2
    },
    health: {
      failureRate: 0.37,
      averageDurationMs: 42000,
      averageDecisionLatencyMs: 2500,
      averageExecutionLatencyMs: 12000,
      longestExecutionLatencyMs: 62000,
      autoExecutionRate: 0.55,
      approvalRate: 0.22,
      blockRate: 0.08,
      failedExecutionRate: 0.21,
      timedOutExecutionRate: 0.15,
      outcomeCoverageRate: 0.78,
      deadLetterRate: 0.25,
      experimentWinRate: 0.4,
      experimentLossRate: 0.35,
      connectorHealthScore: 61,
      trustScore: 44,
      runtimeHealthScore: 41,
      runtimeStatus: "critical",
      autoExecutedJobs: 10,
      approvalPendingJobs: 3,
      timedOutJobs: 2,
      blockedByCircuitBreaker: 2
    },
    queuePressure: {
      queuedRetries: 2,
      runningRetries: 0,
      waitingRetries: 1,
      queuedRuns: 2,
      runningRuns: 0,
      waitingRuns: 1,
      activeExecutionIntents: 2,
      openCircuitBreakers: 1,
      halfOpenCircuitBreakers: 0,
      stalledQueueItems: 3,
      overdueExecutionIntents: 2
    },
    latest: {
      latestRunId: "run-1"
    },
    autonomyDistribution: [],
    executionIntentStatusBreakdown: [],
    topExecutors: [],
    executorBreakdown: [],
    actionBreakdown: [],
    dominantConstraints: [],
    topFailures: [],
    recentRuns: [],
    recentDeadLetters: [],
    recentExecutionIntents: [],
    connectorBreakers: [],
    observabilityChannel: {
      mode: "disabled",
      configured: false,
      recentDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      receivedDeliveries: 0,
      health: "warning"
    },
    workerHealth: {
      status: "critical",
      expectedMode: "external",
      activeWorkers: 0,
      staleWorkers: 0,
      workers: []
    }
  };
}

test("observability alert sink emits runtime, queue and trust alerts", () => {
  const candidates = buildAutomationObservabilityAlertCandidates({
    company: {
      slug: "acme",
      name: "Acme"
    },
    controlTower: buildSummary(),
    emailReady: true
  });

  assert.equal(candidates.length, 3);
  assert.ok(candidates.some((candidate) => candidate.id.includes("runtime-health")));
  assert.ok(candidates.some((candidate) => candidate.id.includes("queue-pressure")));
  assert.ok(candidates.some((candidate) => candidate.id.includes("trust-degradation")));
});
