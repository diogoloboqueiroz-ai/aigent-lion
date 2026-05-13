import assert from "node:assert/strict";
import test from "node:test";
import {
  getObservabilityCollectorConfigurationError,
  getObservabilityCollectorForwardTargetHost,
  isObservabilityCollectorForwardingConfigured
} from "@/core/observability/collector-forwarding";
import type { CompanyAutomationObservabilityExport } from "@/lib/domain";

const exportBundle: CompanyAutomationObservabilityExport = {
  companySlug: "acme",
  generatedAt: "2026-04-30T10:00:00.000Z",
  metrics: [
    {
      name: "lion_runs_total",
      description: "Runs",
      unit: "count",
      value: 3,
      labels: {
        company_slug: "acme"
      }
    }
  ]
};

test("collector forwarding detects configured target host", () => {
  const snapshot = snapshotEnv();
  process.env.AGENT_OBSERVABILITY_COLLECTOR_FORWARD_URL =
    "https://collector.example.com/ingest";

  assert.equal(isObservabilityCollectorForwardingConfigured(), true);
  assert.equal(getObservabilityCollectorForwardTargetHost(), "collector.example.com");
  assert.equal(exportBundle.metrics.length, 1);
  restoreEnv(snapshot);
});

test("collector forwarding fails closed in production without a real destination", () => {
  const snapshot = snapshotEnv();

  setEnv("NODE_ENV", "production");
  delete process.env.AGENT_OBSERVABILITY_COLLECTOR_FORWARD_URL;
  process.env.AGENT_OBSERVABILITY_COLLECTOR_TOKEN = "collector-token";
  process.env.AGENT_OBSERVABILITY_COLLECTOR_SIGNING_SECRET = "collector-secret";
  process.env.AGENT_OBSERVABILITY_COLLECTOR_FORWARD_BEARER_TOKEN = "forward-token";

  assert.match(getObservabilityCollectorConfigurationError() ?? "", /FORWARD_URL/);
  restoreEnv(snapshot);
});

test("collector forwarding production check accepts authenticated forwarding", () => {
  const snapshot = snapshotEnv();

  setEnv("NODE_ENV", "production");
  process.env.AGENT_OBSERVABILITY_COLLECTOR_FORWARD_URL =
    "https://collector.example.com/ingest";
  process.env.AGENT_OBSERVABILITY_COLLECTOR_TOKEN = "collector-token";
  process.env.AGENT_OBSERVABILITY_COLLECTOR_SIGNING_SECRET = "collector-secret";
  process.env.AGENT_OBSERVABILITY_COLLECTOR_FORWARD_SIGNING_SECRET = "forward-secret";
  delete process.env.AGENT_OBSERVABILITY_COLLECTOR_FORWARD_BEARER_TOKEN;

  assert.equal(getObservabilityCollectorConfigurationError(), null);
  restoreEnv(snapshot);
});

function snapshotEnv() {
  return {
    NODE_ENV: process.env.NODE_ENV,
    AGENT_OBSERVABILITY_COLLECTOR_FORWARD_URL:
      process.env.AGENT_OBSERVABILITY_COLLECTOR_FORWARD_URL,
    AGENT_OBSERVABILITY_COLLECTOR_TOKEN:
      process.env.AGENT_OBSERVABILITY_COLLECTOR_TOKEN,
    AGENT_OBSERVABILITY_COLLECTOR_SIGNING_SECRET:
      process.env.AGENT_OBSERVABILITY_COLLECTOR_SIGNING_SECRET,
    AGENT_OBSERVABILITY_COLLECTOR_FORWARD_BEARER_TOKEN:
      process.env.AGENT_OBSERVABILITY_COLLECTOR_FORWARD_BEARER_TOKEN,
    AGENT_OBSERVABILITY_COLLECTOR_FORWARD_SIGNING_SECRET:
      process.env.AGENT_OBSERVABILITY_COLLECTOR_FORWARD_SIGNING_SECRET
  };
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      setEnv(key, value);
    }
  }
}

function setEnv(key: string, value: string) {
  (process.env as Record<string, string | undefined>)[key] = value;
}
