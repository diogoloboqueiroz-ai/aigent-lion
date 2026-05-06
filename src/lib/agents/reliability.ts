import {
  createTenantAutomationRepository,
  resolveTenantId
} from "@/infrastructure/persistence/tenant-automation-repository";
import { sanitizeErrorMessage } from "@/core/observability/redaction";
import { recordCompanyAuditEvent } from "@/lib/governance";
import type {
  CompanyAutomationQueueItem,
  CompanyAutomationQueueKind,
  CompanyAutomationQueueMetadata,
  CompanyAutomationTrigger
} from "@/lib/domain";

type EnqueueRetryInput = {
  companySlug: string;
  sourceRunId: string;
  trigger: CompanyAutomationTrigger;
  actor: string;
  reason: string;
  maxAttempts?: number;
};

type EnqueueCycleInput = {
  companySlug: string;
  trigger: CompanyAutomationTrigger;
  actor: string;
  reason: string;
  idempotencyKey?: string;
  metadata?: CompanyAutomationQueueMetadata;
  maxAttempts?: number;
};

type GetDueQueueItemsInput = {
  companySlug: string;
  now?: string;
  kinds?: CompanyAutomationQueueKind[];
};

const tenantAutomationRepository = createTenantAutomationRepository();

export function enqueueAutomationRunRetry(input: EnqueueRetryInput) {
  return enqueueAutomationQueueItem({
    companySlug: input.companySlug,
    kind: "run_retry",
    sourceRunId: input.sourceRunId,
    trigger: input.trigger,
    actor: input.actor,
    reason: input.reason,
    maxAttempts: input.maxAttempts ?? 3,
    idempotencyKey: `retry:${input.sourceRunId}`
  });
}

export function enqueueAutomationCycle(input: EnqueueCycleInput) {
  return enqueueAutomationQueueItem({
    companySlug: input.companySlug,
    kind: "run_cycle",
    sourceRunId: input.trigger.id,
    trigger: input.trigger,
    actor: input.actor,
    reason: input.reason,
    maxAttempts: input.maxAttempts ?? 3,
    idempotencyKey: input.idempotencyKey,
    metadata: input.metadata
  });
}

export function getDueAutomationQueueItems(input: GetDueQueueItemsInput) {
  const now = input.now ?? new Date().toISOString();
  const allowedKinds = input.kinds ?? ["run_retry", "run_cycle"];
  const tenantId = resolveTenantId(input.companySlug);

  return tenantAutomationRepository
    .listQueue(tenantId)
    .filter(
      (item) =>
        allowedKinds.includes(item.kind) &&
        (item.status === "queued" || item.status === "retry_waiting") &&
        item.availableAt <= now
    )
    .sort((left, right) => left.availableAt.localeCompare(right.availableAt));
}

export function claimAutomationQueueItem(item: CompanyAutomationQueueItem, processingOwner: string) {
  const now = new Date().toISOString();
  const claimed = {
    ...item,
    status: "running" as const,
    lockedAt: now,
    leaseExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    processingOwner,
    updatedAt: now
  };
  tenantAutomationRepository.upsertQueueItem(claimed);
  return claimed;
}

export function completeAutomationQueueItem(item: CompanyAutomationQueueItem, summary?: string) {
  tenantAutomationRepository.removeQueueItem(item.id);
  recordCompanyAuditEvent({
    companySlug: item.companySlug,
    connector: "system",
    kind: "info",
    title: item.kind === "run_cycle" ? "Ciclo autonomo consumido da fila" : "Retry de automacao concluido",
    details:
      summary ??
      (item.kind === "run_cycle"
        ? `O item ${item.id} foi consumido com sucesso pelo worker oficial.`
        : `O retry associado a ${item.sourceRunId} foi concluido com sucesso.`)
  });
}

