import { randomBytes } from "node:crypto";
import { readSanitizedResponseText } from "@/core/observability/redaction";

const GOOGLE_LOGIN_SCOPES = ["openid", "email", "profile"];

export function getGoogleClientId() {
  return process.env.GOOGLE_CLIENT_ID;
}

export function getGoogleClientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET;
}

export function hasGoogleOAuthConfigured() {
  return Boolean(getGoogleClientId() && getGoogleClientSecret());
}

export function createGoogleState() {
  return randomBytes(18).toString("base64url");
}

export function buildGoogleLoginUrl(origin: string, state: string) {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID ausente");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: GOOGLE_LOGIN_SCOPES.join(" "),
    state
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(origin: string, code: string) {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais Google OAuth ausentes");
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `${origin}/api/auth/google/callback`,
    grant_type: "authorization_code"
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new Error(
      `Falha ao trocar codigo Google OAuth: ${await readSanitizedResponseText(
        response,
        "Google OAuth rejeitou a troca do codigo."
      )}`
    );
  }

  return (await response.json()) as { access_token: string };
}

export async function fetchGoogleUser(accessToken: string) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(
      `Falha ao ler perfil Google: ${await readSanitizedResponseText(
        response,
        "Nao foi possivel ler o perfil Google."
      )}`
    );
  }

  return (await response.json()) as {
    sub: string;
    email: string;
    name: string;
    picture?: string;
  };
}
