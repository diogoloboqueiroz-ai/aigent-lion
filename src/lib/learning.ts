import {
  getStoredCompanyExperimentOutcomes,
  getStoredCompanyAgentLearnings,
  getStoredCompanyLearningPlaybooks,
  getStoredCrossTenantLearningPlaybooks,
  replaceStoredCompanyExperimentOutcomes,
  replaceStoredCompanyAgentLearnings,
  replaceStoredCompanyLearningPlaybooks,
  replaceStoredCrossTenantLearningPlaybooks
} from "@/lib/company-vault";
import { buildCrossTenantLearningPlaybooks } from "@/core/learning/cross-tenant-learning";
import { buildCampaignRuntimeExperimentOutcomes } from "@/core/learning/campaign-runtime-outcomes";
import {
  buildFailureMemory,
  buildLearningValidityScope,
  buildOutcomeFingerprint,
  buildPlaybookFingerprint,
  buildReuseGuidance,
  computeLearningValidUntil,
  computeLearningStatisticalSummary,
  computeNextLearningVersion,
  inferLearningConfidenceState
} from "@/core/learning/versioned-learning";
import type {
  CompanyAutomationExperiment,
  CompanyAutomationRun,
  CompanyAgentLearning,
  CompanyExperimentOutcome,
  CompanyExecutionPlan,
  CompanyLearningPlaybook,
  CrossTenantLearningPlaybook,
  CompanyOperationalAlert,
  CompanyOptimizationScorecard,
  CompanyWorkspace,
  ExecutionTrackPriority,
  LearningShareability,
  SocialInsightSnapshot
} from "@/lib/domain";
import type { AutomationRun, ExperimentResult } from "@/lib/agents/types";

type SyncCompanyLearningMemoryInput = {
  workspace: CompanyWorkspace;
  latestPlan?: CompanyExecutionPlan;
  alerts?: CompanyOperationalAlert[];
  latestRun?: CompanyAutomationRun | AutomationRun;
  experimentResults?: ExperimentResult[];
};

export function getCompanyAgentLearnings(companySlug: string) {
  return getStoredCompanyAgentLearnings(companySlug).sort(sortLearnings);
}

export function getCompanyExperimentOutcomes(companySlug: string) {
  return getStoredCompanyExperimentOutcomes(companySlug).sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  );
}

export function getCompanyLearningPlaybooks(companySlug: string) {
  return getStoredCompanyLearningPlaybooks(companySlug).sort(sortPlaybooks);
}

export function getCrossTenantLearningPlaybooks() {
  return getStoredCrossTenantLearningPlaybooks().sort(sortSharedPlaybooks);
}

export function syncCompanyLearningMemory(input: SyncCompanyLearningMemoryInput) {
  const latestPlan = input.latestPlan ?? input.workspace.executionPlans[0];
  const alerts = input.alerts ?? input.workspace.operationalAlerts;
  const generatedLearnings = dedupeLearnings([
    ...(latestPlan ? buildPlanLearnings(input.workspace.company.slug, latestPlan) : []),
    ...buildAlertLearnings(input.workspace.company.slug, alerts),
    ...buildRuntimeLearnings(input.workspace),
    ...buildConversionLearnings(input.workspace),
    ...buildReportLearnings(input.workspace),
    ...buildSocialInsightLearnings(input.workspace.company.slug, input.workspace.socialInsights)
  ]);
  const existingLearnings = getStoredCompanyAgentLearnings(input.workspace.company.slug);
  const existingById = new Map(existingLearnings.map((learning) => [learning.id, learning]));
  const activeIds = new Set(generatedLearnings.map((learning) => learning.id));
  const now = new Date().toISOString();

  const nextLearnings = generatedLearnings.map((learning) => {
    const previous = existingById.get(learning.id);
    const changed = !previous || buildLearningFingerprint(previous) !== buildLearningFingerprint(learning);

    return {
      ...learning,
      generatedAt: previous?.generatedAt ?? learning.generatedAt,
      updatedAt: now,
      status: changed ? "fresh" : "active",
      lastAppliedAt: previous?.lastAppliedAt
    } satisfies CompanyAgentLearning;
  });

  const historicalLearnings = existingLearnings
    .filter((learning) => !activeIds.has(learning.id))
    .map((learning) => ({
      ...learning,
      status: "historical" as const
    }));

  const combined = [...nextLearnings, ...historicalLearnings].sort(sortLearnings).slice(0, 180);
  replaceStoredCompanyAgentLearnings(input.workspace.company.slug, combined);

  const experimentOutcomes = syncExperimentOutcomes(input);
  syncLearningPlaybooks({
    workspace: input.workspace,
    latestRun: input.latestRun,
    experimentOutcomes,
    learnings: combined
  });
  syncCrossTenantLearningPlaybooks();

  return combined;
}

export function getAgentLearningKindLabel(kind: CompanyAgentLearning["kind"]) {
  switch (kind) {
    case "playbook":
      return "playbook";
    case "risk":
      return "risco";
    case "warning":
      return "alerta";
    default:
      return "oportunidade";
  }
}

export function getAgentLearningStatusLabel(status: CompanyAgentLearning["status"]) {
  switch (status) {
    case "fresh":
      return "novo";
    case "active":
      return "ativo";
    default:
      return "historico";
  }
}

