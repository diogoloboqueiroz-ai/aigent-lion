import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePolicyDecision } from "../policy-engine";
import type { CompanyContext, PrioritizedAction } from "../types";

function createContext(
  input: {
    connectorReady?: boolean;
    routingMode?: "score_based" | "manual_only";
    captureMode?: "disabled" | "server_secret" | "allowlisted_browser";
    requireConsentForEmail?: boolean;
  } = {}
) {
  return {
    companySlug: "acme",
    companyName: "Acme",
    generatedAt: "2026-04-22T10:00:00.000Z",
    workspace: {
      company: {
        slug: "acme",
        name: "Acme"
      },
      siteOpsProfile: {
        captureMode: input.captureMode ?? "server_secret"
      },
      crmProfile: {
        routingMode: input.routingMode ?? "score_based",
        requireConsentForEmail: input.requireConsentForEmail ?? true
      },
      leads: [
        {
          id: "lead-acme-1",
          stage: "qualified",
          consentStatus: "granted"
        }
      ]
    },
    trigger: {
      id: "trigger-acme",
      companySlug: "acme",
      type: "manual_run",
      actor: "tester",
      summary: "teste",
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
        ready: input.connectorReady ? 1 : 0,
        partial: 0,
        blocked: input.connectorReady ? 0 : 1
      },
      summaries: []
    },
    connectorCapabilities: [
      {
        connector: "meta",
        label: "Meta Ads",
        status: input.connectorReady ? "ready" : "blocked",
        canRead: Boolean(input.connectorReady),
        canWrite: Boolean(input.connectorReady),
        capabilities: ["read_campaigns"],
        note: input.connectorReady ? "Pronto" : "Bloqueado"
      }
    ],
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
  } as unknown as CompanyContext;
}

function createAction(
  input: Partial<PrioritizedAction> & Pick<PrioritizedAction, "type">
): PrioritizedAction {
  return {
    id: "action-1",
    companySlug: "acme",
    opportunityId: "opp-1",
    findingId: "finding-1",
    type: input.type,
    title: "Acao de teste",
    description: "Descricao",
    rationale: "Rationale",
    evidence: input.evidence ?? ["Sinal consistente"],
    targetMetric: "cpa",
    targetPlatform: input.targetPlatform,
    impactScore: 70,
    urgencyScore: 65,
    confidenceScore: 80,
    effortScore: 30,
    compositeScore: 78,
    priority: "high",
    riskScore: {
      score: 40,
      level: "medium",
      factors: ["fator"]
    },
    autonomyMode: "requires_approval",
    params: input.params ?? {}
  };
}

test("blocks an action when evidence is missing", () => {
  const context = createContext({ connectorReady: true });
  const decision = evaluatePolicyDecision(
    context,
    createAction({
      type: "audit_connectors",
      evidence: []
    })
  );

  assert.equal(decision.decision, "blocked");
});

test("auto-executes low-risk sync when connector is ready", () => {
  const context = createContext({ connectorReady: true });
  const decision = evaluatePolicyDecision(
    context,
    createAction({
      type: "queue_social_sync",
      targetPlatform: "meta"
    })
  );

  assert.equal(decision.decision, "auto_execute");
});

test("blocks sync when minimum connector capability is not ready", () => {
  const context = createContext({ connectorReady: false });
  const decision = evaluatePolicyDecision(
    context,
    createAction({
      type: "queue_social_sync",
      targetPlatform: "meta"
    })
  );

  assert.equal(decision.decision, "blocked");
});

test("follow-up can auto-execute when lead autopilot is safe", () => {
  const context = createContext({ connectorReady: true, routingMode: "score_based" });
  const decision = evaluatePolicyDecision(
    context,
    createAction({
      type: "follow_up_leads",
      params: {
        dueLeadCount: 3
      }
    })
  );

  assert.equal(decision.decision, "auto_execute");
});

test("follow-up falls back to approval when CRM routing is manual", () => {
  const context = createContext({ connectorReady: true, routingMode: "manual_only" });
  const decision = evaluatePolicyDecision(
    context,
    createAction({
      type: "follow_up_leads",
      params: {
        dueLeadCount: 3
      }
    })
  );

  assert.equal(decision.decision, "requires_approval");
});

test("budget shifts always require policy review", () => {
  const context = createContext({ connectorReady: true });
  const decision = evaluatePolicyDecision(
    context,
    createAction({
      type: "propose_budget_shift",
      targetPlatform: "meta"
    })
  );

  assert.equal(decision.decision, "policy_review");
});

test("lead follow-up escalates to policy review when consent is missing", () => {
  const context = createContext({ connectorReady: true, requireConsentForEmail: true });
  context.workspace.leads = [
    {
      id: "lead-acme-2",
      stage: "qualified",
      consentStatus: "unknown"
    }
  ] as typeof context.workspace.leads;

  const decision = evaluatePolicyDecision(
    context,
    createAction({
      type: "follow_up_leads",
      params: {
        dueLeadIds: ["lead-acme-2"]
      }
    })
  );

  assert.equal(decision.decision, "policy_review");
  assert.ok(decision.reasonCodes.includes("CONSENT_REVIEW_REQUIRED"));
  assert.ok(decision.requiredApprovers.includes("compliance"));
});

test("draft-only experiments with small budget can still auto-execute", () => {
  const context = createContext({ connectorReady: true });
  const decision = evaluatePolicyDecision(
    context,
    createAction({
      type: "launch_experiment",
      targetPlatform: "meta",
      params: {
        draftOnly: true,
        budget: 0
      }
    })
  );

  assert.equal(decision.decision, "auto_execute");
});

test("large experiment budget escalates to policy review", () => {
  const context = createContext({ connectorReady: true });
  const decision = evaluatePolicyDecision(
    context,
    createAction({
      type: "launch_experiment",
      targetPlatform: "meta",
      params: {
        draftOnly: false,
        budget: "1800"
      }
    })
  );

  assert.equal(decision.decision, "policy_review");
  assert.ok(decision.reasonCodes.includes("BUDGET_POLICY_REVIEW"));
});
