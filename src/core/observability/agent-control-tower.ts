import type {
  CompanyAutomationActionType,
  CompanyAutomationApprovalMode,
  CompanyAutomationObservabilityChannelHealth,
  CompanyAutomationObservabilityDeliveryRecord,
  CompanyAutomationControlTowerSummary,
  CompanyAutomationDeadLetterItem,
  CompanyAutomationQueueItem,
  CompanyAutomationRun,
  CompanyAutomationWorkerHeartbeat,
  CompanyAutomationWorkerHealth,
  CompanyAutomationRuntimeHealth,
  CompanyConnectorCircuitBreaker,
  CompanyExecutionIntent,
  CompanyWorkspace,
  HealthState
} from "@/lib/domain";

export function buildAutomationRuntimeHealth(input: {
  companySlug: string;
  queue: CompanyAutomationQueueItem[];
  deadLetters: CompanyAutomationDeadLetterItem[];
  executionIntents?: CompanyExecutionIntent[];
  connectorCircuitBreakers?: CompanyConnectorCircuitBreaker[];
  referenceTime?: string;
}): CompanyAutomationRuntimeHealth {
  const referenceTime = input.referenceTime ?? new Date().toISOString();
  const sortedQueue = [...input.queue].sort((left, right) => left.availableAt.localeCompare(right.availableAt));
  const sortedDeadLetters = [...input.deadLetters].sort(
    (left, right) => right.deadLetteredAt.localeCompare(left.deadLetteredAt)
  );
  const sortedRetryQueue = sortedQueue.filter((item) => item.kind === "run_retry");
  const sortedRunQueue = sortedQueue.filter((item) => item.kind === "run_cycle");
  const executionIntents = input.executionIntents ?? [];
  const connectorCircuitBreakers = input.connectorCircuitBreakers ?? [];
  const stalledQueueItems = input.queue.filter(
    (item) => item.status === "running" && item.leaseExpiresAt && item.leaseExpiresAt <= referenceTime
  ).length;
  const overdueExecutionIntents = executionIntents.filter(
    (intent) => intent.status === "running" && resolveIntentDeadline(intent) <= referenceTime
  ).length;
  const oldestQueuedAt = sortedQueue.find((item) => item.status === "queued" || item.status === "retry_waiting")
    ?.createdAt;
  const healthScore = computeRuntimeHealthScore({
    queue: input.queue,
    deadLetters: input.deadLetters,
    executionIntents,
    connectorCircuitBreakers,
    stalledQueueItems,
    overdueExecutionIntents
  });
  const status = mapHealthScoreToState(healthScore);

  return {
    companySlug: input.companySlug,
    queuedRetries: input.queue.filter((item) => item.kind === "run_retry" && item.status === "queued").length,
    runningRetries: input.queue.filter((item) => item.kind === "run_retry" && item.status === "running").length,
    waitingRetries: input.queue.filter((item) => item.kind === "run_retry" && item.status === "retry_waiting").length,
    queuedRuns: input.queue.filter((item) => item.kind === "run_cycle" && item.status === "queued").length,
    runningRuns: input.queue.filter((item) => item.kind === "run_cycle" && item.status === "running").length,
    waitingRuns: input.queue.filter((item) => item.kind === "run_cycle" && item.status === "retry_waiting").length,
    deadLetters: input.deadLetters.length,
    activeExecutionIntents: executionIntents.filter((intent) => intent.status === "running").length,
    failedExecutionIntents: executionIntents.filter((intent) => intent.status === "failed").length,
    timedOutExecutionIntents: executionIntents.filter((intent) => intent.status === "timed_out").length,
    openCircuitBreakers: connectorCircuitBreakers.filter((breaker) => breaker.state === "open").length,
    halfOpenCircuitBreakers: connectorCircuitBreakers.filter((breaker) => breaker.state === "half_open").length,
    stalledQueueItems,
    overdueExecutionIntents,
    oldestQueuedAt,
    healthScore,
    status,
    nextRetryAt: sortedRetryQueue[0]?.availableAt,
    nextRunAt: sortedRunQueue[0]?.availableAt,
    latestDeadLetterAt: sortedDeadLetters[0]?.deadLetteredAt
  };
}

