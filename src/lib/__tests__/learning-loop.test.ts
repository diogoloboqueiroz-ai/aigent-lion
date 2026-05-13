import assert from "node:assert/strict";
import test from "node:test";
import {
  getCrossTenantLearningPlaybooks,
  getCompanyExperimentOutcomes,
  getCompanyLearningPlaybooks,
  syncCompanyLearningMemory
} from "@/lib/learning";
import type { AutomationRun } from "@/lib/agents/types";
import type { CompanyWorkspace } from "@/lib/domain";

test("learning loop persists playbook candidates from winning experiment outcomes", () => {
  const now = "2026-04-22T10:00:00.000Z";
  process.env.VAULT_ENCRYPTION_KEY = "test-learning-loop-key";
  const workspace = createLearningLoopWorkspace("acme-learning-loop", "Acme Learning Loop", now);

  syncCompanyLearningMemory({
    workspace,
    latestRun: {
      id: "run-learning-loop-1",
      companySlug: "acme-learning-loop",
      trigger: {
        id: "trigger-1",
        companySlug: "acme-learning-loop",
        type: "scheduled_cycle",
        actor: "scheduler",
        summary: "cycle",
        createdAt: now
      },
      state: "learn",
      startedAt: now,
      finishedAt: now,
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
          id: "experiment-acme-learning-loop-meta",
          companySlug: "acme-learning-loop",
          linkedActionId: "action-1",
          title: "Teste A/B em Meta",
          hypothesis: "A vence B",
          primaryMetric: "CPA",
          variants: ["A", "B"],
          status: "planned",
          createdAt: now
        }
      ],
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
      summary: "run",
      auditReferences: [],
      cmoDecision: {
        id: "cmo-1",
        companySlug: "acme-learning-loop",
        dominantConstraint: "acquisition",
        weeklyThesis: "foco",
        primaryBet: "meta",
        supportingBets: [],
        delegatedModules: ["ads"],
        focusMetric: "CPA",
        confidence: 0.8,
        rationale: "ok",
        winningChannels: [],
        losingChannels: [],
        scorecards: workspace.executionPlans[0].optimizationScorecards ?? [],
        recommendedExperiments: [],
        createdAt: now
      }
    },
    experimentResults: [
      {
        id: "experiment-result-experiment-acme-learning-loop-meta",
        companySlug: "acme-learning-loop",
        experimentId: "experiment-acme-learning-loop-meta",
        status: "won",
        summary: "Experimento mostrou sinal de vencedor.",
        winningVariant: "A",
        observedMetrics: [
          { label: "channel", value: "meta" },
          { label: "score", value: "90" }
        ],
        createdAt: now
      }
    ]
  });

  const outcomes = getCompanyExperimentOutcomes("acme-learning-loop");
  const playbooks = getCompanyLearningPlaybooks("acme-learning-loop");

  assert.equal(outcomes[0]?.status, "won");
  assert.equal(outcomes[0]?.version, 1);
  assert.equal(outcomes[0]?.confidenceState, "emerging");
  assert.equal(playbooks[0]?.channel, "meta");
  assert.equal(playbooks[0]?.version, 1);
  assert.ok(playbooks[0]?.recommendedAction.includes("Meta"));
  assert.ok(playbooks[0]?.reuseGuidance.length);
});

