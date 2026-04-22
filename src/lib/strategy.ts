import { listToTextarea, textareaToList } from "@/lib/agent-profiles";
import { getStoredCompanyStrategy } from "@/lib/company-vault";
import type {
  CompanyCompetitor,
  CompanyProfile,
  CompanyStrategicPlan,
  PlatformId,
  UserProfessionalProfile
} from "@/lib/domain";

export function getCompanyStrategicPlan(
  company: CompanyProfile,
  professionalProfile?: UserProfessionalProfile | null
): CompanyStrategicPlan {
  const storedPlan = getStoredCompanyStrategy(company.slug);
  if (storedPlan) {
    return storedPlan;
  }

  const priorityChannels = mergePriorityChannels(
    getPriorityChannels(company.sector),
    professionalProfile?.preferredChannels ?? []
  );

  return {
    companySlug: company.slug,
    status: "seeded",
    updatedAt: new Date().toISOString(),
    planningHorizon: "90 dias",
    primaryObjective: company.primaryGoal,
    secondaryObjective: professionalProfile
      ? `Executar crescimento com o estilo ${professionalProfile.decisionStyle.toLowerCase()}.`
      : "Ganhar previsibilidade de crescimento com CAC controlado.",
    monthlyBudget: professionalProfile
      ? `Definir com o usuario dentro da regra: ${professionalProfile.costDiscipline}.`
      : "Definir com o usuario conforme margem e maturidade do canal.",
    reachGoal: "Aumentar o alcance qualificado em 20% ao mes.",
    leadGoal: "Crescer o volume de leads qualificados de forma sustentavel.",
    revenueGoal: "Aumentar receita com foco em canais de melhor eficiencia.",
    cpaTarget: "Manter CPA dentro da faixa historicamente rentavel.",
    roasTarget: "Buscar ROAS acima do baseline atual.",
    priorityChannels,
    priorityMarkets: [company.region],
    strategicInitiatives: [
      "Fortalecer posicionamento da marca nos canais principais.",
      "Aumentar taxa de conversao com ofertas e paginas mais claras.",
      "Construir rotina de insights, testes e reaproveitamento de criativos vencedores.",
      ...(professionalProfile?.growthLevers.slice(0, 2).map((lever) => `Aplicar a alavanca profissional: ${lever}.`) ?? [])
    ].slice(0, 5),
    dailyRituals: [
      "Checar performance de contas e anomalias de spend.",
      "Avaliar movimento dos concorrentes e ofertas em destaque.",
      "Priorizar correcoes com impacto imediato em CAC, alcance e conversao.",
      ...(professionalProfile?.learnedPatterns.slice(0, 1).map((pattern) => `Aplicar aprendizado do operador: ${pattern}.`) ?? [])
    ],
    weeklyRituals: [
      "Revisar relatorio semanal com o usuario.",
      "Definir experimento principal da semana.",
      "Atualizar backlog de criativos, campanhas e SEO.",
      ...(professionalProfile?.approvalPreferences.slice(0, 1).map((preference) => `Respeitar a regra de aprovacao: ${preference}.`) ?? [])
    ],
    risksToWatch: [
      "Aumento de CPA por fadiga criativa.",
      "Concorrentes ganhando share of voice em canais pagos.",
      "Dependencia excessiva de um canal unico.",
      ...(professionalProfile ? [`Desalinhamento com o north star do operador: ${professionalProfile.strategicNorthStar}.`] : [])
    ],
    userAlignmentNotes: professionalProfile
      ? `${professionalProfile.displayName} conduz a operacao como ${professionalProfile.professionalTitle.toLowerCase()} e quer ${professionalProfile.strategicNorthStar.toLowerCase()}.`
      : "Completar com preferencias reais do usuario, budget, sazonalidade e restricoes comerciais.",
    competitors: getSeedCompetitors(company)
  };
}

export function parseStrategicCompetitors(value: FormDataEntryValue | null): CompanyCompetitor[] {
  return String(value ?? "")
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [name = "", positioning = "", channels = "", offers = "", strengths = "", weaknesses = "", notes = ""] =
        block.split("|").map((part) => part.trim());

      return {
        name,
        positioning,
        observedChannels: parsePlatformEntries(channels),
        offers: commaList(offers),
        strengths: commaList(strengths),
        weaknesses: commaList(weaknesses),
        notes
      };
    })
    .filter((competitor) => competitor.name);
}

export function competitorsToTextarea(competitors: CompanyCompetitor[]) {
  return competitors
    .map((competitor) =>
      [
        competitor.name,
        competitor.positioning,
        competitor.observedChannels.join(", "),
        competitor.offers.join(", "),
        competitor.strengths.join(", "),
        competitor.weaknesses.join(", "),
        competitor.notes
      ].join(" | ")
    )
    .join("\n\n");
}

export function parsePlatformEntries(value: string): PlatformId[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry): entry is PlatformId =>
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

export { listToTextarea, textareaToList };

function getPriorityChannels(sector: string): PlatformId[] {
  const normalized = sector.toLowerCase();

  if (normalized.includes("saude")) {
    return ["google-ads", "ga4", "google-sheets", "search-console", "business-profile"];
  }

  if (normalized.includes("e-commerce")) {
    return ["meta", "google-ads", "ga4", "google-sheets", "gmail"];
  }

  return ["google-ads", "ga4", "google-sheets", "search-console", "gmail"];
}

function mergePriorityChannels(defaultChannels: PlatformId[], preferredChannels: PlatformId[]) {
  return [...new Set([...defaultChannels, ...preferredChannels])];
}

function getSeedCompetitors(company: CompanyProfile): CompanyCompetitor[] {
  return [
    {
      name: `Concorrente principal de ${company.name}`,
      positioning: "Marca mais visivel no mercado local e com mensagens agressivas.",
      strengths: ["Consistencia de presenca", "Oferta clara"],
      weaknesses: ["Pouca profundidade de autoridade", "Dependencia de anuncios"],
      observedChannels: getPriorityChannels(company.sector),
      offers: ["Oferta principal agressiva", "CTA direto"],
      notes: "Substituir por concorrentes reais assim que o usuario definir os nomes."
    }
  ];
}

function commaList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
