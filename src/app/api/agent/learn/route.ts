import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { learnFromAutomationRun } from "@/lib/agents/orchestrator";
import { getCompanyMemorySummary } from "@/lib/agents/memory-engine";
import type { AutomationRun } from "@/lib/agents/types";
import { getCompanyWorkspace } from "@/lib/connectors";
import { requireCompanyPermission } from "@/lib/rbac";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

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
    permission: "agent:learn",
    actor: session.email
  });
  if (!permissionCheck.allowed) {
    return jsonResponse({ error: permissionCheck.message, auditId: permissionCheck.auditId }, 403);
  }

  if (isAutomationRun(payload?.run)) {
    const learned = learnFromAutomationRun({
      workspace,
      run: payload.run
    });

    return jsonResponse(learned);
  }

  const memory = getCompanyMemorySummary(companyId, professionalProfile);

  return jsonResponse({
    companySlug: workspace.company.slug,
    learnings: memory?.learningRecords ?? [],
    memory: memory ?? null
  });
}

function isAutomationRun(value: unknown): value is AutomationRun {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AutomationRun>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.companySlug === "string" &&
    Array.isArray(candidate.outcomes) &&
    Array.isArray(candidate.diagnostics) &&
    Array.isArray(candidate.actions) &&
    Array.isArray(candidate.jobs)
  );
}

function jsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
