import { routeAigentLionAgents, inferIntent } from "@/core/aigent-lion/agent-router";
import {
  buildAigentLionIntelligenceContext,
  buildAigentLionIntelligenceContextFromWorkspace
} from "@/core/aigent-lion/intelligence-context";
import { buildMarketingOperatingSystemStatus } from "@/core/aigent-lion/marketing-operating-system";
import { composeAigentLionResponse } from "@/core/aigent-lion/response-composer";
import { runSelfImprovementEngine } from "@/core/aigent-lion/self-improvement-engine";
import type {
  AigentLionInput,
  AigentLionMode,
  AigentLionSupremeBrainOutput
} from "@/core/aigent-lion/types";
import type { CompanyWorkspace } from "@/lib/domain";

export async function runAigentLionSupremeBrain(
  input: AigentLionInput
): Promise<AigentLionSupremeBrainOutput> {
  const context = await buildAigentLionIntelligenceContext(input);

  if (!context) {
    return buildMissingCompanyResponse(input);
  }

  const agentResults = routeAigentLionAgents({
    request: input,
    context
  });
  const mode = mapIntentToMode(inferIntent(input));
  const response = composeAigentLionResponse({
    mode,
    context,
    agentResults
  });
  const operatingSystem = buildMarketingOperatingSystemStatus(context);
  const selfImprovement = runSelfImprovementEngine(context);

  return {
    ...response,
    artifacts: [
      {
        id: `marketing-os-${context.workspace.company.slug}`,
        type: "strategy",
        title: "Marketing Operating System",
        summary: operatingSystem.brainState,
        payload: operatingSystem,
        confidence: response.confidence,
        source: "supreme-brain"
      },
      buildSelfImprovementArtifact(selfImprovement),
      ...response.artifacts
    ]
  };
}

export async function runAigentLionSupremeBrainForWorkspace(
  input: AigentLionInput & { workspace: CompanyWorkspace }
): Promise<AigentLionSupremeBrainOutput> {
  const context = await buildAigentLionIntelligenceContextFromWorkspace(input);
  const agentResults = routeAigentLionAgents({
    request: input,
    context
  });
  const mode = mapIntentToMode(inferIntent(input));
  const response = composeAigentLionResponse({
    mode,
    context,
    agentResults
  });
  const operatingSystem = buildMarketingOperatingSystemStatus(context);
  const selfImprovement = runSelfImprovementEngine(context);

  return {
    ...response,
    artifacts: [
      {
        id: `marketing-os-${context.workspace.company.slug}`,
        type: "strategy",
        title: "Marketing Operating System",
        summary: operatingSystem.brainState,
        payload: operatingSystem,
        confidence: response.confidence,
        source: "supreme-brain"
      },
      buildSelfImprovementArtifact(selfImprovement),
      ...response.artifacts
    ]
  };
}

function buildSelfImprovementArtifact(
  selfImprovement: ReturnType<typeof runSelfImprovementEngine>
): AigentLionSupremeBrainOutput["artifacts"][number] {
  return {
    id: selfImprovement.id,
    type: "self_improvement",
    title: "Self-Improvement Engine",
    summary: selfImprovement.summary,
    payload: {
      systemMaturityScore: selfImprovement.systemMaturityScore,
      nextEvolutionCycle: selfImprovement.nextEvolutionCycle,
      releaseRisk: selfImprovement.releaseRisk,
      codexTasks: selfImprovement.codexTasks.slice(0, 4)
    },
    confidence: 0.86,
    source: "self-improvement-engine"
  };
}

function mapIntentToMode(intent: NonNullable<AigentLionInput["intent"]>): AigentLionMode {
  switch (intent) {
    case "diagnose":
      return "diagnostic";
    case "campaign":
      return "campaign_os";
    case "creative":
      return "creative_engine";
    case "analytics":
      return "analytics_review";
    case "execute":
      return "execution_planning";
    case "learn":
      return "learning_review";
    case "mission_control":
      return "mission_control";
    default:
      return "strategic_planning";
  }
}

function buildMissingCompanyResponse(input: AigentLionInput): AigentLionSupremeBrainOutput {
  const now = new Date().toISOString();

  return {
    success: false,
    mode: "diagnostic",
    answer: "Nao encontrei esta empresa no workspace. Verifique o companyId antes de rodar o Supreme Brain.",
    executiveSummary: "Empresa nao encontrada.",
    diagnosis: {
      dominantConstraint: "operations",
      findings: [],
      confidence: 0
    },
    strategy: {
      weeklyThesis: "Sem workspace, nao ha contexto seguro para decidir.",
      primaryBet: "Corrigir roteamento de tenant.",
      focusMetric: "tenant_resolution",
      expectedImpact: "Restaurar contexto multiempresa antes de qualquer automacao.",
      opportunities: []
    },
    recommendedActions: [],
    agentsUsed: [],
    artifacts: [],
    approvalsRequired: [],
    risks: ["Empresa nao encontrada."],
    memoryUpdates: [],
    nextBestActions: [],
    confidence: 0,
    provenance: {
      companySlug: input.companyId,
      triggerId: "missing-company",
      generatedAt: now,
      sourceRunIds: [],
      sourceLearningIds: [],
      sourcePlaybookIds: [],
      sourceOutcomeIds: [],
      policyDecisionCount: 0
    }
  };
}
