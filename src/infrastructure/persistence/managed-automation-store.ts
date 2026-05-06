import { Pool } from "pg";
import type {
  CompanyAutomationDeadLetterItem,
  CompanyAutomationQueueItem,
  CompanyAutomationRun,
  CompanyAutomationWorkerHeartbeat,
  CompanyConnectorCircuitBreaker,
  CompanyExecutionIntent,
  ConnectorAuditEvent
} from "@/lib/domain";
import type { DurableAutomationLock } from "@/lib/durable-store-provider";
import {
  getAutomationStoreDisplayName,
  hasManagedAutomationStoreConnection,
  isManagedAutomationStoreConfigured as resolveManagedAutomationStoreConfigured
} from "@/infrastructure/persistence/automation-store-mode";

export function isManagedAutomationStoreConfigured() {
  return resolveManagedAutomationStoreConfigured();
}

type ManagedAutomationRecord<T> = {
  id: string;
  companySlug?: string;
  timestamp?: string;
  payload: T;
};

type ManagedAutomationTable =
  | "automation_runs"
  | "automation_locks"
  | "automation_queue"
  | "automation_dead_letters"
  | "execution_intents"
  | "connector_circuit_breakers"
  | "worker_heartbeats"
  | "audit_events";

const MANAGED_SCHEMA = "agent_lion";
const TABLE_ORDER: Record<ManagedAutomationTable, "ASC" | "DESC"> = {
  automation_runs: "DESC",
  automation_locks: "DESC",
  automation_queue: "ASC",
  automation_dead_letters: "DESC",
  execution_intents: "DESC",
  connector_circuit_breakers: "DESC",
  worker_heartbeats: "DESC",
  audit_events: "DESC"
};

const EXPECTED_TABLES: ManagedAutomationTable[] = [
  "automation_runs",
  "automation_locks",
  "automation_queue",
  "automation_dead_letters",
  "execution_intents",
  "connector_circuit_breakers",
  "worker_heartbeats",
  "audit_events"
];

const EXPECTED_INDEXES = [
  "idx_agent_lion_runs_company_timestamp",
  "idx_agent_lion_queue_company_timestamp",
  "idx_agent_lion_dead_letters_company_timestamp",
  "idx_agent_lion_intents_company_timestamp",
  "idx_agent_lion_breakers_company_timestamp",
  "idx_agent_lion_worker_heartbeats_company_timestamp",
  "idx_agent_lion_audit_company_timestamp"
];

let pool: Pool | null = null;
let schemaReadyPromise: Promise<void> | null = null;

export function getManagedAutomationStoreName() {
  return isManagedAutomationStoreConfigured() ? getAutomationStoreDisplayName() : "disabled";
}

export async function listManagedAutomationRuns(companySlug?: string) {
  return readManagedRows<CompanyAutomationRun>("automation_runs", companySlug);
}

export async function upsertManagedAutomationRun(run: CompanyAutomationRun) {
  await upsertManagedRow("automation_runs", {
    id: run.id,
    companySlug: run.companySlug,
    timestamp: run.startedAt,
    payload: run
  });
}

export async function listManagedAutomationLocks(companySlug?: string) {
  return readManagedRows<DurableAutomationLock>("automation_locks", companySlug);
}

export async function upsertManagedAutomationLock(lock: DurableAutomationLock) {
  await upsertManagedRow("automation_locks", {
    id: `${lock.companySlug}:${lock.runId}`,
    companySlug: lock.companySlug,
    timestamp: lock.lockedAt,
    payload: lock
  });
}

export async function removeManagedAutomationLock(companySlug: string, runId?: string) {
  const activePool = await getManagedPool();

  if (runId) {
    await activePool.query(
      `DELETE FROM ${MANAGED_SCHEMA}.automation_locks WHERE company_slug = $1 AND id = $2`,
      [companySlug, `${companySlug}:${runId}`]
    );
    return;
  }

  await activePool.query(
    `DELETE FROM ${MANAGED_SCHEMA}.automation_locks WHERE company_slug = $1`,
    [companySlug]
  );
}

export async function listManagedAutomationQueue(companySlug?: string) {
  return readManagedRows<CompanyAutomationQueueItem>("automation_queue", companySlug);
}

export async function findManagedAutomationQueueItemByIdempotencyKey(input: {
  companySlug: string;
  kind: CompanyAutomationQueueItem["kind"];
  idempotencyKey: string;
}) {
  const activePool = await getManagedPool();
  const result = await activePool.query<{ payload: CompanyAutomationQueueItem }>(
    `SELECT payload
       FROM ${MANAGED_SCHEMA}.automation_queue
      WHERE company_slug = $1
        AND payload->>'kind' = $2
        AND payload->>'idempotencyKey' = $3
        AND payload->>'status' <> 'dead_letter'
      ORDER BY sort_timestamp ASC
      LIMIT 1`,
    [input.companySlug, input.kind, input.idempotencyKey]
  );

  return result.rows[0]?.payload;
}

