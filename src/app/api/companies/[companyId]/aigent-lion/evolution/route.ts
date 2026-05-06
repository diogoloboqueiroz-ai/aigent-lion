import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildAigentEvolutionCenterSnapshot } from "@/core/aigent-lion/evolution-center";
import { getCompanyWorkspace } from "@/lib/connectors";
import { requireCompanyPermission } from "@/lib/rbac";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

export async function GET(
  request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  const url = new URL(request.url);
  return handleEvolutionRequest(companyId, url.searchParams.get("message") ?? "Aigent Evolution Center audit.");
}

export async function POST(
  request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  const payload = await request.json().catch(() => null);
  const message = typeof payload?.message === "string" ? payload.message : "Aigent Evolution Center audit.";

  return handleEvolutionRequest(companyId, message);
}

async function handleEvolutionRequest(companyId: string, message: string) {
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
    permission: "governance:review",
    actor: session.email
  });

  if (!permissionCheck.allowed) {
    return jsonResponse({ error: permissionCheck.message, auditId: permissionCheck.auditId }, 403);
  }

  const snapshot = await buildAigentEvolutionCenterSnapshot({
    companyId: workspace.company.slug,
    actor: session.email,
    message,
    intent: "mission_control",
    autonomy: "approval_required",
    professionalProfile: professionalProfile ?? undefined
  });

  if (!snapshot) {
    return jsonResponse({ error: "Snapshot nao encontrado" }, 404);
  }

  return jsonResponse({ success: true, snapshot });
}

function jsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
