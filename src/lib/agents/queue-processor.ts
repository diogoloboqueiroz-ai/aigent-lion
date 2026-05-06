import {
  claimAutomationQueueItem,
  completeAutomationQueueItem,
  enqueueAutomationCycle,
  failAutomationQueueItem,
  getDueAutomationQueueItems
} from "@/lib/agents/reliability";
import { getCompanyWorkspace } from "@/lib/connectors";
import type {
  CompanyAutomationDeadLetterItem,
  CompanyAutomationQueueItem,
  CompanyAutomationTrigger,
  UserProfessionalProfile
} from "@/lib/domain";
import { runAgentWorkerCycle } from "@/lib/agents/worker";
import type { TriggerEventType } from "@/lib/agents/types";
import {
  appendManagedAutomationDeadLetter,
  findManagedAutomationQueueItemByIdempotencyKey,
  isManagedAutomationStoreConfigured,
  listManagedAutomationQueue,
  removeManagedAutomationQueueItem,
  upsertManagedAutomationQueueItem
} from "@/infrastructure/persistence/managed-automation-store";
import { assertAutomationStoreMutationAllowed } from "@/infrastructure/persistence/automation-store-mode";
import {
  assertAgentExecutionContextAllowed,
  type AgentExecutionContext
} from "@/lib/agents/execution-plane";
import { sanitizeErrorMessage } from "@/core/observability/redaction";

type EnqueueAgentWorkerRunInput = {
  companySlug: string;
  actor: string;
  trigger: CompanyAutomationTrigger;
  reason: string;
  idempotencyKey?: string;
  schedulerAutonomy?: "advisory" | "auto_low_risk" | "approval_required";
  requestOrigin?: string;
  fallbackRecipientEmail?: string;
  source?: "scheduler" | "manual" | "api" | "runtime";
  maxAttempts?: number;
};

type DrainAgentWorkerQueueInput = {
  companySlug: string;
  actor: string;
  executionContext?: AgentExecutionContext;
  professionalProfile?: UserProfessionalProfile | null;
  requestOrigin?: string;
  fallbackRecipientEmail?: string;
  limit?: number;
};

type DrainAgentWorkerQueueResult = {
  processed: number;
  completed: number;
  requeued: number;
  deadLettered: number;
  lastCompletedRunId?: string;
};

export async function enqueueAgentWorkerRun(input: EnqueueAgentWorkerRunInput) {
  assertAutomationStoreMutationAllowed("enfileirar novo ciclo autonomo oficial");

  if (
    isManagedAutomationStoreConfigured() &&
    input.idempotencyKey &&
    input.idempotencyKey.trim().length > 0
  ) {
    const managedExisting = await findManagedAutomationQueueItemByIdempotencyKey({
      companySlug: input.companySlug,
      kind: "run_cycle",
      idempotencyKey: input.idempotencyKey.trim()
    });

    if (managedExisting) {
      return managedExisting;
    }
  }

  const item = enqueueAutomationCycle({
    companySlug: input.companySlug,
    trigger: input.trigger,
    actor: input.actor,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
    metadata: {
      schedulerAutonomy: input.schedulerAutonomy,
      requestOrigin: input.requestOrigin,
      fallbackRecipientEmail: input.fallbackRecipientEmail,
      source: input.source
    },
    maxAttempts: input.maxAttempts
  });

  if (isManagedAutomationStoreConfigured()) {
    await upsertManagedAutomationQueueItem(item);
  }

  return item;
}

