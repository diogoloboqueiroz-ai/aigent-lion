import { getStoredCompanyKeywordStrategy, getStoredCompanyLeads } from "@/lib/company-vault";
import type {
  CompanyKeywordStrategy,
  CompanyLead,
  CompanyProfile,
  LeadCadenceTrack,
  LeadRouteBucket,
  LeadSource,
  LeadStage,
  PlatformId
} from "@/lib/domain";

export function getCompanyKeywordStrategy(company: CompanyProfile): CompanyKeywordStrategy {
  const stored = getStoredCompanyKeywordStrategy(company.slug);
  if (stored) {
    return stored;
  }

  return {
    companySlug: company.slug,
    status: "seeded",
    updatedAt: new Date().toISOString(),
    mainOffer: company.primaryGoal,
    primaryKeywords: getSeedKeywords(company.sector),
    longTailKeywords: [
      `melhor ${company.sector.toLowerCase()} em ${company.region.toLowerCase()}`,
      `${company.sector.toLowerCase()} com alta conversao`,
      `${company.sector.toLowerCase()} com atendimento especializado`
    ],
    negativeKeywords: ["gratis", "pirata", "pdf", "download", "vagas"],
    conversionAngles: [
      "Dor principal do cliente com solução clara",
      "Prova de autoridade e diferenciais objetivos",
      "Oferta simples com CTA imediato"
    ],
    landingMessages: [
      "Headline com beneficio concreto",
      "Prova social ou autoridade logo acima da dobra",
      "CTA claro em todos os blocos criticos"
    ],
    audienceSignals: [
      "Intencao de busca por problema e solucao",
      "Interesse recente no segmento",
      "Historico de interacao com conteudo de alta intencao"
    ],
    approvedDataSources: [
      "Dados primarios consentidos do proprio negocio",
      "Sinais agregados das plataformas de anuncios",
      "Search trends e consultas publicas",
      "Conteudo publico de concorrentes e reviews publicos"
    ],
    blockedDataSources: [
      "Dados pessoais sensiveis sem consentimento",
      "Scraping de PII da internet",
      "Bases vazadas ou compradas sem base legal"
    ],
    optimizationRules: [
      "Priorizar palavras com intencao de compra ou decisao",
      "Pausar termos caros sem sinal de conversao",
      "Reforcar combinacoes de keyword + oferta que sustentem CAC"
    ],
    complianceNote:
      "Usar apenas dados consentidos, agregados ou publicos/contextuais. Nao usar dados pessoais de usuarios da internet de forma identificavel ou sem base legal."
  };
}

export function getCompanyLeads(companySlug: string) {
  return getStoredCompanyLeads(companySlug).sort((left, right) => right.lastTouchedAt.localeCompare(left.lastTouchedAt));
}

export function buildCompanyLead(input: {
  company: CompanyProfile;
  fullName: string;
  email?: string;
  phone?: string;
  source: LeadSource;
  channel: string;
  campaignName?: string;
  clientEventId?: string;
  owner: string;
  nextAction: string;
  nextFollowUpAt?: string;
  revenuePotential?: number;
  consentStatus: CompanyLead["consentStatus"];
  notes?: string[];
  originPath?: string;
  pageUrl?: string;
  referrerUrl?: string;
  gaClientId?: string;
  userAgent?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}) {
  const now = new Date().toISOString();

  return {
    id: `lead-${input.company.slug}-${Date.now()}`,
    companySlug: input.company.slug,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    source: input.source,
    channel: input.channel,
    campaignName: input.campaignName,
    clientEventId: input.clientEventId,
    stage: "new" as const,
    score: scoreLead(input.source, input.revenuePotential),
    owner: input.owner,
    nextAction: input.nextAction,
    nextFollowUpAt: input.nextFollowUpAt,
    revenuePotential: input.revenuePotential,
    revenueActual: undefined,
    consentStatus: input.consentStatus,
    notes: input.notes?.length ? input.notes : ["Lead criado pelo Agent Lion."],
    capturedAt: now,
    lastTouchedAt: now,
    originPath: input.originPath,
    pageUrl: input.pageUrl,
    referrerUrl: input.referrerUrl,
    gaClientId: input.gaClientId,
    userAgent: input.userAgent,
    gclid: input.gclid,
    gbraid: input.gbraid,
    wbraid: input.wbraid,
    fbclid: input.fbclid,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    utmCampaign: input.utmCampaign,
    utmContent: input.utmContent,
    utmTerm: input.utmTerm,
    syncStatus: "local_only" as const
  } satisfies CompanyLead;
}

export function updateCompanyLead(
  lead: CompanyLead,
  input: {
    stage?: LeadStage;
    nextAction?: string;
    nextFollowUpAt?: string;
    owner?: string;
    revenueActual?: number;
    revenuePotential?: number;
    opportunityValue?: number;
    lifetimeValue?: number;
    lostReason?: string;
    lastContactedAt?: string;
    note?: string;
  }
) {
  const notes = input.note ? [input.note, ...lead.notes].slice(0, 12) : lead.notes;

  return {
    ...lead,
    stage: input.stage ?? lead.stage,
    nextAction: input.nextAction ?? lead.nextAction,
    nextFollowUpAt: input.nextFollowUpAt ?? lead.nextFollowUpAt,
    owner: input.owner ?? lead.owner,
    revenueActual: input.revenueActual ?? lead.revenueActual,
    revenuePotential: input.revenuePotential ?? lead.revenuePotential,
    opportunityValue: input.opportunityValue ?? lead.opportunityValue,
    lifetimeValue: input.lifetimeValue ?? lead.lifetimeValue,
    lostReason: input.lostReason ?? lead.lostReason,
    lastContactedAt: input.lastContactedAt ?? lead.lastContactedAt,
    notes,
    lastTouchedAt: new Date().toISOString()
  } satisfies CompanyLead;
}

