import type { CompanyCmoStrategicDecision } from "@/lib/domain";
import type {
  CompanyContext,
  DiagnosticFinding,
  GrowthOpportunity,
  PrioritizedAction
} from "@/lib/agents/types";
import type {
  CandidateAction,
  ContextSnapshot,
  DecisionCoreTrace,
  DecisionReason,
  Diagnosis,
  Hypothesis,
  Signal
} from "@/core/domain/agent-core";

type CoreDecisionEngineInput = {
  context: CompanyContext;
  findings: DiagnosticFinding[];
  opportunities: GrowthOpportunity[];
  actions: PrioritizedAction[];
  cmoDecision?: CompanyCmoStrategicDecision;
};

export function runCoreDecisionEngine(input: CoreDecisionEngineInput): DecisionCoreTrace {
  const snapshot = buildContextSnapshot(input.context);
  const signals = buildSignals(input.context, input.findings, input.cmoDecision);
  const diagnoses = buildDiagnoses(input.context, input.findings, signals);
  const hypotheses = buildHypotheses(input.context, diagnoses, input.cmoDecision);
  const candidateActions = buildCandidateActions(input.context, input.opportunities, input.actions, diagnoses, hypotheses);
  const selectedAction = candidateActions[0];
  const reasons = buildDecisionReasons(input.context, selectedAction, input.cmoDecision);

  return {
    snapshot,
    signals,
    diagnoses,
    hypotheses,
    candidateActions,
    selectedActionId: selectedAction?.id,
    reasons
  };
}

function buildContextSnapshot(context: CompanyContext): ContextSnapshot {
  return {
    id: `snapshot-${context.companySlug}-${Date.now()}`,
    tenantId: context.companySlug,
    companyName: context.companyName,
    generatedAt: context.generatedAt,
    triggerType: context.trigger.type,
    strategySummary: context.strategySummary,
    goals: context.goals.map((goal) => `${goal.title}: ${goal.target}`),
    connectorSummary: context.kpis.connectorCoverage,
    kpis: context.kpis.summaries
  };
}

function buildSignals(
  context: CompanyContext,
  findings: DiagnosticFinding[],
  cmoDecision?: CompanyCmoStrategicDecision
): Signal[] {
  const now = context.generatedAt;
  const findingSignals = findings.map((finding) => ({
    id: `signal-finding-${finding.id}`,
    tenantId: context.companySlug,
    source: "finding" as const,
    category: finding.area,
    severity: mapFindingSeverity(finding.severity),
    summary: finding.summary,
    evidence: finding.evidence,
    observedAt: now,
    metric: inferSignalMetric(finding.area)
  }));

  const runtimeSignals: Signal[] =
    context.kpis.runtimeBlocked + context.kpis.runtimeFailed > 0
      ? [
          {
            id: `signal-runtime-${context.companySlug}`,
            tenantId: context.companySlug,
            source: "runtime",
            category: "operations",
            severity: context.kpis.runtimeFailed > 0 ? "critical" : "warning",
            summary: "Runtime operacional com pressao real",
            evidence: [
              `${context.kpis.runtimeBlocked} bloqueios recentes.`,
              `${context.kpis.runtimeFailed} falhas recentes.`,
              `${context.kpis.runtimeQueued} itens ainda enfileirados.`
            ],
            observedAt: now,
            metric: "cycle_velocity"
          }
        ]
      : [];

  const connectorSignals: Signal[] =
    context.kpis.connectorCoverage.blocked > 0
      ? [
          {
            id: `signal-connectors-${context.companySlug}`,
            tenantId: context.companySlug,
            source: "connector",
            category: "governance",
            severity: context.kpis.connectorCoverage.ready === 0 ? "critical" : "warning",
            summary: "Cobertura de conectores ainda desigual",
            evidence: [
              `${context.kpis.connectorCoverage.ready} ready.`,
              `${context.kpis.connectorCoverage.partial} partial.`,
              `${context.kpis.connectorCoverage.blocked} blocked.`
            ],
            observedAt: now,
            metric: "connector_coverage"
          }
        ]
      : [];

  const strategySignals: Signal[] = cmoDecision
    ? [
        {
          id: `signal-cmo-${cmoDecision.id}`,
          tenantId: context.companySlug,
          source: "strategy",
          category: cmoDecision.dominantConstraint,
          severity: "warning",
          summary: cmoDecision.weeklyThesis,
          evidence: [
            `Primary bet: ${cmoDecision.primaryBet}`,
            `Focus metric: ${cmoDecision.focusMetric}`
          ],
          observedAt: cmoDecision.createdAt,
          metric: cmoDecision.focusMetric
        }
      ]
    : [];

  return [...findingSignals, ...runtimeSignals, ...connectorSignals, ...strategySignals];
}

function buildDiagnoses(
  context: CompanyContext,
  findings: DiagnosticFinding[],
  signals: Signal[]
): Diagnosis[] {
  return findings.map((finding) => ({
    id: `diagnosis-${finding.id}`,
    tenantId: context.companySlug,
    area: finding.area,
    title: finding.summary,
    summary: `${finding.summary} Raiz suspeita: ${finding.suspectedRootCause}`,
    severity: finding.severity,
    confidence: finding.confidence,
    rootCause: finding.suspectedRootCause,
    evidence: finding.evidence,
    linkedSignalIds: signals
      .filter((signal) => signal.category === finding.area || signal.summary === finding.summary)
      .map((signal) => signal.id)
  }));
}

