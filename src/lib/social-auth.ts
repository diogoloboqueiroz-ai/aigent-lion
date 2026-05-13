import { createHash, randomBytes } from "node:crypto";
import { readSanitizedResponseText } from "@/core/observability/redaction";
import type { PlatformId, SocialPlatformId } from "@/lib/domain";
import { areAllEnvConfigured } from "@/lib/env";

export type SocialAuthProvider = "meta" | "linkedin" | "tiktok";
export type SocialOAuthPlatform = Exclude<SocialPlatformId, "google-ads" | "google-business" | "youtube">;

type SocialTokenPayload = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes: string[];
  externalUserId?: string;
  accountLabel: string;
};

const SOCIAL_PROVIDER_ENVS: Record<SocialAuthProvider, string[]> = {
  meta: ["META_APP_ID", "META_APP_SECRET"],
  linkedin: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
  tiktok: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"]
};

const SOCIAL_PLATFORM_PROVIDER: Record<SocialOAuthPlatform, SocialAuthProvider> = {
  instagram: "meta",
  facebook: "meta",
  linkedin: "linkedin",
  tiktok: "tiktok"
};

const SOCIAL_PLATFORM_SCOPES: Record<SocialOAuthPlatform, string[]> = {
  instagram: [
    "public_profile",
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "instagram_basic",
    "instagram_content_publish",
    "business_management",
    "ads_management"
  ],
  facebook: [
    "public_profile",
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "business_management",
    "ads_management"
  ],
  linkedin: [
    "openid",
    "profile",
    "email",
    "w_member_social",
    "w_organization_social",
    "rw_organization_admin",
    "r_organization_social"
  ],
  tiktok: ["user.info.basic", "user.info.stats", "video.list", "video.publish"]
};

const GOOGLE_SOCIAL_PLATFORM_MAP: Partial<Record<SocialPlatformId, PlatformId>> = {
  "google-ads": "google-ads",
  "google-business": "business-profile",
  youtube: "youtube"
};

export function createSocialState() {
  return randomBytes(18).toString("base64url");
}

export function createCodeVerifier() {
  return randomBytes(32).toString("base64url");
}

export function getSocialProviderEnvNames(provider: SocialAuthProvider) {
  return SOCIAL_PROVIDER_ENVS[provider];
}

export function getSocialScopes(platform: SocialOAuthPlatform) {
  return SOCIAL_PLATFORM_SCOPES[platform];
}

export function isSocialOAuthPlatform(platform: string): platform is SocialOAuthPlatform {
  return Object.prototype.hasOwnProperty.call(SOCIAL_PLATFORM_PROVIDER, platform);
}

export function getSocialAuthProvider(platform: string) {
  if (!isSocialOAuthPlatform(platform)) {
    return null;
  }

  return SOCIAL_PLATFORM_PROVIDER[platform];
}

export function getGooglePlatformForSocialPlatform(platform: SocialPlatformId) {
  return GOOGLE_SOCIAL_PLATFORM_MAP[platform] ?? null;
}

export function hasSocialOAuthConfigured(provider: SocialAuthProvider) {
  return areAllEnvConfigured(getSocialProviderEnvNames(provider));
}

export function buildSocialCompanyConnectionUrl(
  origin: string,
  state: string,
  platform: SocialOAuthPlatform,
  codeVerifier?: string
) {
  const provider = getSocialAuthProvider(platform);

  if (!provider) {
    throw new Error("Plataforma social nao suportada");
  }

  const redirectUri = `${origin}/api/auth/social/connect/callback`;

  if (provider === "meta") {
    const clientId = process.env.META_APP_ID;
    if (!clientId) {
      throw new Error("META_APP_ID ausente");
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      response_type: "code",
      scope: getSocialScopes(platform).join(",")
    });

    return `https://www.facebook.com/v23.0/dialog/oauth?${params.toString()}`;
  }

  if (provider === "linkedin") {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    if (!clientId) {
      throw new Error("LINKEDIN_CLIENT_ID ausente");
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      response_type: "code",
      scope: getSocialScopes(platform).join(" ")
    });

    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) {
    throw new Error("TIKTOK_CLIENT_KEY ausente");
  }

  if (!codeVerifier) {
    throw new Error("code_verifier ausente para TikTok");
  }

  const params = new URLSearchParams({
    client_key: clientKey,
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    scope: getSocialScopes(platform).join(","),
    code_challenge: createCodeChallenge(codeVerifier),
    code_challenge_method: "S256"
  });

  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
}

