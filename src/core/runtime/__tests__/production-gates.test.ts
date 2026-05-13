import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAgentProductionGates } from "@/core/runtime/production-gates";

test("production gates fail closed without managed store and database", () => {
  const gates = evaluateAgentProductionGates({
    NODE_ENV: "production"
  });

  assert.equal(gates.find((gate) => gate.id === "database-url")?.status, "fail");
  assert.equal(gates.find((gate) => gate.id === "managed-store")?.status, "fail");
  assert.equal(gates.find((gate) => gate.id === "session-secret")?.status, "fail");
  assert.equal(gates.find((gate) => gate.id === "google-oauth")?.status, "fail");
});

test("production gates pass critical requirements with managed configuration", () => {
  const gates = evaluateAgentProductionGates({
    NODE_ENV: "production",
    DATABASE_URL: "postgres://example",
    AGENT_AUTOMATION_STORE_MODE: "managed",
    AGENT_EXECUTION_PLANE_MODE: "external",
    AUTH_SESSION_SECRET: "strong-secret",
    GOOGLE_CLIENT_ID: "google-client-id",
    GOOGLE_CLIENT_SECRET: "google-client-secret",
    AGENT_OBSERVABILITY_WEBHOOK_URL: "https://observability.example.com/lion"
  });

  assert.equal(gates.every((gate) => gate.status === "pass"), true);
});
