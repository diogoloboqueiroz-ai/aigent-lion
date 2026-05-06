import type {
  CompanyConnectorCircuitBreaker,
  CompanyAutomationDeadLetterItem,
  CompanyExecutionIntent,
  CompanyAutomationQueueItem,
  CompanyAutomationRun,
  ConnectorAuditEvent
} from "@/lib/domain";

export type DurableAutomationLock = {
  companySlug: string;
  runId: string;
  actor: string;
  lockedAt: string;
  expiresAt: string;
};

export type DurableStoreProvider = {
  name: string;
  isAvailable: () => boolean;
  getAutomationRuns: (companySlug?: string) => CompanyAutomationRun[];
  upsertAutomationRun: (run: CompanyAutomationRun) => void;
  getAutomationLocks: (companySlug?: string) => DurableAutomationLock[];
  upsertAutomationLock: (lock: DurableAutomationLock) => void;
  removeAutomationLock: (companySlug: string, runId?: string) => void;
  getAutomationQueue: (companySlug?: string) => CompanyAutomationQueueItem[];
  upsertAutomationQueueItem: (item: CompanyAutomationQueueItem) => void;
  removeAutomationQueueItem: (id: string) => void;
  getAutomationDeadLetters: (companySlug?: string) => CompanyAutomationDeadLetterItem[];
  appendAutomationDeadLetter: (item: CompanyAutomationDeadLetterItem) => void;
  getExecutionIntents: (companySlug?: string) => CompanyExecutionIntent[];
  upsertExecutionIntent: (intent: CompanyExecutionIntent) => void;
  getConnectorCircuitBreakers: (companySlug?: string) => CompanyConnectorCircuitBreaker[];
  upsertConnectorCircuitBreaker: (breaker: CompanyConnectorCircuitBreaker) => void;
  getAuditEvents: (companySlug?: string) => ConnectorAuditEvent[];
  appendAuditEvent: (event: ConnectorAuditEvent) => void;
};
