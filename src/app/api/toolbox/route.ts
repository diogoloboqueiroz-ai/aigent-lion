import { NextResponse } from "next/server";
import { getMarketingToolbox, getMarketingToolboxSummary } from "@/lib/marketing-toolbox";

export async function GET() {
  return NextResponse.json(
    {
      summary: getMarketingToolboxSummary(),
      categories: getMarketingToolbox()
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
