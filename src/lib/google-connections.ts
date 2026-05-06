import type { PlatformId } from "@/lib/domain";
import { readSanitizedResponseText } from "@/core/observability/redaction";
import { getGoogleClientId, getGoogleClientSecret } from "@/lib/google-auth";

type GooglePlatformId = Exclude<PlatformId, "meta">;

export const GOOGLE_PLATFORM_SCOPES: Record<GooglePlatformId, string[]> = {
  ga4: ["https://www.googleapis.com/auth/analytics.readonly"],
  "google-sheets": ["https://www.googleapis.com/auth/spreadsheets"],
  "search-console": ["https://www.googleapis.com/auth/webmasters.readonly"],
  "google-ads": ["https://www.googleapis.com/auth/adwords"],
  "business-profile": ["https://www.googleapis.com/auth/business.manage"],
  gmail: ["https://www.googleapis.com/auth/gmail.send"],
  youtube: [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly"
  ]
};

const GOOGLE_CONNECT_BASE_SCOPES = ["openid", "email", "profile"];

export function isGoogleManagedPlatform(platform: string): platform is GooglePlatformId {
  return Object.prototype.hasOwnProperty.call(GOOGLE_PLATFORM_SCOPES, platform);
}

export function getScopesForGooglePlatform(platform: GooglePlatformId) {
  if (!isGoogleManagedPlatform(platform)) {
    return [];
  }

  return GOOGLE_PLATFORM_SCOPES[platform];
}

export function hasGoogleConnectionOAuthConfigured() {
  return Boolean(getGoogleClientId() && getGoogleClientSecret());
}

export function buildGoogleCompanyConnectionUrl(origin: string, state: string, platform: GooglePlatformId) {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID ausente");
  }

  const scopes = [...GOOGLE_CONNECT_BASE_SCOPES, ...getScopesForGooglePlatform(platform)];
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/google/connect/callback`,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: scopes.join(" "),
    state
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleConnectionCode(origin: string, code: string) {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais Google OAuth ausentes");
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `${origin}/api/auth/google/connect/callback`,
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

  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
}
