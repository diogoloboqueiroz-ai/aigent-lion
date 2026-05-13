import {
  getStoredGoogleCompanyConnection,
  upsertStoredGoogleCompanyConnection
} from "@/lib/company-vault";
import { readSanitizedResponseText } from "@/core/observability/redaction";
import type { PlatformId } from "@/lib/domain";
import { getGoogleClientId, getGoogleClientSecret } from "@/lib/google-auth";

type GoogleRefreshResult = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes?: string[];
};

export function needsGoogleTokenRefresh(expiresAt?: string) {
  if (!expiresAt) {
    return false;
  }

  return new Date(expiresAt).getTime() - Date.now() <= 60_000;
}

export async function ensureFreshGoogleCompanyConnection(companySlug: string, platform: PlatformId) {
  const connection = getStoredGoogleCompanyConnection(companySlug, platform);

  if (!connection) {
    throw new Error(`Conexao Google nao encontrada para ${platform}.`);
  }

  if (!connection.refreshToken || !needsGoogleTokenRefresh(connection.expiresAt)) {
    return connection;
  }

  return refreshStoredGoogleConnection(connection);
}

export async function refreshStoredGoogleConnection(
  connection: NonNullable<ReturnType<typeof getStoredGoogleCompanyConnection>>
) {
  const refreshed = await refreshGoogleAccessToken(connection.refreshToken, connection.platform);
  const nextConnection = {
    ...connection,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? connection.refreshToken,
    expiresAt: refreshed.expiresAt,
    scopes: refreshed.scopes ?? connection.scopes,
    updatedAt: new Date().toISOString()
  };

  upsertStoredGoogleCompanyConnection(nextConnection);

  return nextConnection;
}

export async function refreshGoogleAccessToken(refreshToken?: string, platform?: PlatformId): Promise<GoogleRefreshResult> {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      platform
        ? `Nao foi possivel renovar o token Google de ${platform} desta empresa.`
        : "Nao foi possivel renovar o token Google desta empresa."
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
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
      `Falha ao renovar token Google: ${await readSanitizedResponseText(
        response,
        "Google recusou a renovacao da credencial."
      )}`
    );
  }

  const token = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  if (!token.access_token) {
    throw new Error("Resposta do Google sem access_token ao renovar credencial.");
  }

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : undefined,
    scopes: token.scope ? token.scope.split(" ").filter(Boolean) : undefined
  };
}
