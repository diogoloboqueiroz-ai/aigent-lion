import type {
  CompanyContext,
  ExecutionJob,
  PolicyDecision,
  PrioritizedAction,
  RiskScore
} from "@/lib/agents/types";
import { buildRuntimeJobId } from "@/core/runtime/job-planner";
import {
  evaluateCorePolicyDecision,
  estimateCoreRiskScoreForAction,
  mapCorePolicyStatusToAutonomyMode
} from "@/core/policy/policy-engine";
import { getActivePersistedCompanyPolicyMatrix } from "@/infrastructure/persistence/company-policy-storage";

export function buildAgentJobId(actionId: string) {
  return buildRuntimeJobId(actionId);
}

export function estimateRiskScoreForAction(
  action: Pick<PrioritizedAction, "type" | "evidence" | "targetPlatform">
): RiskScore {
  return estimateCoreRiskScoreForAction(action);
}

export function evaluatePolicyDecisions(context: CompanyContext, actions: PrioritizedAction[]) {
  const decisions = actions.map((action) => evaluatePolicyDecision(context, action));
  const decisionByJobId = new Map(decisions.map((decision) => [decision.jobId, decision]));
  const nextActions = actions.map((action) => {
    const decision = decisionByJobId.get(buildAgentJobId(action.id));

    if (!decision) {
      return action;
    }

    return {
      ...action,
      riskScore: decision.riskScore,
      autonomyMode: decision.decision
    };
  });

  return {
    actions: nextActions,
    decisions
  };
}

export function evaluatePolicyDecision(
  context: CompanyContext,
  subject: PrioritizedAction | ExecutionJob
): PolicyDecision {
  const jobId = "actionId" in subject ? buildAgentJobId(subject.id) : subject.id;
  const riskScore = "actionId" in subject ? subject.riskScore : estimateRiskScoreForAction(subject);
  const policyMatrix = getActivePersistedCompanyPolicyMatrix(subject.companySlug);
  const coreDecision = evaluateCorePolicyDecision(context, subject, riskScore, policyMatrix);

  return {
    jobId,
    companySlug: subject.companySlug,
    decision: mapCorePolicyStatusToAutonomyMode(coreDecision.status),
    riskScore,
    rationale: coreDecision.rationale,
    reasonCodes: coreDecision.reasonCodes,
    violatedRules: coreDecision.violatedRules,
    requiredApprovers: coreDecision.requiredApprovers,
    confidenceFloor: coreDecision.confidenceFloor,
    escalationMetadata: coreDecision.escalationMetadata,
    requiredApprovalMode:
      coreDecision.status === "REQUIRE_APPROVAL"
        ? "requires_approval"
        : coreDecision.status === "REQUIRE_POLICY_REVIEW"
          ? "policy_review"
          : undefined
  };
}
