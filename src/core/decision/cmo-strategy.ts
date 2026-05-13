import { buildOptimizationExperiments, buildOptimizationScorecards } from "@/lib/execution";
import type {
  CompanyCmoDelegatedModule,
  CompanyCmoStrategicDecision,
  CompanyOptimizationScorecard
} from "@/lib/domain";
import type { CompanyContext, OpportunityArea } from "@/lib/agents/types";

export function runCoreCmoStrategy(context: CompanyContext): CompanyCmoStrategicDecision {
  const scorecards = buildOptimizationScorecards(context.workspace);
  const recommendedExperiments = buildOptimizationExperiments(context.workspace, scorecards);
  const dominantConstraint = inferDominantConstraint(context, scorecards);
  const winningChannels = scorecards
    .filter((scorecard) => scorecard.decision === "scale")
    .slice(0, 2)
    .map((scorecard) => ({
      channel: scorecard.channel,
      platform: scorecard.platform,
      reason: scorecard.rationale
    }));
  const losingChannels = scorecards
    .filter((scorecard) => scorecard.decision === "pause" || scorecard.decision === "fix")
    .slice(0, 3)
    .map((scorecard) => ({
      channel: scorecard.channel,
      platform: scorecard.platform,
      reason: scorecard.rationale
    }));
  const focusMetric = mapConstraintToFocusMetric(dominantConstraint);
  const delegatedModules = inferDelegatedModules(dominantConstraint, scorecards);
  const confidence = buildConfidence(context, scorecards, dominantConstraint);
  const weeklyThesis = buildWeeklyThesis(context, dominantConstraint, winningChannels, losingChannels);
  const primaryBet = buildPrimaryBet(context, dominantConstraint, winningChannels, losingChannels);
  const supportingBets = buildSupportingBets(context, dominantConstraint, scorecards, recommendedExperiments);

  return {
    id: `cmo-decision-${context.companySlug}-${Date.now()}`,
    companySlug: context.companySlug,
    dominantConstraint,
    weeklyThesis,
    primaryBet,
    supportingBets,
    delegatedModules,
    focusMetric,
    confidence,
    rationale: buildRationale(context, dominantConstraint, scorecards, winningChannels, losingChannels),
    winningChannels,
    losingChannels,
    scorecards,
    recommendedExperiments,
    createdAt: new Date().toISOString()
  };
}

export function doesCoreAreaMatchConstraint(area: OpportunityArea, decision: CompanyCmoStrategicDecision) {
  if (decision.dominantConstraint === area) {
    return true;
  }

  if (decision.dominantConstraint === "tracking" && area === "conversion") {
    return true;
  }

  if (decision.dominantConstraint === "operations" && area === "governance") {
    return true;
  }

  return false;
}

function inferDominantConstraint(
  context: CompanyContext,
  scorecards: CompanyOptimizationScorecard[]
): CompanyCmoStrategicDecision["dominantConstraint"] {
  const blockedSignals = context.workspace.conversionEvents.filter(
    (event) => event.status === "blocked" || event.status === "failed"
  ).length;
  const underperformingChannels = scorecards.filter(
    (scorecard) => scorecard.decision === "pause" || scorecard.decision === "fix"
  ).length;
  const winningChannels = scorecards.filter((scorecard) => scorecard.decision === "scale").length;
  const connectedPriorityChannels = context.workspace.strategyPlan.priorityChannels.filter((platform) =>
    context.workspace.connections.some(
      (connection) => connection.platform === platform && connection.status === "connected"
    )
  ).length;
  const wonLeads = context.workspace.leads.filter((lead) => lead.stage === "won").length;
  const qualifiedLeads = context.workspace.leads.filter(
    (lead) => lead.stage === "qualified" || lead.stage === "proposal"
  ).length;

  if (blockedSignals > 0) {
    return "tracking";
  }

  if (context.kpis.runtimeBlocked + context.kpis.runtimeFailed + context.kpis.approvalBacklog >= 3) {
    return "operations";
  }

  if (winningChannels === 0 && connectedPriorityChannels === 0) {
    return "acquisition";
  }

  if (qualifiedLeads > 0 && wonLeads === 0) {
    return "conversion";
  }

  if (underperformingChannels > winningChannels && connectedPriorityChannels > 0) {
    return "acquisition";
  }

  if (recommendedContentOpportunity(context)) {
    return "content";
  }

  return "acquisition";
}