export async function upsertManagedAutomationQueueItem(item: CompanyAutomationQueueItem) {
  await upsertManagedRow("automation_queue", {
    id: item.id,
    companySlug: item.companySlug,
    timestamp: item.availableAt,
    payload: item
  });
}

export async function removeManagedAutomationQueueItem(id: string) {
  const activePool = await getManagedPool();
  await activePool.query(`DELETE FROM ${MANAGED_SCHEMA}.automation_queue WHERE id = $1`, [id]);
}

export async function listManagedAutomationDeadLetters(companySlug?: string) {
  return readManagedRows<CompanyAutomationDeadLetterItem>("automation_dead_letters", companySlug);
}

export async function appendManagedAutomationDeadLetter(item: CompanyAutomationDeadLetterItem) {
  await upsertManagedRow("automation_dead_letters", {
    id: item.id,
    companySlug: item.companySlug,
    timestamp: item.deadLetteredAt,
    payload: item
  });
}

export async function listManagedExecutionIntents(companySlug?: string) {
  return readManagedRows<CompanyExecutionIntent>("execution_intents", companySlug);
}

export async function upsertManagedExecutionIntent(intent: CompanyExecutionIntent) {
  await upsertManagedRow("execution_intents", {
    id: intent.id,
    companySlug: intent.companySlug,
    timestamp: intent.updatedAt,
    payload: intent
  });
}

export async function listManagedConnectorCircuitBreakers(companySlug?: string) {
  return readManagedRows<CompanyConnectorCircuitBreaker>(
    "connector_circuit_breakers",
    companySlug
  );
}

export async function upsertManagedConnectorCircuitBreaker(
  breaker: CompanyConnectorCircuitBreaker
) {
  await upsertManagedRow("connector_circuit_breakers", {
    id: breaker.id,
    companySlug: breaker.companySlug,
    timestamp: breaker.updatedAt,
    payload: breaker
  });
}

export async function listManagedWorkerHeartbeats(companySlug?: string) {
  return readManagedRows<CompanyAutomationWorkerHeartbeat>("worker_heartbeats", companySlug);
}

export async function upsertManagedWorkerHeartbeat(heartbeat: CompanyAutomationWorkerHeartbeat) {
  await upsertManagedRow("worker_heartbeats", {
    id: heartbeat.id,
    companySlug: heartbeat.companySlug,
    timestamp: heartbeat.lastSeenAt,
    payload: heartbeat
  });
}

export async function listManagedAuditEvents(companySlug?: string) {
  return readManagedRows<ConnectorAuditEvent>("audit_events", companySlug);
}

export async function appendManagedAuditEvent(event: ConnectorAuditEvent) {
  await upsertManagedRow("audit_events", {
    id: event.id,
    companySlug: extractCompanySlugFromAuditId(event.id),
    timestamp: event.timestamp,
    payload: event
  });
}

export type ManagedAutomationSchemaCheck = {
  ok: boolean;
  schema: string;
  store: string;
  checkedAt: string;
  missingTables: string[];
  missingIndexes: string[];
  configurationError?: string;
};

