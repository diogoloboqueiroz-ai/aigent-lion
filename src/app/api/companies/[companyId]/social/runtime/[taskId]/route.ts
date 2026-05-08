import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCompanyWorkspace } from "@/lib/connectors";
import { getStoredSocialRuntimeTasks } from "@/lib/company-vault";
import { executeSocialRuntimeTask } from "@/lib/social-execution";
import { requireCompanyPermission } from "@/lib/rbac";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

export async function POST(
  request: Request,
  context: { params: Promise<{ companyId: string; taskId: string }> }
) {
  const { companyId, taskId } = await context.params;
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

  const permissionCheck = requireCompanyPermission({
    companySlug: workspace.company.slug,
    profile: professionalProfile,
    permission: "execution:apply",
    actor: session.email
  });

  if (!permissionCheck.allowed) {
    return NextResponse.json(
      { error: permissionCheck.message, auditId: permissionCheck.auditId },
      { status: 403 }
    );
  }

  const task = getStoredSocialRuntimeTasks(companyId).find((entry) => entry.id === taskId);

  if (!task) {
    return NextResponse.json({ error: "Tarefa operacional nao encontrada" }, { status: 404 });
  }

  const result = await executeSocialRuntimeTask(workspace.company, task, session.email);

  return NextResponse.redirect(
    new URL(
      `/empresas/${companyId}/social/runtime?decision=${result.task.status}&task=${encodeURIComponent(result.task.id)}`,
      request.url
    ),
    {
      status: 303
    }
  );
}
