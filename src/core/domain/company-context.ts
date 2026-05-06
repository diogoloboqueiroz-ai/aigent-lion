import { getCrossTenantLearningPlaybooks } from "@/lib/learning";
import { isLearningPatternReusable } from "@/core/learning/reuse-eligibility";
import type {
  ApprovalCenterItem,
  CompanyAgentLearning,
  CompanyWorkspace,
  PlatformId
} from "@/lib/domain";
import type {
  CompanyContext,
  CompanyKPIState,
  CompanyMemory,
  ConnectorCapability,
  Experiment,
  GrowthGoal,
  LearningRecord,
  TriggerEvent
} from "@/lib/agents/types";

type BuildCompanyContextInput = {
  workspace: CompanyWorkspace;
  trigger: TriggerEvent;
  mapLearningRecord: (learning: CompanyAgentLearning) => LearningRecord;
  mapApproval: (item: ApprovalCenterItem) => CompanyMemory["openApprovals"][number];
};

const CONNECTOR_CAPABILITIES: Record<
  PlatformId,
  {
    canWriteWhenReady: boolean;
    capabilities: string[];
  }
> = {
  ga4: {
    canWriteWhenReady: false,
    capabilities: ["read_metrics", "read_revenue", "read_conversions"]
  },
  "google-sheets": {
    canWriteWhenReady: true,
    capabilities: ["read_sheet", "write_sheet", "append_kpi_rows"]
  },
  "search-console": {
    canWriteWhenReady: false,
    capabilities: ["read_queries", "read_pages", "read_ctr"]
  },
  "google-ads": {
    canWriteWhenReady: true,
    capabilities: ["read_campaigns", "prepare_budget_shift", "prepare_conversion_sync"]
  },
  meta: {
    canWriteWhenReady: true,
    capabilities: ["read_campaigns", "prepare_creative_ops", "prepare_social_sync"]
  },
  "business-profile": {
    canWriteWhenReady: true,
    capabilities: ["read_local_performance", "prepare_local_updates"]
  },
  gmail: {
    canWriteWhenReady: true,
    capabilities: ["send_followup", "draft_email", "deliver_alert"]
  },
  youtube: {
    canWriteWhenReady: true,
    capabilities: ["read_channel_metrics", "prepare_video_publish"]
  }
};

export function buildCoreCompanyContext(input: BuildCompanyContextInput): CompanyContext {
  const connectorCapabilities = buildConnectorCapabilities(input.workspace);
  const kpis = buildCompanyKPIState(input.workspace, connectorCapabilities);
  const memory = buildCompanyMemory(input.workspace, {
    mapLearningRecord: input.mapLearningRecord,
    mapApproval: input.mapApproval
  });

  return {
    companySlug: input.workspace.company.slug,
    companyName: input.workspace.company.name,
    generatedAt: new Date().toISOString(),
    workspace: input.workspace,
    trigger: input.trigger,
    goals: buildGrowthGoals(input.workspace),
    kpis,
    connectorCapabilities,
    memory,
    strategySummary: buildStrategySummary(input.workspace),
    recentReports: input.workspace.reports.slice(0, 5),
    recentExecutionPlans: input.workspace.executionPlans.slice(0, 5),
    recentAlerts: input.workspace.operationalAlerts.slice(0, 8),
    recentAudit: input.workspace.audit.slice(0, 20),
    recentRuntimeTasks: input.workspace.socialRuntimeTasks.slice(0, 15),
    recentRuntimeLogs: input.workspace.socialExecutionLogs.slice(0, 15),
    metricSnapshots: input.workspace.snapshots.slice(0, 24)
  };
}

