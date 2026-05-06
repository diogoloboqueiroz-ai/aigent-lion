import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  approvePublishingRequest,
  getCompanyPublishingRequests,
  markPublishingRequestPosted,
  rejectPublishingRequest
} from "@/lib/creative-tools";
import { getCompanyWorkspace } from "@/lib/connectors";
import {
  getStoredPaymentApprovalRequests,
  getStoredScheduledSocialPosts,
  getStoredSocialAdDrafts,
  upsertStoredPaymentApprovalRequest,
  upsertStoredPublishingApprovalRequest,
  upsertStoredScheduledSocialPost,
  upsertStoredSocialAdDraft,
  upsertStoredSocialRuntimeTask
} from "@/lib/company-vault";
import { approvePaymentRequest, denyPaymentRequest } from "@/lib/payments";
import { recordCompanyAuditEvent } from "@/lib/governance";
import {
  buildSocialRuntimeTaskForAd,
  buildSocialRuntimeTaskForPost,
  getCompanySocialBinding
} from "@/lib/social-runtime";
import {
  buildScheduledSocialPostFromPublishingRequest,
  approveScheduledSocialPost,
  approveSocialAdDraft,
  markScheduledSocialPostPosted,
  rejectScheduledSocialPost,
  rejectSocialAdDraft
} from "@/lib/social-ops";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

export async function POST(
  request: Request,
  context: { params: Promise<{ companyId: string; approvalId: string }> }
) {
  const { companyId, approvalId } = await context.params;
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
  const intent = String(formData.get("intent") ?? "");

  if (approvalId.startsWith("payreq-")) {
    const paymentRequest = getStoredPaymentApprovalRequests(companyId).find((entry) => entry.id === approvalId);

    if (!paymentRequest) {
      return NextResponse.json({ error: "Solicitacao financeira nao encontrada" }, { status: 404 });
    }

    const nextRequest = intent === "deny" ? denyPaymentRequest(paymentRequest) : approvePaymentRequest(paymentRequest);
    upsertStoredPaymentApprovalRequest(nextRequest);
    return NextResponse.redirect(new URL(`/empresas/${companyId}/aprovacoes?decision=${nextRequest.status}`, request.url), {
      status: 303
    });
  }

  if (approvalId.startsWith("publish-")) {
    const publishingRequest = getCompanyPublishingRequests(companyId).find((entry) => entry.id === approvalId);

    if (!publishingRequest) {
      return NextResponse.json({ error: "Solicitacao de publicacao nao encontrada" }, { status: 404 });
    }

    if (intent === "create-social-post") {
      if (publishingRequest.status !== "approved") {
        return NextResponse.redirect(new URL(`/empresas/${companyId}/aprovacoes?decision=approval-required`, request.url), {
          status: 303
        });
      }

      const existingPost = getStoredScheduledSocialPosts(companyId).find(
        (entry) => entry.sourceApprovalRequestId === publishingRequest.id
      );

      if (existingPost) {
        return NextResponse.redirect(new URL(`/empresas/${companyId}/aprovacoes?decision=already-linked`, request.url), {
          status: 303
        });
      }

      upsertStoredScheduledSocialPost(
        buildScheduledSocialPostFromPublishingRequest({
          company: workspace.company,
          request: publishingRequest,
          sourceAsset: publishingRequest.sourceAssetId
            ? workspace.creativeAssets.find((asset) => asset.id === publishingRequest.sourceAssetId)
            : undefined,
          requestedBy: session.email
        })
      );

      return NextResponse.redirect(new URL(`/empresas/${companyId}/aprovacoes?decision=social-post-created`, request.url), {
        status: 303
      });
    }

    const nextRequest =
      intent === "reject"
        ? rejectPublishingRequest(publishingRequest)
        : intent === "mark-posted"
          ? markPublishingRequestPosted(publishingRequest)
          : approvePublishingRequest(publishingRequest);

    upsertStoredPublishingApprovalRequest(nextRequest);
    return NextResponse.redirect(new URL(`/empresas/${companyId}/aprovacoes?decision=${nextRequest.status}`, request.url), {
      status: 303
    });
  }

  if (approvalId.startsWith("social-post-")) {
    const post = getStoredScheduledSocialPosts(companyId).find((entry) => entry.id === approvalId);

    if (!post) {
      return NextResponse.json({ error: "Post social nao encontrado" }, { status: 404 });
    }

    if (intent === "queue-runtime") {
      if (post.status !== "scheduled") {
        return NextResponse.redirect(new URL(`/empresas/${companyId}/aprovacoes?decision=approval-required`, request.url), {
          status: 303
        });
      }

      const binding = getCompanySocialBinding(workspace.company, post.platform, workspace.socialPlatforms);
      const task = buildSocialRuntimeTaskForPost(post, binding, session.email);

      upsertStoredSocialRuntimeTask(task);
      recordCompanyAuditEvent({
        companySlug: workspace.company.slug,
        connector: "system",
        kind: "decision",
        title: "Post aprovado enviado para runtime",
        details: `O post ${post.id} foi enviado ao Social Runtime por ${session.email}. Status da tarefa: ${task.status}.`
      });

      return NextResponse.redirect(
        new URL(`/empresas/${companyId}/aprovacoes?decision=runtime-${task.status}`, request.url),
        {
          status: 303
        }
      );
    }

    const nextPost =
      intent === "reject"
        ? rejectScheduledSocialPost(post)
        : intent === "mark-posted"
          ? markScheduledSocialPostPosted(post)
          : approveScheduledSocialPost(post);

    upsertStoredScheduledSocialPost(nextPost);
    return NextResponse.redirect(new URL(`/empresas/${companyId}/aprovacoes?decision=${nextPost.status}`, request.url), {
      status: 303
    });
  }

  const draft = getStoredSocialAdDrafts(companyId).find((entry) => entry.id === approvalId);

  if (!draft) {
    return NextResponse.json({ error: "Anuncio social nao encontrado" }, { status: 404 });
  }

  if (intent === "queue-runtime") {
    const binding = getCompanySocialBinding(workspace.company, draft.platform, workspace.socialPlatforms);
    const task = buildSocialRuntimeTaskForAd(draft, binding, session.email);

    upsertStoredSocialRuntimeTask(task);
    recordCompanyAuditEvent({
      companySlug: workspace.company.slug,
      connector: "system",
      kind: "decision",
      title: "Anuncio aprovado enviado para runtime",
      details: `O draft ${draft.id} foi enviado ao Social Runtime por ${session.email}. Status da tarefa: ${task.status}.`
    });
    return NextResponse.redirect(
      new URL(`/empresas/${companyId}/aprovacoes?decision=runtime-${task.status}`, request.url),
      {
        status: 303
      }
    );
  }

  const nextDraft =
    intent === "reject"
      ? rejectSocialAdDraft(draft)
      : approveSocialAdDraft(draft);

  upsertStoredSocialAdDraft(nextDraft);
  return NextResponse.redirect(new URL(`/empresas/${companyId}/aprovacoes?decision=${nextDraft.status}`, request.url), {
    status: 303
  });
}
