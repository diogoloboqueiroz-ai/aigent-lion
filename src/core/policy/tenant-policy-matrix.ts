import { listCorePolicyRules } from "@/core/policy/policy-registry";
import type {
  CompanyPolicyMatrix,
  CompanyPolicyMatrixActionRule,
  CompanyPolicyMatrixDecisionOverride,
  CompanyPolicyMatrixStatus,
  CompanyWorkspace
} from "@/lib/domain";

const DECISION_OVERRIDES: CompanyPolicyMatrixDecisionOverride[] = [
  "auto_execute",
  "requires_approval",
  "policy_review",
  "blocked"
];
const MATRIX_STATUSES: CompanyPolicyMatrixStatus[] = ["active", "draft", "retired"];

export function buildSeedCompanyPolicyMatrix(input: {
  workspace: CompanyWorkspace;
  actor: string;
  previous?: CompanyPolicyMatrix;
  status?: CompanyPolicyMatrixStatus;
}) {
  const now = new Date().toISOString();
  const rules = listCorePolicyRules();

  return {
    companySlug: input.workspace.company.slug,
    version: (input.previous?.version ?? 0) + 1,
    status: input.status ?? "active",
    defaultRequiredApprovers: dedupeStrings([
      "operator",
      "strategist",
      ...input.workspace.schedulerProfile.approvalAlertRecipients
    ]),
    defaultPolicyReviewApprovers: dedupeStrings([
      "admin",
      "strategist",
      "compliance",
      ...input.workspace.schedulerProfile.strategyAlertRecipients,
      ...input.workspace.schedulerProfile.financeAlertRecipients
    ]),
    globalApprovedDataSources: dedupeStrings(
      input.workspace.keywordStrategy?.approvedDataSources ?? []
    ),
    globalBlockedDataSources: dedupeStrings(
      input.workspace.keywordStrategy?.blockedDataSources ?? []
    ),
    globalForbiddenClaimPatterns: dedupeStrings([
      ...(input.workspace.agentProfile.forbiddenClaims ?? []),
      ...extractForbiddenTerms(input.workspace.keywordStrategy?.complianceNote)
    ]),
    globalSensitiveClaimPatterns: dedupeStrings(
      extractReviewTerms(input.workspace.keywordStrategy?.complianceNote)
    ),
    actionRules: rules.map((rule) => ({
      actionType: rule.actionType,
      decisionOverride: rule.defaultDecision,
      autoExecuteConfidenceFloor: rule.autoExecuteConfidenceFloor,
      requireApprovalAboveBudget: rule.requireApprovalAboveBudget,
      policyReviewAboveBudget: rule.policyReviewAboveBudget,
      requiredApprovers: rule.approvalApprovers,
      policyReviewApprovers: rule.policyReviewApprovers,
      financeApprovers: rule.financeApprovers,
      complianceApprovers: rule.complianceApprovers,
      brandApprovers: rule.brandApprovers,
      notes: rule.notes
    })),
    createdAt: input.previous?.createdAt ?? now,
    updatedAt: now,
    updatedBy: input.actor
  } satisfies CompanyPolicyMatrix;
}

export function normalizeCompanyPolicyMatrixInput(input: {
  companySlug: string;
  actor: string;
  payload: unknown;
  previous?: CompanyPolicyMatrix;
}) {
  const candidate = isRecord(input.payload) ? input.payload : {};
  const now = new Date().toISOString();
  const version =
    typeof candidate.version === "number" && Number.isInteger(candidate.version) && candidate.version > 0
      ? candidate.version
      : (input.previous?.version ?? 0) + 1;

  return {
    companySlug: input.companySlug,
    version,
    status: normalizeStatus(candidate.status, input.previous?.status ?? "active"),
    defaultRequiredApprovers: normalizeStringList(
      candidate.defaultRequiredApprovers,
      input.previous?.defaultRequiredApprovers ?? ["operator", "strategist"]
    ),
    defaultPolicyReviewApprovers: normalizeStringList(
      candidate.defaultPolicyReviewApprovers,
      input.previous?.defaultPolicyReviewApprovers ?? ["admin", "strategist", "compliance"]
    ),
    globalApprovedDataSources: normalizeStringList(
      candidate.globalApprovedDataSources,
      input.previous?.globalApprovedDataSources ?? []
    ),
    globalBlockedDataSources: normalizeStringList(
      candidate.globalBlockedDataSources,
      input.previous?.globalBlockedDataSources ?? []
    ),
    globalForbiddenClaimPatterns: normalizeStringList(
      candidate.globalForbiddenClaimPatterns,
      input.previous?.globalForbiddenClaimPatterns ?? []
    ),
    globalSensitiveClaimPatterns: normalizeStringList(
      candidate.globalSensitiveClaimPatterns,
      input.previous?.globalSensitiveClaimPatterns ?? []
    ),
    actionRules: normalizeActionRules(candidate.actionRules, input.previous?.actionRules ?? []),
    createdAt: input.previous?.createdAt ?? now,
    updatedAt: now,
    updatedBy: input.actor
  } satisfies CompanyPolicyMatrix;
}

