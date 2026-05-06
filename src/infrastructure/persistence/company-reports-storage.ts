import type { CompanyGeneratedReport, MetricSnapshot } from "@/lib/domain";

export function listStoredCompanyReports(
  reports: CompanyGeneratedReport[],
  companySlug?: string
) {
  return filterByCompany(reports, companySlug).sort((left, right) =>
    right.generatedAt.localeCompare(left.generatedAt)
  );
}

export function appendStoredCompanyReportToCollection(
  reports: CompanyGeneratedReport[],
  report: CompanyGeneratedReport
) {
  return upsertById(reports, report)
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))
    .slice(0, 200);
}

export function listStoredMetricSnapshots(
  snapshots: MetricSnapshot[],
  companyId?: string
) {
  return companyId
    ? snapshots.filter((snapshot) => snapshot.companyId === companyId)
    : snapshots;
}

export function replaceStoredMetricSnapshotsForCompany(
  snapshots: MetricSnapshot[],
  companyId: string,
  nextSnapshots: MetricSnapshot[]
) {
  return [
    ...nextSnapshots,
    ...snapshots.filter((snapshot) => snapshot.companyId !== companyId)
  ].slice(0, 360);
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
