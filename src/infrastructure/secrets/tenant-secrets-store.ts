import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import type { PlatformId, SocialPlatformId } from "@/lib/domain";
import { getTenantSecretsPaths } from "@/infrastructure/persistence/storage-paths";

export type StoredGoogleCompanyConnectionSecret = {
  companySlug: string;
  platform: PlatformId;
  accessToken: string;
  refreshToken?: string;
  updatedAt: string;
};

export type StoredSocialCompanyConnectionSecret = {
  companySlug: string;
  platform: SocialPlatformId;
  accessToken: string;
  refreshToken?: string;
  updatedAt: string;
};

export type StoredCompanyCrmConnectionSecret = {
  companySlug: string;
  provider: "hubspot";
  accessToken: string;
  updatedAt: string;
};

export type StoredCompanySiteCmsSecret = {
  companySlug: string;
  provider: "wordpress";
  appPassword: string;
  updatedAt: string;
};

export type StoredCompanyTrackingSecret = {
  companySlug: string;
  ga4ApiSecret?: string;
  metaAccessToken?: string;
  updatedAt: string;
};

type TenantSecretsPayload = {
  googleConnections: StoredGoogleCompanyConnectionSecret[];
  socialConnections: StoredSocialCompanyConnectionSecret[];
  crmConnections: StoredCompanyCrmConnectionSecret[];
  siteCmsConnections: StoredCompanySiteCmsSecret[];
  trackingCredentials: StoredCompanyTrackingSecret[];
};

function getSecretsEncryptionSecret() {
  return process.env.SECRETS_ENCRYPTION_KEY || process.env.VAULT_ENCRYPTION_KEY;
}

function getSecretsKey() {
  const secret = getSecretsEncryptionSecret();
  if (!secret) return null;
  return createHash("sha256").update(secret).digest();
}

export function isTenantSecretsStoreConfigured() {
  return Boolean(getSecretsEncryptionSecret());
}

function ensureDataDir() {
  const { dataDir } = getTenantSecretsPaths();
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

function createEmptyPayload(): TenantSecretsPayload {
  return {
    googleConnections: [],
    socialConnections: [],
    crmConnections: [],
    siteCmsConnections: [],
    trackingCredentials: []
  };
}

function encrypt(text: string) {
  const key = getSecretsKey();
  if (!key) {
    throw new Error("SECRETS_ENCRYPTION_KEY ausente");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString("base64url"),
    tag: tag.toString("base64url"),
    content: encrypted.toString("base64url")
  });
}

function decrypt(value: string) {
  const key = getSecretsKey();
  if (!key) {
    throw new Error("SECRETS_ENCRYPTION_KEY ausente");
  }

  const parsed = JSON.parse(value) as {
    iv: string;
    tag: string;
    content: string;
  };

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(parsed.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(parsed.tag, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parsed.content, "base64url")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}

function readSecretsPayload(): TenantSecretsPayload {
  if (!isTenantSecretsStoreConfigured()) {
    return createEmptyPayload();
  }

  const { secretsFile, secretsBackupFile } = getTenantSecretsPaths();
  const candidateFiles = [secretsFile, secretsBackupFile].filter((filePath) => existsSync(filePath));
  for (const filePath of candidateFiles) {
    try {
      const encrypted = readFileSync(filePath, "utf8");
      const parsed = JSON.parse(decrypt(encrypted)) as Partial<TenantSecretsPayload>;
      return {
        googleConnections: parsed.googleConnections ?? [],
        socialConnections: parsed.socialConnections ?? [],
        crmConnections: parsed.crmConnections ?? [],
        siteCmsConnections: parsed.siteCmsConnections ?? [],
        trackingCredentials: parsed.trackingCredentials ?? []
      };
    } catch {
      continue;
    }
  }

  return createEmptyPayload();
}

function writeSecretsPayload(payload: TenantSecretsPayload) {
  ensureDataDir();
  const { secretsFile, secretsBackupFile, secretsTempFile } = getTenantSecretsPaths();
  const encrypted = encrypt(JSON.stringify(payload, null, 2));

  writeFileSync(secretsTempFile, encrypted, "utf8");

  if (existsSync(secretsFile)) {
    copyFileSync(secretsFile, secretsBackupFile);
  }

  renameSync(secretsTempFile, secretsFile);

  if (existsSync(secretsTempFile)) {
    unlinkSync(secretsTempFile);
  }
}

export function getStoredGoogleCompanyConnectionSecret(companySlug: string, platform: PlatformId) {
  return readSecretsPayload().googleConnections.find(
    (entry) => entry.companySlug === companySlug && entry.platform === platform
  );
}

export function upsertStoredGoogleCompanyConnectionSecret(secret: StoredGoogleCompanyConnectionSecret) {
  const payload = readSecretsPayload();
  const next = payload.googleConnections.filter(
    (entry) => !(entry.companySlug === secret.companySlug && entry.platform === secret.platform)
  );
  next.push(secret);
  writeSecretsPayload({
    ...payload,
    googleConnections: next
  });
}

export function getStoredSocialCompanyConnectionSecret(companySlug: string, platform: SocialPlatformId) {
  return readSecretsPayload().socialConnections.find(
    (entry) => entry.companySlug === companySlug && entry.platform === platform
  );
}

export function upsertStoredSocialCompanyConnectionSecret(secret: StoredSocialCompanyConnectionSecret) {
  const payload = readSecretsPayload();
  const next = payload.socialConnections.filter(
    (entry) => !(entry.companySlug === secret.companySlug && entry.platform === secret.platform)
  );
  next.push(secret);
  writeSecretsPayload({
    ...payload,
    socialConnections: next
  });
}

export function getStoredCompanyCrmConnectionSecret(
  companySlug: string,
  provider: StoredCompanyCrmConnectionSecret["provider"]
) {
  return readSecretsPayload().crmConnections.find(
    (entry) => entry.companySlug === companySlug && entry.provider === provider
  );
}

export function upsertStoredCompanyCrmConnectionSecret(secret: StoredCompanyCrmConnectionSecret) {
  const payload = readSecretsPayload();
  const next = payload.crmConnections.filter(
    (entry) => !(entry.companySlug === secret.companySlug && entry.provider === secret.provider)
  );
  next.push(secret);
  writeSecretsPayload({
    ...payload,
    crmConnections: next
  });
}

export function getStoredCompanySiteCmsSecret(
  companySlug: string,
  provider: StoredCompanySiteCmsSecret["provider"]
) {
  return readSecretsPayload().siteCmsConnections.find(
    (entry) => entry.companySlug === companySlug && entry.provider === provider
  );
}

export function upsertStoredCompanySiteCmsSecret(secret: StoredCompanySiteCmsSecret) {
  const payload = readSecretsPayload();
  const next = payload.siteCmsConnections.filter(
    (entry) => !(entry.companySlug === secret.companySlug && entry.provider === secret.provider)
  );
  next.push(secret);
  writeSecretsPayload({
    ...payload,
    siteCmsConnections: next
  });
}

export function getStoredCompanyTrackingSecret(companySlug: string) {
  return readSecretsPayload().trackingCredentials.find((entry) => entry.companySlug === companySlug);
}

export function upsertStoredCompanyTrackingSecret(secret: StoredCompanyTrackingSecret) {
  const payload = readSecretsPayload();
  const next = payload.trackingCredentials.filter((entry) => entry.companySlug !== secret.companySlug);
  next.push(secret);
  writeSecretsPayload({
    ...payload,
    trackingCredentials: next
  });
}
