import { randomBytes } from "node:crypto";
import { readSanitizedResponseText, sanitizeErrorMessage } from "@/core/observability/redaction";
import {
  getStoredCompanyCrmConnection,
  getStoredCompanyCrmProfile,
  upsertStoredCompanyCrmConnection,
  upsertStoredCompanyCrmProfile,
  upsertStoredCompanyLead
} from "@/lib/company-vault";
import {
  markLeadCrmSyncError,
  markLeadPendingSync,
  markLeadSynced,
  splitLeadName
} from "@/lib/conversion";
import type {
  CompanyCrmProfile,
  CompanyLead,
  CompanyProfile,
  CrmProvider,
  CrmSyncMode,
  LeadCadenceTrack,
  LeadRouteBucket
} from "@/lib/domain";

type HubSpotTokenInfo = {
  hubId?: number;
  scopes?: string[];
};

type HubSpotBatchUpsertResponse = {
  results?: Array<{
    id?: string;
  }>;
};

type SyncCompanyLeadsResult = {
  processed: number;
  synced: number;
  failed: number;
  skipped: number;
  summary: string;
  profile: CompanyCrmProfile;
};

export function getCompanyCrmProfile(company: CompanyProfile): CompanyCrmProfile {
  const stored = getStoredCompanyCrmProfile(company.slug);
  const defaults = buildDefaultCrmProfile(company);

  return stored
    ? {
        ...defaults,
        ...stored,
        captureSecret: stored.captureSecret ?? defaults.captureSecret
      }
    : defaults;
}

export function parseCrmProfileForm(formData: FormData, current: CompanyCrmProfile) {
  const provider = String(formData.get("provider") ?? current.provider) as CrmProvider;
  const syncMode = String(formData.get("syncMode") ?? current.syncMode) as CrmSyncMode;
  const retentionDays = Number(String(formData.get("retentionDays") ?? current.retentionDays ?? "180"));
  const nextStatus =
    provider === "none"
      ? "customized"
      : provider === "hubspot"
        ? current.status
        : "action_required";

  return {
    ...current,
    provider,
    syncMode,
    status: nextStatus,
    defaultOwner: String(formData.get("defaultOwner") ?? current.defaultOwner).trim() || current.defaultOwner,
    salesOwner: String(formData.get("salesOwner") ?? current.salesOwner ?? "").trim() || undefined,
    nurtureOwner: String(formData.get("nurtureOwner") ?? current.nurtureOwner ?? "").trim() || undefined,
    vipOwner: String(formData.get("vipOwner") ?? current.vipOwner ?? "").trim() || undefined,
    routingMode:
      String(formData.get("routingMode") ?? current.routingMode ?? "score_based") === "manual_only"
        ? "manual_only"
        : "score_based",
    retentionDays: Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : current.retentionDays ?? 180,
    requireConsentForEmail: formData.get("requireConsentForEmail") ? true : false,
    requireConsentForAds: formData.get("requireConsentForAds") ? true : false,
    notes: String(formData.get("notes") ?? current.notes),
    captureSecret: current.captureSecret ?? createCaptureSecret(),
    updatedAt: new Date().toISOString()
  } satisfies CompanyCrmProfile;
}

export function rotateCompanyCrmCaptureSecret(current: CompanyCrmProfile) {
  return {
    ...current,
    captureSecret: createCaptureSecret(),
    updatedAt: new Date().toISOString()
  } satisfies CompanyCrmProfile;
}

export function shouldPushLeadImmediately(profile: CompanyCrmProfile) {
  return isCrmDispatchReady(profile) && profile.syncMode === "push_on_capture";
}

export function shouldQueueLeadForCrmSync(profile: CompanyCrmProfile) {
  return isCrmDispatchReady(profile) && profile.syncMode !== "manual_review";
}