function syncExperimentOutcomes(input: SyncCompanyLearningMemoryInput) {
  const existing = getStoredCompanyExperimentOutcomes(input.workspace.company.slug);
  const existingById = new Map(existing.map((outcome) => [outcome.id, outcome]));
  const generated = dedupeOutcomes([
    ...(input.latestRun
      ? buildExperimentOutcomes({
          workspace: input.workspace,
          run: input.latestRun,
          experimentResults: input.experimentResults ?? []
        })
      : []),
    ...buildCampaignRuntimeExperimentOutcomes({
      workspace: input.workspace
    })
  ]);
  const activeIds = new Set(generated.map((outcome) => outcome.id));
  const nextOutcomes = [
    ...generated.map((outcome) => {
      const previous = existingById.get(outcome.id);
      const nextFingerprint = buildOutcomeFingerprint(outcome);
      const previousFingerprint = previous ? buildOutcomeFingerprint(previous) : undefined;
      const version = computeNextLearningVersion({
        previous,
        previousFingerprint,
        nextFingerprint
      });
      const validFrom =
        previous && previousFingerprint === nextFingerprint ? previous.validFrom : outcome.updatedAt;
      const validUntil = computeLearningValidUntil({
        observedWindow: outcome.observedWindow,
        updatedAt: outcome.updatedAt,
        status: outcome.status
      });
      const statisticalSummary = computeLearningStatisticalSummary({
        wins: outcome.status === "won" ? 1 : 0,
        losses: outcome.status === "lost" || outcome.status === "inconclusive" ? 1 : 0,
        minimumSampleSize: outcome.observedWindow === "28d" ? 2 : 3
      });
      const confidenceState = inferLearningConfidenceState({
        confidence: statisticalSummary.posteriorMean,
        lossCount: outcome.status === "lost" || outcome.status === "inconclusive" ? 1 : 0,
        winCount: outcome.status === "won" ? 1 : 0,
        status: outcome.status,
        validUntil
      });
      return {
        ...outcome,
        version,
        confidenceState,
        validFrom,
        validUntil,
        statisticalSummary,
        generatedAt: previous?.generatedAt ?? outcome.generatedAt,
        updatedAt: outcome.updatedAt
      };
    }),
    ...existing.filter((outcome) => !activeIds.has(outcome.id))
  ]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 240);

  replaceStoredCompanyExperimentOutcomes(input.workspace.company.slug, nextOutcomes);
  return nextOutcomes;
}

function dedupeOutcomes(outcomes: CompanyExperimentOutcome[]) {
  const byId = new Map<string, CompanyExperimentOutcome>();

  for (const outcome of outcomes) {
    const current = byId.get(outcome.id);
    if (!current || outcome.updatedAt.localeCompare(current.updatedAt) > 0) {
      byId.set(outcome.id, outcome);
    }
  }

  return Array.from(byId.values());
}

function syncLearningPlaybooks(input: {
  workspace: CompanyWorkspace;
  latestRun?: CompanyAutomationRun | AutomationRun;
  experimentOutcomes: CompanyExperimentOutcome[];
  learnings: CompanyAgentLearning[];
}) {
  const existing = getStoredCompanyLearningPlaybooks(input.workspace.company.slug);
  const generated = buildLearningPlaybooks(input);
  const activeIds = new Set(generated.map((playbook) => playbook.id));
  const nextPlaybooks = [
    ...generated.map((playbook) => {
      const previous = existing.find((entry) => entry.id === playbook.id);
      const nextFingerprint = buildPlaybookFingerprint(playbook);
      const previousFingerprint = previous ? buildPlaybookFingerprint(previous) : undefined;
      const version = computeNextLearningVersion({
        previous,
        previousFingerprint,
        nextFingerprint
      });
      const validFrom =
        previous && previousFingerprint === nextFingerprint ? previous.validFrom : playbook.updatedAt;
      const validUntil = computeLearningValidUntil({
        observedWindow: playbook.validityScope.observedWindow,
        updatedAt: playbook.updatedAt,
        status: playbook.status
      });
      const confidenceState = inferLearningConfidenceState({
        confidence: playbook.confidence,
        lossCount: playbook.lossCount,
        winCount: playbook.winCount,
        status: playbook.status,
        validUntil
      });

      return {
        ...playbook,
        version,
        confidenceState,
        validFrom,
        validUntil,
        failureMemory: buildFailureMemory({
          previous: previous?.failureMemory,
          latestStatus: playbook.status,
          latestFailureAt:
            playbook.lossCount > 0 && playbook.updatedAt ? playbook.updatedAt : previous?.failureMemory.lastFailureAt,
          latestFailureReason:
            playbook.lossCount > playbook.winCount ? playbook.summary : previous?.failureMemory.lastFailureReason,
          lossCount: playbook.lossCount
        }),
        reuseGuidance: buildReuseGuidance({
          recommendedAction: playbook.recommendedAction,
          channel: playbook.channel,
          confidenceState,
          tenantOnly: playbook.validityScope.tenantOnly
        })
      };
    }),
    ...existing
      .filter((playbook) => !activeIds.has(playbook.id))
      .map((playbook) => ({
        ...playbook,
        status: playbook.status === "active" ? ("candidate" as const) : playbook.status
      }))
  ]
    .sort(sortPlaybooks)
    .slice(0, 180);

  replaceStoredCompanyLearningPlaybooks(input.workspace.company.slug, nextPlaybooks);
  return nextPlaybooks;
}

