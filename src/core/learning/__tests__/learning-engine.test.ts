import assert from "node:assert/strict";
import test from "node:test";
import { runCoreLearningEngine } from "@/core/learning/learning-engine";
import type { AutomationRun, CompanyContext } from "@/lib/agents/types";

test("learning engine turns a winning scorecard into a winning experiment result", () => {
  const context = {
    companySlug: "acme",
    companyName: "Acme",
    generatedAt: "2026-04-22T10:00:00.000Z",
    workspace: {} as CompanyContext["workspace"],
    trigger: {
      id: "trigger-1",
      companySlug: "acme",
      type: "scheduled_cycle",
      actor: "scheduler",
      summary: "cycle",
      createdAt: "2026-04-22T10:00:00.000Z"
    },
    goals: [],
    kpis: {} as CompanyContext["kpis"],
    connectorCapabilities: [],
    memory: {
      companySlug: "acme",
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
  } as CompanyContext;

  const run = {
    id: "run-1",
    companySlug: "acme",
    trigger: context.trigger,
    state: "learn",
    startedAt: "2026-04-22T10:00:00.000Z",
    finishedAt: "2026-04-22T10:05:00.000Z",
    diagnostics: [],
    opportunities: [],
    actions: [],
    jobs: [],
    approvals: [],
    policyDecisions: [],
    outcomes: [],
    learningRecords: [],
    experiments: [
      {
        id: "experiment-acme-meta",
        companySlug: "acme",
        linkedActionId: "action-1",
        title: "Teste A/B em Meta",
        hypothesis: "Prova social vence clareza de oferta",
        primaryMetric: "CPA",
        variants: ["Variante A", "Variante B"],
        status: "planned",
        createdAt: "2026-04-22T10:00:00.000Z"
      }
    ],
    experimentResults: [],
    cmoDecision: {
      id: "cmo-1",
      companySlug: "acme",
      dominantConstraint: "acquisition",
      weeklyThesis: "dobrar volume com eficiencia",
      primaryBet: "Meta",
      supportingBets: [],
      delegatedModules: ["ads"],
      focusMetric: "CPA",
      confidence: 0.84,
      rationale: "Meta esta com sinais melhores",
      winningChannels: [],
      losingChannels: [],
      scorecards: [
        {
          id: "scorecard-meta",
          channel: "meta",
          platform: "meta",
          window: "7d",
          health: "winning",
          decision: "scale",
          score: 91,
          cpa: 31,
          ctr: 0.024,
          revenue: 12000,
          conversionSignalsSent: 5,
          conversionSignalsBlocked: 0,
          conversionSignalsFailed: 0,
          rationale: "CPA abaixo da meta e sinais de conversao limpos.",
          evidence: ["CPA 31", "CTR 2.4%"]
        }
      ],
      recommendedExperiments: [],
      createdAt: "2026-04-22T10:05:00.000Z"
    },
    metrics: {
      totalJobs: 0,
      completedJobs: 0,
      blockedJobs: 0,
      failedJobs: 0,
      approvalPendingJobs: 0,
      autoExecutedJobs: 0,
      timedOutJobs: 0,
      blockedByCircuitBreaker: 0,
      durationMs: 300000,
      delegatedModules: [],
      realExecutorsUsed: []
    },
    summary: "ok",
    auditReferences: []
  } as AutomationRun;

  const feedback = runCoreLearningEngine(context, run);
  const result = feedback.experimentResults[0];

  assert.equal(result.status, "won");
  assert.equal(result.winningVariant, "Variante A");
  assert.ok(result.summary.includes("vencedor"));
});
