import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  runAigentLionSupremeBrain
} from "@/core/aigent-lion/supreme-brain";
import type {
  AigentLionAutonomy,
  AigentLionIntent
} from "@/core/aigent-lion/types";
import { getCompanyWorkspace } from "@/lib/connectors";
import { requireCompanyPermission } from "@/lib/rbac";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

const INTENTS = new Set<AigentLionIntent>([
  "diagnose",
  "plan",
  "campaign",
  "creative",
  "analytics",
  "execute",
  "learn",
  "mission_control",
  "auto"
]);

const AUTONOMY_MODES = new Set<AigentLionAutonomy>([
  "advisory",
  "auto_low_risk",
  "approval_required"
]);

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

  const permissionCheck = requireCompanyPermission({
    companySlug: workspace.company.slug,
    profile: professionalProfile,
    permission: "agent:decide",
    actor: session.email
  });

  if (!permissionCheck.allowed) {
    return jsonResponse({ error: permissionCheck.message, auditId: permissionCheck.auditId }, 403);
  }

  const payload = await request.json().catch(() => null);
  const message = typeof payload?.message === "string" ? payload.message.trim() : "";

  if (!message) {
    return jsonResponse({ error: "Mensagem obrigatoria" }, 400);
  }

  const brain = await runAigentLionSupremeBrain({
    companyId: workspace.company.slug,
    actor: session.email,
    message,
    intent: normalizeIntent(payload?.intent),
    autonomy: normalizeAutonomy(payload?.autonomy),
    context: isRecord(payload?.context) ? payload.context : undefined,
    professionalProfile: professionalProfile ?? undefined
  });

  return jsonResponse({
    success: brain.success,
    answer: brain.answer,
    executiveSummary: brain.executiveSummary,
    agentsUsed: brain.agentsUsed,
    artifacts: brain.artifacts,
    nextBestActions: brain.nextBestActions,
    approvalsRequired: brain.approvalsRequired,
    risks: brain.risks,
    confidence: brain.confidence
  });
}

function normalizeIntent(value: unknown): AigentLionIntent {
  return typeof value === "string" && INTENTS.has(value as AigentLionIntent)
    ? (value as AigentLionIntent)
    : "auto";
}

function normalizeAutonomy(value: unknown): AigentLionAutonomy {
  return typeof value === "string" && AUTONOMY_MODES.has(value as AigentLionAutonomy)
    ? (value as AigentLionAutonomy)
    : "advisory";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
