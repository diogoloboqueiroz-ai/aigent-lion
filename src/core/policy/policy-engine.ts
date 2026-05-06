import type {
  CompanyContext,
  ExecutionJob,
  PrioritizedAction,
  RiskScore
} from "@/lib/agents/types";
import type { AutonomyMode } from "@/lib/agents/types";
import type { AutonomyScore, CorePolicyDecision, RiskAssessment } from "@/core/domain/agent-core";
import { getCorePolicyRule } from "@/core/policy/policy-registry";
import type {
  CompanyPolicyMatrix,
  CompanyPolicyMatrixActionRule
} from "@/lib/domain";

const BASE_RISK_BY_ACTION: Record<PrioritizedAction["type"], number> = {
  review_approvals: 55,
  stabilize_runtime: 30,
  queue_social_sync: 20,
  stabilize_tracking: 35,
  follow_up_leads: 60,
  prepare_growth_report: 15,
  launch_experiment: 58,
  refresh_creatives: 52,
  audit_connectors: 22,
  propose_budget_shift: 82,
  pause_underperforming_channel: 78
};

type SubjectInputs = Record<string, unknown>;
type TenantCommercialCompliance = {
  blockedSources: Set<string>;
  approvedSources: Set<string>;
  blockedPhrases: string[];
  reviewPhrases: string[];
};

const FORBIDDEN_MARKETING_CLAIM_PATTERNS = [
  /\b(?:100%\s*)?garantid[oa]s?\b/i,
  /\bresultado[s]?\s+garantid[oa]s?\b/i,
  /\blucro\s+garantid[oa]\b/i,
  /\bsem\s+risco\b/i,
  /\bcura\b/i,
  /\bmilagre\b/i
];

const SENSITIVE_MARKETING_CLAIM_PATTERNS = [
  /\bantes\s+e\s+depois\b/i,
  /\bpromessa\b/i,
  /\bsem\s+esforco\b/i,
  /\btriplicar\b/i,
  /\bdobrar\b/i,
  /\bcomprovad[oa]\b/i
];

export function estimateCoreRiskScoreForAction(
  action: Pick<PrioritizedAction, "type" | "evidence" | "targetPlatform">
): RiskScore {
  const evidenceDiscount = Math.min(12, action.evidence.length * 2);
  const platformPremium = action.targetPlatform === "google-ads" || action.targetPlatform === "meta" ? 8 : 0;
  const score = Math.max(0, Math.min(100, BASE_RISK_BY_ACTION[action.type] + platformPremium - evidenceDiscount));

  return {
    score,
    level: score >= 80 ? "critical" : score >= 65 ? "high" : score >= 40 ? "medium" : "low",
    factors: [
      `Tipo de acao: ${action.type}.`,
      action.targetPlatform ? `Plataforma alvo: ${action.targetPlatform}.` : "Acao sem plataforma unica.",
      `${action.evidence.length} evidencias disponiveis para justificativa.`
    ]
  };
}

