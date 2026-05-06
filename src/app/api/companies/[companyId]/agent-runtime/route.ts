import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/core/observability/redaction";
import { getCompanyWorkspace } from "@/lib/connectors";
import {
  getAgentRuntimeSnapshot,
  projectAgentRuntimeSnapshot,
  runAgentWorkerCycle
} from "@/lib/agents/worker";
import { formatObservabilityExportAsPrometheus } from "@/lib/agents/runtime";
import {
  drainAgentWorkerQueue,
  enqueueAgentWorkerRun,
  getQueueIdempotencyKeyForManualTrigger
} from "@/lib/agents/queue-processor";
import {
  canInlineAgentWorkerExecution,
  getAgentExecutionPlaneMode,
  isExternalAgentExecutionPlane
} from "@/lib/agents/execution-plane";
import type { AgentRuntimeInspectionView, TriggerEventType } from "@/lib/agents/types";
import { buildTriggerEvent } from "@/lib/agents/orchestrator";
import { hasPermission, requireCompanyPermission } from "@/lib/rbac";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

const TRIGGER_TYPES: TriggerEventType[] = [
  "manual_run",
  "scheduled_cycle",
  "metric_anomaly",
  "alert_recheck",
  "approval_resolution",
  "api_preview"
];

const AUTONOMY_MODES = ["advisory", "auto_low_risk", "approval_required"] as const;

