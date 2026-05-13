import { buildObservabilityPayloadSignature } from "@/core/observability/collector-auth";
import { formatObservabilityExportAsPrometheus } from "@/core/observability/metrics-export";
import { appendObservabilityDeliveryRecord } from "@/infrastructure/persistence/observability-delivery-store";
import type { CompanyAutomationObservabilityExport } from "@/lib/domain";

export function isObservabilityCollectorForwardingConfigured() {
  return Boolean(process.env.AGENT_OBSERVABILITY_COLLECTOR_FORWARD_URL?.trim());
}

export function getObservabilityCollectorConfigurationError() {
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  const forwardUrl = process.env.AGENT_OBSERVABILITY_COLLECTOR_FORWARD_URL?.trim();
  if (!forwardUrl) {
    return "Producao exige AGENT_OBSERVABILITY_COLLECTOR_FORWARD_URL para encaminhar metricas do collector.";
  }

  try {
    const parsedUrl = new URL(forwardUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return "AGENT_OBSERVABILITY_COLLECTOR_FORWARD_URL deve usar http ou https.";
    }
  } catch {
    return "AGENT_OBSERVABILITY_COLLECTOR_FORWARD_URL invalida.";
  }

  if (!process.env.AGENT_OBSERVABILITY_COLLECTOR_TOKEN?.trim()) {
    return "Producao exige AGENT_OBSERVABILITY_COLLECTOR_TOKEN para proteger o collector.";
  }

  if (!process.env.AGENT_OBSERVABILITY_COLLECTOR_SIGNING_SECRET?.trim()) {
    return "Producao exige AGENT_OBSERVABILITY_COLLECTOR_SIGNING_SECRET para validar payloads do collector.";
  }

  const forwardBearer = process.env.AGENT_OBSERVABILITY_COLLECTOR_FORWARD_BEARER_TOKEN?.trim();
  const forwardSigningSecret =
    process.env.AGENT_OBSERVABILITY_COLLECTOR_FORWARD_SIGNING_SECRET?.trim();
  if (!forwardBearer && !forwardSigningSecret) {
    return "Producao exige bearer token ou signing secret para o forwarding externo do collector.";
  }

  return null;
}

export function assertObservabilityCollectorProductionReady() {
  const configurationError = getObservabilityCollectorConfigurationError();
  if (configurationError) {
    throw new Error(configurationError);
  }
}

export function getObservabilityCollectorForwardTargetHost() {
  const url = process.env.AGENT_OBSERVABILITY_COLLECTOR_FORWARD_URL?.trim();
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

export async function forwardCollectedObservabilityExport(
  exportBundle: CompanyAutomationObservabilityExport
) {
  const request = buildCollectorForwardRequest(exportBundle);
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
      id: `obs-fwd-${exportBundle.companySlug}-${Date.now()}`,
      companySlug: exportBundle.companySlug,
      direction: "outbound",
      sink: "forwarder",
      format: resolveCollectorForwardFormat(),
      status: "failed",
      metricCount: exportBundle.metrics.length,
      generatedAt: exportBundle.generatedAt,
      createdAt: new Date().toISOString(),
      endpoint: request.url,
      responseStatus: response.status,
      error: body || `HTTP ${response.status}`
    });

    throw new Error(`Collector forward respondeu ${response.status}: ${body || "sem corpo"}`);
  }

  appendObservabilityDeliveryRecord({
    id: `obs-fwd-${exportBundle.companySlug}-${Date.now()}`,
    companySlug: exportBundle.companySlug,
    direction: "outbound",
    sink: "forwarder",
    format: resolveCollectorForwardFormat(),
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
    format: resolveCollectorForwardFormat()
  };
}

function buildCollectorForwardRequest(exportBundle: CompanyAutomationObservabilityExport) {
  const url = process.env.AGENT_OBSERVABILITY_COLLECTOR_FORWARD_URL?.trim();
  if (!url) {
    return null;
  }

  const format = resolveCollectorForwardFormat();
  const bearerToken = process.env.AGENT_OBSERVABILITY_COLLECTOR_FORWARD_BEARER_TOKEN?.trim();
  const body =
    format === "prometheus"
      ? formatObservabilityExportAsPrometheus(exportBundle)
      : JSON.stringify(exportBundle);
  const signingSecret = process.env.AGENT_OBSERVABILITY_COLLECTOR_FORWARD_SIGNING_SECRET?.trim();
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
    } satisfies RequestInit
  };
}

function resolveCollectorForwardFormat() {
  return (process.env.AGENT_OBSERVABILITY_COLLECTOR_FORWARD_FORMAT ?? "")
    .trim()
    .toLowerCase() === "prometheus"
    ? "prometheus"
    : "json";
}
