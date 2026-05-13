import type {
  CompanyExperimentOutcome,
  CompanyLearningPlaybook,
  CrossTenantLearningPlaybook,
  LearningEvidenceStrength
} from "@/lib/domain";
import { computeLearningStatisticalSummary } from "@/core/learning/versioned-learning";

export type LearningClassification =
  | "observed_correlation"
  | "tenant_recommendation"
  | "validated_playbook"
  | "reusable_playbook"
  | "risk_warning";

export type LearningReuseContext = {
  channel: string;
  targetMetric?: string;
  observedWindow?: "7d" | "28d";
  tenantOnly?: boolean;
};

type ReusableLearning = CompanyLearningPlaybook | CrossTenantLearningPlaybook;

export function classifyExperimentOutcomeEvidence(
  outcome: CompanyExperimentOutcome
): LearningClassification {
  if (outcome.status === "lost" || outcome.status === "inconclusive") {
    return "risk_warning";
  }

  const evidenceStrength = resolveOutcomeEvidenceStrength(outcome);

  if (evidenceStrength === "weak") {
    return "observed_correlation";
  }

  if (outcome.learningBoundary === "cross_tenant_safe" && evidenceStrength !== "directional") {
    return "reusable_playbook";
  }

  if (evidenceStrength === "strong" || evidenceStrength === "moderate") {
    return "validated_playbook";
  }

  return "tenant_recommendation";
}

export function decayLearningConfidence(input: {
  confidence: number;
  lastValidatedAt?: string;
  referenceTime?: string;
  halfLifeDays?: number;
}) {
  const referenceMs = Date.parse(input.referenceTime ?? new Date().toISOString());
  const lastValidatedMs = Date.parse(input.lastValidatedAt ?? new Date(0).toISOString());

  if (!Number.isFinite(referenceMs) || !Number.isFinite(lastValidatedMs) || lastValidatedMs >= referenceMs) {
    return clampConfidence(input.confidence);
  }

  const ageDays = (referenceMs - lastValidatedMs) / 86_400_000;
  const halfLife = input.halfLifeDays ?? 45;
  const decayFactor = Math.pow(0.5, ageDays / halfLife);
  const floor = 0.28;

  return clampConfidence(floor + (input.confidence - floor) * decayFactor);
}

export function isLearningReusableForContext(
  playbook: ReusableLearning,
  context: LearningReuseContext
) {
  if (!isChannelCompatible(playbook.validityScope.channel, context.channel)) {
    return false;
  }

  if (context.targetMetric && !isMetricCompatible(playbook.validityScope.targetMetric, context.targetMetric)) {
    return false;
  }

  if (context.observedWindow && playbook.validityScope.observedWindow !== context.observedWindow) {
    return false;
  }

  if (context.tenantOnly === false && playbook.validityScope.tenantOnly) {
    return false;
  }

  const statisticalSummary =
    playbook.statisticalSummary ??
    computeLearningStatisticalSummary({
      wins: playbook.winCount,
      losses: playbook.lossCount,
      minimumSampleSize: "sourceTenantCount" in playbook ? Math.max(4, playbook.sourceTenantCount * 2) : 4
    });
  const decayedConfidence = decayLearningConfidence({
    confidence: playbook.confidence,
    lastValidatedAt: playbook.lastValidatedAt ?? playbook.updatedAt
  });

  return (
    playbook.status === "active" &&
    decayedConfidence >= 0.64 &&
    statisticalSummary.evidenceStrength !== "weak" &&
    playbook.failureMemory.count <= Math.max(1, playbook.winCount)
  );
}

export function shouldPromoteCorrelationToRecommendation(input: {
  sampleSize: number;
  wins: number;
  losses: number;
  minimumObservationWindowDays: number;
  observedDays: number;
  falsePositiveGuard?: boolean;
}) {
  if (input.falsePositiveGuard) {
    return false;
  }

  if (input.observedDays < input.minimumObservationWindowDays) {
    return false;
  }

  const summary = computeLearningStatisticalSummary({
    wins: input.wins,
    losses: input.losses,
    minimumSampleSize: input.sampleSize
  });

  return (
    summary.evidenceStrength !== "weak" &&
    summary.posteriorMean >= 0.62 &&
    summary.credibleInterval.lower >= 0.42
  );
}

function resolveOutcomeEvidenceStrength(outcome: CompanyExperimentOutcome): LearningEvidenceStrength {
  if (outcome.statisticalSummary) {
    return outcome.statisticalSummary.evidenceStrength;
  }

  return computeLearningStatisticalSummary({
    wins: outcome.status === "won" ? 1 : 0,
    losses: outcome.status === "lost" || outcome.status === "inconclusive" ? 1 : 0,
    minimumSampleSize: outcome.observedWindow === "28d" ? 2 : 3
  }).evidenceStrength;
}

function isChannelCompatible(left: string, right: string) {
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);

  return normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft);
}

function isMetricCompatible(left: string, right: string) {
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  const families = [
    ["cpa", "cac", "efficiency"],
    ["ctr", "clicks", "engagement"],
    ["revenue", "ltv", "sales"],
    ["conversion", "lead", "pipeline"]
  ];

  return families.some((family) => family.includes(normalizedLeft) && family.includes(normalizedRight));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function clampConfidence(value: number) {
  return Number(Math.max(0.05, Math.min(0.98, value)).toFixed(3));
}
