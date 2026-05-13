import assert from "node:assert/strict";
import test from "node:test";
import {
  listStoredCompanyConversionEvents,
  listStoredCompanyLeads,
  upsertStoredCompanyConversionEventInCollection,
  upsertStoredCompanyLeadInCollection
} from "@/infrastructure/persistence/company-commercial-storage";
import type { CompanyConversionEvent, CompanyLead } from "@/lib/domain";

test("commercial storage upserts and sorts leads by last touch", () => {
  const leads = [
    buildLead("lead-1", "tenant-a", "2026-05-01T10:00:00.000Z"),
    buildLead("lead-2", "tenant-b", "2026-05-03T10:00:00.000Z")
  ];

  const updated = upsertStoredCompanyLeadInCollection(
    leads,
    buildLead("lead-3", "tenant-a", "2026-05-04T10:00:00.000Z")
  );

  assert.deepEqual(
    listStoredCompanyLeads(updated, "tenant-a").map((lead) => lead.id),
    ["lead-3", "lead-1"]
  );
});

test("commercial storage upserts and scopes conversion events", () => {
  const events = [
    buildConversionEvent("event-1", "tenant-a", "2026-05-01T10:00:00.000Z"),
    buildConversionEvent("event-2", "tenant-b", "2026-05-03T10:00:00.000Z")
  ];

  const updated = upsertStoredCompanyConversionEventInCollection(
    events,
    buildConversionEvent("event-3", "tenant-a", "2026-05-04T10:00:00.000Z")
  );

  assert.deepEqual(
    listStoredCompanyConversionEvents(updated, "tenant-a").map((event) => event.id),
    ["event-3", "event-1"]
  );
});

function buildLead(id: string, companySlug: string, lastTouchedAt: string): CompanyLead {
  return {
    id,
    companySlug,
    fullName: "Lead",
    source: "site_form",
    channel: "site",
    stage: "new",
    score: 50,
    owner: "sales",
    nextAction: "follow-up",
    consentStatus: "granted",
    notes: [],
    capturedAt: "2026-05-01T10:00:00.000Z",
    lastTouchedAt,
    syncStatus: "pending_sync"
  };
}

function buildConversionEvent(
  id: string,
  companySlug: string,
  updatedAt: string
): CompanyConversionEvent {
  return {
    id,
    companySlug,
    leadId: "lead-1",
    destination: "ga4",
    eventName: "generate_lead",
    leadStage: "new",
    status: "queued",
    summary: "Lead capturado",
    detail: "Lead capturado",
    createdAt: "2026-05-01T10:00:00.000Z",
    updatedAt
  };
}
