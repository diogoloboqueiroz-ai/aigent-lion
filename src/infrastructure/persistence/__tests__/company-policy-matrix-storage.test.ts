import assert from "node:assert/strict";
import test from "node:test";
import {
  getActiveStoredCompanyPolicyMatrix,
  listStoredCompanyPolicyMatrices,
  upsertStoredCompanyPolicyMatrixInCollection
} from "@/infrastructure/persistence/company-policy-matrix-storage";
import type { CompanyPolicyMatrix } from "@/lib/domain";

function buildMatrix(
  companySlug: string,
  overrides: Partial<CompanyPolicyMatrix> = {}
): CompanyPolicyMatrix {
  return {
    companySlug,
    version: 1,
    status: "active",
    defaultRequiredApprovers: ["operator"],
    defaultPolicyReviewApprovers: ["admin"],
    globalApprovedDataSources: [],
    globalBlockedDataSources: [],
    globalForbiddenClaimPatterns: [],
    globalSensitiveClaimPatterns: [],
    actionRules: [],
    createdAt: "2026-05-02T10:00:00.000Z",
    updatedAt: "2026-05-02T10:00:00.000Z",
    updatedBy: "test",
    ...overrides
  };
}

test("policy matrix storage scopes active matrix by tenant", () => {
  const matrices = [
    buildMatrix("tenant-a", {
      version: 1,
      status: "retired",
      updatedAt: "2026-05-01T10:00:00.000Z"
    }),
    buildMatrix("tenant-a", {
      version: 2,
      updatedAt: "2026-05-02T10:00:00.000Z"
    }),
    buildMatrix("tenant-b", {
      version: 1,
      updatedAt: "2026-05-03T10:00:00.000Z"
    })
  ];

  assert.equal(listStoredCompanyPolicyMatrices(matrices, "tenant-a").length, 2);
  assert.equal(getActiveStoredCompanyPolicyMatrix(matrices, "tenant-a")?.version, 2);
});

test("policy matrix storage upserts by tenant and version", () => {
  const existing = buildMatrix("tenant-a", {
    version: 1,
    defaultRequiredApprovers: ["operator"]
  });
  const updated = buildMatrix("tenant-a", {
    version: 1,
    defaultRequiredApprovers: ["growth_lead"],
    updatedAt: "2026-05-04T10:00:00.000Z"
  });

  const nextMatrices = upsertStoredCompanyPolicyMatrixInCollection([existing], updated);

  assert.equal(nextMatrices.length, 1);
  assert.deepEqual(nextMatrices[0].defaultRequiredApprovers, ["growth_lead"]);
});
