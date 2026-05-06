import test from "node:test";
import assert from "node:assert/strict";
import { buildDecisionProvenanceRecord } from "@/core/audit/decision-provenance";
import type { CompanyContext, PolicyDecision, TriggerEvent, AutomationOutcome } from "@/lib/agents/types";
import type { DecisionCoreTrace } from "@/core/domain/agent-core";

test("decision provenance records what the agent knew and why it decided", () => {
  const context = {
    companySlug: "tenant-a",
    companyName: "Tenant A"
  } as CompanyContext;
  const trigger = {
    id: "trigger-1",
    companySlug: "tenant-a",
    type: "scheduled_cycle",
    actor: "agent",
    summary: "Ciclo",
    createdAt: "2026-04-22T10:00:00.000Z"
  } as TriggerEvent;
  const decisionCore: DecisionCoreTrace = {
    snapshot: {
      id: "snapshot-1",
      tenantId: "tenant-a",
      companyName: "Tenant A",
      generatedAt: "2026-04-22T10:00:00.000Z",
      triggerType: "scheduled_cycle",
      strategySummary: ["Foco em aquisicao"],
      goals: ["Receita"],
      connectorSummary: {
        ready: 1,
        partial: 0,
        blocked: 0
      },
      kpis: []
    },
    signals: [],
    diagnoses: [],
    hypotheses: [],
    candidateActions: [
      {
        id: "action-1",
        tenantId: "tenant-a",
        actionType: "queue_social_sync",
        title: "Sync",
        summary: "Preparar",
        targetMetric: "reach",
        priority: "medium",
        impactScore: 60,
        urgencyScore: 60,
        effortScore: 10,
        confidenceScore: 80,
        compositeScore: 78,
        evidence: ["binding ready"],
        linkedDiagnosisIds: [],
        linkedHypothesisIds: []
      }
    ],
    selectedActionId: "action-1",
    reasons: [
      {
        code: "TOP_COMPOSITE_SCORE",
        summary: "Melhor acao",
        evidence: ["binding ready"]
      }
    ]
  };
  const policyDecisions: PolicyDecision[] = [
    {
      jobId: "job-1",
      companySlug: "tenant-a",
      decision: "auto_execute",
      riskScore: {
        score: 15,
        level: "low",
        factors: []
      },
      rationale: "Seguro",
      reasonCodes: ["LOW_RISK_AUTONOMY_ALLOWED"],
      violatedRules: [],
      requiredApprovers: [],
      confidenceFloor: 0.6,
      escalationMetadata: {}
    }
  ];
  const outcomes: AutomationOutcome[] = [
    {
      jobId: "job-1",
      companySlug: "tenant-a",
      status: "completed",
      summary: "Executado",
      outputs: {},
      startedAt: "2026-04-22T10:00:00.000Z",
      finishedAt: "2026-04-22T10:01:00.000Z",
      auditReferences: []
    }
  ];

  const record = buildDecisionProvenanceRecord({
    context,
    trigger,
    decisionCore,
    policyDecisions,
    outcomes
  });

  assert.equal(record.tenantId, "tenant-a");
  assert.equal(record.selectedActionId, "action-1");
  assert.equal(record.policyDecisions[0]?.status, "AUTO_EXECUTE");
  assert.deepEqual(record.policyDecisions[0]?.reasonCodes, ["LOW_RISK_AUTONOMY_ALLOWED"]);
  assert.equal(record.outcomes[0]?.status, "completed");
});
