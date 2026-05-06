import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "super_agencia_session";
const GOOGLE_STATE_COOKIE = "super_agencia_google_state";
const GOOGLE_CONNECT_STATE_COOKIE = "super_agencia_google_connect_state";
const SOCIAL_CONNECT_STATE_COOKIE = "super_agencia_social_connect_state";

export type UserSession = {
  provider: "google";
  sub: string;
  email: string;
  name: string;
  picture?: string;
};

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getSessionSecretFromEnv() {
  const raw = process.env.AUTH_SESSION_SECRET?.trim();
  return raw && raw.length > 0 ? raw : null;
}

function isProductionEnvironment() {
  return process.env.NODE_ENV === "production";
}

function buildDevelopmentSessionSecret() {
  return createHash("sha256")
    .update(
      [
        "agent-lion-dev-session",
        process.cwd(),
        process.env.USERNAME ?? "",
        process.env.COMPUTERNAME ?? "",
        process.version
      ].join("|")
    )
    .digest("base64url");
}

function getSessionSecret(mode: "read" | "write") {
  const explicitSecret = getSessionSecretFromEnv();
  if (explicitSecret) {
    return explicitSecret;
  }

  if (isProductionEnvironment()) {
    if (mode === "write") {
      throw new Error("AUTH_SESSION_SECRET ausente");
    }

    return null;
  }

  return buildDevelopmentSessionSecret();
}

function signValue(value: string, mode: "read" | "write") {
  const secret = getSessionSecret(mode);
  if (!secret) {
    return null;
  }

  return createHmac("sha256", secret).update(value).digest("base64url");
}

function createSignedPayload<T>(value: T) {
  const payload = toBase64Url(JSON.stringify(value));
  const signature = signValue(payload, "write");
  if (!signature) {
    throw new Error("AUTH_SESSION_SECRET ausente");
  }
  return `${payload}.${signature}`;
}

function readSignedPayload<T>(token: string | undefined): T | null {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = signValue(payload, "read");
  if (!expected) return null;
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    return JSON.parse(fromBase64Url(payload)) as T;
  } catch {
    return null;
  }
}

export function createSessionToken(session: UserSession) {
  return createSignedPayload(session);
}

export function readSessionToken(token: string | undefined): UserSession | null {
  return readSignedPayload<UserSession>(token);
}

export function getSessionFromCookies(cookieStore: CookieReader) {
  return readSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function getGoogleStateCookieName() {
  return GOOGLE_STATE_COOKIE;
}

export function getGoogleConnectStateCookieName() {
  return GOOGLE_CONNECT_STATE_COOKIE;
}

export function getSocialConnectStateCookieName() {
  return SOCIAL_CONNECT_STATE_COOKIE;
}

export function createSignedCookieValue<T>(value: T) {
  return createSignedPayload(value);
}

export function readSignedCookieValue<T>(token: string | undefined) {
  return readSignedPayload<T>(token);
}

export function isSessionSecretExplicitlyConfigured() {
  return Boolean(getSessionSecretFromEnv());
}
