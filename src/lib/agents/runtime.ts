import type { CompanyWorkspace, UserProfessionalProfile } from "@/lib/domain";
import { buildAutomationRuntimeHealth as coreBuildAutomationRuntimeHealth } from "@/core/observability/agent-control-tower";
import { getCompanyWorkspace } from "@/lib/connectors";
import { buildTriggerEvent, runAgentOrchestrator } from "@/lib/agents/orchestrator";
import {
  claimAutomationRunRetry,
  completeAutomationRunRetry,
  failAutomationRunRetry,
  getDueAutomationRunRetries
} from "@/lib/agents/reliability";
import { sanitizeErrorMessage } from "@/core/observability/redaction";

export {
  buildAutomationControlTowerSummary,
  buildAutomationRuntimeHealth
} from "@/core/observability/agent-control-tower";
export {
  buildAutomationObservabilityExport,
  formatObservabilityExportAsPrometheus
} from "@/core/observability/metrics-export";

type DrainAutomationRetryQueueInput = {
  companySlug: string;
  actor: string;
  professionalProfile?: UserProfessionalProfile | null;
  limit?: number;
};

type DrainAutomationRetryQueueResult = {
  processed: number;
  requeued: number;
  deadLettered: number;
};

export async function drainAutomationRetryQueue(
  input: DrainAutomationRetryQueueInput
): Promise<DrainAutomationRetryQueueResult> {
  const dueRetries = getDueAutomationRunRetries(input.companySlug);
  let processed = 0;
  let requeued = 0;
  let deadLettered = 0;

  for (const retryItem of dueRetries.slice(0, input.limit ?? 2)) {
    const claimedRetry = claimAutomationRunRetry(retryItem);

    try {
      const retryWorkspace = getCompanyWorkspace(input.companySlug, input.professionalProfile);
      if (!retryWorkspace) {
        throw new Error("Empresa nao encontrada ao drenar retry queue.");
      }

      await runAgentOrchestrator({
        workspace: retryWorkspace,
        trigger: buildTriggerEvent(retryWorkspace.company.slug, {
          triggerType: "alert_recheck",
          actor: `runtime:retry:${claimedRetry.id}`,
          summary: `Retry operacional do ciclo ${claimedRetry.sourceRunId}: ${claimedRetry.reason}`
        }),
        actor: input.actor,
        enqueueRetryOnFailure: false
      });
      completeAutomationRunRetry(claimedRetry);
      processed += 1;
    } catch (error) {
      const result = failAutomationRunRetry(
        claimedRetry,
        sanitizeErrorMessage(error, "Falha inesperada no retry do ciclo autonomo.")
      );
      if (result === "dead_lettered") {
        deadLettered += 1;
      } else {
        requeued += 1;
      }
    }
  }

  return {
    processed,
    requeued,
    deadLettered
  };
}

export function buildWorkspaceAutomationRuntimeHealth(
  workspace: Pick<
    CompanyWorkspace,
    | "company"
    | "automationQueue"
    | "automationDeadLetters"
    | "executionIntents"
    | "connectorCircuitBreakers"
  >
) {
  return coreBuildAutomationRuntimeHealth({
    companySlug: workspace.company.slug,
    queue: workspace.automationQueue,
    deadLetters: workspace.automationDeadLetters,
    executionIntents: workspace.executionIntents,
    connectorCircuitBreakers: workspace.connectorCircuitBreakers
  });
}