function normalizeActionRules(
  value: unknown,
  fallback: CompanyPolicyMatrixActionRule[]
) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const allowedActionTypes = new Set(listCorePolicyRules().map((rule) => rule.actionType));
  return value.flatMap((entry): CompanyPolicyMatrixActionRule[] => {
    if (!isRecord(entry) || typeof entry.actionType !== "string") {
      return [];
    }

    if (!allowedActionTypes.has(entry.actionType as CompanyPolicyMatrixActionRule["actionType"])) {
      return [];
    }

    return [{
      actionType: entry.actionType as CompanyPolicyMatrixActionRule["actionType"],
      decisionOverride: normalizeDecisionOverride(entry.decisionOverride),
      autoExecuteConfidenceFloor: normalizeNumber(entry.autoExecuteConfidenceFloor),
      requireApprovalAboveBudget: normalizeNumber(entry.requireApprovalAboveBudget),
      policyReviewAboveBudget: normalizeNumber(entry.policyReviewAboveBudget),
      requiredApprovers: normalizeOptionalStringList(entry.requiredApprovers),
      policyReviewApprovers: normalizeOptionalStringList(entry.policyReviewApprovers),
      financeApprovers: normalizeOptionalStringList(entry.financeApprovers),
      complianceApprovers: normalizeOptionalStringList(entry.complianceApprovers),
      brandApprovers: normalizeOptionalStringList(entry.brandApprovers),
      approvedDataSources: normalizeOptionalStringList(entry.approvedDataSources),
      blockedDataSources: normalizeOptionalStringList(entry.blockedDataSources),
      forbiddenClaimPatterns: normalizeOptionalStringList(entry.forbiddenClaimPatterns),
      sensitiveClaimPatterns: normalizeOptionalStringList(entry.sensitiveClaimPatterns),
      notes: normalizeOptionalStringList(entry.notes)
    }];
  });
}

function normalizeStatus(value: unknown, fallback: CompanyPolicyMatrixStatus) {
  return typeof value === "string" && MATRIX_STATUSES.includes(value as CompanyPolicyMatrixStatus)
    ? (value as CompanyPolicyMatrixStatus)
    : fallback;
}

function normalizeDecisionOverride(value: unknown) {
  return typeof value === "string" && DECISION_OVERRIDES.includes(value as CompanyPolicyMatrixDecisionOverride)
    ? (value as CompanyPolicyMatrixDecisionOverride)
    : undefined;
}

function normalizeNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return Math.round(value);
}

function normalizeStringList(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? normalizeStringArray(value) : fallback;
}

function normalizeOptionalStringList(value: unknown) {
  return Array.isArray(value) ? normalizeStringArray(value) : undefined;
}

function normalizeStringArray(values: unknown[]) {
  return dedupeStrings(
    values
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function extractForbiddenTerms(note: string | undefined) {
  return extractTerms(note, ["proibido", "vedado", "bloquear", "nao usar", "não usar"]);
}

function extractReviewTerms(note: string | undefined) {
  return extractTerms(note, ["revisar", "aprovar", "validar", "atencao", "atenção"]);
}

function extractTerms(note: string | undefined, markers: string[]) {
  const terms: string[] = [];

  for (const line of String(note ?? "").split(/[\n.;]+/)) {
    const normalizedLine = line.trim();
    const lowerLine = normalizedLine.toLowerCase();
    const marker = markers.find((candidate) => lowerLine.includes(candidate));
    if (!marker) {
      continue;
    }

    const suffix = normalizedLine.slice(lowerLine.indexOf(marker) + marker.length);
    for (const term of suffix.split(/[,|/]+/)) {
      const cleanTerm = term.replace(/[:\-]/g, "").trim();
      if (cleanTerm.length >= 3) {
        terms.push(cleanTerm);
      }
    }
  }

  return terms;
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
