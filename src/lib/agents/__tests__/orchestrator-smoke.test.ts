import assert from "node:assert/strict";
import test from "node:test";
import { getPersistedCompanyAutomationRuns } from "@/infrastructure/persistence/company-automation-storage";
import { buildTriggerEvent, runAgentOrchestrator } from "@/lib/agents/orchestrator";
import type { CompanyWorkspace } from "@/lib/domain";

function createSmokeWorkspace(companySlug: string): CompanyWorkspace {
  const now = "2026-04-22T12:00:00.000Z";

  return {
    company: {
      id: `company-${companySlug}`,
      slug: companySlug,
      name: "Smoke Co",
      sector: "SaaS",
      region: "Brasil",
      timezone: "America/Sao_Paulo",
      primaryGoal: "Crescer com previsibilidade"
    },
    stage: "active",
    agentMode: "semi-autonomo",
    summary: "Workspace de smoke test",
    nextActions: [],
    agentProfile: {
      companySlug,
      companyName: "Smoke Co",
      trainingStatus: "seeded",
      updatedAt: now,
      businessSummary: "Empresa B2B em validacao de growth OS.",
      brandVoice: "Direto e consultivo",
      idealCustomerProfile: "Operacoes que precisam de crescimento previsivel",
      offerStrategy: "Servico premium",
      differentiators: ["Autonomia com governanca"],
      approvedChannels: ["ga4", "google-ads"],
      contentPillars: ["Performance", "Governanca"],
      geoFocus: ["Brasil"],
      conversionEvents: ["lead"],
      efficiencyRules: ["Nao ampliar gasto sem sinal"],
      forbiddenClaims: ["Promessas irreais"],
      operatorNotes: "",
      systemPrompt: ""
    },
    strategyPlan: {
      companySlug,
      status: "seeded",
      updatedAt: now,
      planningHorizon: "90 dias",
      primaryObjective: "Ganhar aquisicao com mais previsibilidade",
      secondaryObjective: "Proteger eficiencia operacional",
      monthlyBudget: "R$ 15000",
      reachGoal: "Aumentar alcance qualificado",
      leadGoal: "Gerar mais leads qualificados",
      revenueGoal: "Aumentar receita recorrente",
      cpaTarget: "R$ 80,00",
      roasTarget: "3.0x",
      priorityChannels: ["ga4"],
      priorityMarkets: ["Brasil"],
      strategicInitiatives: ["Conectar e estabilizar canal pago"],
      dailyRituals: ["Revisar sinais"],
      weeklyRituals: ["Revisar scorecards"],
      risksToWatch: ["Tracking fraco"],
      userAlignmentNotes: "",
      competitors: []
    },
    dataOpsProfile: {
      companySlug,
      status: "seeded",
      updatedAt: now,
      reportingCadence: "weekly",
      analyticsObjective: "Explicar growth",
      sheetsWorkspaceName: "Ops",
      ga4PropertyId: "",
      searchConsoleSiteUrl: "",
      sheetsSpreadsheetId: "",
      sheetsOverviewRange: "Overview!A1:Z100",
      primaryKpis: ["Leads", "Receita"],
      sheetAutomations: [],
      approvedWriteActions: [],
      autonomyRule: "low-risk only",
      systemNotes: ""
    },
    keywordStrategy: {
      companySlug,
      status: "seeded",
      updatedAt: now,
      mainOffer: "Growth OS",
      primaryKeywords: ["growth os"],
      longTailKeywords: ["growth os b2b"],
      negativeKeywords: [],
      conversionAngles: ["prova social", "clareza de oferta"],
      landingMessages: ["governanca e autonomia"],
      audienceSignals: ["intencao alta"],
      approvedDataSources: ["ga4"],
      blockedDataSources: [],
      optimizationRules: ["nao escalar sem sinal"],
      complianceNote: "Sem claims sensiveis"
    },
    socialProfile: {
      companySlug,
      status: "seeded",
      updatedAt: now,
      primaryObjective: "Autoridade",
      publishingCadence: "weekly",
      autonomyRule: "approval before publish",
      approvalRule: "manual",
      schedulingPolicy: "business_hours",
      analyticsRoutine: "weekly",
      priorityPlatforms: ["linkedin"],
      contentPillars: ["Growth"],
      adObjectives: ["lead generation"],
      audienceNotes: ["B2B"]
    },
    socialPlatforms: [],
    scheduledPosts: [],
    socialAdDrafts: [],
    socialInsights: [],
    socialBindings: [],
    socialRuntime: {
      companySlug,
      connectedPlatforms: 0,
      publishReadyPlatforms: 0,
      analyticsReadyPlatforms: 0,
      adLaunchReadyPlatforms: 0,
      queuedTasks: 0,
      runningTasks: 0,
      blockedTasks: 0,
      failedTasks: 0,
      completedTasks: 0,
      nextPriority: "none"
    },
    socialRuntimeTasks: [],
    socialExecutionLogs: [],
    approvalsCenter: [],
    operationalInbox: [],
    operationalAlerts: [],
    agentLearnings: [],
    experimentOutcomes: [],
    learningPlaybooks: [],
    schedulerProfile: {
      companySlug,
      status: "seeded",
      timezone: "America/Sao_Paulo",
      quietHours: "22:00-07:00",
      approvalDigestTime: "09:00",
      incidentWatch: "always",
      schedulerAlertMinimumPriority: "medium",
      emailAlertMinimumPriority: "high",
      alertRecipients: [],
      financeAlertRecipients: [],
      runtimeAlertRecipients: [],
      strategyAlertRecipients: [],
      approvalAlertRecipients: [],
      connectionAlertRecipients: [],
      weekStartsOn: "monday",
      notes: "",
      updatedAt: now
    },
    schedulerJobs: [],
    paymentProfile: {
      companySlug,
      provider: "stripe",
      status: "not_configured",
      defaultCurrency: "BRL",
      spendCap: "R$ 5000",
      approvalRule: "manual",
      updatedAt: now
    },
    paymentRequests: [],
    creativeTools: [],
    creativeAssets: [],
    publishingRequests: [],
    crmProfile: {
      companySlug,
      provider: "none",
      status: "seeded",
      syncMode: "manual_review",
      defaultOwner: "sales",
      notes: "",
      updatedAt: now
    },
    siteOpsProfile: {
      companySlug,
      status: "seeded",
      primarySiteUrl: "https://example.com",
      landingPageUrls: [],
      captureMode: "disabled",
      allowedOrigins: [],
      trackingDomain: "",
      gtmContainerId: "",
      ga4MeasurementId: "",
      metaPixelId: "",
      googleAdsConversionId: "",
      googleAdsConversionLabel: "",
      conversionEventName: "lead",
      webhookTargets: [],
      cmsProvider: "none",
      cmsConnectionStatus: "not_connected",
      cmsSiteUrl: "",
      cmsUsername: "",
      notes: "",
      updatedAt: now
    },
    leads: [],
    conversionEvents: [],
    engineeringWorkspaces: [],
    technicalRequests: [],
    accounts: [],
    connections: [
      {
        id: `conn-${companySlug}-ga4`,
        platform: "ga4",
        label: "GA4",
        status: "connected",
        auth: "oauth",
        scopes: ["read"],
        accountLabels: ["Main"],
        vaultNamespace: "ga4-main",
        nextAction: "none"
      }
    ],
    snapshots: [
      {
        platform: "ga4",
        window: "7d",
        conversions: 2,
        revenue: 1000,
        notes: ["baseline"]
      }
    ],
    reports: [
      {
        id: `report-${companySlug}`,
        companySlug,
        companyName: "Smoke Co",
        type: "weekly_marketing",
        generatedAt: now,
        title: "Weekly report",
        summary: "Baseline atual",
        highlights: ["Base viva"],
        risks: [],
        actions: ["seguir"],
        metrics: [],
        sections: []
      }
    ],
    executionPlans: [],
    automationRuns: [],
    automationQueue: [],
    automationDeadLetters: [],
    executionIntents: [],
    connectorCircuitBreakers: [],
    automationRuntimeHealth: {
      companySlug,
      queuedRetries: 0,
      runningRetries: 0,
      waitingRetries: 0,
      queuedRuns: 0,
      runningRuns: 0,
      waitingRuns: 0,
      deadLetters: 0,
      activeExecutionIntents: 0,
      failedExecutionIntents: 0,
      timedOutExecutionIntents: 0,
      openCircuitBreakers: 0,
      halfOpenCircuitBreakers: 0
    },
    audit: []
  };
}

