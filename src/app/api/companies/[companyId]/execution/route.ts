import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { companyRouteJson, requireCompanyRouteAccess } from "@/lib/api/company-route-auth";
import { getCompanyWorkspace } from "@/lib/connectors";
import {
  generateCompanyExecutionPlan,
  materializeExecutionPlanActions,
  saveCompanyExecutionPlan,
  syncOperationalAlerts
} from "@/lib/execution";
import { recordCompanyAuditEvent } from "@/lib/governance";
import { syncCompanyGoogleDataOps } from "@/lib/google-data";
import { syncCompanyLearningMemory } from "@/lib/learning";
import { deliverOperationalAlertEmails } from "@/lib/operational-alerts";
import { requireCompanyPermission } from "@/lib/rbac";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

export async function GET(
  _request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  const access = await requireCompanyRouteAccess({
    companyId,
    permission: "execution:generate"
  });

  if (!access.ok) {
    return access.response;
  }

  return companyRouteJson(
    {
      executionPlans: access.workspace.executionPlans
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
  const intent = String(formData.get("intent") ?? "generate-plan");
  const requiredPermission =
    intent === "apply-auto"
      ? "execution:apply"
      : intent === "sync-learning"
        ? "agent:learn"
        : "execution:generate";
  const permissionCheck = requireCompanyPermission({
    companySlug: workspace.company.slug,
    profile: professionalProfile,
    permission: requiredPermission,
    actor: session.email
  });

  if (!permissionCheck.allowed) {
    return NextResponse.json(
      { error: permissionCheck.message, auditId: permissionCheck.auditId },
      { status: 403 }
    );
  }

  if (intent === "sync-learning") {
    syncCompanyLearningMemory({
      workspace
    });
    recordCompanyAuditEvent({
      companySlug: workspace.company.slug,
      connector: "system",
      kind: "info",
      title: "Memoria operacional atualizada",
      details: `O learning loop foi rodado manualmente por ${session.email}.`
    });

    return NextResponse.redirect(new URL(`/empresas/${companyId}/operacao?learned=1`, request.url), {
      status: 303
    });
  }

  await syncCompanyGoogleDataOps(workspace);
  const latestWorkspace = getCompanyWorkspace(companyId, professionalProfile) ?? workspace;
  const plan = generateCompanyExecutionPlan(latestWorkspace, professionalProfile, {
    origin: "manual"
  });
  const finalPlan =
    intent === "apply-auto"
      ? materializeExecutionPlanActions(latestWorkspace, plan, session.email, professionalProfile)
      : plan;

  saveCompanyExecutionPlan(finalPlan);
  const alerts = syncOperationalAlerts({
    companySlug: workspace.company.slug,
    plan: finalPlan,
    schedulerMinimumPriority: latestWorkspace.schedulerProfile.schedulerAlertMinimumPriority,
    emailMinimumPriority: latestWorkspace.schedulerProfile.emailAlertMinimumPriority,
    emailReady: latestWorkspace.connections.some(
      (connection) => connection.platform === "gmail" && connection.status === "connected"
    )
  });
  await deliverOperationalAlertEmails({
    company: workspace.company,
    alerts,
    schedulerProfile: latestWorkspace.schedulerProfile,
    fallbackRecipientEmail: session.email,
    origin: new URL(request.url).origin
  });
  syncCompanyLearningMemory({
    workspace: latestWorkspace,
    latestPlan: finalPlan,
    alerts
  });
  recordCompanyAuditEvent({
    companySlug: workspace.company.slug,
    connector: "system",
    kind: intent === "apply-auto" ? "decision" : "info",
    title: intent === "apply-auto" ? "Plano operacional aplicado" : "Plano operacional gerado",
    details:
      intent === "apply-auto"
        ? `O Agent Lion aplicou as acoes seguras do plano ${finalPlan.id} por ${session.email}.`
        : `O plano ${finalPlan.id} foi gerado manualmente por ${session.email}.`
  });

  const search = new URLSearchParams({
    generated: "1"
  });

  if (intent === "apply-auto") {
    search.set("applied", "1");
  }

  return NextResponse.redirect(new URL(`/empresas/${companyId}/operacao?${search.toString()}`, request.url), {
    status: 303
  });
}
