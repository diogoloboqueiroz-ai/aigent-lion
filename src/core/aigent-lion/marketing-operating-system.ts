import type { AigentLionIntelligenceContext } from "@/core/aigent-lion/types";

export type MarketingOperatingSystemStatus = {
  companySlug: string;
  status: "operational" | "attention_required" | "critical";
  brainState: string;
  growthRadar: Array<{
    area: string;
    signal: string;
    severity: string;
  }>;
  operatingCadence: string[];
  autonomyModeRecommendation: "advisory" | "auto_low_risk" | "approval_required";
};

export function buildMarketingOperatingSystemStatus(
  context: AigentLionIntelligenceContext
): MarketingOperatingSystemStatus {
  const criticalFindings = context.diagnosticFindings.filter(
    (finding) => finding.severity === "critical" || finding.severity === "high"
  );
  const blockedPolicies = context.policyDecisions.filter((entry) => entry.policy.status === "BLOCK");
  const runtimeCritical = context.controlTower.health.runtimeStatus === "critical";

  return {
    companySlug: context.workspace.company.slug,
    status:
      runtimeCritical || blockedPolicies.length > 0
        ? "critical"
        : criticalFindings.length > 0
          ? "attention_required"
          : "operational",
    brainState: `${context.cmoDecision.dominantConstraint} -> ${context.cmoDecision.primaryBet}`,
    growthRadar: context.diagnosticFindings.slice(0, 6).map((finding) => ({
      area: finding.area,
      signal: finding.summary,
      severity: finding.severity
    })),
    operatingCadence: [
      "Read context and metrics.",
      "Diagnose dominant constraint.",
      "Route specialists.",
      "Generate campaign/creative/analytics artifacts.",
      "Evaluate policy before execution.",
      "Feed outcomes back into learning memory."
    ],
    autonomyModeRecommendation:
      blockedPolicies.length > 0 || criticalFindings.length > 1
        ? "approval_required"
        : context.controlTower.health.trustScore >= 72
          ? "auto_low_risk"
          : "advisory"
  };
}
