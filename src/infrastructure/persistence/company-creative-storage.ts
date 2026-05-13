import type {
  CompanyCreativeAsset,
  CreativeToolConnection
} from "@/lib/domain";
import {
  readCompanyVaultPayload,
  writeCompanyVaultPayload
} from "@/infrastructure/persistence/company-vault-payload-store";

export function listStoredCompanyCreativeAssets(
  assets: CompanyCreativeAsset[],
  companySlug?: string
) {
  return filterByCompany(assets, companySlug);
}

export function getPersistedCompanyCreativeAssets(companySlug?: string) {
  return listStoredCompanyCreativeAssets(
    readCompanyVaultPayload().companyCreativeAssets,
    companySlug
  );
}

export function upsertStoredCompanyCreativeAssetInCollection(
  assets: CompanyCreativeAsset[],
  asset: CompanyCreativeAsset
) {
  return upsertById(assets, asset)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 400);
}

export function upsertPersistedCompanyCreativeAsset(asset: CompanyCreativeAsset) {
  const payload = readCompanyVaultPayload();
  writeCompanyVaultPayload({
    ...payload,
    companyCreativeAssets: upsertStoredCompanyCreativeAssetInCollection(
      payload.companyCreativeAssets,
      asset
    )
  });
}

export function listStoredCreativeToolConnections(
  connections: CreativeToolConnection[],
  companySlug?: string
) {
  return filterByCompany(connections, companySlug);
}

export function getPersistedCreativeToolConnections(companySlug?: string) {
  return listStoredCreativeToolConnections(
    readCompanyVaultPayload().creativeToolConnections,
    companySlug
  );
}

export function upsertStoredCreativeToolConnectionInCollection(
  connections: CreativeToolConnection[],
  connection: CreativeToolConnection
) {
  return [
    ...connections.filter(
      (entry) =>
        !(entry.companySlug === connection.companySlug && entry.provider === connection.provider)
    ),
    connection
  ];
}

export function upsertPersistedCreativeToolConnection(connection: CreativeToolConnection) {
  const payload = readCompanyVaultPayload();
  writeCompanyVaultPayload({
    ...payload,
    creativeToolConnections: upsertStoredCreativeToolConnectionInCollection(
      payload.creativeToolConnections,
      connection
    )
  });
}

function filterByCompany<T extends { companySlug: string }>(
  items: T[],
  companySlug?: string
) {
  return companySlug ? items.filter((item) => item.companySlug === companySlug) : items;
}

function upsertById<T extends { id: string }>(items: T[], item: T) {
  return [...items.filter((entry) => entry.id !== item.id), item];
}
