import { NextResponse } from "next/server";
import { getCompanyWorkspace } from "@/lib/connectors";
import type { PlatformId } from "@/lib/domain";
import {
  buildGoogleCompanyConnectionUrl,
  hasGoogleConnectionOAuthConfigured,
  isGoogleManagedPlatform
} from "@/lib/google-connections";
import { createGoogleState } from "@/lib/google-auth";
import { isVaultConfigured } from "@/lib/company-vault";
import {
  createSignedCookieValue,
  getGoogleConnectStateCookieName,
  getSessionCookieName,
  readSessionToken
} from "@/lib/session";

type ConnectState = {
  state: string;
  companyId: string;
  platform: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const companyId = url.searchParams.get("companyId");
  const platform = url.searchParams.get("platform");
  const isSecure = origin.startsWith("https://");
  const platformId = platform as PlatformId | null;
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

  if (!platformId || !isGoogleManagedPlatform(platformId)) {
    return NextResponse.redirect(new URL(`/empresas/${companyId}?connect=platform-not-supported`, origin));
  }

  if (!hasGoogleConnectionOAuthConfigured()) {
    return NextResponse.redirect(new URL(`/empresas/${companyId}?connect=missing-google-oauth`, origin));
  }

  if (!isVaultConfigured()) {
    return NextResponse.redirect(new URL(`/empresas/${companyId}?connect=missing-vault`, origin));
  }

  const state = createGoogleState();
  const signedState = createSignedCookieValue<ConnectState>({
    state,
    companyId,
    platform
  });

  const response = NextResponse.redirect(buildGoogleCompanyConnectionUrl(origin, state, platformId));

  response.cookies.set(getGoogleConnectStateCookieName(), signedState, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: 60 * 10
  });

  return response;
}