test("orchestrator smoke runs a tenant-scoped autonomous cycle end-to-end", async () => {
  process.env.VAULT_ENCRYPTION_KEY = "smoke-orchestrator-key";
  process.env.SECRETS_ENCRYPTION_KEY = "smoke-orchestrator-secrets-key";

  const companySlug = `smoke-orchestrator-${Date.now()}`;
  const workspace = createSmokeWorkspace(companySlug);
  const trigger = buildTriggerEvent(companySlug, {
    triggerType: "manual_run",
    actor: "smoke-test",
    summary: "Smoke test do ciclo autonomo"
  });

  const run = await runAgentOrchestrator({
    workspace,
    trigger,
    actor: "smoke-test"
  });

  const storedRuns = getPersistedCompanyAutomationRuns(companySlug);

  assert.equal(run.companySlug, companySlug);
  assert.ok(run.diagnostics.length >= 1);
  assert.ok(run.actions.length >= 1);
  assert.ok(run.jobs.length >= 1);
  assert.ok(run.policyDecisions.length >= 1);
  assert.ok(run.outcomes.length + run.approvals.length >= 1);
  assert.ok(run.auditReferences.length >= 1);
  assert.ok(run.decisionProvenance);
  assert.equal(run.state, "schedule_next_cycle");
  assert.ok(storedRuns.some((storedRun) => storedRun.id === run.id));
});
