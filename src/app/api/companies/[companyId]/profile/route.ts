import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildSystemPrompt, getCompanyAgentProfile, parsePlatformList, textareaToList } from "@/lib/agent-profiles";
import { upsertStoredCompanyProfile } from "@/lib/company-vault";
import { getCompanyWorkspace } from "@/lib/connectors";
import { getSessionFromCookies } from "@/lib/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  const workspace = getCompanyWorkspace(companyId);

  if (!workspace) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
  }

  return NextResponse.json(
    {
      profile: workspace.agentProfile
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  const workspace = getCompanyWorkspace(companyId);
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);

  if (!session) {
    return NextResponse.redirect(new URL(`/?auth=login-required`, request.url));
  }

  if (!workspace) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
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
