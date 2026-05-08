import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  companyRouteJson,
  requireCompanyRouteAccess,
  requireResolvedCompanyRoutePermission
} from "@/lib/api/company-route-auth";
import { getCompanyWorkspace } from "@/lib/connectors";
import {
  upsertStoredCompanyPaymentProfile,
  upsertStoredPaymentApprovalRequest
} from "@/lib/company-vault";
import { buildPaymentApprovalRequest } from "@/lib/payments";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

export async function GET(
  _request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  const access = await requireCompanyRouteAccess({
    companyId,
    permission: "payments:approve"
  });

  if (!access.ok) {
    return access.response;
  }

  return companyRouteJson(
    {
      paymentProfile: access.workspace.paymentProfile,
      paymentRequests: access.workspace.paymentRequests
    }
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);

  if (!session) {
    return NextResponse.redirect(new URL("/?auth=login-required", request.url), { status: 303 });
  }

  const professionalProfile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(companyId, professionalProfile);

  if (!workspace) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "request");
  const forbidden = requireResolvedCompanyRoutePermission({
    workspace,
    profile: professionalProfile,
    session,
    permission: "payments:approve"
  });

  if (forbidden) {
    return forbidden;
  }

  if (intent === "save-profile") {
    upsertStoredCompanyPaymentProfile({
      ...workspace.paymentProfile,
      status: String(formData.get("paymentMethodId") ?? "").trim() ? "ready" : "approval_required",
      customerId: String(formData.get("customerId") ?? "").trim() || undefined,
      paymentMethodId: String(formData.get("paymentMethodId") ?? "").trim() || undefined,
      brand: String(formData.get("brand") ?? "").trim() || undefined,
      last4: String(formData.get("last4") ?? "").trim() || undefined,
      cardholderName: String(formData.get("cardholderName") ?? "").trim() || undefined,
      defaultCurrency: String(formData.get("defaultCurrency") ?? "BRL"),
      spendCap: String(formData.get("spendCap") ?? ""),
      approvalRule: String(formData.get("approvalRule") ?? ""),
      updatedAt: new Date().toISOString()
    });

    return NextResponse.redirect(new URL(`/empresas/${companyId}/pagamentos?saved=1`, request.url), { status: 303 });
  }

  const approvalRequest = buildPaymentApprovalRequest({
    company: workspace.company,
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    requestedBy: session.email
  });

  upsertStoredPaymentApprovalRequest(approvalRequest);

  return NextResponse.redirect(new URL(`/empresas/${companyId}/pagamentos?requested=1`, request.url), { status: 303 });
}
