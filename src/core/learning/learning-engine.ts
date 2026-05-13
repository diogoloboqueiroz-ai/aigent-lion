import type {
  AutomationRun,
  CompanyContext,
  ExperimentResult,
  FeedbackResult,
  LearningRecord
} from "@/lib/agents/types";
import type { LearningUpdate } from "@/core/domain/agent-core";

export function runCoreLearningEngine(
  context: CompanyContext,
  run: AutomationRun
): FeedbackResult & { learningUpdates: LearningUpdate[] } {
  const learnings: LearningRecord[] = [];
  const learningUpdates: LearningUpdate[] = [];

  for (const outcome of run.outcomes) {
    const baseUpdate = buildLearningUpdateFromOutcome(context.companySlug, run.id, outcome);
    learningUpdates.push(baseUpdate);
    learnings.push({
      id: baseUpdate.id,
      companySlug: context.companySlug,
      kind: baseUpdate.kind,
      title: baseUpdate.title,
      summary: baseUpdate.summary,
      confidence: mapConfidenceDeltaToAbsolute(baseUpdate.confidenceDelta),
      priority: outcome.status === "completed" ? "medium" : "high",
      evidence: baseUpdate.evidence,
      recommendedAction: baseUpdate.nextRecommendation,
      sourceRunId: run.id,
      createdAt: baseUpdate.createdAt,
      updatedAt: baseUpdate.createdAt
    });
  }

  if (run.cmoDecision) {
    for (const winner of run.cmoDecision.winningChannels) {
      const createdAt = run.finishedAt ?? new Date().toISOString();
      const update: LearningUpdate = {
        id: `learning-cmo-winner-${run.id}-${winner.channel}`,
        tenantId: context.companySlug,
        sourceRunId: run.id,
        kind: "playbook",
        title: `Canal vencedor: ${winner.channel}`,
        summary: winner.reason,
        confidenceDelta: 0.12,
        evidence: [run.cmoDecision.weeklyThesis, winner.reason],
        nextRecommendation: `Tratar ${winner.channel} como principal aposta enquanto o sinal continuar vencedor.`,
        createdAt
      };
      learningUpdates.push(update);
      learnings.push({
        id: update.id,
        companySlug: context.companySlug,
        kind: update.kind,
        title: update.title,
        summary: update.summary,
        confidence: mapConfidenceDeltaToAbsolute(update.confidenceDelta + run.cmoDecision.confidence * 0.1),
        priority: "high",
        evidence: update.evidence,
        recommendedAction: update.nextRecommendation,
        sourceRunId: run.id,
        createdAt,
        updatedAt: createdAt
      });
    }

    for (const loser of run.cmoDecision.losingChannels) {
      const createdAt = run.finishedAt ?? new Date().toISOString();
      const update: LearningUpdate = {
        id: `learning-cmo-loser-${run.id}-${loser.channel}`,
        tenantId: context.companySlug,
        sourceRunId: run.id,
        kind: "risk",
        title: `Canal em risco: ${loser.channel}`,
        summary: loser.reason,
        confidenceDelta: -0.1,
        evidence: [run.cmoDecision.weeklyThesis, loser.reason],
        nextRecommendation: `Corrigir ou segurar ${loser.channel} antes de escalar a operacao.`,
        createdAt
      };
      learningUpdates.push(update);
      learnings.push({
        id: update.id,
        companySlug: context.companySlug,
        kind: update.kind,
        title: update.title,
        summary: update.summary,
        confidence: mapConfidenceDeltaToAbsolute(run.cmoDecision.confidence - 0.08),
        priority: "high",
        evidence: update.evidence,
        recommendedAction: update.nextRecommendation,
        sourceRunId: run.id,
        createdAt,
        updatedAt: createdAt
      });
    }
  }

  const experimentResults: ExperimentResult[] = run.experiments.map((experiment) =>
    buildExperimentResult(context, run, experiment)
  );

  return {
    run,
    learnings,
    experimentResults,
    learningUpdates
  };
}

