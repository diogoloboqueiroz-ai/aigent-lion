import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import type {
  CompanyConnectorCircuitBreaker,
  CompanyAutomationDeadLetterItem,
  CompanyExecutionIntent,
  CompanyAutomationQueueItem,
  CompanyAutomationRun,
  ConnectorAuditEvent
} from "@/lib/domain";
import type { DurableStoreProvider } from "@/lib/durable-store-provider";
import { getDurableStoreSqlitePath } from "@/infrastructure/persistence/storage-paths";

type DurableStatement = {
  run: (...args: unknown[]) => unknown;
  all: (...args: unknown[]) => unknown[];
};

type DurableSqliteDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => DurableStatement;
};

type DurableStoreRecord = {
  id: string;
  companySlug?: string;
  timestamp?: string;
  payload: string;
};

const require = createRequire(import.meta.url);

let db: DurableSqliteDatabase | null = null;
let dbReady = false;

export const sqliteDurableStoreProvider: DurableStoreProvider = {
  name: "sqlite-local",
  isAvailable() {
    try {
      getDurableDb();
      return true;
    } catch {
      return false;
    }
  },
  getAutomationRuns(companySlug) {
    return readJsonRows<CompanyAutomationRun>("automation_runs", companySlug, "DESC");
  },
  upsertAutomationRun(run) {
    upsertJsonRow("automation_runs", {
      id: run.id,
      companySlug: run.companySlug,
      timestamp: run.startedAt,
      payload: JSON.stringify(run)
    });
  },
  getAutomationLocks(companySlug) {
    return readJsonRows<{
      companySlug: string;
      runId: string;
      actor: string;
      lockedAt: string;
      expiresAt: string;
    }>("automation_locks", companySlug, "DESC");
  },
  upsertAutomationLock(lock) {
    upsertJsonRow("automation_locks", {
      id: `${lock.companySlug}:${lock.runId}`,
      companySlug: lock.companySlug,
      timestamp: lock.lockedAt,
      payload: JSON.stringify(lock)
    });
  },
  removeAutomationLock(companySlug, runId) {
    const database = getDurableDb();
    if (runId) {
      database
        .prepare("DELETE FROM automation_locks WHERE company_slug = ? AND id = ?")
        .run(companySlug, `${companySlug}:${runId}`);
      return;
    }

    database.prepare("DELETE FROM automation_locks WHERE company_slug = ?").run(companySlug);
  },
  getAutomationQueue(companySlug) {
    return readJsonRows<CompanyAutomationQueueItem>("automation_queue", companySlug, "ASC");
  },
  upsertAutomationQueueItem(item) {
    upsertJsonRow("automation_queue", {
      id: item.id,
      companySlug: item.companySlug,
      timestamp: item.availableAt,
      payload: JSON.stringify(item)
    });
  },
  removeAutomationQueueItem(id) {
    getDurableDb().prepare("DELETE FROM automation_queue WHERE id = ?").run(id);
  },
  getAutomationDeadLetters(companySlug) {
    return readJsonRows<CompanyAutomationDeadLetterItem>(
      "automation_dead_letters",
      companySlug,
      "DESC"
    );
  },
  appendAutomationDeadLetter(item) {
    upsertJsonRow("automation_dead_letters", {
      id: item.id,
      companySlug: item.companySlug,
      timestamp: item.deadLetteredAt,
      payload: JSON.stringify(item)
    });
  },
  getExecutionIntents(companySlug) {
    return readJsonRows<CompanyExecutionIntent>("execution_intents", companySlug, "DESC");
  },
  upsertExecutionIntent(intent) {
    upsertJsonRow("execution_intents", {
      id: intent.id,
      companySlug: intent.companySlug,
      timestamp: intent.updatedAt,
      payload: JSON.stringify(intent)
    });
  },
  getConnectorCircuitBreakers(companySlug) {
    return readJsonRows<CompanyConnectorCircuitBreaker>(
      "connector_circuit_breakers",
      companySlug,
      "DESC"
    );
  },
  upsertConnectorCircuitBreaker(breaker) {
    upsertJsonRow("connector_circuit_breakers", {
      id: breaker.id,
      companySlug: breaker.companySlug,
      timestamp: breaker.updatedAt,
      payload: JSON.stringify(breaker)
    });
  },
  getAuditEvents(companySlug) {
    return readJsonRows<ConnectorAuditEvent>("audit_events", companySlug, "DESC");
  },
  appendAuditEvent(event) {
    upsertJsonRow("audit_events", {
      id: event.id,
      companySlug: extractCompanySlugFromAuditId(event.id),
      timestamp: event.timestamp,
      payload: JSON.stringify(event)
    });
  }
};

