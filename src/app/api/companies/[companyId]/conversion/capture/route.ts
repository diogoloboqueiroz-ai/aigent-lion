import { NextResponse } from "next/server";
import { getCompanyWorkspace } from "@/lib/connectors";
import {
  applyLeadCommercialAutopilot,
  getCompanyCrmProfile,
  queueLeadForCrmIfNeeded,
  shouldPushLeadImmediately,
  syncLeadToCrm
} from "@/lib/crm";
import { upsertStoredCompanyLead } from "@/lib/company-vault";
import { buildCompanyLead, getLeadRouteBucketLabel } from "@/lib/conversion";
import { syncLeadConversionSignals } from "@/lib/conversion-runtime";
import { recordCompanyAuditEvent } from "@/lib/governance";
import { getCompanySiteOpsProfile, inferLeadSourceFromSiteProfile, isOriginAllowedForBrowserCapture } from "@/lib/site-ops";
import type { LeadConsentStatus, LeadSource } from "@/lib/domain";

export async function OPTIONS(
  request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  const workspace = getCompanyWorkspace(companyId);

  if (!workspace) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
  }

  const siteOpsProfile = getCompanySiteOpsProfile(workspace.company);
  const origin = request.headers.get("origin");

  if (!isOriginAllowedForBrowserCapture(siteOpsProfile, origin)) {
    return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(origin)
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  const workspace = getCompanyWorkspace(companyId);

  if (!workspace) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
  }

  const crmProfile = getCompanyCrmProfile(workspace.company);
  const siteOpsProfile = getCompanySiteOpsProfile(workspace.company);
  const payload = await parseCapturePayload(request);
  const captureKey = payload.captureKey ?? request.headers.get("x-agent-lion-capture-key") ?? "";
  const origin = request.headers.get("origin");
  const authorizedByOrigin = isOriginAllowedForBrowserCapture(siteOpsProfile, origin);
  const authorizedBySecret = Boolean(crmProfile.captureSecret && captureKey === crmProfile.captureSecret);

  if (!authorizedBySecret && !authorizedByOrigin) {
    return NextResponse.json({ error: "capture_key_invalida" }, { status: 401 });
  }

  const lead = buildCompanyLead({
    company: workspace.company,
    fullName: payload.fullName || "Lead sem nome",
    email: payload.email,
    phone: payload.phone,
    source: inferLeadSourceFromSiteProfile({
      profile: siteOpsProfile,
      providedSource: payload.source,
      origin,
      originPath: payload.originPath
    }),
    channel: payload.channel || "Captura externa",
    campaignName: payload.campaignName,
    clientEventId: payload.clientEventId,
    owner: payload.owner || crmProfile.defaultOwner,
    nextAction: payload.nextAction || "Responder lead capturado",
    nextFollowUpAt: payload.nextFollowUpAt,
    revenuePotential: payload.revenuePotential,
    consentStatus: payload.consentStatus,
    notes: payload.notes,
    originPath: payload.originPath || "/api/companies/[companyId]/conversion/capture",
    pageUrl: payload.pageUrl,
    referrerUrl: payload.referrerUrl,
    gaClientId: payload.gaClientId,
    userAgent: request.headers.get("user-agent") ?? payload.userAgent,
    gclid: payload.gclid,
    gbraid: payload.gbraid,
    wbraid: payload.wbraid,
    fbclid: payload.fbclid,
    utmSource: payload.utmSource,
    utmMedium: payload.utmMedium,
    utmCampaign: payload.utmCampaign,
    utmContent: payload.utmContent,
    utmTerm: payload.utmTerm
  });

  const preparedLead = queueLeadForCrmIfNeeded(applyLeadCommercialAutopilot(crmProfile, lead), crmProfile);
  upsertStoredCompanyLead(preparedLead);
  recordCompanyAuditEvent({
    companySlug: workspace.company.slug,
    connector: "system",
    kind: "info",
    title: "Lead capturado por endpoint publico",
    details: `${preparedLead.fullName} entrou via captura externa na rota ${getLeadRouteBucketLabel(preparedLead.routeBucket)}.`
  });

  const finalLead = shouldPushLeadImmediately(crmProfile)
    ? await syncLeadToCrm(workspace.company, crmProfile, preparedLead)
    : preparedLead;
  const conversionDispatch = await syncLeadConversionSignals({
    company: workspace.company,
    lead: finalLead,
    siteOpsProfile,
    requestMeta: {
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent")
    }
  });

  return NextResponse.json(
    {
      ok: true,
      leadId: finalLead.id,
      syncStatus: finalLead.syncStatus,
      externalCrmId: finalLead.externalCrmId,
      conversionEvents: {
        sent: conversionDispatch.sent,
        blocked: conversionDispatch.blocked,
        failed: conversionDispatch.failed
      }
    },
    {
      headers: {
        ...buildCorsHeaders(authorizedByOrigin ? origin : null),
        "Cache-Control": "no-store"
      }
    }
  );
}

