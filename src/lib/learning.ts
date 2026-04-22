import {
  getStoredCompanyAgentLearnings,
  replaceStoredCompanyAgentLearnings
} from "@/lib/company-vault";
import type {
  CompanyAgentLearning,
  CompanyExecutionPlan,
  CompanyOperationalAlert,
  CompanyWorkspace,
  ExecutionTrackPriority,
  SocialInsightSnapshot
} from "@/lib/domain";

type SyncCompanyLearningMemoryInput = {
  workspace: CompanyWorkspace;
  latestPlan?: CompanyExecutionPlan;
  alerts?: CompanyOperationalAlert[];
};

export function getCompanyAgentLearnings(companySlug: string) {
  return getStoredCompanyAgentLearnings(companySlug).sort(sortLearnings);
}

export function syncCompanyLearningMemory(input: SyncCompanyLearningMemoryInput) {
  const latestPlan = input.latestPlan ?? input.workspace.executionPlans[0];
  const alerts = input.alerts ?? input.workspace.operationalAlerts;
  const generatedLearnings = dedupeLearnings([
    ...(latestPlan ? buildPlanLearnings(input.workspace.company.slug, latestPlan) : []),
    ...buildAlertLearnings(input.workspace.company.slug, alerts),
    ...buildRuntimeLearnings(input.workspace),
    ...buildConversionLearnings(input.workspace),
    ...buildReportLearnings(input.workspace),
    ...buildSocialInsightLearnings(input.workspace.company.slug, input.workspace.socialInsights)
  ]);
  const existingLearnings = getStoredCompanyAgentLearnings(input.workspace.company.slug);
  const existingById = new Map(existingLearnings.map((learning) => [learning.id, learning]));
  const activeIds = new Set(generatedLearnings.map((learning) => learning.id));
  const now = new Date().toISOString();

  const nextLearnings = generatedLearnings.map((learning) => {
    const previous = existingById.get(learning.id);
    const changed = !previous || buildLearningFingerprint(previous) !== buildLearningFingerprint(learning);

    return {
      ...learning,
      generatedAt: previous?.generatedAt ?? learning.generatedAt,
      updatedAt: now,
      status: changed ? "fresh" : "active",
      lastAppliedAt: previous?.lastAppliedAt
    } satisfies CompanyAgentLearning;
  });

  const historicalLearnings = existingLearnings
    .filter((learning) => !activeIds.has(learning.id))
    .map((learning) => ({
      ...learning,
      status: "historical" as const
    }));

  const combined = [...nextLearnings, ...historicalLearnings].sort(sortLearnings).slice(0, 180);
  replaceStoredCompanyAgentLearnings(input.workspace.company.slug, combined);
  return combined;
}

export function getAgentLearningKindLabel(kind: CompanyAgentLearning["kind"]) {
  switch (kind) {
    case "playbook":
      return "playbook";
    case "risk":
      return "risco";
    case "warning":
      return "alerta";
    default:
      return "oportunidade";
  }
}

export function getAgentLearningStatusLabel(status: CompanyAgentLearning["status"]) {
  switch (status) {
    case "fresh":
      return "novo";
    case "active":
      return "ativo";
    default:
      return "historico";
  }
}

function buildPlanLearnings(companySlug: string, plan: CompanyExecutionPlan): CompanyAgentLearning[] {
  return (plan.recommendedActions ?? []).reduce<CompanyAgentLearning[]>((learnings, action) => {
    const base = {
      companySlug,
      sourceType: "execution_plan" as const,
      sourcePath: `/empresas/${companySlug}/operacao`,
      sourceLabel: "Abrir operacao",
      generatedAt: plan.generatedAt,
      updatedAt: plan.generatedAt,
      evidence: action.evidence
    };

    if (action.status === "executed") {
      learnings.push({
          id: `learning-plan-executed-${action.id}`,
          kind: "playbook" as const,
          status: "fresh" as const,
          priority: action.priority,
          confidence: action.mode === "auto_low_risk" ? 0.92 : 0.84,
          title: `Playbook confirmado: ${action.title}`,
          summary: action.outcome ?? action.detail,
          recommendedAction: action.outcome ?? action.detail,
          ...base
        });
      return learnings;
    }

    if (action.status === "blocked") {
      learnings.push({
          id: `learning-plan-blocked-${action.id}`,
          kind: action.mode === "policy_review" ? ("warning" as const) : ("risk" as const),
          status: "fresh" as const,
          priority: action.priority,
          confidence: 0.88,
          title: `Gargalo observado: ${action.title}`,
          summary: action.outcome ?? action.detail,
          recommendedAction: "Abrir a origem do bloqueio e remover a dependencia antes do proximo replay.",
          ...base
        });
      return learnings;
    }

    if (action.priority === "critical" || action.priority === "high") {
      learnings.push({
          id: `learning-plan-opportunity-${action.id}`,
          kind: "opportunity" as const,
          status: "fresh" as const,
          priority: action.priority,
          confidence: 0.76,
          title: `Oportunidade operacional: ${action.title}`,
          summary: action.detail,
          recommendedAction: action.detail,
          ...base
        });
    }

    return learnings;
  }, []);
}

