import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyExperimentOutcomeEvidence,
  decayLearningConfidence,
  isLearningReusableForContext,
  shouldPromoteCorrelationToRecommendation
} from "@/core/learning/learning-rigor";
import { computeLearningStatisticalSummary } from "@/core/learning/versioned-learning";
import type { CompanyExperimentOutcome, CompanyLearningPlaybook } from "@/lib/domain";

test("weak outcome evidence stays an observed correlation", () => {
  const outcome = buildOutcome({
    status: "won",
    statisticalSummary: computeLearningStatisticalSummary({
      wins: 1,
      losses: 0,
      minimumSampleSize: 5
    })
  });

  assert.equal(classifyExperimentOutcomeEvidence(outcome), "observed_correlation");
});

test("confidence decays when learning is stale", () => {
  const decayed = decayLearningConfidence({
    confidence: 0.9,
    lastValidatedAt: "2026-01-01T00:00:00.000Z",
    referenceTime: "2026-05-01T00:00:00.000Z",
    halfLifeDays: 45
  });

  assert.ok(decayed < 0.62);
});

test("learning reuse requires compatible channel and metric", () => {
  const playbook = buildPlaybook();

  assert.equal(
    isLearningReusableForContext(playbook, {
      channel: "meta",
      targetMetric: "CPA",
      observedWindow: "7d",
      tenantOnly: true
    }),
    true
  );
  assert.equal(
    isLearningReusableForContext(playbook, {
      channel: "linkedin",
      targetMetric: "CPA",
      observedWindow: "7d",
      tenantOnly: true
    }),
    false
  );
});

test("false positive guard blocks promotion to recommendation", () => {
  assert.equal(
    shouldPromoteCorrelationToRecommendation({
      sampleSize: 8,
      wins: 7,
      losses: 1,
      minimumObservationWindowDays: 7,
      observedDays: 14,
      falsePositiveGuard: true
    }),
    false
  );
});

function buildOutcome(overrides: Partial<CompanyExperimentOutcome>): CompanyExperimentOutcome {
  return {
    id: "outcome-1",
    companySlug: "acme",
    learningBoundary: "tenant_private",
    shareability: "restricted",
    version: 1,
    confidenceState: "emerging",
    validFrom: "2026-05-01T00:00:00.000Z",
    validityScope: {
      channel: "meta",
      targetMetric: "CPA",
      observedWindow: "7d",
      tenantOnly: true
    },
    experimentId: "experiment-1",
    channel: "meta",
    title: "Meta proof angle",
    hypothesis: "Proof angle improves CPA.",
    targetMetric: "CPA",
    observedWindow: "7d",
    status: "won",
    successCriteria: "CPA improves without compliance risk.",
    confidenceDelta: 0.05,
    evidence: ["CPA improved"],
    generatedAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides
  };
}

function buildPlaybook(): CompanyLearningPlaybook {
  return {
    id: "playbook-1",
    companySlug: "acme",
    learningBoundary: "tenant_private",
    shareability: "anonymizable",
    version: 2,
    confidenceState: "validated",
    validFrom: "2026-05-01T00:00:00.000Z",
    validityScope: {
      channel: "meta",
      targetMetric: "CPA",
      observedWindow: "7d",
      tenantOnly: true
    },
    failureMemory: {
      count: 0
    },
    channel: "meta",
    title: "Meta proof playbook",
    summary: "Proof-first creative reduced CPA.",
    status: "active",
    confidence: 0.84,
    statisticalSummary: computeLearningStatisticalSummary({
      wins: 5,
      losses: 1,
      minimumSampleSize: 4
    }),
    winCount: 5,
    lossCount: 1,
    recommendedAction: "Reuse proof-first angle.",
    reuseGuidance: ["Use only on Meta prospecting."],
    evidence: ["CPA down", "CTR up"],
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
    lastValidatedAt: "2026-05-02T00:00:00.000Z"
  };
}
