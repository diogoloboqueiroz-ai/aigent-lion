import {
  getStoredMetricSnapshots,
  replaceStoredMetricSnapshots,
  upsertStoredCompanyDataOpsProfile
} from "@/lib/company-vault";
import type {
  CompanyDataOpsProfile,
  CompanyWorkspace,
  MetricSnapshot,
  PlatformId
} from "@/lib/domain";
import { ensureFreshGoogleCompanyConnection } from "@/lib/google-runtime";

type GoogleDataSyncStatus = "synced" | "blocked" | "failed" | "skipped";

type GoogleDataSyncResultItem = {
  platform: PlatformId;
  status: GoogleDataSyncStatus;
  summary: string;
  snapshotCount: number;
};

export type CompanyGoogleDataSyncResult = {
  results: GoogleDataSyncResultItem[];
  snapshots: MetricSnapshot[];
  syncedPlatforms: number;
  blockedPlatforms: number;
  failedPlatforms: number;
  summary: string;
  profile: CompanyDataOpsProfile;
};

export async function syncCompanyGoogleDataOps(workspace: CompanyWorkspace): Promise<CompanyGoogleDataSyncResult> {
  const companyId = workspace.company.id;
  const profile = workspace.dataOpsProfile;
  const existingSnapshots = getStoredMetricSnapshots(companyId);
  const nextSnapshots = [...existingSnapshots];
  const results: GoogleDataSyncResultItem[] = [];

  const ga4Sync = await syncGa4Snapshots(workspace, profile);
  results.push(ga4Sync.result);
  mergeSnapshots(nextSnapshots, ga4Sync.snapshots);

  const searchConsoleSync = await syncSearchConsoleSnapshots(workspace, profile);
  results.push(searchConsoleSync.result);
  mergeSnapshots(nextSnapshots, searchConsoleSync.snapshots);

  const sheetsSync = await syncGoogleSheetsSummary(workspace, profile, [...workspace.snapshots, ...nextSnapshots]);
  results.push(sheetsSync);

  const now = new Date().toISOString();
  const syncedPlatforms = results.filter((result) => result.status === "synced").length;
  const blockedPlatforms = results.filter((result) => result.status === "blocked").length;
  const failedPlatforms = results.filter((result) => result.status === "failed").length;
  const summary = buildGoogleSyncSummary(results);

  replaceStoredMetricSnapshots(
    companyId,
    nextSnapshots
      .map((snapshot) => ({
        ...snapshot,
        companyId: snapshot.companyId ?? companyId,
        companyName: snapshot.companyName ?? workspace.company.name
      }))
      .sort((left, right) => {
        const updatedAt = right.capturedAt?.localeCompare(left.capturedAt ?? "") ?? 0;
        return updatedAt || left.platform.localeCompare(right.platform) || left.window.localeCompare(right.window);
      })
      .slice(0, 60)
  );

  const nextProfile = {
    ...profile,
    lastSyncedAt: now,
    lastSyncSummary: summary
  };
  upsertStoredCompanyDataOpsProfile(nextProfile);

  return {
    results,
    snapshots: nextSnapshots,
    syncedPlatforms,
    blockedPlatforms,
    failedPlatforms,
    summary,
    profile: nextProfile
  };
}

export function mergeWorkspaceMetricSnapshots(seedSnapshots: MetricSnapshot[], storedSnapshots: MetricSnapshot[]) {
  const merged = new Map<string, MetricSnapshot>();

  for (const snapshot of seedSnapshots) {
    merged.set(buildSnapshotKey(snapshot), snapshot);
  }

  for (const snapshot of storedSnapshots) {
    merged.set(buildSnapshotKey(snapshot), snapshot);
  }

  return Array.from(merged.values()).sort(sortSnapshots);
}

async function syncGa4Snapshots(workspace: CompanyWorkspace, profile: CompanyDataOpsProfile) {
  if (!profile.ga4PropertyId.trim()) {
    return {
      result: blockedResult("ga4", "Defina o property ID do GA4 antes de sincronizar."),
      snapshots: []
    };
  }

  try {
    const connection = await ensureFreshGoogleCompanyConnection(workspace.company.slug, "ga4");
    const weekly = await runGa4Report(connection.accessToken, profile.ga4PropertyId, 7);
    const monthly = await runGa4Report(connection.accessToken, profile.ga4PropertyId, 28);
    const capturedAt = new Date().toISOString();
    const snapshots = [
      buildGa4Snapshot(workspace, "7d", weekly, capturedAt),
      buildGa4Snapshot(workspace, "28d", monthly, capturedAt)
    ];

    return {
      result: {
        platform: "ga4" as const,
        status: "synced" as const,
        summary: `GA4 real sincronizado para a propriedade ${profile.ga4PropertyId}.`,
        snapshotCount: snapshots.length
      },
      snapshots
    };
  } catch (error) {
    return {
      result: failedResult("ga4", `Falha no sync de GA4: ${toErrorMessage(error)}`),
      snapshots: []
    };
  }
}