export function evaluateCorePolicyDecision(
  context: CompanyContext,
  subject: PrioritizedAction | ExecutionJob,
  riskScore?: RiskScore,
  policyMatrix?: CompanyPolicyMatrix
): CorePolicyDecision {
  const inputs = getSubjectInputs(subject);
  const connectorHealthy = hasMinimumCapability(context, subject.targetPlatform);
  const confidenceScore = getSubjectConfidenceScore(subject);
  const policyMatrixRule = resolvePolicyMatrixActionRule(policyMatrix, subject.type);
  const rule = applyPolicyMatrixToRule(
    getCorePolicyRule(subject.type),
    policyMatrix,
    policyMatrixRule
  );
  const effectiveRiskScore =
    riskScore ?? ("riskScore" in subject ? subject.riskScore : estimateCoreRiskScoreForAction(subject));
  const draftOnly = isDraftOnlyAction(inputs);
  const tenantCompliance = inferTenantCommercialCompliance(context, policyMatrix, policyMatrixRule);
  const subjectSources = inferSubjectCommercialSources(inputs, subject.targetPlatform);
  const blockedSourceMatches = subjectSources.filter((source) =>
    tenantCompliance.blockedSources.has(normalizeComplianceToken(source))
  );
  const unapprovedSourceMatches =
    tenantCompliance.approvedSources.size > 0
      ? subjectSources.filter(
          (source) => !tenantCompliance.approvedSources.has(normalizeComplianceToken(source))
        )
      : [];
  const tenantPhraseRisk = inferTenantPhraseRisk(inputs, tenantCompliance);
  const consentRisk = rule.requiresExplicitConsent ? hasConsentRisk(context, inputs) : false;
  const budgetAmount = inferBudgetAmount(inputs);
  const tenantSpendCap = inferTenantSpendCap(context);
  const tenantSpendCapExceeded =
    rule.tenantSpendCapSensitive === true &&
    typeof budgetAmount === "number" &&
    typeof tenantSpendCap === "number" &&
    budgetAmount > tenantSpendCap;
  const blastRadius = inferBlastRadius(rule.blastRadius, rule.channelScope, inputs, subject.targetPlatform);
  const claimRisk = inferClaimRisk(inputs, policyMatrix, policyMatrixRule);
  const autonomyScore = buildAutonomyScore({
    ruleDecision: rule.defaultDecision,
    connectorHealthy,
    confidenceScore,
    riskScore: effectiveRiskScore.score,
    spendSensitive: rule.spendSensitive ?? false,
    evidenceCount: subject.evidence.length,
    isDraftOnly: draftOnly,
    budgetAmount,
    tenantSpendCapExceeded,
    blastRadius,
    complianceTier: rule.complianceTier,
    consentRisk,
    sensitiveClaimRisk: claimRisk.sensitive,
    forbiddenClaimsDetected: claimRisk.forbidden
  });

  let status = mapAutonomyClassificationToStatus(autonomyScore.classification);
  const reasonCodes: string[] = [];
  const violatedRules: string[] = [];

  if (policyMatrix?.status === "active") {
    reasonCodes.push("TENANT_POLICY_MATRIX_ACTIVE");
  }

  if (policyMatrixRule?.decisionOverride === "blocked") {
    reasonCodes.push("TENANT_POLICY_BLOCK");
    violatedRules.push("tenant_policy_matrix_block");
    status = "BLOCK";
  }

  if (subject.evidence.length === 0) {
    reasonCodes.push("NO_EVIDENCE");
    violatedRules.push("minimum_evidence_required");
    status = "BLOCK";
  }

  if ((rule.requiresConnectorReadiness ?? false) && !connectorHealthy) {
    reasonCodes.push("CONNECTOR_NOT_READY");
    violatedRules.push("connector_readiness_required");
    status = "BLOCK";
  }

  if (rule.defaultDecision === "policy_review") {
    reasonCodes.push("POLICY_REVIEW_REQUIRED");
    status = "REQUIRE_POLICY_REVIEW";
  }

  if (rule.defaultDecision === "requires_approval" && rule.allowsDraftOnlyAuto && draftOnly) {
    reasonCodes.push("DRAFT_ONLY_SAFE");
    status = "AUTO_EXECUTE";
  }

  if (rule.defaultDecision === "requires_approval" && rule.allowsLeadAutopilot && isLeadAutopilotSafe(context, inputs)) {
    reasonCodes.push("LEAD_AUTOPILOT_SAFE");
    status = "AUTO_EXECUTE";
  }

  if (consentRisk) {
    reasonCodes.push("CONSENT_REVIEW_REQUIRED");
    violatedRules.push("explicit_consent_required");
    status = "REQUIRE_POLICY_REVIEW";
  }

  if (claimRisk.forbidden) {
    reasonCodes.push("FORBIDDEN_MARKETING_CLAIM");
    violatedRules.push("forbidden_marketing_claim");
    status = "BLOCK";
  } else if (
    claimRisk.sensitive &&
    rule.claimRiskProfile !== "none" &&
    status !== "BLOCK"
  ) {
    reasonCodes.push("SENSITIVE_MARKETING_CLAIM");
    violatedRules.push("marketing_claim_review");
    status = rule.claimRiskProfile === "compliance" ? "REQUIRE_POLICY_REVIEW" : "REQUIRE_APPROVAL";
  }

  if (blockedSourceMatches.length > 0) {
    reasonCodes.push("TENANT_BLOCKED_SOURCE");
    violatedRules.push("tenant_blocked_data_source");
    status = "BLOCK";
  }

  if (tenantPhraseRisk.blocked.length > 0 && status !== "BLOCK") {
    reasonCodes.push("TENANT_BLOCKED_MARKETING_CLAIM");
    violatedRules.push("tenant_compliance_note_block");
    status = "BLOCK";
  }

  if (unapprovedSourceMatches.length > 0 && status !== "BLOCK") {
    reasonCodes.push("TENANT_UNAPPROVED_SOURCE");
    violatedRules.push("tenant_approved_sources_only");
    status = "REQUIRE_APPROVAL";
  }

  if (tenantPhraseRisk.review.length > 0 && status !== "BLOCK") {
    reasonCodes.push("TENANT_COMPLIANCE_REVIEW");
    violatedRules.push("tenant_compliance_note_review");
    status = "REQUIRE_POLICY_REVIEW";
  }

  if (
    typeof rule.policyReviewAboveBudget === "number" &&
    budgetAmount !== undefined &&
    budgetAmount >= rule.policyReviewAboveBudget
  ) {
    reasonCodes.push("BUDGET_POLICY_REVIEW");
    violatedRules.push("budget_policy_review_threshold");
    status = "REQUIRE_POLICY_REVIEW";
  } else if (
    typeof rule.requireApprovalAboveBudget === "number" &&
    budgetAmount !== undefined &&
    budgetAmount >= rule.requireApprovalAboveBudget &&
    status !== "BLOCK" &&
    status !== "REQUIRE_POLICY_REVIEW"
  ) {
    reasonCodes.push("BUDGET_APPROVAL_REQUIRED");
    violatedRules.push("budget_approval_threshold");
    status = "REQUIRE_APPROVAL";
  }

  if (tenantSpendCapExceeded && status !== "BLOCK") {
    reasonCodes.push("TENANT_SPEND_CAP_EXCEEDED");
    violatedRules.push("tenant_spend_cap");
    status = "REQUIRE_POLICY_REVIEW";
  }

  const confidenceFloor = normalizeConfidenceFloor(rule.autoExecuteConfidenceFloor ?? 60);
  const confidenceValue = normalizeConfidenceFloor(confidenceScore);

  if (
    status === "AUTO_EXECUTE" &&
    confidenceValue < confidenceFloor
  ) {
    reasonCodes.push("CONFIDENCE_BELOW_FLOOR");
    violatedRules.push("confidence_floor");
    status = blastRadius === "tenant_wide" || rule.complianceTier === "financial_change"
      ? "REQUIRE_POLICY_REVIEW"
      : "REQUIRE_APPROVAL";
  }

  if (
    status === "AUTO_EXECUTE" &&
    (blastRadius === "cross_channel" || blastRadius === "tenant_wide") &&
    !draftOnly
  ) {
    reasonCodes.push("BLAST_RADIUS_ESCALATION");
    violatedRules.push("blast_radius_guardrail");
    status = rule.spendSensitive || rule.complianceTier === "financial_change"
      ? "REQUIRE_POLICY_REVIEW"
      : "REQUIRE_APPROVAL";
  }

  if (status === "AUTO_EXECUTE" && (effectiveRiskScore.level === "high" || effectiveRiskScore.level === "critical")) {
    reasonCodes.push("RISK_ESCALATION");
    violatedRules.push("risk_level_guardrail");
    status = effectiveRiskScore.level === "critical" || rule.spendSensitive
      ? "REQUIRE_POLICY_REVIEW"
      : "REQUIRE_APPROVAL";
  }

  if (rule.defaultDecision === "requires_approval" && status !== "AUTO_EXECUTE" && status !== "BLOCK" && status !== "REQUIRE_POLICY_REVIEW") {
    reasonCodes.push("HUMAN_APPROVAL_REQUIRED");
    status = "REQUIRE_APPROVAL";
  }

  if (status === "AUTO_EXECUTE") {
    reasonCodes.push("LOW_RISK_AUTONOMY_ALLOWED");
  }

  if (effectiveRiskScore.level === "critical") {
    reasonCodes.push("CRITICAL_RISK_SCORE");
  }

  if (policyMatrixRule?.decisionOverride === "blocked") {
    status = "BLOCK";
  }

  return {
    jobId: "actionId" in subject ? `agent-job-${subject.id}` : subject.id,
    tenantId: subject.companySlug,
    status,
    reasonCodes: dedupeValues(reasonCodes),
    violatedRules: dedupeValues(violatedRules),
    requiredApprovers: resolveRequiredApprovers(rule, status, {
      tenantSpendCapExceeded,
      consentRisk,
      claimRisk
    }),
    confidenceFloor,
    escalationMetadata: {
      category: rule.category,
      spendSensitive: rule.spendSensitive ?? false,
      draftOnly,
      connectorHealthy,
      channelScope: rule.channelScope,
      complianceTier: rule.complianceTier,
      blastRadius,
      budgetAmount,
      tenantSpendCap,
      tenantSpendCapExceeded,
      consentRisk,
      claimRisk,
      confidenceScore: confidenceValue,
      blockedSourceMatches,
      unapprovedSourceMatches,
      tenantPhraseMatches: tenantPhraseRisk
    },
    autonomyScore,
    rationale: buildRationale(rule.label, status, dedupeValues(reasonCodes), effectiveRiskScore, {
      blastRadius,
      budgetAmount,
      complianceTier: rule.complianceTier,
      tenantSpendCap,
      claimRisk
      ,
      tenantCompliance: {
        blockedSourceMatches,
        unapprovedSourceMatches,
        tenantPhraseRisk
      }
    })
  };
}