export function failAutomationQueueItem(item: CompanyAutomationQueueItem, errorMessage: string) {
  const sanitizedErrorMessage = sanitizeErrorMessage(errorMessage, "Falha inesperada na fila de automacao.");
  const nextAttempt = item.attemptCount + 1;

  if (nextAttempt >= item.maxAttempts) {
    tenantAutomationRepository.removeQueueItem(item.id);
    tenantAutomationRepository.appendDeadLetter({
      id: `dead-letter-${item.id}`,
      companySlug: item.companySlug,
      sourceQueueItemId: item.id,
      sourceRunId: item.sourceRunId,
      kind: item.kind,
      reason: item.reason,
      lastError: sanitizedErrorMessage,
      attemptCount: nextAttempt,
      createdAt: item.createdAt,
      deadLetteredAt: new Date().toISOString()
    });
    recordCompanyAuditEvent({
      companySlug: item.companySlug,
      connector: "system",
      kind: "warning",
      title: "Item de automacao enviado para dead-letter",
      details: `O item ${item.id} excedeu ${item.maxAttempts} tentativas. Ultimo erro: ${sanitizedErrorMessage}`
    });
    return "dead_lettered" as const;
  }

  const nextItem = {
    ...item,
    status: "retry_waiting" as const,
    attemptCount: nextAttempt,
    availableAt: computeNextRetryAt(nextAttempt),
    lastError: sanitizedErrorMessage,
    lockedAt: undefined,
    leaseExpiresAt: undefined,
    processingOwner: undefined,
    updatedAt: new Date().toISOString()
  };
  tenantAutomationRepository.upsertQueueItem(nextItem);
  recordCompanyAuditEvent({
    companySlug: item.companySlug,
    connector: "system",
    kind: "warning",
    title: "Item de automacao reagendado",
    details: `O item ${item.id} falhou e foi reagendado para ${nextItem.availableAt}. Erro: ${sanitizedErrorMessage}`
  });
  return "requeued" as const;
}

export function getDueAutomationRunRetries(companySlug: string, now = new Date().toISOString()) {
  return getDueAutomationQueueItems({
    companySlug,
    now,
    kinds: ["run_retry"]
  });
}

export function claimAutomationRunRetry(item: CompanyAutomationQueueItem) {
  return claimAutomationQueueItem(item, "retry-runtime");
}

export function completeAutomationRunRetry(item: CompanyAutomationQueueItem) {
  completeAutomationQueueItem(item);
}

export function failAutomationRunRetry(item: CompanyAutomationQueueItem, errorMessage: string) {
  return failAutomationQueueItem(item, errorMessage);
}

function computeNextRetryAt(attemptCount: number) {
  const backoffMinutes = attemptCount === 1 ? 5 : attemptCount === 2 ? 15 : 60;
  return new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
}

function enqueueAutomationQueueItem(input: {
  companySlug: string;
  kind: CompanyAutomationQueueKind;
  sourceRunId: string;
  trigger: CompanyAutomationTrigger;
  actor: string;
  reason: string;
  maxAttempts: number;
  idempotencyKey?: string;
  metadata?: CompanyAutomationQueueMetadata;
}) {
  const existing = input.idempotencyKey
    ? tenantAutomationRepository.listQueue(resolveTenantId(input.companySlug)).find(
        (item) =>
          item.kind === input.kind &&
          item.idempotencyKey === input.idempotencyKey &&
          item.status !== "dead_letter"
      )
    : undefined;

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const item: CompanyAutomationQueueItem = {
    id: `automation-${input.kind}-${input.companySlug}-${Date.now()}`,
    companySlug: input.companySlug,
    kind: input.kind,
    status: "queued",
    sourceRunId: input.sourceRunId,
    trigger: input.trigger,
    actor: input.actor,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
    attemptCount: 0,
    maxAttempts: input.maxAttempts,
    availableAt: now,
    metadata: input.metadata,
    createdAt: now,
    updatedAt: now
  };

  tenantAutomationRepository.upsertQueueItem(item);
  recordCompanyAuditEvent({
    companySlug: input.companySlug,
    connector: "system",
    kind: input.kind === "run_cycle" ? "info" : "warning",
    title:
      input.kind === "run_cycle"
        ? "Ciclo autonomo enfileirado"
        : "Retry de automacao enfileirado",
    details:
      input.kind === "run_cycle"
        ? `O trigger ${input.trigger.id} entrou na fila oficial do Agent Lion por: ${input.reason}`
        : `O ciclo ${input.sourceRunId} entrou na retry queue por: ${input.reason}`
  });

  return item;
}
