import assert from "node:assert/strict";
import test from "node:test";
import {
  listStoredCompanyCreativeAssets,
  listStoredCreativeToolConnections,
  upsertStoredCompanyCreativeAssetInCollection,
  upsertStoredCreativeToolConnectionInCollection
} from "@/infrastructure/persistence/company-creative-storage";
import type {
  CompanyCreativeAsset,
  CreativeToolConnection
} from "@/lib/domain";

test("company creative storage scopes assets and sorts latest first", () => {
  const assets = [
    { id: "asset-old", companySlug: "acme", updatedAt: "2026-05-01T00:00:00.000Z" },
    { id: "asset-other", companySlug: "lion", updatedAt: "2026-05-03T00:00:00.000Z" }
  ] as CompanyCreativeAsset[];
  const next = upsertStoredCompanyCreativeAssetInCollection(assets, {
    id: "asset-new",
    companySlug: "acme",
    updatedAt: "2026-05-04T00:00:00.000Z"
  } as CompanyCreativeAsset);

  assert.equal(next[0]?.id, "asset-new");
  assert.deepEqual(
    listStoredCompanyCreativeAssets(next, "acme").map((asset) => asset.id),
    ["asset-new", "asset-old"]
  );
});

test("company creative storage deduplicates tool connections by tenant and provider", () => {
  const connections = [
    { companySlug: "acme", provider: "canva", status: "planned" },
    { companySlug: "lion", provider: "canva", status: "connected" }
  ] as CreativeToolConnection[];
  const next = upsertStoredCreativeToolConnectionInCollection(connections, {
    companySlug: "acme",
    provider: "canva",
    status: "connected"
  } as CreativeToolConnection);

  assert.equal(next.length, 2);
  assert.equal(listStoredCreativeToolConnections(next, "acme")[0]?.status, "connected");
});
