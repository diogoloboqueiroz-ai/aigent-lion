import assert from "node:assert/strict";
import test from "node:test";
import { buildCoreDecisionPlan } from "@/core/decision/action-planner";
import type { CompanyContext, DiagnosticFinding } from "@/lib/agents/types";

function buildContext(): CompanyContext {
  return {
    companySlug: "tenant-meta",
    companyName: "Tenant Meta",
    generatedAt: "2026-04-23T10:00:00.000Z",
    workspace: {
      company: {
        slug: "tenant-meta",
        name: "Tenant Meta"
      },
      leads: [],
      connections: [
        {
          id: "conn-meta",
          platform: "meta",
          label: "Meta",
          status: "not_connected"
        }
      ],
      strategyPlan: {
        priorityChannels: ["meta"],
        primaryObjective: "Crescer aquisicao"
      },
      conversionEvents: [],
      socialRuntimeTasks: [],
      socialExecutionLogs: [],
      creativeAssets: [],
      siteOpsProfile: {},
      crmProfile: {
        status: "connected"
      }
    },
    trigger: {
      id: "trigger-1",
      companySlug: "tenant-meta",
      type: "scheduled_cycle",
      actor: "scheduler",
      summary: "Ciclo",
      createdAt: "2026-04-23T10:00:00.000Z"
    },
    goals: [],
    kpis: {
      generatedAt: "2026-04-23T10:00:00.000Z",
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
        ready: 0,
        partial: 0,
        blocked: 1
      },
      summaries: []
    },
    connectorCapabilities: [],
    memory: {
      companySlug: "tenant-meta",
      patterns: [],
      sharedPatterns: [
        {
          id: "shared-meta",
          learningBoundary: "cross_tenant_safe",
          shareability: "shared",
          channel: "meta",
          title: "Playbook compartilhado de Meta",
          summary: "Social proof curta funciona melhor antes da escala.",
          status: "active",
          confidence: 0.84,
          sourceTenantCount: 3,
          sourcePlaybookCount: 4,
          winCount: 5,
          lossCount: 1,
          recommendedAction: "Escalar gradualmente usando a prova social curta.",
          evidence: [],
          createdAt: "2026-04-23T10:00:00.000Z",
          updatedAt: "2026-04-23T10:00:00.000Z"
        }
      ],
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

test("core action planner applies shared safe playbooks to diagnostic actions", () => {
  const context = buildContext();
  const findings: DiagnosticFinding[] = [
    {
      id: "finding-connector-gap",
      companySlug: "tenant-meta",
      area: "acquisition",
      summary: "Canal prioritario ainda sem conexao pronta.",
      severity: "high",
      confidence: 0.82,
      evidence: ["Meta segue desconectado."],
      suspectedRootCause: "Onboarding de conector incompleto.",
      suggestedNextMoves: ["Conectar Meta e validar permissao."]
    }
  ];

  const result = buildCoreDecisionPlan({ context, findings });
  const action = result.actions[0];

  assert.ok(action);
  assert.equal(action?.targetPlatform, "meta");
  assert.ok(action?.rationale.includes("Playbook compartilhado seguro"));
  assert.ok(action?.evidence.some((entry) => entry.includes("Playbook cross-tenant seguro")));
});
