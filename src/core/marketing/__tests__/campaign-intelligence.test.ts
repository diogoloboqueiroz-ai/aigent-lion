import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCampaignIntelligenceBrief,
  materializeCampaignIntelligenceBrief
} from "@/core/marketing/campaign-intelligence";
import type {
  CompanyCmoStrategicDecision,
  CompanyOptimizationScorecard,
  CompanyWorkspace
} from "@/lib/domain";

test("campaign intelligence turns CMO strategy into a multichannel campaign brief", () => {
  const workspace = buildWorkspace();
  const cmoDecision = buildCmoDecision(workspace, [buildScorecard("score-meta", "Meta Ads", "meta", "scale", 84)]);
  const brief = buildCampaignIntelligenceBrief({
    workspace,
    cmoDecision,
    generatedAt: "2026-05-03T12:00:00.000Z"
  });

  assert.equal(brief.companySlug, "tenant-a");
  assert.equal(brief.dominantConstraint, "acquisition");
  assert.ok(brief.channels.some((channel) => channel.channel === "meta" && channel.recommendedDecision === "scale"));
  assert.ok(brief.copyAngles.length >= 2);
  assert.ok(brief.visualPrompts.some((prompt) => prompt.negativePrompt.includes("renda garantida")));
  assert.ok(brief.analyticsPlan.requiredEvents.includes("purchase"));
  assert.ok(brief.readinessScore > 30);
});

test("campaign intelligence flags tracking and connection risks before scale", () => {
  const workspace = {
    ...buildWorkspace(),
    connections: [],
    socialPlatforms: [],
    socialBindings: [],
    conversionEvents: [
      {
        id: "event-1",
        companySlug: "tenant-a",
        leadId: "lead-1",
        destination: "meta_capi",
        eventName: "purchase",
        leadStage: "qualified",
        status: "failed",
        summary: "Falha no dispatch",
        detail: "Meta CAPI sem token",
        createdAt: "2026-05-01T10:00:00.000Z",
        updatedAt: "2026-05-01T10:05:00.000Z"
      }
    ]
  } as unknown as CompanyWorkspace;
  const brief = buildCampaignIntelligenceBrief({
    workspace,
    cmoDecision: buildCmoDecision(workspace, []),
    generatedAt: "2026-05-03T12:00:00.000Z"
  });

  assert.ok(brief.risks.some((risk) => risk.includes("conversao")));
  assert.ok(brief.channels.some((channel) => channel.readiness === "needs_connection"));
  assert.ok(brief.nextBestActions[0].includes("Mitigar risco"));
});

test("campaign intelligence materialization creates versioned operational memory", () => {
  const brief = buildCampaignIntelligenceBrief({
    workspace: buildWorkspace(),
    cmoDecision: buildCmoDecision(buildWorkspace(), []),
    generatedAt: "2026-05-03T12:00:00.000Z"
  });
  const record = materializeCampaignIntelligenceBrief({
    brief,
    actor: "operator@example.com",
    previousVersion: 2,
    source: "workspace_page",
    savedAt: "2026-05-03T12:30:00.000Z"
  });

  assert.equal(record.version, 3);
  assert.equal(record.status, "materialized");
  assert.equal(record.savedBy, "operator@example.com");
  assert.equal(record.source, "workspace_page");
});

