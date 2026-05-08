import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  companyRouteJson,
  requireCompanyRouteAccess,
  requireResolvedCompanyRoutePermission
} from "@/lib/api/company-route-auth";
import { getCompanyWorkspace } from "@/lib/connectors";
import { upsertStoredCompanyStrategy } from "@/lib/company-vault";
import { getSessionFromCookies } from "@/lib/session";
import { parsePlatformEntries, parseStrategicCompetitors, textareaToList } from "@/lib/strategy";
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
      strategy: access.workspace.strategyPlan
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
    permission: "agent:decide"
  });

  if (forbidden) {
    return forbidden;
  }

  const formData = await request.formData();
  upsertStoredCompanyStrategy({
    ...workspace.strategyPlan,
    status: "customized",
    updatedAt: new Date().toISOString(),
    planningHorizon: String(formData.get("planningHorizon") ?? ""),
    primaryObjective: String(formData.get("primaryObjective") ?? ""),
    secondaryObjective: String(formData.get("secondaryObjective") ?? ""),
    monthlyBudget: String(formData.get("monthlyBudget") ?? ""),
    reachGoal: String(formData.get("reachGoal") ?? ""),
    leadGoal: String(formData.get("leadGoal") ?? ""),
    revenueGoal: String(formData.get("revenueGoal") ?? ""),
    cpaTarget: String(formData.get("cpaTarget") ?? ""),
    roasTarget: String(formData.get("roasTarget") ?? ""),
    priorityChannels: parsePlatformEntries(String(formData.get("priorityChannels") ?? "")),
    priorityMarkets: textareaToList(formData.get("priorityMarkets")),
    strategicInitiatives: textareaToList(formData.get("strategicInitiatives")),
    dailyRituals: textareaToList(formData.get("dailyRituals")),
    weeklyRituals: textareaToList(formData.get("weeklyRituals")),
    risksToWatch: textareaToList(formData.get("risksToWatch")),
    userAlignmentNotes: String(formData.get("userAlignmentNotes") ?? ""),
    competitors: parseStrategicCompetitors(formData.get("competitors"))
  });

  return NextResponse.redirect(new URL(`/empresas/${companyId}/planejamento?saved=1`, request.url), { status: 303 });
}
