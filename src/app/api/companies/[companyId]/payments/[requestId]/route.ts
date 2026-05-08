import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCompanyWorkspace } from "@/lib/connectors";
import { getStoredPaymentApprovalRequests, upsertStoredPaymentApprovalRequest } from "@/lib/company-vault";
import { approvePaymentRequest, denyPaymentRequest } from "@/lib/payments";
import { requireCompanyPermission } from "@/lib/rbac";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

export async function POST(
  request: Request,
  context: { params: Promise<{ companyId: string; requestId: string }> }
) {
  const { companyId, requestId } = await context.params;
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);

  if (!session) {
    return NextResponse.redirect(new URL("/?auth=login-required", request.url), { status: 303 });
  }

  const professionalProfile = getUserProfessionalProfile(session);
  const scopedWorkspace = getCompanyWorkspace(companyId, professionalProfile);

  if (!scopedWorkspace) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
  }

  const permissionCheck = requireCompanyPermission({
    companySlug: scopedWorkspace.company.slug,
    profile: professionalProfile,
    permission: "payments:approve",
    actor: session.email
  });

  if (!permissionCheck.allowed) {
    return NextResponse.json(
      { error: permissionCheck.message, auditId: permissionCheck.auditId },
      { status: 403 }
    );
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
