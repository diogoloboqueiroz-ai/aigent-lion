import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  companyRouteJson,
  requireCompanyRouteAccess,
  requireResolvedCompanyRoutePermission
} from "@/lib/api/company-route-auth";
import { upsertStoredCompanyDataOpsProfile } from "@/lib/company-vault";
import { getCompanyWorkspace } from "@/lib/connectors";
import { parseDataOpsForm } from "@/lib/data-ops";
import { syncCompanyGoogleDataOps } from "@/lib/google-data";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

export async function GET(
  _request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  const access = await requireCompanyRouteAccess({
    companyId,
    permission: "agent:decide"
  });

  if (!access.ok) {
    return access.response;
  }

  return companyRouteJson(
    {
      dataOps: access.workspace.dataOpsProfile
    }
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);

  if (!session) {
    return NextResponse.redirect(new URL("/?auth=login-required", request.url), { status: 303 });
  }

  const professionalProfile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(companyId, professionalProfile);

  if (!workspace) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "save-profile");
  const forbidden = requireResolvedCompanyRoutePermission({
    workspace,
    profile: professionalProfile,
    session,
    permission: intent === "sync-now" ? "execution:apply" : "agent:decide"
  });

  if (forbidden) {
    return forbidden;
  }

  if (intent === "sync-now") {
    const sync = await syncCompanyGoogleDataOps(workspace);
    const search = new URLSearchParams({
      saved: "sync"
    });

    if (sync.failedPlatforms > 0 || sync.blockedPlatforms > 0) {
      search.set("syncStatus", sync.summary);
    }

    return NextResponse.redirect(new URL(`/empresas/${companyId}/dados?${search.toString()}`, request.url), {
      status: 303
    });
  }

  upsertStoredCompanyDataOpsProfile(parseDataOpsForm(formData, workspace.dataOpsProfile));

  return NextResponse.redirect(new URL(`/empresas/${companyId}/dados?saved=1`, request.url), { status: 303 });
}
