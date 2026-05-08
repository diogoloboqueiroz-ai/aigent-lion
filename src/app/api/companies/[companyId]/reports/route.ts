import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  companyRouteJson,
  requireCompanyRouteAccess,
  requireResolvedCompanyRoutePermission
} from "@/lib/api/company-route-auth";
import { getCompanyWorkspace } from "@/lib/connectors";
import { generateCompanyReport, saveGeneratedCompanyReport } from "@/lib/reports";
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
      reports: access.workspace.reports
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
  const forbidden = requireResolvedCompanyRoutePermission({
    workspace,
    profile: professionalProfile,
    session,
    permission: "execution:generate"
  });

  if (forbidden) {
    return forbidden;
  }

  const formData = await request.formData();
  const type = String(formData.get("type") ?? "weekly_marketing");

  const report = generateCompanyReport(
    workspace,
    type === "daily_competitor" ? "daily_competitor" : "weekly_marketing",
    professionalProfile
  );

  saveGeneratedCompanyReport(report);

  return NextResponse.redirect(new URL(`/empresas/${companyId}/relatorios?generated=${report.type}`, request.url), {
    status: 303
  });
}
