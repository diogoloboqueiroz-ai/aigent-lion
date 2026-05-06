import { createHash } from "node:crypto";
import { readSanitizedResponseText, sanitizeErrorMessage } from "@/core/observability/redaction";
import {
  getStoredCompanyConversionEvents,
  getStoredSocialPlatformBinding,
  getStoredCompanyTrackingCredential,
  upsertStoredCompanyConversionEvent,
  upsertStoredCompanyTrackingCredential
} from "@/lib/company-vault";
import { ensureFreshGoogleCompanyConnection } from "@/lib/google-runtime";
import type {
  CompanyConversionEvent,
  CompanyLead,
  CompanyProfile,
  CompanySiteOpsProfile,
  ConversionDestination
} from "@/lib/domain";

const META_GRAPH_VERSION = "v23.0";
const GOOGLE_ADS_API_VERSION = "v23";

type TrackingCredentials = {
  companySlug: string;
  ga4Configured: boolean;
  metaConfigured: boolean;
  ga4ApiSecret?: string;
  metaAccessToken?: string;
  updatedAt?: string;
};

type DispatchContext = {
  siteOpsProfile: CompanySiteOpsProfile;
  requestMeta?: {
    ipAddress?: string | null;
    userAgent?: string | null;
  };
};

type DispatchResult = {
  events: CompanyConversionEvent[];
  sent: number;
  blocked: number;
  failed: number;
};

export function getCompanyTrackingCredentials(companySlug: string): TrackingCredentials {
  const stored = getStoredCompanyTrackingCredential(companySlug);

  return {
    companySlug,
    ga4Configured: Boolean(stored?.ga4ApiSecret),
    metaConfigured: Boolean(stored?.metaAccessToken),
    ga4ApiSecret: stored?.ga4ApiSecret,
    metaAccessToken: stored?.metaAccessToken,
    updatedAt: stored?.updatedAt
  };
}

export function saveCompanyTrackingCredentials(input: {
  companySlug: string;
  current: TrackingCredentials;
  ga4ApiSecret?: string;
  metaAccessToken?: string;
}) {
  const now = new Date().toISOString();
  const next = {
    companySlug: input.companySlug,
    ga4ApiSecret: input.ga4ApiSecret?.trim() ? input.ga4ApiSecret.trim() : input.current.ga4ApiSecret,
    metaAccessToken: input.metaAccessToken?.trim() ? input.metaAccessToken.trim() : input.current.metaAccessToken,
    createdAt: input.current.updatedAt ?? now,
    updatedAt: now
  };

  upsertStoredCompanyTrackingCredential(next);
  return getCompanyTrackingCredentials(input.companySlug);
}

export function getCompanyConversionEvents(companySlug: string) {
  return getStoredCompanyConversionEvents(companySlug).sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  );
}

export async function syncLeadConversionSignals(input: {
  company: CompanyProfile;
  lead: CompanyLead;
  siteOpsProfile: CompanySiteOpsProfile;
  requestMeta?: DispatchContext["requestMeta"];
}) {
  const credentials = getStoredCompanyTrackingCredential(input.company.slug);
  const destinations = getEligibleDestinations(input.lead, input.siteOpsProfile, credentials);
  const results: CompanyConversionEvent[] = [];

  for (const destination of destinations) {
    const event = await dispatchDestination({
      company: input.company,
      lead: input.lead,
      destination,
      credentials,
      context: {
        siteOpsProfile: input.siteOpsProfile,
        requestMeta: input.requestMeta
      }
    });

    upsertStoredCompanyConversionEvent(event);
    results.push(event);
  }

  return summarizeDispatch(results);
}

export async function dispatchQueuedLeadConversionSignals(input: {
  company: CompanyProfile;
  siteOpsProfile: CompanySiteOpsProfile;
  leads: CompanyLead[];
}) {
  const existingEvents = getStoredCompanyConversionEvents(input.company.slug);
  const leadsToRetry = input.leads.filter((lead) => {
    const events = existingEvents.filter((event) => event.leadId === lead.id);
    return (
      events.length === 0 ||
      events.some((event) => event.status === "queued" || event.status === "failed")
    );
  });

  const results: CompanyConversionEvent[] = [];
  for (const lead of leadsToRetry) {
    const dispatch = await syncLeadConversionSignals({
      company: input.company,
      lead,
      siteOpsProfile: input.siteOpsProfile
    });
    results.push(...dispatch.events);
  }

  return summarizeDispatch(results);
}