function syncCrossTenantLearningPlaybooks() {
  const sharedPlaybooks = buildCrossTenantLearningPlaybooks({
    playbooks: getStoredCompanyLearningPlaybooks(),
    previousPlaybooks: getStoredCrossTenantLearningPlaybooks()
  });
  replaceStoredCrossTenantLearningPlaybooks(sharedPlaybooks);
  return sharedPlaybooks;
}

function buildExperimentOutcomes(input: {
  workspace: CompanyWorkspace;
  run: CompanyAutomationRun | AutomationRun;
  experimentResults: ExperimentResult[];
}) {
  const experimentById = new Map(input.run.experiments.map((experiment) => [experiment.id, experiment]));
  const scorecardsByChannel = new Map(
    (input.run.cmoDecision?.scorecards ?? []).map((scorecard) => [scorecard.channel, scorecard])
  );

  return input.experimentResults.map((result) => {
    const experiment = experimentById.get(result.experimentId);
    const channel = resolveExperimentChannel(experiment?.title ?? result.experimentId, result);
    const scorecard = channel ? scorecardsByChannel.get(channel) : undefined;
    const observedMetric = resolveObservedMetricValue(scorecard, experiment?.primaryMetric, result);
    const status = mapExperimentResultToOutcomeStatus(result, scorecard);
    const confidenceDelta = scorecard
      ? scorecard.decision === "scale"
        ? 0.14
        : scorecard.decision === "pause"
          ? -0.16
          : scorecard.decision === "fix"
            ? -0.05
            : 0.03
      : result.status === "won"
        ? 0.1
      : result.status === "lost"
        ? -0.1
        : 0;
    const generatedAt = result.createdAt;
    const statisticalSummary = computeLearningStatisticalSummary({
      wins: status === "won" ? 1 : 0,
      losses: status === "lost" || status === "inconclusive" ? 1 : 0,
      minimumSampleSize: scorecard?.window === "28d" ? 2 : 3
    });

    return {
      id: `experiment-outcome-${result.experimentId}`,
      companySlug: input.workspace.company.slug,
      learningBoundary: "tenant_private",
      shareability: determineOutcomeShareability(channel, result, scorecard),
      version: 1,
      confidenceState: "emerging",
      validFrom: generatedAt,
      validUntil: computeLearningValidUntil({
        observedWindow: scorecard?.window ?? "7d",
        updatedAt: generatedAt,
        status
      }),
      validityScope: buildLearningValidityScope({
        channel: channel ?? "unknown",
        targetMetric: experiment?.primaryMetric ?? extractMetric(result) ?? "primary_metric",
        observedWindow: scorecard?.window ?? "7d",
        tenantOnly: true
      }),
      experimentId: result.experimentId,
      channel: channel ?? "unknown",
      title: experiment?.title ?? result.summary,
      hypothesis: experiment?.hypothesis ?? result.summary,
      targetMetric: experiment?.primaryMetric ?? extractMetric(result) ?? "primary_metric",
      baselineValue: extractBaselineValue(experiment, scorecard),
      observedValue: observedMetric,
      observedWindow: scorecard?.window ?? "7d",
      status,
      successCriteria:
        experiment?.successCriteria ??
        `Melhorar ${experiment?.primaryMetric ?? "o KPI principal"} sem aumentar risco operacional.`,
      winningVariant: result.winningVariant,
      confidenceDelta,
      statisticalSummary,
      reuseRecommendation: buildReuseRecommendation(status, channel, result.winningVariant),
      failureNote:
        status === "lost" || status === "inconclusive"
          ? result.summary
          : undefined,
      sourceRunId: input.run.id,
      evidence: [
        ...result.observedMetrics.map((metric) => `${metric.label}: ${metric.value}`),
        ...(scorecard?.evidence ?? [])
      ].slice(0, 8),
      generatedAt,
      updatedAt: generatedAt
    } satisfies CompanyExperimentOutcome;
  });
}

