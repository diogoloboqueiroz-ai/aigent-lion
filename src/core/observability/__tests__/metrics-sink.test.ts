import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAutomationMetricsSinkRequest
} from "@/core/observability/metrics-sink";
import type { CompanyAutomationObservabilityExport } from "@/lib/domain";

const exportBundle: CompanyAutomationObservabilityExport = {
  companySlug: "acme",
  generatedAt: "2026-04-23T10:00:00.000Z",
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

test("metrics sink builds json webhook request by default", () => {
  process.env.AGENT_OBSERVABILITY_WEBHOOK_URL = "https://example.com/metrics";
  delete process.env.AGENT_OBSERVABILITY_WEBHOOK_FORMAT;
  delete process.env.AGENT_OBSERVABILITY_WEBHOOK_BEARER_TOKEN;

  const request = buildAutomationMetricsSinkRequest(exportBundle);

  assert.ok(request);
  assert.equal(request?.url, "https://example.com/metrics");
  assert.equal((request?.init.headers as Record<string, string>)["Content-Type"], "application/json");
  assert.ok(String(request?.init.body).includes("\"companySlug\":\"acme\""));
});

test("metrics sink can build prometheus webhook request with bearer auth", () => {
  process.env.AGENT_OBSERVABILITY_WEBHOOK_URL = "https://example.com/prom";
  process.env.AGENT_OBSERVABILITY_WEBHOOK_FORMAT = "prometheus";
  process.env.AGENT_OBSERVABILITY_WEBHOOK_BEARER_TOKEN = "secret-token";
  delete process.env.AGENT_OBSERVABILITY_WEBHOOK_SIGNING_SECRET;

  const request = buildAutomationMetricsSinkRequest(exportBundle);
  const headers = request?.init.headers as Record<string, string>;

  assert.ok(request);
  assert.equal(headers["Content-Type"], "text/plain; version=0.0.4");
  assert.equal(headers.Authorization, "Bearer secret-token");
  assert.ok(String(request?.init.body).includes("lion_runs_total"));
});

test("metrics sink adds signed collector headers when signing secret exists", () => {
  process.env.AGENT_OBSERVABILITY_WEBHOOK_URL = "https://collector.example.com/lion";
  process.env.AGENT_OBSERVABILITY_WEBHOOK_FORMAT = "json";
  process.env.AGENT_OBSERVABILITY_WEBHOOK_BEARER_TOKEN = "collector-token";
  process.env.AGENT_OBSERVABILITY_WEBHOOK_SIGNING_SECRET = "signing-secret";

  const request = buildAutomationMetricsSinkRequest(exportBundle);
  const headers = request?.init.headers as Record<string, string>;

  assert.ok(request);
  assert.equal(headers["X-Lion-Company-Slug"], "acme");
  assert.equal(headers["X-Lion-Generated-At"], "2026-04-23T10:00:00.000Z");
  assert.equal(headers["X-Lion-Metric-Count"], "1");
  assert.ok(headers["X-Lion-Signature"]);
});
