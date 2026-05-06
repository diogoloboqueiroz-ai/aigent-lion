import { getStoredUserProfessionalProfile } from "@/lib/company-vault";
import { listToTextarea, parsePlatformList, textareaToList } from "@/lib/agent-profiles";
import { buildMarketingToolPromptContext } from "@/lib/marketing-toolbox";
import type { UserPermission, UserProfessionalProfile, UserRole } from "@/lib/domain";
import type { UserSession } from "@/lib/session";

export function getUserProfileKey(session: Pick<UserSession, "provider" | "sub">) {
  return `${session.provider}:${session.sub}`;
}

export function getUserProfessionalProfile(session: UserSession | null): UserProfessionalProfile | null {
  if (!session) {
    return null;
  }

  const userKey = getUserProfileKey(session);
  const storedProfile = getStoredUserProfessionalProfile(userKey);

  if (storedProfile) {
    const role = storedProfile.role ?? "strategist";
    const permissions = storedProfile.permissions ?? getDefaultPermissionsForRole(role);
    const hydratedProfile = {
      ...storedProfile,
      role,
      permissions,
      tenantScope: storedProfile.tenantScope ?? "all",
      allowedCompanySlugs: storedProfile.allowedCompanySlugs ?? []
    };

    return {
      ...hydratedProfile,
      systemPrompt: buildProfessionalSystemPrompt(hydratedProfile)
    };
  }

  const seededProfile: UserProfessionalProfile = {
    userKey,
    email: session.email,
    displayName: session.name,
    role: "strategist",
    permissions: getDefaultPermissionsForRole("strategist"),
    tenantScope: "all",
    allowedCompanySlugs: [],
    trainingStatus: "seeded",
    updatedAt: new Date().toISOString(),
    professionalTitle: "Lider de marketing e crescimento",
    businessModel: "Operacao multiempresa com consultoria, planejamento e execucao orientada a resultado.",
    strategicNorthStar: "Crescer com previsibilidade, controle de CAC e posicionamento forte.",
    decisionStyle: "Analitico, pragmatico e focado em eficiencia com aprovacao consciente.",
    planningCadence: "Revisao semanal com ajustes diarios por prioridade.",
    costDiscipline: "Alta disciplina de custo, com reinvestimento apenas em canais validados.",
    expertiseAreas: ["Planejamento estrategico", "Performance", "Posicionamento", "Oferta e conversao"],
    preferredChannels: ["google-ads", "meta", "ga4", "google-sheets", "search-console"],
    targetSectors: ["Saude", "Educacao", "Servicos premium", "E-commerce"],
    clientSelectionRules: [
      "Priorizar negocios com oferta clara e margem suficiente para escalar.",
      "Evitar operacoes sem clareza de conversao ou sem ownership de ativos."
    ],
    approvalPreferences: [
      "Validar investimentos antes de qualquer pagamento ou mutacao sensivel.",
      "Usar autonomia assistida para rotinas de baixo risco."
    ],
    growthLevers: [
      "Melhorar conversao antes de ampliar verba.",
      "Reforcar autoridade e prova social em paralelo a midia paga.",
      "Escalar apenas campanhas e criativos com sinais reais de eficiencia."
    ],
    learnedPatterns: [
      "Responder rapido a mudancas de CPA.",
      "Revisar oferta e mensagem antes de culpar apenas o canal.",
      "Proteger caixa e margem como parte da estrategia."
    ],
    noGoRules: [
      "Nao operar com promessas irreais ou claims sensiveis.",
      "Nao liberar gastos sem aprovacao quando houver impacto financeiro.",
      "Nao depender de dados pessoais sem base legal e consentimento."
    ],
    strategicNotes: "Refine este perfil com suas especialidades, estilo decisorio e playbooks para o agente aprender sua forma profissional de atuar.",
    systemPrompt: ""
  };

  return {
    ...seededProfile,
    systemPrompt: buildProfessionalSystemPrompt(seededProfile)
  };
}

