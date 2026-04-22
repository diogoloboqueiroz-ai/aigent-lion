import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { upsertStoredUserProfessionalProfile } from "@/lib/company-vault";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile, parseProfessionalProfileForm } from "@/lib/user-profiles";

export async function GET() {
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);

  if (!session) {
    return NextResponse.json({ error: "Login necessario" }, { status: 401 });
  }

  return NextResponse.json(
    {
      profile: getUserProfessionalProfile(session)
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

  const currentProfile = getUserProfessionalProfile(session);
  if (!currentProfile) {
    return NextResponse.json({ error: "Perfil nao encontrado" }, { status: 404 });
  }

  const formData = await request.formData();
  upsertStoredUserProfessionalProfile(parseProfessionalProfileForm(formData, currentProfile));

  return NextResponse.redirect(new URL("/perfil-profissional?saved=1", request.url), { status: 303 });
}
