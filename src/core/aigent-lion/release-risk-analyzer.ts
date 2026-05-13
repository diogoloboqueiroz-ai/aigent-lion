import type {
  AigentReleaseRiskLevel,
  CodexImplementationTask,
  ReleaseRiskAnalysis
} from "@/core/aigent-lion/types";

export function analyzeAigentReleaseRisk(input: {
  companySlug: string;
  tasks: CodexImplementationTask[];
  generatedAt?: string;
}): ReleaseRiskAnalysis {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const score = computeRiskScore(input.tasks);
  const level = classifyReleaseRisk(score, input.tasks);
  const highRiskTasks = input.tasks.filter(
    (task) => task.riskLevel === "high" || task.riskLevel === "critical"
  );
  const reasons = buildReasons(input.tasks, score);
  const blockers = buildBlockers(input.tasks, level);

  return {
    id: `release-risk-${input.companySlug}-${Date.parse(generatedAt) || Date.now()}`,
    companySlug: input.companySlug,
    level,
    score,
    requiresApproval: level === "high" || level === "critical" || highRiskTasks.length > 0,
    requiredApprovers: requiredApproversFor(level, input.tasks),
    reasons,
    blockers,
    mitigations: buildMitigations(input.tasks, level),
    safeToAutoMerge: level === "low" && blockers.length === 0,
    analyzedAt: generatedAt
  };
}

function computeRiskScore(tasks: CodexImplementationTask[]) {
  if (tasks.length === 0) {
    return 8;
  }

  const base = tasks.reduce((total, task) => total + taskRiskWeight(task), 0);
  const blastRadius = Math.min(20, Math.max(0, tasks.length - 3) * 4);
  const productionTouches = tasks.some((task) =>
    task.tags.some((tag) => /production|runtime|policy|persistence|security|secrets/.test(tag))
  )
    ? 10
    : 0;

  return Math.min(100, Math.round(base / tasks.length + blastRadius + productionTouches));
}

function taskRiskWeight(task: CodexImplementationTask) {
  const levelWeight: Record<AigentReleaseRiskLevel, number> = {
    low: 18,
    medium: 42,
    high: 70,
    critical: 92
  };
  const fileWeight = Math.min(12, task.suggestedFilesToChange.length * 2);
  const approvalWeight = task.requiresApproval ? 8 : 0;

  return levelWeight[task.riskLevel] + fileWeight + approvalWeight;
}

function classifyReleaseRisk(
  score: number,
  tasks: CodexImplementationTask[]
): AigentReleaseRiskLevel {
  if (tasks.some((task) => task.riskLevel === "critical") || score >= 86) {
    return "critical";
  }

  if (tasks.some((task) => task.riskLevel === "high") || score >= 66) {
    return "high";
  }

  if (score >= 38) {
    return "medium";
  }

  return "low";
}

function buildReasons(tasks: CodexImplementationTask[], score: number) {
  const reasons = [
    `Composite release score ${score}/100.`,
    `${tasks.length} Codex tasks generated from live agent evidence.`
  ];

  if (tasks.some((task) => task.riskLevel === "high" || task.riskLevel === "critical")) {
    reasons.push("At least one task touches high-risk execution, policy, production or persistence surface.");
  }

  if (tasks.some((task) => task.tags.includes("production"))) {
    reasons.push("Production readiness change detected.");
  }

  if (tasks.some((task) => task.tags.includes("policy"))) {
    reasons.push("Policy or approval behavior may change.");
  }

  return reasons;
}

function buildBlockers(tasks: CodexImplementationTask[], level: AigentReleaseRiskLevel) {
  const blockers: string[] = [];

  if (level === "critical") {
    blockers.push("Critical release risk must be split or reviewed before merge.");
  }

  if (tasks.some((task) => task.tags.includes("secrets"))) {
    blockers.push("Secrets boundary change requires security review.");
  }

  if (tasks.some((task) => task.tags.includes("external_execution"))) {
    blockers.push("External execution behavior requires dry-run evidence and approval.");
  }

  return blockers;
}

function buildMitigations(tasks: CodexImplementationTask[], level: AigentReleaseRiskLevel) {
  const mitigations = [
    "Run npm test, npm run lint, npm run typecheck and npm run build before shipping.",
    "Keep changes tenant-scoped and preserve existing compatibility facades.",
    "Attach decision provenance or audit references to behavior changes."
  ];

  if (level === "high" || level === "critical") {
    mitigations.push("Require approval from engineering and governance before applying the Codex task.");
  }

  if (tasks.some((task) => task.tags.includes("runtime"))) {
    mitigations.push("Validate worker, queue, retry and dead-letter behavior with a smoke run.");
  }

  return mitigations;
}

function requiredApproversFor(
  level: AigentReleaseRiskLevel,
  tasks: CodexImplementationTask[]
) {
  const approvers = new Set<string>();

  if (level === "high" || level === "critical") {
    approvers.add("engineering-lead");
    approvers.add("product-owner");
  }

  if (tasks.some((task) => task.tags.includes("policy") || task.tags.includes("compliance"))) {
    approvers.add("governance-reviewer");
  }

  if (tasks.some((task) => task.tags.includes("secrets") || task.tags.includes("security"))) {
    approvers.add("security-lead");
  }

  return Array.from(approvers);
}