function buildExperimentResult(
  context: CompanyContext,
  run: AutomationRun,
  experiment: AutomationRun["experiments"][number]
): ExperimentResult {
  const matchingScorecard = run.cmoDecision?.scorecards.find(
    (scorecard) =>
      scorecard.channel === experiment.title.toLowerCase() ||
      scorecard.channel === extractExperimentChannel(experiment.id)
  );
  const createdAt = run.finishedAt ?? new Date().toISOString();

  if (!matchingScorecard) {
    return {
      id: `experiment-result-${experiment.id}`,
      companySlug: context.companySlug,
      experimentId: experiment.id,
      status: "running",
      summary: "Experimento registrado e aguardando observacao real para declarar vencedor.",
      observedMetrics: [
        {
          label: "primaryMetric",
          value: experiment.primaryMetric
        },
        {
          label: "variants",
          value: String(experiment.variants.length)
        }
      ],
      createdAt
    };
  }

  const evaluationStatus =
    matchingScorecard.decision === "scale"
      ? ("won" as const)
      : matchingScorecard.decision === "pause"
        ? ("lost" as const)
        : "running";
  const winningVariant =
    matchingScorecard.decision === "scale"
      ? experiment.variants[0]
      : matchingScorecard.decision === "pause"
        ? experiment.variants.at(-1)
        : undefined;

  return {
    id: `experiment-result-${experiment.id}`,
    companySlug: context.companySlug,
    experimentId: experiment.id,
    status: evaluationStatus,
    summary: buildExperimentResultSummary(matchingScorecard.decision, matchingScorecard.rationale),
    winningVariant,
    observedMetrics: [
      {
        label: "channel",
        value: matchingScorecard.channel
      },
      {
        label: "decision",
        value: matchingScorecard.decision
      },
      {
        label: "score",
        value: String(matchingScorecard.score)
      },
      {
        label: "ctr",
        value: matchingScorecard.ctr ? String(matchingScorecard.ctr) : "n/a"
      },
      {
        label: "cpa",
        value: matchingScorecard.cpa ? String(matchingScorecard.cpa) : "n/a"
      },
      {
        label: "revenue",
        value: matchingScorecard.revenue ? String(matchingScorecard.revenue) : "n/a"
      }
    ],
    createdAt
  };
}

function buildExperimentResultSummary(
  decision: "scale" | "hold" | "fix" | "pause",
  rationale: string
) {
  switch (decision) {
    case "scale":
      return `Experimento mostrou sinal de vencedor. ${rationale}`;
    case "pause":
      return `Experimento mostrou perda clara ou desperdicio. ${rationale}`;
    case "fix":
      return `Experimento trouxe sinal parcial, mas ainda exige ajuste antes de nova rodada. ${rationale}`;
    default:
      return `Experimento segue em observacao. ${rationale}`;
  }
}

function extractExperimentChannel(experimentId: string) {
  const parts = experimentId.split("-");
  return parts.at(-1) ?? experimentId;
}

function buildLearningUpdateFromOutcome(
  companySlug: string,
  sourceRunId: string,
  outcome: AutomationRun["outcomes"][number]
): LearningUpdate {
  const failedOrBlocked = outcome.status === "failed" || outcome.status === "blocked";

  return {
    id: `learning-${outcome.jobId}`,
    tenantId: companySlug,
    sourceRunId,
    kind: outcome.status === "completed" ? "playbook" : failedOrBlocked ? (outcome.status === "failed" ? "warning" : "risk") : "opportunity",
    title: outcome.status === "completed" ? `Rotina preparada: ${outcome.jobId}` : `Job travado: ${outcome.jobId}`,
    summary: outcome.summary,
    confidenceDelta: outcome.status === "completed" ? 0.08 : -0.12,
    evidence: [
      ...outcome.auditReferences,
      ...Object.entries(outcome.outputs).map(([key, value]) => `${key}: ${String(value)}`)
    ],
    nextRecommendation:
      outcome.status === "completed"
        ? "Usar essa saida como insumo da proxima execucao real do canal."
        : "Desbloquear a dependencia antes da proxima rodada autonoma.",
    createdAt: outcome.finishedAt
  };
}

function mapConfidenceDeltaToAbsolute(confidenceDelta: number) {
  return Math.max(0.05, Math.min(0.98, 0.7 + confidenceDelta));
}
