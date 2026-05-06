import assert from "node:assert/strict";
import test from "node:test";
import {
  appendStoredCompanyReportToCollection,
  listStoredCompanyReports,
  listStoredMetricSnapshots,
  replaceStoredMetricSnapshotsForCompany
} from "@/infrastructure/persistence/company-reports-storage";
import type { CompanyGeneratedReport, MetricSnapshot } from "@/lib/domain";

test("company reports storage filters, sorts and upserts reports by tenant", () => {
  const reports = [
    buildReport("report-1", "acme", "2026-05-01T10:00:00.000Z"),
    buildReport("report-2", "other", "2026-05-02T10:00:00.000Z")
  ];

  const updated = appendStoredCompanyReportToCollection(
    reports,
    buildReport("report-3", "acme", "2026-05-03T10:00:00.000Z")
  );

  assert.deepEqual(
    listStoredCompanyReports(updated, "acme").map((report) => report.id),
    ["report-3", "report-1"]
  );
});

test("company reports storage replaces metric snapshots per company", () => {
  const snapshots: MetricSnapshot[] = [
    buildMetricSnapshot("metric-1", "acme-id"),
    buildMetricSnapshot("metric-2", "other-id")
  ];

  const updated = replaceStoredMetricSnapshotsForCompany(snapshots, "acme-id", [
    buildMetricSnapshot("metric-3", "acme-id")
  ]);

  assert.deepEqual(
    listStoredMetricSnapshots(updated, "acme-id").map((snapshot) => snapshot.capturedAt),
    ["2026-05-02T10:03:00.000Z"]
  );
  assert.deepEqual(
    listStoredMetricSnapshots(updated, "other-id").map((snapshot) => snapshot.capturedAt),
    ["2026-05-02T10:02:00.000Z"]
  );
});

function buildReport(
  id: string,
  companySlug: string,
  generatedAt: string
): CompanyGeneratedReport {
  return {
    id,
    companySlug,
    companyName: "Acme",
    type: "weekly_marketing",
    title: "Weekly report",
    generatedAt,
    summary: "Report",
    highlights: [],
    risks: [],
    actions: [],
    metrics: [],
    sections: []
  };
}

function buildMetricSnapshot(id: string, companyId: string): MetricSnapshot {
  const capturedAt = `2026-05-02T10:0${id.at(-1) ?? "0"}:00.000Z`;

  return {
    companyId,
    platform: "meta",
    window: "7d",
    conversions: 10,
    source: "seed",
    capturedAt,
    notes: []
  };
}