function buildLearningPlaybooks(input: {
  workspace: CompanyWorkspace;
  latestRun?: CompanyAutomationRun | AutomationRun;
  experimentOutcomes: CompanyExperimentOutcome[];
  learnings: CompanyAgentLearning[];
}) {
  const playbookInputs = new Map<
    string,
    {
      companySlug: string;
      channel: string;
      title: string;
      evidence: string[];
      winCount: number;
      lossCount: number;
      confidence: number;
      sourceExperimentId?: string;
      sourceRunId?: string;
      summary: string;
      recommendedAction: string;
      lastValidatedAt?: string;
    }
  >();

  for (const outcome of input.experimentOutcomes) {
    const key = `${input.workspace.company.slug}:${outcome.channel}`;
    const current = playbookInputs.get(key) ?? {
      companySlug: input.workspace.company.slug,
      channel: outcome.channel,
      title: `Playbook de ${getReadableChannelLabel(outcome.channel)}`,
      evidence: [],
      winCount: 0,
      lossCount: 0,
      confidence: 0.68,
      sourceExperimentId: outcome.experimentId,
      sourceRunId: outcome.sourceRunId,
      summary: outcome.hypothesis,
      recommendedAction:
        outcome.reuseRecommendation ?? "Reavaliar a proxima melhor acao antes de escalar.",
      lastValidatedAt: outcome.updatedAt
    };

    playbookInputs.set(key, {
      ...current,
      evidence: dedupeStrings([...current.evidence, ...outcome.evidence]).slice(0, 8),
      winCount: current.winCount + (outcome.status === "won" ? 1 : 0),
      lossCount:
        current.lossCount + (outcome.status === "lost" || outcome.status === "inconclusive" ? 1 : 0),
      confidence: clampConfidence(current.confidence + outcome.confidenceDelta),
      summary:
        outcome.status === "won"
          ? `Padrao vencedor recente em ${getReadableChannelLabel(outcome.channel)}.`
          : outcome.status === "lost"
            ? `Padrao em risco recente em ${getReadableChannelLabel(outcome.channel)}.`
            : current.summary,
      recommendedAction: outcome.reuseRecommendation ?? current.recommendedAction,
      lastValidatedAt: outcome.updatedAt
    });
  }

  for (const learning of input.learnings.filter(
    (entry) =>
      entry.status !== "historical" && (entry.kind === "playbook" || entry.kind === "risk")
  )) {
    const channel = resolveLearningChannel(learning, input.workspace.executionPlans[0]?.optimizationScorecards ?? []);
    if (!channel) {
      continue;
    }

    const key = `${input.workspace.company.slug}:${channel}`;
    const current = playbookInputs.get(key) ?? {
      companySlug: input.workspace.company.slug,
      channel,
      title: `Playbook de ${getReadableChannelLabel(channel)}`,
      evidence: [],
      winCount: 0,
      lossCount: 0,
      confidence: 0.66,
      summary: learning.summary,
      recommendedAction: learning.recommendedAction ?? "Revalidar esta tese no proximo ciclo.",
      lastValidatedAt: learning.updatedAt
    };

    playbookInputs.set(key, {
      ...current,
      evidence: dedupeStrings([...current.evidence, ...(learning.evidence ?? [])]).slice(0, 8),
      winCount: current.winCount + (learning.kind === "playbook" ? 1 : 0),
      lossCount: current.lossCount + (learning.kind === "risk" ? 1 : 0),
      confidence: clampConfidence(current.confidence + (learning.kind === "playbook" ? 0.05 : -0.04)),
      summary: learning.summary,
      recommendedAction: learning.recommendedAction ?? current.recommendedAction,
      lastValidatedAt: learning.updatedAt
    });
  }

  return Array.from(playbookInputs.values()).map((entry) => {
    const statisticalSummary = computeLearningStatisticalSummary({
      wins: entry.winCount,
      losses: entry.lossCount,
      minimumSampleSize: 4
    });
    const calibratedConfidence = clampConfidence(
      entry.confidence * 0.35 + statisticalSummary.posteriorMean * 0.65
    );
    const status =
      entry.winCount >= 2 &&
      entry.lossCount === 0 &&
      statisticalSummary.evidenceStrength !== "weak"
        ? ("active" as const)
        : entry.lossCount > entry.winCount
          ? ("retired" as const)
          : "candidate";
    const observedWindow = inferPlaybookObservedWindow(input.experimentOutcomes, entry.channel);
    const updatedAt = input.latestRun?.finishedAt ?? new Date().toISOString();
    const validUntil = computeLearningValidUntil({
      observedWindow,
      updatedAt,
      status
    });
    const confidenceState = inferLearningConfidenceState({
      confidence: calibratedConfidence,
      lossCount: entry.lossCount,
      winCount: entry.winCount,
      status,
      validUntil
    });

    return {
      id: `playbook-${entry.companySlug}-${entry.channel}`,
      companySlug: entry.companySlug,
      learningBoundary: "tenant_private",
      shareability: determinePlaybookShareability(entry),
      version: 1,
      confidenceState,
      validFrom: input.latestRun?.startedAt ?? new Date().toISOString(),
      validUntil,
      validityScope: buildLearningValidityScope({
        channel: entry.channel,
        targetMetric: inferPlaybookTargetMetric(input.experimentOutcomes, entry.channel),
        observedWindow,
        tenantOnly: true
      }),
      failureMemory: buildFailureMemory({
        latestStatus: status,
        latestFailureAt: entry.lossCount > 0 ? entry.lastValidatedAt : undefined,
        latestFailureReason: entry.lossCount > entry.winCount ? entry.summary : undefined,
        lossCount: entry.lossCount
      }),
      channel: entry.channel,
      title: entry.title,
      summary: entry.summary,
      status,
      confidence: calibratedConfidence,
      statisticalSummary,
      winCount: entry.winCount,
      lossCount: entry.lossCount,
      sourceExperimentId: entry.sourceExperimentId,
      sourceRunId: entry.sourceRunId,
      recommendedAction: entry.recommendedAction,
      reuseGuidance: buildReuseGuidance({
        recommendedAction: entry.recommendedAction,
        channel: entry.channel,
        confidenceState,
        tenantOnly: true
      }),
      evidence: entry.evidence,
      createdAt: input.latestRun?.startedAt ?? new Date().toISOString(),
      updatedAt,
      lastValidatedAt: entry.lastValidatedAt
    } satisfies CompanyLearningPlaybook;
  });
}

