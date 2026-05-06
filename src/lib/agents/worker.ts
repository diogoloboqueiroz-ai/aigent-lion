import { buildTriggerEvent, runAgentOrchestrator } from "@/lib/agents/orchestrator";
import {
  buildAutomationRuntimeHealth,
  buildAutomationControlTowerSummary,
  drainAutomationRetryQueue
} from "@/lib/agents/runtime";
import { getCompanyWorkspace } from "@/lib/connectors";
import {
  generateCompanyExecutionPlan,
  materializeExecutionPlanActions,
  saveCompanyExecutionPlan,
  syncOperationalAlerts
} from "@/lib/execution";
import { syncCompanyLearningMemory } from "@/lib/learning";
import { deliverOperationalAlertEmails } from "@/lib/operational-alerts";
import type { CompanyExecutionPlan, UserProfessionalProfile } from "@/lib/domain";
import type {
  AgentRuntimeInspectionView,
  AgentRuntimeSnapshot,
  TriggerEventType
} from "@/lib/agents/types";
import { buildAgentPolicyRegistrySummary } from "@/lib/agents/policy-registry";
import {
  isDurableStoreAvailable
} from "@/lib/durable-store";
import {
  assertAgentExecutionContextAllowed,
  getAgentExecutionPlaneMode,
  type AgentExecutionContext
} from "@/lib/agents/execution-plane";
import {
  isManagedAutomationStoreConfigured,
  listManagedAutomationDeadLetters,
  listManagedAutomationQueue,
  listManagedAutomationRuns,
  listManagedConnectorCircuitBreakers,
  listManagedExecutionIntents
} from "@/infrastructure/persistence/managed-automation-store";
import {
  getAutomationStoreConfigurationError,
  getAutomationStoreMode,
  getAutomationStoreDisplayName,
  isAutomationStoreMutationAllowed,
  isAutomationStoreProductionReady
} from "@/infrastructure/persistence/automation-store-mode";
import { buildAutomationObservabilityExport } from "@/core/observability/metrics-export";
import { syncAutomationObservabilityAlerts } from "@/core/observability/alert-sink";
import {
  deliverAutomationMetricsExport,
  getAutomationMetricsSinkTargetHost,
  isAutomationMetricsSinkConfigured
} from "@/core/observability/metrics-sink";
import {
  getObservabilityCollectorForwardTargetHost,
  isObservabilityCollectorForwardingConfigured
} from "@/core/observability/collector-forwarding";
import { listObservabilityDeliveries } from "@/infrastructure/persistence/observability-delivery-store";
import { listAgentWorkerHeartbeats } from "@/infrastructure/persistence/worker-heartbeat-store";
import { recordCompanyAuditEvent } from "@/lib/governance";

type RunAgentWorkerCycleInput = {
  companySlug: string;
  actor: string;
  executionContext?: AgentExecutionContext;
  professionalProfile?: UserProfessionalProfile | null;
  triggerActor?: string;
  triggerSummary?: string;
  triggerType?: TriggerEventType;
  schedulerAutonomy?: "advisory" | "auto_low_risk" | "approval_required";
  requestOrigin: string;
  fallbackRecipientEmail: string;
  drainRetriesFirst?: boolean;
};

type AgentWorkerCycleResult = {
  automationRun: Awaited<ReturnType<typeof runAgentOrchestrator>>;
  finalPlan: CompanyExecutionPlan;
  executedActions: number;
  blockedActions: number;
  pendingActions: number;
  retryDrain: Awaited<ReturnType<typeof drainAutomationRetryQueue>>;
  openAlerts: number;
  openCriticalAlerts: number;
  deliveredEmails: number;
  failedEmails: number;
  freshLearnings: number;
};

