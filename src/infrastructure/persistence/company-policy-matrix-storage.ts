import type { CompanyPolicyMatrix } from "@/lib/domain";

export function listStoredCompanyPolicyMatrices(
  matrices: CompanyPolicyMatrix[],
  companySlug?: string
) {
  const scopedMatrices = companySlug
    ? matrices.filter((matrix) => matrix.companySlug === companySlug)
    : matrices;

  return scopedMatrices.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function getActiveStoredCompanyPolicyMatrix(
  matrices: CompanyPolicyMatrix[],
  companySlug: string
) {
  return listStoredCompanyPolicyMatrices(matrices, companySlug).find(
    (matrix) => matrix.status === "active"
  );
}

export function upsertStoredCompanyPolicyMatrixInCollection(
  matrices: CompanyPolicyMatrix[],
  matrix: CompanyPolicyMatrix
) {
  return [
    matrix,
    ...matrices.filter(
      (entry) =>
        !(entry.companySlug === matrix.companySlug && entry.version === matrix.version)
    )
  ]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 120);
}