export async function GET(
  request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  const session = getSessionFromCookies(await cookies());

  if (!session) {
    return jsonResponse({ error: "Sessao invalida" }, 401);
  }

  const professionalProfile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(companyId, professionalProfile);

  if (!workspace) {
    return jsonResponse({ error: "Empresa nao encontrada" }, 404);
  }

  const permissionCheck = resolveRuntimePermission(
    workspace.company.slug,
    professionalProfile,
    session.email
  );
  if (!permissionCheck.allowed) {
    return jsonResponse({ error: permissionCheck.message, auditId: permissionCheck.auditId }, 403);
  }

  const runtime = await getAgentRuntimeSnapshot(workspace.company.slug, professionalProfile);
  const url = new URL(request.url);
  const view = normalizeInspectionView(url.searchParams.get("view"));
  const format = normalizeInspectionFormat(url.searchParams.get("format"));
  const limit = normalizeSnapshotLimit(url.searchParams.get("limit"));

  if (format === "prometheus") {
    if (!runtime?.observabilityExport) {
      return new NextResponse("", {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; version=0.0.4; charset=utf-8"
        }
      });
    }

    return new NextResponse(formatObservabilityExportAsPrometheus(runtime.observabilityExport), {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8"
      }
    });
  }

  return jsonResponse({
    runtime: runtime ? projectAgentRuntimeSnapshot(runtime, { view, limit }) : null,
    inspection: {
      view,
      format,
      limit
    }
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  const session = getSessionFromCookies(await cookies());

  if (!session) {
    return jsonResponse({ error: "Sessao invalida" }, 401);
  }

  const professionalProfile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(companyId, professionalProfile);

  if (!workspace) {
    return jsonResponse({ error: "Empresa nao encontrada" }, 404);
  }

  const permissionCheck = resolveRuntimePermission(
    workspace.company.slug,
    professionalProfile,
    session.email
  );
  if (!permissionCheck.allowed) {
    return jsonResponse({ error: permissionCheck.message, auditId: permissionCheck.auditId }, 403);
  }

  const payload = await request.json().catch(() => null);
  const intent = normalizeIntent(payload?.intent);
  const triggerType = normalizeTriggerType(payload?.triggerType);
  const triggerActor = typeof payload?.actor === "string" ? payload.actor : session.email;
  const triggerSummary = typeof payload?.summary === "string" ? payload.summary : undefined;
  const autonomy = normalizeAutonomyMode(payload?.autonomy);
  const requestOrigin = new URL(request.url).origin;

  try {
    if (intent === "enqueue") {
      const trigger = buildTriggerEvent(workspace.company.slug, {
        triggerType,
        actor: triggerActor,
        summary: triggerSummary
      });
      const queueItem = await enqueueAgentWorkerRun({
        companySlug: workspace.company.slug,
        actor: session.email,
        trigger,
        reason: "Solicitacao manual para enfileirar um novo ciclo autonomo do Agent Lion.",
        idempotencyKey:
          typeof payload?.idempotencyKey === "string" && payload.idempotencyKey.trim()
            ? payload.idempotencyKey.trim()
            : getQueueIdempotencyKeyForManualTrigger(workspace.company.slug, session.email, {
                type: trigger.type,
                summary: trigger.summary
              }),
        schedulerAutonomy: autonomy,
        requestOrigin,
        fallbackRecipientEmail: session.email,
        source: "api"
      });

      return jsonResponse({
        intent,
        executionPlane: getAgentExecutionPlaneMode(),
        queueItem,
        runtime: await getAgentRuntimeSnapshot(workspace.company.slug, professionalProfile)
      });
    }

    if (intent === "drain") {
      if (isExternalAgentExecutionPlane() && !canInlineAgentWorkerExecution()) {
        return jsonResponse({
          intent,
        executionPlane: getAgentExecutionPlaneMode(),
        message:
          "O Agent Lion esta em modo de worker externo. O consumo da fila deve acontecer pelo processo dedicado.",
        runtime: await getAgentRuntimeSnapshot(workspace.company.slug, professionalProfile)
      });
      }

      const drain = await drainAgentWorkerQueue({
        companySlug: workspace.company.slug,
        actor: session.email,
        executionContext: "inline_control_plane",
        professionalProfile,
        requestOrigin,
        fallbackRecipientEmail: session.email,
        limit:
          typeof payload?.limit === "number" && Number.isFinite(payload.limit)
            ? payload.limit
            : undefined
      });

      return jsonResponse({
        intent,
        executionPlane: getAgentExecutionPlaneMode(),
        drain,
        runtime: await getAgentRuntimeSnapshot(workspace.company.slug, professionalProfile)
      });
    }

    if (isExternalAgentExecutionPlane() && !canInlineAgentWorkerExecution()) {
      const trigger = buildTriggerEvent(workspace.company.slug, {
        triggerType,
        actor: triggerActor,
        summary: triggerSummary
      });
      const queueItem = await enqueueAgentWorkerRun({
        companySlug: workspace.company.slug,
        actor: session.email,
        trigger,
        reason: "Solicitacao manual para executar agora foi convertida em enqueue no worker externo.",
        idempotencyKey:
          typeof payload?.idempotencyKey === "string" && payload.idempotencyKey.trim()
            ? payload.idempotencyKey.trim()
            : getQueueIdempotencyKeyForManualTrigger(workspace.company.slug, session.email, {
                type: trigger.type,
                summary: trigger.summary
              }),
        schedulerAutonomy: autonomy,
        requestOrigin,
        fallbackRecipientEmail: session.email,
        source: "runtime"
      });

      return jsonResponse({
        intent,
        executionPlane: getAgentExecutionPlaneMode(),
        message:
          "O Agent Lion esta em modo de worker externo. O run imediato foi enfileirado para o execution plane dedicado.",
        queueItem,
        runtime: await getAgentRuntimeSnapshot(workspace.company.slug, professionalProfile)
      });
    }

    const result = await runAgentWorkerCycle({
      companySlug: workspace.company.slug,
      actor: session.email,
      executionContext: "inline_control_plane",
      professionalProfile,
      triggerType,
      triggerActor,
      triggerSummary,
      schedulerAutonomy: autonomy,
      requestOrigin,
      fallbackRecipientEmail: session.email
    });

    return jsonResponse({
      executionPlane: getAgentExecutionPlaneMode(),
      result,
      runtime: await getAgentRuntimeSnapshot(workspace.company.slug, professionalProfile)
    });
  } catch (error) {
    const message = sanitizeErrorMessage(error, "Falha ao rodar o worker do Agent Lion.");
    return jsonResponse(
      { error: message },
      message.includes("Outro ciclo autonomo") ? 409 : 500
    );
  }
}

function resolveRuntimePermission(
  companySlug: string,
  professionalProfile: ReturnType<typeof getUserProfessionalProfile>,
  actor: string
) {
  if (
    hasPermission(professionalProfile, "agent:run") ||
    hasPermission(professionalProfile, "scheduler:run")
  ) {
    return {
      allowed: true as const
    };
  }

  return requireCompanyPermission({
    companySlug,
    profile: professionalProfile,
    permission: "agent:run",
    actor
  });
}

function normalizeTriggerType(value: unknown): TriggerEventType | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return TRIGGER_TYPES.includes(value as TriggerEventType) ? (value as TriggerEventType) : undefined;
}

function normalizeAutonomyMode(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  return AUTONOMY_MODES.includes(value as (typeof AUTONOMY_MODES)[number])
    ? (value as (typeof AUTONOMY_MODES)[number])
    : undefined;
}

function normalizeIntent(value: unknown) {
  if (value === "enqueue" || value === "drain") {
    return value;
  }

  return "run_now" as const;
}

function normalizeInspectionView(value: string | null): AgentRuntimeInspectionView {
  if (
    value === "summary" ||
    value === "metrics" ||
    value === "queue" ||
    value === "dead_letters" ||
    value === "intents" ||
    value === "breakers" ||
    value === "runs" ||
    value === "all"
  ) {
    return value;
  }

  return "summary";
}

function normalizeInspectionFormat(value: string | null) {
  return value === "prometheus" ? "prometheus" : "json";
}

function normalizeSnapshotLimit(value: string | null) {
  if (!value) {
    return undefined;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function jsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
