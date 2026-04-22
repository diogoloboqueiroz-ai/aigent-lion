import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { upsertStoredDesktopAgentProfile } from "@/lib/company-vault";
import { getDesktopAgentProfile, parseDesktopAgentForm } from "@/lib/desktop-agent";
import { getSessionFromCookies } from "@/lib/session";

export async function GET() {
  return NextResponse.json(
    {
      desktopAgent: getDesktopAgentProfile()
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);

  if (!session) {
    return NextResponse.redirect(new URL("/?auth=login-required", request.url), { status: 303 });
  }

  const formData = await request.formData();
  upsertStoredDesktopAgentProfile(parseDesktopAgentForm(formData, getDesktopAgentProfile()));

  return NextResponse.redirect(new URL("/agente-desktop?saved=1", request.url), { status: 303 });
}