export function mapCorePolicyStatusToAutonomyMode(status: CorePolicyDecision["status"]): AutonomyMode {
  switch (status) {
    case "AUTO_EXECUTE":
      return "auto_execute";
    case "REQUIRE_APPROVAL":
      return "requires_approval";
    case "REQUIRE_POLICY_REVIEW":
      return "policy_review";
    default:
      return "blocked";
  }
}

function buildAutonomyScore(input: {
  ruleDecision: "auto_execute" | "requires_approval" | "policy_review";
  connectorHealthy: boolean;
  confidenceScore: number;
  riskScore: number;
  spendSensitive: boolean;
  evidenceCount: number;
  isDraftOnly: boolean;
  budgetAmount?: number;
  tenantSpendCapExceeded: boolean;
  blastRadius: "single_task" | "single_channel" | "cross_channel" | "tenant_wide";
  complianceTier: "operational" | "customer_contact" | "marketing_content" | "financial_change";
  consentRisk: boolean;
  sensitiveClaimRisk: boolean;
  forbiddenClaimsDetected: boolean;
}): AutonomyScore {
  const components: RiskAssessment = {
    reversibility: input.isDraftOnly ? 95 : input.ruleDecision === "auto_execute" ? 80 : 42,
    historicalSuccess: input.evidenceCount >= 3 ? 72 : 48,
    policyClarity: input.ruleDecision === "auto_execute" ? 88 : input.ruleDecision === "requires_approval" ? 64 : 40,
    connectorHealth: input.connectorHealthy ? 90 : 20,
    confidence: Math.max(0, Math.min(100, input.confidenceScore)),
    blastRadius: mapBlastRadiusScore(input.blastRadius),
    financialExposure: mapFinancialExposureScore(input),
    reputationalRisk: mapReputationalRiskScore(input),
    complianceRisk: mapComplianceRiskScore(input)
  };

  const score = Math.round(
    components.reversibility * 0.18 +
      components.historicalSuccess * 0.14 +
      components.policyClarity * 0.16 +
      components.connectorHealth * 0.18 +
      components.confidence * 0.14 +
      components.blastRadius * 0.1 +
      components.financialExposure * 0.04 +
      components.reputationalRisk * 0.03 +
      components.complianceRisk * 0.03 -
      input.riskScore * 0.15
  );

  if (input.ruleDecision === "policy_review") {
    return {
      score,
      classification: "policy_review",
      components
    };
  }

  if (!input.connectorHealthy || input.evidenceCount === 0) {
    return {
      score,
      classification: "blocked",
      components
    };
  }

  if (input.forbiddenClaimsDetected) {
    return {
      score,
      classification: "blocked",
      components
    };
  }

  if (input.tenantSpendCapExceeded || input.sensitiveClaimRisk) {
    return {
      score,
      classification: input.tenantSpendCapExceeded ? "policy_review" : "require_approval",
      components
    };
  }

  if (score >= 75 && input.ruleDecision === "auto_execute") {
    return {
      score,
      classification: "auto_execute",
      components
    };
  }

  if (score >= 60 && input.ruleDecision === "auto_execute") {
    return {
      score,
      classification: "execute_with_notification",
      components
    };
  }

  return {
    score,
    classification: "require_approval",
    components
  };
}

