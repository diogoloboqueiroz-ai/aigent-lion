import assert from "node:assert/strict";
import test from "node:test";
import { checkManagedAutomationStoreSchema } from "@/infrastructure/persistence/managed-automation-store";

const mutableEnv = process.env as Record<string, string | undefined>;

test("managed automation store schema check fails closed without DATABASE_URL", async () => {
  const snapshot = {
    DATABASE_URL: process.env.DATABASE_URL,
    AGENT_AUTOMATION_STORE_MODE: process.env.AGENT_AUTOMATION_STORE_MODE
  };

  delete mutableEnv.DATABASE_URL;
  mutableEnv.AGENT_AUTOMATION_STORE_MODE = "managed";

  const result = await checkManagedAutomationStoreSchema({ ensure: false });

  assert.equal(result.ok, false);
  assert.equal(result.schema, "agent_lion");
  assert.match(result.configurationError ?? "", /DATABASE_URL/);
  assert.ok(result.missingTables.includes("automation_runs"));
  assert.ok(result.missingIndexes.includes("idx_agent_lion_runs_company_timestamp"));

  restoreEnv(snapshot);
});

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const key of ["DATABASE_URL", "AGENT_AUTOMATION_STORE_MODE"]) {
    const previous = snapshot[key];
    if (previous === undefined) {
      delete mutableEnv[key];
    } else {
      mutableEnv[key] = previous;
    }
  }
}