async function dispatchDestination(input: {
  company: CompanyProfile;
  lead: CompanyLead;
  destination: ConversionDestination;
  credentials: ReturnType<typeof getStoredCompanyTrackingCredential> | undefined;
  context: DispatchContext;
}): Promise<CompanyConversionEvent> {
  const baseEvent = buildBaseConversionEvent(input.company.slug, input.lead, input.destination);
  const existing = getStoredCompanyConversionEvents(input.company.slug).find((event) => event.id === baseEvent.id);
  const dedupeKey = computeDedupeKey(input.lead);

  if (existing?.status === "sent") {
    return existing;
  }

  try {
    if (input.destination === "ga4") {
      if (!input.context.siteOpsProfile.ga4MeasurementId || !input.credentials?.ga4ApiSecret) {
        return markBlockedEvent(
          existing ?? baseEvent,
          "GA4 ainda nao esta pronto para Measurement Protocol nesta empresa."
        );
      }

      await sendGa4Event({
        measurementId: input.context.siteOpsProfile.ga4MeasurementId,
        apiSecret: input.credentials.ga4ApiSecret,
        lead: input.lead,
        dedupeKey
      });

      return markSentEvent(existing ?? baseEvent, "Evento de lead enviado ao GA4 via Measurement Protocol.");
    }

    if (input.destination === "meta_capi") {
      if (!input.context.siteOpsProfile.metaPixelId || !input.credentials?.metaAccessToken) {
        return markBlockedEvent(existing ?? baseEvent, "Meta CAPI ainda nao esta pronta nesta empresa.");
      }

      await sendMetaConversionEvent({
        pixelId: input.context.siteOpsProfile.metaPixelId,
        accessToken: input.credentials.metaAccessToken,
        lead: input.lead,
        requestMeta: input.context.requestMeta,
        dedupeKey
      });

      return markSentEvent(existing ?? baseEvent, "Evento de lead enviado ao Meta CAPI.");
    }

    const binding = getStoredSocialPlatformBinding(input.company.slug, "google-ads");
    const customerId = normalizeGoogleAdsCustomerId(binding?.targetId);

    if (!binding || !customerId) {
      return markBlockedEvent(
        existing ?? baseEvent,
        "Google Ads ainda nao tem binding operacional com customer ID valido nesta empresa."
      );
    }

    const conversionAction = resolveGoogleAdsConversionAction(
      customerId,
      binding.conversionEvent ?? input.context.siteOpsProfile.googleAdsConversionId
    );

    if (!conversionAction) {
      return markBlockedEvent(
        existing ?? baseEvent,
        "Google Ads ainda nao tem conversion action mapeada no binding operacional desta empresa."
      );
    }

    const userIdentifiers = buildGoogleAdsUserIdentifiers(input.lead);
    const clickIdentifiers = getGoogleAdsClickIdentifiers(input.lead);
    if (clickIdentifiers.count > 1) {
      return markBlockedEvent(
        existing ?? baseEvent,
        "Google Ads aceita apenas um identificador de clique por conversao: gclid, gbraid ou wbraid."
      );
    }

    if (!clickIdentifiers.gclid && !clickIdentifiers.gbraid && !clickIdentifiers.wbraid && userIdentifiers.length === 0) {
      return markBlockedEvent(
        existing ?? baseEvent,
        "Google Ads exige gclid, gbraid, wbraid ou identificadores hash de email/telefone para upload."
      );
    }

    let developerToken: string;
    try {
      developerToken = requireGoogleAdsDeveloperToken();
    } catch (error) {
      return markBlockedEvent(
        existing ?? baseEvent,
        sanitizeErrorMessage(error, "GOOGLE_ADS_DEVELOPER_TOKEN ausente.")
      );
    }

    let connection: Awaited<ReturnType<typeof ensureFreshGoogleCompanyConnection>>;
    try {
      connection = await ensureFreshGoogleCompanyConnection(input.company.slug, "google-ads");
    } catch (error) {
      return markBlockedEvent(
        existing ?? baseEvent,
        sanitizeErrorMessage(error, "Conexao Google Ads nao esta pronta.")
      );
    }

    const upload = await uploadGoogleAdsClickConversion({
      customerId,
      accessToken: connection.accessToken,
      managerAccountId: binding.managerAccountId,
      conversionAction,
      developerToken,
      dedupeKey,
      lead: input.lead,
      clickIdentifiers,
      userIdentifiers
    });

    return {
      ...markSentEvent(
        existing ?? baseEvent,
        "Conversao offline enviada ao Google Ads com sucesso."
      ),
      detail:
        upload.detail ??
        "O Agent Lion enviou a conversao offline ao Google Ads usando o binding operacional e o token OAuth da empresa.",
      externalRef: upload.jobId ?? conversionAction
    };
  } catch (error) {
    return markFailedEvent(
      existing ?? baseEvent,
      sanitizeErrorMessage(error, "Falha inesperada ao disparar evento de conversao.")
    );
  }
}

