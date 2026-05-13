import {
  getStoredSocialCompanyConnection,
  upsertStoredSocialCompanyConnection
} from "@/lib/company-vault";
import { readSanitizedResponseText } from "@/core/observability/redaction";
import type { SocialPlatformId } from "@/lib/domain";

type TikTokRefreshResult = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes?: string[];
};

export function needsSocialTokenRefresh(expiresAt?: string) {
  if (!expiresAt) {
    return false;
  }

  return new Date(expiresAt).getTime() - Date.now() <= 60_000;
}

export async function ensureFreshSocialCompanyConnection(companySlug: string, platform: SocialPlatformId) {
  const connection = getStoredSocialCompanyConnection(companySlug, platform);

  if (!connection) {
    throw new Error(`Conexao social nao encontrada para ${platform}.`);
  }

  if (connection.provider !== "tiktok" || !connection.refreshToken || !needsSocialTokenRefresh(connection.expiresAt)) {
    return connection;
  }

  return refreshStoredSocialConnection(connection);
}

export async function refreshStoredSocialConnection(
  connection: NonNullable<ReturnType<typeof getStoredSocialCompanyConnection>>
) {
  if (connection.provider !== "tiktok" || !connection.refreshToken) {
    return connection;
  }

  const refreshed = await refreshTikTokAccessToken(connection.refreshToken);
  const nextConnection = {
    ...connection,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? connection.refreshToken,
    expiresAt: refreshed.expiresAt,
    scopes: refreshed.scopes ?? connection.scopes,
    updatedAt: new Date().toISOString()
  };

  upsertStoredSocialCompanyConnection(nextConnection);

  return nextConnection;
}

async function refreshTikTokAccessToken(refreshToken: string): Promise<TikTokRefreshResult> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

  if (!clientKey || !clientSecret) {
    throw new Error("Credenciais TikTok OAuth ausentes para renovar o token.");
  }

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });

  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new Error(
      `Falha ao renovar token TikTok: ${await readSanitizedResponseText(
        response,
        "TikTok recusou a renovacao da credencial."
      )}`
    );
  }

  const rawToken = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    data?: {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
  };
  const token = rawToken.data ?? rawToken;

  if (!token.access_token) {
    throw new Error("Resposta do TikTok sem access_token ao renovar a credencial.");
  }

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : undefined,
    scopes: token.scope ? token.scope.split(",").map((entry) => entry.trim()).filter(Boolean) : undefined
  };
}
