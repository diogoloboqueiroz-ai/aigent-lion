import type {
  CampaignChannelKey,
  CampaignIntelligenceBriefRecord,
  CampaignVisualPrompt
} from "@/core/marketing/campaign-intelligence";
import type {
  CompanyWorkspace,
  ScheduledSocialPost,
  SocialAdDraft,
  SocialPlatformId
} from "@/lib/domain";

export type CampaignActivationPlan = {
  id: string;
  companySlug: string;
  sourceBriefId: string;
  sourceBriefVersion: number;
  createdAt: string;
  createdBy: string;
  scheduledPosts: ScheduledSocialPost[];
  socialAdDrafts: SocialAdDraft[];
  warnings: string[];
  rationale: string;
};

type BuildCampaignActivationPlanInput = {
  workspace: CompanyWorkspace;
  brief: CampaignIntelligenceBriefRecord;
  actor: string;
  createdAt?: string;
};

export function buildCampaignActivationPlan(
  input: BuildCampaignActivationPlanInput
): CampaignActivationPlan {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const organicPrompts = input.brief.visualPrompts.filter((prompt) => isOrganicSocialChannel(prompt.platform));
  const paidPrompts = input.brief.visualPrompts.filter((prompt) => isPaidSocialChannel(prompt.platform));
  const scheduledPosts = organicPrompts
    .slice(0, 3)
    .map((prompt, index) => buildScheduledPost(input, prompt, index, createdAt));
  const socialAdDrafts = paidPrompts
    .slice(0, 2)
    .map((prompt, index) => buildSocialAdDraft(input, prompt, index, createdAt));
  const warnings = buildWarnings(input, scheduledPosts, socialAdDrafts);

  return {
    id: `campaign-activation-${input.workspace.company.slug}-${input.brief.version}-${Date.parse(createdAt) || Date.now()}`,
    companySlug: input.workspace.company.slug,
    sourceBriefId: input.brief.id,
    sourceBriefVersion: input.brief.version,
    createdAt,
    createdBy: input.actor,
    scheduledPosts,
    socialAdDrafts,
    warnings,
    rationale:
      "A ativacao prepara drafts operacionais a partir do brief, mas preserva aprovacao humana/policy antes de qualquer publicacao ou spend."
  };
}

function buildScheduledPost(
  input: BuildCampaignActivationPlanInput,
  prompt: CampaignVisualPrompt,
  index: number,
  createdAt: string
): ScheduledSocialPost {
  const platform = mapToSocialPlatform(prompt.platform) ?? "instagram";
  const angle = input.brief.copyAngles.find((entry) => entry.id === prompt.sourceAngleId) ?? input.brief.copyAngles[0];
  const scheduledFor = addDays(createdAt, 2 + index).toISOString();

  return {
    id: `campaign-post-${input.brief.id}-v${input.brief.version}-${platform}-${index + 1}`,
    companySlug: input.workspace.company.slug,
    platform,
    title: `${input.brief.companyName}: ${angle?.title ?? "Campanha estrategica"}`,
    format: mapPromptToPostFormat(prompt),
    scheduledFor,
    createdWith: "openai-api",
    summary: `Draft criado pelo Campaign Intelligence a partir do brief v${input.brief.version}. Nao publicar sem approval.`,
    caption: buildCaption(input, prompt),
    sourceExperimentId: input.brief.experiments[0]?.id,
    sourceCampaignBriefId: input.brief.id,
    sourceCampaignBriefVersion: input.brief.version,
    variantLabel: angle?.title,
    status: "pending_approval",
    requestedBy: input.actor,
    requiresApproval: true
  };
}

