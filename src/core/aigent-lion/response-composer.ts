import type {
  AigentLionApprovalRequirement,
  AigentLionArtifact,
  AigentLionIntelligenceContext,
  AigentLionMode,
  AigentLionNextBestAction,
  AigentLionSupremeBrainOutput,
  SpecialistAgentResult
} from "@/core/aigent-lion/types";

export function composeAigentLionResponse(input: {
  mode: AigentLionMode;
  context: AigentLionIntelligenceContext;
  agentResults: SpecialistAgentResult[];
}): AigentLionSupremeBrainOutput {
  const artifacts = dedupeArtifacts(input.agentResults.flatMap((agent) => agent.artifacts));
  const nextBestActions = buildNextBestActions(input.context);
  const approvalsRequired = buildApprovalsRequired(input.context);
  const risks = dedupeStrings([
    ...input.context.campaignOS.risks,
    ...input.context.strategicMemory.riskWarnings,
    ...input.agentResults.flatMap((agent) => agent.risks)
  ]).slice(0, 10);
  const confidence = computeConfidence(input.context, input.agentResults);
  const executiveSummary = buildExecutiveSummary(input.context, confidence);
  const answer = buildAnswer({
    context: input.context,
    agentResults: input.agentResults,
    artifacts,
    approvalsRequired,
    nextBestActions,
    risks
  });

  return {
    success: true,
    mode: input.mode,
    answer,
    executiveSummary,
    diagnosis: {
      dominantConstraint: input.context.cmoDecision.dominantConstraint,
      findings: input.context.diagnosticFindings,
      confidence: input.context.cmoDecision.confidence
    },
    strategy: {
      weeklyThesis: input.context.cmoDecision.weeklyThesis,
      primaryBet: input.context.cmoDecision.primaryBet,
      focusMetric: input.context.cmoDecision.focusMetric,
      expectedImpact: inferExpectedImpact(input.context),
      opportunities: input.context.decisionResult.opportunities
    },
    recommendedActions: nextBestActions,
    agentsUsed: input.agentResults.map((agent) => agent.title),
    artifacts,
    approvalsRequired,
    risks,
    memoryUpdates: buildMemoryUpdates(input.context),
    nextBestActions,
    confidence,
    provenance: {
      companySlug: input.context.workspace.company.slug,
      triggerId: input.context.trigger.id,
      generatedAt: new Date().toISOString(),
      cmoDecisionId: input.context.cmoDecision.id,
      sourceRunIds: input.context.workspace.automationRuns.slice(0, 5).map((run) => run.id),
      sourceLearningIds: input.context.workspace.agentLearnings.slice(0, 8).map((learning) => learning.id),
      sourcePlaybookIds: input.context.workspace.learningPlaybooks.slice(0, 8).map((playbook) => playbook.id),
      sourceOutcomeIds: input.context.workspace.experimentOutcomes.slice(0, 8).map((outcome) => outcome.id),
      policyDecisionCount: input.context.policyDecisions.length
    }
  };
}

function buildAnswer(input: {
  context: AigentLionIntelligenceContext;
  agentResults: SpecialistAgentResult[];
  artifacts: AigentLionArtifact[];
  approvalsRequired: AigentLionApprovalRequirement[];
  nextBestActions: AigentLionNextBestAction[];
  risks: string[];
}) {
  const topFinding = input.context.diagnosticFindings[0];
  const topAction = input.nextBestActions[0];
  const topAssets = input.artifacts.slice(0, 4).map((artifact) => `- ${artifact.title}: ${artifact.summary}`).join("\n");
  const agents = input.agentResults.map((agent) => agent.title).join(", ");

  return [
    "1. Diagnostico",
    topFinding
      ? `${topFinding.summary} Evidencias: ${topFinding.evidence.slice(0, 2).join(" | ")}`
      : "O workspace nao mostra um gargalo critico isolado, entao o foco deve ser aumentar cadencia com seguranca.",
    "",
    "2. Tese estrategica",
    `${input.context.cmoDecision.weeklyThesis} A aposta principal e ${input.context.cmoDecision.primaryBet}, medida por ${input.context.cmoDecision.focusMetric}.`,
    "",
    "3. Plano de acao",
    topAction
      ? `${topAction.title}: ${topAction.summary}`
      : "Rodar novo ciclo do agente, materializar Campaign OS e revisar aprovacoes pendentes.",
    "",
    "4. Agentes acionados",
    agents,
    "",
    "5. Ativos gerados",
    topAssets || "Campaign OS preparou estrategia, funil, criativos e plano de analytics.",
    "",
    "6. Riscos e aprovacoes",
    input.approvalsRequired.length > 0
      ? input.approvalsRequired.slice(0, 4).map((approval) => `- ${approval.title}: ${approval.risk}`).join("\n")
      : "Sem aprovacao critica detectada para leitura/planejamento. Execucao externa continua protegida por policy.",
    "",
    "7. Metricas de sucesso",
    `${input.context.campaignOS.analyticsPlan.targetMetric}; readiness ${input.context.campaignOS.launchReadiness.score}/100; trust ${input.context.controlTower.health.trustScore}/100.`,
    "",
    "8. Proximos passos",
    input.nextBestActions.slice(0, 4).map((action) => `- ${action.title}`).join("\n"),
    "",
    "9. Aprendizado que sera salvo",
    input.context.strategicMemory.recentLearnings[0] ??
      "O proximo ciclo deve salvar outcome de execucao e atualizar playbooks por canal."
  ].join("\n");
}