function buildWeeklyThesis(
  context: CompanyContext,
  dominantConstraint: CompanyCmoStrategicDecision["dominantConstraint"],
  winningChannels: CompanyCmoStrategicDecision["winningChannels"],
  losingChannels: CompanyCmoStrategicDecision["losingChannels"]
) {
  switch (dominantConstraint) {
    case "tracking":
      return `O maior gargalo de ${context.companyName} nao e criativo nem budget agora; e devolver sinal confiavel ao loop de performance para parar de otimizar no escuro.`;
    case "operations":
      return `A semana precisa priorizar destravar operacao antes de abrir novas frentes, porque backlog e runtime ainda estao roubando velocidade do crescimento.`;
    case "conversion":
      return `A empresa ja gera demanda suficiente para aprender; a tese da semana e transformar interesse em receita com funil, oferta e follow-up mais fortes.`;
    case "content":
      return `O crescimento desta rodada depende de reforcar narrativa e ativos criativos antes de escalar distribuicao.`;
    default:
      return winningChannels.length > 0
        ? `A tese da semana e concentrar energia nos canais que ja mostraram tracao real, enquanto corrigimos os que mais desperdiçam budget ou atencao.`
        : losingChannels.length > 0
          ? `A tese da semana e corrigir os canais mais caros e reconstruir aquisicao sobre sinais mais limpos.`
          : `A tese da semana e abrir aquisicao com mais foco, clareza de oferta e conexoes realmente prontas para operar.`;
  }
}

function buildPrimaryBet(
  context: CompanyContext,
  dominantConstraint: CompanyCmoStrategicDecision["dominantConstraint"],
  winningChannels: CompanyCmoStrategicDecision["winningChannels"],
  losingChannels: CompanyCmoStrategicDecision["losingChannels"]
) {
  if (dominantConstraint === "tracking") {
    return "Reparar dispatch de conversao e normalizar atribuicao antes de mexer agressivamente em canal ou criativo.";
  }

  if (dominantConstraint === "operations") {
    return "Drenar backlog operacional, approvals e runtime para recuperar velocidade de execucao.";
  }

  if (dominantConstraint === "conversion") {
    return "Aprimorar oferta, follow-up e passagem de lead para elevar taxa de ganho sem depender de mais spend.";
  }

  if (winningChannels[0]) {
    return `Proteger e ampliar ${winningChannels[0].channel} enquanto os outros canais ficam em correcao ou observacao.`;
  }

  if (losingChannels[0]) {
    return `Segurar ${losingChannels[0].channel} ate que tracking, criativo ou oferta parem de queimar energia sem retorno.`;
  }

  return `Conectar e estabilizar os canais prioritarios do plano estrategico de ${context.companyName}.`;
}

function buildSupportingBets(
  context: CompanyContext,
  dominantConstraint: CompanyCmoStrategicDecision["dominantConstraint"],
  scorecards: CompanyOptimizationScorecard[],
  experiments: CompanyCmoStrategicDecision["recommendedExperiments"]
) {
  const bets = new Set<string>();

  if (dominantConstraint === "tracking") {
    bets.add("Reprocessar sinais de conversao bloqueados e validar destinos um por um.");
  }

  if (context.kpis.approvalBacklog > 0) {
    bets.add("Limpar a fila de aprovacoes que impede materializacao de posts, ads e pagamentos.");
  }

  if (scorecards.some((scorecard) => scorecard.decision === "scale")) {
    bets.add("Preservar capital e foco nos canais com score de saude realmente vencedor.");
  }

  if (scorecards.some((scorecard) => scorecard.decision === "pause")) {
    bets.add("Reduzir perda de energia nos canais classificados como wasteful.");
  }

  if (experiments[0]) {
    bets.add(`Materializar o experimento ${experiments[0].title.toLowerCase()} para acelerar aprendizado causal.`);
  }

  bets.add(`Manter a estrategia alinhada ao objetivo principal: ${context.workspace.strategyPlan.primaryObjective}.`);
  return Array.from(bets).slice(0, 4);
}

