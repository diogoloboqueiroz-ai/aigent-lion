import { buildMultimodalCreativePackage } from "@/core/creative/multimodal-creative-engine";
import type { CreativeBriefInput } from "@/core/creative/creative-types";
import { buildCampaignActivationPlan } from "@/core/marketing/campaign-activation";
import {
  buildCampaignIntelligenceBrief,
  materializeCampaignIntelligenceBrief
} from "@/core/marketing/campaign-intelligence";
import type {
  CampaignAnalyticsPlan,
  CampaignChannelPlan,
  CampaignExperimentPlan,
  CampaignFunnelStage,
  CampaignIntelligenceBrief,
  CampaignIntelligenceBriefRecord
} from "@/core/marketing/campaign-intelligence";
import type {
  CompanyCmoStrategicDecision,
  CompanyWorkspace,
  ScheduledSocialPost,
  SocialAdDraft
} from "@/lib/domain";

export type CampaignCopyAsset = {
  id: string;
  channel: string;
  funnelStage: string;
  headline: string;
  primaryText: string;
  callToAction: string;
  landingSectionOutline: string[];
  proofPoints: string[];
};

export type CampaignVideoAsset = {
  id: string;
  platform: string;
  hook: string;
  script: string;
  storyboard: string[];
  thumbnailPrompt: string;
};

export type CampaignLaunchReadiness = {
  score: number;
  status: "ready" | "needs_approval" | "needs_connection" | "blocked";
  blockers: string[];
  warnings: string[];
  policyNotes: string[];
};

export type FullCampaignOS = {
  id: string;
  companySlug: string;
  generatedAt: string;
  brief: CampaignIntelligenceBrief;
  materializedBrief: CampaignIntelligenceBriefRecord;
  funnel: CampaignFunnelStage[];
  channels: CampaignChannelPlan[];
  copyAssets: CampaignCopyAsset[];
  visualAssets: ReturnType<typeof buildMultimodalCreativePackage>["imagePrompts"];
  videoAssets: CampaignVideoAsset[];
  socialCalendar: ScheduledSocialPost[];
  adDrafts: SocialAdDraft[];
  experiments: CampaignExperimentPlan[];
  analyticsPlan: CampaignAnalyticsPlan;
  approvalPlan: {
    required: boolean;
    items: Array<{
      type: "social_post" | "ad_draft" | "creative_qa" | "policy";
      title: string;
      reason: string;
    }>;
  };
  launchReadiness: CampaignLaunchReadiness;
  risks: string[];
  creativeQaScore: number;
};

export function buildFullCampaignOS(input: {
  workspace: CompanyWorkspace;
  cmoDecision?: CompanyCmoStrategicDecision;
  actor: string;
  generatedAt?: string;
}): FullCampaignOS {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const brief = buildCampaignIntelligenceBrief({
    workspace: input.workspace,
    cmoDecision: input.cmoDecision,
    generatedAt
  });
  const materializedBrief = materializeCampaignIntelligenceBrief({
    brief,
    actor: input.actor,
    previousVersion: 0,
    source: "worker",
    savedAt: generatedAt
  });
  const activation = buildCampaignActivationPlan({
    workspace: input.workspace,
    brief: materializedBrief,
    actor: input.actor,
    createdAt: generatedAt
  });
  const creativePackage = buildMultimodalCreativePackage({
    companySlug: input.workspace.company.slug,
    generatedAt,
    briefs: buildCreativeBriefInputs(input.workspace, brief)
  });
  const copyAssets = buildCopyAssets(brief);
  const readiness = buildLaunchReadiness({
    brief,
    activationWarnings: activation.warnings,
    creativeRisks: creativePackage.risks,
    qaScore: average(creativePackage.qaResults.map((result) => result.score))
  });

  return {
    id: `campaign-os-${input.workspace.company.slug}-${Date.parse(generatedAt) || Date.now()}`,
    companySlug: input.workspace.company.slug,
    generatedAt,
    brief,
    materializedBrief,
    funnel: brief.funnel,
    channels: brief.channels,
    copyAssets,
    visualAssets: creativePackage.imagePrompts,
    videoAssets: creativePackage.videoScripts.map((script) => ({
      id: script.id,
      platform: script.platform,
      hook: script.hook,
      script: script.shortScript,
      storyboard: script.storyboard.map(
        (scene) => `${scene.scene}. ${scene.visual} | ${scene.onScreenText}`
      ),
      thumbnailPrompt: script.thumbnailPrompt
    })),
    socialCalendar: activation.scheduledPosts,
    adDrafts: activation.socialAdDrafts,
    experiments: brief.experiments,
    analyticsPlan: brief.analyticsPlan,
    approvalPlan: buildApprovalPlan(activation, creativePackage.risks, readiness),
    launchReadiness: readiness,
    risks: [...brief.risks, ...activation.warnings, ...creativePackage.risks].slice(0, 12),
    creativeQaScore: readiness.score
  };
}

