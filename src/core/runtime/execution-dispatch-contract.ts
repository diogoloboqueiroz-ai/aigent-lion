import type {
  AutomationOutcome,
  CompanyContext,
  ExecutionJob
} from "@/lib/agents/types";

export type ExecutionDispatchHandler = (
  context: CompanyContext,
  job: ExecutionJob,
  startedAt: string,
  auditReference: string
) => Promise<AutomationOutcome>;

export type ExecutionDispatchRegistry = Partial<
  Record<ExecutionJob["type"], ExecutionDispatchHandler>
>;

export function resolveExecutionDispatchHandler(
  registry: ExecutionDispatchRegistry,
  type: ExecutionJob["type"]
) {
  return registry[type] ?? null;
}

export async function runExecutionDispatchWithRetries<T>(
  operation: () => Promise<T>,
  attempts: number,
  delayMs: number
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await wait(delayMs * attempt);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("A execucao falhou apos todas as tentativas.");
}

export function slugifyExecutionValue(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
