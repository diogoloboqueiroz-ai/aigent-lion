import type {
  CompanyAutomationDeadLetterItem,
  CompanyAutomationQueueItem,
  CompanyAutomationRun,
  ConnectorAuditEvent
} from "@/lib/domain";
import {
  appendDurableAuditEvent,
  appendDurableAutomationDeadLetter,
  getDurableAuditEvents,
  getDurableAutomationDeadLetters,
  getDurableAutomationLocks,
  getDurableAutomationQueue,
  getDurableAutomationRuns,
  isDurableStoreAvailable,
  removeDurableAutomationLock,
  removeDurableAutomationQueueItem,
  upsertDurableAutomationLock,
  upsertDurableAutomationQueueItem,
  upsertDurableAutomationRun
} from "@/lib/durable-store";
import type {
  StoredCompanyAutomationLock,
  VaultPayload
} from "@/infrastructure/persistence/company-vault-schema";
import {
  readCompanyVaultPayload,
  writeCompanyVaultPayload
} from "@/infrastructure/persistence/company-vault-payload-store";

type AutomationVaultPayload = Pick<
  VaultPayload,
  | "automationLocks"
  | "companyAutomationRuns"
  | "companyAutomationQueue"
  | "companyAutomationDeadLetters"
  | "auditEvents"
>;

type WriteAutomationVaultPayload = (payload: VaultPayload) => void;

export function getStoredAutomationLockFromStores(
  payload: AutomationVaultPayload,
  companySlug: string
) {
  const now = new Date().toISOString();
  const durableLocks = isDurableStoreAvailable() ? getDurableAutomationLocks(companySlug) : [];
  const locks = dedupeLocks([...durableLocks, ...payload.automationLocks]);

  return locks.find((lock) => lock.companySlug === companySlug && lock.expiresAt > now);
}

export function getPersistedCompanyAutomationLock(companySlug: string) {
  return getStoredAutomationLockFromStores(readCompanyVaultPayload(), companySlug);
}

export function acquireStoredAutomationLockInStores(input: {
  payload: VaultPayload;
  writePayload: WriteAutomationVaultPayload;
  lock: StoredCompanyAutomationLock;
}) {
  const now = new Date().toISOString();
  const existingLocks = [
    ...(isDurableStoreAvailable() ? getDurableAutomationLocks(input.lock.companySlug) : []),
    ...input.payload.automationLocks
  ];
  const activeLock = existingLocks.find(
    (entry) => entry.companySlug === input.lock.companySlug && entry.expiresAt > now
  );

  if (activeLock) {
    return {
      acquired: false as const,
      lock: activeLock
    };
  }

  input.writePayload({
    ...input.payload,
    automationLocks: [
      ...input.payload.automationLocks.filter(
        (entry) => entry.companySlug !== input.lock.companySlug
      ),
      input.lock
    ]
  });

  if (isDurableStoreAvailable()) {
    upsertDurableAutomationLock(input.lock);
  }

  return {
    acquired: true as const,
    lock: input.lock
  };
}

export function acquirePersistedCompanyAutomationLock(lock: StoredCompanyAutomationLock) {
  return acquireStoredAutomationLockInStores({
    payload: readCompanyVaultPayload(),
    writePayload: writeCompanyVaultPayload,
    lock
  });
}

export function releaseStoredAutomationLockFromStores(input: {
  payload: VaultPayload;
  writePayload: WriteAutomationVaultPayload;
  companySlug: string;
  runId?: string;
}) {
  input.writePayload({
    ...input.payload,
    automationLocks: input.payload.automationLocks.filter(
      (entry) =>
        entry.companySlug !== input.companySlug ||
        (input.runId ? entry.runId !== input.runId : false)
    )
  });

  if (isDurableStoreAvailable()) {
    removeDurableAutomationLock(input.companySlug, input.runId);
  }
}

export function releasePersistedCompanyAutomationLock(companySlug: string, runId?: string) {
  releaseStoredAutomationLockFromStores({
    payload: readCompanyVaultPayload(),
    writePayload: writeCompanyVaultPayload,
    companySlug,
    runId
  });
}

export function getStoredAutomationRunsFromStores(
  payload: AutomationVaultPayload,
  companySlug?: string
) {
  const durableRuns = isDurableStoreAvailable() ? getDurableAutomationRuns(companySlug) : [];
  return mergeStoredAutomationRuns(payload.companyAutomationRuns, durableRuns, companySlug);
}

