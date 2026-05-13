import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCorePolicyDecision } from "@/core/policy/policy-engine";
import type { CompanyContext, PrioritizedAction } from "@/lib/agents/types";
import type { CompanyPolicyMatrix } from "@/lib/domain";

function buildContext(): CompanyContext {
  return {
    companySlug: "tenant-a",
    companyName: "Tenant A",
    generatedAt: "2026-04-22T10:00:00.000Z",
    workspace: {
      leads: [
        {
          id: "lead-1",
          stage: "new",
          nextFollowUpAt: "2026-04-22T09:00:00.000Z",
          consentStatus: "granted"
        }
      ],
      crmProfile: {
        routingMode: "scheduler_sync",
        requireConsentForEmail: true
      },
      paymentProfile: {
        spendCap: "R$ 1.200,00",
        approvalRule: "Sempre revisar mudancas financeiras acima do teto."
      }
    },
    trigger: {
      id: "trigger-1",
      companySlug: "tenant-a",
      type: "scheduled_cycle",
      actor: "agent",
      summary: "Ciclo",
      createdAt: "2026-04-22T10:00:00.000Z"
    },
    goals: [],
    kpis: {
      generatedAt: "2026-04-22T10:00:00.000Z",
      spend: 0,
      revenue: 0,
      conversions: 0,
      leadsWon: 0,
      approvalBacklog: 0,
      runtimeQueued: 0,
      runtimeBlocked: 0,
      runtimeFailed: 0,
      recentReports: 0,
      activeLearnings: 0,
      connectorCoverage: {
        ready: 1,
        partial: 0,
        blocked: 0
      },
      summaries: []
    },
    connectorCapabilities: [
      {
        connector: "meta",
        label: "Meta",
        status: "ready",
        canRead: true,
        canWrite: true,
        capabilities: ["read", "write"],
        note: "ready"
      }
    ],
    memory: {
      companySlug: "tenant-a",
      patterns: [],
      learningRecords: [],
      openApprovals: [],
      activeExperiments: [],
      recentRuns: []
    },
    strategySummary: [],
    recentReports: [],
    recentExecutionPlans: [],
    recentAlerts: [],
    recentAudit: [],
    recentRuntimeTasks: [],
    recentRuntimeLogs: [],
    metricSnapshots: []
  } as unknown as CompanyContext;
}

test("core policy can auto-execute safe lead follow-up", () => {
  const decision = evaluateCorePolicyDecision(buildContext(), {
    id: "action-1",
    companySlug: "tenant-a",
    opportunityId: "op-1",
    findingId: "finding-1",
    type: "follow_up_leads",
    title: "Follow-up",
    description: "Executar",
    rationale: "Leads vencidos",
    evidence: ["1 lead vencido"],
    targetMetric: "lead_to_revenue_rate",
    impactScore: 70,
    urgencyScore: 70,
    confidenceScore: 86,
    effortScore: 20,
    compositeScore: 82,
    priority: "high",
    riskScore: {
      score: 48,
      level: "medium",
      factors: []
    },
    autonomyMode: "requires_approval",
    params: {
      dueLeadCount: 1
    }
  } as PrioritizedAction);

  assert.equal(decision.status, "AUTO_EXECUTE");
  assert.ok(decision.reasonCodes.includes("LEAD_AUTOPILOT_SAFE"));
});

test("core policy forces policy review for budget shifts", () => {
  const decision = evaluateCorePolicyDecision(buildContext(), {
    id: "action-2",
    companySlug: "tenant-a",
    opportunityId: "op-2",
    findingId: "finding-2",
    type: "propose_budget_shift",
    title: "Budget shift",
    description: "Mover verba",
    rationale: "Canal vencedor",
    evidence: ["ROAS maior em Meta"],
    targetMetric: "roas",
    targetPlatform: "meta",
    impactScore: 90,
    urgencyScore: 75,
    confidenceScore: 80,
    effortScore: 25,
    compositeScore: 87,
    priority: "critical",
    riskScore: {
      score: 85,
      level: "critical",
      factors: []
    },
    autonomyMode: "policy_review"
  } as PrioritizedAction);

  assert.equal(decision.status, "REQUIRE_POLICY_REVIEW");
  assert.ok(decision.requiredApprovers.length >= 1);
});