export async function runAgentWorkerCycle(
  input: RunAgentWorkerCycleInput
): Promise<AgentWorkerCycleResult> {
  assertAgentExecutionContextAllowed(input.executionContext ?? "inline_control_plane");

  const workspace = getCompanyWorkspace(input.companySlug, input.professionalProfile);
  if (!workspace) {
    throw new Error("Empresa nao encontrada para o worker do Agent Lion.");
  }

  const emptyRetryDrain = {
    processed: 0,
    requeued: 0,
    deadLettered: 0
  };
  const effectiveRetryDrain =
    input.drainRetriesFirst === false
      ? emptyRetryDrain
      : await drainAutomationRetryQueue({
          companySlug: workspace.company.slug,
          actor: input.actor,
          professionalProfile: input.professionalProfile,
          limit: 2
        });
  const latestWorkspace = getCompanyWorkspace(input.companySlug, input.professionalProfile) ?? workspace;
  const automationRun = await runAgentOrchestrator({
    workspace: latestWorkspace,
    trigger: buildTriggerEvent(latestWorkspace.company.slug, {
      triggerType: input.triggerType ?? "scheduled_cycle",
      actor: input.triggerActor ?? "agent-worker",
      summary:
        input.triggerSummary ??
        "O worker oficial do Agent Lion disparou o ciclo autonomo desta empresa."
    }),
    actor: input.actor
  });

  const postRunWorkspace = getCompanyWorkspace(input.companySlug, input.professionalProfile) ?? latestWorkspace;
  const generatedPlan = generateCompanyExecutionPlan(postRunWorkspace, input.professionalProfile, {
    origin: "scheduler"
  });
  const finalPlan =
    input.schedulerAutonomy === "auto_low_risk"
      ? materializeExecutionPlanActions(
          postRunWorkspace,
          generatedPlan,
          input.actor,
          input.professionalProfile
        )
      : generatedPlan;

  saveCompanyExecutionPlan(finalPlan);
  const alerts = syncOperationalAlerts({
    companySlug: workspace.company.slug,
    plan: finalPlan,
    schedulerMinimumPriority: postRunWorkspace.schedulerProfile.schedulerAlertMinimumPriority,
    emailMinimumPriority: postRunWorkspace.schedulerProfile.emailAlertMinimumPriority,
    emailReady: postRunWorkspace.connections.some(
      (connection) => connection.platform === "gmail" && connection.status === "connected"
    )
  });
  const runtimeSnapshot = await getAgentRuntimeSnapshot(input.companySlug, input.professionalProfile);
  if (runtimeSnapshot?.observabilityExport && isAutomationMetricsSinkConfigured()) {
    try {
      const sinkResult = await deliverAutomationMetricsExport(runtimeSnapshot.observabilityExport);
      if (sinkResult.delivered) {
        recordCompanyAuditEvent({
          companySlug: workspace.company.slug,
          connector: "system",
          kind: "info",
          title: "Observability export entregue",
          details: `O control tower exportou metricas para ${sinkResult.url} em formato ${sinkResult.format}.`
        });
      }
    } catch (error) {
      recordCompanyAuditEvent({
        companySlug: workspace.company.slug,
        connector: "system",
        kind: "warning",
        title: "Falha ao entregar observability export",
        details: error instanceof Error ? error.message : "Falha desconhecida no metrics sink."
      });
    }
  }
  const alertsWithObservability = runtimeSnapshot
    ? syncAutomationObservabilityAlerts({
        company: workspace.company,
        controlTower: runtimeSnapshot.controlTower,
        emailReady: postRunWorkspace.connections.some(
          (connection) => connection.platform === "gmail" && connection.status === "connected"
        ),
        schedulerMinimumPriority: postRunWorkspace.schedulerProfile.schedulerAlertMinimumPriority,
        emailMinimumPriority: postRunWorkspace.schedulerProfile.emailAlertMinimumPriority
      })
    : alerts;
  const emailDelivery = await deliverOperationalAlertEmails({
    company: workspace.company,
    alerts: alertsWithObservability,
    schedulerProfile: postRunWorkspace.schedulerProfile,
    fallbackRecipientEmail: input.fallbackRecipientEmail,
    origin: input.requestOrigin
  });
  const learnings = syncCompanyLearningMemory({
    workspace: postRunWorkspace,
    latestPlan: finalPlan,
    alerts: alertsWithObservability,
    latestRun: automationRun,
    experimentResults: automationRun.experimentResults
  });

  return {
    automationRun,
    finalPlan,
    executedActions:
      finalPlan.recommendedActions?.filter((action) => action.status === "executed").length ?? 0,
    blockedActions:
      finalPlan.recommendedActions?.filter((action) => action.status === "blocked").length ?? 0,
    pendingActions:
      finalPlan.recommendedActions?.filter((action) => action.status === "recommended").length ?? 0,
    retryDrain: effectiveRetryDrain,
    openAlerts: alertsWithObservability.filter((alert) => alert.status !== "resolved").length,
    openCriticalAlerts: alertsWithObservability.filter(
      (alert) => alert.status !== "resolved" && alert.priority === "critical"
    ).length,
    deliveredEmails: emailDelivery.deliveredCount,
    failedEmails: emailDelivery.failedCount,
    freshLearnings: learnings.filter((learning) => learning.status === "fresh").length
  };
}