export async function checkManagedAutomationStoreSchema(input?: {
  ensure?: boolean;
}): Promise<ManagedAutomationSchemaCheck> {
  const checkedAt = new Date().toISOString();

  if (!hasManagedAutomationStoreConnection()) {
    return {
      ok: false,
      schema: MANAGED_SCHEMA,
      store: getManagedAutomationStoreName(),
      checkedAt,
      missingTables: [...EXPECTED_TABLES],
      missingIndexes: [...EXPECTED_INDEXES],
      configurationError: "DATABASE_URL ausente para o managed automation store."
    };
  }

  const activePool = await getManagedPool({ ensureSchema: input?.ensure !== false });
  if (input?.ensure !== false) {
    await ensureManagedSchema(activePool);
  }

  const tablesResult = await activePool.query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = $1
        AND table_type = 'BASE TABLE'`,
    [MANAGED_SCHEMA]
  );
  const indexesResult = await activePool.query<{ indexname: string }>(
    `SELECT indexname
       FROM pg_indexes
      WHERE schemaname = $1`,
    [MANAGED_SCHEMA]
  );
  const existingTables = new Set(tablesResult.rows.map((row) => row.table_name));
  const existingIndexes = new Set(indexesResult.rows.map((row) => row.indexname));
  const missingTables = EXPECTED_TABLES.filter((table) => !existingTables.has(table));
  const missingIndexes = EXPECTED_INDEXES.filter((indexName) => !existingIndexes.has(indexName));

  return {
    ok: missingTables.length === 0 && missingIndexes.length === 0,
    schema: MANAGED_SCHEMA,
    store: getManagedAutomationStoreName(),
    checkedAt,
    missingTables,
    missingIndexes
  };
}

export async function closeManagedAutomationStorePool() {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = null;
  schemaReadyPromise = null;
}

async function readManagedRows<T>(table: ManagedAutomationTable, companySlug?: string) {
  const activePool = await getManagedPool();
  const order = TABLE_ORDER[table];
  const result = companySlug
    ? await activePool.query<{ payload: T }>(
        `SELECT payload
           FROM ${MANAGED_SCHEMA}.${table}
          WHERE company_slug = $1
          ORDER BY sort_timestamp ${order}`,
        [companySlug]
      )
    : await activePool.query<{ payload: T }>(
        `SELECT payload
           FROM ${MANAGED_SCHEMA}.${table}
          ORDER BY sort_timestamp ${order}`
      );

  return result.rows.map((row) => row.payload);
}

async function upsertManagedRow<T>(
  table: ManagedAutomationTable,
  record: ManagedAutomationRecord<T>
) {
  const activePool = await getManagedPool();
  await activePool.query(
    `INSERT INTO ${MANAGED_SCHEMA}.${table} (id, company_slug, sort_timestamp, payload)
     VALUES ($1, $2, $3::timestamptz, $4::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       company_slug = EXCLUDED.company_slug,
       sort_timestamp = EXCLUDED.sort_timestamp,
       payload = EXCLUDED.payload`,
    [
      record.id,
      record.companySlug ?? null,
      record.timestamp ?? new Date().toISOString(),
      JSON.stringify(record.payload)
    ]
  );
}

async function getManagedPool(input?: { ensureSchema?: boolean }) {
  if (!hasManagedAutomationStoreConnection()) {
    throw new Error("DATABASE_URL ausente para o managed automation store.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: resolveManagedStoreSsl()
    });
  }

  if (input?.ensureSchema !== false && !schemaReadyPromise) {
    schemaReadyPromise = ensureManagedSchema(pool);
  }

  if (input?.ensureSchema !== false) {
    await schemaReadyPromise;
  }
  return pool;
}

function resolveManagedStoreSsl() {
  const mode = (process.env.DATABASE_SSL_MODE ?? "").trim().toLowerCase();

  if (mode === "disable") {
    return false;
  }

  if (mode === "require") {
    return {
      rejectUnauthorized: false
    };
  }

  return process.env.NODE_ENV === "production"
    ? {
        rejectUnauthorized: false
      }
    : false;
}

async function ensureManagedSchema(activePool: Pool) {
  await activePool.query(`CREATE SCHEMA IF NOT EXISTS ${MANAGED_SCHEMA}`);
  await activePool.query(`
    CREATE TABLE IF NOT EXISTS ${MANAGED_SCHEMA}.automation_runs (
      id TEXT PRIMARY KEY,
      company_slug TEXT,
      sort_timestamp TIMESTAMPTZ,
      payload JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ${MANAGED_SCHEMA}.automation_locks (
      id TEXT PRIMARY KEY,
      company_slug TEXT,
      sort_timestamp TIMESTAMPTZ,
      payload JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ${MANAGED_SCHEMA}.automation_queue (
      id TEXT PRIMARY KEY,
      company_slug TEXT,
      sort_timestamp TIMESTAMPTZ,
      payload JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ${MANAGED_SCHEMA}.automation_dead_letters (
      id TEXT PRIMARY KEY,
      company_slug TEXT,
      sort_timestamp TIMESTAMPTZ,
      payload JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ${MANAGED_SCHEMA}.execution_intents (
      id TEXT PRIMARY KEY,
      company_slug TEXT,
      sort_timestamp TIMESTAMPTZ,
      payload JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ${MANAGED_SCHEMA}.connector_circuit_breakers (
      id TEXT PRIMARY KEY,
      company_slug TEXT,
      sort_timestamp TIMESTAMPTZ,
      payload JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ${MANAGED_SCHEMA}.worker_heartbeats (
      id TEXT PRIMARY KEY,
      company_slug TEXT,
      sort_timestamp TIMESTAMPTZ,
      payload JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ${MANAGED_SCHEMA}.audit_events (
      id TEXT PRIMARY KEY,
      company_slug TEXT,
      sort_timestamp TIMESTAMPTZ,
      payload JSONB NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_agent_lion_runs_company_timestamp
      ON ${MANAGED_SCHEMA}.automation_runs (company_slug, sort_timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_lion_queue_company_timestamp
      ON ${MANAGED_SCHEMA}.automation_queue (company_slug, sort_timestamp ASC);
    CREATE INDEX IF NOT EXISTS idx_agent_lion_dead_letters_company_timestamp
      ON ${MANAGED_SCHEMA}.automation_dead_letters (company_slug, sort_timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_lion_intents_company_timestamp
      ON ${MANAGED_SCHEMA}.execution_intents (company_slug, sort_timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_lion_breakers_company_timestamp
      ON ${MANAGED_SCHEMA}.connector_circuit_breakers (company_slug, sort_timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_lion_worker_heartbeats_company_timestamp
      ON ${MANAGED_SCHEMA}.worker_heartbeats (company_slug, sort_timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_lion_audit_company_timestamp
      ON ${MANAGED_SCHEMA}.audit_events (company_slug, sort_timestamp DESC);
  `);
}

function extractCompanySlugFromAuditId(auditId: string) {
  const match = auditId.match(/^audit-([^-]+)-/);
  return match?.[1];
}
