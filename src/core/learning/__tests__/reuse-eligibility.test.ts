import assert from "node:assert/strict";
import test from "node:test";
import {
  isLearningPatternReusable,
  scoreLearningReuseReliability
} from "@/core/learning/reuse-eligibility";
import type { CrossTenantLearningPlaybook } from "@/lib/domain";

function buildPlaybook(
  overrides: Partial<CrossTenantLearningPlaybook> = {}
): CrossTenantLearningPlaybook {
  return {
    id: "shared-playbook-meta",
    learningBoundary: "cross_tenant_safe",
    shareability: "shared",
    version: 3,
    confidenceState: "validated",
    validFrom: "2026-04-01T10:00:00.000Z",
    validUntil: "2026-05-30T10:00:00.000Z",
    validityScope: {
      channel: "meta",
      targetMetric: "ctr",
      observedWindow: "7d",
      tenantOnly: false
    },
    failureMemory: {
      count: 0
    },
    channel: "meta",
    title: "Playbook validado",
    summary: "Prova social curta antes da oferta melhora CTR.",
    status: "active",
    confidence: 0.86,
    sourceTenantCount: 3,
    sourcePlaybookCount: 4,
    winCount: 5,
    lossCount: 1,
    recommendedAction: "Escalar gradualmente com prova social curta.",
    reuseGuidance: [],
    evidence: [],
    createdAt: "2026-04-01T10:00:00.000Z",
    updatedAt: "2026-04-20T10:00:00.000Z",
    ...overrides
  };
}

test("reuse eligibility accepts validated shared playbooks", () => {
  const playbook = buildPlaybook();

  assert.equal(isLearningPatternReusable(playbook), true);
  assert.ok(scoreLearningReuseReliability(playbook) >= 64);
});

test("reuse eligibility rejects decaying or weak shared playbooks", () => {
  const playbook = buildPlaybook({
    confidenceState: "decaying",
    lossCount: 4,
    failureMemory: {
      count: 3
    },
    sourceTenantCount: 1
  });

  assert.equal(isLearningPatternReusable(playbook), false);
  assert.ok(scoreLearningReuseReliability(playbook) < 64);
});
