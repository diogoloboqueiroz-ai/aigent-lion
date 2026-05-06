import type { CompanyCmoStrategicDecision } from "@/lib/domain";
import {
  clampScore,
  toPriorityFromScore,
  type CompanyContext,
  type DiagnosticFinding,
  type GrowthOpportunity,
  type OpportunityArea,
  type PrioritizedAction
} from "@/lib/agents/types";
import { doesCoreAreaMatchConstraint } from "@/core/decision/cmo-strategy";
import { isLearningPatternReusable } from "@/core/learning/reuse-eligibility";
import { estimateCoreRiskScoreForAction } from "@/core/policy/policy-engine";

type CoreDecisionPlanningInput = {
  context: CompanyContext;
  findings: DiagnosticFinding[];
  cmoDecision?: CompanyCmoStrategicDecision;
};

type CoreDecisionPlanningResult = {
  opportunities: GrowthOpportunity[];
  actions: PrioritizedAction[];
};

export function buildCoreDecisionPlan(input: CoreDecisionPlanningInput): CoreDecisionPlanningResult {
  const diagnosticOpportunities = input.findings.map((finding) => buildOpportunity(input.context, finding));
  const diagnosticActions = diagnosticOpportunities
    .map((opportunity) =>
      buildAction(
        input.context,
        opportunity,
        input.findings.find((finding) => finding.id === opportunity.findingId)!,
        input.cmoDecision
      )
    )
    .sort((left, right) => right.compositeScore - left.compositeScore);
  const cmoDirected = input.cmoDecision
    ? buildCmoDirectedWork(input.context, input.cmoDecision)
    : { opportunities: [], actions: [] };

  return {
    opportunities: [...diagnosticOpportunities, ...cmoDirected.opportunities],
    actions: [...diagnosticActions, ...cmoDirected.actions].sort(
      (left, right) => right.compositeScore - left.compositeScore
    )
  };
}