export async function connectHubSpotPrivateApp(
  companySlug: string,
  currentProfile: CompanyCrmProfile,
  accessToken: string
) {
  const tokenInfo = await fetchHubSpotTokenInfo(accessToken);
  const now = new Date().toISOString();

  upsertStoredCompanyCrmConnection({
    companySlug,
    provider: "hubspot",
    accessToken,
    accountLabel: tokenInfo.hubId ? `HubSpot Hub ${tokenInfo.hubId}` : "HubSpot conectado",
    portalId: tokenInfo.hubId ? String(tokenInfo.hubId) : undefined,
    scopes: tokenInfo.scopes ?? [],
    createdAt: now,
    updatedAt: now
  });

  const nextProfile = {
    ...currentProfile,
    provider: "hubspot" as const,
    status: "connected" as const,
    accountLabel: tokenInfo.hubId ? `HubSpot Hub ${tokenInfo.hubId}` : "HubSpot conectado",
    portalId: tokenInfo.hubId ? String(tokenInfo.hubId) : currentProfile.portalId,
    captureSecret: currentProfile.captureSecret ?? createCaptureSecret(),
    updatedAt: now
  };

  upsertStoredCompanyCrmProfile(nextProfile);
  return nextProfile;
}

export async function syncLeadToCrm(company: CompanyProfile, profile: CompanyCrmProfile, lead: CompanyLead) {
  if (profile.provider === "none" || profile.status !== "connected") {
    return lead;
  }

  if (profile.provider === "hubspot") {
    const connection = getStoredCompanyCrmConnection(company.slug, "hubspot");
    if (!connection) {
      const failed = markLeadCrmSyncError(
        lead,
        "hubspot",
        "A conexao HubSpot desta empresa nao foi encontrada no vault."
      );
      upsertStoredCompanyLead(failed);
      return failed;
    }

    if (!lead.email) {
      const failed = markLeadCrmSyncError(
        lead,
        "hubspot",
        "HubSpot exige email para upsert seguro via contato canonico."
      );
      upsertStoredCompanyLead(failed);
      return failed;
    }

    try {
      const externalId = await upsertHubSpotContact(connection.accessToken, lead, profile);
      const synced = markLeadSynced(lead, "hubspot", externalId);
      upsertStoredCompanyLead(synced);
      return synced;
    } catch (error) {
      const failed = markLeadCrmSyncError(
        lead,
        "hubspot",
        sanitizeErrorMessage(error, "Falha ao sincronizar lead com HubSpot.")
      );
      upsertStoredCompanyLead(failed);
      return failed;
    }
  }

  const failed = markLeadCrmSyncError(
    lead,
    profile.provider,
    `O adapter real de ${profile.provider} ainda nao foi implementado no produto.`
  );
  upsertStoredCompanyLead(failed);
  return failed;
}

export async function syncCompanyLeadsToCrm(input: {
  company: CompanyProfile;
  profile: CompanyCrmProfile;
  leads: CompanyLead[];
}) {
  const { company, profile, leads } = input;
  if (profile.provider === "none" || profile.status !== "connected") {
    const nextProfile = {
      ...profile,
      lastSyncAt: new Date().toISOString(),
      lastSyncSummary: "Nenhum CRM conectado para sincronizacao externa.",
      updatedAt: new Date().toISOString()
    };
    upsertStoredCompanyCrmProfile(nextProfile);

    return {
      processed: 0,
      synced: 0,
      failed: 0,
      skipped: leads.length,
      summary: nextProfile.lastSyncSummary,
      profile: nextProfile
    } satisfies SyncCompanyLeadsResult;
  }

  if (!isCrmDispatchReady(profile)) {
    const nextProfile = {
      ...profile,
      status: "action_required" as const,
      lastSyncAt: new Date().toISOString(),
      lastSyncSummary: `O provider ${profile.provider} ja pode ser configurado no funil, mas ainda nao tem adapter de sincronizacao real.`,
      updatedAt: new Date().toISOString()
    };
    upsertStoredCompanyCrmProfile(nextProfile);

    return {
      processed: 0,
      synced: 0,
      failed: 0,
      skipped: leads.length,
      summary: nextProfile.lastSyncSummary,
      profile: nextProfile
    } satisfies SyncCompanyLeadsResult;
  }

  const candidates = leads.filter((lead) => lead.syncStatus === "pending_sync" || lead.syncStatus === "sync_error");
  let synced = 0;
  let failed = 0;
  const skipped = leads.length - candidates.length;

  for (const lead of candidates) {
    const result = await syncLeadToCrm(company, profile, lead);
    if (result.syncStatus === "synced") {
      synced += 1;
    } else {
      failed += 1;
    }
  }

  const nextProfile = {
    ...profile,
    lastSyncAt: new Date().toISOString(),
    lastSyncSummary:
      candidates.length === 0
        ? "Nenhum lead pendente de sincronizacao externa neste ciclo."
        : `CRM externo sincronizado: ${synced} leads enviados com sucesso e ${failed} com falha.`,
    updatedAt: new Date().toISOString()
  };
  upsertStoredCompanyCrmProfile(nextProfile);

  return {
    processed: candidates.length,
    synced,
    failed,
    skipped,
    summary: nextProfile.lastSyncSummary,
    profile: nextProfile
  } satisfies SyncCompanyLeadsResult;
}

