import { NextResponse } from "next/server";
import { getCompanyWorkspaces } from "@/lib/connectors";

export async function GET() {
  return NextResponse.json(
    {
      companies: getCompanyWorkspaces()
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