async function syncSearchConsoleSnapshots(workspace: CompanyWorkspace, profile: CompanyDataOpsProfile) {
  if (!profile.searchConsoleSiteUrl.trim()) {
    return {
      result: blockedResult("search-console", "Defina a propriedade do Search Console antes de sincronizar."),
      snapshots: []
    };
  }

  try {
    const connection = await ensureFreshGoogleCompanyConnection(workspace.company.slug, "search-console");
    const weekly = await runSearchConsoleQuery(connection.accessToken, profile.searchConsoleSiteUrl, 7);
    const monthly = await runSearchConsoleQuery(connection.accessToken, profile.searchConsoleSiteUrl, 28);
    const capturedAt = new Date().toISOString();
    const snapshots = [
      buildSearchConsoleSnapshot(workspace, "7d", weekly, capturedAt),
      buildSearchConsoleSnapshot(workspace, "28d", monthly, capturedAt)
    ];

    return {
      result: {
        platform: "search-console" as const,
        status: "synced" as const,
        summary: `Search Console real sincronizado para ${profile.searchConsoleSiteUrl}.`,
        snapshotCount: snapshots.length
      },
      snapshots
    };
  } catch (error) {
    return {
      result: failedResult("search-console", `Falha no sync de Search Console: ${toErrorMessage(error)}`),
      snapshots: []
    };
  }
}

async function syncGoogleSheetsSummary(
  workspace: CompanyWorkspace,
  profile: CompanyDataOpsProfile,
  availableSnapshots: MetricSnapshot[]
): Promise<GoogleDataSyncResultItem> {
  if (!profile.sheetsSpreadsheetId.trim()) {
    return blockedResult("google-sheets", "Defina o spreadsheet ID do Google Sheets antes de sincronizar.");
  }

  const relevantSnapshots = availableSnapshots.filter(
    (snapshot) =>
      snapshot.source === "google_data_sync" &&
      (snapshot.platform === "ga4" || snapshot.platform === "search-console")
  );

  if (relevantSnapshots.length === 0) {
    return blockedResult("google-sheets", "Ainda nao existem snapshots Google reais para consolidar no Sheets.");
  }

  try {
    const connection = await ensureFreshGoogleCompanyConnection(workspace.company.slug, "google-sheets");
    const range = profile.sheetsOverviewRange.trim() || "AgentLion!A1";
    const values = buildSheetValues(workspace, profile, relevantSnapshots);
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(profile.sheetsSpreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          range,
          majorDimension: "ROWS",
          values
        })
      }
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return {
      platform: "google-sheets",
      status: "synced",
      summary: `Consolidado operacional escrito em ${range}.`,
      snapshotCount: relevantSnapshots.length
    };
  } catch (error) {
    return failedResult("google-sheets", `Falha na escrita do Google Sheets: ${toErrorMessage(error)}`);
  }
}

async function runGa4Report(accessToken: string, propertyId: string, days: 7 | 28) {
  try {
    return await requestGa4Report(accessToken, propertyId, days, "keyEvents");
  } catch {
    return requestGa4Report(accessToken, propertyId, days, "conversions");
  }
}

async function requestGa4Report(
  accessToken: string,
  propertyId: string,
  days: 7 | 28,
  conversionMetric: "keyEvents" | "conversions"
) {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: conversionMetric },
          { name: "totalRevenue" }
        ]
      })
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as {
    rows?: Array<{ metricValues?: Array<{ value?: string }> }>;
  };
  const values = payload.rows?.[0]?.metricValues ?? [];

  return {
    sessions: parseNumber(values[0]?.value),
    users: parseNumber(values[1]?.value),
    keyEvents: parseNumber(values[2]?.value),
    revenue: parseNumber(values[3]?.value)
  };
}

async function runSearchConsoleQuery(accessToken: string, siteUrl: string, days: 7 | 28) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);
  const response = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        rowLimit: 1
      })
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as {
    rows?: Array<{
      clicks?: number;
      impressions?: number;
      ctr?: number;
      position?: number;
    }>;
  };
  const row = payload.rows?.[0];

  return {
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    ctr: row?.ctr ?? 0,
    position: row?.position ?? 0
  };
}

function buildGa4Snapshot(
  workspace: CompanyWorkspace,
  window: MetricSnapshot["window"],
  report: Awaited<ReturnType<typeof runGa4Report>>,
  capturedAt: string
): MetricSnapshot {
  return {
    companyId: workspace.company.id,
    companyName: workspace.company.name,
    platform: "ga4",
    window,
    conversions: report.keyEvents,
    revenue: report.revenue,
    capturedAt,
    source: "google_data_sync",
    notes: [
      `GA4 real sincronizado para ${window}.`,
      `Sessions ${Math.round(report.sessions)}.`,
      `Usuarios ${Math.round(report.users)}.`
    ]
  };
}