function buildCmoDirectedWork(
  context: CompanyContext,
  cmoDecision: CompanyCmoStrategicDecision
) {
  const opportunities: GrowthOpportunity[] = [];
  const actions: PrioritizedAction[] = [];
  const now = new Date().toISOString();
  const dueLeads = context.workspace.leads.filter(
    (lead) =>
      lead.stage !== "won" &&
      lead.stage !== "lost" &&
      (!lead.nextFollowUpAt || lead.nextFollowUpAt <= now || lead.syncStatus !== "synced")
  );

  if (
    dueLeads.length > 0 &&
    (cmoDecision.dominantConstraint === "conversion" || cmoDecision.delegatedModules.includes("crm"))
  ) {
    const opportunity = buildCmoOpportunity({
      context,
      id: `cmo-opportunity-leads-${context.companySlug}`,
      area: "conversion",
      title: "Ativar follow-up comercial do funil",
      summary: `${dueLeads.length} leads precisam de roteamento, cadencia ou sync comercial para a tese atual.`,
      hypothesis: "Leads sem cadencia e owner atrasam receita e escondem aprendizado de funil.",
      targetMetric: "lead_to_revenue_rate",
      evidence: [
        `${dueLeads.length} leads com follow-up vencido ou sync pendente.`,
        `Tese da semana: ${cmoDecision.weeklyThesis}`
      ],
      impactScore: 82,
      urgencyScore: 78,
      effortScore: 36,
      confidence: cmoDecision.confidence
    });
    opportunities.push(opportunity);
    actions.push({
      id: `cmo-action-leads-${context.companySlug}`,
      companySlug: context.companySlug,
      opportunityId: opportunity.id,
      findingId: opportunity.findingId,
      type: "follow_up_leads",
      title: "Executar cadencia comercial priorizada",
      description: "Aplicar roteamento, owner, cadence e sync CRM para leads que ja deveriam estar em movimento.",
      rationale: `O CMO Agent definiu conversao como foco dominante e encontrou ${dueLeads.length} leads sem ritmo comercial suficiente.`,
      evidence: opportunity.evidence,
      targetMetric: opportunity.targetMetric,
      impactScore: opportunity.impactScore,
      urgencyScore: opportunity.urgencyScore,
      confidenceScore: clampScore(opportunity.confidence * 100),
      effortScore: opportunity.effortScore,
      compositeScore: clampScore(84 + getCmoAlignmentBoost({ area: "conversion" } as DiagnosticFinding, undefined, cmoDecision)),
      priority: "high",
      riskScore: estimateCoreRiskScoreForAction({
        type: "follow_up_leads",
        evidence: opportunity.evidence,
        targetPlatform: undefined
      }),
      autonomyMode: "requires_approval",
      params: {
        dueLeadIds: dueLeads.map((lead) => lead.id),
        dueLeadCount: dueLeads.length,
        crmDispatchReady: context.workspace.crmProfile.status === "connected",
        internalOnly: true
      }
    });
  }

  for (const experiment of cmoDecision.recommendedExperiments.slice(0, 2)) {
    const opportunity = buildCmoOpportunity({
      context,
      id: `cmo-opportunity-experiment-${experiment.id}`,
      area: inferOpportunityAreaFromExperiment(experiment.channel, cmoDecision),
      title: `Materializar experimento: ${experiment.title}`,
      summary: experiment.hypothesis,
      hypothesis: experiment.nextAction,
      targetMetric: experiment.primaryMetric,
      evidence: [
        `Canal: ${experiment.channel}`,
        `Tese da semana: ${cmoDecision.weeklyThesis}`,
        `Proxima acao: ${experiment.nextAction}`
      ],
      impactScore: 80,
      urgencyScore: 70,
      effortScore: 34,
      confidence: cmoDecision.confidence
    });
    opportunities.push(opportunity);
    actions.push({
      id: `cmo-action-experiment-${experiment.id}`,
      companySlug: context.companySlug,
      opportunityId: opportunity.id,
      findingId: opportunity.findingId,
      type: "launch_experiment",
      title: `Abrir experimento operacional: ${experiment.title}`,
      description: "Gerar variantes criativas e, quando fizer sentido, abrir landing draft para observar causalidade real.",
      rationale: `O CMO Agent escolheu ${experiment.title} como experimento da semana para validar a tese "${cmoDecision.weeklyThesis}".`,
      evidence: opportunity.evidence,
      targetMetric: experiment.primaryMetric,
      targetPlatform: inferExperimentPlatform(experiment.channel),
      impactScore: opportunity.impactScore,
      urgencyScore: opportunity.urgencyScore,
      confidenceScore: clampScore(opportunity.confidence * 100),
      effortScore: opportunity.effortScore,
      compositeScore: clampScore(82 + getExperimentActionBoost(experiment, cmoDecision)),
      priority: "high",
      riskScore: estimateCoreRiskScoreForAction({
        type: "launch_experiment",
        evidence: opportunity.evidence,
        targetPlatform: inferExperimentPlatform(experiment.channel)
      }),
      autonomyMode: "requires_approval",
      params: {
        experimentId: experiment.id,
        channel: experiment.channel,
        title: experiment.title,
        hypothesis: experiment.hypothesis,
        primaryMetric: experiment.primaryMetric,
        variants: experiment.variants,
        nextAction: experiment.nextAction,
        draftOnly: true,
        buildLandingDraft:
          cmoDecision.delegatedModules.includes("site-ops") &&
          (experiment.channel === "google-ads" || experiment.channel === "meta"),
        landingUrl:
          context.workspace.siteOpsProfile.primarySiteUrl ||
          context.workspace.siteOpsProfile.lastPublishedLandingUrl
      }
    });
  }

  if (
    cmoDecision.dominantConstraint === "content" ||
    (cmoDecision.delegatedModules.includes("studio") && context.workspace.creativeAssets.length === 0)
  ) {
    const opportunity = buildCmoOpportunity({
      context,
      id: `cmo-opportunity-creative-refresh-${context.companySlug}`,
      area: "content",
      title: "Atualizar biblioteca criativa da tese da semana",
      summary: "O ciclo precisa de novas variantes criativas para deixar o loop de aprendizado mais forte.",
      hypothesis: "Criativos defasados limitam a capacidade do Agent Lion de descobrir vencedores reais.",
      targetMetric: "creative_response_rate",
      evidence: [
        `Ativos criativos atuais: ${context.workspace.creativeAssets.length}.`,
        `Tese da semana: ${cmoDecision.weeklyThesis}`
      ],
      impactScore: 74,
      urgencyScore: 62,
      effortScore: 30,
      confidence: cmoDecision.confidence
    });
    opportunities.push(opportunity);
    actions.push({
      id: `cmo-action-creative-refresh-${context.companySlug}`,
      companySlug: context.companySlug,
      opportunityId: opportunity.id,
      findingId: opportunity.findingId,
      type: "refresh_creatives",
      title: "Abrir refresh criativo guiado pelo CMO Agent",
      description: "Gerar drafts criativos alinhados a tese atual sem publicar automaticamente.",
      rationale: "A tese da semana pede criativos novos para testar angulos e CTA com mais precisao.",
      evidence: opportunity.evidence,
      targetMetric: opportunity.targetMetric,
      impactScore: opportunity.impactScore,
      urgencyScore: opportunity.urgencyScore,
      confidenceScore: clampScore(opportunity.confidence * 100),
      effortScore: opportunity.effortScore,
      compositeScore: clampScore(76),
      priority: "medium",
      riskScore: estimateCoreRiskScoreForAction({
        type: "refresh_creatives",
        evidence: opportunity.evidence,
        targetPlatform: undefined
      }),
      autonomyMode: "requires_approval",
      params: {
        draftOnly: true,
        promptFocus: cmoDecision.primaryBet,
        sourceExperimentIds: cmoDecision.recommendedExperiments.map((experiment) => experiment.id)
      }
    });
  }

  return {
    opportunities,
    actions
  };
}

