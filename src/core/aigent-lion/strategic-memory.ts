import type { StrategicMemoryDigest } from "@/core/aigent-lion/types";
import type { CompanyWorkspace } from "@/lib/domain";

export function buildStrategicMemoryDigest(workspace: CompanyWorkspace): StrategicMemoryDigest {
  const recentLearnings = workspace.agentLearnings
    .slice(0, 6)
    .map((learning) => `${learning.title}: ${learning.summary}`);
  const activePlaybooks = workspace.learningPlaybooks
    .filter((playbook) => playbook.status === "active" || playbook.status === "candidate")
    .slice(0, 6)
    .map((playbook) => `${playbook.title} (${playbook.channel}, conf ${Math.round(playbook.confidence * 100)}%)`);
  const experimentOutcomes = workspace.experimentOutcomes
    .slice(0, 6)
    .map((outcome) => `${outcome.title}: ${outcome.status} em ${outcome.channel}`);
  const riskWarnings = [
    ...workspace.agentLearnings
      .filter((learning) => learning.kind === "risk" || learning.kind === "warning")
      .slice(0, 4)
      .map((learning) => learning.summary),
    ...workspace.experimentOutcomes
      .filter((outcome) => outcome.status === "lost" || outcome.status === "inconclusive")
      .slice(0, 3)
      .map((outcome) => outcome.failureNote ?? outcome.hypothesis)
  ].slice(0, 6);

  return {
    recentLearnings,
    activePlaybooks,
    experimentOutcomes,
    riskWarnings,
    confidence: computeMemoryConfidence(workspace)
  };
}

function computeMemoryConfidence(workspace: CompanyWorkspace) {
  const learningSignal = Math.min(0.28, workspace.agentLearnings.length * 0.018);
  const playbookSignal = Math.min(0.32, workspace.learningPlaybooks.length * 0.035);
  const outcomeSignal = Math.min(0.26, workspace.experimentOutcomes.length * 0.03);
  const freshPenalty = workspace.agentLearnings.length === 0 && workspace.experimentOutcomes.length === 0 ? 0.2 : 0;

  return Number(Math.max(0.35, Math.min(0.94, 0.48 + learningSignal + playbookSignal + outcomeSignal - freshPenalty)).toFixed(2));
}