function buildAlertLearnings(companySlug: string, alerts: CompanyOperationalAlert[]): CompanyAgentLearning[] {
  return alerts
    .filter((alert) => alert.status !== "resolved")
    .map((alert) => ({
      id: `learning-alert-${alert.id}`,
      companySlug,
      kind: alert.priority === "critical" ? ("warning" as const) : ("risk" as const),
      status: "fresh" as const,
      priority: alert.priority,
      confidence: 0.86,
      title: alert.title,
      summary: alert.message,
      recommendedAction: `Tratar o alerta em ${alert.sourceLabel.toLowerCase()}.`,
      evidence: alert.evidence,
      sourceType: "operational_alert" as const,
      sourcePath: alert.sourcePath,
      sourceLabel: alert.sourceLabel,
      generatedAt: alert.updatedAt,
      updatedAt: alert.updatedAt
    }));
}

function buildRuntimeLearnings(workspace: CompanyWorkspace): CompanyAgentLearning[] {
  const recentLogs = workspace.socialExecutionLogs.slice(0, 20);
  const blockedOrFailed = recentLogs.filter((log) => log.status === "blocked" || log.status === "failed");
  const completed = recentLogs.filter((log) => log.status === "completed");
  const learnings: CompanyAgentLearning[] = [];

  if (blockedOrFailed.length > 0) {
    const latestFailure = blockedOrFailed[0];
    learnings.push({
      id: `learning-runtime-risk-${workspace.company.slug}`,
      companySlug: workspace.company.slug,
      kind: blockedOrFailed.some((log) => log.status === "failed") ? "warning" : "risk",
      status: "fresh",
      priority: blockedOrFailed.some((log) => log.status === "failed") ? "critical" : "high",
      confidence: 0.83,
      title: "Padrao de falha na runtime social",
      summary: `${blockedOrFailed.length} eventos recentes ficaram bloqueados ou falharam. Ultimo sinal: ${latestFailure.summary}.`,
      recommendedAction: "Limpar a runtime social e atacar a causa-raiz antes de ampliar automacao.",
      evidence: blockedOrFailed.slice(0, 3).map((log) => `${log.platform}: ${log.detail}`),
      sourceType: "runtime_log",
      sourcePath: `/empresas/${workspace.company.slug}/social/runtime`,
      sourceLabel: "Abrir runtime social",
      generatedAt: latestFailure.startedAt,
      updatedAt: latestFailure.finishedAt ?? latestFailure.startedAt
    });
  }

  if (completed.length >= 2) {
    const successfulPlatforms = Array.from(new Set(completed.map((log) => log.platform)));
    learnings.push({
      id: `learning-runtime-playbook-${workspace.company.slug}`,
      companySlug: workspace.company.slug,
      kind: "playbook",
      status: "fresh",
      priority: "medium",
      confidence: 0.79,
      title: "A runtime ja entrega execucao repetivel",
      summary: `${completed.length} tarefas recentes foram concluidas com sucesso em ${successfulPlatforms.join(", ")}.`,
      recommendedAction: "Reaplicar a rotina vencedora nos canais que ja mostraram estabilidade operacional.",
      evidence: completed.slice(0, 3).map((log) => `${log.platform}: ${log.summary}`),
      sourceType: "runtime_log",
      sourcePath: `/empresas/${workspace.company.slug}/social/runtime`,
      sourceLabel: "Abrir runtime social",
      generatedAt: completed[0].startedAt,
      updatedAt: completed[0].finishedAt ?? completed[0].startedAt
    });
  }

  return learnings;
}

