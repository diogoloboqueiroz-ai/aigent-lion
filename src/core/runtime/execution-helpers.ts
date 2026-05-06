import { sanitizeErrorMessage } from "@/core/observability/redaction";

export async function executeRuntimeOperationWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`EXECUTION_TIMEOUT:${timeoutMs}`));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export function isRuntimeExecutionTimeoutError(error: unknown) {
  return error instanceof Error && error.message.startsWith("EXECUTION_TIMEOUT:");
}

export function formatRuntimeExecutionError(error: unknown, timedOut: boolean, timeoutMs: number) {
  if (timedOut) {
    return `A execucao excedeu o timeout operacional de ${timeoutMs}ms e foi encerrada com seguranca.`;
  }

  return sanitizeErrorMessage(error, "Falha inesperada do executor.");
}
