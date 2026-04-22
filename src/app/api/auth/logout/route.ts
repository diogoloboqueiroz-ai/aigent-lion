import { NextResponse } from "next/server";
import { getSessionCookieName } from "@/lib/session";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const isSecure = origin.startsWith("https://");
  const response = NextResponse.redirect(new URL("/", origin));

  response.cookies.set(getSessionCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: 0
  });

  return response;
}
