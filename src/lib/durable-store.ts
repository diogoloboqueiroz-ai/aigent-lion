import type {
  CompanyConnectorCircuitBreaker,
  CompanyAutomationDeadLetterItem,
  CompanyExecutionIntent,
  CompanyAutomationQueueItem,
  CompanyAutomationRun,
  ConnectorAuditEvent
} from "@/lib/domain";
import type { DurableAutomationLock, DurableStoreProvider } from "@/lib/durable-store-provider";
import { fileDurableStoreProvider } from "@/lib/durable-store-file";
import {
  assertAutomationStoreMutationAllowed,
  isAutomationStoreMutationAllowed
} from "@/infrastructure/persistence/automation-store-mode";

let activeDurableStoreProvider: DurableStoreProvider = fileDurableStoreProvider;

export function getActiveDurableStoreProvider() {
  return activeDurableStoreProvider;
}

export function setActiveDurableStoreProvider(provider: DurableStoreProvider) {
  activeDurableStoreProvider = provider;
}

export function resetActiveDurableStoreProvider() {
  activeDurableStoreProvider = fileDurableStoreProvider;
}

export function isDurableStoreAvailable() {
  if (!isAutomationStoreMutationAllowed()) {
    return false;
  }

  return activeDurableStoreProvider.isAvailable();
}

export function getDurableAutomationRuns(companySlug?: string) {
  return activeDurableStoreProvider.getAutomationRuns(companySlug);
}

export function upsertDurableAutomationRun(run: CompanyAutomationRun) {
  assertAutomationStoreMutationAllowed("persistir automation run no durable store");
  activeDurableStoreProvider.upsertAutomationRun(run);
}

export function getDurableAutomationLocks(companySlug?: string) {
  return activeDurableStoreProvider.getAutomationLocks(companySlug);
}

export function upsertDurableAutomationLock(lock: DurableAutomationLock) {
  assertAutomationStoreMutationAllowed("persistir automation lock no durable store");
  activeDurableStoreProvider.upsertAutomationLock(lock);
}

export function removeDurableAutomationLock(companySlug: string, runId?: string) {
  assertAutomationStoreMutationAllowed("remover automation lock do durable store");
  activeDurableStoreProvider.removeAutomationLock(companySlug, runId);
}

export function getDurableAutomationQueue(companySlug?: string) {
  return activeDurableStoreProvider.getAutomationQueue(companySlug);
}

export function upsertDurableAutomationQueueItem(item: CompanyAutomationQueueItem) {
  assertAutomationStoreMutationAllowed("persistir item da fila oficial no durable store");
  activeDurableStoreProvider.upsertAutomationQueueItem(item);
}

export function removeDurableAutomationQueueItem(id: string) {
  assertAutomationStoreMutationAllowed("remover item da fila oficial do durable store");
  activeDurableStoreProvider.removeAutomationQueueItem(id);
}

export function getDurableAutomationDeadLetters(companySlug?: string) {
  return activeDurableStoreProvider.getAutomationDeadLetters(companySlug);
}

export function appendDurableAutomationDeadLetter(item: CompanyAutomationDeadLetterItem) {
  assertAutomationStoreMutationAllowed("persistir dead-letter no durable store");
  activeDurableStoreProvider.appendAutomationDeadLetter(item);
}

export function getDurableExecutionIntents(companySlug?: string) {
  return activeDurableStoreProvider.getExecutionIntents(companySlug);
}

export function upsertDurableExecutionIntent(intent: CompanyExecutionIntent) {
  assertAutomationStoreMutationAllowed("persistir execution intent no durable store");
  activeDurableStoreProvider.upsertExecutionIntent(intent);
}

export function getDurableConnectorCircuitBreakers(companySlug?: string) {
  return activeDurableStoreProvider.getConnectorCircuitBreakers(companySlug);
}

export function upsertDurableConnectorCircuitBreaker(breaker: CompanyConnectorCircuitBreaker) {
  assertAutomationStoreMutationAllowed("persistir circuit breaker no durable store");
  activeDurableStoreProvider.upsertConnectorCircuitBreaker(breaker);
}

export function getDurableAuditEvents(companySlug?: string) {
  return activeDurableStoreProvider.getAuditEvents(companySlug);
}

export function appendDurableAuditEvent(event: ConnectorAuditEvent) {
  assertAutomationStoreMutationAllowed("persistir audit event no durable store");
  activeDurableStoreProvider.appendAuditEvent(event);
}