export function getPersistedCompanyAutomationRuns(companySlug?: string) {
  return getStoredAutomationRunsFromStores(readCompanyVaultPayload(), companySlug);
}

export function appendStoredAutomationRunToStores(input: {
  payload: VaultPayload;
  writePayload: WriteAutomationVaultPayload;
  run: CompanyAutomationRun;
}) {
  input.writePayload({
    ...input.payload,
    companyAutomationRuns: appendStoredAutomationRunToMirror(
      input.payload.companyAutomationRuns,
      input.run
    )
  });

  if (isDurableStoreAvailable()) {
    upsertDurableAutomationRun(input.run);
  }
}

export function appendPersistedCompanyAutomationRun(run: CompanyAutomationRun) {
  appendStoredAutomationRunToStores({
    payload: readCompanyVaultPayload(),
    writePayload: writeCompanyVaultPayload,
    run
  });
}

export function getStoredAutomationQueueFromStores(
  payload: AutomationVaultPayload,
  companySlug?: string
) {
  const durableItems = isDurableStoreAvailable() ? getDurableAutomationQueue(companySlug) : [];
  return mergeStoredAutomationQueue(payload.companyAutomationQueue, durableItems, companySlug);
}

export function getPersistedCompanyAutomationQueue(companySlug?: string) {
  return getStoredAutomationQueueFromStores(readCompanyVaultPayload(), companySlug);
}

export function upsertStoredAutomationQueueItemInStores(input: {
  payload: VaultPayload;
  writePayload: WriteAutomationVaultPayload;
  item: CompanyAutomationQueueItem;
}) {
  input.writePayload({
    ...input.payload,
    companyAutomationQueue: upsertStoredAutomationQueueInMirror(
      input.payload.companyAutomationQueue,
      input.item
    )
  });

  if (isDurableStoreAvailable()) {
    upsertDurableAutomationQueueItem(input.item);
  }
}

export function upsertPersistedCompanyAutomationQueueItem(item: CompanyAutomationQueueItem) {
  upsertStoredAutomationQueueItemInStores({
    payload: readCompanyVaultPayload(),
    writePayload: writeCompanyVaultPayload,
    item
  });
}

export function removeStoredAutomationQueueItemFromStores(input: {
  payload: VaultPayload;
  writePayload: WriteAutomationVaultPayload;
  itemId: string;
}) {
  input.writePayload({
    ...input.payload,
    companyAutomationQueue: removeStoredAutomationQueueFromMirror(
      input.payload.companyAutomationQueue,
      input.itemId
    )
  });

  if (isDurableStoreAvailable()) {
    removeDurableAutomationQueueItem(input.itemId);
  }
}

export function removePersistedCompanyAutomationQueueItem(itemId: string) {
  removeStoredAutomationQueueItemFromStores({
    payload: readCompanyVaultPayload(),
    writePayload: writeCompanyVaultPayload,
    itemId
  });
}

export function getStoredAutomationDeadLettersFromStores(
  payload: AutomationVaultPayload,
  companySlug?: string
) {
  const durableItems = isDurableStoreAvailable()
    ? getDurableAutomationDeadLetters(companySlug)
    : [];
  return mergeStoredAutomationDeadLetters(
    payload.companyAutomationDeadLetters,
    durableItems,
    companySlug
  );
}

export function getPersistedCompanyAutomationDeadLetters(companySlug?: string) {
  return getStoredAutomationDeadLettersFromStores(readCompanyVaultPayload(), companySlug);
}

export function appendStoredAutomationDeadLetterToStores(input: {
  payload: VaultPayload;
  writePayload: WriteAutomationVaultPayload;
  item: CompanyAutomationDeadLetterItem;
}) {
  input.writePayload({
    ...input.payload,
    companyAutomationDeadLetters: appendStoredAutomationDeadLetterToMirror(
      input.payload.companyAutomationDeadLetters,
      input.item
    )
  });

  if (isDurableStoreAvailable()) {
    appendDurableAutomationDeadLetter(input.item);
  }
}

export function appendPersistedCompanyAutomationDeadLetter(
  item: CompanyAutomationDeadLetterItem
) {
  appendStoredAutomationDeadLetterToStores({
    payload: readCompanyVaultPayload(),
    writePayload: writeCompanyVaultPayload,
    item
  });
}