export function queueLeadForCrmIfNeeded(lead: CompanyLead, profile: CompanyCrmProfile) {
  if (!shouldQueueLeadForCrmSync(profile) || profile.provider === "none") {
    return lead;
  }

  return markLeadPendingSync(lead, profile.provider);
}

export function applyLeadCommercialAutopilot(profile: CompanyCrmProfile, lead: CompanyLead) {
  if (profile.routingMode === "manual_only") {
    return lead;
  }

  const routeBucket = inferRouteBucket(lead);
  const cadenceTrack = inferCadenceTrack(lead, routeBucket);
  const now = new Date();
  const nextFollowUpAt = resolveNextFollowUpAt(lead, cadenceTrack, now);
  const owner = selectLeadOwner(profile, routeBucket, lead.owner);
  const revenuePotential = lead.revenuePotential ?? lead.opportunityValue;
  const routeReason = buildRouteReason(lead, routeBucket);
  const nextAction = buildNextAction(lead, cadenceTrack, profile);

  return {
    ...lead,
    routeBucket,
    routeReason,
    owner,
    cadenceState: lead.stage === "won" || lead.stage === "lost" ? "completed" : "active",
    cadenceTrack,
    cadenceStep: resolveCadenceStep(lead),
    nextAction,
    nextFollowUpAt,
    lastContactedAt: lead.lastContactedAt ?? (lead.stage !== "new" ? now.toISOString() : undefined),
    opportunityValue: revenuePotential,
    lifetimeValue: lead.stage === "won" ? lead.lifetimeValue ?? lead.revenueActual ?? revenuePotential : lead.lifetimeValue,
    lastTouchedAt: new Date().toISOString()
  } satisfies CompanyLead;
}

async function fetchHubSpotTokenInfo(accessToken: string) {
  const response = await fetch("https://api.hubapi.com/oauth/v2/private-apps/get/access-token-info", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      tokenKey: accessToken
    })
  });

  if (!response.ok) {
    throw new Error(
      `Falha ao validar token HubSpot: ${await readSanitizedResponseText(
        response,
        "HubSpot recusou a validacao do token privado."
      )}`
    );
  }

  return (await response.json()) as HubSpotTokenInfo;
}

