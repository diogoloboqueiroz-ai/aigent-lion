import type {
  CompanyConnectorCircuitBreaker,
  CompanyAutomationDeadLetterItem,
  CompanyExecutionIntent,
  CompanyAutomationQueueItem,
  CompanyAutomationRun,
  ConnectorAuditEvent
} from "@/lib/domain";
import type { DurableStoreProvider } from "@/lib/durable-store-provider";
import { getDurableStoreJsonPaths } from "@/infrastructure/persistence/storage-paths";
import {
  readPlainJsonFile,
  writePlainJsonFile
} from "@/infrastructure/persistence/company-vault-storage";

type DurableStorePayload = {
  automationRuns: CompanyAutomationRun[];
  automationLocks: Array<{
    id: string;
    companySlug: string;
    runId: string;
    actor: string;
    lockedAt: string;
    expiresAt: string;
  }>;
  automationQueue: CompanyAutomationQueueItem[];
  automationDeadLetters: CompanyAutomationDeadLetterItem[];
  executionIntents: CompanyExecutionIntent[];
  connectorCircuitBreakers: CompanyConnectorCircuitBreaker[];
  auditEvents: ConnectorAuditEvent[];
};

const EMPTY_PAYLOAD: DurableStorePayload = {
  automationRuns: [],
  automationLocks: [],
  automationQueue: [],
  automationDeadLetters: [],
  executionIntents: [],
  connectorCircuitBreakers: [],
  auditEvents: []
};

export const fileDurableStoreProvider: DurableStoreProvider = {
  name: "local-json",
  isAvailable() {
    return true;
  },
  getAutomationRuns(companySlug) {
    return filterByCompany(readPayload().automationRuns, companySlug, "startedAt", "desc");
  },
  upsertAutomationRun(run) {
    writePayload((payload) => ({
      ...payload,
      automationRuns: upsertById(payload.automationRuns, run).sort((left, right) =>
        right.startedAt.localeCompare(left.startedAt)
      )
    }));
  },
  getAutomationLocks(companySlug) {
    return filterByCompany(readPayload().automationLocks, companySlug, "lockedAt", "desc").map(
      (entry) => ({
        companySlug: entry.companySlug,
        runId: entry.runId,
        actor: entry.actor,
        lockedAt: entry.lockedAt,
        expiresAt: entry.expiresAt
      })
    );
  },
  upsertAutomationLock(lock) {
    writePayload((payload) => ({
      ...payload,
      automationLocks: upsertById(payload.automationLocks, {
        ...lock,
        id: `${lock.companySlug}:${lock.runId}`
      })
    }));
  },
  removeAutomationLock(companySlug, runId) {
    writePayload((payload) => ({
      ...payload,
      automationLocks: payload.automationLocks.filter(
        (entry) =>
          entry.companySlug !== companySlug || (runId ? entry.runId !== runId : false)
      )
    }));
  },
  getAutomationQueue(companySlug) {
    return filterByCompany(readPayload().automationQueue, companySlug, "availableAt", "asc");
  },
  upsertAutomationQueueItem(item) {
    writePayload((payload) => ({
      ...payload,
      automationQueue: upsertById(payload.automationQueue, item).sort((left, right) =>
        left.availableAt.localeCompare(right.availableAt)
      )
    }));
  },
  removeAutomationQueueItem(id) {
    writePayload((payload) => ({
      ...payload,
      automationQueue: payload.automationQueue.filter((entry) => entry.id !== id)
    }));
  },
  getAutomationDeadLetters(companySlug) {
    return filterByCompany(
      readPayload().automationDeadLetters,
      companySlug,
      "deadLetteredAt",
      "desc"
    );
  },
  appendAutomationDeadLetter(item) {
    writePayload((payload) => ({
      ...payload,
      automationDeadLetters: upsertById(payload.automationDeadLetters, item).sort((left, right) =>
        right.deadLetteredAt.localeCompare(left.deadLetteredAt)
      )
    }));
  },
  getExecutionIntents(companySlug) {
    return filterByCompany(readPayload().executionIntents, companySlug, "updatedAt", "desc");
  },
  upsertExecutionIntent(intent) {
    writePayload((payload) => ({
      ...payload,
      executionIntents: upsertById(payload.executionIntents, intent).sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt)
      )
    }));
  },
  getConnectorCircuitBreakers(companySlug) {
    return filterByCompany(
      readPayload().connectorCircuitBreakers,
      companySlug,
      "updatedAt",
      "desc"
    );
  },
  upsertConnectorCircuitBreaker(breaker) {
    writePayload((payload) => ({
      ...payload,
      connectorCircuitBreakers: upsertById(payload.connectorCircuitBreakers, breaker).sort(
        (left, right) => right.updatedAt.localeCompare(left.updatedAt)
      )
    }));
  },
  getAuditEvents(companySlug) {
    return filterAuditEvents(readPayload().auditEvents, companySlug);
  },
  appendAuditEvent(event) {
    writePayload((payload) => ({
      ...payload,
      auditEvents: upsertById(payload.auditEvents, event).sort((left, right) =>
        right.timestamp.localeCompare(left.timestamp)
      )
    }));
  }
};

function readPayload() {
  const { storeFile, storeBackupFile } = getDurableStoreJsonPaths();
  return (
    readPlainJsonFile<DurableStorePayload>({
      candidateFiles: [storeFile, storeBackupFile]
    }) ?? { ...EMPTY_PAYLOAD }
  );
}

function writePayload(
  updater: (payload: DurableStorePayload) => DurableStorePayload
) {
  const current = readPayload();
  const next = updater(current);
  const { dataDir, storeFile, storeBackupFile, storeTempFile } = getDurableStoreJsonPaths();
  writePlainJsonFile({
    dataDir,
    targetFile: storeFile,
    backupFile: storeBackupFile,
    tempFile: storeTempFile,
    payload: JSON.stringify(next, null, 2)
  });
}

function filterByCompany<T extends { companySlug?: string }>(
  items: T[],
  companySlug: string | undefined,
  sortKey: keyof T,
  direction: "asc" | "desc"
) {
  const filtered = companySlug
    ? items.filter((entry) => entry.companySlug === companySlug)
    : items;

  return [...filtered].sort((left, right) => {
    const leftValue = String(left[sortKey] ?? "");
    const rightValue = String(right[sortKey] ?? "");
    return direction === "asc"
      ? leftValue.localeCompare(rightValue)
      : rightValue.localeCompare(leftValue);
  });
}

function filterAuditEvents(events: ConnectorAuditEvent[], companySlug?: string) {
  const filtered = companySlug
    ? events.filter((event) => event.id.includes(`audit-${companySlug}-`))
    : events;

  return [...filtered].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

function upsertById<T extends { id: string }>(
  items: T[],
  item: T,
  resolveId?: (entry: T) => string
) {
  const getId = resolveId ?? ((entry: T) => entry.id);
  const nextItems = items.filter((entry) => getId(entry) !== getId(item));
  nextItems.push(item);
  return nextItems;
}
