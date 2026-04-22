import { appendStoredAuditEvent } from "@/lib/company-vault";
import type { ConnectorAuditEvent, ExecutionTrackPriority, PlatformId } from "@/lib/domain";

type AuditEventInput = {
  companySlug: string;
  connector: PlatformId | "system";
  kind: ConnectorAuditEvent["kind"];
  title: string;
  details: string;
  priority?: ExecutionTrackPriority;
};

export function createCompanyAuditEvent(input: AuditEventInput) {
  const timestamp = new Date().toISOString();
  const suffix = `${Date.now()}-${sanitizeForId(input.title).slice(0, 40)}`;

  return {
    id: `audit-${input.companySlug}-${suffix}`,
    timestamp,
    connector: input.connector,
    kind: input.kind,
    title: input.priority ? `${input.title} [${input.priority}]` : input.title,
    details: input.details
  } satisfies ConnectorAuditEvent;
}

export function recordCompanyAuditEvent(input: AuditEventInput) {
  const event = createCompanyAuditEvent(input);
  appendStoredAuditEvent(event);
  return event;
}

export function parseSpendCap(value: string | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return undefined;
  }

  const match = normalized.match(/-?\d[\d.,]*/);
  if (!match) {
    return undefined;
  }

  const parsed = Number(
    match[0]
      .replace(/\.(?=\d{3}\b)/g, "")
      .replace(",", ".")
  );

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function parseBudgetValue(value: string | undefined, fallback = 0) {
  const parsed = parseSpendCap(value);
  return parsed ?? fallback;
}

export function isBudgetAboveSpendCap(input: {
  budget: string | undefined;
  spendCap: string | undefined;
}) {
  const spendCap = parseSpendCap(input.spendCap);
  if (!spendCap) {
    return false;
  }

  const budget = parseBudgetValue(input.budget);
  return budget > spendCap;
}

export function buildSpendCapMessage(input: {
  budget: string | undefined;
  spendCap: string | undefined;
}) {
  const spendCap = parseSpendCap(input.spendCap);
  const budget = parseBudgetValue(input.budget);

  if (!spendCap) {
    return "O spend cap ainda nao foi definido para esta empresa.";
  }

  return `O budget pedido (${formatCurrency(budget)}) ultrapassa o teto operacional desta empresa (${formatCurrency(spendCap)}).`;
}

function sanitizeForId(value: string) {
  return value
    .normalize("NFD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2
  }).format(value);
}
