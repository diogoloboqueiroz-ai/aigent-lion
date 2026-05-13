import assert from "node:assert/strict";
import test from "node:test";
import { doesCoreAreaMatchConstraint, runCoreCmoStrategy } from "@/core/decision/cmo-strategy";
import type { CompanyContext } from "@/lib/agents/types";

function buildContext(): CompanyContext {
  return {
    companySlug: "tenant-cmo",
    companyName: "Tenant CMO",
    generatedAt: "2026-04-23T11:10:00.000Z",
    workspace: {
      snapshots: [],
      conversionEvents: [
        {
          id: "event-1",
          status: "blocked"
        }
      ],
      strategyPlan: {
        priorityChannels: ["google-ads"],
        primaryObjective: "Aumentar receita",
        cpaTarget: "R$ 80,00",
        roasTarget: "3.0x"
      },
      connections: [],
      leads: [],
      creativeAssets: [],
      publishingRequests: []
    },
    trigger: {
      id: "trigger-cmo",
      companySlug: "tenant-cmo",
      type: "scheduled_cycle",
      actor: "scheduler",
      summary: "cycle",
      createdAt: "2026-04-23T11:10:00.000Z"
    },
    goals: [],
    kpis: {
      generatedAt: "2026-04-23T11:10:00.000Z",
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
      companySlug: "tenant-cmo",
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

test("core cmo strategy prioritizes tracking when conversion dispatch is blocked", () => {
  const decision = runCoreCmoStrategy(buildContext());

  assert.equal(decision.dominantConstraint, "tracking");
  assert.equal(decision.focusMetric, "conversion_dispatch_health");
  assert.ok(doesCoreAreaMatchConstraint("conversion", decision));
});
