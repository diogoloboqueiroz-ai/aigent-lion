import assert from "node:assert/strict";
import test from "node:test";
import {
  listStoredPaymentApprovalRequests,
  listStoredPublishingApprovalRequests,
  upsertStoredPaymentApprovalRequestInCollection,
  upsertStoredPublishingApprovalRequestInCollection
} from "@/infrastructure/persistence/company-approvals-storage";
import type { PaymentApprovalRequest, PublishingApprovalRequest } from "@/lib/domain";

test("company approvals storage filters and upserts payment approvals by tenant", () => {
  const requests: PaymentApprovalRequest[] = [
    buildPaymentRequest("pay-1", "acme", "pending"),
    buildPaymentRequest("pay-2", "other", "approved")
  ];

  const updated = upsertStoredPaymentApprovalRequestInCollection(
    requests,
    buildPaymentRequest("pay-1", "acme", "approved")
  );

  assert.equal(listStoredPaymentApprovalRequests(updated, "acme").length, 1);
  assert.equal(listStoredPaymentApprovalRequests(updated, "acme")[0]?.status, "approved");
  assert.equal(listStoredPaymentApprovalRequests(updated, "other")[0]?.id, "pay-2");
});

test("company approvals storage filters and upserts publishing approvals by tenant", () => {
  const requests: PublishingApprovalRequest[] = [
    buildPublishingRequest("pub-1", "acme", "pending"),
    buildPublishingRequest("pub-2", "other", "approved")
  ];

  const updated = upsertStoredPublishingApprovalRequestInCollection(
    requests,
    buildPublishingRequest("pub-1", "acme", "rejected")
  );

  assert.equal(listStoredPublishingApprovalRequests(updated, "acme").length, 1);
  assert.equal(listStoredPublishingApprovalRequests(updated, "acme")[0]?.status, "rejected");
  assert.equal(listStoredPublishingApprovalRequests(updated, "other")[0]?.id, "pub-2");
});

function buildPaymentRequest(
  id: string,
  companySlug: string,
  status: PaymentApprovalRequest["status"]
): PaymentApprovalRequest {
  return {
    id,
    companySlug,
    provider: "stripe",
    title: "Payment",
    description: "Payment approval",
    amount: "100",
    currency: "BRL",
    requestedAt: "2026-05-02T10:00:00.000Z",
    requestedBy: "operator",
    status,
    userApprovalRequired: true
  };
}

function buildPublishingRequest(
  id: string,
  companySlug: string,
  status: PublishingApprovalRequest["status"]
): PublishingApprovalRequest {
  return {
    id,
    companySlug,
    title: "Asset",
    assetType: "post",
    destination: "instagram",
    createdWith: "canva",
    requestedAt: "2026-05-02T10:00:00.000Z",
    requestedBy: "operator",
    status,
    summary: "Publishing approval",
    userApprovalRequired: true
  };
}