function buildExecutiveSummary(context: AigentLionIntelligenceContext, confidence: number) {
  return `${context.workspace.company.name}: gargalo dominante em ${context.cmoDecision.dominantConstraint}, tese "${context.cmoDecision.primaryBet}", readiness de campanha ${context.campaignOS.launchReadiness.score}/100 e confianca ${Math.round(confidence * 100)}%.`;
}

function inferExpectedImpact(context: AigentLionIntelligenceContext) {
  const bestScorecard = [...context.cmoDecision.scorecards].sort((left, right) => right.score - left.score)[0];

  if (bestScorecard) {
    return `Mover score de crescimento em ${bestScorecard.channel}, decisao atual ${bestScorecard.decision}.`;
  }

  return `Aumentar ${context.cmoDecision.focusMetric} removendo o gargalo de ${context.cmoDecision.dominantConstraint}.`;
}

function buildNextBestActions(context: AigentLionIntelligenceContext): AigentLionNextBestAction[] {
  return context.decisionResult.actions.slice(0, 8).map((action) => {
    const policy = context.policyDecisions.find((entry) => entry.action.id === action.id)?.policy;

    return {
      id: action.id,
      title: action.title,
      summary: action.description,
      impact: action.impactScore,
      urgency: action.urgencyScore,
      effort: action.effortScore,
      risk: action.riskScore.level,
      policyStatus: policy?.status,
      requiresApproval: policy ? policy.status !== "AUTO_EXECUTE" : action.autonomyMode !== "auto_execute",
      href: inferActionHref(context.workspace.company.slug, action.type)
    };
  });
}

function buildApprovalsRequired(context: AigentLionIntelligenceContext): AigentLionApprovalRequirement[] {
  const policyApprovals = context.policyDecisions
    .filter((entry) => entry.policy.status !== "AUTO_EXECUTE")
    .map((entry) => ({
      id: `approval-${entry.action.id}`,
      title: entry.action.title,
      summary: entry.policy.rationale,
      risk: entry.action.riskScore.level,
      policyStatus: entry.policy.status,
      requiredApprovers: entry.policy.requiredApprovers,
      sourceActionId: entry.action.id
    }));
  const campaignApprovals = context.campaignOS.approvalPlan.items.slice(0, 6).map((item, index) => ({
    id: `campaign-approval-${index + 1}`,
    title: item.title,
    summary: item.reason,
    risk: item.type === "policy" ? "high" : "medium",
    policyStatus: item.type === "policy" ? ("REQUIRE_POLICY_REVIEW" as const) : ("REQUIRE_APPROVAL" as const),
    requiredApprovers: []
  }));

  return [...policyApprovals, ...campaignApprovals].slice(0, 12);
}

function buildMemoryUpdates(context: AigentLionIntelligenceContext) {
  return [
    ...context.workspace.agentLearnings.slice(0, 3).map((learning) => ({
      title: learning.title,
      summary: learning.summary,
      source: "learning" as const
    })),
    ...context.workspace.learningPlaybooks.slice(0, 3).map((playbook) => ({
      title: playbook.title,
      summary: playbook.summary,
      source: "playbook" as const
    })),
    ...context.workspace.experimentOutcomes.slice(0, 3).map((outcome) => ({
      title: outcome.title,
      summary: outcome.hypothesis,
      source: "experiment" as const
    }))
  ].slice(0, 8);
}

function inferActionHref(companySlug: string, type: string) {
  if (type.includes("approval")) {
    return `/empresas/${companySlug}/aprovacoes`;
  }

  if (type.includes("creative")) {
    return `/empresas/${companySlug}/studio`;
  }

  if (type.includes("lead") || type.includes("tracking")) {
    return `/empresas/${companySlug}/conversao`;
  }

  if (type.includes("report")) {
    return `/empresas/${companySlug}/relatorios`;
  }

  return `/empresas/${companySlug}/operacao`;
}

function computeConfidence(
  context: AigentLionIntelligenceContext,
  agentResults: SpecialistAgentResult[]
) {
  const agentConfidence = agentResults.length
    ? agentResults.reduce((total, agent) => total + agent.confidence, 0) / agentResults.length
    : 0.72;
  const readiness = context.campaignOS.launchReadiness.score / 100;
  const memory = context.strategicMemory.confidence;
  const policyPenalty = context.policyDecisions.some((entry) => entry.policy.status === "BLOCK") ? 0.08 : 0;

  return Number(Math.max(0.3, Math.min(0.97, agentConfidence * 0.4 + readiness * 0.3 + memory * 0.3 - policyPenalty)).toFixed(2));
}

function dedupeArtifacts(artifacts: AigentLionArtifact[]) {
  const byId = new Map<string, AigentLionArtifact>();

  for (const artifact of artifacts) {
    byId.set(artifact.id, artifact);
  }

  return Array.from(byId.values()).slice(0, 18);
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