function readJsonRows<T>(
  tableName:
    | "automation_runs"
    | "automation_locks"
    | "automation_queue"
    | "automation_dead_letters"
    | "execution_intents"
    | "connector_circuit_breakers"
    | "audit_events",
  companySlug?: string,
  orderDirection: "ASC" | "DESC" = "DESC"
) {
  const database = getDurableDb();
  const query = companySlug
    ? `SELECT payload FROM ${tableName} WHERE company_slug = ? ORDER BY sort_timestamp ${orderDirection}`
    : `SELECT payload FROM ${tableName} ORDER BY sort_timestamp ${orderDirection}`;
  const rows = (companySlug
    ? database.prepare(query).all(companySlug)
    : database.prepare(query).all()) as Array<{ payload: string }>;

  return rows.map((row) => JSON.parse(row.payload) as T);
}

function upsertJsonRow(
  tableName:
    | "automation_runs"
    | "automation_locks"
    | "automation_queue"
    | "automation_dead_letters"
    | "execution_intents"
    | "connector_circuit_breakers"
    | "audit_events",
  record: DurableStoreRecord
) {
  const database = getDurableDb();
  database
    .prepare(
      `INSERT INTO ${tableName} (id, company_slug, sort_timestamp, payload)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         company_slug = excluded.company_slug,
         sort_timestamp = excluded.sort_timestamp,
         payload = excluded.payload`
    )
    .run(record.id, record.companySlug ?? null, record.timestamp ?? null, record.payload);
}

function getDurableDb() {
  if (db && dbReady) {
    return db;
  }

  const { dataDir, dbFile } = getDurableStoreSqlitePath();

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const sqliteModule = require("node:sqlite") as {
    DatabaseSync: new (path: string) => DurableSqliteDatabase;
  };
  db = new sqliteModule.DatabaseSync(dbFile);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec("PRAGMA busy_timeout = 5000;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS automation_runs (
      id TEXT PRIMARY KEY,
      company_slug TEXT,
      sort_timestamp TEXT,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS automation_locks (
      id TEXT PRIMARY KEY,
      company_slug TEXT,
      sort_timestamp TEXT,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS automation_queue (
      id TEXT PRIMARY KEY,
      company_slug TEXT,
      sort_timestamp TEXT,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS automation_dead_letters (
      id TEXT PRIMARY KEY,
      company_slug TEXT,
      sort_timestamp TEXT,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS execution_intents (
      id TEXT PRIMARY KEY,
      company_slug TEXT,
      sort_timestamp TEXT,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS connector_circuit_breakers (
      id TEXT PRIMARY KEY,
      company_slug TEXT,
      sort_timestamp TEXT,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      company_slug TEXT,
      sort_timestamp TEXT,
      payload TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_automation_runs_company_timestamp
      ON automation_runs (company_slug, sort_timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_automation_queue_company_timestamp
      ON automation_queue (company_slug, sort_timestamp ASC);
    CREATE INDEX IF NOT EXISTS idx_automation_dead_letters_company_timestamp
      ON automation_dead_letters (company_slug, sort_timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_execution_intents_company_timestamp
      ON execution_intents (company_slug, sort_timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_connector_circuit_breakers_company_timestamp
      ON connector_circuit_breakers (company_slug, sort_timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_events_company_timestamp
      ON audit_events (company_slug, sort_timestamp DESC);
  `);

  dbReady = true;
  return db;
}

function extractCompanySlugFromAuditId(auditId: string) {
  const match = auditId.match(/^audit-([^-]+)-/);
  return match?.[1];
}