export async function drainAgentWorkerQueue(
  input: DrainAgentWorkerQueueInput
): Promise<DrainAgentWorkerQueueResult> {
  const executionContext = input.executionContext ?? "inline_control_plane";
  assertAgentExecutionContextAllowed(executionContext);
  assertAutomationStoreMutationAllowed("drenar a fila oficial do Agent Lion");

  if (isManagedAutomationStoreConfigured()) {
    return drainManagedAgentWorkerQueue({
      ...input,
      executionContext
    });
  }

  const dueItems = getDueAutomationQueueItems({
    companySlug: input.companySlug,
    kinds: ["run_cycle"]
  });
  let processed = 0;
  let completed = 0;
  let requeued = 0;
  let deadLettered = 0;
  let lastCompletedRunId: string | undefined;

  for (const item of dueItems.slice(0, input.limit ?? 2)) {
    const claimedItem = claimAutomationQueueItem(item, input.actor);

    try {
      const workspace = getCompanyWorkspace(input.companySlug, input.professionalProfile);
      if (!workspace) {
        throw new Error("Empresa nao encontrada ao drenar a fila oficial do Agent Lion.");
      }

      const result = await runAgentWorkerCycle({
        companySlug: input.companySlug,
        actor: claimedItem.actor || input.actor,
        executionContext,
        professionalProfile: input.professionalProfile,
        triggerType: claimedItem.trigger.type as TriggerEventType,
        triggerActor: claimedItem.trigger.actor,
        triggerSummary: claimedItem.trigger.summary,
        schedulerAutonomy: claimedItem.metadata?.schedulerAutonomy,
        requestOrigin: claimedItem.metadata?.requestOrigin ?? input.requestOrigin ?? "http://localhost",
        fallbackRecipientEmail:
          claimedItem.metadata?.fallbackRecipientEmail ?? input.fallbackRecipientEmail ?? claimedItem.actor,
        drainRetriesFirst: false
      });

      completeAutomationQueueItem(
        claimedItem,
        `O item ${claimedItem.id} foi consumido com sucesso. Run final: ${result.automationRun.id}.`
      );
      processed += 1;
      completed += 1;
      lastCompletedRunId = result.automationRun.id;
    } catch (error) {
      const failureResult = failAutomationQueueItem(
        claimedItem,
        sanitizeErrorMessage(error, "Falha inesperada ao processar a fila oficial.")
      );
      processed += 1;
      if (failureResult === "dead_lettered") {
        deadLettered += 1;
      } else {
        requeued += 1;
      }
    }
  }

  return {
    processed,
    completed,
    requeued,
    deadLettered,
    lastCompletedRunId
  };
}

export async function getQueuedAgentWorkerRuns(companySlug: string) {
  if (isManagedAutomationStoreConfigured()) {
    const items = await listManagedAutomationQueue(companySlug);
    return items.filter(
      (item) =>
        item.kind === "run_cycle" &&
        (item.status === "queued" || item.status === "retry_waiting") &&
        item.availableAt <= new Date().toISOString()
    );
  }

  return getDueAutomationQueueItems({
    companySlug,
    kinds: ["run_cycle"]
  });
}

export function getQueueIdempotencyKeyForScheduler(
  companySlug: string,
  schedulerJobId: string,
  nextRunAt: string
) {
  return `scheduler:${companySlug}:${schedulerJobId}:${nextRunAt}`;
}

export function getQueueIdempotencyKeyForManualTrigger(
  companySlug: string,
  actor: string,
  trigger: Pick<CompanyAutomationTrigger, "type" | "summary">
) {
  return `manual:${companySlug}:${actor}:${trigger.type}:${trigger.summary}`;
}

export function isAutomationCycleQueueItem(item: CompanyAutomationQueueItem) {
  return item.kind === "run_cycle";
}