function buildPlanLearnings(companySlug: string, plan: CompanyExecutionPlan): CompanyAgentLearning[] {
  return (plan.recommendedActions ?? []).reduce<CompanyAgentLearning[]>((learnings, action) => {
    const base = {
      companySlug,
      learningBoundary: "tenant_private" as const,
      shareability: "restricted" as const,
      sourceType: "execution_plan" as const,
      sourcePath: `/empresas/${companySlug}/operacao`,
      sourceLabel: "Abrir operacao",
      generatedAt: plan.generatedAt,
      updatedAt: plan.generatedAt,
      evidence: action.evidence
    };

    if (action.status === "executed") {
      learnings.push({
          id: `learning-plan-executed-${action.id}`,
          kind: "playbook" as const,
          status: "fresh" as const,
          priority: action.priority,
          confidence: action.mode === "auto_low_risk" ? 0.92 : 0.84,
          title: `Playbook confirmado: ${action.title}`,
          summary: action.outcome ?? action.detail,
          recommendedAction: action.outcome ?? action.detail,
          ...base
        });
      return learnings;
    }

    if (action.status === "blocked") {
      learnings.push({
          id: `learning-plan-blocked-${action.id}`,
          kind: action.mode === "policy_review" ? ("warning" as const) : ("risk" as const),
          status: "fresh" as const,
          priority: action.priority,
          confidence: 0.88,
          title: `Gargalo observado: ${action.title}`,
          summary: action.outcome ?? action.detail,
          recommendedAction: "Abrir a origem do bloqueio e remover a dependencia antes do proximo replay.",
          ...base
        });
      return learnings;
    }

    if (action.priority === "critical" || action.priority === "high") {
      learnings.push({
          id: `learning-plan-opportunity-${action.id}`,
          kind: "opportunity" as const,
          status: "fresh" as const,
          priority: action.priority,
          confidence: 0.76,
          title: `Oportunidade operacional: ${action.title}`,
          summary: action.detail,
          recommendedAction: action.detail,
          ...base
        });
    }

    return learnings;
  }, []);
}

function buildAlertLearnings(companySlug: string, alerts: CompanyOperationalAlert[]): CompanyAgentLearning[] {
  return alerts
    .filter((alert) => alert.status !== "resolved")
    .map((alert) => ({
      id: `learning-alert-${alert.id}`,
      companySlug,
      learningBoundary: "tenant_private" as const,
      shareability: "restricted" as const,
      kind: alert.priority === "critical" ? ("warning" as const) : ("risk" as const),
      status: "fresh" as const,
      priority: alert.priority,
      confidence: 0.86,
      title: alert.title,
      summary: alert.message,
      recommendedAction: `Tratar o alerta em ${alert.sourceLabel.toLowerCase()}.`,
      evidence: alert.evidence,
      sourceType: "operational_alert" as const,
      sourcePath: alert.sourcePath,
      sourceLabel: alert.sourceLabel,
      generatedAt: alert.updatedAt,
      updatedAt: alert.updatedAt
    }));
}

function buildRuntimeLearnings(workspace: CompanyWorkspace): CompanyAgentLearning[] {
  const recentLogs = workspace.socialExecutionLogs.slice(0, 20);
  const blockedOrFailed = recentLogs.filter((log) => log.status === "blocked" || log.status === "failed");
  const completed = recentLogs.filter((log) => log.status === "completed");
  const learnings: CompanyAgentLearning[] = [];

  if (blockedOrFailed.length > 0) {
    const latestFailure = blockedOrFailed[0];
    learnings.push({
      id: `learning-runtime-risk-${workspace.company.slug}`,
      companySlug: workspace.company.slug,
      learningBoundary: "tenant_private",
      shareability: "restricted",
      kind: blockedOrFailed.some((log) => log.status === "failed") ? "warning" : "risk",
      status: "fresh",
      priority: blockedOrFailed.some((log) => log.status === "failed") ? "critical" : "high",
      confidence: 0.83,
      title: "Padrao de falha na runtime social",
      summary: `${blockedOrFailed.length} eventos recentes ficaram bloqueados ou falharam. Ultimo sinal: ${latestFailure.summary}.`,
      recommendedAction: "Limpar a runtime social e atacar a causa-raiz antes de ampliar automacao.",
      evidence: blockedOrFailed.slice(0, 3).map((log) => `${log.platform}: ${log.detail}`),
      sourceType: "runtime_log",
      sourcePath: `/empresas/${workspace.company.slug}/social/runtime`,
      sourceLabel: "Abrir runtime social",
      generatedAt: latestFailure.startedAt,
      updatedAt: latestFailure.finishedAt ?? latestFailure.startedAt
    });
  }

  if (completed.length >= 2) {
    const successfulPlatforms = Array.from(new Set(completed.map((log) => log.platform)));
    learnings.push({
      id: `learning-runtime-playbook-${workspace.company.slug}`,
      companySlug: workspace.company.slug,
      learningBoundary: "tenant_private",
      shareability: "anonymizable",
      kind: "playbook",
      status: "fresh",
      priority: "medium",
      confidence: 0.79,
      title: "A runtime ja entrega execucao repetivel",
      summary: `${completed.length} tarefas recentes foram concluidas com sucesso em ${successfulPlatforms.join(", ")}.`,
      recommendedAction: "Reaplicar a rotina vencedora nos canais que ja mostraram estabilidade operacional.",
      evidence: completed.slice(0, 3).map((log) => `${log.platform}: ${log.summary}`),
      sourceType: "runtime_log",
      sourcePath: `/empresas/${workspace.company.slug}/social/runtime`,
      sourceLabel: "Abrir runtime social",
      generatedAt: completed[0].startedAt,
      updatedAt: completed[0].finishedAt ?? completed[0].startedAt
    });
  }

  return learnings;
}

