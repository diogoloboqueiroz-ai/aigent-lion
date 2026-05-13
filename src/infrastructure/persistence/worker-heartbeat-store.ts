import {
  readPlainJsonFile,
  writePlainJsonFile
} from "@/infrastructure/persistence/company-vault-storage";
import {
  isManagedAutomationStoreConfigured,
  listManagedWorkerHeartbeats,
  upsertManagedWorkerHeartbeat
} from "@/infrastructure/persistence/managed-automation-store";
import { getWorkerHeartbeatPaths } from "@/infrastructure/persistence/storage-paths";
import type { CompanyAutomationWorkerHeartbeat } from "@/lib/domain";

type WorkerHeartbeatPayload = {
  heartbeats: CompanyAutomationWorkerHeartbeat[];
};

const EMPTY_PAYLOAD: WorkerHeartbeatPayload = {
  heartbeats: []
};

export async function listAgentWorkerHeartbeats(companySlug?: string) {
  if (isManagedAutomationStoreConfigured()) {
    return listManagedWorkerHeartbeats(companySlug);
  }

  return listLocalAgentWorkerHeartbeats(companySlug);
}

export async function upsertAgentWorkerHeartbeat(
  heartbeat: CompanyAutomationWorkerHeartbeat
) {
  upsertLocalAgentWorkerHeartbeat(heartbeat);

  if (isManagedAutomationStoreConfigured()) {
    await upsertManagedWorkerHeartbeat(heartbeat);
  }
}

export function listLocalAgentWorkerHeartbeats(companySlug?: string) {
  const payload = readWorkerHeartbeatPayload();
  const filtered = companySlug
    ? payload.heartbeats.filter((entry) => !entry.companySlug || entry.companySlug === companySlug)
    : payload.heartbeats;

  return [...filtered].sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt));
}

function upsertLocalAgentWorkerHeartbeat(heartbeat: CompanyAutomationWorkerHeartbeat) {
  const payload = readWorkerHeartbeatPayload();
  const nextHeartbeats = payload.heartbeats.filter((entry) => entry.id !== heartbeat.id);

  nextHeartbeats.unshift(heartbeat);
  writeWorkerHeartbeatPayload({
    heartbeats: nextHeartbeats
      .sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt))
      .slice(0, 250)
  });
}

function readWorkerHeartbeatPayload() {
  const { heartbeatFile, heartbeatBackupFile } = getWorkerHeartbeatPaths();
  return (
    readPlainJsonFile<WorkerHeartbeatPayload>({
      candidateFiles: [heartbeatFile, heartbeatBackupFile]
    }) ?? { ...EMPTY_PAYLOAD }
  );
}

function writeWorkerHeartbeatPayload(payload: WorkerHeartbeatPayload) {
  const { dataDir, heartbeatFile, heartbeatBackupFile, heartbeatTempFile } =
    getWorkerHeartbeatPaths();
  writePlainJsonFile({
    dataDir,
    targetFile: heartbeatFile,
    backupFile: heartbeatBackupFile,
    tempFile: heartbeatTempFile,
    payload: JSON.stringify(payload, null, 2)
  });
}
