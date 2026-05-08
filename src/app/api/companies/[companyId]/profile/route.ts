import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildSystemPrompt, getCompanyAgentProfile, parsePlatformList, textareaToList } from "@/lib/agent-profiles";
import {
  companyRouteJson,
  requireCompanyRouteAccess,
  requireResolvedCompanyRoutePermission
} from "@/lib/api/company-route-auth";
import { upsertStoredCompanyProfile } from "@/lib/company-vault";
import { getCompanyWorkspace } from "@/lib/connectors";
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
      profile: access.workspace.agentProfile
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
    return NextResponse.redirect(new URL(`/?auth=login-required`, request.url));
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
    permission: "agent:decide"
  });

  if (forbidden) {
    return forbidden;
  }

  const formData = await request.formData();
  const currentProfile = getCompanyAgentProfile(workspace.company);

  const nextProfile = {
    ...currentProfile,
    trainingStatus: "customized" as const,
    updatedAt: new Date().toISOString(),
    businessSummary: String(formData.get("businessSummary") ?? ""),
    brandVoice: String(formData.get("brandVoice") ?? ""),
    idealCustomerProfile: String(formData.get("idealCustomerProfile") ?? ""),
    offerStrategy: String(formData.get("offerStrategy") ?? ""),
    differentiators: textareaToList(formData.get("differentiators")),
    approvedChannels: parsePlatformList(formData.get("approvedChannels")),
    contentPillars: textareaToList(formData.get("contentPillars")),
    geoFocus: textareaToList(formData.get("geoFocus")),
    conversionEvents: textareaToList(formData.get("conversionEvents")),
    efficiencyRules: textareaToList(formData.get("efficiencyRules")),
    forbiddenClaims: textareaToList(formData.get("forbiddenClaims")),
    operatorNotes: String(formData.get("operatorNotes") ?? "")
  };

  upsertStoredCompanyProfile({
    ...nextProfile,
    systemPrompt: buildSystemPrompt(nextProfile)
  });

  return NextResponse.redirect(new URL(`/empresas/${companyId}/perfil?saved=1`, request.url), { status: 303 });
}
