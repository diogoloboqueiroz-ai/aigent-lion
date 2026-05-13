import type {
  AutomationRun,
  ExecutionJob,
  Experiment,
  LearningRecord,
  PolicyDecision,
  PrioritizedAction
} from "@/lib/agents/types";

export function buildRuntimeJobId(actionId: string) {
  return `agent-job-${actionId}`;
}

export function buildCoreExecutionJobs(
  actions: PrioritizedAction[],
  decisions: PolicyDecision[]
): ExecutionJob[] {
  const decisionByJobId = new Map(decisions.map((decision) => [decision.jobId, decision]));
  const createdAt = new Date().toISOString();

  return actions.map((action) => {
    const jobId = buildRuntimeJobId(action.id);
    const decision = decisionByJobId.get(jobId);

    return {
      id: jobId,
      companySlug: action.companySlug,
      actionId: action.id,
      type: action.type,
      title: action.title,
      status:
        decision?.decision === "blocked"
          ? "blocked"
          : decision?.decision === "auto_execute"
            ? "planned"
            : "approval_pending",
      autonomyMode: decision?.decision ?? action.autonomyMode,
      riskScore: decision?.riskScore ?? action.riskScore,
      rationale: action.rationale,
      evidence: action.evidence,
      targetPlatform: action.targetPlatform,
      inputs: action.params ?? {},
      correlationId: `corr-${jobId}`,
      idempotencyKey: `intent:${action.companySlug}:${jobId}`,
      connectorKey: inferCoreExecutionConnectorKey({
        type: action.type,
        targetPlatform: action.targetPlatform
      }),
      executorKey: inferCoreExecutionExecutorKey({
        type: action.type
      }),
      createdAt,
      auditReferences: []
    };
  });
}

export function inferCoreExecutionConnectorKey(job: Pick<ExecutionJob, "type" | "targetPlatform">) {
  switch (job.type) {
    case "queue_social_sync":
    case "stabilize_runtime":
      return job.targetPlatform ? `social-runtime:${job.targetPlatform}` : "social-runtime";
    case "prepare_growth_report":
      return "google-data";
    case "audit_connectors":
      return "connector-audit";
    case "stabilize_tracking":
      return "conversion-runtime";
    case "follow_up_leads":
      return "crm";
    case "refresh_creatives":
      return "studio";
    case "launch_experiment":
      return "experiment-runtime";
    default:
      return job.targetPlatform ? `agent:${job.targetPlatform}` : `agent:${job.type}`;
  }
}

export function inferCoreExecutionExecutorKey(job: Pick<ExecutionJob, "type">) {
  switch (job.type) {
    case "queue_social_sync":
    case "stabilize_runtime":
      return "social-runtime";
    case "prepare_growth_report":
      return "reporting";
    case "audit_connectors":
      return "connector-audit";
    case "stabilize_tracking":
      return "conversion-runtime";
    case "follow_up_leads":
      return "crm";
    case "refresh_creatives":
      return "studio";
    case "launch_experiment":
      return "experiment-runtime";
    default:
      return "simulated";
  }
}

export function buildRunMetrics(input: {
  startedAt: string;
  finishedAt?: string;
  jobs: AutomationRun["jobs"];
  outcomes: AutomationRun["outcomes"];
  cmoDecision?: AutomationRun["cmoDecision"];
}) {
  const finishedAt = input.finishedAt ?? new Date().toISOString();
  const durationMs = Math.max(
    0,
    new Date(finishedAt).getTime() - new Date(input.startedAt).getTime()
  );
  const realExecutorsUsed = Array.from(
    new Set(
      input.outcomes
        .map((outcome) => outcome.outputs.executor)
        .filter((executor): executor is string => typeof executor === "string" && executor !== "simulated")
    )
  );

  return {
    totalJobs: input.jobs.length,
    completedJobs: input.jobs.filter((job) => job.status === "completed").length,
    blockedJobs: input.jobs.filter((job) => job.status === "blocked").length,
    failedJobs: input.jobs.filter((job) => job.status === "failed").length,
    approvalPendingJobs: input.jobs.filter((job) => job.status === "approval_pending").length,
    autoExecutedJobs: input.jobs.filter((job) => job.autonomyMode === "auto_execute").length,
    timedOutJobs: input.outcomes.filter((outcome) => outcome.executionIntentStatus === "timed_out").length,
    blockedByCircuitBreaker: input.outcomes.filter(
      (outcome) => outcome.outputs.blockedBy === "circuit_breaker"
    ).length,
    durationMs,
    dominantConstraint: input.cmoDecision?.dominantConstraint,
    delegatedModules: input.cmoDecision?.delegatedModules ?? [],
    realExecutorsUsed
  };
}