function buildSocialAdDraft(
  input: BuildCampaignActivationPlanInput,
  prompt: CampaignVisualPrompt,
  index: number,
  createdAt: string
): SocialAdDraft {
  const platform = mapToPaidSocialPlatform(prompt.platform);
  const angle = input.brief.copyAngles.find((entry) => entry.id === prompt.sourceAngleId) ?? input.brief.copyAngles[0];
  const scheduledStart = addDays(createdAt, 3 + index).toISOString();

  return {
    id: `campaign-ad-${input.brief.id}-v${input.brief.version}-${platform}-${index + 1}`,
    companySlug: input.workspace.company.slug,
    platform,
    title: `${input.brief.companyName}: ${angle?.title ?? "Teste de campanha"}`,
    objective: input.brief.objective,
    budget: input.workspace.strategyPlan.monthlyBudget || "Definir cap antes de launch",
    audience: input.workspace.agentProfile.idealCustomerProfile,
    creativeAngle: angle?.promise ?? input.brief.primaryBet,
    callToAction: angle?.callToAction ?? "Solicitar diagnostico",
    headline: angle?.title,
    description: prompt.prompt,
    landingUrl: input.workspace.siteOpsProfile.landingPageUrls[0] ?? input.workspace.siteOpsProfile.primarySiteUrl,
    keywordThemes: input.workspace.keywordStrategy.primaryKeywords.slice(0, 6),
    sourceExperimentId: input.brief.experiments[0]?.id,
    sourceCampaignBriefId: input.brief.id,
    sourceCampaignBriefVersion: input.brief.version,
    variantLabel: angle?.title,
    scheduledStart,
    status: "pending_approval",
    requestedBy: input.actor,
    requiresApproval: true
  };
}

function buildCaption(
  input: BuildCampaignActivationPlanInput,
  prompt: CampaignVisualPrompt
) {
  const angle = input.brief.copyAngles.find((entry) => entry.id === prompt.sourceAngleId) ?? input.brief.copyAngles[0];
  const proof = angle?.proof[0] ? `\n\nProva: ${angle.proof[0]}` : "";
  const cta = angle?.callToAction ? `\n\n${angle.callToAction}` : "";

  return `${angle?.promise ?? input.brief.primaryBet}${proof}${cta}`;
}

function buildWarnings(
  input: BuildCampaignActivationPlanInput,
  scheduledPosts: ScheduledSocialPost[],
  socialAdDrafts: SocialAdDraft[]
) {
  const warnings = new Set<string>();

  if (scheduledPosts.length === 0 && socialAdDrafts.length === 0) {
    warnings.add("Nenhum draft foi criado porque o brief ainda nao tem prompts visuais para canais sociais/ads.");
  }

  for (const risk of input.brief.risks.slice(0, 3)) {
    warnings.add(risk);
  }

  if (input.workspace.agentProfile.forbiddenClaims.length > 0) {
    warnings.add("Claims proibidos configurados; drafts entram como pending_approval.");
  }

  if (input.workspace.crmProfile.requireConsentForAds && socialAdDrafts.length > 0) {
    warnings.add("Validar consentimento antes de usar audiencia ou remarketing em ads.");
  }

  return Array.from(warnings);
}

function mapPromptToPostFormat(prompt: CampaignVisualPrompt): ScheduledSocialPost["format"] {
  if (prompt.assetType === "video") {
    return prompt.platform === "youtube" ? "short" : "reel";
  }

  if (prompt.assetType === "carousel") {
    return "carousel";
  }

  return "image";
}

function isOrganicSocialChannel(channel: CampaignChannelKey) {
  return ["instagram", "facebook", "linkedin", "tiktok", "youtube"].includes(channel);
}

function isPaidSocialChannel(channel: CampaignChannelKey) {
  return ["meta", "facebook", "instagram", "google-ads"].includes(channel);
}

function mapToSocialPlatform(channel: CampaignChannelKey): SocialPlatformId | undefined {
  if (channel === "meta") {
    return "facebook";
  }

  if (["instagram", "facebook", "linkedin", "tiktok", "youtube", "google-ads", "google-business"].includes(channel)) {
    return channel as SocialPlatformId;
  }

  return undefined;
}

function mapToPaidSocialPlatform(channel: CampaignChannelKey): SocialPlatformId {
  if (channel === "google-ads") {
    return "google-ads";
  }

  if (channel === "instagram") {
    return "instagram";
  }

  return "facebook";
}

function addDays(value: string, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}