function inferDelegatedModules(
  dominantConstraint: CompanyCmoStrategicDecision["dominantConstraint"],
  scorecards: CompanyOptimizationScorecard[]
): CompanyCmoDelegatedModule[] {
  const modules = new Set<CompanyCmoDelegatedModule>(["strategy", "governance"]);

  if (dominantConstraint === "tracking") {
    modules.add("conversion-runtime");
    modules.add("data-ops");
  }

  if (dominantConstraint === "operations") {
    modules.add("social-runtime");
    modules.add("crm");
  }

  if (dominantConstraint === "conversion") {
    modules.add("crm");
    modules.add("site-ops");
    modules.add("conversion-runtime");
  }

  if (dominantConstraint === "content") {
    modules.add("studio");
    modules.add("social-runtime");
  }

  if (scorecards.some((scorecard) => scorecard.platform === "google-ads" || scorecard.platform === "meta")) {
    modules.add("ads");
  }

  return Array.from(modules);
}

function mapConstraintToFocusMetric(
  dominantConstraint: CompanyCmoStrategicDecision["dominantConstraint"]
) {
  switch (dominantConstraint) {
    case "tracking":
      return "conversion_dispatch_health";
    case "operations":
      return "cycle_velocity";
    case "conversion":
      return "lead_to_revenue_rate";
    case "content":
      return "creative_response_rate";
    default:
      return "qualified_acquisition_efficiency";
  }
}

function buildConfidence(
  context: CompanyContext,
  scorecards: CompanyOptimizationScorecard[],
  dominantConstraint: CompanyCmoStrategicDecision["dominantConstraint"]
) {
  const evidenceWeight = Math.min(0.2, context.workspace.snapshots.length * 0.02);
  const scorecardWeight = Math.min(0.2, scorecards.length * 0.03);
  const constraintWeight =
    dominantConstraint === "tracking" || dominantConstraint === "operations" ? 0.18 : 0.12;

  return Math.min(0.96, 0.52 + evidenceWeight + scorecardWeight + constraintWeight);
}

function buildRationale(
  context: CompanyContext,
  dominantConstraint: CompanyCmoStrategicDecision["dominantConstraint"],
  scorecards: CompanyOptimizationScorecard[],
  winningChannels: CompanyCmoStrategicDecision["winningChannels"],
  losingChannels: CompanyCmoStrategicDecision["losingChannels"]
) {
  const fragments = [
    `Dominant constraint: ${dominantConstraint}.`,
    `${context.workspace.snapshots.length} snapshots e ${context.workspace.conversionEvents.length} sinais de conversao foram considerados.`,
    winningChannels[0] ? `Canal vencedor atual: ${winningChannels[0].channel}.` : "Ainda nao existe canal claramente vencedor.",
    losingChannels[0] ? `Canal em risco: ${losingChannels[0].channel}.` : "Nenhum canal foi classificado como wasteful neste ciclo.",
    scorecards.length > 0
      ? `${scorecards.filter((scorecard) => scorecard.decision === "scale").length} canais prontos para escala e ${scorecards.filter((scorecard) => scorecard.decision === "pause").length} canais em pausa potencial.`
      : "Nao ha scorecards suficientes para comparacao de canais."
  ];

  return fragments.join(" ");
}

function recommendedContentOpportunity(context: CompanyContext) {
  return (
    context.workspace.creativeAssets.length === 0 ||
    context.workspace.publishingRequests.filter((request) => request.status === "approved").length > 0
  );
}
