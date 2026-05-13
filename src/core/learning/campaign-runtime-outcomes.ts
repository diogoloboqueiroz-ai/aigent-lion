import {
  buildLearningValidityScope,
  computeLearningStatisticalSummary,
  computeLearningValidUntil
} from "@/core/learning/versioned-learning";
import type {
  CompanyExperimentOutcome,
  CompanyWorkspace,
  ExperimentOutcomeStatus,
  SocialExecutionLog,
  SocialExecutionMetric,
  SocialPlatformId
} from "@/lib/domain";

type CampaignRuntimeOutcomeInput = {
  workspace: Pick<CompanyWorkspace, "company" | "socialExecutionLogs">;
};

type RuntimeOutcomeGroup = {
  id: string;
  companySlug: string;
  experimentId: string;
  channel: string;
  kind: SocialExecutionLog["kind"];
  sourceCampaignBriefId?: string;
  sourceCampaignBriefVersion?: number;
  logs: SocialExecutionLog[];
};

type ParsedMetric = {
  label: string;
  value: number;
  priority: number;
};

const PERFORMANCE_METRICS = [
  { pattern: /convers|lead|venda|sale|revenue|receita/i, targetMetric: "conversions", priority: 5 },
  { pattern: /cpa|cac|cost/i, targetMetric: "efficiency", priority: 4 },
  { pattern: /click|clique|acao|a[cç][aã]o/i, targetMetric: "clicks", priority: 3 },
  { pattern: /engaj|engage|comment|like|share/i, targetMetric: "engagement", priority: 2 },
  { pattern: /impress|alcance|reach|view|visualiz/i, targetMetric: "reach", priority: 1 }
];