export function buildAutomationControlTowerSummary(
  workspace: Pick<
    CompanyWorkspace,
    | "company"
    | "automationRuns"
    | "automationQueue"
    | "automationDeadLetters"
    | "automationRuntimeHealth"
    | "executionIntents"
    | "connectorCircuitBreakers"
  > & {
    observabilityDeliveries?: CompanyAutomationObservabilityDeliveryRecord[];
    observabilityMode?: CompanyAutomationObservabilityChannelHealth["mode"];
    observabilityTargetHost?: string;
    workerHeartbeats?: CompanyAutomationWorkerHeartbeat[];
    workerExpectedMode?: CompanyAutomationWorkerHealth["expectedMode"];
    referenceTime?: string;
  }
): CompanyAutomationControlTowerSummary {
  const runs = [...workspace.automationRuns].sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  const completedRuns = runs.filter((run) => Boolean(run.finishedAt));
  const failedRuns = runs.filter(isFailedAutomationRun);
  const successfulRuns = completedRuns.filter((run) => !isFailedAutomationRun(run));
  const totalJobs = runs.reduce((total, run) => total + run.metrics.totalJobs, 0);
  const totalPolicyDecisions = runs.reduce((total, run) => total + run.policyDecisions.length, 0);
  const totalApprovalDecisions = runs.reduce(
    (total, run) =>
      total +
      run.policyDecisions.filter(
        (decision) => decision.decision === "requires_approval" || decision.decision === "policy_review"
      ).length,
    0
  );
  const totalOutcomes = runs.reduce((total, run) => total + run.outcomes.length, 0);
  const totalFailedJobs = runs.reduce((total, run) => total + run.metrics.failedJobs, 0);
  const totalBlockedJobs = runs.reduce((total, run) => total + run.metrics.blockedJobs, 0);
  const totalTimedOutJobs = runs.reduce((total, run) => total + run.metrics.timedOutJobs, 0);
  const totalAutoExecutedJobs = runs.reduce((total, run) => total + run.metrics.autoExecutedJobs, 0);
  const totalExperimentResults = runs.reduce((total, run) => total + run.experimentResults.length, 0);
  const totalWonExperiments = runs.reduce(
    (total, run) => total + run.experimentResults.filter((result) => result.status === "won").length,
    0
  );
  const totalLostExperiments = runs.reduce(
    (total, run) => total + run.experimentResults.filter((result) => result.status === "lost").length,
    0
  );
  const avgDurationMs =
    completedRuns.length === 0
      ? 0
      : Math.round(
          completedRuns.reduce((total, run) => total + run.metrics.durationMs, 0) / completedRuns.length
        );
  const averageDecisionLatencyMs = averageNumber(runs.map((run) => computeDecisionLatencyMs(run)));
  const executionLatencies = runs.flatMap((run) => run.outcomes.map((outcome) => computeOutcomeDurationMs(outcome)));
  const averageExecutionLatencyMs = averageNumber(executionLatencies);
  const longestExecutionLatencyMs = executionLatencies.length > 0 ? Math.max(...executionLatencies) : 0;
  const realExecutorUsage = aggregateCounts(runs.flatMap((run) => run.metrics.realExecutorsUsed));
  const dominantConstraintUsage = aggregateCounts(
    runs.flatMap((run) => (isNonEmptyString(run.cmoDecision?.dominantConstraint) ? [run.cmoDecision.dominantConstraint] : []))
  );
  const failureReasons = aggregateCounts(
    workspace.automationDeadLetters.map((item) => normalizeFailureReason(item.lastError))
  );
  const actionBreakdown = buildActionBreakdown(runs);
  const executorBreakdown = buildExecutorBreakdown(runs);
  const connectorHealthScore = computeConnectorHealthScore(
    workspace.automationRuntimeHealth,
    workspace.connectorCircuitBreakers
  );
  const trustScore = computeTrustScore({
    failureRate: buildRate(failedRuns.length, completedRuns.length || runs.length),
    deadLetterRate: buildRate(workspace.automationDeadLetters.length, Math.max(runs.length, 1)),
    failedExecutionRate: buildRate(totalFailedJobs, totalJobs),
    timedOutExecutionRate: buildRate(totalTimedOutJobs, totalJobs),
    outcomeCoverageRate: buildRate(totalOutcomes, totalJobs),
    connectorHealthScore,
    runtimeHealthScore: workspace.automationRuntimeHealth.healthScore ?? 0
  });
  const recentRuns = runs.slice(0, 6).map((run) => ({
    runId: run.id,
    triggerType: run.trigger.type,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    status: inferRunStatus(run),
    dominantConstraint: run.metrics.dominantConstraint,
    durationMs: run.metrics.durationMs,
    decisionLatencyMs: computeDecisionLatencyMs(run),
    executionLatencyMs: averageNumber(run.outcomes.map((outcome) => computeOutcomeDurationMs(outcome))),
    totalJobs: run.metrics.totalJobs,
    autoExecutedJobs: run.metrics.autoExecutedJobs,
    failedJobs: run.metrics.failedJobs,
    blockedJobs: run.metrics.blockedJobs,
    approvalPendingJobs: run.metrics.approvalPendingJobs,
    summary: run.summary
  }));
  const recentDeadLetters = [...workspace.automationDeadLetters]
    .sort((left, right) => right.deadLetteredAt.localeCompare(left.deadLetteredAt))
    .slice(0, 6)
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      reason: item.reason,
      lastError: item.lastError,
      attemptCount: item.attemptCount,
      deadLetteredAt: item.deadLetteredAt,
      replayHint: buildDeadLetterReplayHint(item)
    }));
  const recentExecutionIntents = [...workspace.executionIntents]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 10)
    .map((intent) => ({
      id: intent.id,
      jobId: intent.jobId,
      connectorKey: intent.connectorKey,
      executorKey: intent.executorKey,
      status: intent.status,
      attemptCount: intent.attemptCount,
      correlationId: intent.correlationId,
      startedAt: intent.startedAt,
      finishedAt: intent.finishedAt,
      updatedAt: intent.updatedAt,
      timeoutMs: intent.timeoutMs,
      lastError: intent.lastError
    }));
  const connectorBreakers = [...workspace.connectorCircuitBreakers]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 10)
    .map((breaker) => ({
      connectorKey: breaker.connectorKey,
      state: breaker.state,
      failureCount: breaker.failureCount,
      successCount: breaker.successCount,
      threshold: breaker.threshold,
      nextAttemptAt: breaker.nextAttemptAt,
      lastFailureAt: breaker.lastFailureAt,
      lastSuccessAt: breaker.lastSuccessAt,
      lastError: breaker.lastError
    }));
  const executionIntentStatusBreakdown = aggregateCounts(workspace.executionIntents.map((intent) => intent.status));
  const autonomyDistribution = aggregateCounts(
    runs.flatMap((run) => run.policyDecisions.map((decision) => decision.decision))
  );
  const observabilityChannel = buildObservabilityChannelHealth({
    deliveries: workspace.observabilityDeliveries ?? [],
    mode: workspace.observabilityMode ?? "disabled",
    targetHost: workspace.observabilityTargetHost
  });
  const workerHealth = buildWorkerHealth({
    heartbeats: workspace.workerHeartbeats ?? [],
    expectedMode: workspace.workerExpectedMode ?? "external",
    referenceTime: workspace.referenceTime
  });

  return {
    companySlug: workspace.company.slug,
    totals: {
      runs: runs.length,
      completedRuns: successfulRuns.length,
      failedRuns: failedRuns.length,
      queuedItems: workspace.automationQueue.length,
      deadLetters: workspace.automationDeadLetters.length
    },
    health: {
      failureRate:
        completedRuns.length === 0 ? 0 : Number((failedRuns.length / completedRuns.length).toFixed(2)),
      averageDurationMs: avgDurationMs,
      averageDecisionLatencyMs,
      averageExecutionLatencyMs,
      longestExecutionLatencyMs,
      autoExecutionRate: buildRate(totalAutoExecutedJobs, totalJobs),
      approvalRate: buildRate(totalApprovalDecisions, totalPolicyDecisions || totalJobs),
      blockRate: buildRate(totalBlockedJobs, totalJobs),
      failedExecutionRate: buildRate(totalFailedJobs, totalJobs),
      timedOutExecutionRate: buildRate(totalTimedOutJobs, totalJobs),
      outcomeCoverageRate: buildRate(totalOutcomes, totalJobs),
      deadLetterRate: buildRate(workspace.automationDeadLetters.length, Math.max(runs.length, 1)),
      experimentWinRate: buildRate(totalWonExperiments, totalExperimentResults),
      experimentLossRate: buildRate(totalLostExperiments, totalExperimentResults),
      connectorHealthScore,
      trustScore,
      runtimeHealthScore: workspace.automationRuntimeHealth.healthScore ?? 0,
      runtimeStatus: workspace.automationRuntimeHealth.status ?? "warning",
      autoExecutedJobs: runs.reduce((total, run) => total + run.metrics.autoExecutedJobs, 0),
      approvalPendingJobs: runs.reduce((total, run) => total + run.metrics.approvalPendingJobs, 0),
      timedOutJobs: runs.reduce((total, run) => total + run.metrics.timedOutJobs, 0),
      blockedByCircuitBreaker: runs.reduce((total, run) => total + run.metrics.blockedByCircuitBreaker, 0)
    },
    queuePressure: {
      queuedRetries: workspace.automationRuntimeHealth.queuedRetries,
      runningRetries: workspace.automationRuntimeHealth.runningRetries,
      waitingRetries: workspace.automationRuntimeHealth.waitingRetries,
      queuedRuns: workspace.automationRuntimeHealth.queuedRuns,
      runningRuns: workspace.automationRuntimeHealth.runningRuns,
      waitingRuns: workspace.automationRuntimeHealth.waitingRuns,
      activeExecutionIntents: workspace.automationRuntimeHealth.activeExecutionIntents,
      openCircuitBreakers: workspace.automationRuntimeHealth.openCircuitBreakers,
      halfOpenCircuitBreakers: workspace.automationRuntimeHealth.halfOpenCircuitBreakers,
      stalledQueueItems: workspace.automationRuntimeHealth.stalledQueueItems ?? 0,
      overdueExecutionIntents: workspace.automationRuntimeHealth.overdueExecutionIntents ?? 0,
      oldestQueuedAt: workspace.automationRuntimeHealth.oldestQueuedAt,
      nextRetryAt: workspace.automationRuntimeHealth.nextRetryAt,
      nextRunAt: workspace.automationRuntimeHealth.nextRunAt
    },
    latest: {
      lastRunAt: runs[0]?.startedAt,
      lastSuccessfulRunAt: successfulRuns[0]?.finishedAt,
      lastFailedRunAt: failedRuns[0]?.finishedAt,
      latestRunId: runs[0]?.id,
      latestFailureReason: workspace.automationDeadLetters[0]?.lastError
    },
    autonomyDistribution: Object.entries(autonomyDistribution)
      .map(([mode, count]) => ({ mode: mode as CompanyAutomationApprovalMode, count }))
      .sort((left, right) => right.count - left.count),
    executionIntentStatusBreakdown: Object.entries(executionIntentStatusBreakdown)
      .map(([status, count]) => ({ status: status as CompanyExecutionIntent["status"], count }))
      .sort((left, right) => right.count - left.count),
    topExecutors: Object.entries(realExecutorUsage)
      .map(([executor, count]) => ({ executor, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5),
    executorBreakdown,
    actionBreakdown,
    dominantConstraints: Object.entries(dominantConstraintUsage)
      .map(([constraint, count]) => ({
        constraint: constraint as NonNullable<CompanyAutomationRun["metrics"]["dominantConstraint"]>,
        count
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5),
    topFailures: Object.entries(failureReasons)
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5),
    recentRuns,
    recentDeadLetters,
    recentExecutionIntents,
    connectorBreakers,
    observabilityChannel,
    workerHealth
  };
}

function isFailedAutomationRun(run: CompanyAutomationRun) {
  return (
    run.summary.toLowerCase().includes("falhou") ||
    run.outcomes.some((outcome) => outcome.status === "failed") ||
    run.auditReferences.some((reference) => reference.includes("warning"))
  );
}

function isNonEmptyString(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function aggregateCounts(items: string[]) {
  return items.reduce<Record<string, number>>((summary, item) => {
    summary[item] = (summary[item] ?? 0) + 1;
    return summary;
  }, {});
}

function computeRuntimeHealthScore(input: {
  queue: CompanyAutomationQueueItem[];
  deadLetters: CompanyAutomationDeadLetterItem[];
  executionIntents: CompanyExecutionIntent[];
  connectorCircuitBreakers: CompanyConnectorCircuitBreaker[];
  stalledQueueItems: number;
  overdueExecutionIntents: number;
}) {
  const queueBacklogPenalty = Math.min(18, input.queue.length * 2);
  const deadLetterPenalty = Math.min(35, input.deadLetters.length * 15);
  const breakerPenalty = Math.min(
    24,
    input.connectorCircuitBreakers.filter((breaker) => breaker.state === "open").length * 12
  );
  const timedOutPenalty = Math.min(
    20,
    input.executionIntents.filter((intent) => intent.status === "timed_out").length * 10
  );
  const failedPenalty = Math.min(
    18,
    input.executionIntents.filter((intent) => intent.status === "failed").length * 6
  );
  const stalledPenalty = Math.min(16, input.stalledQueueItems * 8);
  const overduePenalty = Math.min(16, input.overdueExecutionIntents * 8);

  return Math.max(
    0,
    100 -
      queueBacklogPenalty -
      deadLetterPenalty -
      breakerPenalty -
      timedOutPenalty -
      failedPenalty -
      stalledPenalty -
      overduePenalty
  );
}

function mapHealthScoreToState(score: number): HealthState {
  if (score >= 80) {
    return "healthy";
  }

  if (score >= 55) {
    return "warning";
  }

  return "critical";
}

function resolveIntentDeadline(intent: CompanyExecutionIntent) {
  const baseline = intent.startedAt ?? intent.updatedAt ?? intent.createdAt;
  return new Date(new Date(baseline).getTime() + intent.timeoutMs).toISOString();
}

function computeOutcomeDurationMs(outcome: CompanyAutomationRun["outcomes"][number]) {
  if (typeof outcome.durationMs === "number" && Number.isFinite(outcome.durationMs)) {
    return outcome.durationMs;
  }

  return Math.max(0, new Date(outcome.finishedAt).getTime() - new Date(outcome.startedAt).getTime());
}

function computeDecisionLatencyMs(run: CompanyAutomationRun) {
  const jobStartCandidates = [
    ...run.jobs.map((job) => job.startedAt).filter(isNonEmptyString),
    ...run.outcomes.map((outcome) => outcome.startedAt).filter(isNonEmptyString)
  ].sort();

  if (jobStartCandidates.length === 0) {
    return 0;
  }

  return Math.max(0, new Date(jobStartCandidates[0]).getTime() - new Date(run.startedAt).getTime());
}

function averageNumber(values: number[]) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) {
    return 0;
  }

  return Math.round(finiteValues.reduce((total, value) => total + value, 0) / finiteValues.length);
}

function buildRate(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  return Number((numerator / denominator).toFixed(2));
}

function inferRunStatus(run: CompanyAutomationRun) {
  if (isFailedAutomationRun(run)) {
    return "failed" as const;
  }

  if (run.finishedAt) {
    return "completed" as const;
  }

  return "running" as const;
}

function buildActionBreakdown(runs: CompanyAutomationRun[]) {
  const breakdown = new Map<
    CompanyAutomationActionType,
    {
      actionType: CompanyAutomationActionType;
      totalJobs: number;
      autoExecuteCount: number;
      approvalCount: number;
      policyReviewCount: number;
      blockedCount: number;
      completedCount: number;
      failedCount: number;
      latencies: number[];
    }
  >();

  for (const run of runs) {
    const outcomesByJobId = new Map(run.outcomes.map((outcome) => [outcome.jobId, outcome]));
    for (const job of run.jobs) {
      const current = breakdown.get(job.type) ?? {
        actionType: job.type,
        totalJobs: 0,
        autoExecuteCount: 0,
        approvalCount: 0,
        policyReviewCount: 0,
        blockedCount: 0,
        completedCount: 0,
        failedCount: 0,
        latencies: []
      };

      current.totalJobs += 1;
      if (job.autonomyMode === "auto_execute") current.autoExecuteCount += 1;
      if (job.autonomyMode === "requires_approval") current.approvalCount += 1;
      if (job.autonomyMode === "policy_review") current.policyReviewCount += 1;
      if (job.status === "blocked") current.blockedCount += 1;
      if (job.status === "completed") current.completedCount += 1;
      if (job.status === "failed") current.failedCount += 1;

      const outcome = outcomesByJobId.get(job.id);
      if (outcome) {
        current.latencies.push(computeOutcomeDurationMs(outcome));
      }

      breakdown.set(job.type, current);
    }
  }

  return Array.from(breakdown.values())
    .map((entry) => ({
      actionType: entry.actionType,
      totalJobs: entry.totalJobs,
      autoExecuteCount: entry.autoExecuteCount,
      approvalCount: entry.approvalCount,
      policyReviewCount: entry.policyReviewCount,
      blockedCount: entry.blockedCount,
      completedCount: entry.completedCount,
      failedCount: entry.failedCount,
      averageExecutionLatencyMs: averageNumber(entry.latencies)
    }))
    .sort((left, right) => right.totalJobs - left.totalJobs)
    .slice(0, 10);
}

function buildExecutorBreakdown(runs: CompanyAutomationRun[]) {
  const breakdown = new Map<
    string,
    {
      executor: string;
      totalOutcomes: number;
      completedCount: number;
      blockedCount: number;
      failedCount: number;
      timedOutCount: number;
      latencies: number[];
    }
  >();

  for (const run of runs) {
    for (const outcome of run.outcomes) {
      const executor =
        (typeof outcome.outputs.executor === "string" && outcome.outputs.executor) ||
        outcome.executorKey ||
        "unknown";
      const current = breakdown.get(executor) ?? {
        executor,
        totalOutcomes: 0,
        completedCount: 0,
        blockedCount: 0,
        failedCount: 0,
        timedOutCount: 0,
        latencies: []
      };

      current.totalOutcomes += 1;
      if (outcome.status === "completed") current.completedCount += 1;
      if (outcome.status === "blocked") current.blockedCount += 1;
      if (outcome.status === "failed") current.failedCount += 1;
      if (outcome.executionIntentStatus === "timed_out") current.timedOutCount += 1;
      current.latencies.push(computeOutcomeDurationMs(outcome));

      breakdown.set(executor, current);
    }
  }

  return Array.from(breakdown.values())
    .map((entry) => ({
      executor: entry.executor,
      totalOutcomes: entry.totalOutcomes,
      completedCount: entry.completedCount,
      blockedCount: entry.blockedCount,
      failedCount: entry.failedCount,
      timedOutCount: entry.timedOutCount,
      averageExecutionLatencyMs: averageNumber(entry.latencies)
    }))
    .sort((left, right) => right.totalOutcomes - left.totalOutcomes)
    .slice(0, 10);
}

function buildDeadLetterReplayHint(item: CompanyAutomationDeadLetterItem) {
  const reason = item.lastError.toLowerCase();

  if (reason.includes("timeout") || reason.includes("timed out")) {
    return "Revisar timeout, circuit breaker e latencia do conector antes de reenfileirar.";
  }

  if (reason.includes("consent") || reason.includes("policy")) {
    return "Requer revisao humana antes de qualquer replay automatico.";
  }

  if (reason.includes("nao encontrada") || reason.includes("not found")) {
    return "Corrigir tenancy, binding ou recurso ausente antes do replay.";
  }

  return "Inspecionar causa raiz, confirmar seguranca e reenfileirar manualmente se fizer sentido.";
}

function normalizeFailureReason(reason: string) {
  return reason
    .split(".")[0]
    .trim()
    .slice(0, 140);
}

function computeConnectorHealthScore(
  runtimeHealth: CompanyAutomationRuntimeHealth,
  breakers: CompanyConnectorCircuitBreaker[]
) {
  const openPenalty = breakers.filter((breaker) => breaker.state === "open").length * 18;
  const halfOpenPenalty = breakers.filter((breaker) => breaker.state === "half_open").length * 10;
  const timeoutPenalty = runtimeHealth.timedOutExecutionIntents * 4;
  const overduePenalty = (runtimeHealth.overdueExecutionIntents ?? 0) * 5;

  return Math.max(0, 100 - openPenalty - halfOpenPenalty - timeoutPenalty - overduePenalty);
}

function computeTrustScore(input: {
  failureRate: number;
  deadLetterRate: number;
  failedExecutionRate: number;
  timedOutExecutionRate: number;
  outcomeCoverageRate: number;
  connectorHealthScore: number;
  runtimeHealthScore: number;
}) {
  const successRate = 1 - clampRate(input.failureRate);
  const deadLetterSuccessRate = 1 - clampRate(input.deadLetterRate);
  const failedExecutionSuccessRate = 1 - clampRate(input.failedExecutionRate);
  const timeoutSuccessRate = 1 - clampRate(input.timedOutExecutionRate);

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        input.runtimeHealthScore * 0.32 +
          input.connectorHealthScore * 0.28 +
          successRate * 100 * 0.16 +
          deadLetterSuccessRate * 100 * 0.08 +
          clampRate(input.outcomeCoverageRate) * 100 * 0.08 +
          failedExecutionSuccessRate * 100 * 0.05 +
          timeoutSuccessRate * 100 * 0.03
      )
    )
  );
}

