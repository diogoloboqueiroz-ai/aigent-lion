import { buildObservabilityPayloadSignature } from "@/core/observability/collector-auth";
import {
  formatObservabilityExportAsPrometheus
} from "@/core/observability/metrics-export";
import { appendObservabilityDeliveryRecord } from "@/infrastructure/persistence/observability-delivery-store";
import type { CompanyAutomationObservabilityExport } from "@/lib/domain";

export type AutomationMetricsSinkRequest = {
  url: string;
  init: RequestInit;
};

export function isAutomationMetricsSinkConfigured() {
  return Boolean(process.env.AGENT_OBSERVABILITY_WEBHOOK_URL?.trim());
}

export function getAutomationMetricsSinkTargetHost() {
  const url = process.env.AGENT_OBSERVABILITY_WEBHOOK_URL?.trim();
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

export function buildAutomationMetricsSinkRequest(
  exportBundle: CompanyAutomationObservabilityExport
): AutomationMetricsSinkRequest | null {
  const url = process.env.AGENT_OBSERVABILITY_WEBHOOK_URL?.trim();
  if (!url) {
    return null;
  }

  const format = resolveMetricsSinkFormat();
  const bearerToken = process.env.AGENT_OBSERVABILITY_WEBHOOK_BEARER_TOKEN?.trim();
  const body =
    format === "prometheus"
      ? formatObservabilityExportAsPrometheus(exportBundle)
      : JSON.stringify(exportBundle);
  const signingSecret = process.env.AGENT_OBSERVABILITY_WEBHOOK_SIGNING_SECRET?.trim();
  const signature = signingSecret
    ? buildObservabilityPayloadSignature(body, signingSecret)
    : null;

  return {
    url,
    init: {
      method: "POST",
      headers: {
        "Content-Type":
          format === "prometheus"
            ? "text/plain; version=0.0.4"
            : "application/json",
        "X-Lion-Company-Slug": exportBundle.companySlug,
        "X-Lion-Generated-At": exportBundle.generatedAt,
        "X-Lion-Metric-Count": String(exportBundle.metrics.length),
        ...(signature ? { "X-Lion-Signature": signature } : {}),
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {})
      },
      body
    }
  };
}

export async function deliverAutomationMetricsExport(
  exportBundle: CompanyAutomationObservabilityExport
) {
  const request = buildAutomationMetricsSinkRequest(exportBundle);
  if (!request) {
    return {
      delivered: false as const,
      reason: "disabled"
    };
  }

  const response = await fetch(request.url, request.init);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    appendObservabilityDeliveryRecord({
      id: `obs-out-${exportBundle.companySlug}-${Date.now()}`,
      companySlug: exportBundle.companySlug,
      direction: "outbound",
      sink: "webhook",
      format: resolveMetricsSinkFormat(),
      status: "failed",
      metricCount: exportBundle.metrics.length,
      generatedAt: exportBundle.generatedAt,
      createdAt: new Date().toISOString(),
      endpoint: request.url,
      responseStatus: response.status,
      error: body || `HTTP ${response.status}`
    });
    throw new Error(`Metrics sink respondeu ${response.status}: ${body || "sem corpo"}`);
  }

  appendObservabilityDeliveryRecord({
    id: `obs-out-${exportBundle.companySlug}-${Date.now()}`,
    companySlug: exportBundle.companySlug,
    direction: "outbound",
    sink: "webhook",
    format: resolveMetricsSinkFormat(),
    status: "delivered",
    metricCount: exportBundle.metrics.length,
    generatedAt: exportBundle.generatedAt,
    createdAt: new Date().toISOString(),
    deliveredAt: new Date().toISOString(),
    endpoint: request.url,
    responseStatus: response.status
  });

  return {
    delivered: true as const,
    url: request.url,
    format: resolveMetricsSinkFormat()
  };
}

function resolveMetricsSinkFormat() {
  return (process.env.AGENT_OBSERVABILITY_WEBHOOK_FORMAT ?? "").trim().toLowerCase() === "prometheus"
    ? "prometheus"
    : "json";
}
