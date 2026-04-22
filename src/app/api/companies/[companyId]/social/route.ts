import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  upsertStoredCompanySocialProfile,
  upsertStoredScheduledSocialPost,
  upsertStoredSocialAdDraft
} from "@/lib/company-vault";
import { getCompanyWorkspace } from "@/lib/connectors";
import {
  buildScheduledSocialPost,
  buildScheduledSocialPostFromCreativeAsset,
  buildSocialAdDraft,
  buildSocialAdDraftFromCreativeAsset,
  getCompanyScheduledPosts,
  getCompanySocialAdDrafts,
  getCompanySocialInsights,
  getCompanySocialOpsProfile,
  getCompanySocialPlatforms,
  parseSocialProfileForm
} from "@/lib/social-ops";
import {
  getCompanySocialBindings,
  getCompanySocialRuntimeSummary,
  getCompanySocialRuntimeTasks
} from "@/lib/social-runtime";
import type { ScheduledSocialPost, SocialPlatformId } from "@/lib/domain";
import { recordCompanyAuditEvent } from "@/lib/governance";
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
      profile: getCompanySocialOpsProfile(workspace.company),
      platforms: getCompanySocialPlatforms(workspace.company),
      scheduledPosts: getCompanyScheduledPosts(workspace.company.slug),
      adDrafts: getCompanySocialAdDrafts(workspace.company.slug),
      insights: getCompanySocialInsights(workspace.company),
      bindings: workspace.socialBindings,
      runtime: workspace.socialRuntime,
      runtimeTasks: getCompanySocialRuntimeTasks(workspace.company.slug),
      runtimeSummary: getCompanySocialRuntimeSummary(
        workspace.company.slug,
        getCompanySocialBindings(workspace.company, getCompanySocialPlatforms(workspace.company)),
        getCompanySocialRuntimeTasks(workspace.company.slug)
      )
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
  const intent = String(formData.get("intent") ?? "save-profile");

  if (intent === "save-profile") {
    upsertStoredCompanySocialProfile(parseSocialProfileForm(formData, workspace.socialProfile));

    return NextResponse.redirect(new URL(`/empresas/${companyId}/social?saved=1`, request.url), {
      status: 303
    });
  }

  if (intent === "create-post") {
    upsertStoredScheduledSocialPost(
      buildScheduledSocialPost({
        company: workspace.company,
        platform: String(formData.get("platform") ?? "instagram") as SocialPlatformId,
        title: String(formData.get("title") ?? "Novo post programado"),
        format: String(formData.get("format") ?? "image") as ScheduledSocialPost["format"],
        scheduledFor: String(formData.get("scheduledFor") ?? new Date().toISOString()),
        createdWith: String(formData.get("createdWith") ?? "canva") as ScheduledSocialPost["createdWith"],
        summary: String(formData.get("summary") ?? ""),
        caption: String(formData.get("caption") ?? "").trim() || undefined,
        assetUrl: String(formData.get("assetUrl") ?? "").trim() || undefined,
        assetUrls: parseTextareaList(formData.get("assetUrls")),
        landingUrl: String(formData.get("landingUrl") ?? "").trim() || undefined,
        requestedBy: session.email
      })
    );

    return NextResponse.redirect(new URL(`/empresas/${companyId}/social?post=1`, request.url), {
      status: 303
    });
  }

  if (intent === "create-post-from-asset") {
    const assetId = String(formData.get("assetId") ?? "").trim();
    const asset = workspace.creativeAssets.find((entry) => entry.id === assetId);

    if (!asset) {
      return NextResponse.json({ error: "Asset do Studio nao encontrado" }, { status: 404 });
    }

    const post = buildScheduledSocialPostFromCreativeAsset({
      company: workspace.company,
      asset,
      requestedBy: session.email
    });
    const duplicate = getCompanyScheduledPosts(workspace.company.slug).find(
      (entry) =>
        entry.sourceAssetVersionId === post.sourceAssetVersionId &&
        entry.platform === post.platform &&
        entry.status !== "rejected"
    );

    if (duplicate) {
      return NextResponse.redirect(new URL(`/empresas/${companyId}/social?post=already-linked`, request.url), {
        status: 303
      });
    }

    upsertStoredScheduledSocialPost(post);
    recordCompanyAuditEvent({
      companySlug: workspace.company.slug,
      connector: "system",
      kind: "decision",
      title: "Studio virou draft social",
      details: `${asset.title} foi convertido em post operacional para ${post.platform} por ${session.email}.`,
      priority: post.sourceExperimentId ? "medium" : undefined
    });

    return NextResponse.redirect(new URL(`/empresas/${companyId}/social?post=studio-asset`, request.url), {
      status: 303
    });
  }

  if (intent === "create-ad-from-asset") {
    const assetId = String(formData.get("assetId") ?? "").trim();
    const asset = workspace.creativeAssets.find((entry) => entry.id === assetId);

    if (!asset) {
      return NextResponse.json({ error: "Asset do Studio nao encontrado" }, { status: 404 });
    }

    const draft = buildSocialAdDraftFromCreativeAsset({
      company: workspace.company,
      asset,
      requestedBy: session.email
    });
    const duplicate = getCompanySocialAdDrafts(workspace.company.slug).find(
      (entry) =>
        entry.sourceAssetVersionId === draft.sourceAssetVersionId &&
        entry.platform === draft.platform &&
        entry.status !== "rejected"
    );

    if (duplicate) {
      return NextResponse.redirect(new URL(`/empresas/${companyId}/social?ad=already-linked`, request.url), {
        status: 303
      });
    }

    upsertStoredSocialAdDraft(draft);
    recordCompanyAuditEvent({
      companySlug: workspace.company.slug,
      connector: "system",
      kind: "decision",
      title: "Studio virou draft de anuncio",
      details: `${asset.title} foi convertido em anuncio operacional para ${draft.platform} por ${session.email}.`,
      priority: draft.sourceExperimentId ? "medium" : undefined
    });

    return NextResponse.redirect(new URL(`/empresas/${companyId}/social?ad=studio-asset`, request.url), {
      status: 303
    });
  }

  if (intent === "create-ad") {
    upsertStoredSocialAdDraft(
      buildSocialAdDraft({
        company: workspace.company,
        platform: String(formData.get("platform") ?? "instagram") as SocialPlatformId,
        title: String(formData.get("title") ?? "Novo anuncio"),
        objective: String(formData.get("objective") ?? "Leads"),
        budget: String(formData.get("budget") ?? "Definir"),
        audience: String(formData.get("audience") ?? ""),
        creativeAngle: String(formData.get("creativeAngle") ?? ""),
        callToAction: String(formData.get("callToAction") ?? ""),
        headline: String(formData.get("headline") ?? "").trim() || undefined,
        description: String(formData.get("description") ?? "").trim() || undefined,
        assetUrl: String(formData.get("assetUrl") ?? "").trim() || undefined,
        assetUrls: parseTextareaList(formData.get("assetUrls")),
        landingUrl: String(formData.get("landingUrl") ?? "").trim() || undefined,
        keywordThemes: parseTextareaList(formData.get("keywordThemes")),
        scheduledStart: String(formData.get("scheduledStart") ?? new Date().toISOString()),
        requestedBy: session.email
      })
    );

    return NextResponse.redirect(new URL(`/empresas/${companyId}/social?ad=1`, request.url), {
      status: 303
    });
  }

  return NextResponse.redirect(new URL(`/empresas/${companyId}/social?decision=unsupported-intent`, request.url), {
    status: 303
  });
}

function parseTextareaList(value: FormDataEntryValue | null) {
  const items = String(value ?? "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return items.length > 0 ? items : undefined;
}
