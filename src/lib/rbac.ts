import { recordCompanyAuditEvent } from "@/lib/governance";
import type { UserPermission, UserProfessionalProfile } from "@/lib/domain";

type PermissionCheckInput = {
  companySlug: string;
  profile: UserProfessionalProfile | null;
  permission: UserPermission;
  actor: string;
};

type PermissionEvaluationResult =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      reason: "missing_permission" | "tenant_scope_blocked";
      message: string;
    };

export function hasPermission(
  profile: UserProfessionalProfile | null,
  permission: UserPermission
) {
  return Boolean(profile?.permissions.includes(permission));
}

export function hasCompanyAccess(
  profile: UserProfessionalProfile | null,
  companySlug: string
) {
  if (!profile) {
    return false;
  }

  if (profile.role === "admin") {
    return true;
  }

  const tenantScope = profile.tenantScope ?? "all";
  if (tenantScope !== "restricted") {
    return true;
  }

  return Boolean(profile.allowedCompanySlugs?.includes(companySlug));
}

export function evaluateCompanyPermission(input: PermissionCheckInput): PermissionEvaluationResult {
  if (!hasPermission(input.profile, input.permission)) {
    return {
      allowed: false,
      reason: "missing_permission",
      message: `Permissao insuficiente para ${input.permission}.`
    };
  }

  if (!hasCompanyAccess(input.profile, input.companySlug)) {
    return {
      allowed: false,
      reason: "tenant_scope_blocked",
      message: `Acesso negado para a empresa ${input.companySlug}.`
    };
  }

  return {
    allowed: true
  };
}

export function requireCompanyPermission(input: PermissionCheckInput) {
  const evaluation = evaluateCompanyPermission(input);

  if (evaluation.allowed) {
    return {
      allowed: true as const
    };
  }

  const audit = recordCompanyAuditEvent({
    companySlug: input.companySlug,
    connector: "system",
    kind: "warning",
    title: "Acesso bloqueado por RBAC",
    details:
      evaluation.reason === "tenant_scope_blocked"
        ? `${input.actor} tentou usar ${input.permission} fora do escopo permitido para esta empresa.`
        : `${input.actor} tentou usar ${input.permission} sem permissao suficiente.`
  });

  return {
    allowed: false as const,
    auditId: audit.id,
    message: evaluation.message
  };
}