function buildOpportunity(context: CompanyContext, finding: DiagnosticFinding): GrowthOpportunity {
  const severityBase = getSeverityBaseScore(finding.severity);
  const impactScore = clampScore(severityBase + getAreaImpactModifier(finding.area));
  const urgencyScore = clampScore(severityBase + 5);
  const effortScore = clampScore(getEffortScoreForFinding(finding));

  return {
    id: `opportunity-${finding.id}`,
    companySlug: context.companySlug,
    findingId: finding.id,
    area: finding.area,
    title: buildOpportunityTitle(finding),
    summary: finding.summary,
    hypothesis: buildOpportunityHypothesis(finding),
    impactScore,
    urgencyScore,
    effortScore,
    confidence: finding.confidence,
    targetMetric: inferTargetMetric(finding),
    evidence: finding.evidence
  };
}

function buildAction(
  context: CompanyContext,
  opportunity: GrowthOpportunity,
  finding: DiagnosticFinding,
  cmoDecision?: CompanyCmoStrategicDecision
): PrioritizedAction {
  const type = inferActionType(finding);
  const confidenceScore = clampScore(finding.confidence * 100);
  const targetPlatform = inferTargetPlatform(context, finding);
  const sharedPattern = findSharedPattern(context, targetPlatform);
  const cmoBoost = getCmoAlignmentBoost(finding, targetPlatform, cmoDecision);
  const sharedPatternBoost = sharedPattern ? 5 : 0;
  const compositeScore = clampScore(
    opportunity.impactScore * 0.4 +
      opportunity.urgencyScore * 0.3 +
      confidenceScore * 0.2 +
      (100 - opportunity.effortScore) * 0.1 +
      cmoBoost +
      sharedPatternBoost
  );

  return {
    id: `action-${finding.id}`,
    companySlug: context.companySlug,
    opportunityId: opportunity.id,
    findingId: finding.id,
    type,
    title: buildActionTitle(finding),
    description: finding.suggestedNextMoves[0] ?? finding.summary,
    rationale: buildActionRationale(finding, cmoDecision, sharedPattern?.summary),
    evidence: sharedPattern
      ? [...finding.evidence, `Playbook cross-tenant seguro: ${sharedPattern.title}`]
      : finding.evidence,
    targetMetric: opportunity.targetMetric,
    targetPlatform,
    impactScore: opportunity.impactScore,
    urgencyScore: opportunity.urgencyScore,
    confidenceScore,
    effortScore: opportunity.effortScore,
    compositeScore,
    priority: toPriorityFromScore(compositeScore),
    riskScore: estimateCoreRiskScoreForAction({
      type,
      evidence: finding.evidence,
      targetPlatform
    }),
    autonomyMode: inferInitialAutonomyMode(type),
    params: {
      nextMoves: finding.suggestedNextMoves,
      area: finding.area
    }
  };
}

