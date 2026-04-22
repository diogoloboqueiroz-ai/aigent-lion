import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  isVaultConfigured,
  upsertStoredSocialCompanyConnection
} from "@/lib/company-vault";
import { getCompanyWorkspace } from "@/lib/connectors";
import {
  exchangeSocialConnectionCode,
  getSocialAuthProvider,
  hasSocialOAuthConfigured,
  isSocialOAuthPlatform
} from "@/lib/social-auth";
import {
  getSocialConnectStateCookieName,
  readSignedCookieValue
} from "@/lib/session";

type ConnectState = {
  state: string;
  companyId: string;
  platform: string;
  provider: string;
  codeVerifier?: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieStore = await cookies();
  const signedState = cookieStore.get(getSocialConnectStateCookieName())?.value;
  const parsedState = readSignedCookieValue<ConnectState>(signedState);
  const isSecure = origin.startsWith("https://");
  const platform = parsedState?.platform;

  if (error && parsedState?.companyId) {
    return clearStateAndRedirect(buildConnectRedirectPath(parsedState.companyId, "provider-error"), origin, isSecure);
  }

  if (!platform || !isSocialOAuthPlatform(platform)) {
    return clearStateAndRedirect("/?connect=invalid-state", origin, isSecure);
  }

  const provider = getSocialAuthProvider(platform);
  if (!provider || !hasSocialOAuthConfigured(provider)) {
    return clearStateAndRedirect(buildConnectRedirectPath(parsedState?.companyId, "missing-social-oauth"), origin, isSecure);
  }

  if (!isVaultConfigured()) {
    return clearStateAndRedirect(buildConnectRedirectPath(parsedState?.companyId, "missing-vault"), origin, isSecure);
  }

  if (
    !code ||
    !state ||
    !parsedState ||
    parsedState.state !== state ||
    parsedState.provider !== provider
  ) {
    return clearStateAndRedirect(buildConnectRedirectPath(parsedState?.companyId, "invalid-state"), origin, isSecure);
  }

  const workspace = getCompanyWorkspace(parsedState.companyId);
  if (!workspace) {
    return clearStateAndRedirect("/?connect=company-not-found", origin, isSecure);
  }

  try {
    const token = await exchangeSocialConnectionCode(origin, code, platform, parsedState.codeVerifier);

    upsertStoredSocialCompanyConnection({
      companySlug: parsedState.companyId,
      platform,
      provider,
      accountLabel: token.accountLabel,
      externalUserId: token.externalUserId,
      scopes: token.scopes,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return clearStateAndRedirect(buildConnectRedirectPath(parsedState.companyId, "success"), origin, isSecure);
  } catch {
    return clearStateAndRedirect(buildConnectRedirectPath(parsedState.companyId, "failed"), origin, isSecure);
  }
}

function buildConnectRedirectPath(companyId: string | undefined, status: string) {
  if (!companyId) {
    return `/?connect=${status}`;
  }

  return `/empresas/${companyId}/social?connect=${status}`;
}

function clearStateAndRedirect(pathname: string, origin: string, isSecure: boolean) {
  const response = NextResponse.redirect(new URL(pathname, origin));

  response.cookies.set(getSocialConnectStateCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: 0
  });

  return response;
}
