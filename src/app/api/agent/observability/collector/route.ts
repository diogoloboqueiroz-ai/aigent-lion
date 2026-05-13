import { forwardCollectedObservabilityExport, isObservabilityCollectorForwardingConfigured } from "@/core/observability/collector-forwarding";
import { NextResponse } from "next/server";
import { isObservabilityCollectorAuthorized } from "@/core/observability/collector-auth";
import { appendObservabilityDeliveryRecord } from "@/infrastructure/persistence/observability-delivery-store";
import type { CompanyAutomationObservabilityExport } from "@/lib/domain";
import { sanitizeErrorMessage } from "@/core/observability/redaction";
import { recordCompanyAuditEvent } from "@/lib/governance";

export async function POST(request: Request) {
  const payloadText = await request.text();
  if (!payloadText.trim()) {
    return jsonResponse({ error: "Payload de observabilidade ausente" }, 400);
  }

  const collectorToken = process.env.AGENT_OBSERVABILITY_COLLECTOR_TOKEN?.trim();
  const signingSecret = process.env.AGENT_OBSERVABILITY_COLLECTOR_SIGNING_SECRET?.trim();
  if (!collectorToken && !signingSecret) {
    return jsonResponse({ error: "Collector de observabilidade nao configurado" }, 503);
  }

  const allowed = isObservabilityCollectorAuthorized({
    authorizationHeader: request.headers.get("authorization"),
    expectedBearerToken: collectorToken,
    signatureHeader: request.headers.get("x-lion-signature"),
    signingSecret,
    payload: payloadText
  });
  if (!allowed) {
    return jsonResponse({ error: "Credenciais do collector invalidas" }, 401);
  }

  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return jsonResponse({ error: "Collector aceita apenas payload JSON" }, 415);
  }

  const exportBundle = parseObservabilityExport(payloadText);
  if (!exportBundle) {
    return jsonResponse({ error: "Payload de observabilidade invalido" }, 400);
  }

  appendObservabilityDeliveryRecord({
    id: `obs-in-${exportBundle.companySlug}-${Date.now()}`,
    companySlug: exportBundle.companySlug,
    direction: "inbound",
    sink: "collector",
    format: "json",
    status: "received",
    metricCount: exportBundle.metrics.length,
    generatedAt: exportBundle.generatedAt,
    createdAt: new Date().toISOString(),
    deliveredAt: new Date().toISOString(),
    endpoint: new URL(request.url).pathname
  });
  recordCompanyAuditEvent({
    companySlug: exportBundle.companySlug,
    connector: "system",
    kind: "info",
    title: "Collector de observabilidade recebeu metricas",
    details: `Foram recebidas ${exportBundle.metrics.length} metricas no collector HTTP do Agent Lion.`
  });

  if (isObservabilityCollectorForwardingConfigured()) {
    try {
      const forwardResult = await forwardCollectedObservabilityExport(exportBundle);
      if (forwardResult.delivered) {
        recordCompanyAuditEvent({
          companySlug: exportBundle.companySlug,
          connector: "system",
          kind: "info",
          title: "Collector encaminhou metricas para destino externo",
          details: `O collector encaminhou ${exportBundle.metrics.length} metricas para ${forwardResult.url} em formato ${forwardResult.format}.`
        });
      }
    } catch (error) {
      const message = sanitizeErrorMessage(
        error,
        "Falha ao encaminhar metricas do collector."
      );
      recordCompanyAuditEvent({
        companySlug: exportBundle.companySlug,
        connector: "system",
        kind: "warning",
        title: "Falha no forwarding do collector",
        details: message
      });
      return jsonResponse(
        {
          accepted: false,
          companySlug: exportBundle.companySlug,
          error: message
        },
        502
      );
    }
  }

  return jsonResponse({
    accepted: true,
    companySlug: exportBundle.companySlug,
    metricCount: exportBundle.metrics.length
  });
}

function parseObservabilityExport(payloadText: string): CompanyAutomationObservabilityExport | null {
  let parsed: Partial<CompanyAutomationObservabilityExport>;
  try {
    parsed = JSON.parse(payloadText) as Partial<CompanyAutomationObservabilityExport>;
  } catch {
    return null;
  }

  if (
    typeof parsed.companySlug !== "string" ||
    typeof parsed.generatedAt !== "string" ||
    !Array.isArray(parsed.metrics)
  ) {
    return null;
  }

  return {
    companySlug: parsed.companySlug,
    generatedAt: parsed.generatedAt,
    metrics: parsed.metrics
      .filter(
        (metric): metric is CompanyAutomationObservabilityExport["metrics"][number] =>
          Boolean(
            metric &&
              typeof metric === "object" &&
              typeof metric.name === "string" &&
              typeof metric.description === "string" &&
              typeof metric.value === "number" &&
              (metric.unit === "count" ||
                metric.unit === "ratio" ||
                metric.unit === "milliseconds" ||
                metric.unit === "score")
          )
      )
      .map((metric) => ({
        name: metric.name,
        description: metric.description,
        unit: metric.unit,
        value: metric.value,
        labels: metric.labels
      }))
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
