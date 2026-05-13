import type {
  AigentLionArtifact,
  AigentLionInput,
  AigentLionIntelligenceContext,
  SpecialistAgentId,
  SpecialistAgentResult
} from "@/core/aigent-lion/types";

const INTENT_AGENT_MAP: Record<NonNullable<AigentLionInput["intent"]>, SpecialistAgentId[]> = {
  diagnose: ["cmo-agent", "analytics-agent", "compliance-guardian-agent"],
  plan: ["cmo-agent", "strategy-agent", "funnel-agent", "execution-operator-agent"],
  campaign: ["campaign-architect-agent", "copy-chief-agent", "paid-media-agent", "social-growth-agent", "compliance-guardian-agent"],
  creative: ["creative-director-agent", "image-prompt-agent", "video-script-agent", "compliance-guardian-agent"],
  analytics: ["analytics-agent", "learning-agent", "conversion-agent"],
  execute: ["execution-operator-agent", "compliance-guardian-agent", "paid-media-agent"],
  learn: ["learning-agent", "analytics-agent", "cmo-agent"],
  mission_control: ["cmo-agent", "analytics-agent", "execution-operator-agent", "learning-agent", "compliance-guardian-agent"],
  auto: ["cmo-agent", "campaign-architect-agent", "analytics-agent", "learning-agent", "compliance-guardian-agent"]
};

export function routeAigentLionAgents(input: {
  request: AigentLionInput;
  context: AigentLionIntelligenceContext;
}): SpecialistAgentResult[] {
  const intent = inferIntent(input.request);
  const agentIds = new Set<SpecialistAgentId>([
    ...INTENT_AGENT_MAP[intent],
    ...inferAgentsFromMessage(input.request.message)
  ]);

  return Array.from(agentIds).map((agentId) => runSpecialist(agentId, input.context));
}

export function inferIntent(input: Pick<AigentLionInput, "intent" | "message">) {
  if (input.intent && input.intent !== "auto") {
    return input.intent;
  }

  const message = (input.message ?? "").toLowerCase();

  if (/campanha|campaign|instagram|tiktok|meta ads|anuncio|ads/.test(message)) {
    return "campaign";
  }

  if (/criativo|imagem|video|roteiro|prompt|copy|headline/.test(message)) {
    return "creative";
  }

  if (/metric|anal[iy]t|ctr|cpa|cac|receita|relatorio/.test(message)) {
    return "analytics";
  }

  if (/execut|rodar|publicar|lancar|ativar/.test(message)) {
    return "execute";
  }

  if (/aprend|playbook|memoria|vencedor|perdedor/.test(message)) {
    return "learn";
  }

  if (/diagnost|problema|gargalo|por que/.test(message)) {
    return "diagnose";
  }

  return "plan";
}

function inferAgentsFromMessage(message?: string): SpecialistAgentId[] {
  const text = (message ?? "").toLowerCase();
  const agents: SpecialistAgentId[] = [];

  if (/funil|landing|convers/.test(text)) {
    agents.push("funnel-agent", "conversion-agent");
  }

  if (/social|instagram|tiktok|linkedin|youtube/.test(text)) {
    agents.push("social-growth-agent");
  }

  if (/orcamento|budget|cpa|cac|midia|ads|trafego/.test(text)) {
    agents.push("paid-media-agent");
  }

  if (/compliance|risco|aprov/.test(text)) {
    agents.push("compliance-guardian-agent");
  }

  return agents;
}

