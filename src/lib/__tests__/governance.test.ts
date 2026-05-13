import assert from "node:assert/strict";
import test from "node:test";
import { recordCompanyAuditEvent } from "@/lib/governance";

test("governance audit does not break local UI when vault is not configured", () => {
  const previousVaultKey = process.env.VAULT_ENCRYPTION_KEY;
  const previousDatabaseUrl = process.env.DATABASE_URL;

  delete process.env.VAULT_ENCRYPTION_KEY;
  delete process.env.DATABASE_URL;

  try {
    const event = recordCompanyAuditEvent({
      companySlug: "acme",
      connector: "system",
      kind: "warning",
      title: "Local permission audit",
      details: "This should not crash a local access-denied page."
    });

    assert.equal(event.connector, "system");
    assert.equal(event.kind, "warning");
  } finally {
    if (previousVaultKey === undefined) {
      delete process.env.VAULT_ENCRYPTION_KEY;
    } else {
      process.env.VAULT_ENCRYPTION_KEY = previousVaultKey;
    }

    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  }
});
