import type {
  CreativeBriefInput,
  CreativeQaResult
} from "@/core/creative/creative-types";

export function scoreCreativeBrief(input: CreativeBriefInput): CreativeQaResult {
  const proofScore = Math.min(100, 54 + input.proof.length * 12);
  const guardrailPenalty = Math.min(24, input.guardrails.length * 4);
  const clarity = scoreText(input.promise, 78);
  const hookStrength = scoreText(input.promise, 72);
  const ctaStrength = scoreText(input.callToAction, 76);
  const claimRisk = Math.max(8, 45 - input.proof.length * 7 + guardrailPenalty);
  const conversionPotential = Math.round((clarity + hookStrength + ctaStrength + proofScore - claimRisk) / 3.2);
  const scores = {
    clarity,
    hookStrength,
    audienceFit: scoreText(input.audience, 74),
    differentiation: proofScore,
    visualHierarchy: input.format.toLowerCase().includes("story") ? 82 : 76,
    ctaStrength,
    claimRisk,
    conversionPotential: clampScore(conversionPotential)
  };
  const score = Math.round(
    (scores.clarity +
      scores.hookStrength +
      scores.audienceFit +
      scores.differentiation +
      scores.visualHierarchy +
      scores.ctaStrength +
      scores.conversionPotential -
      scores.claimRisk * 0.45) /
      6.55
  );

  return {
    id: `creative-qa-${slugify(input.companyName)}-${slugify(input.platform)}`,
    score: clampScore(score),
    scores,
    verdict: scores.claimRisk >= 70 ? "blocked" : score >= 78 ? "ready" : "needs_revision",
    recommendations: buildRecommendations(input, scores),
    risks: buildRisks(input, scores.claimRisk)
  };
}

function scoreText(value: string, base: number) {
  const length = value.trim().length;
  const lengthBonus = length >= 18 && length <= 120 ? 12 : length > 0 ? 4 : -20;
  return clampScore(base + lengthBonus);
}

function buildRecommendations(
  input: CreativeBriefInput,
  scores: CreativeQaResult["scores"]
) {
  const recommendations = [];

  if (scores.clarity < 80) {
    recommendations.push("Tighten the promise into one concrete outcome.");
  }

  if (input.proof.length < 2) {
    recommendations.push("Add at least two proof cues before paid distribution.");
  }

  if (scores.ctaStrength < 82) {
    recommendations.push("Make the CTA more direct and tied to the next funnel step.");
  }

  if (scores.claimRisk > 55) {
    recommendations.push("Route the creative through compliance review before launch.");
  }

  return recommendations.length > 0
    ? recommendations
    : ["Creative is ready for approval-gated production and A/B testing."];
}

function buildRisks(input: CreativeBriefInput, claimRisk: number) {
  const risks = input.guardrails.map((guardrail) => `Guardrail: ${guardrail}`);

  if (claimRisk > 55) {
    risks.push("Potential claim risk requires evidence or softer phrasing.");
  }

  if (input.proof.length === 0) {
    risks.push("No proof supplied; avoid performance claims.");
  }

  return risks;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "qa";
}