function getEligibleDestinations(
  lead: CompanyLead,
  siteOpsProfile: CompanySiteOpsProfile,
  credentials?: ReturnType<typeof getStoredCompanyTrackingCredential>
) {
  const destinations: ConversionDestination[] = [];

  if (siteOpsProfile.ga4MeasurementId || credentials?.ga4ApiSecret) {
    destinations.push("ga4");
  }
  if (siteOpsProfile.metaPixelId || credentials?.metaAccessToken) {
    destinations.push("meta_capi");
  }
  if (
    siteOpsProfile.googleAdsConversionId ||
    siteOpsProfile.googleAdsConversionLabel ||
    lead.email ||
    lead.phone ||
    lead.gclid ||
    lead.gbraid ||
    lead.wbraid
  ) {
    destinations.push("google_ads");
  }

  return destinations;
}

function buildBaseConversionEvent(
  companySlug: string,
  lead: CompanyLead,
  destination: ConversionDestination
): CompanyConversionEvent {
  const eventName = mapLeadStageToEventName(lead.stage);
  const now = new Date().toISOString();

  return {
    id: `conv-${companySlug}-${lead.id}-${destination}-${eventName}`,
    companySlug,
    leadId: lead.id,
    destination,
    eventName,
    leadStage: lead.stage,
    status: "queued",
    summary: `Evento ${eventName} aguardando dispatch para ${destination}.`,
    detail: "O Agent Lion preparou o evento de conversao e vai tentar entregar ao destino configurado.",
    createdAt: now,
    updatedAt: now,
    dedupeKey: computeDedupeKey(lead),
    value: lead.revenueActual ?? lead.revenuePotential,
    currency: "BRL",
    sourcePath: lead.originPath
  };
}

function markSentEvent(event: CompanyConversionEvent, summary: string) {
  const now = new Date().toISOString();
  return {
    ...event,
    status: "sent" as const,
    summary,
    detail: summary,
    updatedAt: now,
    lastAttemptAt: now,
    sentAt: now
  };
}

function markBlockedEvent(event: CompanyConversionEvent, detail: string) {
  const now = new Date().toISOString();
  return {
    ...event,
    status: "blocked" as const,
    summary: detail,
    detail,
    updatedAt: now,
    lastAttemptAt: now
  };
}

function markFailedEvent(event: CompanyConversionEvent, detail: string) {
  const now = new Date().toISOString();
  return {
    ...event,
    status: "failed" as const,
    summary: "Falha ao enviar evento de conversao.",
    detail,
    updatedAt: now,
    lastAttemptAt: now
  };
}

async function sendGa4Event(input: {
  measurementId: string;
  apiSecret: string;
  lead: CompanyLead;
  dedupeKey: string;
}) {
  const payload = {
    client_id: input.lead.gaClientId || `agentlion.${input.lead.id}`,
    user_id: input.lead.email || input.lead.id,
    events: [
      {
        name: mapLeadStageToGa4Event(input.lead.stage),
        params: {
          event_id: input.dedupeKey,
          currency: "BRL",
          value: input.lead.revenueActual ?? input.lead.revenuePotential ?? 0,
          lead_source: input.lead.source,
          lead_stage: input.lead.stage,
          campaign_name: input.lead.campaignName,
          utm_source: input.lead.utmSource,
          utm_medium: input.lead.utmMedium,
          utm_campaign: input.lead.utmCampaign,
          page_location: input.lead.pageUrl,
          page_referrer: input.lead.referrerUrl
        }
      }
    ]
  };

  const response = await fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(
      input.measurementId
    )}&api_secret=${encodeURIComponent(input.apiSecret)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    throw new Error(await readSanitizedResponseText(response, "Falha ao enviar evento para o GA4."));
  }
}