export function buildRunSummary(input: {
  findingsCount: number;
  approvalsCount: number;
  outcomesCount: number;
  actor: string;
  dominantConstraint: string;
}) {
  return `${input.actor} rodou o ciclo autonomo com foco em ${input.dominantConstraint}, ${input.findingsCount} findings, ${input.outcomesCount} outcomes e ${input.approvalsCount} itens que seguem para approval/policy.`;
}

export function inferLearningRecordsFromRun(run: AutomationRun): LearningRecord[] {
  if (run.learningRecords.length > 0) {
    return run.learningRecords;
  }

  return run.outcomes.map((outcome) => ({
    id: `learning-${outcome.jobId}`,
    companySlug: run.companySlug,
    kind:
      outcome.status === "completed"
        ? ("playbook" as const)
        : outcome.status === "failed"
          ? ("warning" as const)
          : ("risk" as const),
    title: `Aprendizado do run ${run.id}`,
    summary: outcome.summary,
    confidence: outcome.status === "completed" ? 0.74 : 0.86,
    priority: outcome.status === "completed" ? ("medium" as const) : ("high" as const),
    evidence: outcome.auditReferences,
    recommendedAction:
      outcome.status === "completed"
        ? "Usar este resultado como insumo do proximo ciclo."
        : "Desbloquear a dependencia antes de tentar nova execucao.",
    sourceRunId: run.id,
    createdAt: outcome.finishedAt,
    updatedAt: outcome.finishedAt
  }));
}

export function toStoredAutomationRun(run: AutomationRun) {
  return {
    ...run
  };
}

export function buildExperimentFromExecutionJob(job: ExecutionJob): Experiment {
  const variants = Array.isArray(job.inputs.nextMoves)
    ? job.inputs.nextMoves.map((value) => String(value)).slice(0, 2)
    : ["Variante A", "Variante B"];

  return {
    id: `experiment-${job.id}`,
    companySlug: job.companySlug,
    linkedActionId: job.actionId,
    title: job.title,
    channel: typeof job.inputs.channel === "string" ? job.inputs.channel : undefined,
    hypothesis: job.rationale,
    primaryMetric: "conversion_rate",
    variants: variants.length > 0 ? variants : ["Variante A", "Variante B"],
    status: "planned",
    successCriteria:
      typeof job.inputs.successCriteria === "string"
        ? job.inputs.successCriteria
        : "Declarar vencedor apenas com melhora mensuravel e risco sob controle.",
    observationWindowDays:
      typeof job.inputs.observationWindowDays === "number" ? job.inputs.observationWindowDays : 7,
    confidence: typeof job.inputs.confidence === "number" ? job.inputs.confidence : 0.68,
    baselineMetricValue:
      typeof job.inputs.baselineMetricValue === "number" ? job.inputs.baselineMetricValue : undefined,
    sourceScorecardId:
      typeof job.inputs.sourceScorecardId === "string" ? job.inputs.sourceScorecardId : undefined,
    sourceRunId: typeof job.inputs.sourceRunId === "string" ? job.inputs.sourceRunId : undefined,
    nextAction:
      typeof job.inputs.nextAction === "string"
        ? job.inputs.nextAction
        : "Comparar variantes, capturar outcome e decidir escala ou pausa.",
    createdAt: job.createdAt
  };
}