function buildCreativeBriefInputs(
  workspace: CompanyWorkspace,
  brief: CampaignIntelligenceBrief
): CreativeBriefInput[] {
  const guardrails = [
    ...workspace.agentProfile.forbiddenClaims.map((claim) => `Do not use claim: ${claim}`),
    ...brief.risks.slice(0, 3)
  ];

  return brief.visualPrompts.slice(0, 4).map((prompt, index) => {
    const angle = brief.copyAngles.find((entry) => entry.id === prompt.sourceAngleId) ?? brief.copyAngles[index] ?? brief.copyAngles[0];
    return {
      companyName: brief.companyName,
      objective: brief.objective,
      platform: prompt.platform,
      format: prompt.format,
      audience: angle?.audience ?? workspace.agentProfile.idealCustomerProfile,
      promise: angle?.promise ?? brief.primaryBet,
      proof: angle?.proof ?? workspace.agentProfile.differentiators.slice(0, 3),
      callToAction: angle?.callToAction ?? "Solicitar diagnostico",
      guardrails,
      visualStyle: prompt.prompt,
      emotion: "trust, momentum and executive clarity",
      colorSystem: "dark premium, emerald accents, warm gold highlights"
    };
  });
}

function buildCopyAssets(brief: CampaignIntelligenceBrief): CampaignCopyAsset[] {
  return brief.copyAngles.slice(0, 6).map((angle, index) => ({
    id: `copy-asset-${brief.id}-${index + 1}`,
    channel: brief.channels[index % Math.max(brief.channels.length, 1)]?.channel ?? "meta",
    funnelStage: angle.funnelStage,
    headline: angle.title,
    primaryText: `${angle.promise}. ${angle.proof.slice(0, 2).join(" ")} ${angle.callToAction}`.trim(),
    callToAction: angle.callToAction,
    landingSectionOutline: [
      `Hero: ${angle.promise}`,
      `Proof: ${angle.proof[0] ?? "evidencia operacional"}`,
      `Objection handling for ${angle.audience}`,
      `CTA: ${angle.callToAction}`
    ],
    proofPoints: angle.proof
  }));
}

function buildLaunchReadiness(input: {
  brief: CampaignIntelligenceBrief;
  activationWarnings: string[];
  creativeRisks: string[];
  qaScore: number;
}): CampaignLaunchReadiness {
  const blockers = [
    ...input.brief.risks.filter((risk) => /blocked|bloque|conect|tracking/i.test(risk)),
    ...input.activationWarnings.filter((risk) => /bloque|conect|approval/i.test(risk))
  ];
  const warnings = [
    ...input.brief.risks.filter((risk) => !blockers.includes(risk)),
    ...input.creativeRisks
  ].slice(0, 8);
  const score = Math.max(
    0,
    Math.min(100, Math.round(input.brief.readinessScore * 0.62 + input.qaScore * 0.38 - blockers.length * 12))
  );

  return {
    score,
    status:
      blockers.length > 0
        ? "needs_connection"
        : score >= 78
          ? "needs_approval"
          : warnings.length > 3
            ? "blocked"
            : "needs_approval",
    blockers,
    warnings,
    policyNotes: [
      "All posts and ads generated by Campaign OS stay approval-gated.",
      "Spend and sensitive claims must pass policy review before launch.",
      "Runtime execution must preserve sourceCampaignBriefId for learning."
    ]
  };
}

function buildApprovalPlan(
  activation: ReturnType<typeof buildCampaignActivationPlan>,
  creativeRisks: string[],
  readiness: CampaignLaunchReadiness
) {
  const items = [
    ...activation.scheduledPosts.map((post) => ({
      type: "social_post" as const,
      title: post.title,
      reason: "Organic post prepared by Campaign OS and waiting for publishing approval."
    })),
    ...activation.socialAdDrafts.map((draft) => ({
      type: "ad_draft" as const,
      title: draft.title,
      reason: "Paid media draft requires approval before spend or external mutation."
    })),
    ...creativeRisks.slice(0, 3).map((risk) => ({
      type: "creative_qa" as const,
      title: "Creative QA review",
      reason: risk
    })),
    ...readiness.policyNotes.map((note) => ({
      type: "policy" as const,
      title: "Policy Shield",
      reason: note
    }))
  ];

  return {
    required: items.length > 0,
    items
  };
}

function average(values: number[]) {
  if (values.length === 0) {
    return 70;
  }

  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}