function runSpecialist(
  agentId: SpecialistAgentId,
  context: AigentLionIntelligenceContext
): SpecialistAgentResult {
  switch (agentId) {
    case "cmo-agent":
      return buildAgentResult(agentId, "CMO Agent", context.cmoDecision.weeklyThesis, [
        `Dominant constraint: ${context.cmoDecision.dominantConstraint}.`,
        `Primary bet: ${context.cmoDecision.primaryBet}.`,
        `Focus metric: ${context.cmoDecision.focusMetric}.`
      ], [
        ...context.cmoDecision.supportingBets,
        ...context.cmoDecision.recommendedExperiments.map((experiment) => experiment.title)
      ], strategyArtifacts(context), context.cmoDecision.confidence);
    case "strategy-agent":
      return buildAgentResult(agentId, "Strategy Agent", "Transforms the CMO thesis into sequenced growth moves.", context.companyContext.strategySummary, context.decisionResult.actions.slice(0, 4).map((action) => action.title), strategyArtifacts(context), 0.82);
    case "campaign-architect-agent":
      return buildAgentResult(agentId, "Campaign Architect Agent", context.campaignOS.brief.executiveSummary, context.campaignOS.funnel.map((stage) => `${stage.stage}: ${stage.currentBottleneck}`), context.campaignOS.experiments.map((experiment) => experiment.title), [campaignArtifact(context)], context.campaignOS.brief.readinessScore / 100);
    case "funnel-agent":
      return buildAgentResult(agentId, "Funnel Agent", "Maps awareness, consideration, conversion and retention into one operating plan.", context.campaignOS.funnel.map((stage) => stage.objective), context.campaignOS.copyAssets.map((asset) => asset.landingSectionOutline[0] ?? asset.headline), [campaignArtifact(context)], 0.78);
    case "copy-chief-agent":
      return buildAgentResult(agentId, "Copy Chief Agent", "Builds premium conversion copy from proof, promise and guardrails.", context.campaignOS.copyAssets.map((asset) => asset.headline), context.campaignOS.copyAssets.map((asset) => asset.primaryText), context.campaignOS.copyAssets.slice(0, 3).map(copyArtifact), 0.8);
    case "paid-media-agent":
      return buildAgentResult(agentId, "Paid Media Agent", "Evaluates paid channel readiness before any spend mutation.", context.campaignOS.channels.filter((channel) => channel.channel === "meta" || channel.channel === "google-ads").map((channel) => `${channel.label}: ${channel.readiness}`), context.decisionResult.actions.filter((action) => action.targetPlatform === "meta" || action.targetPlatform === "google-ads").map((action) => action.title), [campaignArtifact(context)], 0.77);
    case "social-growth-agent":
      return buildAgentResult(agentId, "Social Growth Agent", "Turns campaign thesis into approval-gated posts and social tests.", context.campaignOS.socialCalendar.map((post) => post.title), context.campaignOS.socialCalendar.map((post) => post.caption ?? post.summary), context.campaignOS.socialCalendar.slice(0, 3).map((post) => socialArtifact(post.id, post.title, post.caption ?? post.summary)), 0.79);
    case "creative-director-agent":
      return buildAgentResult(agentId, "Creative Director Agent", "Coordinates image prompts, video scripts and QA before production.", context.campaignOS.risks, context.campaignOS.visualAssets.slice(0, 4).map((asset) => asset.objective), context.campaignOS.visualAssets.slice(0, 4).map(imageArtifact), 0.81);
    case "video-script-agent":
      return buildAgentResult(agentId, "Video Script Agent", "Creates hooks, storyboards and platform versions for short-form video.", context.campaignOS.videoAssets.map((asset) => asset.hook), context.campaignOS.videoAssets.map((asset) => asset.script), context.campaignOS.videoAssets.slice(0, 3).map(videoArtifact), 0.8);
    case "image-prompt-agent":
      return buildAgentResult(agentId, "Image Prompt Agent", "Generates provider-specific visual prompts for production tools.", context.campaignOS.visualAssets.slice(0, 4).map((asset) => `${asset.provider}: ${asset.format}`), context.campaignOS.visualAssets.slice(0, 4).map((asset) => asset.prompt), context.campaignOS.visualAssets.slice(0, 4).map(imageArtifact), 0.83);
    case "analytics-agent":
      return buildAgentResult(agentId, "Analytics Agent", context.campaignOS.analyticsPlan.baselineSummary, context.campaignOS.analyticsPlan.attributionGaps, context.campaignOS.analyticsPlan.optimizationQuestions, [analyticsArtifact(context)], 0.78);
    case "conversion-agent":
      return buildAgentResult(agentId, "Conversion Agent", "Protects lead capture, CRM routing and revenue feedback.", context.workspace.conversionEvents.slice(0, 4).map((event) => `${event.destination}: ${event.status}`), context.workspace.leads.slice(0, 4).map((lead) => `${lead.fullName}: ${lead.stage}`), [], 0.75);
    case "learning-agent":
      return buildAgentResult(agentId, "Learning Agent", "Converts outcomes into tenant-safe memory and reusable playbooks.", context.strategicMemory.experimentOutcomes, context.strategicMemory.activePlaybooks, [memoryArtifact(context)], context.strategicMemory.confidence);
    case "compliance-guardian-agent":
      return buildAgentResult(agentId, "Compliance Guardian Agent", "Applies policy, approvals and risk gates before execution.", context.policyDecisions.map((entry) => `${entry.action.title}: ${entry.policy.status}`), context.policyDecisions.filter((entry) => entry.policy.status !== "AUTO_EXECUTE").map((entry) => entry.policy.rationale), [policyArtifact(context)], 0.86);
    case "execution-operator-agent":
      return buildAgentResult(agentId, "Execution Operator Agent", "Keeps execution in the right plane with queue, worker and runtime health visible.", [
        `Execution plane trust: ${context.controlTower.health.trustScore}.`,
        `Queue pressure: ${context.controlTower.totals.queuedItems}.`,
        `Dead letters: ${context.controlTower.totals.deadLetters}.`
      ], context.decisionResult.actions.slice(0, 5).map((action) => action.title), [runtimeArtifact(context)], 0.8);
  }
}

function buildAgentResult(
  agentId: SpecialistAgentId,
  title: string,
  summary: string,
  findings: string[],
  recommendations: string[],
  artifacts: AigentLionArtifact[],
  confidence: number
): SpecialistAgentResult {
  return {
    agentId,
    title,
    summary,
    findings: findings.filter(Boolean).slice(0, 6),
    recommendations: recommendations.filter(Boolean).slice(0, 6),
    artifacts,
    confidence: Number(Math.max(0.3, Math.min(0.98, confidence)).toFixed(2)),
    risks: artifacts
      .flatMap((artifact) => {
        const risks = artifact.payload.risks;
        return Array.isArray(risks) ? risks.map(String) : [];
      })
      .slice(0, 4)
  };
}

