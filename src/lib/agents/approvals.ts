import type { ApprovalRequest, ExecutionJob } from "@/lib/agents/types";

export function buildApprovalRequests(jobs: ExecutionJob[]): ApprovalRequest[] {
  const now = new Date().toISOString();

  return jobs
    .filter(
      (job) =>
        job.autonomyMode === "requires_approval" || job.autonomyMode === "policy_review"
    )
    .map((job) => {
      const approvalMode =
        job.autonomyMode === "policy_review" ? "policy_review" : "requires_approval";

      return {
        id: `agent-approval-${job.id}`,
        companySlug: job.companySlug,
        jobId: job.id,
        title: job.title,
        summary: buildApprovalSummary(job),
        status: "pending" as const,
        approvalMode,
        riskScore: job.riskScore,
        rationale: job.rationale,
        evidence: job.evidence,
        createdAt: now
      };
    });
}

function buildApprovalSummary(job: ExecutionJob) {
  const risk = `Risco ${job.riskScore.level} (${job.riskScore.score}/100).`;
  const evidence = job.evidence.length > 0 ? ` Evidencias: ${job.evidence.join(" | ")}` : "";

  return `${risk} ${job.rationale}${evidence}`.trim();
}
