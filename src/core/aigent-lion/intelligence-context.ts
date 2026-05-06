import { buildStrategicMemoryDigest } from "@/core/aigent-lion/strategic-memory";
import type {
  AigentLionInput,
  AigentLionIntelligenceContext
} from "@/core/aigent-lion/types";
import { buildFullCampaignOS } from "@/core/marketing/campaign-os";
import { buildAutomationControlTowerSummary } from "@/core/observability/agent-control-tower";
import {
  getAutomationMetricsSinkTargetHost,
  isAutomationMetricsSinkConfigured
} from "@/core/observability/metrics-sink";
import { evaluateCorePolicyDecision } from "@/core/policy/policy-engine";
import { listObservabilityDeliveries } from "@/infrastructure/persistence/observability-delivery-store";
import { listAgentWorkerHeartbeats } from "@/infrastructure/persistence/worker-heartbeat-store";
import { buildTriggerEvent, runAgentDiagnostics } from "@/lib/agents/orchestrator";
import { runCmoAgent } from "@/lib/agents/cmo-agent";
import { runDecisionEngine } from "@/lib/agents/decision-engine";
import { getAgentExecutionPlaneMode } from "@/lib/agents/execution-plane";
import { getPersistedCampaignIntelligenceBriefs } from "@/infrastructure/persistence/company-campaign-storage";
import { getActivePersistedCompanyPolicyMatrix } from "@/infrastructure/persistence/company-policy-storage";
import { getCompanyWorkspace } from "@/lib/connectors";
import type { CompanyWorkspace } from "@/lib/domain";

export async function buildAigentLionIntelligenceContext(
  input: AigentLionInput
): Promise<AigentLionIntelligenceContext | null> {
  const workspace = getCompanyWorkspace(input.companyId, input.professionalProfile);

  if (!workspace) {
    return null;
  }

  return buildAigentLionIntelligenceContextFromWorkspace({
    ...input,
    workspace
  });
}

export async function buildAigentLionIntelligenceContextFromWorkspace(
  input: AigentLionInput & { workspace: CompanyWorkspace }
): Promise<AigentLionIntelligenceContext> {
  const trigger = buildTriggerEvent(input.workspace.company.slug, {
    triggerType: "api_preview",
    actor: input.actor,
    summary: input.message ?? "Supreme Brain context build."
  });
  const diagnosticResult = runAgentDiagnostics({
    workspace: input.workspace,
    trigger,
    actor: input.actor
  });
  const cmoDecision = runCmoAgent(diagnosticResult.context);
  const decisionResult = runDecisionEngine(
    diagnosticResult.context,
    diagnosticResult.findings,
    cmoDecision
  );
  const policyMatrix = getActivePersistedCompanyPolicyMatrix(input.workspace.company.slug);
  const policyDecisions = decisionResult.actions.slice(0, 8).map((action) => ({
    action,
    policy: evaluateCorePolicyDecision(
      diagnosticResult.context,
      action,
      action.riskScore,
      policyMatrix
    )
  }));
  const campaignOS = buildFullCampaignOS({
    workspace: input.workspace,
    cmoDecision,
    actor: input.actor
  });
  const observabilityDeliveries = listObservabilityDeliveries(input.workspace.company.slug);
  const workerHeartbeats = await listAgentWorkerHeartbeats(input.workspace.company.slug);
  const executionPlane = getAgentExecutionPlaneMode();
  const controlTower = buildAutomationControlTowerSummary({
    ...input.workspace,
    observabilityDeliveries,
    observabilityMode: isAutomationMetricsSinkConfigured() ? "direct_webhook" : "disabled",
    observabilityTargetHost: getAutomationMetricsSinkTargetHost(),
    workerHeartbeats,
    workerExpectedMode: executionPlane
  });
  const savedBriefs = getPersistedCampaignIntelligenceBriefs(input.workspace.company.slug);

  return {
    workspace: input.workspace,
    trigger,
    companyContext: diagnosticResult.context,
    diagnosticFindings: diagnosticResult.findings,
    cmoDecision,
    decisionResult,
    policyDecisions,
    campaignOS,
    controlTower,
    strategicMemory: buildStrategicMemoryDigest(input.workspace),
    latestCampaignBrief: savedBriefs[0] ?? campaignOS.brief
  };
}