function buildWorkspace(): CompanyWorkspace {
  return {
    company: {
      id: "tenant-a",
      slug: "tenant-a",
      name: "Tenant A",
      sector: "SaaS",
      region: "BR",
      timezone: "America/Sao_Paulo",
      primaryGoal: "Crescer receita qualificada"
    },
    agentProfile: {
      companySlug: "tenant-a",
      companyName: "Tenant A",
      trainingStatus: "customized",
      updatedAt: "2026-05-03T10:00:00.000Z",
      businessSummary: "SaaS B2B",
      brandVoice: "premium, direto e consultivo",
      idealCustomerProfile: "Fundadores B2B com ticket medio alto",
      offerStrategy: "Diagnostico de crescimento com plano de execucao",
      differentiators: ["prova operacional", "governanca", "execucao multi-canal"],
      approvedChannels: ["meta", "google-ads"],
      contentPillars: ["crescimento previsivel", "operacao comercial", "dados confiaveis"],
      geoFocus: ["Brasil"],
      conversionEvents: ["lead", "qualified_lead", "purchase"],
      efficiencyRules: ["validar tracking antes de scale"],
      forbiddenClaims: ["renda garantida"],
      operatorNotes: "",
      systemPrompt: ""
    },
    strategyPlan: {
      primaryObjective: "Aumentar pipeline qualificado",
      priorityChannels: ["meta", "google-ads"]
    },
    dataOpsProfile: {
      reportingCadence: "weekly"
    },
    socialProfile: {
      primaryObjective: "Gerar demanda",
      priorityPlatforms: ["instagram", "linkedin"],
      contentPillars: ["crescimento previsivel"]
    },
    connections: [
      {
        platform: "meta",
        status: "connected",
        nextAction: "Operar com cap aprovado"
      },
      {
        platform: "google-ads",
        status: "action_required",
        nextAction: "Conectar conta"
      },
      {
        platform: "ga4",
        status: "connected",
        nextAction: "Medir"
      }
    ],
    socialPlatforms: [
      {
        platform: "instagram",
        status: "connected"
      }
    ],
    socialBindings: [
      {
        platform: "instagram",
        status: "connected",
        publishingReady: true,
        analyticsReady: true,
        paidMediaReady: false
      }
    ],
    siteOpsProfile: {
      primarySiteUrl: "https://example.com",
      landingPageUrls: ["https://example.com/demo"],
      conversionEventName: "purchase"
    },
    crmProfile: {
      provider: "hubspot",
      status: "connected",
      defaultOwner: "sales@example.com",
      requireConsentForEmail: true,
      requireConsentForAds: true
    },
    leads: [
      {
        stage: "qualified",
        utmSource: "meta"
      },
      {
        stage: "proposal"
      }
    ],
    conversionEvents: [],
    socialInsights: [
      {
        platform: "instagram",
        window: "7d",
        note: "Engajamento subiu com prova social"
      }
    ],
    creativeAssets: [],
    learningPlaybooks: [
      {
        id: "playbook-1",
        status: "active",
        confidence: 0.78,
        title: "Prova operacional antes da promessa",
        channel: "meta",
        recommendedAction: "Abrir com prova e depois promessa",
        reuseGuidance: ["Usar em campanhas de aquisicao B2B"],
        evidence: ["2 wins em 28d"],
        validityScope: {
          channel: "meta",
          targetMetric: "qualified_lead_rate",
          observedWindow: "28d",
          tenantOnly: true
        }
      }
    ],
    experimentOutcomes: [],
    executionPlans: [],
    snapshots: []
  } as unknown as CompanyWorkspace;
}

function buildCmoDecision(
  workspace: CompanyWorkspace,
  scorecards: CompanyOptimizationScorecard[]
): CompanyCmoStrategicDecision {
  return {
    id: "cmo-1",
    companySlug: workspace.company.slug,
    dominantConstraint: "acquisition",
    weeklyThesis: "Escalar o canal vencedor com seguranca.",
    primaryBet: "Meta deve ser o canal principal desta semana.",
    supportingBets: ["Validar tracking", "Criar novas variacoes"],
    delegatedModules: ["strategy", "ads", "studio"],
    focusMetric: "qualified_acquisition_efficiency",
    confidence: 0.74,
    rationale: "Scorecard indica canal vencedor.",
    winningChannels: [{ channel: "Meta Ads", platform: "meta", reason: "Score alto" }],
    losingChannels: [],
    scorecards,
    recommendedExperiments: [],
    createdAt: "2026-05-03T10:00:00.000Z"
  };
}

function buildScorecard(
  id: string,
  channel: string,
  platform: CompanyOptimizationScorecard["platform"],
  decision: CompanyOptimizationScorecard["decision"],
  score: number
): CompanyOptimizationScorecard {
  return {
    id,
    channel,
    platform,
    window: "7d",
    health: decision === "scale" ? "winning" : "learning",
    decision,
    score,
    spend: 1000,
    conversions: 12,
    revenue: 5000,
    cpa: 83,
    ctr: 0.03,
    conversionSignalsSent: 12,
    conversionSignalsBlocked: 0,
    conversionSignalsFailed: 0,
    rationale: "Canal com eficiencia acima da media.",
    evidence: ["CPA abaixo do alvo", "Receita atribuida"]
  };
}
