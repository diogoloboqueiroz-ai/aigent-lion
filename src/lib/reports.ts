import { appendStoredCompanyReport, getStoredCompanyReports } from "@/lib/company-vault";
import type {
  CompanyGeneratedReport,
  CompanyStrategicPlan,
  CompanyWorkspace,
  MetricSnapshot,
  ReportType,
  UserProfessionalProfile
} from "@/lib/domain";
import { getInternetIntelligenceProfile } from "@/lib/internet-intel";

export function getCompanyReports(companySlug: string) {
  return getStoredCompanyReports(companySlug);
}

export function generateCompanyReport(
  workspace: CompanyWorkspace,
  type: ReportType,
  professionalProfile?: UserProfessionalProfile | null
): CompanyGeneratedReport {
  if (type === "daily_competitor") {
    return buildDailyCompetitorReport(workspace, professionalProfile);
  }

  return buildWeeklyMarketingReport(workspace, professionalProfile);
}

export function saveGeneratedCompanyReport(report: CompanyGeneratedReport) {
  appendStoredCompanyReport(report);
}

function buildDailyCompetitorReport(
  workspace: CompanyWorkspace,
  professionalProfile?: UserProfessionalProfile | null
): CompanyGeneratedReport {
  const topSnapshot = pickPrioritySnapshot(workspace.snapshots);
  const topCompetitors = workspace.strategyPlan.competitors.slice(0, 3);
  const internetIntel = getInternetIntelligenceProfile();

  return {
    id: `daily-${workspace.company.slug}-${Date.now()}`,
    companySlug: workspace.company.slug,
    companyName: workspace.company.name,
    type: "daily_competitor",
    generatedAt: new Date().toISOString(),
    title: `Radar diario de concorrentes - ${workspace.company.name}`,
    summary: `Leitura diaria do mercado para ${workspace.company.name}, comparando posicionamento, canais e oportunidades de resposta com foco em alcance qualificado e eficiencia.`,
    highlights: [
      `${topCompetitors.length} concorrentes priorizados para monitoramento continuo.`,
      `Canal mais sensivel hoje: ${topSnapshot?.platform ?? "google-ads"}.`,
      `Meta principal protegida: ${workspace.strategyPlan.primaryObjective}.`,
      ...(professionalProfile
        ? [`Contexto profissional aplicado: ${professionalProfile.professionalTitle} com foco em ${professionalProfile.strategicNorthStar.toLowerCase()}.`]
        : [])
    ],
    risks: workspace.strategyPlan.risksToWatch.slice(0, 3),
    actions: [
      "Comparar ofertas dos concorrentes com a proposta atual da empresa.",
      "Revisar criativos e mensagens de maior alcance nos canais priorizados.",
      "Definir uma resposta clara para o principal gap competitivo do dia.",
      `Reforcar keywords prioritarias: ${workspace.keywordStrategy.primaryKeywords.slice(0, 3).join(", ")}.`
    ],
    metrics: [
      metric("Meta de alcance", workspace.strategyPlan.reachGoal, "Objetivo informado no planejamento."),
      metric("Meta de CPA", workspace.strategyPlan.cpaTarget, "Usado para filtrar respostas com melhor economia."),
      metric(
        "Concorrentes monitorados",
        String(workspace.strategyPlan.competitors.length),
        "Base atual de benchmark salva para esta empresa."
      )
    ],
    sections: [
      {
        title: "Leitura competitiva do dia",
        bullets: topCompetitors.map(
          (competitor) =>
            `${competitor.name}: posicionamento "${competitor.positioning}". Forcas: ${competitor.strengths.join(", ") || "nao informado"}. Fraquezas exploraveis: ${competitor.weaknesses.join(", ") || "nao informado"}.`
        )
      },
      {
        title: "Oportunidades para ganhar alcance sem desperdiçar verba",
        bullets: buildCompetitiveOpportunities(workspace.strategyPlan, topSnapshot)
      },
      {
        title: "Inteligencia web em tempo real",
        bullets: [
          `Cadencia configurada: ${internetIntel.liveUpdateCadence}.`,
          `Fontes observadas: ${internetIntel.sourceTypes.slice(0, 4).join(", ")}.`,
          `Topicos vivos: ${internetIntel.monitoredTopics.slice(0, 3).join(", ")}.`
        ]
      },
      {
        title: "Checklist diario do agente",
        bullets: workspace.strategyPlan.dailyRituals
      },
      ...(professionalProfile
        ? [
            {
              title: "Leituras aprendidas com o operador",
              bullets: professionalProfile.learnedPatterns.slice(0, 3)
            }
          ]
        : []),
      {
        title: "Guardrail de dados e conversao",
        bullets: [
          workspace.keywordStrategy.complianceNote,
          `Fontes aprovadas: ${workspace.keywordStrategy.approvedDataSources.join(", ")}.`
        ]
      }
    ]
  };
}

