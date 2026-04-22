import { NextResponse } from "next/server";
import { getCompanyWorkspace } from "@/lib/connectors";
import { isVaultConfigured } from "@/lib/company-vault";
import {
  buildSocialCompanyConnectionUrl,
  createCodeVerifier,
  createSocialState,
  getSocialAuthProvider,
  hasSocialOAuthConfigured,
  isSocialOAuthPlatform
} from "@/lib/social-auth";
import {
  createSignedCookieValue,
  getSessionCookieName,
  getSocialConnectStateCookieName,
  readSessionToken
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
  const companyId = url.searchParams.get("companyId");
  const platform = url.searchParams.get("platform");
  const isSecure = origin.startsWith("https://");
  const sessionToken = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${getSessionCookieName()}=`))
    ?.slice(getSessionCookieName().length + 1);

  if (!readSessionToken(sessionToken)) {
    return NextResponse.redirect(new URL("/?auth=login-required", origin));
  }

  if (!companyId || !platform) {
    return NextResponse.redirect(new URL("/?connect=missing-params", origin));
  }

  const workspace = getCompanyWorkspace(companyId);
  if (!workspace) {
    return NextResponse.redirect(new URL("/?connect=company-not-found", origin));
  }

  if (!isSocialOAuthPlatform(platform)) {
    return NextResponse.redirect(new URL(`/empresas/${companyId}/social?connect=platform-not-supported`, origin));
  }

  const provider = getSocialAuthProvider(platform);
  if (!provider) {
    return NextResponse.redirect(new URL(`/empresas/${companyId}/social?connect=platform-not-supported`, origin));
  }

  if (!hasSocialOAuthConfigured(provider)) {
    return NextResponse.redirect(new URL(`/empresas/${companyId}/social?connect=missing-social-oauth`, origin));
  }

  if (!isVaultConfigured()) {
    return NextResponse.redirect(new URL(`/empresas/${companyId}/social?connect=missing-vault`, origin));
  }

  const state = createSocialState();
  const codeVerifier = provider === "tiktok" ? createCodeVerifier() : undefined;
  const signedState = createSignedCookieValue<ConnectState>({
    state,
    companyId,
    platform,
    provider,
    codeVerifier
  });

  const response = NextResponse.redirect(
    buildSocialCompanyConnectionUrl(origin, state, platform, codeVerifier)
  );

  response.cookies.set(getSocialConnectStateCookieName(), signedState, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: 60 * 10
  });

  return response;
}