async function parseCapturePayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await request.json()) as Record<string, unknown>;
    return normalizePayload(payload);
  }

  const formData = await request.formData();
  return normalizePayload(
    Object.fromEntries(formData.entries()) as Record<string, unknown>
  );
}

function normalizePayload(payload: Record<string, unknown>) {
  return {
    captureKey: readString(payload.captureKey),
    fullName: readString(payload.fullName) || readString(payload.name),
    email: readOptionalString(payload.email),
    phone: readOptionalString(payload.phone),
    source: normalizeLeadSource(readString(payload.source)),
    channel: readString(payload.channel),
    campaignName: readOptionalString(payload.campaignName),
    owner: readOptionalString(payload.owner),
    nextAction: readOptionalString(payload.nextAction),
    nextFollowUpAt: readOptionalString(payload.nextFollowUpAt),
    revenuePotential: parseNumber(payload.revenuePotential),
    consentStatus: normalizeConsentStatus(readString(payload.consentStatus)),
    notes: normalizeNotes(payload.notes),
    originPath: readOptionalString(payload.originPath),
    pageUrl: readOptionalString(payload.pageUrl),
    referrerUrl: readOptionalString(payload.referrerUrl),
    gaClientId: readOptionalString(payload.gaClientId),
    userAgent: readOptionalString(payload.userAgent),
    gclid: readOptionalString(payload.gclid),
    gbraid: readOptionalString(payload.gbraid),
    wbraid: readOptionalString(payload.wbraid),
    fbclid: readOptionalString(payload.fbclid),
    clientEventId: readOptionalString(payload.clientEventId),
    utmSource: readOptionalString(payload.utmSource),
    utmMedium: readOptionalString(payload.utmMedium),
    utmCampaign: readOptionalString(payload.utmCampaign),
    utmContent: readOptionalString(payload.utmContent),
    utmTerm: readOptionalString(payload.utmTerm)
  };
}

function normalizeLeadSource(value: string): LeadSource | undefined {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "site_form" ||
    normalized === "landing_page" ||
    normalized === "whatsapp" ||
    normalized === "meta_ads" ||
    normalized === "google_ads" ||
    normalized === "organic" ||
    normalized === "crm_import"
  ) {
    return normalized;
  }

  return undefined;
}

function normalizeConsentStatus(value: string): LeadConsentStatus {
  if (value === "granted" || value === "denied") {
    return value;
  }

  return "unknown";
}

function normalizeNotes(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }

  const raw = String(value ?? "").trim();
  return raw ? raw.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean) : [];
}

function parseNumber(value: unknown) {
  const raw = String(value ?? "").replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readString(value: unknown) {
  return String(value ?? "").trim();
}

function readOptionalString(value: unknown) {
  const normalized = readString(value);
  return normalized || undefined;
}

function buildCorsHeaders(origin: string | null) {
  if (!origin) {
    return {} as Record<string, string>;
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-agent-lion-capture-key",
    Vary: "Origin"
  } satisfies Record<string, string>;
}
