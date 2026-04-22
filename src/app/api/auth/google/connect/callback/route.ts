import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { PlatformId } from "@/lib/domain";
import { fetchGoogleUser } from "@/lib/google-auth";
import {
  exchangeGoogleConnectionCode,
  getScopesForGooglePlatform,
  hasGoogleConnectionOAuthConfigured,
  isGoogleManagedPlatform
} from "@/lib/google-connections";
import { getCompanyWorkspace } from "@/lib/connectors";
import { isVaultConfigured, upsertStoredGoogleCompanyConnection } from "@/lib/company-vault";
import {
  getGoogleConnectStateCookieName,
  readSignedCookieValue
} from "@/lib/session";

type ConnectState = {
  state: string;
  companyId: string;
  platform: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const signedState = cookieStore.get(getGoogleConnectStateCookieName())?.value;
  const parsedState = readSignedCookieValue<ConnectState>(signedState);
  const isSecure = origin.startsWith("https://");
  const platformId = parsedState?.platform as PlatformId | undefined;

  if (!hasGoogleConnectionOAuthConfigured()) {
    return NextResponse.redirect(new URL("/?connect=missing-google-oauth", origin));
  }

  if (!isVaultConfigured()) {
    return NextResponse.redirect(new URL("/?connect=missing-vault", origin));
  }

  if (!code || !state || !parsedState || parsedState.state !== state || !platformId || !isGoogleManagedPlatform(platformId)) {
    return NextResponse.redirect(new URL("/?connect=invalid-state", origin));
  }

  const workspace = getCompanyWorkspace(parsedState.companyId);
  if (!workspace) {
    return NextResponse.redirect(new URL("/?connect=company-not-found", origin));
  }

  try {
    const token = await exchangeGoogleConnectionCode(origin, code);
    const googleUser = await fetchGoogleUser(token.access_token);
    const grantedScopes = token.scope
      ? token.scope.split(" ").filter(Boolean)
      : getScopesForGooglePlatform(platformId!);

    upsertStoredGoogleCompanyConnection({
      companySlug: parsedState.companyId,
      platform: platformId!,
      accountEmail: googleUser.email,
      accountName: googleUser.name,
      googleSub: googleUser.sub,
      scopes: grantedScopes,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const response = NextResponse.redirect(new URL(`/empresas/${parsedState.companyId}?connect=success`, origin));

    response.cookies.set(getGoogleConnectStateCookieName(), "", {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecure,
      path: "/",
      maxAge: 0
    });

    return response;
  } catch {
    return NextResponse.redirect(new URL(`/empresas/${parsedState.companyId}?connect=failed`, origin));
  }
}
