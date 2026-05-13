import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getCompanyPublishingRequests,
  markPublishingRequestPosted,
  syncCreativeAssetVersionStatus
} from "@/lib/creative-tools";
import { getCompanyWorkspace } from "@/lib/connectors";
import {
  upsertStoredCompanyCreativeAsset,
  getStoredScheduledSocialPosts,
  getStoredSocialAdDrafts,
  upsertStoredPublishingApprovalRequest,
  upsertStoredScheduledSocialPost,
  upsertStoredSocialAdDraft,
  upsertStoredSocialRuntimeTask
} from "@/lib/company-vault";
import type { SocialPlatformId } from "@/lib/domain";
import {
  approveScheduledSocialPost,
  approveSocialAdDraft,
  markScheduledSocialPostPosted,
  rejectScheduledSocialPost,
  rejectSocialAdDraft
} from "@/lib/social-ops";
import { buildSocialRuntimeTaskForAd, getCompanySocialBinding } from "@/lib/social-runtime";
import { requireCompanyPermission } from "@/lib/rbac";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

export async function POST(
  request: Request,
  context: { params: Promise<{ companyId: string; itemId: string }> }
) {
  const { companyId, itemId } = await context.params;
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
    permission: "governance:review",
    actor: session.email
  });

  if (!permissionCheck.allowed) {
    return NextResponse.json(
      { error: permissionCheck.message, auditId: permissionCheck.auditId },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "approve");

  if (itemId.startsWith("social-post-")) {
    const post = getStoredScheduledSocialPosts(companyId).find((entry) => entry.id === itemId);

    if (!post) {
      return NextResponse.json({ error: "Post nao encontrado" }, { status: 404 });
    }

    const nextPost =
      intent === "approve"
        ? approveScheduledSocialPost(post)
        : intent === "mark-posted"
          ? markScheduledSocialPostPosted(post)
          : rejectScheduledSocialPost(post);

    upsertStoredScheduledSocialPost(nextPost);

    if (intent === "mark-posted" && nextPost.sourceApprovalRequestId) {
      const linkedPublishingRequest = getCompanyPublishingRequests(companyId).find(
        (entry) => entry.id === nextPost.sourceApprovalRequestId
      );

      if (linkedPublishingRequest && linkedPublishingRequest.status !== "posted") {
        upsertStoredPublishingApprovalRequest(markPublishingRequestPosted(linkedPublishingRequest));
        if (linkedPublishingRequest.sourceAssetId) {
          const sourceAsset = workspace.creativeAssets.find((asset) => asset.id === linkedPublishingRequest.sourceAssetId);
          if (sourceAsset) {
            upsertStoredCompanyCreativeAsset(
              syncCreativeAssetVersionStatus(
                sourceAsset,
                linkedPublishingRequest.sourceAssetVersionId,
                "published"
              )
            );
          }
        }
      }
    }

    return NextResponse.redirect(new URL(`/empresas/${companyId}/social?decision=${intent}`, request.url), {
      status: 303
    });
  }

  const draft = getStoredSocialAdDrafts(companyId).find((entry) => entry.id === itemId);

  if (!draft) {
    return NextResponse.json({ error: "Anuncio nao encontrado" }, { status: 404 });
  }

  if (intent === "queue-runtime" || intent === "launch") {
    const binding = getCompanySocialBinding(
      workspace.company,
      draft.platform as SocialPlatformId,
      workspace.socialPlatforms
    );

    upsertStoredSocialRuntimeTask(buildSocialRuntimeTaskForAd(draft, binding, session.email));

    return NextResponse.redirect(new URL(`/empresas/${companyId}/social/runtime?queued=ad`, request.url), {
      status: 303
    });
  }

  const nextDraft =
    intent === "approve"
      ? approveSocialAdDraft(draft)
      : rejectSocialAdDraft(draft);

  upsertStoredSocialAdDraft(nextDraft);

  return NextResponse.redirect(new URL(`/empresas/${companyId}/social?decision=${intent}`, request.url), {
    status: 303
  });
}