async function sendMetaConversionEvent(input: {
  pixelId: string;
  accessToken: string;
  lead: CompanyLead;
  requestMeta?: DispatchContext["requestMeta"];
  dedupeKey: string;
}) {
  const userData: Record<string, string | string[]> = {};

  if (input.lead.email) {
    userData.em = [hashMetaField(input.lead.email)];
  }
  if (input.lead.phone) {
    userData.ph = [hashMetaField(input.lead.phone)];
  }
  if (input.lead.fbclid) {
    userData.fbc = buildMetaFbc(input.lead.fbclid, input.lead.capturedAt);
  }
  if (input.requestMeta?.ipAddress) {
    userData.client_ip_address = input.requestMeta.ipAddress;
  }
  if (input.requestMeta?.userAgent || input.lead.userAgent) {
    userData.client_user_agent = input.requestMeta?.userAgent || input.lead.userAgent || "";
  }

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(input.pixelId)}/events?access_token=${encodeURIComponent(input.accessToken)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        data: [
          {
            event_name: mapLeadStageToMetaEvent(input.lead.stage),
            event_id: input.dedupeKey,
            event_time: Math.floor(new Date(input.lead.lastTouchedAt || input.lead.capturedAt).getTime() / 1000),
            action_source: "website",
            event_source_url: input.lead.pageUrl,
            user_data: userData,
            custom_data: {
              value: input.lead.revenueActual ?? input.lead.revenuePotential ?? 0,
              currency: "BRL",
              content_name: input.lead.campaignName || input.lead.channel
            }
          }
        ]
      })
    }
  );

  if (!response.ok) {
    throw new Error(await readSanitizedResponseText(response, "Falha ao enviar evento para o Meta CAPI."));
  }
}

function mapLeadStageToEventName(stage: CompanyLead["stage"]) {
  switch (stage) {
    case "qualified":
    case "proposal":
      return "qualified_lead";
    case "won":
      return "purchase";
    default:
      return "lead";
  }
}

function mapLeadStageToGa4Event(stage: CompanyLead["stage"]) {
  switch (stage) {
    case "qualified":
    case "proposal":
      return "qualify_lead";
    case "won":
      return "purchase";
    default:
      return "generate_lead";
  }
}

function mapLeadStageToMetaEvent(stage: CompanyLead["stage"]) {
  switch (stage) {
    case "qualified":
    case "proposal":
      return "QualifiedLead";
    case "won":
      return "Purchase";
    default:
      return "Lead";
  }
}

