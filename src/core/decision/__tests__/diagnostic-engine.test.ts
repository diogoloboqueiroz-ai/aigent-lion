import assert from "node:assert/strict";
import test from "node:test";
import { runCoreDiagnosticEngine } from "@/core/decision/diagnostic-engine";
import type { CompanyContext } from "@/lib/agents/types";

function buildContext(): CompanyContext {
  return {
    companySlug: "tenant-diagnostic",
    companyName: "Tenant Diagnostic",
    generatedAt: "2026-04-23T11:00:00.000Z",
    workspace: {
      strategyPlan: {
        priorityChannels: ["google-ads", "meta"]
      },
      connections: [
        {
          id: "ga4-1",
          platform: "ga4",
          status: "connected"
        }
      ],
      conversionEvents: [
        {
          id: "conv-1",
          destination: "google_ads",
          status: "blocked",
          detail: "missing gclid"
        }
      ],
      publishingRequests: [],
      automationRuntimeHealth: {
        deadLetters: 1,
        latestDeadLetterAt: "2026-04-23T10:30:00.000Z",
        queuedRetries: 2
      }
    },
    trigger: {
      id: "trigger-1",
      companySlug: "tenant-diagnostic",
      type: "scheduled_cycle",
      actor: "scheduler",
      summary: "cycle",
      createdAt: "2026-04-23T11:00:00.000Z"
    },
    goals: [],
    kpis: {
      generatedAt: "2026-04-23T11:00:00.000Z",
      spend: 0,
      revenue: 0,
      conversions: 0,
      leadsWon: 0,
      approvalBacklog: 0,
      runtimeQueued: 1,
      runtimeBlocked: 1,
      runtimeFailed: 1,
      recentReports: 0,
      activeLearnings: 0,
      connectorCoverage: {
        ready: 0,
        partial: 1,
        blocked: 3
      },
      summaries: []
    },
    connectorCapabilities: [
      {
        connector: "google-ads",
        label: "Google Ads",
        status: "blocked",
        canRead: false,
        canWrite: false,
        capabilities: [],
        note: "missing binding"
      }
    ],
    memory: {
      companySlug: "tenant-diagnostic",
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
    recentRuntimeLogs: [
      {
        id: "runtime-log-1",
        platform: "instagram",
        status: "failed",
        detail: "token expired"
      }
    ],
    metricSnapshots: []
  } as unknown as CompanyContext;
}

test("core diagnostic engine surfaces runtime, tracking and governance gaps", () => {
  const findings = runCoreDiagnosticEngine(buildContext());

  assert.ok(findings.some((finding) => finding.id.includes("runtime-stability")));
  assert.ok(findings.some((finding) => finding.id.includes("tracking-dispatch")));
  assert.ok(findings.some((finding) => finding.id.includes("automation-dead-letter")));
  assert.ok(findings.some((finding) => finding.id.includes("connector-coverage")));
});
