import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCompanyWorkspace } from "@/lib/connectors";
import type { CompanyWorkspace, UserPermission, UserProfessionalProfile } from "@/lib/domain";
import { requireCompanyPermission } from "@/lib/rbac";
import { getSessionFromCookies, type UserSession } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

type CompanyRouteAccess =
  | {
      ok: true;
      session: UserSession;
      profile: UserProfessionalProfile | null;
      workspace: CompanyWorkspace;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireCompanyRouteAccess(input: {
  companyId: string;
  permission?: UserPermission;
}): Promise<CompanyRouteAccess> {
  const session = getSessionFromCookies(await cookies());

  if (!session) {
    return {
      ok: false,
      response: companyRouteJson({ error: "Sessao invalida" }, 401)
    };
  }

  const profile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(input.companyId, profile);

  if (!workspace) {
    return {
      ok: false,
      response: companyRouteJson({ error: "Empresa nao encontrada" }, 404)
    };
  }

  const permissionCheck = requireCompanyPermission({
    companySlug: workspace.company.slug,
    profile,
    permission: input.permission ?? "agent:decide",
    actor: session.email
  });

  if (!permissionCheck.allowed) {
    return {
      ok: false,
      response: companyRouteJson(
        { error: permissionCheck.message, auditId: permissionCheck.auditId },
        403
      )
    };
  }

  return {
    ok: true,
    session,
    profile,
    workspace
  };
}

export function requireResolvedCompanyRoutePermission(input: {
  workspace: CompanyWorkspace;
  profile: UserProfessionalProfile | null;
  session: Pick<UserSession, "email">;
  permission: UserPermission;
}) {
  const permissionCheck = requireCompanyPermission({
    companySlug: input.workspace.company.slug,
    profile: input.profile,
    permission: input.permission,
    actor: input.session.email
  });

  if (permissionCheck.allowed) {
    return null;
  }

  return companyRouteJson(
    { error: permissionCheck.message, auditId: permissionCheck.auditId },
    403
  );
}

export function companyRouteJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
