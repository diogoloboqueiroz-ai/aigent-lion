export {
  getActiveStoredCompanyPolicyMatrix,
  listStoredCompanyPolicyMatrices,
  upsertStoredCompanyPolicyMatrixInCollection
} from "@/infrastructure/persistence/company-policy-matrix-storage";

import {
  getActiveStoredCompanyPolicyMatrix,
  listStoredCompanyPolicyMatrices,
  upsertStoredCompanyPolicyMatrixInCollection
} from "@/infrastructure/persistence/company-policy-matrix-storage";
import {
  readCompanyVaultPayload,
  writeCompanyVaultPayload
} from "@/infrastructure/persistence/company-vault-payload-store";
import type { CompanyPolicyMatrix } from "@/lib/domain";

export function getPersistedCompanyPolicyMatrices(companySlug?: string) {
  return listStoredCompanyPolicyMatrices(
    readCompanyVaultPayload().companyPolicyMatrices,
    companySlug
  );
}

export function getActivePersistedCompanyPolicyMatrix(companySlug: string) {
  return getActiveStoredCompanyPolicyMatrix(
    readCompanyVaultPayload().companyPolicyMatrices,
    companySlug
  );
}

export function upsertPersistedCompanyPolicyMatrix(matrix: CompanyPolicyMatrix) {
  const payload = readCompanyVaultPayload();
  writeCompanyVaultPayload({
    ...payload,
    companyPolicyMatrices: upsertStoredCompanyPolicyMatrixInCollection(
      payload.companyPolicyMatrices,
      matrix
    )
  });
}