function buildConversionLearnings(workspace: CompanyWorkspace): CompanyAgentLearning[] {
  const recentEvents = workspace.conversionEvents.slice(0, 24);
  const blockedOrFailed = recentEvents.filter((event) => event.status === "blocked" || event.status === "failed");
  const sentEvents = recentEvents.filter((event) => event.status === "sent");
  const wonLeads = workspace.leads.filter((lead) => lead.stage === "won");
  const wonRevenue = wonLeads.reduce((total, lead) => total + (lead.revenueActual ?? 0), 0);
  const learnings: CompanyAgentLearning[] = [];

  if (blockedOrFailed.length > 0) {
    const latestIssue = blockedOrFailed[0];
    learnings.push({
      id: `learning-conversion-risk-${workspace.company.slug}`,
      companySlug: workspace.company.slug,
      kind: blockedOrFailed.some((event) => event.status === "failed") ? "warning" : "risk",
      status: "fresh",
      priority: blockedOrFailed.some((event) => event.status === "failed") ? "critical" : "high",
      confidence: 0.9,
      title: "Dispatch de conversao com gargalo ativo",
      summary: `${blockedOrFailed.length} eventos recentes ficaram bloqueados ou falharam. Ultimo sinal: ${latestIssue.summary}.`,
      recommendedAction: "Abrir a trilha de conversao e corrigir mapping, credenciais ou identificadores antes do proximo replay.",
      evidence: blockedOrFailed
        .slice(0, 4)
        .map((event) => `${event.destination}: ${event.detail}`),
      sourceType: "conversion_event",
      sourcePath: `/empresas/${workspace.company.slug}/conversao`,
      sourceLabel: "Abrir conversao",
      generatedAt: latestIssue.updatedAt,
      updatedAt: latestIssue.updatedAt
    });
  }

  if (sentEvents.length >= 2) {
    const destinations = Array.from(new Set(sentEvents.map((event) => event.destination)));
    const revenueCaptured = sentEvents.reduce((total, event) => total + (event.value ?? 0), 0);
    learnings.push({
      id: `learning-conversion-playbook-${workspace.company.slug}`,
      companySlug: workspace.company.slug,
      kind: "playbook",
      status: "fresh",
      priority: "medium",
      confidence: 0.84,
      title: "Loop de atribuicao ja responde",
      summary: `${sentEvents.length} eventos de conversao recentes foram aceitos por ${destinations.join(", ")}.`,
      recommendedAction:
        revenueCaptured > 0
          ? `Reforcar campanhas e canais ligados aos eventos que ja devolvem sinal com ${formatCurrency(revenueCaptured)} em valor potencial.`
          : "Proteger o fluxo vencedor e ampliar a cobertura de captura para mais campanhas e landing pages.",
      evidence: sentEvents
        .slice(0, 4)
        .map((event) => `${event.destination}: ${event.summary}`),
      sourceType: "conversion_event",
      sourcePath: `/empresas/${workspace.company.slug}/conversao`,
      sourceLabel: "Abrir conversao",
      generatedAt: sentEvents[0].updatedAt,
      updatedAt: sentEvents[0].updatedAt
    });
  }

  if (wonLeads.length > 0 && wonRevenue > 0) {
    learnings.push({
      id: `learning-conversion-revenue-${workspace.company.slug}`,
      companySlug: workspace.company.slug,
      kind: "opportunity",
      status: "fresh",
      priority: wonLeads.length >= 3 ? "high" : "medium",
      confidence: 0.8,
      title: "Receita real ja entrou no funil canonico",
      summary: `${wonLeads.length} leads ganhos registram ${formatCurrency(wonRevenue)} em receita real no workspace.`,
      recommendedAction: "Usar esse feedback para recalibrar prioridade de campanhas, mensagem de landing e cadencias comerciais.",
      evidence: wonLeads
        .slice(0, 3)
        .map((lead) => `${lead.fullName}: ${formatCurrency(lead.revenueActual ?? 0)}`),
      sourceType: "conversion_event",
      sourcePath: `/empresas/${workspace.company.slug}/conversao`,
      sourceLabel: "Abrir conversao",
      generatedAt: wonLeads[0].lastTouchedAt,
      updatedAt: wonLeads[0].lastTouchedAt
    });
  }

  return learnings;
}