function clampRate(value: number) {
  return Math.max(0, Math.min(1, value));
}

function buildObservabilityChannelHealth(input: {
  deliveries: CompanyAutomationObservabilityDeliveryRecord[];
  mode: CompanyAutomationObservabilityChannelHealth["mode"];
  targetHost?: string;
}): CompanyAutomationObservabilityChannelHealth {
  const deliveries = [...input.deliveries].sort((left, right) => {
    const leftTime = left.deliveredAt ?? left.createdAt;
    const rightTime = right.deliveredAt ?? right.createdAt;
    return rightTime.localeCompare(leftTime);
  });
  const outboundDeliveries = deliveries.filter((entry) => entry.direction === "outbound");
  const successfulDeliveries = outboundDeliveries.filter((entry) => entry.status === "delivered");
  const failedDeliveries = outboundDeliveries.filter((entry) => entry.status === "failed");
  const receivedDeliveries = deliveries.filter((entry) => entry.status === "received");
  const lastDeliveredAt = successfulDeliveries[0]?.deliveredAt ?? successfulDeliveries[0]?.createdAt;
  const lastReceivedAt = receivedDeliveries[0]?.deliveredAt ?? receivedDeliveries[0]?.createdAt;
  const lastFailureAt = failedDeliveries[0]?.createdAt;

  return {
    mode: input.mode,
    configured: input.mode !== "disabled",
    targetHost: input.targetHost,
    recentDeliveries: deliveries.length,
    successfulDeliveries: successfulDeliveries.length,
    failedDeliveries: failedDeliveries.length,
    receivedDeliveries: receivedDeliveries.length,
    lastDeliveredAt,
    lastReceivedAt,
    lastFailureAt,
    health: resolveObservabilityHealth({
      mode: input.mode,
      successfulDeliveries: successfulDeliveries.length,
      failedDeliveries: failedDeliveries.length,
      lastDeliveredAt,
      lastFailureAt
    })
  };
}

