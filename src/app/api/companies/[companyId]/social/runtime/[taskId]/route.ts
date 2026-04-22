import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCompanyWorkspace } from "@/lib/connectors";
import { getStoredSocialRuntimeTasks } from "@/lib/company-vault";
import { executeSocialRuntimeTask } from "@/lib/social-execution";
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
