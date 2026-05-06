import assert from "node:assert/strict";
import test from "node:test";
import {
  acquireStoredAutomationLockInStores,
  appendStoredAuditEventToStores,
  appendStoredAutomationRunToStores,
  getStoredAuditEventsFromStores,
  getStoredAutomationLockFromStores,
  getStoredAutomationRunsFromStores,
  releaseStoredAutomationLockFromStores
} from "@/infrastructure/persistence/company-automation-storage";
import { createEmptyVaultPayload } from "@/infrastructure/persistence/company-vault-schema";
import {
  resetActiveDurableStoreProvider,
  setActiveDurableStoreProvider
} from "@/lib/durable-store";
import type { DurableStoreProvider } from "@/lib/durable-store-provider";
import type { CompanyAutomationRun, ConnectorAuditEvent } from "@/lib/domain";

const unavailableProvider: DurableStoreProvider = {
  name: "test-unavailable",
  isAvailable: () => false,
  getAutomationRuns: () => [],
  upsertAutomationRun: () => undefined,
  getAutomationLocks: () => [],
  upsertAutomationLock: () => undefined,
  removeAutomationLock: () => undefined,
  getAutomationQueue: () => [],
  upsertAutomationQueueItem: () => undefined,
  removeAutomationQueueItem: () => undefined,
  getAutomationDeadLetters: () => [],
  appendAutomationDeadLetter: () => undefined,
  getExecutionIntents: () => [],
  upsertExecutionIntent: () => undefined,
  getConnectorCircuitBreakers: () => [],
  upsertConnectorCircuitBreaker: () => undefined,
  getAuditEvents: () => [],
  appendAuditEvent: () => undefined
};

test("company automation storage owns lock acquire/release logic without durable store", () => {
  setActiveDurableStoreProvider(unavailableProvider);
  try {
    let payload = createEmptyVaultPayload();
    const writePayload = (nextPayload: typeof payload) => {
      payload = nextPayload;
    };
    const lock = {
      companySlug: "acme",
      runId: "run-1",
      actor: "operator",
      lockedAt: "2026-05-05T10:00:00.000Z",
      expiresAt: "2999-01-01T00:00:00.000Z"
    };

    const firstAttempt = acquireStoredAutomationLockInStores({ payload, writePayload, lock });
    const secondAttempt = acquireStoredAutomationLockInStores({ payload, writePayload, lock });

    assert.equal(firstAttempt.acquired, true);
    assert.equal(secondAttempt.acquired, false);
    assert.equal(getStoredAutomationLockFromStores(payload, "acme")?.runId, "run-1");

    releaseStoredAutomationLockFromStores({
      payload,
      writePayload,
      companySlug: "acme",
      runId: "run-1"
    });

    assert.equal(getStoredAutomationLockFromStores(payload, "acme"), undefined);
  } finally {
    resetActiveDurableStoreProvider();
  }
});

test("company automation storage appends run and audit mirror entries", () => {
  setActiveDurableStoreProvider(unavailableProvider);
  try {
    let payload = createEmptyVaultPayload();
    const writePayload = (nextPayload: typeof payload) => {
      payload = nextPayload;
    };
    const run = {
      id: "run-1",
      companySlug: "acme",
      createdAt: "2026-05-05T10:00:00.000Z"
    } as unknown as CompanyAutomationRun;
    const auditEvent = {
      id: "audit-acme-1",
      timestamp: "2026-05-05T10:01:00.000Z",
      details: "acme run persisted"
    } as ConnectorAuditEvent;

    appendStoredAutomationRunToStores({ payload, writePayload, run });
    appendStoredAuditEventToStores({ payload, writePayload, event: auditEvent });

    assert.equal(getStoredAutomationRunsFromStores(payload, "acme")[0]?.id, "run-1");
    assert.equal(getStoredAuditEventsFromStores(payload, "acme")[0]?.id, "audit-acme-1");
  } finally {
    resetActiveDurableStoreProvider();
  }
});
