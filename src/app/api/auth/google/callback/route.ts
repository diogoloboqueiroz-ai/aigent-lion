import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeGoogleCode, fetchGoogleUser, hasGoogleOAuthConfigured } from "@/lib/google-auth";
import { createSessionToken, getGoogleStateCookieName, getSessionCookieName } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const isSecure = origin.startsWith("https://");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const storedState = cookieStore.get(getGoogleStateCookieName())?.value;

  if (!hasGoogleOAuthConfigured()) {
    return NextResponse.redirect(new URL("/?auth=missing-google-oauth", origin));
  }

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/?auth=invalid-google-state", origin));
  }

  try {
    const token = await exchangeGoogleCode(origin, code);
    const googleUser = await fetchGoogleUser(token.access_token);
    const sessionToken = createSessionToken({
      provider: "google",
      sub: googleUser.sub,
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture
    });

    const response = NextResponse.redirect(new URL("/", origin));

    response.cookies.set(getSessionCookieName(), sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecure,
      path: "/",
      maxAge: 60 * 60 * 24 * 7
    });

    response.cookies.set(getGoogleStateCookieName(), "", {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecure,
      path: "/",
      maxAge: 0
    });

    return response;
  } catch {
    return NextResponse.redirect(new URL("/?auth=google-login-failed", origin));
  }
}
