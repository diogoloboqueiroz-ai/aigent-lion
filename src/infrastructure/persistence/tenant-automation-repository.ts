import { toTenantId, type TenantId } from "@/core/domain/tenant";
import {
  appendPersistedCompanyAutomationDeadLetter,
  appendPersistedCompanyAutomationRun,
  getPersistedCompanyAutomationDeadLetters,
  getPersistedCompanyAutomationQueue,
  getPersistedCompanyAutomationRuns,
  removePersistedCompanyAutomationQueueItem,
  upsertPersistedCompanyAutomationQueueItem
} from "@/infrastructure/persistence/company-automation-storage";
import type {
  CompanyAutomationDeadLetterItem,
  CompanyAutomationQueueItem,
  CompanyAutomationRun
} from "@/lib/domain";

export type TenantAutomationRepository = {
  listRuns(tenantId: TenantId): CompanyAutomationRun[];
  appendRun(run: CompanyAutomationRun): void;
  listQueue(tenantId: TenantId): CompanyAutomationQueueItem[];
  upsertQueueItem(item: CompanyAutomationQueueItem): void;
  removeQueueItem(itemId: string): void;
  listDeadLetters(tenantId: TenantId): CompanyAutomationDeadLetterItem[];
  appendDeadLetter(item: CompanyAutomationDeadLetterItem): void;
};

export function createTenantAutomationRepository(): TenantAutomationRepository {
  return {
    listRuns(tenantId) {
      return getPersistedCompanyAutomationRuns(String(tenantId));
    },
    appendRun(run) {
      appendPersistedCompanyAutomationRun(run);
    },
    listQueue(tenantId) {
      return getPersistedCompanyAutomationQueue(String(tenantId));
    },
    upsertQueueItem(item) {
      upsertPersistedCompanyAutomationQueueItem(item);
    },
    removeQueueItem(itemId) {
      removePersistedCompanyAutomationQueueItem(itemId);
    },
    listDeadLetters(tenantId) {
      return getPersistedCompanyAutomationDeadLetters(String(tenantId));
    },
    appendDeadLetter(item) {
      appendPersistedCompanyAutomationDeadLetter(item);
    }
  };
}

export function resolveTenantId(companySlug: string) {
  return toTenantId(companySlug);
}
