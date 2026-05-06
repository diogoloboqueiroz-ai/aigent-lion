import assert from "node:assert/strict";
import test from "node:test";
import { computeLearningStatisticalSummary } from "@/core/learning/versioned-learning";

test("learning statistics keep low-sample wins directional instead of overconfident", () => {
  const summary = computeLearningStatisticalSummary({
    wins: 1,
    losses: 0,
    minimumSampleSize: 3
  });

  assert.equal(summary.sampleSize, 1);
  assert.equal(summary.evidenceStrength, "weak");
  assert.ok(summary.posteriorMean < 0.7);
});

test("learning statistics promote repeated wins with credible lower bound", () => {
  const summary = computeLearningStatisticalSummary({
    wins: 8,
    losses: 1,
    minimumSampleSize: 4
  });

  assert.equal(summary.evidenceStrength, "strong");
  assert.ok(summary.credibleInterval.lower >= 0.62);
  assert.ok(summary.posteriorMean > 0.75);
});
