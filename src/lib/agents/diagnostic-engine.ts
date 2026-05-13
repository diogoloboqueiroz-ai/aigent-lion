import { runCoreDiagnosticEngine } from "@/core/decision/diagnostic-engine";
import type { CompanyContext } from "@/lib/agents/types";

export function runDiagnosticEngine(context: CompanyContext) {
  return runCoreDiagnosticEngine(context);
}
