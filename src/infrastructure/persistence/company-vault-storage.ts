import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";

type ReadEncryptedJsonFileInput = {
  secret?: string;
  candidateFiles: string[];
};

type WriteEncryptedJsonFileInput = {
  secret?: string;
  dataDir: string;
  targetFile: string;
  backupFile: string;
  tempFile: string;
  payload: string;
};

export function readEncryptedJsonFile(input: ReadEncryptedJsonFileInput) {
  if (!input.secret?.trim()) {
    return null;
  }

  for (const filePath of input.candidateFiles.filter((candidate) => existsSync(candidate))) {
    try {
      const encrypted = readFileSync(filePath, "utf8");
      return decryptWithSecret(encrypted, input.secret);
    } catch {
      continue;
    }
  }

  return null;
}

export function writeEncryptedJsonFile(input: WriteEncryptedJsonFileInput) {
  const secret = input.secret?.trim();
  if (!secret) {
    throw new Error("VAULT_ENCRYPTION_KEY ausente");
  }

  if (!existsSync(input.dataDir)) {
    mkdirSync(input.dataDir, { recursive: true });
  }

  const encrypted = encryptWithSecret(input.payload, secret);
  writeFileSync(input.tempFile, encrypted, "utf8");

  if (existsSync(input.targetFile)) {
    copyFileSync(input.targetFile, input.backupFile);
  }

  renameSync(input.tempFile, input.targetFile);

  if (existsSync(input.tempFile)) {
    unlinkSync(input.tempFile);
  }
}

export function readPlainJsonFile<T>(input: { candidateFiles: string[] }) {
  for (const filePath of input.candidateFiles.filter((candidate) => existsSync(candidate))) {
    try {
      return JSON.parse(readFileSync(filePath, "utf8")) as T;
    } catch {
      continue;
    }
  }

  return null;
}

export function writePlainJsonFile(input: {
  dataDir: string;
  targetFile: string;
  backupFile: string;
  tempFile: string;
  payload: string;
}) {
  if (!existsSync(input.dataDir)) {
    mkdirSync(input.dataDir, { recursive: true });
  }

  writeFileSync(input.tempFile, input.payload, "utf8");

  if (existsSync(input.targetFile)) {
    copyFileSync(input.targetFile, input.backupFile);
  }

  renameSync(input.tempFile, input.targetFile);

  if (existsSync(input.tempFile)) {
    unlinkSync(input.tempFile);
  }
}

function encryptWithSecret(payload: string, secret: string) {
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString("base64url"),
    tag: tag.toString("base64url"),
    content: encrypted.toString("base64url")
  });
}

function decryptWithSecret(value: string, secret: string) {
  const key = createHash("sha256").update(secret).digest();
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
