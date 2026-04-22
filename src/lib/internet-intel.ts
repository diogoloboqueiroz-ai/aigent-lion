import { getStoredInternetIntelligenceProfile } from "@/lib/company-vault";
import type { InternetIntelligenceProfile } from "@/lib/domain";

export function getInternetIntelligenceProfile() {
  const stored = getStoredInternetIntelligenceProfile();
  if (stored) {
    return stored;
  }

  return {
    status: "seeded",
    updatedAt: new Date().toISOString(),
    accessMode: "live_web_enabled",
    liveUpdateCadence: "Monitoramento continuo com revisoes diarias e alertas em tempo real",
    sourceTypes: [
      "Documentacao oficial",
      "Noticias de mercado",
      "Sites de concorrentes",
      "Blogs e bases de SEO",
      "Redes sociais e anuncios visiveis",
      "Marketplaces e resultados de busca"
    ],
    monitoredTopics: [
      "Mudancas em Google Ads, Meta Ads e SEO",
      "Novas ofertas e campanhas de concorrentes",
      "Tendencias de conteudo e criativos",
      "Mudancas de politica de plataforma",
      "Ferramentas e IAs relevantes para marketing"
    ],
    allowedDomains: [
      "google.com",
      "developers.google.com",
      "support.google.com",
      "business.facebook.com",
      "facebook.com",
      "instagram.com",
      "meta.com",
      "canva.com",
      "adobe.com",
      "youtube.com",
      "linkedin.com",
      "tiktok.com"
    ],
    blockedDomains: [
      "fontes sem reputacao clara",
      "sites com coleta duvidosa de dados",
      "bases nao autorizadas com dados pessoais"
    ],
    autonomousResearchActions: [
      "Pesquisar novidades, documentacao, concorrentes e tendencias na internet.",
      "Atualizar hipoteses, relatorios e watchlists com sinais novos do mercado.",
      "Cruzar insights online com dados internos da empresa para melhorar estrategia."
    ],
    approvalRequiredActions: [
      "Comprar ferramentas, assinar servicos ou contratar midia.",
      "Publicar respostas publicas, posts ou comunicados externos.",
      "Usar fontes nao aprovadas para decisoes sensiveis."
    ],
    runtimeNotes:
      "O agente pode pesquisar e monitorar a internet em tempo real para abastecer estrategia, conteudo e inteligencia competitiva. Gastos, publicacoes e fontes sensiveis continuam exigindo aprovacao."
  } satisfies InternetIntelligenceProfile;
}

export function parseInternetIntelligenceForm(formData: FormData, current: InternetIntelligenceProfile) {
  return {
    ...current,
    status: "customized" as const,
    updatedAt: new Date().toISOString(),
    liveUpdateCadence: String(formData.get("liveUpdateCadence") ?? current.liveUpdateCadence),
    sourceTypes: textareaToList(formData.get("sourceTypes")),
    monitoredTopics: textareaToList(formData.get("monitoredTopics")),
    allowedDomains: textareaToList(formData.get("allowedDomains")),
    blockedDomains: textareaToList(formData.get("blockedDomains")),
    autonomousResearchActions: textareaToList(formData.get("autonomousResearchActions")),
    approvalRequiredActions: textareaToList(formData.get("approvalRequiredActions")),
    runtimeNotes: String(formData.get("runtimeNotes") ?? current.runtimeNotes)
  };
}

export function listToTextarea(values: string[]) {
  return values.join("\n");
}

function textareaToList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}
