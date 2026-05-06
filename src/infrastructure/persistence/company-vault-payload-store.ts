import {
  createEmptyVaultPayload,
  normalizeVaultPayload,
  type VaultPayload
} from "@/infrastructure/persistence/company-vault-schema";
import {
  readEncryptedJsonFile,
  writeEncryptedJsonFile
} from "@/infrastructure/persistence/company-vault-storage";
import { getVaultPaths } from "@/infrastructure/persistence/storage-paths";

export function getCompanyVaultSecret() {
  return process.env.VAULT_ENCRYPTION_KEY;
}

export function isCompanyVaultConfigured() {
  return Boolean(getCompanyVaultSecret());
}

export function readCompanyVaultPayload(): VaultPayload {
  if (!isCompanyVaultConfigured()) {
    return createEmptyVaultPayload();
  }

  const { vaultFile, vaultBackupFile } = getVaultPaths();
  const decrypted = readEncryptedJsonFile({
    secret: getCompanyVaultSecret(),
    candidateFiles: [vaultFile, vaultBackupFile]
  });

  if (decrypted) {
    const parsed = JSON.parse(decrypted) as Partial<VaultPayload> & Record<string, unknown>;
    const normalized = normalizeVaultPayload(parsed);

    if (normalized.migratedLegacySecrets) {
      writeCompanyVaultPayload(normalized.payload);
    }

    return normalized.payload;
  }

  return createEmptyVaultPayload();
}

export function writeCompanyVaultPayload(payload: VaultPayload) {
  const { dataDir, vaultFile, vaultBackupFile, vaultTempFile } = getVaultPaths();
  writeEncryptedJsonFile({
    secret: getCompanyVaultSecret(),
    dataDir,
    targetFile: vaultFile,
    backupFile: vaultBackupFile,
    tempFile: vaultTempFile,
    payload: JSON.stringify(payload, null, 2)
  });
}