test("core policy escalates lead follow-up to policy review when consent is missing", () => {
  const context = buildContext();
  context.workspace.leads = [
    {
      id: "lead-2",
      stage: "qualified",
      nextFollowUpAt: "2026-04-22T09:00:00.000Z",
      consentStatus: "unknown"
    }
  ] as typeof context.workspace.leads;

  const decision = evaluateCorePolicyDecision(
    context,
    {
      id: "action-3",
      companySlug: "tenant-a",
      opportunityId: "op-3",
      findingId: "finding-3",
      type: "follow_up_leads",
      title: "Follow-up com consentimento pendente",
      description: "Executar",
      rationale: "Lead quente sem consentimento claro",
      evidence: ["Lead qualificado sem consentimento granted"],
      targetMetric: "lead_to_revenue_rate",
      impactScore: 74,
      urgencyScore: 81,
      confidenceScore: 84,
      effortScore: 18,
      compositeScore: 85,
      priority: "critical",
      riskScore: {
        score: 58,
        level: "medium",
        factors: []
      },
      autonomyMode: "requires_approval",
      params: {
        dueLeadIds: ["lead-2"]
      }
    } as PrioritizedAction
  );

  assert.equal(decision.status, "REQUIRE_POLICY_REVIEW");
  assert.ok(decision.reasonCodes.includes("CONSENT_REVIEW_REQUIRED"));
  assert.ok(decision.requiredApprovers.includes("compliance"));
});

test("core policy escalates large experiment budgets to policy review", () => {
  const decision = evaluateCorePolicyDecision(
    buildContext(),
    {
      id: "action-4",
      companySlug: "tenant-a",
      opportunityId: "op-4",
      findingId: "finding-4",
      type: "launch_experiment",
      title: "Experimento pesado",
      description: "Lancar teste com verba relevante",
      rationale: "Criativo novo com midia",
      evidence: ["Canal com alto potencial"],
      targetMetric: "conversion_rate",
      targetPlatform: "meta",
      impactScore: 88,
      urgencyScore: 70,
      confidenceScore: 79,
      effortScore: 32,
      compositeScore: 83,
      priority: "high",
      riskScore: {
        score: 62,
        level: "high",
        factors: []
      },
      autonomyMode: "requires_approval",
      params: {
        draftOnly: false,
        budget: "R$ 2.500,00"
      }
    } as PrioritizedAction
  );

  assert.equal(decision.status, "REQUIRE_POLICY_REVIEW");
  assert.ok(decision.reasonCodes.includes("BUDGET_POLICY_REVIEW"));
});

test("core policy escalates when tenant spend cap is exceeded", () => {
  const decision = evaluateCorePolicyDecision(
    buildContext(),
    {
      id: "action-5",
      companySlug: "tenant-a",
      opportunityId: "op-5",
      findingId: "finding-5",
      type: "propose_budget_shift",
      title: "Escalar verba acima do teto",
      description: "Mover budget",
      rationale: "Canal com boa performance",
      evidence: ["ROAS acima do baseline"],
      targetMetric: "roas",
      targetPlatform: "meta",
      impactScore: 91,
      urgencyScore: 77,
      confidenceScore: 88,
      effortScore: 20,
      compositeScore: 90,
      priority: "critical",
      riskScore: {
        score: 84,
        level: "critical",
        factors: []
      },
      autonomyMode: "policy_review",
      params: {
        budget: 1800
      }
    } as PrioritizedAction
  );

  assert.equal(decision.status, "REQUIRE_POLICY_REVIEW");
  assert.ok(decision.reasonCodes.includes("TENANT_SPEND_CAP_EXCEEDED"));
  assert.ok(decision.requiredApprovers.includes("finance_owner"));
});

test("core policy blocks forbidden claims in marketing content", () => {
  const decision = evaluateCorePolicyDecision(
    buildContext(),
    {
      id: "action-6",
      companySlug: "tenant-a",
      opportunityId: "op-6",
      findingId: "finding-6",
      type: "refresh_creatives",
      title: "Novo criativo arriscado",
      description: "Criativo com claim proibida",
      rationale: "Testar mensagem agressiva",
      evidence: ["Necessidade de recuperar CTR"],
      targetMetric: "ctr",
      targetPlatform: "meta",
      impactScore: 70,
      urgencyScore: 68,
      confidenceScore: 78,
      effortScore: 22,
      compositeScore: 75,
      priority: "high",
      riskScore: {
        score: 56,
        level: "medium",
        factors: []
      },
      autonomyMode: "requires_approval",
      params: {
        headline: "Resultado garantido em 7 dias",
        body: "Sem risco e 100% garantido."
      }
    } as PrioritizedAction
  );

  assert.equal(decision.status, "BLOCK");
  assert.ok(decision.reasonCodes.includes("FORBIDDEN_MARKETING_CLAIM"));
});

