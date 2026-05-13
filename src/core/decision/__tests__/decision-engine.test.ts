import test from "node:test";
import assert from "node:assert/strict";
import { runCoreDecisionEngine } from "@/core/decision/decision-engine";
import type { CompanyContext, DiagnosticFinding, GrowthOpportunity, PrioritizedAction } from "@/lib/agents/types";

function buildContext(): CompanyContext {
  return {
    companySlug: "tenant-a",
    companyName: "Tenant A",
    generatedAt: "2026-04-22T10:00:00.000Z",
    workspace: {
      leads: [],
      crmProfile: {
        routingMode: "scheduler_sync"
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
    goals: [
      {
        id: "goal-1",
        title: "Crescer receita",
        metric: "revenue",
        target: "R$ 100k",
        horizon: "30d",
        priority: "high"
      }
    ],
    kpis: {
      generatedAt: "2026-04-22T10:00:00.000Z",
      spend: 1000,
      revenue: 3000,
      conversions: 10,
      leadsWon: 2,
      approvalBacklog: 0,
      runtimeQueued: 1,
      runtimeBlocked: 0,
      runtimeFailed: 0,
      recentReports: 1,
      activeLearnings: 2,
      connectorCoverage: {
        ready: 1,
        partial: 0,
        blocked: 0
      },
      summaries: [
        {
          label: "Revenue",
          value: "3000"
        }
      ]
    },
    connectorCapabilities: [
      {
        connector: "ga4",
        label: "GA4",
        status: "ready",
        canRead: true,
        canWrite: false,
        capabilities: ["read"],
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
    strategySummary: ["Foco em aquisicao com tracking saudavel."],
    recentReports: [],
    recentExecutionPlans: [],
    recentAlerts: [],
    recentAudit: [],
    recentRuntimeTasks: [],
    recentRuntimeLogs: [],
    metricSnapshots: []
  } as unknown as CompanyContext;
}

test("core decision engine builds explicit snapshot, signals and next best action", () => {
  const context = buildContext();
  const findings: DiagnosticFinding[] = [
    {
      id: "finding-1",
      companySlug: "tenant-a",
      area: "acquisition",
      summary: "Canal principal ainda nao converte com consistencia.",
      severity: "high",
      confidence: 0.88,
      evidence: ["CTR caiu 22%."],
      suspectedRootCause: "Oferta pouco clara.",
      suggestedNextMoves: ["Ajustar criativo e oferta."]
    }
  ];
  const opportunities: GrowthOpportunity[] = [
    {
      id: "op-1",
      companySlug: "tenant-a",
      findingId: "finding-1",
      area: "acquisition",
      title: "Corrigir aquisicao",
      summary: "Reforcar canal",
      hypothesis: "Melhorar criativo deve elevar CTR.",
      impactScore: 80,
      urgencyScore: 70,
      effortScore: 30,
      confidence: 0.88,
      targetMetric: "ctr",
      evidence: ["CTR caiu 22%."]
    }
  ];
  const actions: PrioritizedAction[] = [
    {
      id: "action-1",
      companySlug: "tenant-a",
      opportunityId: "op-1",
      findingId: "finding-1",
      type: "refresh_creatives",
      title: "Atualizar criativos",
      description: "Criar nova variante",
      rationale: "Criativo atual perdeu tracao.",
      evidence: ["CTR caiu 22%."],
      targetMetric: "ctr",
      impactScore: 80,
      urgencyScore: 70,
      confidenceScore: 88,
      effortScore: 30,
      compositeScore: 84,
      priority: "high",
      riskScore: {
        score: 40,
        level: "medium",
        factors: []
      },
      autonomyMode: "requires_approval"
    }
  ];

  const result = runCoreDecisionEngine({
    context,
    findings,
    opportunities,
    actions
  });

  assert.equal(result.selectedActionId, "action-1");
  assert.equal(result.snapshot.tenantId, "tenant-a");
  assert.ok(result.signals.length >= 1);
  assert.ok(result.reasons.some((reason) => reason.code === "TOP_COMPOSITE_SCORE"));
});