function resolveObservabilityHealth(input: {
  mode: CompanyAutomationObservabilityChannelHealth["mode"];
  successfulDeliveries: number;
  failedDeliveries: number;
  lastDeliveredAt?: string;
  lastFailureAt?: string;
}): HealthState {
  if (input.mode === "disabled") {
    return "warning";
  }

  if (
    input.failedDeliveries > 0 &&
    (!input.lastDeliveredAt ||
      (input.lastFailureAt ? input.lastFailureAt >= input.lastDeliveredAt : false))
  ) {
    return "critical";
  }

  if (input.successfulDeliveries === 0) {
    return "warning";
  }

  return "healthy";
}

function buildWorkerHealth(input: {
  heartbeats: CompanyAutomationWorkerHeartbeat[];
  expectedMode: CompanyAutomationWorkerHealth["expectedMode"];
  referenceTime?: string;
}): CompanyAutomationWorkerHealth {
  const referenceMs = Date.parse(input.referenceTime ?? new Date().toISOString());
  const sortedWorkers = [...input.heartbeats].sort((left, right) =>
    right.lastSeenAt.localeCompare(left.lastSeenAt)
  );
  const workers = sortedWorkers.slice(0, 10);
  const activeWorkers = workers.filter((worker) =>
    isWorkerHeartbeatFresh(worker, referenceMs)
  ).length;
  const staleWorkers = workers.filter((worker) => !isWorkerHeartbeatFresh(worker, referenceMs)).length;
  const latestErrorWorker = workers.find((worker) => worker.status === "error" && worker.lastError);
  const latestHeartbeatAt = workers[0]?.lastSeenAt;
  const latestErrorAt = latestErrorWorker?.lastSeenAt;

  return {
    status: resolveWorkerHealthStatus({
      expectedMode: input.expectedMode,
      workers,
      activeWorkers,
      staleWorkers,
      latestErrorWorker
    }),
    expectedMode: input.expectedMode,
    activeWorkers,
    staleWorkers,
    latestHeartbeatAt,
    latestErrorAt,
    latestError: latestErrorWorker?.lastError,
    workers
  };
}

function resolveWorkerHealthStatus(input: {
  expectedMode: CompanyAutomationWorkerHealth["expectedMode"];
  workers: CompanyAutomationWorkerHeartbeat[];
  activeWorkers: number;
  staleWorkers: number;
  latestErrorWorker?: CompanyAutomationWorkerHeartbeat;
}): HealthState {
  if (input.expectedMode === "inline") {
    return input.latestErrorWorker ? "warning" : "healthy";
  }

  if (input.activeWorkers === 0) {
    return "critical";
  }

  if (input.latestErrorWorker || input.staleWorkers > 0) {
    return "warning";
  }

  return "healthy";
}

function isWorkerHeartbeatFresh(worker: CompanyAutomationWorkerHeartbeat, referenceMs: number) {
  const lastSeenMs = Date.parse(worker.lastSeenAt);
  const allowedDriftMs = Math.max(worker.intervalMs * 3, 60_000);
  return Number.isFinite(lastSeenMs) && referenceMs - lastSeenMs <= allowedDriftMs;
}
