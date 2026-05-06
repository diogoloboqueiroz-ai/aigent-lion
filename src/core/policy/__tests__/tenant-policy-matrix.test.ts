import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSeedCompanyPolicyMatrix,
  normalizeCompanyPolicyMatrixInput
} from "@/core/policy/tenant-policy-matrix";
import type { CompanyWorkspace } from "@/lib/domain";

test("tenant policy matrix seed derives company compliance and action rules", () => {
  const matrix = buildSeedCompanyPolicyMatrix({
    workspace: buildWorkspace(),
    actor: "operator@example.com"
  });

  assert.equal(matrix.companySlug, "tenant-a");
  assert.equal(matrix.status, "active");
  assert.ok(matrix.actionRules.some((rule) => rule.actionType === "propose_budget_shift"));
  assert.ok(matrix.globalBlockedDataSources.includes("untrusted_source"));
  assert.ok(matrix.globalForbiddenClaimPatterns.includes("sem risco"));
});

test("tenant policy matrix normalization rejects unknown action types", () => {
  const matrix = normalizeCompanyPolicyMatrixInput({
    companySlug: "tenant-a",
    actor: "operator@example.com",
    payload: {
      actionRules: [
        {
          actionType: "unknown_action",
          decisionOverride: "blocked"
        },
        {
          actionType: "refresh_creatives",
          decisionOverride: "policy_review",
          requiredApprovers: ["brand_owner"]
        }
      ]
    }
  });

  assert.equal(matrix.actionRules.length, 1);
  assert.equal(matrix.actionRules[0].actionType, "refresh_creatives");
  assert.equal(matrix.actionRules[0].decisionOverride, "policy_review");
});

function buildWorkspace(): CompanyWorkspace {
  return {
    company: {
      slug: "tenant-a",
      name: "Tenant A"
    },
    agentProfile: {
      forbiddenClaims: ["sem risco"]
    },
    keywordStrategy: {
      approvedDataSources: ["meta"],
      blockedDataSources: ["untrusted_source"],
      complianceNote: "Revisar: antes e depois. Proibido: lucro garantido."
    },
    schedulerProfile: {
      approvalAlertRecipients: ["ops@example.com"],
      strategyAlertRecipients: ["strategy@example.com"],
      financeAlertRecipients: ["finance@example.com"]
    }
  } as unknown as CompanyWorkspace;
}