async function upsertHubSpotContact(accessToken: string, lead: CompanyLead, profile: CompanyCrmProfile) {
  const name = splitLeadName(lead.fullName);
  const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs: [
        {
          id: lead.email?.trim().toLowerCase(),
          idProperty: "email",
          properties: {
            email: lead.email?.trim().toLowerCase(),
            firstname: name.firstName,
            lastname: name.lastName,
            phone: lead.phone,
            lifecyclestage: mapLeadStageToHubSpotLifecycleStage(lead.stage)
          }
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(await readSanitizedResponseText(response, "Falha ao upsertar contato no HubSpot."));
  }

  const payload = (await response.json()) as HubSpotBatchUpsertResponse;
  return payload.results?.[0]?.id ?? `${profile.provider}:${lead.email?.trim().toLowerCase()}`;
}

function buildDefaultCrmProfile(company: CompanyProfile): CompanyCrmProfile {
  return {
    companySlug: company.slug,
    provider: "none",
    status: "seeded",
    syncMode: "scheduler_sync",
    defaultOwner: "operacao@agentlion.ai",
    salesOwner: "closer@agentlion.ai",
    nurtureOwner: "crm@agentlion.ai",
    vipOwner: "founder@agentlion.ai",
    captureSecret: undefined,
    routingMode: "score_based",
    retentionDays: 180,
    requireConsentForEmail: true,
    requireConsentForAds: true,
    notes: "Conectar primeiro um CRM externo com escopo minimo e manter o Agent Lion como fonte canonica dos leads.",
    updatedAt: new Date().toISOString()
  };
}

function isCrmDispatchReady(profile: CompanyCrmProfile) {
  return profile.provider === "hubspot" && profile.status === "connected";
}

function createCaptureSecret() {
  return randomBytes(18).toString("base64url");
}

function mapLeadStageToHubSpotLifecycleStage(stage: CompanyLead["stage"]) {
  switch (stage) {
    case "qualified":
      return "marketingqualifiedlead";
    case "proposal":
      return "salesqualifiedlead";
    case "won":
      return "customer";
    default:
      return "lead";
  }
}

function inferRouteBucket(lead: CompanyLead): LeadRouteBucket {
  if ((lead.score >= 85) || (lead.revenuePotential ?? 0) >= 5000 || lead.stage === "proposal") {
    return "vip";
  }

  if (
    (lead.source === "google_ads" || lead.source === "site_form" || lead.source === "landing_page") &&
    lead.score >= 70
  ) {
    return "sales";
  }

  if (lead.source === "crm_import") {
    return "reactivation";
  }

  return "nurture";
}

function inferCadenceTrack(lead: CompanyLead, routeBucket: LeadRouteBucket): LeadCadenceTrack {
  if (lead.stage === "proposal") {
    return "proposal_followup";
  }

  if (routeBucket === "reactivation") {
    return "reactivation";
  }

  if (routeBucket === "sales" || routeBucket === "vip") {
    return "inbound_fast_follow";
  }

  return "nurture";
}

function selectLeadOwner(profile: CompanyCrmProfile, routeBucket: LeadRouteBucket, currentOwner: string) {
  if (currentOwner && currentOwner !== profile.defaultOwner) {
    return currentOwner;
  }

  switch (routeBucket) {
    case "vip":
      return profile.vipOwner ?? profile.salesOwner ?? profile.defaultOwner;
    case "sales":
      return profile.salesOwner ?? profile.defaultOwner;
    case "reactivation":
      return profile.nurtureOwner ?? profile.defaultOwner;
    default:
      return profile.nurtureOwner ?? profile.defaultOwner;
  }
}

function resolveCadenceStep(lead: CompanyLead) {
  if (lead.stage === "won" || lead.stage === "lost") {
    return lead.cadenceStep ?? 0;
  }

  return Math.max(lead.cadenceStep ?? 0, lead.stage === "new" ? 1 : 2);
}

function resolveNextFollowUpAt(
  lead: CompanyLead,
  cadenceTrack: LeadCadenceTrack,
  now: Date
) {
  if (lead.stage === "won" || lead.stage === "lost") {
    return undefined;
  }

  if (lead.nextFollowUpAt) {
    return lead.nextFollowUpAt;
  }

  const schedule = new Date(now);
  switch (cadenceTrack) {
    case "inbound_fast_follow":
      schedule.setMinutes(schedule.getMinutes() + 30);
      break;
    case "proposal_followup":
      schedule.setHours(schedule.getHours() + 24);
      break;
    case "reactivation":
      schedule.setHours(schedule.getHours() + 72);
      break;
    default:
      schedule.setHours(schedule.getHours() + 48);
      break;
  }

  return schedule.toISOString();
}

function buildRouteReason(lead: CompanyLead, routeBucket: LeadRouteBucket) {
  switch (routeBucket) {
    case "vip":
      return "Lead com score alto, valor potencial forte ou em fase de proposta.";
    case "sales":
      return `Lead de ${lead.source} com intencao comercial suficiente para time de vendas.`;
    case "reactivation":
      return "Lead importado para reativacao comercial.";
    default:
      return "Lead segue para nutricao ate ganhar sinais de compra mais fortes.";
  }
}

function buildNextAction(lead: CompanyLead, cadenceTrack: LeadCadenceTrack, profile: CompanyCrmProfile) {
  if (lead.stage === "won") {
    return "Registrar onboarding e alimentar LTV/expansao.";
  }

  if (lead.stage === "lost") {
    return "Registrar motivo da perda e revisar rota de reativacao futura.";
  }

  if (profile.requireConsentForEmail && lead.consentStatus !== "granted" && cadenceTrack === "nurture") {
    return "Coletar consentimento antes de iniciar nutricao por email.";
  }

  switch (cadenceTrack) {
    case "inbound_fast_follow":
      return "Responder lead quente e confirmar contexto da demanda em ate 30 minutos.";
    case "proposal_followup":
      return "Fazer follow-up de proposta com CTA de decisao e proximo passo comercial.";
    case "reactivation":
      return "Reabrir conversa com oferta contextual e prova de resultado.";
    default:
      return "Nutrir com prova, clareza de oferta e CTA para qualificacao.";
  }
}
