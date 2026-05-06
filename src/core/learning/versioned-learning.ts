import type {
  CompanyExperimentOutcome,
  CompanyLearningPlaybook,
  CrossTenantLearningPlaybook,
  ExperimentOutcomeStatus,
  LearningEvidenceStrength,
  LearningConfidenceState,
  LearningFailureMemory,
  LearningValidityScope,
  LearningPlaybookStatus
} from "@/lib/domain";

type VersionedLearningLike = Pick<
  CompanyLearningPlaybook | CrossTenantLearningPlaybook | CompanyExperimentOutcome,
  "version" | "validUntil" | "updatedAt"
>;

export function buildLearningValidityScope(input: {
  channel: string;
  targetMetric: string;
  observedWindow: "7d" | "28d";
  tenantOnly: boolean;
}): LearningValidityScope {
  return {
    channel: input.channel,
    targetMetric: input.targetMetric,
    observedWindow: input.observedWindow,
    tenantOnly: input.tenantOnly
  };
}

export function computeNextLearningVersion(input: {
  previous?: VersionedLearningLike;
  previousFingerprint?: string;
  nextFingerprint: string;
}) {
  if (!input.previous) {
    return 1;
  }

  if (input.previousFingerprint === input.nextFingerprint) {
    return input.previous.version;
  }

  return input.previous.version + 1;
}

export function buildOutcomeFingerprint(outcome: Pick<
  CompanyExperimentOutcome,
  | "status"
  | "winningVariant"
  | "observedValue"
  | "confidenceDelta"
  | "reuseRecommendation"
  | "failureNote"
  | "validityScope"
  | "statisticalSummary"
>) {
  return JSON.stringify({
    status: outcome.status,
    winningVariant: outcome.winningVariant ?? null,
    observedValue: outcome.observedValue ?? null,
    confidenceDelta: Number(outcome.confidenceDelta.toFixed(4)),
    reuseRecommendation: outcome.reuseRecommendation ?? "",
    failureNote: outcome.failureNote ?? "",
    validityScope: outcome.validityScope,
    statisticalSummary: outcome.statisticalSummary ?? null
  });
}

export function buildPlaybookFingerprint(playbook: Pick<
  CompanyLearningPlaybook | CrossTenantLearningPlaybook,
  | "status"
  | "confidence"
  | "winCount"
  | "lossCount"
  | "recommendedAction"
  | "reuseGuidance"
  | "validityScope"
  | "failureMemory"
  | "statisticalSummary"
>) {
  return JSON.stringify({
    status: playbook.status,
    confidence: Number(playbook.confidence.toFixed(4)),
    winCount: playbook.winCount,
    lossCount: playbook.lossCount,
    recommendedAction: playbook.recommendedAction,
    reuseGuidance: playbook.reuseGuidance,
    validityScope: playbook.validityScope,
    failureMemory: playbook.failureMemory,
    statisticalSummary: playbook.statisticalSummary ?? null
  });
}

export function computeLearningStatisticalSummary(input: {
  wins: number;
  losses: number;
  minimumSampleSize?: number;
  priorWins?: number;
  priorLosses?: number;
}) {
  const wins = Math.max(0, Math.round(input.wins));
  const losses = Math.max(0, Math.round(input.losses));
  const sampleSize = wins + losses;
  const minimumSampleSize = input.minimumSampleSize ?? 4;
  const alpha = Math.max(0.5, input.priorWins ?? 1) + wins;
  const beta = Math.max(0.5, input.priorLosses ?? 1) + losses;
  const posteriorMean = alpha / (alpha + beta);
  const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
  const standardDeviation = Math.sqrt(Math.max(0, variance));
  const credibleInterval = {
    lower: clampStat(posteriorMean - 1.28 * standardDeviation),
    upper: clampStat(posteriorMean + 1.28 * standardDeviation)
  };
  const winRate = sampleSize > 0 ? wins / sampleSize : 0;
  const lossRate = sampleSize > 0 ? losses / sampleSize : 0;

  return {
    sampleSize,
    wins,
    losses,
    winRate: roundStat(winRate),
    lossRate: roundStat(lossRate),
    posteriorMean: roundStat(posteriorMean),
    credibleInterval: {
      lower: roundStat(credibleInterval.lower),
      upper: roundStat(credibleInterval.upper)
    },
    evidenceStrength: inferEvidenceStrength({
      sampleSize,
      minimumSampleSize,
      posteriorMean,
      lowerBound: credibleInterval.lower,
      losses
    }),
    minimumSampleSize
  };
}