export async function getAgentRuntimeSnapshot(
  companySlug: string,
  professionalProfile?: UserProfessionalProfile | null
): Promise<AgentRuntimeSnapshot | null> {
  const workspace = getCompanyWorkspace(companySlug, professionalProfile);
  if (!workspace) {
    return null;
  }

  const managedMode = isManagedAutomationStoreConfigured();
  const automationRuns = managedMode
    ? await listManagedAutomationRuns(workspace.company.slug)
    : workspace.automationRuns;
  const automationQueue = managedMode
    ? await listManagedAutomationQueue(workspace.company.slug)
    : workspace.automationQueue;
  const automationDeadLetters = managedMode
    ? await listManagedAutomationDeadLetters(workspace.company.slug)
    : workspace.automationDeadLetters;
  const executionIntents = managedMode
    ? await listManagedExecutionIntents(workspace.company.slug)
    : workspace.executionIntents;
  const connectorCircuitBreakers = managedMode
    ? await listManagedConnectorCircuitBreakers(workspace.company.slug)
    : workspace.connectorCircuitBreakers;
  const sortedAutomationRuns = [...automationRuns].sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  const sortedAutomationQueue = [...automationQueue].sort((left, right) => left.availableAt.localeCompare(right.availableAt));
  const sortedAutomationDeadLetters = [...automationDeadLetters].sort(
    (left, right) => right.deadLetteredAt.localeCompare(left.deadLetteredAt)
  );
  const sortedExecutionIntents = [...executionIntents].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const sortedConnectorCircuitBreakers = [...connectorCircuitBreakers].sort(
    (left, right) => right.updatedAt.localeCompare(left.updatedAt)
  );
  const observabilityDeliveries = listObservabilityDeliveries(workspace.company.slug).slice(0, 15);
  const workerHeartbeats = (await listAgentWorkerHeartbeats(workspace.company.slug)).slice(0, 10);
  const automationRuntimeHealth = buildAutomationRuntimeHealth({
    companySlug: workspace.company.slug,
    queue: sortedAutomationQueue,
    deadLetters: sortedAutomationDeadLetters,
    executionIntents: sortedExecutionIntents,
    connectorCircuitBreakers: sortedConnectorCircuitBreakers
  });
  const controlTower = buildAutomationControlTowerSummary({
    company: workspace.company,
    automationRuns: sortedAutomationRuns,
    automationQueue: sortedAutomationQueue,
    automationDeadLetters: sortedAutomationDeadLetters,
    automationRuntimeHealth,
    executionIntents: sortedExecutionIntents,
    connectorCircuitBreakers: sortedConnectorCircuitBreakers,
    observabilityDeliveries,
    observabilityMode: resolveObservabilityChannelMode(),
    observabilityTargetHost: resolveObservabilityTargetHost(),
    workerHeartbeats,
    workerExpectedMode: getAgentExecutionPlaneMode()
  });
  const observabilityExport = buildAutomationObservabilityExport(controlTower);

  return {
    companySlug: workspace.company.slug,
    executionPlane: getAgentExecutionPlaneMode(),
    automationRuntimeHealth,
    controlTower,
    automationQueue: sortedAutomationQueue.slice(0, 25),
    automationDeadLetters: sortedAutomationDeadLetters.slice(0, 15),
    executionIntents: sortedExecutionIntents.slice(0, 20),
    connectorCircuitBreakers: sortedConnectorCircuitBreakers.slice(0, 20),
    observability: {
      recentRuns: controlTower.recentRuns,
      recentDeadLetters: controlTower.recentDeadLetters,
      recentExecutionIntents: controlTower.recentExecutionIntents,
      connectorBreakers: controlTower.connectorBreakers,
      actionBreakdown: controlTower.actionBreakdown,
      executorBreakdown: controlTower.executorBreakdown,
      topFailures: controlTower.topFailures,
      autonomyDistribution: controlTower.autonomyDistribution,
      executionIntentStatusBreakdown: controlTower.executionIntentStatusBreakdown
    },
    observabilityExport,
    observabilityDeliveries,
    workerHeartbeats,
    durableStore: {
      mode: getAutomationStoreMode(),
      provider: getAutomationStoreDisplayName(),
      available: isAutomationStoreProductionReady() && (managedMode ? true : isDurableStoreAvailable()),
      mutationAllowed: isAutomationStoreMutationAllowed(),
      productionReady: isAutomationStoreProductionReady(),
      configurationError: getAutomationStoreConfigurationError()
    },
    policyRegistry: buildAgentPolicyRegistrySummary(),
    latestAutomationRun: sortedAutomationRuns[0] ?? null,
    latestExecutionPlan: workspace.executionPlans[0] ?? null,
    latestAlertCount: workspace.operationalAlerts.filter((alert) => alert.status !== "resolved").length
  };
}

function resolveObservabilityChannelMode() {
  const directWebhook = isAutomationMetricsSinkConfigured();
  const collectorForwarder = isObservabilityCollectorForwardingConfigured();

  if (directWebhook && collectorForwarder) {
    return "hybrid" as const;
  }

  if (collectorForwarder) {
    return "collector_forwarder" as const;
  }

  if (directWebhook) {
    return "direct_webhook" as const;
  }

  return "disabled" as const;
}

function resolveObservabilityTargetHost() {
  return getObservabilityCollectorForwardTargetHost() ?? getAutomationMetricsSinkTargetHost();
}