function getSeverityBaseScore(severity: DiagnosticFinding["severity"]) {
  switch (severity) {
    case "critical":
      return 90;
    case "high":
      return 75;
    case "medium":
      return 55;
    default:
      return 35;
  }
}

function getAreaImpactModifier(area: OpportunityArea) {
  switch (area) {
    case "acquisition":
    case "conversion":
    case "tracking":
      return 8;
    case "operations":
      return 5;
    case "governance":
      return 2;
    default:
      return 0;
  }
}

function getEffortScoreForFinding(finding: DiagnosticFinding) {
  if (finding.area === "operations" && finding.summary.includes("aprov")) {
    return 35;
  }

  if (finding.area === "tracking") {
    return 62;
  }

  if (finding.area === "governance") {
    return 28;
  }

  if (finding.area === "acquisition") {
    return 52;
  }

  return 45;
}

function buildOpportunityTitle(finding: DiagnosticFinding) {
  switch (finding.area) {
    case "operations":
      return "Destravar operacao com menor atraso";
    case "tracking":
      return "Recuperar confiabilidade de mensuracao";
    case "acquisition":
      return "Reconectar canais que sustentam crescimento";
    case "governance":
      return "Elevar explicabilidade e governanca do ciclo";
    default:
      return "Capturar oportunidade operacional";
  }
}

function buildOpportunityHypothesis(finding: DiagnosticFinding) {
  return `Se resolvermos "${finding.summary.toLowerCase()}", o Agent Lion reduz atrito operacional e melhora a taxa de execucao do ciclo autonomo.`;
}

function buildActionTitle(finding: DiagnosticFinding) {
  switch (inferActionType(finding)) {
    case "review_approvals":
      return "Resolver aprovacoes travadas";
    case "stabilize_runtime":
      return "Estabilizar runtime social";
    case "stabilize_tracking":
      return "Corrigir dispatch e tracking";
    case "prepare_growth_report":
      return "Gerar baseline executivo";
    case "audit_connectors":
      return "Auditar readiness dos conectores";
    default:
      return "Acao priorizada do ciclo";
  }
}

function inferTargetMetric(finding: DiagnosticFinding) {
  switch (finding.area) {
    case "tracking":
      return "conversion_dispatch_health";
    case "acquisition":
      return "connector_readiness";
    case "operations":
      return finding.summary.includes("runtime") ? "runtime_stability" : "approval_backlog";
    case "governance":
      return "reporting_coverage";
    default:
      return "cycle_health";
  }
}

function inferActionType(finding: DiagnosticFinding): PrioritizedAction["type"] {
  const normalizedSummary = finding.summary.toLowerCase();

  if (normalizedSummary.includes("aprov")) {
    return "review_approvals";
  }

  if (normalizedSummary.includes("runtime")) {
    return "stabilize_runtime";
  }

  if (finding.area === "tracking") {
    return "stabilize_tracking";
  }

  if (normalizedSummary.includes("relatorio")) {
    return "prepare_growth_report";
  }

  if (normalizedSummary.includes("conector") || normalizedSummary.includes("canal")) {
    return "audit_connectors";
  }

  return "audit_connectors";
}

function inferTargetPlatform(
  context: CompanyContext,
  finding: DiagnosticFinding
): PrioritizedAction["targetPlatform"] {
  if (finding.area === "acquisition") {
    return context.workspace.strategyPlan.priorityChannels.find((platform) => {
      const connection = context.workspace.connections.find((entry) => entry.platform === platform);
      return !connection || connection.status !== "connected";
    });
  }

  if (finding.area === "tracking") {
    const latestBlocked = context.workspace.conversionEvents.find(
      (event) => event.status === "blocked" || event.status === "failed"
    );

    if (latestBlocked?.destination === "google_ads") {
      return "google-ads";
    }

    if (latestBlocked?.destination === "ga4") {
      return "ga4";
    }

    return "meta";
  }

  if (finding.summary.toLowerCase().includes("runtime")) {
    const latestBlockedTask = context.workspace.socialRuntimeTasks.find(
      (task) => task.status === "blocked" || task.status === "failed"
    );

    return latestBlockedTask?.platform === "facebook" || latestBlockedTask?.platform === "instagram"
      ? "meta"
      : undefined;
  }

  return undefined;
}

