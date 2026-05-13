import path from "node:path";

export function getAgentDataDir() {
  const explicitDir = (process.env.AGENT_DATA_DIR ?? "").trim();
  if (explicitDir) {
    return explicitDir;
  }

  return path.join(/* turbopackIgnore: true */ process.cwd(), ".data");
}

export function getVaultPaths() {
  const dataDir = getAgentDataDir();

  return {
    dataDir,
    vaultFile: path.join(dataDir, "company-agent.vault"),
    vaultBackupFile: path.join(dataDir, "company-agent.vault.bak"),
    vaultTempFile: path.join(dataDir, "company-agent.vault.tmp")
  };
}

export function getDurableStoreSqlitePath() {
  const dataDir = getAgentDataDir();

  return {
    dataDir,
    dbFile: path.join(dataDir, "agent-lion-durable.sqlite")
  };
}

export function getDurableStoreJsonPaths() {
  const dataDir = getAgentDataDir();

  return {
    dataDir,
    storeFile: path.join(dataDir, "agent-lion-durable.local.json"),
    storeBackupFile: path.join(dataDir, "agent-lion-durable.local.json.bak"),
    storeTempFile: path.join(dataDir, "agent-lion-durable.local.json.tmp")
  };
}

export function getTenantSecretsPaths() {
  const dataDir = getAgentDataDir();

  return {
    dataDir,
    secretsFile: path.join(dataDir, "company-agent.secrets.vault"),
    secretsBackupFile: path.join(dataDir, "company-agent.secrets.vault.bak"),
    secretsTempFile: path.join(dataDir, "company-agent.secrets.vault.tmp")
  };
}

export function getObservabilityDeliveryPaths() {
  const dataDir = getAgentDataDir();

  return {
    dataDir,
    deliveryFile: path.join(dataDir, "agent-lion-observability.json"),
    deliveryBackupFile: path.join(dataDir, "agent-lion-observability.json.bak"),
    deliveryTempFile: path.join(dataDir, "agent-lion-observability.json.tmp")
  };
}

export function getWorkerHeartbeatPaths() {
  const dataDir = getAgentDataDir();

  return {
    dataDir,
    heartbeatFile: path.join(dataDir, "agent-lion-worker-heartbeats.json"),
    heartbeatBackupFile: path.join(dataDir, "agent-lion-worker-heartbeats.json.bak"),
    heartbeatTempFile: path.join(dataDir, "agent-lion-worker-heartbeats.json.tmp")
  };
}
