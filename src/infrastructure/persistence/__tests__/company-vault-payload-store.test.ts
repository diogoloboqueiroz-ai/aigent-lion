import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  isCompanyVaultConfigured,
  readCompanyVaultPayload,
  writeCompanyVaultPayload
} from "@/infrastructure/persistence/company-vault-payload-store";
import { createEmptyVaultPayload } from "@/infrastructure/persistence/company-vault-schema";

test("company vault payload store returns empty payload when vault is not configured", () => {
  const previousKey = process.env.VAULT_ENCRYPTION_KEY;
  delete process.env.VAULT_ENCRYPTION_KEY;

  try {
    assert.equal(isCompanyVaultConfigured(), false);
    assert.deepEqual(readCompanyVaultPayload().companyProfiles, []);
  } finally {
    if (previousKey !== undefined) {
      process.env.VAULT_ENCRYPTION_KEY = previousKey;
    }
  }
});

test("company vault payload store roundtrips encrypted business state", () => {
  const previousDataDir = process.env.AGENT_DATA_DIR;
  const previousKey = process.env.VAULT_ENCRYPTION_KEY;
  const tempDir = mkdtempSync(path.join(tmpdir(), "agent-lion-payload-store-test-"));

  process.env.AGENT_DATA_DIR = tempDir;
  process.env.VAULT_ENCRYPTION_KEY = "payload-store-test-key";

  try {
    const payload = createEmptyVaultPayload();
    payload.companyProfiles = [
      {
        companySlug: "acme",
        companyName: "Acme",
        trainingStatus: "seeded",
        updatedAt: "2026-05-05T10:00:00.000Z",
        businessSummary: "Growth OS",
        brandVoice: "Direto",
        idealCustomerProfile: "B2B",
        offerStrategy: "Premium",
        differentiators: [],
        approvedChannels: [],
        contentPillars: [],
        geoFocus: [],
        conversionEvents: [],
        efficiencyRules: [],
        forbiddenClaims: [],
        operatorNotes: "",
        systemPrompt: ""
      }
    ];

    writeCompanyVaultPayload(payload);

    assert.equal(readCompanyVaultPayload().companyProfiles[0]?.companySlug, "acme");
  } finally {
    if (previousDataDir === undefined) {
      delete process.env.AGENT_DATA_DIR;
    } else {
      process.env.AGENT_DATA_DIR = previousDataDir;
    }

    if (previousKey === undefined) {
      delete process.env.VAULT_ENCRYPTION_KEY;
    } else {
      process.env.VAULT_ENCRYPTION_KEY = previousKey;
    }

    rmSync(tempDir, { recursive: true, force: true });
  }
});
