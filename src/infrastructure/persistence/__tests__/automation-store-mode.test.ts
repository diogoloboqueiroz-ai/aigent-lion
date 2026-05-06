import test from "node:test";
import assert from "node:assert/strict";
import {
  assertAutomationStoreMutationAllowed,
  getAutomationStoreConfigurationError,
  getAutomationStoreDisplayName,
  getAutomationStoreMode,
  isAutomationStoreMutationAllowed,
  isAutomationStoreProductionReady,
  isManagedAutomationStoreConfigured
} from "@/infrastructure/persistence/automation-store-mode";

const mutableEnv = process.env as Record<string, string | undefined>;

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const key of [
    "NODE_ENV",
    "DATABASE_URL",
    "AGENT_AUTOMATION_STORE_MODE",
    "AGENT_ALLOW_LEGACY_LOCAL_STORE"
  ]) {
    const previous = snapshot[key];
    if (previous === undefined) {
      delete mutableEnv[key];
    } else {
      mutableEnv[key] = previous;
    }
  }
}

test("automation store defaults to managed when DATABASE_URL is configured", () => {
  const snapshot = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    AGENT_AUTOMATION_STORE_MODE: process.env.AGENT_AUTOMATION_STORE_MODE,
    AGENT_ALLOW_LEGACY_LOCAL_STORE: process.env.AGENT_ALLOW_LEGACY_LOCAL_STORE
  };

  mutableEnv.NODE_ENV = "production";
  mutableEnv.DATABASE_URL = "postgres://lion:test@localhost:5432/agent";
  delete mutableEnv.AGENT_AUTOMATION_STORE_MODE;
  delete mutableEnv.AGENT_ALLOW_LEGACY_LOCAL_STORE;

  assert.equal(getAutomationStoreMode(), "managed");
  assert.equal(isManagedAutomationStoreConfigured(), true);
  assert.equal(isAutomationStoreProductionReady(), true);
  assert.equal(isAutomationStoreMutationAllowed(), true);
  assert.equal(getAutomationStoreDisplayName(), "postgres-managed");
  assert.equal(getAutomationStoreConfigurationError(), null);

  restoreEnv(snapshot);
});

test("production fails closed when managed store is absent and no override is set", () => {
  const snapshot = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    AGENT_AUTOMATION_STORE_MODE: process.env.AGENT_AUTOMATION_STORE_MODE,
    AGENT_ALLOW_LEGACY_LOCAL_STORE: process.env.AGENT_ALLOW_LEGACY_LOCAL_STORE
  };

  mutableEnv.NODE_ENV = "production";
  delete mutableEnv.DATABASE_URL;
  delete mutableEnv.AGENT_AUTOMATION_STORE_MODE;
  delete mutableEnv.AGENT_ALLOW_LEGACY_LOCAL_STORE;

  assert.equal(getAutomationStoreMode(), "local");
  assert.equal(isManagedAutomationStoreConfigured(), false);
  assert.equal(isAutomationStoreProductionReady(), false);
  assert.equal(isAutomationStoreMutationAllowed(), false);
  assert.equal(getAutomationStoreDisplayName(), "misconfigured");
  assert.match(
    getAutomationStoreConfigurationError() ?? "",
    /DATABASE_URL|AGENT_AUTOMATION_STORE_MODE=local/
  );
  assert.throws(
    () => assertAutomationStoreMutationAllowed("enfileirar ciclo"),
    /Acao bloqueada: enfileirar ciclo/
  );

  restoreEnv(snapshot);
});

test("production rejects legacy local store even with emergency override", () => {
  const snapshot = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    AGENT_AUTOMATION_STORE_MODE: process.env.AGENT_AUTOMATION_STORE_MODE,
    AGENT_ALLOW_LEGACY_LOCAL_STORE: process.env.AGENT_ALLOW_LEGACY_LOCAL_STORE
  };

  mutableEnv.NODE_ENV = "production";
  delete mutableEnv.DATABASE_URL;
  mutableEnv.AGENT_AUTOMATION_STORE_MODE = "local";
  mutableEnv.AGENT_ALLOW_LEGACY_LOCAL_STORE = "true";

  assert.equal(getAutomationStoreMode(), "local");
  assert.equal(isAutomationStoreProductionReady(), false);
  assert.equal(isAutomationStoreMutationAllowed(), false);
  assert.equal(getAutomationStoreDisplayName(), "misconfigured");
  assert.match(getAutomationStoreConfigurationError() ?? "", /DATABASE_URL/);

  restoreEnv(snapshot);
});