export function projectAgentRuntimeSnapshot(
  snapshot: AgentRuntimeSnapshot,
  options?: {
    view?: AgentRuntimeInspectionView;
    limit?: number;
  }
): AgentRuntimeSnapshot {
  const view = options?.view ?? "summary";
  const limit = clampSnapshotLimit(options?.limit);
  const base: AgentRuntimeSnapshot = {
    ...snapshot,
    automationQueue: snapshot.automationQueue.slice(0, limit),
    automationDeadLetters: snapshot.automationDeadLetters.slice(0, limit),
    executionIntents: snapshot.executionIntents.slice(0, limit),
    connectorCircuitBreakers: snapshot.connectorCircuitBreakers.slice(0, limit),
    workerHeartbeats: snapshot.workerHeartbeats.slice(0, limit),
    observability: {
      ...snapshot.observability,
      recentRuns: snapshot.observability.recentRuns.slice(0, limit),
      recentDeadLetters: snapshot.observability.recentDeadLetters.slice(0, limit),
      recentExecutionIntents: snapshot.observability.recentExecutionIntents.slice(0, limit),
      connectorBreakers: snapshot.observability.connectorBreakers.slice(0, limit),
      actionBreakdown: snapshot.observability.actionBreakdown.slice(0, limit),
      executorBreakdown: snapshot.observability.executorBreakdown.slice(0, limit),
      topFailures: snapshot.observability.topFailures.slice(0, limit),
      autonomyDistribution: snapshot.observability.autonomyDistribution.slice(0, limit),
      executionIntentStatusBreakdown: snapshot.observability.executionIntentStatusBreakdown.slice(0, limit)
    }
  };

  if (view === "all") {
    return base;
  }

  if (view === "metrics") {
    return {
      ...base,
      automationQueue: [],
      automationDeadLetters: [],
      executionIntents: [],
      connectorCircuitBreakers: [],
      observability: {
        ...base.observability,
        recentRuns: [],
        recentDeadLetters: [],
        recentExecutionIntents: [],
        connectorBreakers: [],
        actionBreakdown: [],
        executorBreakdown: [],
        topFailures: [],
        autonomyDistribution: [],
        executionIntentStatusBreakdown: []
      }
    };
  }

  if (view === "queue") {
    return {
      ...base,
      observability: {
        ...base.observability,
        recentRuns: [],
        recentDeadLetters: [],
        recentExecutionIntents: [],
        connectorBreakers: [],
        actionBreakdown: [],
        executorBreakdown: [],
        topFailures: [],
        autonomyDistribution: [],
        executionIntentStatusBreakdown: []
      }
    };
  }

  if (view === "dead_letters") {
    return {
      ...base,
      automationQueue: [],
      executionIntents: [],
      connectorCircuitBreakers: [],
      observability: {
        ...base.observability,
        recentRuns: [],
        recentExecutionIntents: [],
        connectorBreakers: [],
        actionBreakdown: [],
        executorBreakdown: [],
        autonomyDistribution: [],
        executionIntentStatusBreakdown: []
      }
    };
  }

  if (view === "intents") {
    return {
      ...base,
      automationQueue: [],
      automationDeadLetters: [],
      connectorCircuitBreakers: [],
      observability: {
        ...base.observability,
        recentRuns: [],
        recentDeadLetters: [],
        connectorBreakers: [],
        actionBreakdown: [],
        executorBreakdown: [],
        topFailures: [],
        autonomyDistribution: [],
        executionIntentStatusBreakdown: base.observability.executionIntentStatusBreakdown
      }
    };
  }

  if (view === "breakers") {
    return {
      ...base,
      automationQueue: [],
      automationDeadLetters: [],
      executionIntents: [],
      observability: {
        ...base.observability,
        recentRuns: [],
        recentDeadLetters: [],
        recentExecutionIntents: [],
        actionBreakdown: [],
        executorBreakdown: [],
        topFailures: [],
        autonomyDistribution: [],
        executionIntentStatusBreakdown: []
      }
    };
  }

  if (view === "runs") {
    return {
      ...base,
      automationQueue: [],
      automationDeadLetters: [],
      executionIntents: [],
      connectorCircuitBreakers: [],
      observability: {
        ...base.observability,
        recentDeadLetters: [],
        recentExecutionIntents: [],
        connectorBreakers: []
      }
    };
  }

  return {
    ...base,
    automationQueue: [],
    automationDeadLetters: [],
    executionIntents: [],
    connectorCircuitBreakers: [],
    observability: {
      ...base.observability,
      recentDeadLetters: [],
      recentExecutionIntents: [],
      connectorBreakers: []
    }
  };
}

function clampSnapshotLimit(limit?: number) {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return 10;
  }

  return Math.max(1, Math.min(50, Math.round(limit)));
}
