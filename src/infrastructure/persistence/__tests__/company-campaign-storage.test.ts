import assert from "node:assert/strict";
import test from "node:test";
import {
  getLatestStoredCampaignIntelligenceBrief,
  listStoredCampaignIntelligenceBriefs,
  upsertStoredCampaignIntelligenceBriefInCollection
} from "@/infrastructure/persistence/company-campaign-storage";
import type { CampaignIntelligenceBriefRecord } from "@/core/marketing/campaign-intelligence";

test("campaign brief storage scopes and sorts materialized briefs by tenant", () => {
  const briefs = [
    buildBrief({ id: "brief-old", companySlug: "tenant-a", version: 1, savedAt: "2026-05-01T10:00:00.000Z" }),
    buildBrief({ id: "brief-other", companySlug: "tenant-b", version: 1, savedAt: "2026-05-03T10:00:00.000Z" }),
    buildBrief({ id: "brief-new", companySlug: "tenant-a", version: 2, savedAt: "2026-05-03T10:00:00.000Z" })
  ];

  const scoped = listStoredCampaignIntelligenceBriefs(briefs, "tenant-a");

  assert.deepEqual(scoped.map((brief) => brief.id), ["brief-new", "brief-old"]);
  assert.equal(getLatestStoredCampaignIntelligenceBrief(briefs, "tenant-a")?.id, "brief-new");
});

test("campaign brief storage upserts by tenant and generated brief id", () => {
  const original = buildBrief({
    id: "brief-1",
    companySlug: "tenant-a",
    version: 1,
    savedAt: "2026-05-01T10:00:00.000Z"
  });
  const updated = buildBrief({
    id: "brief-1",
    companySlug: "tenant-a",
    version: 2,
    savedAt: "2026-05-02T10:00:00.000Z"
  });

  const next = upsertStoredCampaignIntelligenceBriefInCollection([original], updated);

  assert.equal(next.length, 1);
  assert.equal(next[0].version, 2);
});

function buildBrief(input: {
  id: string;
  companySlug: string;
  version: number;
  savedAt: string;
}): CampaignIntelligenceBriefRecord {
  return {
    id: input.id,
    companySlug: input.companySlug,
    companyName: "Tenant",
    generatedAt: input.savedAt,
    objective: "Crescer",
    weeklyThesis: "Tese",
    primaryBet: "Aposta",
    dominantConstraint: "acquisition",
    readinessScore: 70,
    executiveSummary: "Resumo",
    funnel: [],
    channels: [],
    copyAngles: [],
    visualPrompts: [],
    analyticsPlan: {
      targetMetric: "qualified_leads",
      observationWindowDays: 14,
      baselineSummary: "baseline",
      requiredEvents: [],
      attributionGaps: [],
      optimizationQuestions: [],
      reportingCadence: "weekly"
    },
    experiments: [],
    risks: [],
    nextBestActions: [],
    provenance: {
      sourceScorecardIds: [],
      sourceExperimentIds: [],
      sourcePlaybookIds: [],
      sourceOutcomeIds: []
    },
    version: input.version,
    status: "materialized",
    savedAt: input.savedAt,
    savedBy: "operator@example.com",
    source: "api"
  };
}