function buildWeeklyMarketingReport(
  workspace: CompanyWorkspace,
  professionalProfile?: UserProfessionalProfile | null
): CompanyGeneratedReport {
  const metrics = summarizeSnapshots(workspace.snapshots);
  const mainChannels = workspace.strategyPlan.priorityChannels.join(", ");
  const internetIntel = getInternetIntelligenceProfile();

  return {
    id: `weekly-${workspace.company.slug}-${Date.now()}`,
    companySlug: workspace.company.slug,
    companyName: workspace.company.name,
    type: "weekly_marketing",
    generatedAt: new Date().toISOString(),
    title: `Relatorio semanal de marketing - ${workspace.company.name}`,
    summary: `Relatorio especializado para ${workspace.company.name}, consolidando performance, aprendizado competitivo e plano da proxima semana com foco em crescimento sustentavel.`,
    highlights: [
      `Objetivo principal da semana: ${workspace.strategyPlan.primaryObjective}.`,
      `Canais priorizados: ${mainChannels || "nao definidos"}.`,
      `Perfil do agente: ${workspace.agentProfile.trainingStatus}.`,
      ...(professionalProfile
        ? [`Perfil profissional aplicado: ${professionalProfile.displayName} (${professionalProfile.trainingStatus}).`]
        : [])
    ],
    risks: workspace.strategyPlan.risksToWatch.slice(0, 4),
    actions: [
      "Escolher o principal experimento da proxima semana.",
      "Realocar esforco para o canal com melhor equilibrio entre alcance e eficiencia.",
      "Atualizar backlog de criativos, SEO e campanhas com base nas aprendizados.",
      `Executar o cluster de maior intencao: ${workspace.keywordStrategy.primaryKeywords.slice(0, 2).join(", ")}.`
    ],
    metrics: metrics.map((entry) => metric(entry.label, entry.value, entry.context)),
    sections: [
      {
        title: "Resumo executivo",
        bullets: [
          `A operacao segue orientada por ${workspace.agentProfile.offerStrategy.toLowerCase()}.`,
          `O ICP foco continua sendo: ${workspace.agentProfile.idealCustomerProfile}.`,
          `A prioridade comercial ainda e ${workspace.strategyPlan.primaryObjective.toLowerCase()}.`
        ]
      },
      ...(professionalProfile
        ? [
            {
              title: "Contexto profissional do operador",
              bullets: [
                `North star: ${professionalProfile.strategicNorthStar}.`,
                `Estilo de decisao: ${professionalProfile.decisionStyle}.`,
                `Alavancas favoritas: ${professionalProfile.growthLevers.join(", ")}.`
              ]
            }
          ]
        : []),
      {
        title: "Metas e progresso",
        bullets: [
          `Meta de alcance: ${workspace.strategyPlan.reachGoal}.`,
          `Meta de leads: ${workspace.strategyPlan.leadGoal}.`,
          `Meta de receita: ${workspace.strategyPlan.revenueGoal}.`,
          `Meta de ROAS: ${workspace.strategyPlan.roasTarget}.`
        ]
      },
      {
        title: "Plano estrategico da proxima semana",
        bullets: workspace.strategyPlan.weeklyRituals.concat(workspace.strategyPlan.strategicInitiatives).slice(0, 6)
      },
      {
        title: "Radar de internet e mercado",
        bullets: [
          `O agente segue com monitoramento: ${internetIntel.liveUpdateCadence}.`,
          `Dominios aprovados para pesquisa: ${internetIntel.allowedDomains.slice(0, 5).join(", ")}.`,
          `Temas quentes acompanhados: ${internetIntel.monitoredTopics.slice(0, 3).join(", ")}.`
        ]
      },
      {
        title: "Inteligencia de conversao",
        bullets: [
          `Oferta principal: ${workspace.keywordStrategy.mainOffer}.`,
          `Angulos de conversao: ${workspace.keywordStrategy.conversionAngles.join(", ")}.`,
          `Regras de otimizacao: ${workspace.keywordStrategy.optimizationRules.join(", ")}.`
        ]
      }
    ]
  };
}

function buildCompetitiveOpportunities(strategy: CompanyStrategicPlan, snapshot?: MetricSnapshot) {
  const opportunities = [
    "Ajustar a mensagem principal para destacar um diferencial real que os concorrentes ainda comunicam mal.",
    "Concentrar o investimento no canal onde a empresa consegue mais alcance qualificado por menor custo.",
    "Criar um conteudo-resposta para a principal oferta que o mercado esta promovendo hoje."
  ];

  if (snapshot?.cpa) {
    opportunities.unshift(`O CPA observado em ${snapshot.platform} pede respostas que preservem eficiencia antes de ampliar budget.`);
  }

  if (strategy.competitors[0]?.observedChannels.length) {
    opportunities.push(
      `Monitorar com prioridade os canais ${strategy.competitors[0].observedChannels.join(", ")} para detectar mudancas de posicionamento.`
    );
  }

  return opportunities;
}

function summarizeSnapshots(snapshots: MetricSnapshot[]) {
  return snapshots.map((snapshot) => ({
    label: `${snapshot.platform} ${snapshot.window}`,
    value: buildSnapshotValue(snapshot),
    context: snapshot.notes[0] ?? "Snapshot usado como base do relatorio."
  }));
}

function buildSnapshotValue(snapshot: MetricSnapshot) {
  const parts = [
    snapshot.spend ? `Spend ${formatCurrency(snapshot.spend)}` : null,
    snapshot.clicks ? `${snapshot.clicks} clicks` : null,
    snapshot.conversions ? `${snapshot.conversions} conversoes` : null,
    snapshot.ctr ? `CTR ${formatPercent(snapshot.ctr)}` : null,
    snapshot.cpa ? `CPA ${formatCurrency(snapshot.cpa)}` : null
  ].filter(Boolean);

  return parts.join(" · ") || "Sem metricas suficientes ainda";
}

function pickPrioritySnapshot(snapshots: MetricSnapshot[]) {
  return snapshots[0];
}

function metric(label: string, value: string, context?: string) {
  return { label, value, context };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2
  }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}
