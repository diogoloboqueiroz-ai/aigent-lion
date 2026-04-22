import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCompanyWorkspace } from "@/lib/connectors";
import { getStoredPaymentApprovalRequests, upsertStoredPaymentApprovalRequest } from "@/lib/company-vault";
import { approvePaymentRequest, denyPaymentRequest } from "@/lib/payments";
import { getSessionFromCookies } from "@/lib/session";

export async function POST(
  request: Request,
  context: { params: Promise<{ companyId: string; requestId: string }> }
) {
  const { companyId, requestId } = await context.params;
  const workspace = getCompanyWorkspace(companyId);
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);

  if (!session) {
    return NextResponse.redirect(new URL("/?auth=login-required", request.url), { status: 303 });
  }

  if (!workspace) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const paymentRequest = getStoredPaymentApprovalRequests(companyId).find((entry) => entry.id === requestId);

  if (!paymentRequest) {
    return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
  }

  if (intent === "approve") {
    upsertStoredPaymentApprovalRequest(approvePaymentRequest(paymentRequest));
  } else if (intent === "deny") {
    upsertStoredPaymentApprovalRequest(denyPaymentRequest(paymentRequest));
  }

  return NextResponse.redirect(new URL(`/empresas/${companyId}/pagamentos?decision=${intent}`, request.url), {
    status: 303
  });
}