test("core policy routes sensitive claims to brand review", () => {
  const decision = evaluateCorePolicyDecision(
    buildContext(),
    {
      id: "action-7",
      companySlug: "tenant-a",
      opportunityId: "op-7",
      findingId: "finding-7",
      type: "launch_experiment",
      title: "Experimento com claim sensivel",
      description: "Teste de copy",
      rationale: "Explorar ganho de CTR",
      evidence: ["Historico de fadiga criativa"],
      targetMetric: "ctr",
      targetPlatform: "meta",
      impactScore: 76,
      urgencyScore: 66,
      confidenceScore: 80,
      effortScore: 24,
      compositeScore: 78,
      priority: "high",
      riskScore: {
        score: 58,
        level: "medium",
        factors: []
      },
      autonomyMode: "requires_approval",
      params: {
        draftOnly: false,
        caption: "Antes e depois do nosso metodo comprovado."
      }
    } as PrioritizedAction
  );

  assert.equal(decision.status, "REQUIRE_APPROVAL");
  assert.ok(decision.reasonCodes.includes("SENSITIVE_MARKETING_CLAIM"));
  assert.ok(decision.requiredApprovers.includes("brand_owner"));
});

test("core policy blocks tenant-specific blocked data sources", () => {
  const context = buildContext();
  context.workspace.keywordStrategy = {
    companySlug: "tenant-a",
    status: "customized",
    updatedAt: "2026-04-22T10:00:00.000Z",
    mainOffer: "Oferta principal",
    primaryKeywords: [],
    longTailKeywords: [],
    negativeKeywords: [],
    conversionAngles: [],
    landingMessages: [],
    audienceSignals: [],
    optimizationRules: [],
    blockedDataSources: ["meta"],
    approvedDataSources: [],
    complianceNote: ""
  } as typeof context.workspace.keywordStrategy;

  const decision = evaluateCorePolicyDecision(
    context,
    {
      id: "action-8",
      companySlug: "tenant-a",
      opportunityId: "op-8",
      findingId: "finding-8",
      type: "launch_experiment",
      title: "Experimento em canal bloqueado",
      description: "Teste",
      rationale: "Canal candidato",
      evidence: ["Meta sugerido pelo planner"],
      targetMetric: "conversion_rate",
      targetPlatform: "meta",
      impactScore: 70,
      urgencyScore: 70,
      confidenceScore: 76,
      effortScore: 28,
      compositeScore: 76,
      priority: "high",
      riskScore: {
        score: 58,
        level: "medium",
        factors: []
      },
      autonomyMode: "requires_approval",
      params: {
        channel: "meta"
      }
    } as PrioritizedAction
  );

  assert.equal(decision.status, "BLOCK");
  assert.ok(decision.reasonCodes.includes("TENANT_BLOCKED_SOURCE"));
});

test("core policy escalates tenant compliance note review phrases", () => {
  const context = buildContext();
  context.workspace.keywordStrategy = {
    companySlug: "tenant-a",
    status: "customized",
    updatedAt: "2026-04-22T10:00:00.000Z",
    mainOffer: "Oferta principal",
    primaryKeywords: [],
    longTailKeywords: [],
    negativeKeywords: [],
    conversionAngles: [],
    landingMessages: [],
    audienceSignals: [],
    optimizationRules: [],
    blockedDataSources: [],
    approvedDataSources: ["meta"],
    complianceNote: "Revisar: antes e depois, comprovado."
  } as typeof context.workspace.keywordStrategy;

  const decision = evaluateCorePolicyDecision(
    context,
    {
      id: "action-9",
      companySlug: "tenant-a",
      opportunityId: "op-9",
      findingId: "finding-9",
      type: "refresh_creatives",
      title: "Criativo com frase sensivel do tenant",
      description: "Teste",
      rationale: "Explorar criativo",
      evidence: ["Necessidade de renovar assets"],
      targetMetric: "ctr",
      targetPlatform: "meta",
      impactScore: 66,
      urgencyScore: 61,
      confidenceScore: 79,
      effortScore: 20,
      compositeScore: 71,
      priority: "medium",
      riskScore: {
        score: 54,
        level: "medium",
        factors: []
      },
      autonomyMode: "requires_approval",
      params: {
        caption: "Antes e depois comprovado do nosso metodo."
      }
    } as PrioritizedAction
  );

  assert.equal(decision.status, "REQUIRE_POLICY_REVIEW");
  assert.ok(decision.reasonCodes.includes("TENANT_COMPLIANCE_REVIEW"));
});

