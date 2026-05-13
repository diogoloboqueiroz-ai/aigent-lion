import type { AutomationOutcome, CompanyContext, PolicyDecision, TriggerEvent } from "@/lib/agents/types";
import type { DecisionCoreTrace, DecisionProvenanceRecord } from "@/core/domain/agent-core";

type BuildDecisionProvenanceInput = {
  context: CompanyContext;
  trigger: TriggerEvent;
  decisionCore: DecisionCoreTrace;
  policyDecisions: PolicyDecision[];
  outcomes: AutomationOutcome[];
};

export function buildDecisionProvenanceRecord(
  input: BuildDecisionProvenanceInput
): DecisionProvenanceRecord {
  return {
    id: `decision-provenance-${input.context.companySlug}-${Date.now()}`,
    tenantId: input.context.companySlug,
    generatedAt: new Date().toISOString(),
    trigger: {
      id: input.trigger.id,
      type: input.trigger.type,
      actor: input.trigger.actor,
      summary: input.trigger.summary
    },
    contextSnapshot: input.decisionCore.snapshot,
    signals: input.decisionCore.signals,
    diagnoses: input.decisionCore.diagnoses,
    hypotheses: input.decisionCore.hypotheses,
    candidateActions: input.decisionCore.candidateActions,
    selectedActionId: input.decisionCore.selectedActionId,
    decisionReasons: input.decisionCore.reasons,
    policyDecisions: input.policyDecisions.map((decision) => ({
      jobId: decision.jobId,
      status: mapPolicyDecisionStatus(decision.decision),
      reasonCodes:
        decision.reasonCodes.length > 0
          ? decision.reasonCodes
          : [decision.requiredApprovalMode ?? decision.decision]
    })),
    outcomes: input.outcomes.map((outcome) => ({
      jobId: outcome.jobId,
      status: outcome.status,
      summary: outcome.summary
    })),
    version: "phase-7-production-policy"
  };
}

function mapPolicyDecisionStatus(decision: PolicyDecision["decision"]) {
  switch (decision) {
    case "auto_execute":
      return "AUTO_EXECUTE" as const;
    case "requires_approval":
      return "REQUIRE_APPROVAL" as const;
    case "policy_review":
      return "REQUIRE_POLICY_REVIEW" as const;
    default:
      return "BLOCK" as const;
  }
}
