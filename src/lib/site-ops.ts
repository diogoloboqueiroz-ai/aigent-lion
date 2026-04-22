import { getStoredCompanySiteOpsProfile } from "@/lib/company-vault";
import type {
  CompanyProfile,
  CompanySiteOpsProfile,
  LeadSource,
  SiteCaptureMode
} from "@/lib/domain";

const LEAD_SOURCES: LeadSource[] = [
  "site_form",
  "landing_page",
  "whatsapp",
  "meta_ads",
  "google_ads",
  "organic",
  "manual",
  "crm_import"
];

export function getCompanySiteOpsProfile(company: CompanyProfile): CompanySiteOpsProfile {
  const stored = getStoredCompanySiteOpsProfile(company.slug);
  const defaults = buildDefaultSiteOpsProfile(company);

  return stored
    ? {
        ...defaults,
        ...stored,
        allowedOrigins: mergeAllowedOrigins(defaults.allowedOrigins, stored.allowedOrigins, stored.primarySiteUrl)
      }
    : defaults;
}

export function parseSiteOpsProfileForm(formData: FormData, current: CompanySiteOpsProfile) {
  const primarySiteUrl = normalizeUrl(String(formData.get("primarySiteUrl") ?? current.primarySiteUrl));
  const allowedOrigins = mergeAllowedOrigins(
    [],
    parseLines(String(formData.get("allowedOrigins") ?? current.allowedOrigins.join("\n"))),
    primarySiteUrl
  );
  const captureMode = String(formData.get("captureMode") ?? current.captureMode) as SiteCaptureMode;

  return {
    ...current,
    status: primarySiteUrl && captureMode !== "disabled" ? "connected" : "customized",
    primarySiteUrl,
    landingPageUrls: parseLines(String(formData.get("landingPageUrls") ?? current.landingPageUrls.join("\n"))).map(
      normalizeUrl
    ),
    captureMode,
    allowedOrigins,
    trackingDomain: normalizeUrl(String(formData.get("trackingDomain") ?? current.trackingDomain)),
    gtmContainerId: String(formData.get("gtmContainerId") ?? current.gtmContainerId).trim().toUpperCase(),
    ga4MeasurementId: String(formData.get("ga4MeasurementId") ?? current.ga4MeasurementId).trim().toUpperCase(),
    metaPixelId: String(formData.get("metaPixelId") ?? current.metaPixelId).trim(),
    googleAdsConversionId: String(
      formData.get("googleAdsConversionId") ?? current.googleAdsConversionId
    ).trim(),
    googleAdsConversionLabel: String(
      formData.get("googleAdsConversionLabel") ?? current.googleAdsConversionLabel
    ).trim(),
    conversionEventName:
      String(formData.get("conversionEventName") ?? current.conversionEventName).trim() || current.conversionEventName,
    webhookTargets: parseLines(String(formData.get("webhookTargets") ?? current.webhookTargets.join("\n"))),
    cmsProvider: String(formData.get("cmsProvider") ?? current.cmsProvider) as CompanySiteOpsProfile["cmsProvider"],
    cmsConnectionStatus:
      String(formData.get("cmsProvider") ?? current.cmsProvider) === "none"
        ? "not_connected"
        : current.cmsConnectionStatus,
    cmsSiteUrl: normalizeUrl(String(formData.get("cmsSiteUrl") ?? current.cmsSiteUrl)),
    cmsUsername: current.cmsUsername,
    cmsLastSyncAt: current.cmsLastSyncAt,
    cmsLastSyncSummary: current.cmsLastSyncSummary,
    lastPublishedLandingTitle: current.lastPublishedLandingTitle,
    lastPublishedLandingUrl: current.lastPublishedLandingUrl,
    notes: String(formData.get("notes") ?? current.notes),
    updatedAt: new Date().toISOString()
  } satisfies CompanySiteOpsProfile;
}

export function isOriginAllowedForBrowserCapture(profile: CompanySiteOpsProfile, originHeader: string | null) {
  if (profile.captureMode !== "allowlisted_browser" || !originHeader) {
    return false;
  }

  const normalizedOrigin = normalizeOrigin(originHeader);
  if (!normalizedOrigin) {
    return false;
  }

  return mergeAllowedOrigins(profile.allowedOrigins, [], profile.primarySiteUrl).includes(normalizedOrigin);
}

