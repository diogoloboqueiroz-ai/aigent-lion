import { buildCoreDecisionPlan } from "@/core/decision/action-planner";
import { runCoreDecisionEngine } from "@/core/decision/decision-engine";
import type {
  CompanyContext,
  DecisionResult,
  DiagnosticFinding
} from "@/lib/agents/types";
import type { CompanyCmoStrategicDecision } from "@/lib/domain";

export function runDecisionEngine(
  context: CompanyContext,
  findings: DiagnosticFinding[],
  cmoDecision?: CompanyCmoStrategicDecision
): DecisionResult {
  const { opportunities, actions } = buildCoreDecisionPlan({
    context,
    findings,
    cmoDecision
  });
  const coreDecision = runCoreDecisionEngine({
    context,
    findings,
    opportunities,
    actions,
    cmoDecision
  });

  return {
    context,
    findings,
    opportunities,
    actions,
    cmoDecision,
    coreDecision
  };
}