export function buildProfessionalSystemPrompt(profile: UserProfessionalProfile) {
  return [
    `Voce opera em nome de ${profile.displayName}, que atua como ${profile.professionalTitle}.`,
    `Role operacional: ${profile.role}.`,
    `Permissoes ativas: ${profile.permissions.join(", ")}.`,
    `Escopo de tenants: ${
      profile.tenantScope === "restricted"
        ? `restrito a ${profile.allowedCompanySlugs?.join(", ") || "nenhuma empresa"}`
        : "acesso amplo"
    }.`,
    `Modelo profissional: ${profile.businessModel}`,
    `North star estrategico: ${profile.strategicNorthStar}`,
    `Estilo de decisao: ${profile.decisionStyle}`,
    `Cadencia de planejamento: ${profile.planningCadence}`,
    `Disciplina de custo: ${profile.costDiscipline}`,
    `Especialidades: ${profile.expertiseAreas.join(", ")}`,
    `Canais preferidos: ${profile.preferredChannels.join(", ")}`,
    `Setores foco: ${profile.targetSectors.join(", ")}`,
    `Regras de selecao de operacoes: ${profile.clientSelectionRules.join(", ")}`,
    `Preferencias de aprovacao: ${profile.approvalPreferences.join(", ")}`,
    `Alavancas de crescimento: ${profile.growthLevers.join(", ")}`,
    `Padroes aprendidos: ${profile.learnedPatterns.join(", ")}`,
    `Regras inegociaveis: ${profile.noGoRules.join(", ")}`,
    `Notas estrategicas: ${profile.strategicNotes}`,
    "Ferramentas dominadas pelo agente para operar marketing moderno:",
    buildMarketingToolPromptContext()
  ].join("\n");
}

export function buildProfessionalSummary(profile: UserProfessionalProfile) {
  return `${profile.displayName} conduz a operacao como ${profile.professionalTitle.toLowerCase()}, com foco em ${profile.strategicNorthStar.toLowerCase()}.`;
}

export function parseProfessionalProfileForm(formData: FormData, currentProfile: UserProfessionalProfile) {
  const nextProfile: UserProfessionalProfile = {
    ...currentProfile,
    trainingStatus: "customized",
    updatedAt: new Date().toISOString(),
    role: normalizeRole(String(formData.get("role") ?? currentProfile.role)),
    permissions: currentProfile.permissions,
    tenantScope: currentProfile.tenantScope ?? "all",
    allowedCompanySlugs: currentProfile.allowedCompanySlugs ?? [],
    professionalTitle: String(formData.get("professionalTitle") ?? ""),
    businessModel: String(formData.get("businessModel") ?? ""),
    strategicNorthStar: String(formData.get("strategicNorthStar") ?? ""),
    decisionStyle: String(formData.get("decisionStyle") ?? ""),
    planningCadence: String(formData.get("planningCadence") ?? ""),
    costDiscipline: String(formData.get("costDiscipline") ?? ""),
    expertiseAreas: textareaToList(formData.get("expertiseAreas")),
    preferredChannels: parsePlatformList(formData.get("preferredChannels")),
    targetSectors: textareaToList(formData.get("targetSectors")),
    clientSelectionRules: textareaToList(formData.get("clientSelectionRules")),
    approvalPreferences: textareaToList(formData.get("approvalPreferences")),
    growthLevers: textareaToList(formData.get("growthLevers")),
    learnedPatterns: textareaToList(formData.get("learnedPatterns")),
    noGoRules: textareaToList(formData.get("noGoRules")),
    strategicNotes: String(formData.get("strategicNotes") ?? "")
  };

  const finalProfile = {
    ...nextProfile,
    permissions: getDefaultPermissionsForRole(nextProfile.role)
  };

  return {
    ...finalProfile,
    systemPrompt: buildProfessionalSystemPrompt(finalProfile)
  };
}

export { listToTextarea };

function normalizeRole(value: string): UserRole {
  switch (value) {
    case "admin":
    case "operator":
    case "analyst":
    case "viewer":
      return value;
    default:
      return "strategist";
  }
}

export function getDefaultPermissionsForRole(role: UserRole): UserPermission[] {
  switch (role) {
    case "admin":
      return [
        "agent:run",
        "agent:decide",
        "agent:learn",
        "execution:generate",
        "execution:apply",
        "scheduler:manage",
        "scheduler:run",
        "governance:review",
        "payments:approve"
      ];
    case "strategist":
      return [
        "agent:run",
        "agent:decide",
        "agent:learn",
        "execution:generate",
        "execution:apply",
        "scheduler:manage",
        "scheduler:run",
        "governance:review"
      ];
    case "operator":
      return [
        "agent:run",
        "agent:decide",
        "agent:learn",
        "execution:generate",
        "scheduler:run"
      ];
    case "analyst":
      return ["agent:decide", "agent:learn", "execution:generate"];
    default:
      return [];
  }
}