function strategyArtifacts(context: AigentLionIntelligenceContext): AigentLionArtifact[] {
  return [
    {
      id: `strategy-${context.workspace.company.slug}`,
      type: "strategy",
      title: "CMO Thesis",
      summary: context.cmoDecision.weeklyThesis,
      payload: {
        primaryBet: context.cmoDecision.primaryBet,
        focusMetric: context.cmoDecision.focusMetric,
        expectedImpact: inferExpectedImpact(context)
      },
      confidence: context.cmoDecision.confidence,
      source: "cmo-agent"
    }
  ];
}

function inferExpectedImpact(context: AigentLionIntelligenceContext) {
  const bestScorecard = [...context.cmoDecision.scorecards].sort((left, right) => right.score - left.score)[0];

  if (bestScorecard) {
    return `Priorizar ${bestScorecard.channel} pode mover score de crescimento com ${bestScorecard.score}/100.`;
  }

  return `Melhorar ${context.cmoDecision.focusMetric} atacando ${context.cmoDecision.dominantConstraint}.`;
}

function campaignArtifact(context: AigentLionIntelligenceContext): AigentLionArtifact {
  return {
    id: context.campaignOS.id,
    type: "campaign_os",
    title: "Campaign OS",
    summary: context.campaignOS.brief.executiveSummary,
    payload: {
      readiness: context.campaignOS.launchReadiness,
      channels: context.campaignOS.channels,
      experiments: context.campaignOS.experiments,
      risks: context.campaignOS.risks
    },
    confidence: context.campaignOS.launchReadiness.score / 100,
    source: "campaign-os"
  };
}

function copyArtifact(asset: AigentLionIntelligenceContext["campaignOS"]["copyAssets"][number]): AigentLionArtifact {
  return {
    id: asset.id,
    type: "campaign_os",
    title: asset.headline,
    summary: asset.primaryText,
    payload: { asset },
    source: "copy-chief-agent"
  };
}

function socialArtifact(id: string, title: string, summary: string): AigentLionArtifact {
  return {
    id,
    type: "execution_plan",
    title,
    summary,
    payload: { status: "pending_approval" },
    source: "social-growth-agent"
  };
}

function imageArtifact(asset: AigentLionIntelligenceContext["campaignOS"]["visualAssets"][number]): AigentLionArtifact {
  return {
    id: asset.id,
    type: "image_prompt",
    title: `${asset.provider} prompt`,
    summary: asset.prompt,
    payload: { asset, risks: asset.complianceRisks },
    source: "image-prompt-agent"
  };
}

function videoArtifact(asset: AigentLionIntelligenceContext["campaignOS"]["videoAssets"][number]): AigentLionArtifact {
  return {
    id: asset.id,
    type: "video_script",
    title: asset.hook,
    summary: asset.script,
    payload: { asset },
    source: "video-script-agent"
  };
}

function analyticsArtifact(context: AigentLionIntelligenceContext): AigentLionArtifact {
  return {
    id: `analytics-${context.workspace.company.slug}`,
    type: "analytics_plan",
    title: "Analytics Plan",
    summary: context.campaignOS.analyticsPlan.baselineSummary,
    payload: context.campaignOS.analyticsPlan,
    source: "analytics-agent"
  };
}

function memoryArtifact(context: AigentLionIntelligenceContext): AigentLionArtifact {
  return {
    id: `memory-${context.workspace.company.slug}`,
    type: "learning_memory",
    title: "Strategic Memory",
    summary: context.strategicMemory.recentLearnings[0] ?? "No fresh learning yet.",
    payload: context.strategicMemory,
    confidence: context.strategicMemory.confidence,
    source: "learning-agent"
  };
}

function policyArtifact(context: AigentLionIntelligenceContext): AigentLionArtifact {
  return {
    id: `policy-${context.workspace.company.slug}`,
    type: "policy_review",
    title: "Risk & Policy Shield",
    summary: `${context.policyDecisions.length} actions evaluated before execution.`,
    payload: {
      decisions: context.policyDecisions.map((entry) => ({
        actionId: entry.action.id,
        title: entry.action.title,
        status: entry.policy.status,
        reasonCodes: entry.policy.reasonCodes,
        requiredApprovers: entry.policy.requiredApprovers
      }))
    },
    source: "compliance-guardian-agent"
  };
}

function runtimeArtifact(context: AigentLionIntelligenceContext): AigentLionArtifact {
  return {
    id: `runtime-${context.workspace.company.slug}`,
    type: "execution_plan",
    title: "Execution Plane",
    summary: `Worker ${context.controlTower.workerHealth.status}, runtime ${context.controlTower.health.runtimeStatus}, trust ${context.controlTower.health.trustScore}.`,
    payload: {
      health: context.controlTower.health,
      queuePressure: context.controlTower.queuePressure,
      workerHealth: context.controlTower.workerHealth
    },
    source: "execution-operator-agent"
  };
}
