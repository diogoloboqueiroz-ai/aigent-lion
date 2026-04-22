import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { upsertStoredInternetIntelligenceProfile } from "@/lib/company-vault";
import { getInternetIntelligenceProfile, parseInternetIntelligenceForm } from "@/lib/internet-intel";
import { getSessionFromCookies } from "@/lib/session";

export async function GET() {
  return NextResponse.json(
    {
      internetIntel: getInternetIntelligenceProfile()
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
  upsertStoredInternetIntelligenceProfile(
    parseInternetIntelligenceForm(formData, getInternetIntelligenceProfile())
  );

  return NextResponse.redirect(new URL("/inteligencia-web?saved=1", request.url), { status: 303 });
}
