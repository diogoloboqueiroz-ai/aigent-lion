import type { CompanyAgentProfile, CompanyProfile, PlatformId } from "@/lib/domain";
import { buildMarketingToolPromptContext } from "@/lib/marketing-toolbox";
import { getStoredCompanyProfile } from "@/lib/company-vault";

export function getCompanyAgentProfile(company: CompanyProfile): CompanyAgentProfile {
  const storedProfile = getStoredCompanyProfile(company.slug);
  if (storedProfile) {
    return {
      ...storedProfile,
      systemPrompt: buildSystemPrompt(storedProfile)
    };
  }

  const seededProfile: CompanyAgentProfile = {
    companySlug: company.slug,
    companyName: company.name,
    trainingStatus: "seeded",
    updatedAt: new Date().toISOString(),
    businessSummary: `${company.name} atua no setor de ${company.sector} com foco em ${company.primaryGoal.toLowerCase()}.`,
    brandVoice: "Autoridade clara, linguagem humana, objetiva e confiavel.",
    idealCustomerProfile: `Publico-alvo principal da ${company.name} em ${company.region}, buscando ${company.primaryGoal.toLowerCase()}.`,
    offerStrategy: "Transformar a principal oferta em mensagens simples, prova clara e CTA direto.",
    differentiators: [
      "Atendimento responsivo",
      "Execucao orientada a resultado",
      "Comunicacao profissional e clara"
    ],
    approvedChannels: getDefaultChannels(company.sector),
    contentPillars: [
      "Educacao do mercado",
      "Prova social e autoridade",
      "Ofertas e diferenciais"
    ],
    geoFocus: [company.region],
    conversionEvents: ["Lead qualificado", "Contato por WhatsApp", "Formulario enviado"],
    efficiencyRules: [
      "Priorizar canais de menor CAC validado",
      "Evitar aumento brusco de spend sem justificativa",
      "Reaproveitar criativos vencedores antes de produzir novos lotes"
    ],
    forbiddenClaims: [
      "Promessas irreais de resultado",
      "Atributos pessoais sensiveis",
      "Mensagens que possam ferir politicas de anuncios"
    ],
    operatorNotes: "Completar com detalhes reais da empresa para personalizar o agente.",
    systemPrompt: ""
  };

  return {
    ...seededProfile,
    systemPrompt: buildSystemPrompt(seededProfile)
  };
}

export function buildSystemPrompt(profile: CompanyAgentProfile) {
  return [
    `Voce opera como o agente de marketing da empresa ${profile.companyName}.`,
    `Resumo do negocio: ${profile.businessSummary}`,
    `Tom de voz: ${profile.brandVoice}`,
    `ICP: ${profile.idealCustomerProfile}`,
    `Estrategia de oferta: ${profile.offerStrategy}`,
    `Diferenciais: ${profile.differentiators.join(", ")}`,
    `Canais aprovados: ${profile.approvedChannels.join(", ")}`,
    `Pilares de conteudo: ${profile.contentPillars.join(", ")}`,
    `Geo foco: ${profile.geoFocus.join(", ")}`,
    `Conversoes mais importantes: ${profile.conversionEvents.join(", ")}`,
    `Regras de eficiencia: ${profile.efficiencyRules.join(", ")}`,
    `Claims proibidos: ${profile.forbiddenClaims.join(", ")}`,
    `Notas operacionais: ${profile.operatorNotes}`,
    "Voce domina o stack martech mais usado pelo mercado nas categorias abaixo:",
    buildMarketingToolPromptContext()
  ].join("\n");
}

export function textareaToList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function listToTextarea(values: string[]) {
  return values.join("\n");
}

export function parsePlatformList(value: FormDataEntryValue | null): PlatformId[] {
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

function getDefaultChannels(sector: string): PlatformId[] {
  const normalized = sector.toLowerCase();

  if (normalized.includes("e-commerce")) {
    return ["meta", "ga4", "google-sheets", "google-ads", "gmail"];
  }

  if (normalized.includes("saude")) {
    return ["google-ads", "ga4", "google-sheets", "search-console", "business-profile"];
  }

  return ["google-ads", "ga4", "google-sheets", "search-console", "gmail"];
}