export function buildCampaignRuntimeExperimentOutcomes(
  input: CampaignRuntimeOutcomeInput
): CompanyExperimentOutcome[] {
  const groups = groupRuntimeLogs(input.workspace.company.slug, input.workspace.socialExecutionLogs);

  return Array.from(groups.values())
    .map(buildOutcomeFromGroup)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function groupRuntimeLogs(companySlug: string, logs: SocialExecutionLog[]) {
  const groups = new Map<string, RuntimeOutcomeGroup>();

  for (const log of logs) {
    if (log.companySlug !== companySlug || (!log.sourceExperimentId && !log.sourceCampaignBriefId)) {
      continue;
    }

    const experimentId = log.sourceExperimentId ?? `campaign-brief-${log.sourceCampaignBriefId}`;
    const channel = normalizeRuntimeChannel(log.platform);
    const key = `${companySlug}:${experimentId}:${channel}:${log.kind}`;
    const group = groups.get(key) ?? {
      id: `experiment-outcome-runtime-${slugify(companySlug)}-${slugify(experimentId)}-${slugify(channel)}-${log.kind}`,
      companySlug,
      experimentId,
      channel,
      kind: log.kind,
      sourceCampaignBriefId: log.sourceCampaignBriefId,
      sourceCampaignBriefVersion: log.sourceCampaignBriefVersion,
      logs: []
    };

    group.logs.push(log);
    groups.set(key, group);
  }

  return groups;
}

function buildOutcomeFromGroup(group: RuntimeOutcomeGroup): CompanyExperimentOutcome {
  const sortedLogs = [...group.logs].sort((left, right) => getLogTimestamp(right).localeCompare(getLogTimestamp(left)));
  const latestLog = sortedLogs[0];
  const completed = group.logs.filter((log) => log.status === "completed");
  const blockedOrFailed = group.logs.filter((log) => log.status === "blocked" || log.status === "failed");
  const parsedMetrics = group.logs.flatMap((log) => parsePerformanceMetrics(log.metrics));
  const primaryMetric = pickPrimaryMetric(parsedMetrics);
  const observedValue = primaryMetric
    ? sum(parsedMetrics.filter((metric) => metric.label === primaryMetric.label).map((metric) => metric.value))
    : completed.length > 0
      ? completed.length
      : undefined;
  const status = classifyRuntimeOutcome({
    completedCount: completed.length,
    issueCount: blockedOrFailed.length,
    hasPositivePerformanceSignal: Boolean(primaryMetric && observedValue && observedValue > 0)
  });
  const generatedAt = getLogTimestamp(latestLog);
  const observedWindow = "7d" as const;
  const statisticalSummary = computeLearningStatisticalSummary({
    wins: status === "won" ? 1 : 0,
    losses: status === "lost" || status === "inconclusive" ? 1 : 0,
    minimumSampleSize: 3
  });

  return {
    id: group.id,
    companySlug: group.companySlug,
    learningBoundary: "tenant_private",
    shareability: "restricted",
    version: 1,
    confidenceState: "emerging",
    validFrom: generatedAt,
    validUntil: computeLearningValidUntil({
      observedWindow,
      updatedAt: generatedAt,
      status
    }),
    validityScope: buildLearningValidityScope({
      channel: group.channel,
      targetMetric: primaryMetric?.label ?? "runtime_delivery",
      observedWindow,
      tenantOnly: true
    }),
    experimentId: group.experimentId,
    channel: group.channel,
    title: buildOutcomeTitle(group),
    hypothesis: buildOutcomeHypothesis(group),
    targetMetric: primaryMetric?.label ?? "runtime_delivery",
    observedValue,
    observedWindow,
    status,
    successCriteria:
      "Executar a acao aprovada sem bloqueio operacional e capturar sinal de performance suficiente para reuso.",
    winningVariant: resolveWinningVariant(group.logs, primaryMetric?.label),
    confidenceDelta: getConfidenceDelta(status),
    statisticalSummary,
    reuseRecommendation: buildReuseRecommendation(status, group.channel, primaryMetric?.label),
    failureNote: blockedOrFailed.length > 0 ? buildFailureNote(blockedOrFailed) : undefined,
    sourceCampaignBriefId: group.sourceCampaignBriefId,
    sourceCampaignBriefVersion: group.sourceCampaignBriefVersion,
    evidence: buildEvidence(group, parsedMetrics),
    generatedAt,
    updatedAt: generatedAt
  };
}

function classifyRuntimeOutcome(input: {
  completedCount: number;
  issueCount: number;
  hasPositivePerformanceSignal: boolean;
}): ExperimentOutcomeStatus {
  if (input.hasPositivePerformanceSignal && input.issueCount === 0) {
    return "won";
  }

  if (input.issueCount > 0 && input.completedCount === 0) {
    return "lost";
  }

  if (input.issueCount > 0 && input.completedCount > 0) {
    return "inconclusive";
  }

  if (input.completedCount > 0) {
    return "observing";
  }

  return "inconclusive";
}

function parsePerformanceMetrics(metrics: SocialExecutionMetric[]): ParsedMetric[] {
  return metrics.flatMap((metric) => {
    const descriptor = PERFORMANCE_METRICS.find((entry) => entry.pattern.test(metric.label));
    const value = parseMetricNumber(metric.value);

    if (!descriptor || value === undefined) {
      return [];
    }

    return [
      {
        label: descriptor.targetMetric,
        value,
        priority: descriptor.priority
      }
    ];
  });
}

function pickPrimaryMetric(metrics: ParsedMetric[]) {
  return [...metrics].sort((left, right) => right.priority - left.priority || right.value - left.value)[0];
}

function parseMetricNumber(value: string) {
  const lower = value.toLowerCase().trim();
  const multiplier = lower.includes("mi") ? 1_000_000 : lower.includes("mil") || lower.endsWith("k") ? 1_000 : 1;
  const numeric = lower
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(numeric);

  return Number.isFinite(parsed) ? parsed * multiplier : undefined;
}

function resolveWinningVariant(logs: SocialExecutionLog[], targetMetric?: string) {
  if (!targetMetric) {
    return logs.find((log) => log.status === "completed" && log.variantLabel)?.variantLabel;
  }

  const variants = new Map<string, number>();

  for (const log of logs) {
    if (!log.variantLabel) {
      continue;
    }

    const total = sum(
      parsePerformanceMetrics(log.metrics)
        .filter((metric) => metric.label === targetMetric)
        .map((metric) => metric.value)
    );
    variants.set(log.variantLabel, (variants.get(log.variantLabel) ?? 0) + total);
  }

  return [...variants.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
}

function buildEvidence(group: RuntimeOutcomeGroup, metrics: ParsedMetric[]) {
  const metricEvidence = metrics
    .slice(0, 4)
    .map((metric) => `${metric.label}: ${formatNumber(metric.value)}`);
  const logEvidence = group.logs
    .slice(0, 5)
    .map((log) => `${log.platform}/${log.kind}/${log.status}: ${log.summary}`);
  const sourceEvidence = group.sourceCampaignBriefId
    ? [`brief=${group.sourceCampaignBriefId} v${group.sourceCampaignBriefVersion ?? 1}`]
    : [];

  return dedupeStrings([...sourceEvidence, ...metricEvidence, ...logEvidence]).slice(0, 8);
}

function buildOutcomeTitle(group: RuntimeOutcomeGroup) {
  const source = group.sourceCampaignBriefId ? "Briefing de campanha" : "Experimento de runtime";
  return `${source} em ${getReadableChannelLabel(group.channel)}`;
}

function buildOutcomeHypothesis(group: RuntimeOutcomeGroup) {
  if (group.sourceCampaignBriefId) {
    return `A tese materializada no briefing ${group.sourceCampaignBriefId} pode gerar execucao observavel em ${getReadableChannelLabel(group.channel)}.`;
  }

  return `A acao ${group.experimentId} pode ser executada com seguranca e gerar sinal de performance em ${getReadableChannelLabel(group.channel)}.`;
}

function buildReuseRecommendation(status: ExperimentOutcomeStatus, channel: string, targetMetric?: string) {
  if (status === "won") {
    return `Reaplicar o padrao em ${getReadableChannelLabel(channel)} e promover nova iteracao monitorando ${targetMetric ?? "runtime_delivery"}.`;
  }

  if (status === "lost") {
    return `Nao escalar ${getReadableChannelLabel(channel)} antes de corrigir bloqueios de runtime e revisar conector/aprovacao.`;
  }

  if (status === "inconclusive") {
    return `Manter em hold ate haver sinal suficiente em ${getReadableChannelLabel(channel)} ou nova execucao sem falha.`;
  }

  return `Continuar observando ${getReadableChannelLabel(channel)} antes de promover scale/hold/fix/pause.`;
}

function buildFailureNote(logs: SocialExecutionLog[]) {
  const latest = [...logs].sort((left, right) => getLogTimestamp(right).localeCompare(getLogTimestamp(left)))[0];
  return `${logs.length} execucoes com bloqueio/falha. Ultimo sinal: ${latest.detail}`;
}

function getConfidenceDelta(status: ExperimentOutcomeStatus) {
  if (status === "won") {
    return 0.08;
  }

  if (status === "lost") {
    return -0.12;
  }

  if (status === "inconclusive") {
    return -0.04;
  }

  return 0.02;
}

function normalizeRuntimeChannel(platform: SocialPlatformId) {
  if (platform === "facebook" || platform === "instagram") {
    return "meta";
  }

  if (platform === "google-business") {
    return "business-profile";
  }

  return platform;
}

function getReadableChannelLabel(channel: string) {
  const labels: Record<string, string> = {
    meta: "Meta",
    "google-ads": "Google Ads",
    "business-profile": "Google Business Profile",
    linkedin: "LinkedIn",
    tiktok: "TikTok",
    youtube: "YouTube"
  };

  return labels[channel] ?? channel;
}

function getLogTimestamp(log: SocialExecutionLog) {
  return log.finishedAt ?? log.startedAt;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "runtime";
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2
  }).format(value);
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