function mapAutonomyClassificationToStatus(classification: AutonomyScore["classification"]) {
  switch (classification) {
    case "auto_execute":
    case "execute_with_notification":
      return "AUTO_EXECUTE" as const;
    case "policy_review":
      return "REQUIRE_POLICY_REVIEW" as const;
    case "require_approval":
      return "REQUIRE_APPROVAL" as const;
    default:
      return "BLOCK" as const;
  }
}

function hasMinimumCapability(context: CompanyContext, targetPlatform?: PrioritizedAction["targetPlatform"]) {
  if (!targetPlatform) {
    return context.connectorCapabilities.some((capability) => capability.status !== "blocked");
  }

  return context.connectorCapabilities.some(
    (capability) =>
      capability.connector === targetPlatform && capability.status === "ready" && capability.canRead
  );
}

function getSubjectInputs(subject: PrioritizedAction | ExecutionJob) {
  return ("actionId" in subject ? subject.inputs : subject.params) ?? {};
}

function getSubjectConfidenceScore(subject: PrioritizedAction | ExecutionJob) {
  return "confidenceScore" in subject ? subject.confidenceScore : 70;
}

function isDraftOnlyAction(inputs: SubjectInputs) {
  return inputs.draftOnly === true;
}

function isLeadAutopilotSafe(context: CompanyContext, inputs: SubjectInputs) {
  const dueLeadCount =
    typeof inputs.dueLeadCount === "number"
      ? inputs.dueLeadCount
      : context.workspace.leads.filter(
          (lead) =>
            lead.stage !== "won" &&
            lead.stage !== "lost" &&
            (!lead.nextFollowUpAt || lead.nextFollowUpAt <= new Date().toISOString())
        ).length;

  return dueLeadCount > 0 && context.workspace.crmProfile.routingMode !== "manual_only";
}