function hashMetaField(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

async function uploadGoogleAdsClickConversion(input: {
  customerId: string;
  accessToken: string;
  managerAccountId?: string;
  conversionAction: string;
  developerToken: string;
  dedupeKey: string;
  lead: CompanyLead;
  clickIdentifiers: ReturnType<typeof getGoogleAdsClickIdentifiers>;
  userIdentifiers: Array<Record<string, string>>;
}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.accessToken}`,
    "Content-Type": "application/json",
    "developer-token": input.developerToken
  };

  const loginCustomerId = normalizeGoogleAdsCustomerId(input.managerAccountId);
  if (loginCustomerId) {
    headers["login-customer-id"] = loginCustomerId;
  }

  const response = await fetch(
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${input.customerId}:uploadClickConversions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        conversions: [
          {
            gclid: input.clickIdentifiers.gclid,
            gbraid: input.clickIdentifiers.gbraid,
            wbraid: input.clickIdentifiers.wbraid,
            conversionAction: input.conversionAction,
            conversionDateTime: formatGoogleAdsDateTime(input.lead.lastTouchedAt || input.lead.capturedAt),
            conversionValue: input.lead.revenueActual ?? input.lead.revenuePotential ?? 0,
            currencyCode: "BRL",
            orderId: input.dedupeKey,
            conversionEnvironment: "WEB",
            userIdentifiers: input.userIdentifiers,
            consent:
              input.lead.consentStatus === "unknown"
                ? undefined
                : {
                    adUserData: input.lead.consentStatus === "granted" ? "GRANTED" : "DENIED"
                  }
          }
        ],
        partialFailure: true,
        validateOnly: false,
        debugEnabled: false
      }),
      signal: AbortSignal.timeout(20_000)
    }
  );

  const rawText = await readSanitizedResponseText(response, "");
  const payload = rawText
    ? (JSON.parse(rawText) as {
        jobId?: string;
        partialFailureError?: { message?: string };
        results?: Array<{
          conversionAction?: string;
          conversionDateTime?: string;
          gclid?: string;
          gbraid?: string;
          wbraid?: string;
        }>;
      })
    : undefined;

  if (!response.ok) {
    throw new Error(payload?.partialFailureError?.message || rawText || "Falha no upload da conversao ao Google Ads.");
  }

  if (payload?.partialFailureError?.message) {
    throw new Error(payload.partialFailureError.message);
  }

  return {
    jobId: payload?.jobId,
    detail:
      payload?.results?.[0]?.conversionAction
        ? `UploadClickConversions aceitou a conversao para ${payload.results[0].conversionAction}.`
        : "UploadClickConversions aceitou a conversao offline sem retornar detalhe adicional."
  };
}

function buildGoogleAdsUserIdentifiers(lead: CompanyLead) {
  const userIdentifiers: Array<Record<string, string>> = [];
  const normalizedEmail = normalizeEmailForAds(lead.email);
  const normalizedPhone = normalizePhoneForAds(lead.phone);

  if (normalizedEmail) {
    userIdentifiers.push({
      hashedEmail: hashGoogleAdsIdentifier(normalizedEmail),
      userIdentifierSource: "FIRST_PARTY"
    });
  }

  if (normalizedPhone) {
    userIdentifiers.push({
      hashedPhoneNumber: hashGoogleAdsIdentifier(normalizedPhone),
      userIdentifierSource: "FIRST_PARTY"
    });
  }

  return userIdentifiers.slice(0, 5);
}

function getGoogleAdsClickIdentifiers(lead: CompanyLead) {
  const identifiers = {
    gclid: lead.gclid?.trim() || undefined,
    gbraid: lead.gbraid?.trim() || undefined,
    wbraid: lead.wbraid?.trim() || undefined
  };

  return {
    ...identifiers,
    count: [identifiers.gclid, identifiers.gbraid, identifiers.wbraid].filter(Boolean).length
  };
}

function hashGoogleAdsIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmailForAds(value?: string) {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  const [localPart, domain] = normalized.split("@");
  if (!localPart || !domain) {
    return undefined;
  }

  if (domain === "gmail.com" || domain === "googlemail.com") {
    return `${localPart.replace(/\./g, "")}@${domain}`;
  }

  return `${localPart}@${domain}`;
}

function normalizePhoneForAds(value?: string) {
  if (!value) {
    return undefined;
  }

  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return undefined;
  }

  return `+${digits}`;
}

function computeDedupeKey(lead: CompanyLead) {
  const browserEventId = lead.clientEventId?.trim();
  if (browserEventId) {
    return mapLeadStageToEventName(lead.stage) === "lead"
      ? browserEventId.slice(0, 64)
      : `${browserEventId}:${mapLeadStageToEventName(lead.stage)}`.slice(0, 64);
  }

  return createHash("sha256")
    .update(
      [
        lead.companySlug,
        lead.clientEventId?.trim() || lead.id,
        mapLeadStageToEventName(lead.stage),
        lead.capturedAt
      ].join("|")
    )
    .digest("hex")
    .slice(0, 32);
}

function normalizeGoogleAdsCustomerId(value?: string) {
  if (!value) {
    return undefined;
  }

  const digits = value.replace(/\D/g, "");
  return digits.length > 0 ? digits : undefined;
}

function resolveGoogleAdsConversionAction(customerId: string, value?: string) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("customers/")) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, "");
  return digits ? `customers/${customerId}/conversionActions/${digits}` : undefined;
}

function requireGoogleAdsDeveloperToken() {
  const token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  if (!token) {
    throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN ausente para upload offline no Google Ads.");
  }

  return token;
}

function formatGoogleAdsDateTime(value: string) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+00:00`;
}

function buildMetaFbc(fbclid: string, capturedAt: string) {
  if (fbclid.startsWith("fb.1.")) {
    return fbclid;
  }

  const timestamp = Math.floor(new Date(capturedAt).getTime());
  return `fb.1.${timestamp}.${fbclid}`;
}

function summarizeDispatch(events: CompanyConversionEvent[]): DispatchResult {
  return {
    events,
    sent: events.filter((event) => event.status === "sent").length,
    blocked: events.filter((event) => event.status === "blocked").length,
    failed: events.filter((event) => event.status === "failed").length
  };
}
