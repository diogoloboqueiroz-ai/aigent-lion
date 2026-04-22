import { textareaToList, listToTextarea } from "@/lib/agent-profiles";
import { getStoredCompanyDataOpsProfile } from "@/lib/company-vault";
import type { CompanyDataOpsProfile, CompanyProfile, UserProfessionalProfile } from "@/lib/domain";

export function getCompanyDataOpsProfile(
  company: CompanyProfile,
  professionalProfile?: UserProfessionalProfile | null
): CompanyDataOpsProfile {
  const seedProfile: CompanyDataOpsProfile = {
    companySlug: company.slug,
    status: "seeded",
    updatedAt: new Date().toISOString(),
    reportingCadence: professionalProfile?.planningCadence ?? "Revisao diaria e consolidado semanal",
    analyticsObjective: `Ler GA4, Search Console e campanhas para proteger ${company.primaryGoal.toLowerCase()}.`,
    sheetsWorkspaceName: `${company.name} - control sheet`,
    ga4PropertyId: "",
    searchConsoleSiteUrl: "",
    sheetsSpreadsheetId: "",
    sheetsOverviewRange: "AgentLion!A1",
    primaryKpis: ["Sessions", "Leads", "CAC", "ROAS", "CTR", "Conversoes"],
    sheetAutomations: [
      "Atualizar planilha de KPIs diariamente com GA4 e canais pagos.",
      "Gerar aba de alertas para queda de conversao ou pico de custo.",
      "Preparar consolidado semanal para reuniao e tomada de decisao."
    ],
    approvedWriteActions: [
      "Atualizar abas internas de KPI e backlog.",
      "Criar novas linhas de historico operacional.",
      "Gerar consolidado executivo em Google Sheets."
    ],
    autonomyRule:
      "O agente pode ler GA4, Search Console e atualizar Google Sheets operacionais de forma autonoma. Apenas postagens externas, gastos, deploys ou alteracoes sensiveis pedem confirmacao.",
    systemNotes: professionalProfile
      ? `Aplicar o estilo de decisao ${professionalProfile.decisionStyle.toLowerCase()} e a disciplina de custo "${professionalProfile.costDiscipline}".`
      : "Refinar com a rotina real de acompanhamento de dados desta empresa.",
    lastSyncedAt: undefined,
    lastSyncSummary: undefined
  };

  const stored = getStoredCompanyDataOpsProfile(company.slug);
  if (stored) {
    return {
      ...seedProfile,
      ...stored
    };
  }

  return seedProfile;
}

export function parseDataOpsForm(formData: FormData, current: CompanyDataOpsProfile) {
  return {
    ...current,
    status: "customized" as const,
    updatedAt: new Date().toISOString(),
    reportingCadence: String(formData.get("reportingCadence") ?? ""),
    analyticsObjective: String(formData.get("analyticsObjective") ?? ""),
    sheetsWorkspaceName: String(formData.get("sheetsWorkspaceName") ?? ""),
    ga4PropertyId: String(formData.get("ga4PropertyId") ?? ""),
    searchConsoleSiteUrl: String(formData.get("searchConsoleSiteUrl") ?? ""),
    sheetsSpreadsheetId: String(formData.get("sheetsSpreadsheetId") ?? ""),
    sheetsOverviewRange: String(formData.get("sheetsOverviewRange") ?? ""),
    primaryKpis: textareaToList(formData.get("primaryKpis")),
    sheetAutomations: textareaToList(formData.get("sheetAutomations")),
    approvedWriteActions: textareaToList(formData.get("approvedWriteActions")),
    autonomyRule: String(formData.get("autonomyRule") ?? ""),
    systemNotes: String(formData.get("systemNotes") ?? ""),
    lastSyncedAt: current.lastSyncedAt,
    lastSyncSummary: current.lastSyncSummary
  };
}

export { listToTextarea };