function buildConversionLearnings(workspace: CompanyWorkspace): CompanyAgentLearning[] {
  const recentEvents = workspace.conversionEvents.slice(0, 24);
  const blockedOrFailed = recentEvents.filter((event) => event.status === "blocked" || event.status === "failed");
  const sentEvents = recentEvents.filter((event) => event.status === "sent");
  const wonLeads = (workspace.leads ?? []).filter((lead) => lead.stage === "won");
  const wonRevenue = wonLeads.reduce((total, lead) => total + (lead.revenueActual ?? 0), 0);
  const learnings: CompanyAgentLearning[] = [];

  if (blockedOrFailed.length > 0) {
    const latestIssue = blockedOrFailed[0];
    learnings.push({
      id: `learning-conversion-risk-${workspace.company.slug}`,
      companySlug: workspace.company.slug,
      learningBoundary: "tenant_private",
      shareability: "restricted",
      kind: blockedOrFailed.some((event) => event.status === "failed") ? "warning" : "risk",
      status: "fresh",
      priority: blockedOrFailed.some((event) => event.status === "failed") ? "critical" : "high",
      confidence: 0.9,
      title: "Dispatch de conversao com gargalo ativo",
      summary: `${blockedOrFailed.length} eventos recentes ficaram bloqueados ou falharam. Ultimo sinal: ${latestIssue.summary}.`,
      recommendedAction: "Abrir a trilha de conversao e corrigir mapping, credenciais ou identificadores antes do proximo replay.",
      evidence: blockedOrFailed
        .slice(0, 4)
        .map((event) => `${event.destination}: ${event.detail}`),
      sourceType: "conversion_event",
      sourcePath: `/empresas/${workspace.company.slug}/conversao`,
      sourceLabel: "Abrir conversao",
      generatedAt: latestIssue.updatedAt,
      updatedAt: latestIssue.updatedAt
    });
  }

  if (sentEvents.length >= 2) {
    const destinations = Array.from(new Set(sentEvents.map((event) => event.destination)));
    const revenueCaptured = sentEvents.reduce((total, event) => total + (event.value ?? 0), 0);
    learnings.push({
      id: `learning-conversion-playbook-${workspace.company.slug}`,
      companySlug: workspace.company.slug,
      learningBoundary: "tenant_private",
      shareability: revenueCaptured > 0 ? "restricted" : "anonymizable",
      kind: "playbook",
      status: "fresh",
      priority: "medium",
      confidence: 0.84,
      title: "Loop de atribuicao ja responde",
      summary: `${sentEvents.length} eventos de conversao recentes foram aceitos por ${destinations.join(", ")}.`,
      recommendedAction:
        revenueCaptured > 0
          ? `Reforcar campanhas e canais ligados aos eventos que ja devolvem sinal com ${formatCurrency(revenueCaptured)} em valor potencial.`
          : "Proteger o fluxo vencedor e ampliar a cobertura de captura para mais campanhas e landing pages.",
      evidence: sentEvents
        .slice(0, 4)
        .map((event) => `${event.destination}: ${event.summary}`),
      sourceType: "conversion_event",
      sourcePath: `/empresas/${workspace.company.slug}/conversao`,
      sourceLabel: "Abrir conversao",
      generatedAt: sentEvents[0].updatedAt,
      updatedAt: sentEvents[0].updatedAt
    });
  }

  if (wonLeads.length > 0 && wonRevenue > 0) {
    learnings.push({
      id: `learning-conversion-revenue-${workspace.company.slug}`,
      companySlug: workspace.company.slug,
      learningBoundary: "tenant_private",
      shareability: "restricted",
      kind: "opportunity",
      status: "fresh",
      priority: wonLeads.length >= 3 ? "high" : "medium",
      confidence: 0.8,
      title: "Receita real ja entrou no funil canonico",
      summary: `${wonLeads.length} leads ganhos registram ${formatCurrency(wonRevenue)} em receita real no workspace.`,
      recommendedAction: "Usar esse feedback para recalibrar prioridade de campanhas, mensagem de landing e cadencias comerciais.",
      evidence: wonLeads
        .slice(0, 3)
        .map((lead) => `${lead.fullName}: ${formatCurrency(lead.revenueActual ?? 0)}`),
      sourceType: "conversion_event",
      sourcePath: `/empresas/${workspace.company.slug}/conversao`,
      sourceLabel: "Abrir conversao",
      generatedAt: wonLeads[0].lastTouchedAt,
      updatedAt: wonLeads[0].lastTouchedAt
    });
  }

  return learnings;
}