function inferInitialAutonomyMode(type: PrioritizedAction["type"]): PrioritizedAction["autonomyMode"] {
  if (type === "queue_social_sync" || type === "prepare_growth_report" || type === "audit_connectors") {
    return "auto_execute";
  }

  if (type === "propose_budget_shift" || type === "pause_underperforming_channel") {
    return "policy_review";
  }

  return "requires_approval";
}

function getCmoAlignmentBoost(
  finding: Pick<DiagnosticFinding, "area">,
  targetPlatform: PrioritizedAction["targetPlatform"],
  cmoDecision?: CompanyCmoStrategicDecision
) {
  if (!cmoDecision) {
    return 0;
  }

  let boost = doesCoreAreaMatchConstraint(finding.area, cmoDecision) ? 8 : 0;

  if (targetPlatform && cmoDecision.winningChannels.some((channel) => channel.platform === targetPlatform)) {
    boost += 6;
  }

  if (targetPlatform && cmoDecision.losingChannels.some((channel) => channel.platform === targetPlatform)) {
    boost += 4;
  }

  return boost;
}

function buildActionRationale(
  finding: DiagnosticFinding,
  cmoDecision?: CompanyCmoStrategicDecision,
  sharedPatternSummary?: string
) {
  const sharedPatternClause = sharedPatternSummary
    ? ` Playbook compartilhado seguro: ${sharedPatternSummary}`
    : "";

  if (!cmoDecision) {
    return `${finding.summary} Causa suspeita: ${finding.suspectedRootCause}${sharedPatternClause}`;
  }

  return `${finding.summary} Causa suspeita: ${finding.suspectedRootCause} Tese do CMO Agent: ${cmoDecision.weeklyThesis}${sharedPatternClause}`;
}

function buildCmoOpportunity(input: {
  context: CompanyContext;
  id: string;
  area: GrowthOpportunity["area"];
  title: string;
  summary: string;
  hypothesis: string;
  targetMetric: string;
  evidence: string[];
  impactScore: number;
  urgencyScore: number;
  effortScore: number;
  confidence: number;
}): GrowthOpportunity {
  return {
    id: input.id,
    companySlug: input.context.companySlug,
    findingId: `${input.id}-finding`,
    area: input.area,
    title: input.title,
    summary: input.summary,
    hypothesis: input.hypothesis,
    impactScore: input.impactScore,
    urgencyScore: input.urgencyScore,
    effortScore: input.effortScore,
    confidence: input.confidence,
    targetMetric: input.targetMetric,
    evidence: input.evidence
  };
}

function inferOpportunityAreaFromExperiment(
  channel: string,
  cmoDecision: CompanyCmoStrategicDecision
): GrowthOpportunity["area"] {
  if (channel === "google-ads" || channel === "meta" || channel === "linkedin") {
    return "acquisition";
  }

  if (channel === "youtube" || channel === "tiktok") {
    return "content";
  }

  return cmoDecision.dominantConstraint;
}

function inferExperimentPlatform(channel: string): PrioritizedAction["targetPlatform"] {
  switch (channel) {
    case "google-ads":
      return "google-ads";
    case "meta":
      return "meta";
    default:
      return undefined;
  }
}

function getExperimentActionBoost(
  experiment: CompanyCmoStrategicDecision["recommendedExperiments"][number],
  cmoDecision: CompanyCmoStrategicDecision
) {
  const targetPlatform = inferExperimentPlatform(experiment.channel);
  let boost = 6;

  if (targetPlatform && cmoDecision.winningChannels.some((channel) => channel.platform === targetPlatform)) {
    boost += 8;
  }

  if (cmoDecision.delegatedModules.includes("site-ops") && experiment.channel === "google-ads") {
    boost += 4;
  }

  return boost;
}

function findSharedPattern(
  context: CompanyContext,
  targetPlatform: PrioritizedAction["targetPlatform"]
) {
  const reusablePatterns = (context.memory.sharedPatterns ?? []).filter(isLearningPatternReusable);
  if (reusablePatterns.length === 0) {
    return undefined;
  }

  if (targetPlatform) {
    const exact = reusablePatterns.find((pattern) => pattern.channel === targetPlatform);
    if (exact) {
      return exact;
    }
  }

  return reusablePatterns[0];
}
