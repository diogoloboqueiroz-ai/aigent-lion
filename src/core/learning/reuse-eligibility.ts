import type {
  CompanyLearningPlaybook,
  CrossTenantLearningPlaybook
} from "@/lib/domain";
import { computeLearningStatisticalSummary } from "@/core/learning/versioned-learning";

type ReusablePlaybook = CompanyLearningPlaybook | CrossTenantLearningPlaybook;

export function scoreLearningReuseReliability(playbook: ReusablePlaybook) {
  const now = new Date().toISOString();
  const notExpired = !playbook.validUntil || playbook.validUntil >= now;
  const confidenceState = resolveEffectiveConfidenceState(playbook);
  const confidenceComponent = Math.round(playbook.confidence * 40);
  const validationComponent =
    confidenceState === "validated"
      ? 24
      : confidenceState === "emerging"
        ? 12
        : confidenceState === "decaying"
          ? -8
          : -20;
  const outcomeComponent = Math.min(18, Math.max(-18, playbook.winCount * 4 - playbook.lossCount * 6));
  const failurePenalty = Math.min(20, (playbook.failureMemory?.count ?? 0) * 5);
  const statisticalSummary =
    playbook.statisticalSummary ??
    computeLearningStatisticalSummary({
      wins: playbook.winCount,
      losses: playbook.lossCount,
      minimumSampleSize: "sourceTenantCount" in playbook ? Math.max(4, playbook.sourceTenantCount * 2) : 4
    });
  const evidenceComponent = mapEvidenceStrengthToScore(statisticalSummary.evidenceStrength);
  const crossTenantSupport =
    "sourceTenantCount" in playbook
      ? Math.min(12, playbook.sourceTenantCount * 4)
      : playbook.validityScope.tenantOnly
        ? 4
        : 8;
  const statusComponent =
    playbook.status === "active" ? 14 : playbook.status === "candidate" ? 4 : -24;
  const expiryPenalty = notExpired ? 0 : 18;

  return Math.max(
    0,
    Math.min(
      100,
      confidenceComponent +
        validationComponent +
        outcomeComponent +
        evidenceComponent +
        crossTenantSupport +
        statusComponent -
        failurePenalty -
        expiryPenalty
    )
  );
}

export function isLearningPatternReusable(playbook: ReusablePlaybook) {
  const confidenceState = resolveEffectiveConfidenceState(playbook);

  if (playbook.status !== "active") {
    return false;
  }

  if (confidenceState === "decaying" || confidenceState === "retired") {
    return false;
  }

  if (playbook.validUntil && playbook.validUntil < new Date().toISOString()) {
    return false;
  }

  if ("sourceTenantCount" in playbook && playbook.sourceTenantCount < 2) {
    return false;
  }

  const statisticalSummary =
    playbook.statisticalSummary ??
    computeLearningStatisticalSummary({
      wins: playbook.winCount,
      losses: playbook.lossCount,
      minimumSampleSize: "sourceTenantCount" in playbook ? Math.max(4, playbook.sourceTenantCount * 2) : 4
    });
  if (statisticalSummary.evidenceStrength === "weak") {
    return false;
  }

  return scoreLearningReuseReliability(playbook) >= 64;
}

function resolveEffectiveConfidenceState(playbook: ReusablePlaybook) {
  if (playbook.confidenceState) {
    return playbook.confidenceState;
  }

  if (playbook.winCount >= 2 && playbook.lossCount <= 1 && playbook.confidence >= 0.8) {
    return "validated";
  }

  if (playbook.lossCount > playbook.winCount) {
    return "decaying";
  }

  return "emerging";
}

function mapEvidenceStrengthToScore(strength: ReturnType<typeof computeLearningStatisticalSummary>["evidenceStrength"]) {
  switch (strength) {
    case "strong":
      return 12;
    case "moderate":
      return 8;
    case "directional":
      return 2;
    default:
      return -10;
  }
}