function buildHypotheses(
  context: CompanyContext,
  diagnoses: Diagnosis[],
  cmoDecision?: CompanyCmoStrategicDecision
): Hypothesis[] {
  return diagnoses.map((diagnosis) => ({
    id: `hypothesis-${diagnosis.id}`,
    tenantId: context.companySlug,
    diagnosisId: diagnosis.id,
    statement:
      cmoDecision && diagnosis.area === cmoDecision.dominantConstraint
        ? `Se atacarmos ${diagnosis.area}, a tese dominante da semana ganha mais velocidade de aprendizado e execucao.`
        : `Se reduzirmos o gargalo em ${diagnosis.area}, o proximo ciclo tende a operar com menos atrito e melhor sinal.`,
    expectedImpact: inferExpectedImpact(diagnosis.area),
    confidence: diagnosis.confidence,
    supportingEvidence: diagnosis.evidence
  }));
}

function buildCandidateActions(
  context: CompanyContext,
  opportunities: GrowthOpportunity[],
  actions: PrioritizedAction[],
  diagnoses: Diagnosis[],
  hypotheses: Hypothesis[]
): CandidateAction[] {
  const diagnosisByFindingId = new Map(
    diagnoses.map((diagnosis) => [diagnosis.id.replace("diagnosis-finding-", "finding-"), diagnosis])
  );
  const hypothesisByDiagnosisId = new Map(hypotheses.map((hypothesis) => [hypothesis.diagnosisId, hypothesis]));
  const opportunityById = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity]));

  return actions.map((action) => {
    const opportunity = opportunityById.get(action.opportunityId);
    const diagnosis = diagnosisByFindingId.get(action.findingId);
    const hypothesis = diagnosis ? hypothesisByDiagnosisId.get(diagnosis.id) : undefined;

    return {
      id: action.id,
      tenantId: context.companySlug,
      actionType: action.type,
      title: action.title,
      summary: action.rationale,
      targetMetric: action.targetMetric,
      targetPlatform: action.targetPlatform,
      priority: action.priority,
      impactScore: opportunity?.impactScore ?? action.impactScore,
      urgencyScore: action.urgencyScore,
      effortScore: action.effortScore,
      confidenceScore: action.confidenceScore,
      compositeScore: action.compositeScore,
      evidence: action.evidence,
      linkedDiagnosisIds: diagnosis ? [diagnosis.id] : [],
      linkedHypothesisIds: hypothesis ? [hypothesis.id] : []
    };
  });
}

function buildDecisionReasons(
  context: CompanyContext,
  selectedAction: CandidateAction | undefined,
  cmoDecision?: CompanyCmoStrategicDecision
): DecisionReason[] {
  if (!selectedAction) {
    return [
      {
        code: "NO_ACTION_SELECTED",
        summary: "Nenhuma acao candidata foi forte o suficiente para liderar o proximo ciclo.",
        evidence: context.strategySummary
      }
    ];
  }

  const reasons: DecisionReason[] = [
    {
      code: "TOP_COMPOSITE_SCORE",
      summary: `${selectedAction.title} liderou a fila por composite score ${selectedAction.compositeScore}.`,
      evidence: [
        `Impacto ${selectedAction.impactScore}.`,
        `Urgencia ${selectedAction.urgencyScore}.`,
        `Confianca ${selectedAction.confidenceScore}.`
      ]
    }
  ];

  if (cmoDecision) {
    reasons.push({
      code: "CMO_ALIGNMENT",
      summary: `A acao escolhida apoia a tese dominante da semana: ${cmoDecision.weeklyThesis}`,
      evidence: [
        `Constraint dominante: ${cmoDecision.dominantConstraint}.`,
        `Focus metric: ${cmoDecision.focusMetric}.`
      ]
    });
  }

  return reasons;
}

function mapFindingSeverity(severity: DiagnosticFinding["severity"]): Signal["severity"] {
  if (severity === "critical") {
    return "critical";
  }

  if (severity === "high" || severity === "medium") {
    return "warning";
  }

  return "info";
}

function inferSignalMetric(area: DiagnosticFinding["area"]) {
  switch (area) {
    case "tracking":
      return "conversion_dispatch_health";
    case "conversion":
      return "lead_to_revenue_rate";
    case "content":
      return "creative_response_rate";
    case "operations":
      return "cycle_velocity";
    default:
      return "qualified_acquisition_efficiency";
  }
}

function inferExpectedImpact(area: Diagnosis["area"]) {
  switch (area) {
    case "tracking":
      return "Melhorar a qualidade do sinal antes da proxima rodada de otimizacao.";
    case "conversion":
      return "Aumentar taxa de ganho e receita sem depender apenas de mais spend.";
    case "content":
      return "Gerar ativos mais fortes para aumentar resposta criativa.";
    case "operations":
      return "Recuperar velocidade operacional e confiabilidade de execucao.";
    default:
      return "Reforcar foco e eficiencia no crescimento.";
  }
}