export function buildGrowthGoals(workspace: CompanyWorkspace): GrowthGoal[] {
  return [
    {
      id: `goal-${workspace.company.slug}-primary`,
      title: workspace.strategyPlan.primaryObjective,
      metric: "primary_objective",
      target: workspace.strategyPlan.primaryObjective,
      horizon: workspace.strategyPlan.planningHorizon,
      priority: "critical"
    },
    {
      id: `goal-${workspace.company.slug}-reach`,
      title: "Expandir alcance qualificado",
      metric: "reach",
      target: workspace.strategyPlan.reachGoal,
      horizon: workspace.strategyPlan.planningHorizon,
      priority: "high"
    },
    {
      id: `goal-${workspace.company.slug}-leads`,
      title: "Crescer leads qualificados",
      metric: "qualified_leads",
      target: workspace.strategyPlan.leadGoal,
      horizon: workspace.strategyPlan.planningHorizon,
      priority: "high"
    },
    {
      id: `goal-${workspace.company.slug}-revenue`,
      title: "Elevar receita com eficiencia",
      metric: "revenue",
      target: workspace.strategyPlan.revenueGoal,
      horizon: workspace.strategyPlan.planningHorizon,
      priority: "high",
      note: `Guardrails: CPA ${workspace.strategyPlan.cpaTarget} · ROAS ${workspace.strategyPlan.roasTarget}.`
    }
  ];
}

export function buildConnectorCapabilities(workspace: CompanyWorkspace): ConnectorCapability[] {
  return workspace.connections.map((connection) => {
    const capability = CONNECTOR_CAPABILITIES[connection.platform];
    const status =
      connection.status === "connected"
        ? ("ready" as const)
        : connection.status === "action_required"
          ? ("partial" as const)
          : ("blocked" as const);

    return {
      connector: connection.platform,
      label: connection.label,
      status,
      canRead: status !== "blocked",
      canWrite: status === "ready" ? capability.canWriteWhenReady : false,
      capabilities: capability.capabilities,
      lastSync: connection.lastSync,
      note: connection.nextAction
    };
  });
}

export function buildCompanyKPIState(
  workspace: CompanyWorkspace,
  connectorCapabilities: ConnectorCapability[]
): CompanyKPIState {
  const spend = workspace.snapshots.reduce((total, snapshot) => total + (snapshot.spend ?? 0), 0);
  const revenue = workspace.snapshots.reduce((total, snapshot) => total + (snapshot.revenue ?? 0), 0);
  const conversions = workspace.snapshots.reduce((total, snapshot) => total + (snapshot.conversions ?? 0), 0);
  const leadsWon = workspace.leads.filter((lead) => lead.stage === "won").length;
  const connectorCoverage = connectorCapabilities.reduce(
    (summary, capability) => {
      summary[capability.status] += 1;
      return summary;
    },
    {
      ready: 0,
      partial: 0,
      blocked: 0
    }
  );

  return {
    generatedAt: new Date().toISOString(),
    spend,
    revenue,
    conversions,
    leadsWon,
    approvalBacklog: workspace.approvalsCenter.filter((item) => item.actions.length > 0).length,
    runtimeQueued: workspace.socialRuntimeTasks.filter((task) => task.status === "queued").length,
    runtimeBlocked: workspace.socialRuntimeTasks.filter((task) => task.status === "blocked").length,
    runtimeFailed: workspace.socialRuntimeTasks.filter((task) => task.status === "failed").length,
    recentReports: workspace.reports.length,
    activeLearnings: workspace.agentLearnings.filter((learning) => learning.status !== "historical").length,
    connectorCoverage,
    summaries: [
      {
        label: "Spend consolidado",
        value: formatCurrency(spend),
        context: `${workspace.snapshots.length} snapshots no workspace.`
      },
      {
        label: "Receita observada",
        value: formatCurrency(revenue),
        context: `${leadsWon} leads ganhos no CRM canonico.`
      },
      {
        label: "Conversoes",
        value: formatInteger(conversions),
        context: `${workspace.conversionEvents.length} eventos de conversao persistidos.`
      },
      {
        label: "Runtime social",
        value: `${workspace.socialRuntime.queuedTasks}/${workspace.socialRuntime.blockedTasks}/${workspace.socialRuntime.failedTasks}`,
        context: "Formato queued/bloqueada/falha."
      }
    ]
  };
}

