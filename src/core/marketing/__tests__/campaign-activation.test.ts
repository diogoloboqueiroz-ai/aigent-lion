import assert from "node:assert/strict";
import test from "node:test";
import { buildCampaignActivationPlan } from "@/core/marketing/campaign-activation";
import type { CampaignIntelligenceBriefRecord } from "@/core/marketing/campaign-intelligence";
import type { CompanyWorkspace } from "@/lib/domain";

test("campaign activation prepares approval-gated social and ad drafts", () => {
  const plan = buildCampaignActivationPlan({
    workspace: buildWorkspace(),
    brief: buildBrief(),
    actor: "operator@example.com",
    createdAt: "2026-05-03T12:00:00.000Z"
  });

  assert.equal(plan.companySlug, "tenant-a");
  assert.equal(plan.scheduledPosts.length, 1);
  assert.equal(plan.scheduledPosts[0].status, "pending_approval");
  assert.equal(plan.scheduledPosts[0].requiresApproval, true);
  assert.equal(plan.scheduledPosts[0].sourceCampaignBriefId, "brief-1");
  assert.equal(plan.scheduledPosts[0].sourceCampaignBriefVersion, 1);
  assert.equal(plan.socialAdDrafts.length, 2);
  assert.equal(plan.socialAdDrafts[0].status, "pending_approval");
  assert.equal(plan.socialAdDrafts[0].sourceCampaignBriefId, "brief-1");
  assert.ok(plan.warnings.some((warning) => warning.includes("Claims proibidos")));
});

function buildWorkspace(): CompanyWorkspace {
  return {
    company: {
      slug: "tenant-a",
      name: "Tenant A"
    },
    strategyPlan: {
      monthlyBudget: "R$ 12.000"
    },
    agentProfile: {
      idealCustomerProfile: "Fundadores B2B",
      forbiddenClaims: ["renda garantida"]
    },
    keywordStrategy: {
      primaryKeywords: ["growth os", "marketing autonomo"]
    },
    siteOpsProfile: {
      primarySiteUrl: "https://example.com",
      landingPageUrls: ["https://example.com/demo"]
    },
    crmProfile: {
      requireConsentForAds: true
    }
  } as unknown as CompanyWorkspace;
}

function buildBrief(): CampaignIntelligenceBriefRecord {
  return {
    id: "brief-1",
    companySlug: "tenant-a",
    companyName: "Tenant A",
    generatedAt: "2026-05-03T11:00:00.000Z",
    objective: "Gerar pipeline",
    weeklyThesis: "Escalar com seguranca",
    primaryBet: "Meta como canal principal",
    dominantConstraint: "acquisition",
    readinessScore: 74,
    executiveSummary: "Resumo",
    funnel: [],
    channels: [],
    copyAngles: [
      {
        id: "angle-1",
        title: "Prova operacional",
        funnelStage: "awareness",
        audience: "Fundadores B2B",
        promise: "Crescimento com governanca",
        proof: ["2 campanhas vencedoras"],
        callToAction: "Solicitar diagnostico",
        guardrails: ["Nao prometer renda garantida"],
        source: "agent_profile"
      }
    ],
    visualPrompts: [
      {
        id: "visual-1",
        assetType: "image",
        platform: "instagram",
        format: "4:5",
        prompt: "Imagem premium",
        negativePrompt: "Sem claims irreais",
        qaChecklist: ["Mobile readable"],
        riskNotes: ["Approval required"],
        sourceAngleId: "angle-1"
      },
      {
        id: "visual-2",
        assetType: "carousel",
        platform: "meta",
        format: "4:5 carousel",
        prompt: "Carrossel premium",
        negativePrompt: "Sem claims irreais",
        qaChecklist: ["Mobile readable"],
        riskNotes: ["Approval required"],
        sourceAngleId: "angle-1"
      }
    ],
    analyticsPlan: {
      targetMetric: "qualified_leads",
      observationWindowDays: 14,
      baselineSummary: "baseline",
      requiredEvents: [],
      attributionGaps: [],
      optimizationQuestions: [],
      reportingCadence: "weekly"
    },
    experiments: [
      {
        id: "experiment-1",
        title: "Angle de prova",
        hypothesis: "Prova aumenta conversao",
        channel: "meta",
        targetMetric: "qualified_leads",
        variants: ["prova", "promessa"],
        successCriteria: "15% lift",
        observationWindowDays: 14,
        confidence: 0.55,
        evidence: []
      }
    ],
    risks: ["Tracking precisa ser validado"],
    nextBestActions: [],
    provenance: {
      sourceScorecardIds: [],
      sourceExperimentIds: [],
      sourcePlaybookIds: [],
      sourceOutcomeIds: []
    },
    version: 1,
    status: "materialized",
    savedAt: "2026-05-03T11:30:00.000Z",
    savedBy: "operator@example.com",
    source: "api"
  };
}
