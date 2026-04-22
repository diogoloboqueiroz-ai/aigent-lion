import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getStoredScheduledSocialPosts,
  getStoredSocialAdDrafts,
  upsertStoredSocialPlatformBinding,
  upsertStoredSocialRuntimeTask
} from "@/lib/company-vault";
import { getCompanyWorkspace } from "@/lib/connectors";
import type { SocialPlatformId } from "@/lib/domain";
import { executeSocialRuntimeBatch } from "@/lib/social-execution";
import {
  buildSocialRuntimeSyncTask,
  buildSocialRuntimeTaskForAd,
  buildSocialRuntimeTaskForPost,
  getCompanySocialBinding,
  parseSocialBindingForm
} from "@/lib/social-runtime";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

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
      summary: workspace.socialRuntime,
      bindings: workspace.socialBindings,
      tasks: workspace.socialRuntimeTasks,
      logs: workspace.socialExecutionLogs
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
  const intent = String(formData.get("intent") ?? "save-binding");
  const runtimeBaseUrl = new URL(`/empresas/${companyId}/social/runtime`, request.url);

  if (intent === "save-binding") {
    const platform = String(formData.get("platform") ?? "") as SocialPlatformId;
    if (!workspace.socialPlatforms.some((entry) => entry.platform === platform)) {
      return NextResponse.json({ error: "Plataforma invalida" }, { status: 400 });
    }

    const currentBinding = getCompanySocialBinding(workspace.company, platform, workspace.socialPlatforms);
    upsertStoredSocialPlatformBinding(parseSocialBindingForm(formData, currentBinding));

    runtimeBaseUrl.searchParams.set("saved", "1");
    return NextResponse.redirect(runtimeBaseUrl, { status: 303 });
  }

  if (intent === "queue-post") {
    const itemId = String(formData.get("itemId") ?? "");
    const post = getStoredScheduledSocialPosts(companyId).find((entry) => entry.id === itemId);

    if (!post) {
      return NextResponse.json({ error: "Post nao encontrado" }, { status: 404 });
    }

    const binding = getCompanySocialBinding(workspace.company, post.platform, workspace.socialPlatforms);
    upsertStoredSocialRuntimeTask(buildSocialRuntimeTaskForPost(post, binding, session.email));

    runtimeBaseUrl.searchParams.set("queued", "post");
    return NextResponse.redirect(runtimeBaseUrl, { status: 303 });
  }

  if (intent === "queue-ad") {
    const itemId = String(formData.get("itemId") ?? "");
    const draft = getStoredSocialAdDrafts(companyId).find((entry) => entry.id === itemId);

    if (!draft) {
      return NextResponse.json({ error: "Anuncio nao encontrado" }, { status: 404 });
    }

    const binding = getCompanySocialBinding(workspace.company, draft.platform, workspace.socialPlatforms);
    upsertStoredSocialRuntimeTask(buildSocialRuntimeTaskForAd(draft, binding, session.email));

    runtimeBaseUrl.searchParams.set("queued", "ad");
    return NextResponse.redirect(runtimeBaseUrl, { status: 303 });
  }

  if (intent === "queue-ready-posts" || intent === "queue-ready-ads" || intent === "queue-ready-syncs" || intent === "queue-ready-all") {
    let queuedCount = 0;

    if (intent === "queue-ready-posts" || intent === "queue-ready-all") {
      for (const post of workspace.scheduledPosts.filter((entry) => entry.status === "scheduled")) {
        const binding = getCompanySocialBinding(workspace.company, post.platform, workspace.socialPlatforms);
        upsertStoredSocialRuntimeTask(buildSocialRuntimeTaskForPost(post, binding, session.email));
        queuedCount += 1;
      }
    }

    if (intent === "queue-ready-ads" || intent === "queue-ready-all") {
      for (const draft of workspace.socialAdDrafts.filter((entry) => entry.status === "approved")) {
        const binding = getCompanySocialBinding(workspace.company, draft.platform, workspace.socialPlatforms);
        upsertStoredSocialRuntimeTask(buildSocialRuntimeTaskForAd(draft, binding, session.email));
        queuedCount += 1;
      }
    }

    if (intent === "queue-ready-syncs" || intent === "queue-ready-all") {
      for (const binding of workspace.socialBindings.filter((entry) => entry.analyticsReady)) {
        upsertStoredSocialRuntimeTask(
          buildSocialRuntimeSyncTask(companyId, binding.platform, binding, session.email)
        );
        queuedCount += 1;
      }
    }

    runtimeBaseUrl.searchParams.set("queued", `${intent}:${queuedCount}`);
    return NextResponse.redirect(runtimeBaseUrl, { status: 303 });
  }

  if (intent === "execute-queued") {
    const queuedTasks = workspace.socialRuntimeTasks.filter((entry) => entry.status === "queued");
    const batch = await executeSocialRuntimeBatch(workspace.company, queuedTasks, session.email);

    runtimeBaseUrl.searchParams.set(
      "executed",
      `${batch.total}:${batch.completed}:${batch.blocked}:${batch.failed}`
    );
    return NextResponse.redirect(runtimeBaseUrl, { status: 303 });
  }

  const platform = String(formData.get("platform") ?? "") as SocialPlatformId;
  if (!workspace.socialPlatforms.some((entry) => entry.platform === platform)) {
    return NextResponse.json({ error: "Plataforma invalida" }, { status: 400 });
  }

  const binding = getCompanySocialBinding(workspace.company, platform, workspace.socialPlatforms);
  upsertStoredSocialRuntimeTask(buildSocialRuntimeSyncTask(companyId, platform, binding, session.email));

  runtimeBaseUrl.searchParams.set("queued", "sync");
  return NextResponse.redirect(runtimeBaseUrl, { status: 303 });
}
