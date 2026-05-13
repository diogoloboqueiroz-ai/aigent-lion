import type { PaymentApprovalRequest, PublishingApprovalRequest } from "@/lib/domain";

export type CompanyApprovalsCollections = {
  paymentApprovalRequests: PaymentApprovalRequest[];
  publishingApprovalRequests: PublishingApprovalRequest[];
};

export function listStoredPaymentApprovalRequests(
  requests: PaymentApprovalRequest[],
  companySlug?: string
) {
  return filterByCompany(requests, companySlug);
}

export function upsertStoredPaymentApprovalRequestInCollection(
  requests: PaymentApprovalRequest[],
  request: PaymentApprovalRequest
) {
  return upsertById(requests, request);
}

export function listStoredPublishingApprovalRequests(
  requests: PublishingApprovalRequest[],
  companySlug?: string
) {
  return filterByCompany(requests, companySlug);
}

export function upsertStoredPublishingApprovalRequestInCollection(
  requests: PublishingApprovalRequest[],
  request: PublishingApprovalRequest
) {
  return upsertById(requests, request);
}

function filterByCompany<T extends { companySlug: string }>(
  items: T[],
  companySlug?: string
) {
  return companySlug ? items.filter((item) => item.companySlug === companySlug) : items;
}

function upsertById<T extends { id: string }>(items: T[], item: T) {
  const nextItems = items.filter((entry) => entry.id !== item.id);
  nextItems.push(item);
  return nextItems;
}
