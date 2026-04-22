import { NextResponse } from "next/server";
import { buildGoogleLoginUrl, createGoogleState, hasGoogleOAuthConfigured } from "@/lib/google-auth";
import { getGoogleStateCookieName } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const isSecure = origin.startsWith("https://");

  if (!hasGoogleOAuthConfigured()) {
    return NextResponse.redirect(new URL("/?auth=missing-google-oauth", origin));
  }

  const state = createGoogleState();
  const redirect = NextResponse.redirect(buildGoogleLoginUrl(origin, state));

  redirect.cookies.set(getGoogleStateCookieName(), state, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: 60 * 10
  });

  return redirect;
}
