import type {
  ApprovalCenterAction,
  ApprovalCenterItem,
  PaymentApprovalRequest,
  PublishingApprovalRequest,
  ScheduledSocialPost,
  SocialAdDraft
} from "@/lib/domain";

export function buildApprovalsCenter(input: {
  companySlug: string;
  paymentRequests: PaymentApprovalRequest[];
  publishingRequests: PublishingApprovalRequest[];
  scheduledPosts: ScheduledSocialPost[];
  socialAdDrafts: SocialAdDraft[];
}) {
  const linkedPostsByApprovalId = new Map(
    input.scheduledPosts
      .filter((post) => post.sourceApprovalRequestId)
      .map((post) => [post.sourceApprovalRequestId as string, post])
  );

  return [
    ...input.paymentRequests.map(mapPaymentApproval),
    ...input.publishingRequests.map((request) => mapPublishingApproval(request, linkedPostsByApprovalId.get(request.id))),
    ...input.scheduledPosts
      .filter((post) => post.status !== "draft")
      .map(mapSocialPostApproval),
    ...input.socialAdDrafts
      .filter((draft) => draft.status !== "draft")
      .map(mapSocialAdApproval)
  ].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

export function getPendingApprovalsCount(items: ApprovalCenterItem[]) {
  return items.filter((item) => item.actions.length > 0).length;
}

function mapPaymentApproval(request: PaymentApprovalRequest): ApprovalCenterItem {
  return {
    id: request.id,
    companySlug: request.companySlug,
    kind: "payment",
    status: request.status,
    title: request.title,
    requestedAt: request.requestedAt,
    requestedBy: request.requestedBy,
    summary: request.description,
    context: `${request.amount} ${request.currency}`,
    sourcePath: `/empresas/${request.companySlug}/pagamentos`,
    actions: request.status === "pending" ? (["approve", "deny"] satisfies ApprovalCenterAction[]) : []
  };
}

function mapPublishingApproval(request: PublishingApprovalRequest, linkedPost?: ScheduledSocialPost): ApprovalCenterItem {
  const status = linkedPost?.status === "posted" ? "posted" : request.status;
  const actions =
    request.status === "pending"
      ? (["approve", "reject"] satisfies ApprovalCenterAction[])
      : request.status === "approved" && !linkedPost
        ? (["create-social-post", "mark-posted"] satisfies ApprovalCenterAction[])
        : [];

  return {
    id: request.id,
    companySlug: request.companySlug,
    kind: "publishing",
    status,
    title: request.title,
    requestedAt: request.requestedAt,
    requestedBy: request.requestedBy,
    summary: request.summary,
    context: linkedPost
      ? `${request.assetType} · ${request.destination} · Social Ops: ${linkedPost.status}`
      : `${request.assetType} · ${request.destination}`,
    sourcePath: `/empresas/${request.companySlug}/studio`,
    actions
  };
}

function mapSocialPostApproval(post: ScheduledSocialPost): ApprovalCenterItem {
  return {
    id: post.id,
    companySlug: post.companySlug,
    kind: "social_post",
    status: post.status,
    title: post.title,
    requestedAt: post.approvedAt ?? post.rejectedAt ?? post.postedAt ?? post.scheduledFor,
    requestedBy: post.requestedBy,
    summary: post.summary,
    context: `${post.platform} · ${post.format}`,
    sourcePath: post.sourceCampaignBriefId
      ? `/empresas/${post.companySlug}/campanhas`
      : `/empresas/${post.companySlug}/social`,
    actions:
      post.status === "pending_approval"
        ? (["approve", "reject"] satisfies ApprovalCenterAction[])
        : post.status === "scheduled"
          ? (["queue-runtime", "mark-posted"] satisfies ApprovalCenterAction[])
          : []
  };
}

function mapSocialAdApproval(draft: SocialAdDraft): ApprovalCenterItem {
  return {
    id: draft.id,
    companySlug: draft.companySlug,
    kind: "social_ad",
    status: draft.status,
    title: draft.title,
    requestedAt: draft.approvedAt ?? draft.rejectedAt ?? draft.launchedAt ?? draft.scheduledStart,
    requestedBy: draft.requestedBy,
    summary: `${draft.objective}. ${draft.creativeAngle}`,
    context: `${draft.platform} · ${draft.budget}`,
    sourcePath: draft.sourceCampaignBriefId
      ? `/empresas/${draft.companySlug}/campanhas`
      : `/empresas/${draft.companySlug}/social`,
    actions:
      draft.status === "pending_approval"
        ? (["approve", "reject"] satisfies ApprovalCenterAction[])
        : draft.status === "approved"
          ? (["queue-runtime"] satisfies ApprovalCenterAction[])
          : []
  };
}
