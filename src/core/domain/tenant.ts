export type TenantId = string & {
  readonly __tenantId: unique symbol;
};

export function toTenantId(value: string): TenantId {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("TenantId nao pode ser vazio.");
  }

  return normalized as TenantId;
}

export function tenantIdEquals(left: TenantId | string, right: TenantId | string) {
  return String(left) === String(right);
}