async function drainManagedAgentWorkerQueue(
  input: DrainAgentWorkerQueueInput
): Promise<DrainAgentWorkerQueueResult> {
  const now = new Date().toISOString();
  const dueItems = (await listManagedAutomationQueue(input.companySlug))
    .filter(
      (item) =>
        item.kind === "run_cycle" &&
        (item.status === "queued" || item.status === "retry_waiting") &&
        item.availableAt <= now
    )
    .sort((left, right) => left.availableAt.localeCompare(right.availableAt));

  let processed = 0;
  let completed = 0;
  let requeued = 0;
  let deadLettered = 0;
  let lastCompletedRunId: string | undefined;

  for (const item of dueItems.slice(0, input.limit ?? 2)) {
    const claimedItem = await claimManagedQueueItem(item, input.actor);

    try {
      const workspace = getCompanyWorkspace(input.companySlug, input.professionalProfile);
      if (!workspace) {
        throw new Error("Empresa nao encontrada ao drenar a fila oficial do Agent Lion.");
      }

      const result = await runAgentWorkerCycle({
        companySlug: input.companySlug,
        actor: claimedItem.actor || input.actor,
        executionContext: input.executionContext ?? "inline_control_plane",
        professionalProfile: input.professionalProfile,
        triggerType: claimedItem.trigger.type as TriggerEventType,
        triggerActor: claimedItem.trigger.actor,
        triggerSummary: claimedItem.trigger.summary,
        schedulerAutonomy: claimedItem.metadata?.schedulerAutonomy,
        requestOrigin: claimedItem.metadata?.requestOrigin ?? input.requestOrigin ?? "http://localhost",
        fallbackRecipientEmail:
          claimedItem.metadata?.fallbackRecipientEmail ?? input.fallbackRecipientEmail ?? claimedItem.actor,
        drainRetriesFirst: false
      });

      await completeManagedQueueItem(
        claimedItem,
        `O item ${claimedItem.id} foi consumido com sucesso. Run final: ${result.automationRun.id}.`
      );
      processed += 1;
      completed += 1;
      lastCompletedRunId = result.automationRun.id;
    } catch (error) {
      const failureResult = await failManagedQueueItem(
        claimedItem,
        sanitizeErrorMessage(error, "Falha inesperada ao processar a fila oficial.")
      );
      processed += 1;
      if (failureResult === "dead_lettered") {
        deadLettered += 1;
      } else {
        requeued += 1;
      }
    }
  }

  return {
    processed,
    completed,
    requeued,
    deadLettered,
    lastCompletedRunId
  };
}

async function claimManagedQueueItem(item: CompanyAutomationQueueItem, processingOwner: string) {
  const now = new Date().toISOString();
  const claimed = {
    ...item,
    status: "running" as const,
    lockedAt: now,
    leaseExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    processingOwner,
    updatedAt: now
  };

  await upsertManagedAutomationQueueItem(claimed);
  return claimed;
}

async function completeManagedQueueItem(item: CompanyAutomationQueueItem, summary?: string) {
  await removeManagedAutomationQueueItem(item.id);
  completeAutomationQueueItem(item, summary);
}

async function failManagedQueueItem(item: CompanyAutomationQueueItem, errorMessage: string) {
  const sanitizedErrorMessage = sanitizeErrorMessage(
    errorMessage,
    "Falha inesperada ao processar a fila oficial."
  );
  const nextAttempt = item.attemptCount + 1;

  if (nextAttempt >= item.maxAttempts) {
    await removeManagedAutomationQueueItem(item.id);
    const deadLetter = buildDeadLetterItem(item, nextAttempt, sanitizedErrorMessage);
    await appendManagedAutomationDeadLetter(deadLetter);
    failAutomationQueueItem(item, sanitizedErrorMessage);
    return "dead_lettered" as const;
  }

  const nextItem = buildRetryWaitingItem(item, nextAttempt, sanitizedErrorMessage);
  await upsertManagedAutomationQueueItem(nextItem);
  failAutomationQueueItem(item, sanitizedErrorMessage);
  return "requeued" as const;
}

function buildRetryWaitingItem(
  item: CompanyAutomationQueueItem,
  attemptCount: number,
  errorMessage: string
) {
  return {
    ...item,
    status: "retry_waiting" as const,
    attemptCount,
    availableAt: computeNextRetryAt(attemptCount),
    lastError: errorMessage,
    lockedAt: undefined,
    leaseExpiresAt: undefined,
    processingOwner: undefined,
    updatedAt: new Date().toISOString()
  };
}

function buildDeadLetterItem(
  item: CompanyAutomationQueueItem,
  attemptCount: number,
  errorMessage: string
): CompanyAutomationDeadLetterItem {
  return {
    id: `dead-letter-${item.id}`,
    companySlug: item.companySlug,
    sourceQueueItemId: item.id,
    sourceRunId: item.sourceRunId,
    kind: item.kind,
    reason: item.reason,
    lastError: errorMessage,
    attemptCount,
    createdAt: item.createdAt,
    deadLetteredAt: new Date().toISOString()
  };
}

function computeNextRetryAt(attemptCount: number) {
  const backoffMinutes = attemptCount === 1 ? 5 : attemptCount === 2 ? 15 : 60;
  return new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
}