export function markLeadPendingSync(
  lead: CompanyLead,
  provider: Exclude<CompanyLead["externalCrmProvider"], undefined>
) {
  return {
    ...lead,
    syncStatus: "pending_sync" as const,
    externalCrmProvider: provider,
    syncError: undefined
  } satisfies CompanyLead;
}

export function markLeadSynced(
  lead: CompanyLead,
  provider: Exclude<CompanyLead["externalCrmProvider"], undefined>,
  externalCrmId?: string
) {
  return {
    ...lead,
    syncStatus: "synced" as const,
    externalCrmProvider: provider,
    externalCrmId,
    syncError: undefined,
    lastSyncedAt: new Date().toISOString()
  } satisfies CompanyLead;
}

export function markLeadCrmSyncError(
  lead: CompanyLead,
  provider: Exclude<CompanyLead["externalCrmProvider"], undefined>,
  message: string
) {
  return {
    ...lead,
    syncStatus: "sync_error" as const,
    externalCrmProvider: provider,
    syncError: message,
    lastSyncedAt: new Date().toISOString()
  } satisfies CompanyLead;
}

export function getLeadStageLabel(stage: LeadStage) {
  switch (stage) {
    case "new":
      return "novo";
    case "contacted":
      return "contatado";
    case "qualified":
      return "qualificado";
    case "proposal":
      return "proposta";
    case "won":
      return "ganho";
    default:
      return "perdido";
  }
}

export function getLeadSourceLabel(source: LeadSource) {
  switch (source) {
    case "site_form":
      return "site";
    case "landing_page":
      return "landing page";
    case "whatsapp":
      return "whatsapp";
    case "meta_ads":
      return "meta ads";
    case "google_ads":
      return "google ads";
    case "organic":
      return "organico";
    case "crm_import":
      return "crm import";
    default:
      return "manual";
  }
}

export function getLeadSyncStatusLabel(status: CompanyLead["syncStatus"]) {
  switch (status) {
    case "pending_sync":
      return "pendente de sync";
    case "synced":
      return "sincronizado";
    case "sync_error":
      return "erro de sync";
    default:
      return "local";
  }
}

export function getLeadRouteBucketLabel(routeBucket: LeadRouteBucket | undefined) {
  switch (routeBucket) {
    case "sales":
      return "vendas";
    case "vip":
      return "vip";
    case "reactivation":
      return "reativacao";
    case "nurture":
      return "nutricao";
    default:
      return "sem rota";
  }
}

export function getLeadCadenceTrackLabel(track: LeadCadenceTrack | undefined) {
  switch (track) {
    case "inbound_fast_follow":
      return "resposta rapida";
    case "proposal_followup":
      return "follow-up proposta";
    case "reactivation":
      return "reativacao";
    case "nurture":
      return "nutricao";
    default:
      return "sem cadencia";
  }
}

export function listToTextarea(values: string[]) {
  return values.join("\n");
}

export function textareaToList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parsePlatformListFromTextarea(value: FormDataEntryValue | null): PlatformId[] {
  return textareaToList(value).filter((entry): entry is PlatformId =>
    [
      "ga4",
      "google-sheets",
      "search-console",
      "google-ads",
      "meta",
      "business-profile",
      "gmail",
      "youtube"
    ].includes(entry)
  );
}

export function splitLeadName(fullName: string) {
  const normalized = fullName.trim();
  if (!normalized) {
    return {
      firstName: "Lead",
      lastName: "Agent Lion"
    };
  }

  const parts = normalized.split(/\s+/);
  return {
    firstName: parts[0] ?? normalized,
    lastName: parts.slice(1).join(" ") || "."
  };
}

function scoreLead(source: LeadSource, revenuePotential?: number) {
  const sourceWeight = {
    site_form: 72,
    landing_page: 78,
    whatsapp: 74,
    meta_ads: 70,
    google_ads: 82,
    organic: 68,
    manual: 60,
    crm_import: 58
  } satisfies Record<LeadSource, number>;

  const revenueWeight = revenuePotential && revenuePotential >= 5000 ? 8 : revenuePotential && revenuePotential >= 1000 ? 4 : 0;
  return Math.min(100, sourceWeight[source] + revenueWeight);
}

function getSeedKeywords(sector: string) {
  const normalized = sector.toLowerCase();

  if (normalized.includes("saude")) {
    return ["tratamento especializado", "consulta premium", "medico especialista"];
  }

  if (normalized.includes("e-commerce")) {
    return ["comprar online", "oferta oficial", "produto com entrega rapida"];
  }

  return ["servico especializado", "solucao profissional", "empresa confiavel"];
}