function buildSearchConsoleSnapshot(
  workspace: CompanyWorkspace,
  window: MetricSnapshot["window"],
  report: Awaited<ReturnType<typeof runSearchConsoleQuery>>,
  capturedAt: string
): MetricSnapshot {
  return {
    companyId: workspace.company.id,
    companyName: workspace.company.name,
    platform: "search-console",
    window,
    impressions: report.impressions,
    clicks: report.clicks,
    ctr: report.ctr,
    capturedAt,
    source: "google_data_sync",
    notes: [
      `Search Console real sincronizado para ${window}.`,
      `CTR medio ${formatPercent(report.ctr)}.`,
      `Posicao media ${report.position.toFixed(1)}.`
    ]
  };
}

function buildSheetValues(
  workspace: CompanyWorkspace,
  profile: CompanyDataOpsProfile,
  snapshots: MetricSnapshot[]
) {
  const ga4Weekly = snapshots.find((snapshot) => snapshot.platform === "ga4" && snapshot.window === "7d");
  const ga4Monthly = snapshots.find((snapshot) => snapshot.platform === "ga4" && snapshot.window === "28d");
  const searchWeekly = snapshots.find((snapshot) => snapshot.platform === "search-console" && snapshot.window === "7d");
  const searchMonthly = snapshots.find((snapshot) => snapshot.platform === "search-console" && snapshot.window === "28d");

  return [
    ["Agent Lion", "Google Data Sync"],
    ["Empresa", workspace.company.name],
    ["Atualizado em", new Date().toLocaleString("pt-BR", { timeZone: workspace.company.timezone })],
    ["Objetivo", profile.analyticsObjective],
    [""],
    ["Fonte", "Janela", "Indicadores", "Notas"],
    [
      "GA4",
      "7d",
      `Conversoes ${formatInteger(ga4Weekly?.conversions)} | Receita ${formatCurrency(ga4Weekly?.revenue)}`,
      ga4Weekly?.notes.join(" ") ?? "Sem snapshot real ainda."
    ],
    [
      "GA4",
      "28d",
      `Conversoes ${formatInteger(ga4Monthly?.conversions)} | Receita ${formatCurrency(ga4Monthly?.revenue)}`,
      ga4Monthly?.notes.join(" ") ?? "Sem snapshot real ainda."
    ],
    [
      "Search Console",
      "7d",
      `Cliques ${formatInteger(searchWeekly?.clicks)} | Impressoes ${formatInteger(searchWeekly?.impressions)} | CTR ${formatPercent(searchWeekly?.ctr)}`,
      searchWeekly?.notes.join(" ") ?? "Sem snapshot real ainda."
    ],
    [
      "Search Console",
      "28d",
      `Cliques ${formatInteger(searchMonthly?.clicks)} | Impressoes ${formatInteger(searchMonthly?.impressions)} | CTR ${formatPercent(searchMonthly?.ctr)}`,
      searchMonthly?.notes.join(" ") ?? "Sem snapshot real ainda."
    ]
  ];
}

function mergeSnapshots(target: MetricSnapshot[], incoming: MetricSnapshot[]) {
  for (const snapshot of incoming) {
    const key = buildSnapshotKey(snapshot);
    const index = target.findIndex((entry) => buildSnapshotKey(entry) === key);
    if (index >= 0) {
      target[index] = snapshot;
      continue;
    }

    target.push(snapshot);
  }
}

function buildSnapshotKey(snapshot: MetricSnapshot) {
  return `${snapshot.companyId ?? "workspace"}::${snapshot.platform}::${snapshot.window}`;
}

function buildGoogleSyncSummary(results: GoogleDataSyncResultItem[]) {
  return results
    .map((result) => `${result.platform}: ${result.summary}`)
    .join(" | ");
}

function blockedResult(platform: PlatformId, summary: string): GoogleDataSyncResultItem {
  return {
    platform,
    status: "blocked",
    summary,
    snapshotCount: 0
  };
}

function failedResult(platform: PlatformId, summary: string): GoogleDataSyncResultItem {
  return {
    platform,
    status: "failed",
    summary,
    snapshotCount: 0
  };
}

function sortSnapshots(left: MetricSnapshot, right: MetricSnapshot) {
  return (
    (right.capturedAt ?? "").localeCompare(left.capturedAt ?? "") ||
    left.platform.localeCompare(right.platform) ||
    left.window.localeCompare(right.window)
  );
}

function parseNumber(value?: string) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value?: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0
  }).format(value ?? 0);
}

function formatPercent(value?: number) {
  return `${Math.round((value ?? 0) * 1000) / 10}%`;
}

function formatInteger(value?: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0
  }).format(value ?? 0);
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado na integracao Google.";
}
