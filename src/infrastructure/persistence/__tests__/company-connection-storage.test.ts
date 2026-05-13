import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  getStoredGoogleConnectionsFromPayload,
  getStoredSocialConnectionsFromPayload,
  upsertStoredGoogleConnectionInPayload,
  upsertStoredSocialConnectionInPayload
} from "@/infrastructure/persistence/company-connection-storage";
import { createEmptyVaultPayload } from "@/infrastructure/persistence/company-vault-schema";
import type { PlatformId } from "@/lib/domain";

test("company connection storage scopes hydrated connections by tenant", () => {
  const previousDataDir = process.env.AGENT_DATA_DIR;
  const previousSecretsKey = process.env.SECRETS_ENCRYPTION_KEY;
  const tempDir = mkdtempSync(path.join(tmpdir(), "agent-lion-social-connection-test-"));

  process.env.AGENT_DATA_DIR = tempDir;
  process.env.SECRETS_ENCRYPTION_KEY = "test-secret-key";

  try {
    let payload = createEmptyVaultPayload();
    const writePayload = (nextPayload: typeof payload) => {
      payload = nextPayload;
    };

    upsertStoredSocialConnectionInPayload({
      payload,
      writePayload,
      connection: {
        companySlug: "acme",
        platform: "instagram",
        provider: "meta",
        accountLabel: "Acme IG",
        scopes: ["posts"],
        accessToken: "acme-access-token",
        createdAt: "2026-05-05T10:00:00.000Z",
        updatedAt: "2026-05-05T10:00:00.000Z"
      }
    });
    upsertStoredSocialConnectionInPayload({
      payload,
      writePayload,
      connection: {
        companySlug: "lion",
        platform: "instagram",
        provider: "meta",
        accountLabel: "Lion IG",
        scopes: ["posts"],
        accessToken: "lion-access-token",
        createdAt: "2026-05-05T10:00:00.000Z",
        updatedAt: "2026-05-05T10:00:00.000Z"
      }
    });

    assert.deepEqual(
      getStoredSocialConnectionsFromPayload(payload, "acme").map(
        (connection) => connection.accountLabel
      ),
      ["Acme IG"]
    );
  } finally {
    if (previousDataDir === undefined) {
      delete process.env.AGENT_DATA_DIR;
    } else {
      process.env.AGENT_DATA_DIR = previousDataDir;
    }

    if (previousSecretsKey === undefined) {
      delete process.env.SECRETS_ENCRYPTION_KEY;
    } else {
      process.env.SECRETS_ENCRYPTION_KEY = previousSecretsKey;
    }

    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("company connection storage writes metadata while keeping secrets outside business state", () => {
  const previousDataDir = process.env.AGENT_DATA_DIR;
  const previousSecretsKey = process.env.SECRETS_ENCRYPTION_KEY;
  const tempDir = mkdtempSync(path.join(tmpdir(), "agent-lion-connection-test-"));

  process.env.AGENT_DATA_DIR = tempDir;
  process.env.SECRETS_ENCRYPTION_KEY = "test-secret-key";

  try {
    let payload = createEmptyVaultPayload();
    const writePayload = (nextPayload: typeof payload) => {
      payload = nextPayload;
    };

    upsertStoredGoogleConnectionInPayload({
      payload,
      writePayload,
      connection: {
        companySlug: "acme",
        platform: "analytics" as PlatformId,
        accountEmail: "ops@acme.test",
        accountName: "Acme Analytics",
        googleSub: "google-sub-1",
        scopes: ["analytics.readonly"],
        accessToken: "sensitive-access-token",
        refreshToken: "sensitive-refresh-token",
        createdAt: "2026-05-05T10:00:00.000Z",
        updatedAt: "2026-05-05T10:00:00.000Z"
      }
    });

    assert.equal(payload.googleConnections[0]?.hasRefreshToken, true);
    assert.equal("accessToken" in payload.googleConnections[0]!, false);
    assert.equal(getStoredGoogleConnectionsFromPayload(payload).length, 1);
  } finally {
    if (previousDataDir === undefined) {
      delete process.env.AGENT_DATA_DIR;
    } else {
      process.env.AGENT_DATA_DIR = previousDataDir;
    }

    if (previousSecretsKey === undefined) {
      delete process.env.SECRETS_ENCRYPTION_KEY;
    } else {
      process.env.SECRETS_ENCRYPTION_KEY = previousSecretsKey;
    }

    rmSync(tempDir, { recursive: true, force: true });
  }
});
