import { getStoredCompanyPaymentProfile, getStoredPaymentApprovalRequests } from "@/lib/company-vault";
import type {
  CompanyPaymentProfile,
  CompanyProfile,
  PaymentApprovalRequest
} from "@/lib/domain";

export function getCompanyPaymentProfile(company: CompanyProfile): CompanyPaymentProfile {
  const stored = getStoredCompanyPaymentProfile(company.slug);
  if (stored) {
    return stored;
  }

  return {
    companySlug: company.slug,
    provider: "stripe",
    status: "approval_required",
    defaultCurrency: "BRL",
    spendCap: "Definir teto maximo por servico antes de ativar pagamentos.",
    approvalRule:
      "Nenhum pagamento pode ser executado sem solicitação explícita e aprovação do usuário. Cartão salvo serve apenas para agilizar a execução depois da liberação.",
    updatedAt: new Date().toISOString()
  };
}

export function getCompanyPaymentRequests(companySlug: string) {
  return getStoredPaymentApprovalRequests(companySlug).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

export function buildPaymentApprovalRequest(input: {
  company: CompanyProfile;
  title: string;
  description: string;
  amount: string;
  requestedBy: string;
}) {
  return {
    id: `payreq-${input.company.slug}-${Date.now()}`,
    companySlug: input.company.slug,
    provider: "stripe" as const,
    title: input.title,
    description: input.description,
    amount: input.amount,
    currency: "BRL",
    requestedAt: new Date().toISOString(),
    requestedBy: input.requestedBy,
    status: "pending" as const,
    userApprovalRequired: true as const
  };
}

export function approvePaymentRequest(request: PaymentApprovalRequest) {
  return {
    ...request,
    status: "approved" as const,
    approvedAt: new Date().toISOString()
  };
}

export function denyPaymentRequest(request: PaymentApprovalRequest) {
  return {
    ...request,
    status: "denied" as const,
    deniedAt: new Date().toISOString()
  };
}
