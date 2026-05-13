import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildTriggerEvent,
  runAgentDiagnostics
} from "@/lib/agents/orchestrator";
import type { TriggerEventType } from "@/lib/agents/types";
import { getCompanyWorkspace } from "@/lib/connectors";
import { requireCompanyPermission } from "@/lib/rbac";
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

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);

  if (!session) {
    return jsonResponse({ error: "Sessao invalida" }, 401);
  }

  const payload = await request.json().catch(() => null);
  const companyId = typeof payload?.companyId === "string" ? payload.companyId.trim() : "";

  if (!companyId) {
    return jsonResponse({ error: "companyId e obrigatorio" }, 400);
  }

  const professionalProfile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(companyId, professionalProfile);

  if (!workspace) {
    return jsonResponse({ error: "Empresa nao encontrada" }, 404);
  }

  const permissionCheck = requireCompanyPermission({
    companySlug: workspace.company.slug,
    profile: professionalProfile,
    permission: "agent:decide",
    actor: session.email
  });
  if (!permissionCheck.allowed) {
    return jsonResponse({ error: permissionCheck.message, auditId: permissionCheck.auditId }, 403);
  }

  const trigger = buildTriggerEvent(workspace.company.slug, {
    triggerType: normalizeTriggerType(payload?.triggerType) ?? "api_preview",
    actor: typeof payload?.actor === "string" ? payload.actor : session.email,
    summary: typeof payload?.summary === "string" ? payload.summary : undefined
  });
  const diagnosticResult = runAgentDiagnostics({
    workspace,
    trigger,
    actor: trigger.actor
  });

  return jsonResponse({
    context: diagnosticResult.context,
    findings: diagnosticResult.findings
  });
}

function normalizeTriggerType(value: unknown): TriggerEventType | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return TRIGGER_TYPES.includes(value as TriggerEventType) ? (value as TriggerEventType) : undefined;
}

function jsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