export async function exchangeSocialConnectionCode(
  origin: string,
  code: string,
  platform: SocialOAuthPlatform,
  codeVerifier?: string
): Promise<SocialTokenPayload> {
  const provider = getSocialAuthProvider(platform);

  if (!provider) {
    throw new Error("Plataforma social nao suportada");
  }

  const redirectUri = `${origin}/api/auth/social/connect/callback`;

  if (provider === "meta") {
    const clientId = process.env.META_APP_ID;
    const clientSecret = process.env.META_APP_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("Credenciais Meta OAuth ausentes");
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code
    });

    const response = await fetch(`https://graph.facebook.com/v23.0/oauth/access_token?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(
        `Falha ao trocar codigo Meta OAuth: ${await readSanitizedResponseText(
          response,
          "Meta OAuth rejeitou a troca do codigo."
        )}`
      );
    }

    const token = (await response.json()) as {
      access_token: string;
      expires_in?: number;
    };
    const profile = await fetchMetaProfile(token.access_token);

    return {
      accessToken: token.access_token,
      expiresAt: token.expires_in ? buildExpiry(token.expires_in) : undefined,
      scopes: getSocialScopes(platform),
      externalUserId: profile.externalUserId,
      accountLabel: profile.accountLabel
    };
  }

  if (provider === "linkedin") {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("Credenciais LinkedIn OAuth ausentes");
    }

    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    });

    const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    if (!response.ok) {
      throw new Error(
        `Falha ao trocar codigo LinkedIn OAuth: ${await readSanitizedResponseText(
          response,
          "LinkedIn OAuth rejeitou a troca do codigo."
        )}`
      );
    }

    const token = (await response.json()) as {
      access_token: string;
      expires_in?: number;
      scope?: string;
    };
    const profile = await fetchLinkedInProfile(token.access_token);

    return {
      accessToken: token.access_token,
      expiresAt: token.expires_in ? buildExpiry(token.expires_in) : undefined,
      scopes: token.scope ? token.scope.split(" ").filter(Boolean) : getSocialScopes(platform),
      externalUserId: profile.externalUserId,
      accountLabel: profile.accountLabel
    };
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    throw new Error("Credenciais TikTok OAuth ausentes");
  }

  if (!codeVerifier) {
    throw new Error("code_verifier ausente para TikTok");
  }

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
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
      `Falha ao trocar codigo TikTok OAuth: ${await readSanitizedResponseText(
        response,
        "TikTok OAuth rejeitou a troca do codigo."
      )}`
    );
  }

  const rawToken = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    open_id?: string;
    data?: {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      open_id?: string;
    };
  };
  const token = rawToken.data ?? rawToken;
  if (!token.access_token) {
    throw new Error("Resposta TikTok sem access_token");
  }

  const profile = await fetchTikTokProfile(token.access_token);

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: token.expires_in ? buildExpiry(token.expires_in) : undefined,
    scopes: token.scope ? token.scope.split(",").map((entry) => entry.trim()).filter(Boolean) : getSocialScopes(platform),
    externalUserId: profile.externalUserId ?? token.open_id,
    accountLabel: profile.accountLabel
  };
}

function createCodeChallenge(codeVerifier: string) {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

function buildExpiry(expiresInSeconds: number) {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

async function fetchMetaProfile(accessToken: string) {
  const response = await fetch("https://graph.facebook.com/me?fields=id,name", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    return {
      accountLabel: "Conta Meta conectada"
    };
  }

  const profile = (await response.json()) as {
    id?: string;
    name?: string;
  };

  return {
    externalUserId: profile.id,
    accountLabel: profile.name ?? "Conta Meta conectada"
  };
}

async function fetchLinkedInProfile(accessToken: string) {
  const response = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    return {
      accountLabel: "Conta LinkedIn conectada"
    };
  }

  const profile = (await response.json()) as {
    sub?: string;
    name?: string;
    email?: string;
  };

  return {
    externalUserId: profile.sub,
    accountLabel: profile.name ?? profile.email ?? "Conta LinkedIn conectada"
  };
}

async function fetchTikTokProfile(accessToken: string) {
  const response = await fetch(
    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    return {
      accountLabel: "Conta TikTok conectada"
    };
  }

  const payload = (await response.json()) as {
    data?: {
      user?: {
        open_id?: string;
        display_name?: string;
      };
    };
  };
  const user = payload.data?.user;

  return {
    externalUserId: user?.open_id,
    accountLabel: user?.display_name ?? "Conta TikTok conectada"
  };
}
