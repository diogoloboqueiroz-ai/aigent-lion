import { getCompanyWorkspaces } from "../lib/connectors";
import { drainAgentWorkerQueue } from "../lib/agents/queue-processor";
import { getAgentExecutionPlaneMode } from "../lib/agents/execution-plane";
import {
  getAutomationStoreConfigurationError,
  getAutomationStoreDisplayName
} from "../infrastructure/persistence/automation-store-mode";
import {
  checkManagedAutomationStoreSchema,
  closeManagedAutomationStorePool
} from "../infrastructure/persistence/managed-automation-store";
import { upsertAgentWorkerHeartbeat } from "../infrastructure/persistence/worker-heartbeat-store";
import { assertObservabilityCollectorProductionReady } from "../core/observability/collector-forwarding";
import type {
  CompanyAutomationWorkerHeartbeat,
  CompanyAutomationWorkerHeartbeatStatus
} from "../lib/domain";

const args = new Set(process.argv.slice(2));
const once = args.has("--once");
const companyArg = process.argv.find((value) => value.startsWith("--company="));
const limitArg = process.argv.find((value) => value.startsWith("--limit="));
const intervalArg = process.argv.find((value) => value.startsWith("--interval-ms="));

const companySlug = companyArg ? companyArg.split("=")[1]?.trim() : "";
const limit = Number(limitArg ? limitArg.split("=")[1] : "2");
const intervalMs = Number(intervalArg ? intervalArg.split("=")[1] : "15000");
const actor = "agent-worker:external";
const workerStartedAt = new Date().toISOString();
const workerId =
  process.env.AGENT_WORKER_ID?.trim() ||
  `agent-worker-${process.pid}-${workerStartedAt.replace(/[^0-9]/g, "")}`;

async function main() {
  const storeConfigurationError = getAutomationStoreConfigurationError();
  if (storeConfigurationError) {
    throw new Error(storeConfigurationError);
  }
  assertObservabilityCollectorProductionReady();

  const schemaCheck = getAutomationStoreDisplayName() === "postgres-managed"
    ? await checkManagedAutomationStoreSchema({ ensure: true })
    : null;
  if (schemaCheck && !schemaCheck.ok) {
    throw new Error(
      `Managed automation store schema incompleto: missingTables=${schemaCheck.missingTables.join(",") || "none"} missingIndexes=${schemaCheck.missingIndexes.join(",") || "none"}`
    );
  }

  await recordHeartbeat({
    status: "starting",
    metadata: schemaCheck
      ? {
          storeSchema: schemaCheck.schema,
          storeCheckedAt: schemaCheck.checkedAt
        }
      : {
          storeSchema: "local-json",
          storeCheckedAt: new Date().toISOString()
        }
  });

  console.log(
    `[agent-worker] worker=${workerId} mode=${getAgentExecutionPlaneMode()} store=${getAutomationStoreDisplayName()} once=${once} company=${companySlug || "all"} limit=${limit}`
  );

  if (once) {
    await drainConfiguredCompanies();
    await recordHeartbeat({ status: "idle" });
    return;
  }

  while (true) {
    await drainConfiguredCompanies();
    await recordHeartbeat({ status: "idle" });
    await sleep(intervalMs);
  }
}

async function drainConfiguredCompanies() {
  const companySlugs = companySlug
    ? [companySlug]
    : Array.from(new Set(getCompanyWorkspaces().map((workspace) => workspace.company.slug)));

  for (const slug of companySlugs) {
    await recordHeartbeat({
      companySlug: slug,
      status: "running"
    });
    const drain = await drainAgentWorkerQueue({
      companySlug: slug,
      actor,
      executionContext: "worker",
      requestOrigin: "worker://agent-lion",
      fallbackRecipientEmail: "worker@agent-lion.local",
      limit: Number.isFinite(limit) && limit > 0 ? limit : 2
    });

    if (drain.processed > 0) {
      console.log(
        `[agent-worker] company=${slug} processed=${drain.processed} completed=${drain.completed} requeued=${drain.requeued} dead=${drain.deadLettered}${drain.lastCompletedRunId ? ` lastRun=${drain.lastCompletedRunId}` : ""}`
      );
    }

    await recordHeartbeat({
      companySlug: slug,
      status: "idle",
      processed: drain.processed,
      completed: drain.completed,
      requeued: drain.requeued,
      deadLettered: drain.deadLettered,
      lastCompletedRunId: drain.lastCompletedRunId
    });
  }
}

async function recordHeartbeat(input: {
  companySlug?: string;
  status: CompanyAutomationWorkerHeartbeatStatus;
  processed?: number;
  completed?: number;
  requeued?: number;
  deadLettered?: number;
  lastCompletedRunId?: string;
  lastError?: string;
  metadata?: Record<string, string>;
}) {
  const heartbeat: CompanyAutomationWorkerHeartbeat = {
    id: `${workerId}:${input.companySlug ?? "global"}`,
    workerId,
    companySlug: input.companySlug,
    status: input.status,
    executionPlane: getAgentExecutionPlaneMode(),
    storeProvider: getAutomationStoreDisplayName(),
    startedAt: workerStartedAt,
    lastSeenAt: new Date().toISOString(),
    intervalMs,
    processed: input.processed ?? 0,
    completed: input.completed ?? 0,
    requeued: input.requeued ?? 0,
    deadLettered: input.deadLettered ?? 0,
    lastCompletedRunId: input.lastCompletedRunId,
    lastError: input.lastError,
    metadata: input.metadata
  };

  await upsertAgentWorkerHeartbeat(heartbeat);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main()
  .catch(async (error) => {
    const message = error instanceof Error ? error.message : "Erro desconhecido no worker.";
    console.error("[agent-worker] fatal", error);
    await recordHeartbeat({
      status: "error",
      lastError: message
    }).catch(() => undefined);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (once || process.exitCode) {
      await closeManagedAutomationStorePool();
    }
  });
