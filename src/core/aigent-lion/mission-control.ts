import { buildAigentLionIntelligenceContext } from "@/core/aigent-lion/intelligence-context";
import { runSelfImprovementEngine } from "@/core/aigent-lion/self-improvement-engine";
import { runAigentLionSupremeBrainForWorkspace } from "@/core/aigent-lion/supreme-brain";
import type {
  AigentLionInput,
  MissionControlSnapshot
} from "@/core/aigent-lion/types";

export async function buildMissionControlSnapshot(
  input: AigentLionInput
): Promise<MissionControlSnapshot | null> {
  const context = await buildAigentLionIntelligenceContext({
    ...input,
    intent: "mission_control"
  });

  if (!context) {
    return null;
  }

  const supremeBrain = await runAigentLionSupremeBrainForWorkspace({
    ...input,
    intent: "mission_control",
    workspace: context.workspace
  });
  const selfImprovement = runSelfImprovementEngine(context);

  return {
    companySlug: context.workspace.company.slug,
    generatedAt: new Date().toISOString(),
    supremeBrain,
    controlTower: context.controlTower,
    cmoDecision: context.cmoDecision,
    findings: context.diagnosticFindings,
    actions: supremeBrain.nextBestActions,
    campaignOS: context.campaignOS,
    learning: {
      recentLearnings: context.strategicMemory.recentLearnings,
      playbooks: context.workspace.learningPlaybooks.slice(0, 8),
      outcomes: context.workspace.experimentOutcomes.slice(0, 8)
    },
    approvals: {
      pendingSocial:
        context.workspace.scheduledPosts.filter((post) => post.status === "pending_approval").length +
        context.workspace.socialAdDrafts.filter((draft) => draft.status === "pending_approval").length,
      pendingPayments: context.workspace.paymentRequests.filter((request) => request.status === "pending").length,
      totalPending: context.workspace.approvalsCenter.length
    },
    selfImprovement
  };
}