function buildReportLearnings(workspace: CompanyWorkspace): CompanyAgentLearning[] {
  const latestReport = workspace.reports[0];
  if (!latestReport) {
    return [];
  }

  return [
    {
      id: `learning-report-${latestReport.id}`,
      companySlug: workspace.company.slug,
      learningBoundary: "tenant_private",
      shareability: "restricted",
      kind: "opportunity",
      status: "fresh",
      priority: "medium",
      confidence: 0.74,
      title: `Leitura executiva: ${latestReport.title}`,
      summary: latestReport.highlights[0] ?? latestReport.summary,
      recommendedAction: latestReport.actions[0],
      evidence: [...latestReport.highlights.slice(0, 2), ...latestReport.risks.slice(0, 1)],
      sourceType: "report",
      sourcePath: `/empresas/${workspace.company.slug}/relatorios`,
      sourceLabel: "Abrir relatorios",
      generatedAt: latestReport.generatedAt,
      updatedAt: latestReport.generatedAt
    }
  ];
}

function buildSocialInsightLearnings(
  companySlug: string,
  insights: SocialInsightSnapshot[]
): CompanyAgentLearning[] {
  return pickLatestInsights(insights).slice(0, 3).map((snapshot) => ({
    id: `learning-social-${companySlug}-${snapshot.platform}-${snapshot.window}`,
    companySlug,
    learningBoundary: "tenant_private" as const,
    shareability: "anonymizable" as const,
    kind: "opportunity" as const,
    status: "fresh" as const,
    priority: snapshot.window === "7d" ? "high" : "medium",
    confidence: 0.68,
    title: `Sinal vivo em ${snapshot.platform}`,
    summary: snapshot.note,
    recommendedAction: `Proteger o ritmo de publicacao e iterar criativos em ${snapshot.platform}.`,
    evidence: [
      `Reach ${snapshot.window}: ${snapshot.reach}`,
      `Engajamento ${snapshot.window}: ${snapshot.engagementRate}`,
      `Cliques ${snapshot.window}: ${snapshot.clicks}`
    ],
    sourceType: "social_insight" as const,
    sourcePath: `/empresas/${companySlug}/social`,
    sourceLabel: "Abrir social ops",
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
}

function pickLatestInsights(insights: SocialInsightSnapshot[]) {
  const byPlatform = new Map<string, SocialInsightSnapshot>();

  for (const snapshot of insights) {
    if (snapshot.reach === "n/d") {
      continue;
    }

    const current = byPlatform.get(snapshot.platform);
    if (!current || (current.window === "28d" && snapshot.window === "7d")) {
      byPlatform.set(snapshot.platform, snapshot);
    }
  }

  return Array.from(byPlatform.values());
}

function mapExperimentResultToOutcomeStatus(
  result: ExperimentResult,
  scorecard?: CompanyOptimizationScorecard
) {
  if (result.status === "won" || scorecard?.decision === "scale") {
    return "won" as const;
  }

  if (result.status === "lost" || scorecard?.decision === "pause") {
    return "lost" as const;
  }

  if (scorecard?.decision === "fix") {
    return "inconclusive" as const;
  }

  return "observing" as const;
}

function resolveExperimentChannel(
  title: string,
  result: ExperimentResult
) {
  const channelMetric = result.observedMetrics.find((metric) => metric.label === "channel")?.value;
  if (channelMetric) {
    return channelMetric;
  }

  const normalized = title.toLowerCase();
  if (normalized.includes("google ads")) {
    return "google-ads";
  }

  if (normalized.includes("meta")) {
    return "meta";
  }

  if (normalized.includes("ga4")) {
    return "ga4";
  }

  if (normalized.includes("search console")) {
    return "search-console";
  }

  return result.experimentId.split("-").at(-1);
}

function resolveObservedMetricValue(
  scorecard: CompanyOptimizationScorecard | undefined,
  primaryMetric: string | undefined,
  result: ExperimentResult
) {
  if (scorecard) {
    if (primaryMetric?.toLowerCase().includes("cpa")) {
      return scorecard.cpa;
    }

    if (primaryMetric?.toLowerCase().includes("ctr")) {
      return scorecard.ctr;
    }

    if (primaryMetric?.toLowerCase().includes("revenue")) {
      return scorecard.revenue;
    }

    return scorecard.score;
  }

  const metricValue = extractMetricValue(result);
  return metricValue;
}

function extractMetric(result: ExperimentResult) {
  return result.observedMetrics.find((metric) => metric.label === "primaryMetric")?.value;
}

function extractMetricValue(result: ExperimentResult) {
  const numericMetric = result.observedMetrics.find((metric) => {
    const value = Number(metric.value);
    return Number.isFinite(value);
  });

  return numericMetric ? Number(numericMetric.value) : undefined;
}

function extractBaselineValue(
  experiment: CompanyAutomationExperiment | undefined,
  scorecard?: CompanyOptimizationScorecard
) {
  return experiment?.baselineMetricValue ?? scorecard?.cpa ?? scorecard?.ctr ?? scorecard?.score;
}

function buildReuseRecommendation(
  status: CompanyExperimentOutcome["status"],
  channel: string | undefined,
  winningVariant: string | undefined
) {
  if (status === "won") {
    return winningVariant
      ? `Reaplicar ${winningVariant} como base vencedora em ${getReadableChannelLabel(channel)}.`
      : `Escalar o playbook vencedor em ${getReadableChannelLabel(channel)}.`;
  }

  if (status === "lost") {
    return `Evitar repetir esta combinacao em ${getReadableChannelLabel(channel)} sem revisar oferta, tracking ou criativo.`;
  }

  if (status === "inconclusive") {
    return `Ajustar criativo, oferta ou landing antes de abrir nova rodada em ${getReadableChannelLabel(channel)}.`;
  }

  return `Manter observacao controlada em ${getReadableChannelLabel(channel)} ate haver amostra suficiente.`;
}

function resolveLearningChannel(
  learning: CompanyAgentLearning,
  scorecards: CompanyOptimizationScorecard[]
) {
  const normalizedTitle = learning.title.toLowerCase();
  const scorecardMatch = scorecards.find((scorecard) =>
    normalizedTitle.includes(scorecard.channel.toLowerCase())
  );

  if (scorecardMatch) {
    return scorecardMatch.channel;
  }

  if (normalizedTitle.includes("google ads")) {
    return "google-ads";
  }

  if (normalizedTitle.includes("meta")) {
    return "meta";
  }

  if (normalizedTitle.includes("ga4")) {
    return "ga4";
  }

  return undefined;
}

function getReadableChannelLabel(channel: string | undefined) {
  switch (channel) {
    case "google-ads":
      return "Google Ads";
    case "meta":
      return "Meta";
    case "ga4":
      return "GA4";
    case "search-console":
      return "Search Console";
    default:
      return channel ?? "o canal";
  }
}

function determineOutcomeShareability(
  channel: string | undefined,
  result: ExperimentResult,
  scorecard?: CompanyOptimizationScorecard
): Exclude<LearningShareability, "shared"> {
  if (!channel || channel === "unknown") {
    return "restricted";
  }

  if (
    result.observedMetrics.some((metric) => metric.label.toLowerCase().includes("revenue")) ||
    typeof scorecard?.revenue === "number"
  ) {
    return "restricted";
  }

  return "anonymizable";
}

function determinePlaybookShareability(entry: {
  channel: string;
  confidence: number;
  winCount: number;
  lossCount: number;
  summary: string;
  recommendedAction: string;
}): LearningShareability {
  const combinedText = `${entry.summary} ${entry.recommendedAction}`.toLowerCase();
  const containsSensitiveMarker =
    combinedText.includes("receita real") ||
    combinedText.includes("ltv") ||
    combinedText.includes("whatsapp") ||
    combinedText.includes("proposal") ||
    combinedText.includes("won ");

  if (containsSensitiveMarker || entry.channel === "unknown") {
    return "restricted";
  }

  if (entry.winCount > 0 && entry.confidence >= 0.7 && entry.lossCount <= entry.winCount + 1) {
    return "anonymizable";
  }

  return "restricted";
}

function inferPlaybookTargetMetric(outcomes: CompanyExperimentOutcome[], channel: string) {
  return outcomes.find((outcome) => outcome.channel === channel)?.targetMetric ?? "primary_metric";
}

function inferPlaybookObservedWindow(outcomes: CompanyExperimentOutcome[], channel: string) {
  return outcomes.find((outcome) => outcome.channel === channel)?.observedWindow ?? "7d";
}

function dedupeLearnings(learnings: CompanyAgentLearning[]) {
  const unique = new Map<string, CompanyAgentLearning>();

  for (const learning of learnings) {
    if (!unique.has(learning.id)) {
      unique.set(learning.id, learning);
    }
  }

  return Array.from(unique.values());
}

function buildLearningFingerprint(learning: CompanyAgentLearning) {
  return [
    learning.kind,
    learning.priority,
    learning.title,
    learning.summary,
    learning.recommendedAction ?? "",
    learning.sourceType,
    learning.sourcePath,
    learning.evidence?.join(" | ") ?? ""
  ].join("::");
}

function sortLearnings(a: CompanyAgentLearning, b: CompanyAgentLearning) {
  return (
    getLearningStatusScore(b.status) - getLearningStatusScore(a.status) ||
    getPriorityScore(b.priority) - getPriorityScore(a.priority) ||
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

function sortPlaybooks(a: CompanyLearningPlaybook, b: CompanyLearningPlaybook) {
  return (
    getPlaybookStatusScore(b.status) - getPlaybookStatusScore(a.status) ||
    b.confidence - a.confidence ||
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

function sortSharedPlaybooks(a: CrossTenantLearningPlaybook, b: CrossTenantLearningPlaybook) {
  return (
    getPlaybookStatusScore(b.status) - getPlaybookStatusScore(a.status) ||
    b.sourceTenantCount - a.sourceTenantCount ||
    b.confidence - a.confidence ||
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

function getLearningStatusScore(status: CompanyAgentLearning["status"]) {
  switch (status) {
    case "fresh":
      return 3;
    case "active":
      return 2;
    default:
      return 1;
  }
}

function getPriorityScore(priority: ExecutionTrackPriority) {
  switch (priority) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

function getPlaybookStatusScore(status: CompanyLearningPlaybook["status"]) {
  switch (status) {
    case "active":
      return 3;
    case "candidate":
      return 2;
    default:
      return 1;
  }
}

function clampConfidence(value: number) {
  return Math.max(0.05, Math.min(0.98, Number(value.toFixed(2))));
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2
  }).format(value);
}