function hasConsentRisk(context: CompanyContext, inputs: SubjectInputs) {
  if (!context.workspace.crmProfile.requireConsentForEmail) {
    return false;
  }

  if (inputs.skipConsentCheck === true) {
    return false;
  }

  if (typeof inputs.dueLeadIds === "object" && Array.isArray(inputs.dueLeadIds)) {
    const dueLeadIds = new Set(inputs.dueLeadIds.map((entry) => String(entry)));
    return context.workspace.leads.some(
      (lead) =>
        dueLeadIds.has(lead.id) &&
        lead.stage !== "won" &&
        lead.stage !== "lost" &&
        lead.consentStatus !== "granted"
    );
  }

  return context.workspace.leads.some(
    (lead) =>
      lead.stage !== "won" &&
      lead.stage !== "lost" &&
      (!lead.nextFollowUpAt || lead.nextFollowUpAt <= new Date().toISOString()) &&
      lead.consentStatus !== "granted"
  );
}

function inferBudgetAmount(inputs: SubjectInputs) {
  const candidates = [
    inputs.budget,
    inputs.requestedBudget,
    inputs.dailyBudget,
    inputs.budgetAmount,
    inputs.spendAmount,
    inputs.monthlyBudget
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0) {
      return candidate;
    }

    if (typeof candidate === "string") {
      const match = candidate.trim().match(/-?\d[\d.,]*/);
      if (!match) {
        continue;
      }

      const parsed = Number(match[0].replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  }

  return undefined;
}

function inferTenantSpendCap(context: CompanyContext) {
  const spendCap = context.workspace.paymentProfile?.spendCap;
  if (typeof spendCap !== "string" || !spendCap.trim()) {
    return undefined;
  }

  const match = spendCap.match(/-?\d[\d.,]*/);
  if (!match) {
    return undefined;
  }

  const parsed = Number(match[0].replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function inferBlastRadius(
  baseline: "single_task" | "single_channel" | "cross_channel" | "tenant_wide",
  channelScope: "internal" | "crm" | "site" | "social" | "ads" | "cross_channel",
  inputs: SubjectInputs,
  targetPlatform?: PrioritizedAction["targetPlatform"]
) {
  if (inputs.tenantWide === true || inputs.affectsAllChannels === true) {
    return "tenant_wide" as const;
  }

  if (inputs.crossChannel === true || inputs.multiChannel === true) {
    return "cross_channel" as const;
  }

  if (!targetPlatform && baseline === "single_channel" && (channelScope === "social" || channelScope === "ads")) {
    return "cross_channel" as const;
  }

  return baseline;
}

function mapBlastRadiusScore(blastRadius: "single_task" | "single_channel" | "cross_channel" | "tenant_wide") {
  switch (blastRadius) {
    case "single_task":
      return 92;
    case "single_channel":
      return 74;
    case "cross_channel":
      return 46;
    default:
      return 24;
  }
}

function mapFinancialExposureScore(input: {
  spendSensitive: boolean;
  budgetAmount?: number;
  tenantSpendCapExceeded: boolean;
}) {
  if (input.tenantSpendCapExceeded) {
    return 8;
  }

  if (typeof input.budgetAmount === "number" && input.budgetAmount > 0) {
    return input.budgetAmount >= 1500 ? 18 : input.budgetAmount >= 250 ? 34 : 52;
  }

  return input.spendSensitive ? 24 : 82;
}

function mapReputationalRiskScore(input: {
  isDraftOnly: boolean;
  complianceTier: "operational" | "customer_contact" | "marketing_content" | "financial_change";
  sensitiveClaimRisk: boolean;
  forbiddenClaimsDetected: boolean;
}) {
  if (input.forbiddenClaimsDetected) {
    return 6;
  }

  if (input.sensitiveClaimRisk) {
    return 18;
  }

  if (input.isDraftOnly) {
    return 86;
  }

  switch (input.complianceTier) {
    case "customer_contact":
      return 38;
    case "marketing_content":
      return 56;
    case "financial_change":
      return 42;
    default:
      return 74;
  }
}

function mapComplianceRiskScore(input: {
  complianceTier: "operational" | "customer_contact" | "marketing_content" | "financial_change";
  consentRisk: boolean;
  sensitiveClaimRisk: boolean;
  forbiddenClaimsDetected: boolean;
}) {
  if (input.forbiddenClaimsDetected) {
    return 4;
  }

  if (input.consentRisk) {
    return 18;
  }

  if (input.sensitiveClaimRisk) {
    return 24;
  }

  switch (input.complianceTier) {
    case "financial_change":
      return 32;
    case "customer_contact":
      return 40;
    case "marketing_content":
      return 56;
    default:
      return 76;
  }
}

function resolveRequiredApprovers(
  rule: ReturnType<typeof getCorePolicyRule>,
  status: CorePolicyDecision["status"],
  input?: {
    tenantSpendCapExceeded?: boolean;
    consentRisk?: boolean;
    claimRisk?: {
      sensitive: boolean;
      forbidden: boolean;
    };
  }
) {
  if (status === "AUTO_EXECUTE" || status === "BLOCK") {
    return [];
  }

  const baseApprovers =
    status === "REQUIRE_POLICY_REVIEW"
      ? rule.policyReviewApprovers ?? rule.approvalApprovers ?? []
      : rule.approvalApprovers ?? [];
  const dynamicApprovers = new Set(baseApprovers);

  if (input?.tenantSpendCapExceeded || rule.spendSensitive || rule.tenantSpendCapSensitive) {
    for (const approver of rule.financeApprovers ?? ["finance_owner"]) {
      dynamicApprovers.add(approver);
    }
  }

  if (input?.consentRisk || rule.complianceTier === "customer_contact") {
    for (const approver of rule.complianceApprovers ?? []) {
      dynamicApprovers.add(approver);
    }
  }

  if (input?.claimRisk?.sensitive && rule.claimRiskProfile === "brand") {
    for (const approver of rule.brandApprovers ?? ["brand_owner"]) {
      dynamicApprovers.add(approver);
    }
  }

  if (input?.claimRisk?.sensitive && rule.claimRiskProfile === "compliance") {
    for (const approver of rule.complianceApprovers ?? ["compliance"]) {
      dynamicApprovers.add(approver);
    }
  }

  return Array.from(dynamicApprovers);
}

function normalizeConfidenceFloor(score: number) {
  return Math.max(0, Math.min(1, score / 100));
}

function buildRationale(
  label: string,
  status: CorePolicyDecision["status"],
  reasonCodes: string[],
  riskScore: RiskScore,
  metadata: {
    blastRadius: "single_task" | "single_channel" | "cross_channel" | "tenant_wide";
    budgetAmount?: number;
    tenantSpendCap?: number;
    complianceTier: "operational" | "customer_contact" | "marketing_content" | "financial_change";
    claimRisk: {
      sensitive: boolean;
      forbidden: boolean;
      matchedPatterns: string[];
    };
    tenantCompliance: {
      blockedSourceMatches: string[];
      unapprovedSourceMatches: string[];
      tenantPhraseRisk: {
        blocked: string[];
        review: string[];
      };
    };
  }
) {
  const budgetContext =
    typeof metadata.budgetAmount === "number" ? ` Budget considerado: ${metadata.budgetAmount}.` : "";
  const spendCapContext =
    typeof metadata.tenantSpendCap === "number"
      ? ` Spend cap do tenant: ${metadata.tenantSpendCap}.`
      : "";
  const claimContext =
    metadata.claimRisk.forbidden
      ? ` Foram detectadas claims proibidas: ${metadata.claimRisk.matchedPatterns.join(", ")}.`
      : metadata.claimRisk.sensitive
        ? ` Foram detectadas claims sensiveis: ${metadata.claimRisk.matchedPatterns.join(", ")}.`
        : "";
  const tenantComplianceContext =
    metadata.tenantCompliance.blockedSourceMatches.length > 0
      ? ` Fontes bloqueadas pelo tenant: ${metadata.tenantCompliance.blockedSourceMatches.join(", ")}.`
      : metadata.tenantCompliance.unapprovedSourceMatches.length > 0
        ? ` Fontes fora da allowlist do tenant: ${metadata.tenantCompliance.unapprovedSourceMatches.join(", ")}.`
        : metadata.tenantCompliance.tenantPhraseRisk.blocked.length > 0
          ? ` Claims bloqueadas pela nota comercial do tenant: ${metadata.tenantCompliance.tenantPhraseRisk.blocked.join(", ")}.`
          : metadata.tenantCompliance.tenantPhraseRisk.review.length > 0
            ? ` Claims que exigem policy review pelo tenant: ${metadata.tenantCompliance.tenantPhraseRisk.review.join(", ")}.`
            : "";

  return `${label} recebeu status ${status} com risco ${riskScore.level} (${riskScore.score}/100), blast radius ${metadata.blastRadius} e tier ${metadata.complianceTier}.${budgetContext}${spendCapContext}${claimContext}${tenantComplianceContext} Motivos: ${reasonCodes.join(", ") || "DEFAULT_POLICY"}.`;
}

function dedupeValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildLiteralPatterns(values: string[]) {
  return dedupeValues(values)
    .filter((value) => value.trim().length >= 3)
    .map((value) => new RegExp(escapeRegExp(value.trim()), "i"));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inferClaimRisk(
  inputs: SubjectInputs,
  policyMatrix?: CompanyPolicyMatrix,
  policyMatrixRule?: CompanyPolicyMatrixActionRule
) {
  const texts = collectTextValues(inputs);
  const forbiddenPatterns = [
    ...FORBIDDEN_MARKETING_CLAIM_PATTERNS,
    ...buildLiteralPatterns([
      ...(policyMatrix?.globalForbiddenClaimPatterns ?? []),
      ...(policyMatrixRule?.forbiddenClaimPatterns ?? [])
    ])
  ];
  const sensitivePatterns = [
    ...SENSITIVE_MARKETING_CLAIM_PATTERNS,
    ...buildLiteralPatterns([
      ...(policyMatrix?.globalSensitiveClaimPatterns ?? []),
      ...(policyMatrixRule?.sensitiveClaimPatterns ?? [])
    ])
  ];
  const matchedForbidden = dedupeValues(
    forbiddenPatterns.flatMap((pattern) =>
      texts.some((text) => pattern.test(text)) ? [pattern.source] : []
    )
  );
  const matchedSensitive = dedupeValues(
    sensitivePatterns.flatMap((pattern) =>
      texts.some((text) => pattern.test(text)) ? [pattern.source] : []
    )
  );

  return {
    forbidden: matchedForbidden.length > 0,
    sensitive: matchedSensitive.length > 0,
    matchedPatterns: [...matchedForbidden, ...matchedSensitive]
  };
}

function inferTenantCommercialCompliance(
  context: CompanyContext,
  policyMatrix?: CompanyPolicyMatrix,
  policyMatrixRule?: CompanyPolicyMatrixActionRule
): TenantCommercialCompliance {
  const blockedSources = new Set(
    [
      ...(context.workspace.keywordStrategy?.blockedDataSources ?? []),
      ...(policyMatrix?.globalBlockedDataSources ?? []),
      ...(policyMatrixRule?.blockedDataSources ?? [])
    ].map(normalizeComplianceToken).filter(Boolean)
  );
  const approvedSources = new Set(
    [
      ...(context.workspace.keywordStrategy?.approvedDataSources ?? []),
      ...(policyMatrix?.globalApprovedDataSources ?? []),
      ...(policyMatrixRule?.approvedDataSources ?? [])
    ].map(normalizeComplianceToken).filter(Boolean)
  );
  let blockedPhrases = extractComplianceTerms(context.workspace.keywordStrategy?.complianceNote, [
    "proibido",
    "vedado",
    "bloquear",
    "nao usar",
    "não usar"
  ]);
  let reviewPhrases = extractComplianceTerms(context.workspace.keywordStrategy?.complianceNote, [
    "revisar",
    "aprovar",
    "validar",
    "atenção",
    "atencao"
  ]);

  blockedPhrases = dedupeValues([
    ...blockedPhrases,
    ...(policyMatrix?.globalForbiddenClaimPatterns ?? []),
    ...(policyMatrixRule?.forbiddenClaimPatterns ?? [])
  ]);
  reviewPhrases = dedupeValues([
    ...reviewPhrases,
    ...(policyMatrix?.globalSensitiveClaimPatterns ?? []),
    ...(policyMatrixRule?.sensitiveClaimPatterns ?? [])
  ]);

  return {
    blockedSources,
    approvedSources,
    blockedPhrases,
    reviewPhrases
  };
}

function resolvePolicyMatrixActionRule(
  matrix: CompanyPolicyMatrix | undefined,
  actionType: PrioritizedAction["type"]
) {
  if (matrix?.status !== "active") {
    return undefined;
  }

  return matrix.actionRules.find((rule) => rule.actionType === actionType);
}

function applyPolicyMatrixToRule(
  baseRule: ReturnType<typeof getCorePolicyRule>,
  matrix: CompanyPolicyMatrix | undefined,
  matrixRule: CompanyPolicyMatrixActionRule | undefined
) {
  if (matrix?.status !== "active" || !matrixRule) {
    return baseRule;
  }

  const decisionOverride =
    matrixRule.decisionOverride && matrixRule.decisionOverride !== "blocked"
      ? matrixRule.decisionOverride
      : undefined;

  return {
    ...baseRule,
    defaultDecision: decisionOverride ?? baseRule.defaultDecision,
    autoExecuteConfidenceFloor:
      matrixRule.autoExecuteConfidenceFloor ?? baseRule.autoExecuteConfidenceFloor,
    requireApprovalAboveBudget:
      matrixRule.requireApprovalAboveBudget ?? baseRule.requireApprovalAboveBudget,
    policyReviewAboveBudget:
      matrixRule.policyReviewAboveBudget ?? baseRule.policyReviewAboveBudget,
    approvalApprovers:
      matrixRule.requiredApprovers ??
      baseRule.approvalApprovers ??
      matrix.defaultRequiredApprovers,
    policyReviewApprovers:
      matrixRule.policyReviewApprovers ??
      baseRule.policyReviewApprovers ??
      matrix.defaultPolicyReviewApprovers,
    financeApprovers: matrixRule.financeApprovers ?? baseRule.financeApprovers,
    complianceApprovers:
      matrixRule.complianceApprovers ?? baseRule.complianceApprovers,
    brandApprovers: matrixRule.brandApprovers ?? baseRule.brandApprovers,
    notes: [...baseRule.notes, ...(matrixRule.notes ?? [])]
  } satisfies ReturnType<typeof getCorePolicyRule>;
}

function inferSubjectCommercialSources(
  inputs: SubjectInputs,
  targetPlatform?: PrioritizedAction["targetPlatform"]
) {
  const values = [
    targetPlatform,
    typeof inputs.channel === "string" ? inputs.channel : undefined,
    typeof inputs.platform === "string" ? inputs.platform : undefined,
    typeof inputs.dataSource === "string" ? inputs.dataSource : undefined,
    ...(Array.isArray(inputs.dataSources) ? inputs.dataSources.map((entry) => String(entry)) : [])
  ].filter((entry): entry is string => Boolean(entry));

  return dedupeValues(values);
}

function inferTenantPhraseRisk(
  inputs: SubjectInputs,
  compliance: TenantCommercialCompliance
) {
  const texts = collectTextValues(inputs).map((entry) => entry.toLowerCase());

  return {
    blocked: dedupeValues(
      compliance.blockedPhrases.filter((phrase) =>
        texts.some((text) => text.includes(phrase.toLowerCase()))
      )
    ),
    review: dedupeValues(
      compliance.reviewPhrases.filter((phrase) =>
        texts.some((text) => text.includes(phrase.toLowerCase()))
      )
    )
  };
}

function extractComplianceTerms(note: string | undefined, markers: string[]) {
  const normalized = String(note ?? "")
    .split(/[\n.;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const terms: string[] = [];
  for (const line of normalized) {
    const lowerLine = line.toLowerCase();
    const marker = markers.find((candidate) => lowerLine.includes(candidate));
    if (!marker) {
      continue;
    }

    const suffix = line.slice(lowerLine.indexOf(marker) + marker.length);
    for (const token of suffix.split(/[,|/]+/).map((entry) => entry.replace(/[:\-]/g, "").trim())) {
      if (token.length >= 3) {
        terms.push(token);
      }
    }
  }

  return dedupeValues(terms);
}

function normalizeComplianceToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function collectTextValues(value: unknown, depth = 0): string[] {
  if (depth > 3 || value === null || value === undefined) {
    return [];
  }

  if (typeof value === "string") {
    return value.trim() ? [value] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectTextValues(entry, depth + 1));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((entry) =>
      collectTextValues(entry, depth + 1)
    );
  }

  return [];
}