function buildReportLearnings(workspace: CompanyWorkspace): CompanyAgentLearning[] {
  const latestReport = workspace.reports[0];
  if (!latestReport) {
    return [];
  }

  return [
    {
      id: `learning-report-${latestReport.id}`,
      companySlug: workspace.company.slug,
      kind: "opportunity",
      status: "fresh",
      priority: "medium",
      confidence: 0.74,
      title: `Leitura executiva: ${latestReport.title}`,
      summary: latestReport.highlights[0] ?? latestReport.summary,
      recommendedAction: latestReport.actions[0],
      evidence: [...latestReport.highlights.slice(0, 2), ...latestReport.risks.slice(0, 1)],
      sourceType: "report",
      sourcePath: `/empresas/${workspace.company.slug}/relatorios`,
      sourceLabel: "Abrir relatorios",
      generatedAt: latestReport.generatedAt,
      updatedAt: latestReport.generatedAt
    }
  ];
}

function buildSocialInsightLearnings(
  companySlug: string,
  insights: SocialInsightSnapshot[]
): CompanyAgentLearning[] {
  return pickLatestInsights(insights).slice(0, 3).map((snapshot) => ({
    id: `learning-social-${companySlug}-${snapshot.platform}-${snapshot.window}`,
    companySlug,
    kind: "opportunity" as const,
    status: "fresh" as const,
    priority: snapshot.window === "7d" ? "high" : "medium",
    confidence: 0.68,
    title: `Sinal vivo em ${snapshot.platform}`,
    summary: snapshot.note,
    recommendedAction: `Proteger o ritmo de publicacao e iterar criativos em ${snapshot.platform}.`,
    evidence: [
      `Reach ${snapshot.window}: ${snapshot.reach}`,
      `Engajamento ${snapshot.window}: ${snapshot.engagementRate}`,
      `Cliques ${snapshot.window}: ${snapshot.clicks}`
    ],
    sourceType: "social_insight" as const,
    sourcePath: `/empresas/${companySlug}/social`,
    sourceLabel: "Abrir social ops",
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
}

function pickLatestInsights(insights: SocialInsightSnapshot[]) {
  const byPlatform = new Map<string, SocialInsightSnapshot>();

  for (const snapshot of insights) {
    if (snapshot.reach === "n/d") {
      continue;
    }

    const current = byPlatform.get(snapshot.platform);
    if (!current || (current.window === "28d" && snapshot.window === "7d")) {
      byPlatform.set(snapshot.platform, snapshot);
    }
  }

  return Array.from(byPlatform.values());
}

function dedupeLearnings(learnings: CompanyAgentLearning[]) {
  const unique = new Map<string, CompanyAgentLearning>();

  for (const learning of learnings) {
    if (!unique.has(learning.id)) {
      unique.set(learning.id, learning);
    }
  }

  return Array.from(unique.values());
}

function buildLearningFingerprint(learning: CompanyAgentLearning) {
  return [
    learning.kind,
    learning.priority,
    learning.title,
    learning.summary,
    learning.recommendedAction ?? "",
    learning.sourceType,
    learning.sourcePath,
    learning.evidence?.join(" | ") ?? ""
  ].join("::");
}

function sortLearnings(a: CompanyAgentLearning, b: CompanyAgentLearning) {
  return (
    getLearningStatusScore(b.status) - getLearningStatusScore(a.status) ||
    getPriorityScore(b.priority) - getPriorityScore(a.priority) ||
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

function getLearningStatusScore(status: CompanyAgentLearning["status"]) {
  switch (status) {
    case "fresh":
      return 3;
    case "active":
      return 2;
    default:
      return 1;
  }
}

function getPriorityScore(priority: ExecutionTrackPriority) {
  switch (priority) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2
  }).format(value);
}