test("core policy applies tenant policy matrix action overrides", () => {
  const policyMatrix: CompanyPolicyMatrix = {
    companySlug: "tenant-a",
    version: 2,
    status: "active",
    defaultRequiredApprovers: ["operator"],
    defaultPolicyReviewApprovers: ["admin"],
    globalApprovedDataSources: [],
    globalBlockedDataSources: [],
    globalForbiddenClaimPatterns: [],
    globalSensitiveClaimPatterns: [],
    actionRules: [
      {
        actionType: "refresh_creatives",
        decisionOverride: "policy_review",
        requiredApprovers: ["brand_owner"],
        policyReviewApprovers: ["brand_owner", "compliance"],
        sensitiveClaimPatterns: ["hiper crescimento"]
      }
    ],
    createdAt: "2026-05-02T10:00:00.000Z",
    updatedAt: "2026-05-02T10:00:00.000Z",
    updatedBy: "test"
  };

  const decision = evaluateCorePolicyDecision(
    buildContext(),
    {
      id: "action-10",
      companySlug: "tenant-a",
      opportunityId: "op-10",
      findingId: "finding-10",
      type: "refresh_creatives",
      title: "Criativo sensivel do tenant",
      description: "Teste",
      rationale: "Copy agressiva",
      evidence: ["Necessidade de renovar CTR"],
      targetMetric: "ctr",
      targetPlatform: "meta",
      impactScore: 72,
      urgencyScore: 64,
      confidenceScore: 82,
      effortScore: 20,
      compositeScore: 78,
      priority: "high",
      riskScore: {
        score: 54,
        level: "medium",
        factors: []
      },
      autonomyMode: "requires_approval",
      params: {
        caption: "Nova tese de hiper crescimento."
      }
    } as PrioritizedAction,
    undefined,
    policyMatrix
  );

  assert.equal(decision.status, "REQUIRE_POLICY_REVIEW");
  assert.ok(decision.reasonCodes.includes("TENANT_POLICY_MATRIX_ACTIVE"));
  assert.ok(decision.requiredApprovers.includes("compliance"));
});

test("core policy lets tenant policy matrix block an action type", () => {
  const policyMatrix: CompanyPolicyMatrix = {
    companySlug: "tenant-a",
    version: 3,
    status: "active",
    defaultRequiredApprovers: [],
    defaultPolicyReviewApprovers: [],
    globalApprovedDataSources: [],
    globalBlockedDataSources: [],
    globalForbiddenClaimPatterns: [],
    globalSensitiveClaimPatterns: [],
    actionRules: [
      {
        actionType: "follow_up_leads",
        decisionOverride: "blocked"
      }
    ],
    createdAt: "2026-05-02T10:00:00.000Z",
    updatedAt: "2026-05-02T10:00:00.000Z",
    updatedBy: "test"
  };

  const decision = evaluateCorePolicyDecision(
    buildContext(),
    {
      id: "action-11",
      companySlug: "tenant-a",
      opportunityId: "op-11",
      findingId: "finding-11",
      type: "follow_up_leads",
      title: "Follow-up bloqueado",
      description: "Executar",
      rationale: "Lead vencido",
      evidence: ["1 lead vencido"],
      targetMetric: "lead_to_revenue_rate",
      impactScore: 70,
      urgencyScore: 70,
      confidenceScore: 90,
      effortScore: 20,
      compositeScore: 85,
      priority: "high",
      riskScore: {
        score: 42,
        level: "medium",
        factors: []
      },
      autonomyMode: "requires_approval",
      params: {
        dueLeadCount: 1
      }
    } as PrioritizedAction,
    undefined,
    policyMatrix
  );

  assert.equal(decision.status, "BLOCK");
  assert.ok(decision.reasonCodes.includes("TENANT_POLICY_BLOCK"));
});
