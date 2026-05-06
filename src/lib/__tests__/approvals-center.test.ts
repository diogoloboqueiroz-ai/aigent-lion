import assert from "node:assert/strict";
import test from "node:test";
import { buildApprovalsCenter } from "@/lib/approvals-center";
import type { ScheduledSocialPost, SocialAdDraft } from "@/lib/domain";

test("approval center routes campaign posts through approval before runtime", () => {
  const approvals = buildApprovalsCenter({
    companySlug: "tenant-a",
    paymentRequests: [],
    publishingRequests: [],
    scheduledPosts: [buildPost("pending_approval"), buildPost("scheduled")],
    socialAdDrafts: []
  });

  const pending = approvals.find((item) => item.id === "social-post-pending_approval");
  const scheduled = approvals.find((item) => item.id === "social-post-scheduled");

  assert.deepEqual(pending?.actions, ["approve", "reject"]);
  assert.deepEqual(scheduled?.actions, ["queue-runtime", "mark-posted"]);
  assert.equal(scheduled?.sourcePath, "/empresas/tenant-a/campanhas");
});

test("approval center keeps campaign ad drafts approval-gated before runtime", () => {
  const approvals = buildApprovalsCenter({
    companySlug: "tenant-a",
    paymentRequests: [],
    publishingRequests: [],
    scheduledPosts: [],
    socialAdDrafts: [buildAd("pending_approval"), buildAd("approved")]
  });

  const pending = approvals.find((item) => item.id === "social-ad-pending_approval");
  const approved = approvals.find((item) => item.id === "social-ad-approved");

  assert.deepEqual(pending?.actions, ["approve", "reject"]);
  assert.deepEqual(approved?.actions, ["queue-runtime"]);
  assert.equal(approved?.sourcePath, "/empresas/tenant-a/campanhas");
});

function buildPost(status: ScheduledSocialPost["status"]): ScheduledSocialPost {
  return {
    id: `social-post-${status}`,
    companySlug: "tenant-a",
    platform: "instagram",
    title: `Post ${status}`,
    format: "image",
    scheduledFor: "2026-05-05T12:00:00.000Z",
    createdWith: "openai-api",
    summary: "Post preparado pelo Campaign Intelligence.",
    status,
    requestedBy: "operator@example.com",
    requiresApproval: true,
    sourceCampaignBriefId: "brief-1",
    sourceCampaignBriefVersion: 2
  };
}

function buildAd(status: SocialAdDraft["status"]): SocialAdDraft {
  return {
    id: `social-ad-${status}`,
    companySlug: "tenant-a",
    platform: "facebook",
    title: `Ad ${status}`,
    objective: "Gerar pipeline",
    budget: "R$ 100/dia",
    audience: "Fundadores B2B",
    creativeAngle: "Prova operacional",
    callToAction: "Solicitar diagnostico",
    scheduledStart: "2026-05-05T12:00:00.000Z",
    status,
    requestedBy: "operator@example.com",
    requiresApproval: true,
    sourceCampaignBriefId: "brief-1",
    sourceCampaignBriefVersion: 2
  };
}
