import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  approvePublishingRequest,
  getCompanyPublishingRequests,
  markPublishingRequestPosted,
  rejectPublishingRequest,
  syncCreativeAssetVersionStatus
} from "@/lib/creative-tools";
import { getCompanyWorkspace } from "@/lib/connectors";
import {
  upsertStoredCompanyCreativeAsset,
  getStoredScheduledSocialPosts,
  upsertStoredPublishingApprovalRequest,
  upsertStoredScheduledSocialPost
} from "@/lib/company-vault";
import { recordCompanyAuditEvent } from "@/lib/governance";
import { buildScheduledSocialPostFromPublishingRequest } from "@/lib/social-ops";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

export async function POST(
  request: Request,
  context: { params: Promise<{ companyId: string; requestId: string }> }
) {
  const { companyId, requestId } = await context.params;
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

  const currentRequest = getCompanyPublishingRequests(workspace.company.slug).find(
    (entry) => entry.id === requestId
  );

  if (!currentRequest) {
    return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "approve");

  if (intent === "create-social-post") {
    if (currentRequest.status !== "approved") {
      return NextResponse.redirect(new URL(`/empresas/${companyId}/studio?decision=approval-required`, request.url), {
        status: 303
      });
    }

    const existingPost = getStoredScheduledSocialPosts(companyId).find(
      (entry) => entry.sourceApprovalRequestId === currentRequest.id
    );

    if (existingPost) {
      return NextResponse.redirect(new URL(`/empresas/${companyId}/social?post=already-linked`, request.url), {
        status: 303
      });
    }

    upsertStoredScheduledSocialPost(
      buildScheduledSocialPostFromPublishingRequest({
        company: workspace.company,
        request: currentRequest,
        sourceAsset: currentRequest.sourceAssetId
          ? workspace.creativeAssets.find((asset) => asset.id === currentRequest.sourceAssetId)
          : undefined,
        requestedBy: session.email
      })
    );
    const sourceAsset = currentRequest.sourceAssetId
      ? workspace.creativeAssets.find((asset) => asset.id === currentRequest.sourceAssetId)
      : undefined;
    if (sourceAsset) {
      upsertStoredCompanyCreativeAsset(
        syncCreativeAssetVersionStatus(sourceAsset, currentRequest.sourceAssetVersionId, "approved")
      );
    }
    recordCompanyAuditEvent({
      companySlug: workspace.company.slug,
      connector: "system",
      kind: "decision",
      title: "Studio enviou ativo ao Social Ops",
      details: `O pedido ${currentRequest.title} foi convertido em post operacional por ${session.email}.`
    });

    return NextResponse.redirect(new URL(`/empresas/${companyId}/social?post=from-studio`, request.url), {
      status: 303
    });
  }

  const nextRequest =
    intent === "reject"
      ? rejectPublishingRequest(currentRequest)
      : intent === "mark-posted"
        ? markPublishingRequestPosted(currentRequest)
        : approvePublishingRequest(currentRequest);

  upsertStoredPublishingApprovalRequest(nextRequest);
  const sourceAsset = nextRequest.sourceAssetId
    ? workspace.creativeAssets.find((asset) => asset.id === nextRequest.sourceAssetId)
    : undefined;

  if (sourceAsset) {
    const nextStatus =
      intent === "mark-posted"
        ? "published"
        : intent === "reject"
          ? "draft"
          : "approved";
    upsertStoredCompanyCreativeAsset(
      syncCreativeAssetVersionStatus(sourceAsset, nextRequest.sourceAssetVersionId, nextStatus)
    );
  }
  recordCompanyAuditEvent({
    companySlug: workspace.company.slug,
    connector: "system",
    kind: intent === "reject" ? "warning" : "decision",
    title: `Studio registrou decisao ${nextRequest.status}`,
    details: `O pedido ${nextRequest.title} foi marcado como ${nextRequest.status} por ${session.email}.`,
    priority: intent === "reject" ? "medium" : "low"
  });

  return NextResponse.redirect(new URL(`/empresas/${companyId}/studio?decision=${nextRequest.status}`, request.url), {
    status: 303
  });
}
