export {
  getCorePolicyRule as getAgentPolicyRule,
  listCorePolicyRules as listAgentPolicyRules
} from "@/core/policy/policy-registry";
import { listCorePolicyRules } from "@/core/policy/policy-registry";

export type { CorePolicyRule as AgentPolicyRule } from "@/core/policy/policy-registry";

export function buildAgentPolicyRegistrySummary() {
  return listCorePolicyRules().map((rule) => ({
    actionType: rule.actionType,
    label: rule.label,
    category: rule.category,
    defaultDecision: rule.defaultDecision,
    spendSensitive: rule.spendSensitive ?? false,
    tenantSpendCapSensitive: rule.tenantSpendCapSensitive ?? false,
    requiresConnectorReadiness: rule.requiresConnectorReadiness ?? false,
    allowsDraftOnlyAuto: rule.allowsDraftOnlyAuto ?? false,
    allowsLeadAutopilot: rule.allowsLeadAutopilot ?? false,
    claimRiskProfile: rule.claimRiskProfile ?? "none",
    approvalApprovers: rule.approvalApprovers ?? [],
    policyReviewApprovers: rule.policyReviewApprovers ?? []
  }));
}
