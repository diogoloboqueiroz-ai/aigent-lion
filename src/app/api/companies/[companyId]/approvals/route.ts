import { NextResponse } from "next/server";
import { getCompanyWorkspace } from "@/lib/connectors";

export async function GET(
  _request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  const workspace = getCompanyWorkspace(companyId);

  if (!workspace) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
  }

  return NextResponse.json(
    {
      approvals: workspace.approvalsCenter
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
