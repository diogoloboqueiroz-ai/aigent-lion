import { buildAigentLionIntelligenceContext } from "@/core/aigent-lion/intelligence-context";
import { runSelfImprovementEngine } from "@/core/aigent-lion/self-improvement-engine";
import { runAigentLionSupremeBrainForWorkspace } from "@/core/aigent-lion/supreme-brain";
import type {
  AigentEvolutionCenterSnapshot,
  AigentLionInput
} from "@/core/aigent-lion/types";
import { evaluateAgentProductionGates } from "@/core/runtime/production-gates";

export async function buildAigentEvolutionCenterSnapshot(
  input: AigentLionInput
): Promise<AigentEvolutionCenterSnapshot | null> {
  const context = await buildAigentLionIntelligenceContext({
    ...input,
    intent: input.intent ?? "mission_control"
  });

  if (!context) {
    return null;
  }

  const selfImprovement = runSelfImprovementEngine(context);
  const supremeBrain = await runAigentLionSupremeBrainForWorkspace({
    ...input,
    intent: "mission_control",
    workspace: context.workspace
  });
  const productionGates = evaluateAgentProductionGates({
    ...process.env,
    NODE_ENV: "production"
  });

  return {
    companySlug: context.workspace.company.slug,
    generatedAt: selfImprovement.generatedAt,
    supremeBrain,
    selfImprovement,
    releaseRisk: selfImprovement.releaseRisk,
    codexTasks: selfImprovement.codexTasks,
    qualityGates: [
      ...productionGates.map((gate) => ({
        id: gate.id,
        label: gate.id,
        status: gate.status,
        summary: `${gate.summary} ${gate.remediation}`
      })),
      {
        id: "supreme-brain-connected",
        label: "Supreme Brain",
        status: supremeBrain.success ? "pass" as const : "fail" as const,
        summary: supremeBrain.executiveSummary
      },
      {
        id: "codex-task-generator",
        label: "Codex Task Generator",
        status: selfImprovement.codexTasks.length > 0 ? "pass" as const : "fail" as const,
        summary: `${selfImprovement.codexTasks.length} actionable Codex tasks generated from live evidence.`
      },
      {
        id: "release-risk-analyzer",
        label: "Release Risk Analyzer",
        status: selfImprovement.releaseRisk.requiresApproval ? "warn" as const : "pass" as const,
        summary: `Release risk ${selfImprovement.releaseRisk.level}, score ${selfImprovement.releaseRisk.score}/100.`
      }
    ]
  };
}