export function inferLearningConfidenceState(input: {
  confidence: number;
  lossCount: number;
  winCount: number;
  status: ExperimentOutcomeStatus | LearningPlaybookStatus;
  validUntil?: string;
  referenceTime?: string;
}) {
  const referenceTime = input.referenceTime ?? new Date().toISOString();

  if (input.status === "retired" || input.status === "lost") {
    return "retired" as LearningConfidenceState;
  }

  if (input.validUntil && input.validUntil < referenceTime) {
    return "decaying" as LearningConfidenceState;
  }

  if (input.winCount >= 2 && input.lossCount === 0 && input.confidence >= 0.78) {
    return "validated" as LearningConfidenceState;
  }

  if (input.lossCount > input.winCount && input.lossCount > 0) {
    return "decaying" as LearningConfidenceState;
  }

  return "emerging" as LearningConfidenceState;
}

function inferEvidenceStrength(input: {
  sampleSize: number;
  minimumSampleSize: number;
  posteriorMean: number;
  lowerBound: number;
  losses: number;
}): LearningEvidenceStrength {
  if (input.sampleSize < input.minimumSampleSize) {
    return input.sampleSize >= Math.max(2, input.minimumSampleSize - 1)
      ? "directional"
      : "weak";
  }

  if (input.lowerBound >= 0.62 && input.posteriorMean >= 0.72 && input.losses <= 1) {
    return "strong";
  }

  if (input.lowerBound >= 0.54 && input.posteriorMean >= 0.64) {
    return "moderate";
  }

  if (input.posteriorMean >= 0.55) {
    return "directional";
  }

  return "weak";
}

function roundStat(value: number) {
  return Number(value.toFixed(4));
}

function clampStat(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function computeLearningValidUntil(input: {
  observedWindow: "7d" | "28d";
  updatedAt: string;
  status: ExperimentOutcomeStatus | LearningPlaybookStatus;
}) {
  const baseDate = new Date(input.updatedAt);
  const multiplier =
    input.status === "won" || input.status === "active"
      ? input.observedWindow === "28d"
        ? 3
        : 4
      : input.status === "candidate" || input.status === "observing"
        ? 2
        : 1;
  const horizonDays = (input.observedWindow === "28d" ? 28 : 7) * multiplier;
  baseDate.setUTCDate(baseDate.getUTCDate() + horizonDays);
  return baseDate.toISOString();
}

export function buildFailureMemory(input: {
  previous?: LearningFailureMemory;
  latestStatus: ExperimentOutcomeStatus | LearningPlaybookStatus;
  latestFailureAt?: string;
  latestFailureReason?: string;
  lossCount: number;
}) {
  const previousCount = input.previous?.count ?? 0;
  const nextCount =
    input.latestStatus === "lost" ||
    input.latestStatus === "inconclusive" ||
    input.latestStatus === "retired"
      ? Math.max(previousCount + 1, input.lossCount)
      : Math.max(previousCount, input.lossCount);

  return {
    count: nextCount,
    lastFailureAt: input.latestFailureAt ?? input.previous?.lastFailureAt,
    lastFailureReason: input.latestFailureReason ?? input.previous?.lastFailureReason
  } satisfies LearningFailureMemory;
}

export function buildReuseGuidance(input: {
  recommendedAction: string;
  channel: string;
  confidenceState: LearningConfidenceState;
  tenantOnly: boolean;
}) {
  const scopeGuidance = input.tenantOnly
    ? `Reaplicar apenas no tenant atual e no canal ${input.channel}.`
    : `Reaplicar como padrao anonimizado para o canal ${input.channel}.`;
  const validationGuidance =
    input.confidenceState === "validated"
      ? "O padrao ja tem sinal suficiente para reuse supervisionado."
      : input.confidenceState === "decaying"
        ? "Revalidar antes de reaplicar porque o sinal esta perdendo forca."
        : "Tratar como tese em observacao, nao como verdade permanente.";

  return [input.recommendedAction, scopeGuidance, validationGuidance];
}