export function buildCompanyMemory(
  workspace: CompanyWorkspace,
  input: {
    mapLearningRecord: (learning: CompanyAgentLearning) => LearningRecord;
    mapApproval: (item: ApprovalCenterItem) => CompanyMemory["openApprovals"][number];
  }
): CompanyMemory {
  const sharedPlaybooks = getCrossTenantLearningPlaybooks().filter(
    (playbook) =>
      isLearningPatternReusable(playbook) &&
      (workspace.strategyPlan.priorityChannels.includes(playbook.channel as PlatformId) ||
        workspace.learningPlaybooks.some((entry) => entry.channel === playbook.channel))
  );
  const recentRuns =
    workspace.automationRuns.length > 0
      ? workspace.automationRuns.slice(0, 5).map((run) => ({
          id: run.id,
          startedAt: run.startedAt,
          summary: run.summary,
          state: run.state
        }))
      : workspace.executionPlans.slice(0, 5).map((plan) => ({
          id: plan.id,
          startedAt: plan.generatedAt,
          summary: plan.summary,
          state: "schedule_next_cycle" as const
        }));

  return {
    companySlug: workspace.company.slug,
    patterns: [
      ...workspace.learningPlaybooks
        .filter((playbook) => playbook.status !== "retired")
        .slice(0, 4)
        .map((playbook) => playbook.summary),
      ...workspace.agentLearnings
        .filter((learning) => learning.kind === "playbook" || learning.kind === "opportunity")
        .slice(0, 4)
        .map((learning) => learning.summary)
    ].slice(0, 6),
    sharedPatterns: sharedPlaybooks.slice(0, 4),
    learningRecords: workspace.agentLearnings.slice(0, 12).map(input.mapLearningRecord),
    openApprovals: workspace.approvalsCenter
      .filter((item) => item.actions.length > 0)
      .slice(0, 10)
      .map(input.mapApproval),
    activeExperiments: buildActiveExperiments(workspace),
    recentRuns
  };
}

export function buildStrategySummary(workspace: CompanyWorkspace) {
  return [
    workspace.strategyPlan.primaryObjective,
    workspace.strategyPlan.secondaryObjective,
    `Canais prioritarios: ${workspace.strategyPlan.priorityChannels.join(", ")}.`,
    `Metas: ${workspace.strategyPlan.leadGoal} | ${workspace.strategyPlan.revenueGoal}.`
  ];
}

function buildActiveExperiments(workspace: CompanyWorkspace): Experiment[] {
  const outcomeByExperimentId = new Map(
    workspace.experimentOutcomes.map((outcome) => [outcome.experimentId, outcome])
  );
  const experiments = workspace.executionPlans.flatMap((plan) =>
    (plan.recommendedExperiments ?? []).map((experiment) => {
      const linkedAction = (plan.recommendedActions ?? []).find(
        (action) => action.sourceExperimentId === experiment.id
      );
      const outcome = outcomeByExperimentId.get(experiment.id);

      return {
        id: experiment.id,
        companySlug: workspace.company.slug,
        linkedActionId: linkedAction?.id ?? `action-${experiment.id}`,
        title: experiment.title,
        hypothesis: experiment.hypothesis,
        primaryMetric: experiment.primaryMetric,
        variants: experiment.variants,
        status:
          outcome?.status === "won"
            ? "won"
            : outcome?.status === "lost"
              ? "lost"
              : experiment.status,
        createdAt: outcome?.generatedAt ?? plan.generatedAt
      } satisfies Experiment;
    })
  );

  const unique = new Map(experiments.map((experiment) => [experiment.id, experiment]));
  return Array.from(unique.values()).slice(0, 10);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2
  }).format(value);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}
