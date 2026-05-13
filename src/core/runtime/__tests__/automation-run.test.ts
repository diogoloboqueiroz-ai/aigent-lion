import assert from "node:assert/strict";
import test from "node:test";
import {
  createDraftAutomationRun,
  createFailedAutomationRun,
  finalizeAutomationRun
} from "@/core/runtime/automation-run";
import type { AutomationRun } from "@/lib/agents/types";

function buildBaseRun(): AutomationRun {
  return {
    id: "run-1",
    companySlug: "tenant-run",
    trigger: {
      id: "trigger-1",
      companySlug: "tenant-run",
      type: "scheduled_cycle",
      actor: "scheduler",
      summary: "cycle",
      createdAt: "2026-04-23T13:00:00.000Z"
    },
    state: "evaluate",
    startedAt: "2026-04-23T13:00:00.000Z",
    diagnostics: [],
    opportunities: [],
    actions: [],
    jobs: [],
    approvals: [],
    policyDecisions: [],
    outcomes: [],
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
}

test("automation run lifecycle builds draft, final and failed payloads in core runtime", () => {
  const draft = createDraftAutomationRun({
    runId: "run-1",
    companySlug: "tenant-run",
    trigger: {
      id: "trigger-1",
      companySlug: "tenant-run",
      type: "scheduled_cycle",
      actor: "scheduler",
      summary: "cycle",
      createdAt: "2026-04-23T13:00:00.000Z"
    },
    state: "evaluate",
    startedAt: "2026-04-23T13:00:00.000Z",
    diagnostics: [],
    opportunities: [],
    actions: [],
    jobs: [],
    approvals: [],
    policyDecisions: [],
    outcomes: [],
    experiments: [],
    auditReferences: ["audit-1"]
  });

  const finalRun = finalizeAutomationRun({
    draftRun: draft,
    state: "schedule_next_cycle",
    finishedAt: "2026-04-23T13:01:00.000Z",
    learningRecords: [
      {
        id: "learning-1",
        companySlug: "tenant-run",
        kind: "playbook",
        title: "Learning",
        summary: "summary",
        confidence: 0.8,
        priority: "medium",
        evidence: [],
        sourceRunId: "run-1",
        createdAt: "2026-04-23T13:01:00.000Z",
        updatedAt: "2026-04-23T13:01:00.000Z"
      }
    ],
    experimentResults: [],
    actor: "scheduler",
    findingsCount: 2,
    approvalsCount: 1,
    outcomesCount: 0,
    dominantConstraint: "tracking"
  });

  const failedRun = createFailedAutomationRun({
    runId: "run-2",
    companySlug: "tenant-run",
    trigger: buildBaseRun().trigger,
    state: "execute",
    startedAt: "2026-04-23T13:00:00.000Z",
    finishedAt: "2026-04-23T13:00:30.000Z",
    diagnostics: [],
    opportunities: [],
    actions: [],
    jobs: [],
    approvals: [],
    policyDecisions: [],
    outcomes: [],
    experiments: [],
    errorMessage: "connector timeout",
    auditReferences: ["audit-2"]
  });

  assert.equal(draft.metrics.totalJobs, 0);
  assert.equal(finalRun.state, "schedule_next_cycle");
  assert.ok(finalRun.summary.includes("tracking"));
  assert.ok(finalRun.nextSuggestedRunAt);
  assert.ok(failedRun.summary.includes("connector timeout"));
});
