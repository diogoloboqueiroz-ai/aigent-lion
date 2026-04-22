import { NextResponse } from "next/server";
import { blueprint } from "@/lib/blueprint";

export async function GET() {
  return NextResponse.json(blueprint, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
