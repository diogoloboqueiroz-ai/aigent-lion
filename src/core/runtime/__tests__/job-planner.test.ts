import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCoreExecutionJobs,
  buildRunMetrics,
  buildRunSummary,
  buildRuntimeJobId,
  inferLearningRecordsFromRun
} from "@/core/runtime/job-planner";
import type { AutomationRun, PolicyDecision, PrioritizedAction } from "@/lib/agents/types";

test("core runtime planner builds execution jobs from prioritized actions and policy decisions", () => {
  const actions: PrioritizedAction[] = [
    {
      id: "action-1",
      companySlug: "tenant-runtime",
      opportunityId: "op-1",
      findingId: "finding-1",
      type: "prepare_growth_report",
      title: "Gerar baseline",
      description: "desc",
      rationale: "rationale",
      evidence: ["baseline missing"],
      targetMetric: "reporting_coverage",
      impactScore: 60,
      urgencyScore: 55,
      confidenceScore: 80,
      effortScore: 20,
      compositeScore: 78,
      priority: "high",
      riskScore: {
        score: 12,
        level: "low",
        factors: []
      },
      autonomyMode: "auto_execute"
    }
  ];
  const decisions: PolicyDecision[] = [
    {
      jobId: buildRuntimeJobId("action-1"),
      companySlug: "tenant-runtime",
      decision: "auto_execute",
      riskScore: {
        score: 12,
        level: "low",
        factors: []
      },
      rationale: "safe",
      reasonCodes: ["LOW_RISK_AUTONOMY_ALLOWED"],
      violatedRules: [],
      requiredApprovers: [],
      confidenceFloor: 60,
      escalationMetadata: {}
    }
  ];

  const jobs = buildCoreExecutionJobs(actions, decisions);

  assert.equal(jobs[0]?.id, "agent-job-action-1");
  assert.equal(jobs[0]?.status, "planned");
  assert.equal(jobs[0]?.executorKey, "reporting");
  assert.equal(jobs[0]?.connectorKey, "google-data");
});

test("core runtime planner summarizes run metrics and fallback learnings", () => {
  const run: AutomationRun = {
    id: "run-1",
    companySlug: "tenant-runtime",
    trigger: {
      id: "trigger-1",
      companySlug: "tenant-runtime",
      type: "scheduled_cycle",
      actor: "scheduler",
      summary: "cycle",
      createdAt: "2026-04-23T12:00:00.000Z"
    },
    state: "learn",
    startedAt: "2026-04-23T12:00:00.000Z",
    finishedAt: "2026-04-23T12:01:00.000Z",
    diagnostics: [],
    opportunities: [],
    actions: [],
    jobs: [
      {
        id: "agent-job-action-1",
        companySlug: "tenant-runtime",
        actionId: "action-1",
        type: "prepare_growth_report",
        title: "Gerar baseline",
        status: "completed",
        autonomyMode: "auto_execute",
        riskScore: {
          score: 10,
          level: "low",
          factors: []
        },
        rationale: "safe",
        evidence: [],
        inputs: {},
        createdAt: "2026-04-23T12:00:00.000Z",
        auditReferences: []
      }
    ],
    approvals: [],
    policyDecisions: [],
    outcomes: [
      {
        jobId: "agent-job-action-1",
        companySlug: "tenant-runtime",
        status: "completed",
        summary: "ok",
        outputs: {
          executor: "reporting"
        },
        startedAt: "2026-04-23T12:00:00.000Z",
        finishedAt: "2026-04-23T12:01:00.000Z",
        auditReferences: ["audit-1"]
      }
    ],
    learningRecords: [],
    experiments: [],
    experimentResults: [],
    metrics: {
      totalJobs: 0,
      completedJobs: 0,
      blockedJobs: 0,
      failedJobs: 0,
      approvalPendingJobs: 0,
      autoExecutedJobs: 0,
      timedOutJobs: 0,
      blockedByCircuitBreaker: 0,
      durationMs: 0,
      delegatedModules: [],
      realExecutorsUsed: []
    },
    summary: "",
    auditReferences: []
  };

  const metrics = buildRunMetrics({
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    jobs: run.jobs,
    outcomes: run.outcomes
  });
  const summary = buildRunSummary({
    findingsCount: 2,
    approvalsCount: 1,
    outcomesCount: 1,
    actor: "scheduler",
    dominantConstraint: "tracking"
  });
  const learnings = inferLearningRecordsFromRun(run);

  assert.equal(metrics.completedJobs, 1);
  assert.equal(metrics.durationMs, 60000);
  assert.ok(summary.includes("tracking"));
  assert.equal(learnings[0]?.kind, "playbook");
});