export function inferLeadSourceFromSiteProfile(input: {
  profile: CompanySiteOpsProfile;
  providedSource?: string;
  origin?: string | null;
  originPath?: string;
}) {
  const providedSource = String(input.providedSource ?? "").trim();
  if (LEAD_SOURCES.includes(providedSource as LeadSource)) {
    return providedSource as LeadSource;
  }

  const resolvedUrl = resolveCaptureUrl(input.origin, input.originPath);
  if (!resolvedUrl) {
    return "site_form" as const;
  }

  const resolvedPath = stripTrailingSlash(resolvedUrl.pathname);
  const landingPaths = input.profile.landingPageUrls
    .map((entry) => safeParseUrl(entry))
    .filter((entry): entry is URL => Boolean(entry))
    .map((entry) => stripTrailingSlash(entry.pathname));

  if (landingPaths.some((path) => path && resolvedPath.startsWith(path))) {
    return "landing_page" as const;
  }

  return "site_form" as const;
}

export function buildBrowserCaptureSnippet(input: {
  appUrl: string;
  companySlug: string;
  profile: CompanySiteOpsProfile;
}) {
  const endpoint = buildCaptureEndpoint(input.appUrl, input.companySlug);
  const eventName = input.profile.conversionEventName || "agent_lion_lead_submit";

  return [
    "<script>",
    "const form = document.querySelector('[data-agent-lion-form]');",
    "form?.addEventListener('submit', async (event) => {",
    "  event.preventDefault();",
    "  const data = new FormData(form);",
    "  const params = new URLSearchParams(window.location.search);",
    "  const gaCookie = document.cookie.split('; ').find((item) => item.startsWith('_ga='));",
    "  const clientEventId = globalThis.crypto?.randomUUID?.() || `agentlion-${Date.now()}`;",
    "  const payload = {",
    "    fullName: data.get('fullName') || data.get('name'),",
    "    email: data.get('email'),",
    "    phone: data.get('phone'),",
    "    source: data.get('source') || 'site_form',",
    "    channel: data.get('channel') || 'Site oficial',",
    "    campaignName: data.get('campaignName'),",
    "    clientEventId,",
    "    consentStatus: data.get('consentStatus') || 'unknown',",
    "    notes: data.get('notes'),",
    "    originPath: window.location.pathname,",
    "    pageUrl: window.location.href,",
    "    referrerUrl: document.referrer,",
    "    gaClientId: gaCookie ? gaCookie.split('=').slice(1).join('=').replace(/^GA\\d+\\.\\d+\\./, '') : undefined,",
    "    gclid: params.get('gclid') || data.get('gclid'),",
    "    gbraid: params.get('gbraid') || data.get('gbraid'),",
    "    wbraid: params.get('wbraid') || data.get('wbraid'),",
    "    fbclid: params.get('fbclid') || data.get('fbclid'),",
    "    utmSource: params.get('utm_source') || data.get('utmSource'),",
    "    utmMedium: params.get('utm_medium') || data.get('utmMedium'),",
    "    utmCampaign: params.get('utm_campaign') || data.get('utmCampaign'),",
    "    utmContent: params.get('utm_content') || data.get('utmContent'),",
    "    utmTerm: params.get('utm_term') || data.get('utmTerm')",
    "  };",
    `  const response = await fetch('${endpoint}', {`,
    "    method: 'POST',",
    "    headers: { 'Content-Type': 'application/json' },",
    "    body: JSON.stringify(payload)",
    "  });",
    "  if (!response.ok) throw new Error('Falha ao enviar lead para o Agent Lion.');",
    "  window.dataLayer = window.dataLayer || [];",
    `  window.dataLayer.push({ event: '${eventName}', event_id: clientEventId, lead_source: payload.source || 'site_form' });`,
    "  const successUrl = form.dataset.successUrl;",
    "  if (successUrl) {",
    "    window.location.href = successUrl;",
    "    return;",
    "  }",
    "  form.reset();",
    "});",
    "</script>"
  ].join("\n");
}