export function getStoredAuditEventsFromStores(
  payload: AutomationVaultPayload,
  companySlug?: string
) {
  const durableEvents = isDurableStoreAvailable() ? getDurableAuditEvents(companySlug) : [];
  return mergeStoredAuditEvents(payload.auditEvents, durableEvents, companySlug);
}

export function getPersistedAuditEvents(companySlug?: string) {
  return getStoredAuditEventsFromStores(readCompanyVaultPayload(), companySlug);
}

export function appendStoredAuditEventToStores(input: {
  payload: VaultPayload;
  writePayload: WriteAutomationVaultPayload;
  event: ConnectorAuditEvent;
}) {
  input.writePayload({
    ...input.payload,
    auditEvents: appendStoredAuditEventToMirror(input.payload.auditEvents, input.event)
  });

  if (isDurableStoreAvailable()) {
    appendDurableAuditEvent(input.event);
  }
}

export function appendPersistedAuditEvent(event: ConnectorAuditEvent) {
  appendStoredAuditEventToStores({
    payload: readCompanyVaultPayload(),
    writePayload: writeCompanyVaultPayload,
    event
  });
}

export function mergeStoredAutomationRuns(
  fileRuns: CompanyAutomationRun[],
  durableRuns: CompanyAutomationRun[],
  companySlug?: string
) {
  return dedupeById([
    ...durableRuns,
    ...(companySlug ? fileRuns.filter((run) => run.companySlug === companySlug) : fileRuns)
  ]);
}

export function appendStoredAutomationRunToMirror(
  fileRuns: CompanyAutomationRun[],
  run: CompanyAutomationRun
) {
  const nextRuns = fileRuns.filter((entry) => entry.id !== run.id);
  nextRuns.unshift(run);
  return nextRuns.slice(0, 180);
}

export function mergeStoredAutomationQueue(
  fileItems: CompanyAutomationQueueItem[],
  durableItems: CompanyAutomationQueueItem[],
  companySlug?: string
) {
  return dedupeById([
    ...durableItems,
    ...(companySlug ? fileItems.filter((item) => item.companySlug === companySlug) : fileItems)
  ]);
}

export function upsertStoredAutomationQueueInMirror(
  fileItems: CompanyAutomationQueueItem[],
  item: CompanyAutomationQueueItem
) {
  const nextItems = fileItems.filter((entry) => entry.id !== item.id);
  nextItems.push(item);
  return nextItems
    .sort((left, right) => left.availableAt.localeCompare(right.availableAt))
    .slice(-300);
}

export function removeStoredAutomationQueueFromMirror(
  fileItems: CompanyAutomationQueueItem[],
  itemId: string
) {
  return fileItems.filter((entry) => entry.id !== itemId);
}

export function mergeStoredAutomationDeadLetters(
  fileItems: CompanyAutomationDeadLetterItem[],
  durableItems: CompanyAutomationDeadLetterItem[],
  companySlug?: string
) {
  return dedupeById([
    ...durableItems,
    ...(companySlug ? fileItems.filter((item) => item.companySlug === companySlug) : fileItems)
  ]);
}

export function appendStoredAutomationDeadLetterToMirror(
  fileItems: CompanyAutomationDeadLetterItem[],
  item: CompanyAutomationDeadLetterItem
) {
  return [item, ...fileItems]
    .sort((left, right) => right.deadLetteredAt.localeCompare(left.deadLetteredAt))
    .slice(0, 180);
}

export function mergeStoredAuditEvents(
  fileEvents: ConnectorAuditEvent[],
  durableEvents: ConnectorAuditEvent[],
  companySlug?: string
) {
  return dedupeById([
    ...durableEvents,
    ...(companySlug
      ? fileEvents.filter(
          (event) =>
            event.id.includes(`audit-${companySlug}-`) || event.details.includes(companySlug)
        )
      : fileEvents)
  ]);
}

export function appendStoredAuditEventToMirror(
  fileEvents: ConnectorAuditEvent[],
  event: ConnectorAuditEvent
) {
  return [event, ...fileEvents]
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, 800);
}

function dedupeById<T extends { id: string }>(items: T[]) {
  return items.filter(
    (item, index, entries) => entries.findIndex((entry) => entry.id === item.id) === index
  );
}

function dedupeLocks(items: StoredCompanyAutomationLock[]) {
  return items.filter(
    (item, index, entries) =>
      entries.findIndex(
        (entry) => entry.companySlug === item.companySlug && entry.runId === item.runId
      ) === index
  );
}