test("learning loop only promotes anonymized shared patterns across tenants", () => {
  const now = "2026-04-22T12:00:00.000Z";
  process.env.VAULT_ENCRYPTION_KEY = "test-learning-loop-key";

  const tenants = [
    createLearningLoopWorkspace("alpha-shared-learning", "Alpha Shared Learning", now),
    createLearningLoopWorkspace("beta-shared-learning", "Beta Shared Learning", "2026-04-22T13:00:00.000Z")
  ];

  for (const workspace of tenants) {
    syncCompanyLearningMemory({
      workspace,
      latestRun: buildLearningLoopRun(workspace.company.slug, workspace.company.name, workspace.executionPlans[0]!, now),
      experimentResults: [
        {
          id: `experiment-result-experiment-${workspace.company.slug}-meta`,
          companySlug: workspace.company.slug,
          experimentId: `experiment-${workspace.company.slug}-meta`,
          status: "won",
          summary: "Experimento mostrou sinal de vencedor.",
          winningVariant: "A",
          observedMetrics: [
            { label: "channel", value: "meta" },
            { label: "score", value: "90" }
          ],
          createdAt: now
        }
      ]
    });
  }

  const sharedPlaybooks = getCrossTenantLearningPlaybooks();
  const promoted = sharedPlaybooks.find(
    (playbook) => playbook.channel === "meta" && playbook.sourceTenantCount >= 2 && playbook.status === "active"
  );

  assert.ok(promoted);
  assert.equal(promoted?.learningBoundary, "cross_tenant_safe");
  assert.equal(promoted?.shareability, "shared");
  assert.ok((promoted?.version ?? 0) >= 1);
  assert.ok(!promoted?.summary.includes("alpha-shared-learning"));
  assert.ok(!promoted?.recommendedAction.includes("/empresas/alpha-shared-learning"));
});

function createLearningLoopWorkspace(slug: string, name: string, now: string) {
  return {
    company: {
      slug,
      name
    },
    operationalAlerts: [],
    executionPlans: [
      {
        id: `plan-${slug}`,
        companySlug: slug,
        companyName: name,
        generatedAt: now,
        title: "plan",
        summary: "plan",
        weeklyFocus: [],
        launchChecklist: [],
        approvalQueue: [],
        operatorContext: "ctx",
        recommendedExperiments: [
          {
            id: `experiment-${slug}-meta`,
            title: "Teste A/B em Meta",
            channel: "meta",
            hypothesis: "A vence B",
            primaryMetric: "CPA",
            variants: ["A", "B"],
            status: "planned",
            sourceScorecardId: "scorecard-meta",
            baselineMetricValue: 41,
            successCriteria: "CPA cair",
            observationWindowDays: 7,
            confidence: 0.7,
            nextAction: "testar"
          }
        ],
        recommendedActions: [],
        tracks: [],
        optimizationScorecards: [
          {
            id: "scorecard-meta",
            channel: "meta",
            platform: "meta",
            window: "7d",
            health: "winning",
            decision: "scale",
            score: 90,
            cpa: 30,
            ctr: 0.02,
            revenue: 10000,
            conversionSignalsSent: 5,
            conversionSignalsBlocked: 0,
            conversionSignalsFailed: 0,
            rationale: "boa",
            evidence: ["CPA caiu"]
          }
        ]
      }
    ],
    agentLearnings: [],
    experimentOutcomes: [],
    learningPlaybooks: [],
    socialExecutionLogs: [],
    conversionEvents: [],
    reports: [],
    socialInsights: []
  } as unknown as CompanyWorkspace;
}

function buildLearningLoopRun(
  companySlug: string,
  companyName: string,
  plan: NonNullable<CompanyWorkspace["executionPlans"][0]>,
  now: string
): AutomationRun {
  return {
    id: `run-${companySlug}-1`,
    companySlug,
    trigger: {
      id: `trigger-${companySlug}`,
      companySlug,
      type: "scheduled_cycle",
      actor: "scheduler",
      summary: "cycle",
      createdAt: now
    },
    state: "learn",
    startedAt: now,
    finishedAt: now,
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
        id: `experiment-${companySlug}-meta`,
        companySlug,
        linkedActionId: "action-1",
        title: "Teste A/B em Meta",
        hypothesis: "A vence B",
        primaryMetric: "CPA",
        variants: ["A", "B"],
        status: "planned",
        createdAt: now
      }
    ],
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
    summary: "run",
    auditReferences: [],
    cmoDecision: {
      id: `cmo-${companySlug}`,
      companySlug,
      dominantConstraint: "acquisition",
      weeklyThesis: `foco ${companyName}`,
      primaryBet: "meta",
      supportingBets: [],
      delegatedModules: ["ads"],
      focusMetric: "CPA",
      confidence: 0.8,
      rationale: "ok",
      winningChannels: [],
      losingChannels: [],
      scorecards: plan.optimizationScorecards ?? [],
      recommendedExperiments: [],
      createdAt: now
    }
  };
}
