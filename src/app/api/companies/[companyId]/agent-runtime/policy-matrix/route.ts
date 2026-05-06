import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildSeedCompanyPolicyMatrix,
  normalizeCompanyPolicyMatrixInput
} from "@/core/policy/tenant-policy-matrix";
import { listCorePolicyRules } from "@/core/policy/policy-registry";
import {
  getActiveStoredCompanyPolicyMatrix,
  getStoredCompanyPolicyMatrices,
  upsertStoredCompanyPolicyMatrix
} from "@/lib/company-vault";
import { getCompanyWorkspace } from "@/lib/connectors";
import { recordCompanyAuditEvent } from "@/lib/governance";
import { requireCompanyPermission } from "@/lib/rbac";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

export async function GET(
  _request: Request,
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
    permission: "governance:review",
    actor: session.email
  });

  if (!permissionCheck.allowed) {
    return jsonResponse({ error: permissionCheck.message, auditId: permissionCheck.auditId }, 403);
  }

  const activeMatrix = getActiveStoredCompanyPolicyMatrix(workspace.company.slug);
  const seedPreview = activeMatrix
    ? undefined
    : buildSeedCompanyPolicyMatrix({
        workspace,
        actor: session.email,
        status: "draft"
      });

  return jsonResponse({
    matrix: activeMatrix ?? null,
    seedPreview,
    history: getStoredCompanyPolicyMatrices(workspace.company.slug),
    registry: listCorePolicyRules()
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

  const permissionCheck = requireCompanyPermission({
    companySlug: workspace.company.slug,
    profile: professionalProfile,
    permission: "governance:review",
    actor: session.email
  });

  if (!permissionCheck.allowed) {
    return jsonResponse({ error: permissionCheck.message, auditId: permissionCheck.auditId }, 403);
  }

  const payload = await request.json().catch(() => null);
  const intent = isRecord(payload) && payload.intent === "upsert" ? "upsert" : "seed";
  const previous = getActiveStoredCompanyPolicyMatrix(workspace.company.slug);
  const matrix =
    intent === "upsert"
      ? normalizeCompanyPolicyMatrixInput({
          companySlug: workspace.company.slug,
          actor: session.email,
          payload: payload?.matrix,
          previous
        })
      : buildSeedCompanyPolicyMatrix({
          workspace,
          actor: session.email,
          previous,
          status: isRecord(payload) && payload.status === "draft" ? "draft" : "active"
        });

  upsertStoredCompanyPolicyMatrix(matrix);
  const audit = recordCompanyAuditEvent({
    companySlug: workspace.company.slug,
    connector: "system",
    kind: "decision",
    title: "Policy matrix atualizada",
    details: `A policy matrix v${matrix.version} foi ${intent === "seed" ? "gerada" : "atualizada"} por ${session.email}. Status: ${matrix.status}.`
  });

  return jsonResponse({
    matrix,
    auditId: audit.id
  });
}

function jsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