export function buildServerCaptureSnippet(input: {
  appUrl: string;
  companySlug: string;
  captureSecret?: string;
}) {
  const endpoint = buildCaptureEndpoint(input.appUrl, input.companySlug);
  const captureSecret = input.captureSecret || "SUA_CHAVE_DE_CAPTURA";

  return [
    "curl -X POST \\",
    `  '${endpoint}' \\`,
    "  -H 'Content-Type: application/json' \\",
    `  -H 'x-agent-lion-capture-key: ${captureSecret}' \\`,
    "  -d '{",
    '    \"fullName\": \"Lead do site\",',
    '    \"email\": \"lead@empresa.com\",',
    '    \"phone\": \"+55 11 99999-0000\",',
    '    \"source\": \"site_form\",',
    '    \"channel\": \"Website institucional\",',
    '    \"campaignName\": \"LP principal\",',
    '    \"originPath\": \"/contato\"',
    "  }'"
  ].join("\n");
}

export function buildTrackingSnippet(profile: CompanySiteOpsProfile) {
  const eventName = profile.conversionEventName || "agent_lion_lead_submit";

  return [
    "<script>",
    "window.dataLayer = window.dataLayer || [];",
    "window.dataLayer.push({",
    `  event: '${eventName}',`,
    `  lead_source: 'site_form',`,
    `  ga4_measurement_id: '${profile.ga4MeasurementId || "G-XXXXXXX"}',`,
    `  meta_pixel_id: '${profile.metaPixelId || "PIXEL_ID"}',`,
    `  google_ads_conversion: '${profile.googleAdsConversionId || "AW-CONVERSION_ID"}/${profile.googleAdsConversionLabel || "LABEL"}'`,
    "});",
    "</script>"
  ].join("\n");
}

export function buildCaptureEndpoint(appUrl: string, companySlug: string) {
  const normalizedAppUrl = stripTrailingSlash(appUrl || "https://seu-dominio.com");
  return `${normalizedAppUrl}/api/companies/${companySlug}/conversion/capture`;
}

function buildDefaultSiteOpsProfile(company: CompanyProfile): CompanySiteOpsProfile {
  return {
    companySlug: company.slug,
    status: "seeded",
    primarySiteUrl: "",
    landingPageUrls: [],
    captureMode: "server_secret",
    allowedOrigins: [],
    trackingDomain: "",
    gtmContainerId: "",
    ga4MeasurementId: "",
    metaPixelId: "",
    googleAdsConversionId: "",
    googleAdsConversionLabel: "",
    conversionEventName: "agent_lion_lead_submit",
    webhookTargets: [],
    cmsProvider: "none",
    cmsConnectionStatus: "not_connected",
    cmsSiteUrl: "",
    cmsUsername: "",
    notes:
      "Manter o Agent Lion como caixa canonica de leads e usar origin allowlist apenas para formularios reais do site aprovado.",
    updatedAt: new Date().toISOString()
  };
}

function resolveCaptureUrl(origin?: string | null, originPath?: string) {
  if (origin && originPath) {
    return safeParseUrl(`${stripTrailingSlash(origin)}${originPath.startsWith("/") ? originPath : `/${originPath}`}`);
  }

  if (originPath?.startsWith("http://") || originPath?.startsWith("https://")) {
    return safeParseUrl(originPath);
  }

  if (origin) {
    return safeParseUrl(origin);
  }

  return null;
}

function mergeAllowedOrigins(baseOrigins: string[], extraOrigins: string[], primarySiteUrl?: string) {
  const values = [
    ...baseOrigins,
    ...extraOrigins,
    primarySiteUrl ? normalizeOrigin(primarySiteUrl) : undefined
  ];

  return values.filter((entry, index, entries): entry is string => Boolean(entry) && entries.indexOf(entry) === index);
}

function parseLines(value: string) {
  return value
    .split(/\r?\n|[,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return stripTrailingSlash(trimmed);
  }

  return stripTrailingSlash(`https://${trimmed}`);
}

function normalizeOrigin(value: string) {
  const parsed = safeParseUrl(normalizeUrl(value));
  return parsed ? parsed.origin : "";
}

function safeParseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}
