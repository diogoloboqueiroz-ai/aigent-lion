import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmptyVaultPayload,
  normalizeVaultPayload
} from "@/infrastructure/persistence/company-vault-schema";
import type { CompanyExperimentOutcome } from "@/lib/domain";

test("company vault schema creates an empty payload with all expected collections", () => {
  const payload = createEmptyVaultPayload();

  assert.deepEqual(payload.companyProfiles, []);
  assert.deepEqual(payload.companyCreativeAssets, []);
  assert.deepEqual(payload.companyAutomationQueue, []);
  assert.equal(payload.desktopAgentProfile, null);
});

test("company vault schema normalizes learning outcomes for versioned reuse", () => {
  const legacyOutcome = {
    id: "outcome-1",
    companySlug: "acme",
    title: "Meta creative won",
    generatedAt: "2026-05-01T00:00:00.000Z",
    channel: "meta",
    targetMetric: "cpa",
    observedWindow: "7d",
    status: "won"
  } as CompanyExperimentOutcome;
  const normalized = normalizeVaultPayload({
    companyExperimentOutcomes: [legacyOutcome]
  }).payload.companyExperimentOutcomes[0];

  assert.equal(normalized?.version, 1);
  assert.equal(normalized?.learningBoundary, "tenant_private");
  assert.equal(normalized?.validityScope.channel, "meta");
  assert.equal(normalized?.validityScope.targetMetric, "cpa");
});
