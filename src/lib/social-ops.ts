import {
  getStoredCompanySocialProfile,
  getStoredGoogleCompanyConnection,
  getStoredScheduledSocialPosts,
  getStoredSocialAdDrafts,
  getStoredSocialCompanyConnection,
  getStoredSocialInsights,
  isVaultConfigured
} from "@/lib/company-vault";
import type {
  CompanyCreativeAsset,
  CompanyProfile,
  CompanySocialOpsProfile,
  CreativeToolProvider,
  PublishingApprovalRequest,
  ScheduledSocialPost,
  SocialAdDraft,
  SocialInsightSnapshot,
  SocialPlatformConnection,
  SocialPlatformId,
  UserProfessionalProfile
} from "@/lib/domain";
import { hasGoogleConnectionOAuthConfigured } from "@/lib/google-connections";
import {
  getGooglePlatformForSocialPlatform,
  getSocialAuthProvider,
  hasSocialOAuthConfigured
} from "@/lib/social-auth";

const defaultPlatforms: SocialPlatformId[] = [
  "instagram",
  "facebook",
  "google-ads",
  "google-business",
  "linkedin",
  "tiktok",
  "youtube"
];

export function getCompanySocialOpsProfile(
  company: CompanyProfile,
  professionalProfile?: UserProfessionalProfile | null
): CompanySocialOpsProfile {
  const stored = getStoredCompanySocialProfile(company.slug);
  if (stored) {
    return stored;
  }

  return {
    companySlug: company.slug,
    status: "seeded",
    updatedAt: new Date().toISOString(),
    primaryObjective: `Crescer a presenca de ${company.name} em redes sociais com estrategia, consistencia e eficiencia.`,
    publishingCadence: professionalProfile?.planningCadence ?? "Calendario semanal com revisao diaria",
    autonomyRule:
      "O agente pode criar calendarios, rascunhos, agendas e leituras de performance. Publicacoes podem ser programadas e gastos em anuncios exigem aprovacao.",
    approvalRule:
      "Posts programados seguem a fila de aprovacao quando configurado. Anuncios e qualquer spend exigem liberacao explicita antes do lancamento.",
    schedulingPolicy:
      "Programar posts com antecedencia, priorizando janelas de maior alcance e respeitando aprovacoes antes de publicar.",
    analyticsRoutine:
      "Consolidar alcance, engajamento, cliques, leads e aprendizados por plataforma com revisao semanal.",
    priorityPlatforms: defaultPlatforms,
    contentPillars: [
      "Autoridade e educacao",
      "Prova social",
      "Oferta e chamada para acao",
      "Conteudo de engajamento"
    ],
    adObjectives: [
      "Alcance qualificado",
      "Leads",
      "Remarketing",
      "Conversao com criativos vencedores"
    ],
    audienceNotes: [
      "Adaptar linguagem por plataforma.",
      "Usar criativos nativos e mobile first.",
      "Aprender com comentarios, engajamento e formatos de maior retencao."
    ]
  };
}

export function parseSocialProfileForm(formData: FormData, current: CompanySocialOpsProfile) {
  return {
    ...current,
    status: "customized" as const,
    updatedAt: new Date().toISOString(),
    primaryObjective: String(formData.get("primaryObjective") ?? current.primaryObjective),
    publishingCadence: String(formData.get("publishingCadence") ?? current.publishingCadence),
    autonomyRule: String(formData.get("autonomyRule") ?? current.autonomyRule),
    approvalRule: String(formData.get("approvalRule") ?? current.approvalRule),
    schedulingPolicy: String(formData.get("schedulingPolicy") ?? current.schedulingPolicy),
    analyticsRoutine: String(formData.get("analyticsRoutine") ?? current.analyticsRoutine),
    priorityPlatforms: parseSocialPlatforms(String(formData.get("priorityPlatforms") ?? "")),
    contentPillars: textareaToList(formData.get("contentPillars")),
    adObjectives: textareaToList(formData.get("adObjectives")),
    audienceNotes: textareaToList(formData.get("audienceNotes"))
  };
}

export function getCompanySocialPlatforms(company: CompanyProfile): SocialPlatformConnection[] {
  return [
    buildPlatform(company, "instagram", "Instagram", "api_ready", "mixed", ["posts", "stories", "reels", "insights", "calendar"], `${company.name} - Instagram`),
    buildPlatform(company, "facebook", "Facebook", "api_ready", "api_ready", ["posts", "stories", "page insights", "scheduled content"], `${company.name} - Facebook Page`),
    buildPlatform(company, "google-ads", "Google Ads", "api_ready", "api_ready", ["campaigns", "ad groups", "keywords", "assets", "budgets"], `${company.name} - Google Ads`),
    buildPlatform(company, "google-business", "Google Business Profile", "api_ready", "api_ready", ["updates", "local profile", "reviews", "insights"], `${company.name} - Perfil da Empresa`),
    buildPlatform(company, "linkedin", "LinkedIn", "api_ready", "mixed", ["organization posts", "images", "videos", "analytics"], `${company.name} - LinkedIn`),
    buildPlatform(company, "tiktok", "TikTok", "api_ready", "mixed", ["short video", "creator style posts", "insights", "content queue"], `${company.name} - TikTok`),
    buildPlatform(company, "youtube", "YouTube", "api_ready", "api_ready", ["videos", "shorts", "thumbnails", "studio metrics"], `${company.name} - YouTube`)
  ].map((platform) => hydratePlatform(company.slug, platform));
}

export function getCompanyScheduledPosts(companySlug: string) {
  return getStoredScheduledSocialPosts(companySlug).sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
}

export function getCompanySocialAdDrafts(companySlug: string) {
  return getStoredSocialAdDrafts(companySlug).sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
}

export function getCompanySocialInsights(company: CompanyProfile): SocialInsightSnapshot[] {
  const storedInsights = getStoredSocialInsights(company.slug).sort((a, b) => {
    if (a.platform === b.platform) {
      return a.window.localeCompare(b.window);
    }

    return a.platform.localeCompare(b.platform);
  });

  if (storedInsights.length > 0) {
    return storedInsights;
  }

  return [
    insight(company.slug, "instagram", "7d", "12.4k", "84k", "4.8%", "1.9k", "43", "Reels e carrosseis puxaram o alcance da semana."),
    insight(company.slug, "facebook", "7d", "9.1k", "52k", "3.6%", "980", "28", "Posts educativos tiveram melhor clique para WhatsApp."),
    insight(company.slug, "google-business", "28d", "n/a", "18k", "6.4%", "620", "35", "Acoes locais e rota/ligacao seguem relevantes."),
    insight(company.slug, "linkedin", "28d", "4.3k", "21k", "5.1%", "420", "19", "Conteudo de autoridade gera boa interacao B2B."),
    insight(company.slug, "tiktok", "7d", "7.8k", "110k", "6.9%", "1.3k", "24", "Videos curtos e hooks fortes puxam descoberta."),
    insight(company.slug, "youtube", "28d", "2.2k", "37k", "4.1%", "510", "17", "Shorts ganham volume; videos longos trazem autoridade.")
  ];
}

export function buildScheduledSocialPost(input: {
  company: CompanyProfile;
  platform: SocialPlatformId;
  title: string;
  format: ScheduledSocialPost["format"];
  scheduledFor: string;
  createdWith: CreativeToolProvider;
  summary: string;
  caption?: string;
  assetUrl?: string;
  assetUrls?: string[];
  landingUrl?: string;
  sourceApprovalRequestId?: string;
  sourceAssetId?: string;
  sourceAssetVersionId?: string;
  sourceExperimentId?: string;
  variantLabel?: string;
  requestedBy: string;
  status?: ScheduledSocialPost["status"];
  approvedAt?: string;
}) {
  return {
    id: `social-post-${input.company.slug}-${Date.now()}`,
    companySlug: input.company.slug,
    platform: input.platform,
    title: input.title,
    format: input.format,
    scheduledFor: input.scheduledFor,
    createdWith: input.createdWith,
    summary: input.summary,
    caption: input.caption,
    assetUrl: input.assetUrl,
    assetUrls: normalizeAssetUrls(input.assetUrls, input.assetUrl),
    landingUrl: input.landingUrl,
    sourceApprovalRequestId: input.sourceApprovalRequestId,
    sourceAssetId: input.sourceAssetId,
    sourceAssetVersionId: input.sourceAssetVersionId,
    sourceExperimentId: input.sourceExperimentId,
    variantLabel: input.variantLabel,
    status: input.status ?? ("pending_approval" as const),
    requestedBy: input.requestedBy,
    requiresApproval: true as const,
    approvedAt: input.approvedAt
  };
}

export function buildScheduledSocialPostFromPublishingRequest(input: {
  company: CompanyProfile;
  request: PublishingApprovalRequest;
  sourceAsset?: CompanyCreativeAsset;
  requestedBy: string;
}) {
  const studioApprovalSatisfied = input.request.status === "approved" || input.request.status === "posted";
  const sourceVersion =
    input.sourceAsset?.versions.find((version) => version.id === input.request.sourceAssetVersionId) ??
    input.sourceAsset?.versions.find((version) => version.id === input.sourceAsset?.latestVersionId) ??
    input.sourceAsset?.versions[0];

  return buildScheduledSocialPost({
    company: input.company,
    platform: input.request.platformHint ?? "instagram",
    title: input.request.title,
    format: mapPublishingAssetTypeToPostFormat(input.request.assetType),
    scheduledFor: input.request.scheduledFor ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    createdWith: input.request.createdWith,
    summary: input.request.summary,
    caption: input.request.caption,
    assetUrl: input.request.assetUrl,
    assetUrls: input.request.assetUrls,
    landingUrl: input.request.landingUrl,
    sourceApprovalRequestId: input.request.id,
    sourceAssetId: input.request.sourceAssetId,
    sourceAssetVersionId: input.request.sourceAssetVersionId,
    sourceExperimentId: input.sourceAsset?.sourceExperimentId,
    variantLabel: sourceVersion?.variantLabel,
    requestedBy: input.request.requestedBy || input.requestedBy,
    status: studioApprovalSatisfied ? "scheduled" : "pending_approval",
    approvedAt: studioApprovalSatisfied ? input.request.approvedAt ?? new Date().toISOString() : undefined
  });
}

export function buildScheduledSocialPostFromCreativeAsset(input: {
  company: CompanyProfile;
  asset: CompanyCreativeAsset;
  requestedBy: string;
}) {
  const latestVersion =
    input.asset.versions.find((version) => version.id === input.asset.latestVersionId) ?? input.asset.versions[0];
  const approvalSatisfied = latestVersion?.status === "approved" || latestVersion?.status === "published";

  return buildScheduledSocialPost({
    company: input.company,
    platform: input.asset.platformHint ?? "instagram",
    title: input.asset.title,
    format: mapPublishingAssetTypeToPostFormat(input.asset.assetType),
    scheduledFor: latestVersion?.scheduledFor ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    createdWith: input.asset.createdWith,
    summary: latestVersion?.summary ?? input.asset.summary,
    caption: latestVersion?.caption,
    assetUrl: latestVersion?.assetUrl,
    assetUrls: latestVersion?.assetUrls,
    landingUrl: latestVersion?.landingUrl,
    sourceAssetId: input.asset.id,
    sourceAssetVersionId: latestVersion?.id,
    sourceExperimentId: input.asset.sourceExperimentId,
    variantLabel: latestVersion?.variantLabel,
    requestedBy: input.requestedBy,
    status: approvalSatisfied ? "scheduled" : "pending_approval",
    approvedAt: approvalSatisfied ? new Date().toISOString() : undefined
  });
}

export function buildSocialAdDraft(input: {
  company: CompanyProfile;
  platform: SocialPlatformId;
  title: string;
  objective: string;
  budget: string;
  audience: string;
  creativeAngle: string;
  callToAction: string;
  headline?: string;
  description?: string;
  assetUrl?: string;
  assetUrls?: string[];
  landingUrl?: string;
  keywordThemes?: string[];
  sourceAssetId?: string;
  sourceAssetVersionId?: string;
  sourceExperimentId?: string;
  variantLabel?: string;
  scheduledStart: string;
  requestedBy: string;
  status?: SocialAdDraft["status"];
  approvedAt?: string;
}) {
  return {
    id: `social-ad-${input.company.slug}-${Date.now()}`,
    companySlug: input.company.slug,
    platform: input.platform,
    title: input.title,
    objective: input.objective,
    budget: input.budget,
    audience: input.audience,
    creativeAngle: input.creativeAngle,
    callToAction: input.callToAction,
    headline: input.headline,
    description: input.description,
    assetUrl: input.assetUrl,
    assetUrls: normalizeAssetUrls(input.assetUrls, input.assetUrl),
    landingUrl: input.landingUrl,
    keywordThemes: input.keywordThemes?.filter(Boolean),
    sourceAssetId: input.sourceAssetId,
    sourceAssetVersionId: input.sourceAssetVersionId,
    sourceExperimentId: input.sourceExperimentId,
    variantLabel: input.variantLabel,
    scheduledStart: input.scheduledStart,
    status: input.status ?? ("pending_approval" as const),
    requestedBy: input.requestedBy,
    requiresApproval: true as const,
    approvedAt: input.approvedAt
  };
}

export function buildSocialAdDraftFromCreativeAsset(input: {
  company: CompanyProfile;
  asset: CompanyCreativeAsset;
  requestedBy: string;
}) {
  const latestVersion =
    input.asset.versions.find((version) => version.id === input.asset.latestVersionId) ?? input.asset.versions[0];
  const approvalSatisfied = latestVersion?.status === "approved" || latestVersion?.status === "published";
  const platform = mapCreativeAssetToAdPlatform(input.asset.platformHint);

  return buildSocialAdDraft({
    company: input.company,
    platform,
    title: input.asset.title,
    objective: "Geracao de leads",
    budget: "R$ 120/dia",
    audience: "Publico qualificado definido pelo Agent Lion a partir do ICP e sinais recentes.",
    creativeAngle: latestVersion?.summary ?? input.asset.summary,
    callToAction: "Falar com a equipe agora",
    headline: input.asset.title,
    description: latestVersion?.caption ?? latestVersion?.summary ?? input.asset.summary,
    assetUrl: latestVersion?.assetUrl,
    assetUrls: latestVersion?.assetUrls,
    landingUrl: latestVersion?.landingUrl,
    keywordThemes:
      platform === "google-ads"
        ? buildKeywordThemesFromCreativeAsset(input.asset, latestVersion?.summary ?? input.asset.summary)
        : undefined,
    sourceAssetId: input.asset.id,
    sourceAssetVersionId: latestVersion?.id,
    sourceExperimentId: input.asset.sourceExperimentId,
    variantLabel: latestVersion?.variantLabel,
    scheduledStart: latestVersion?.scheduledFor ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    requestedBy: input.requestedBy,
    status: approvalSatisfied ? "approved" : "pending_approval",
    approvedAt: approvalSatisfied ? new Date().toISOString() : undefined
  });
}

export function approveScheduledSocialPost(post: ScheduledSocialPost) {
  return {
    ...post,
    status: "scheduled" as const,
    approvedAt: new Date().toISOString()
  };
}

export function rejectScheduledSocialPost(post: ScheduledSocialPost) {
  return {
    ...post,
    status: "rejected" as const,
    rejectedAt: new Date().toISOString()
  };
}

export function markScheduledSocialPostPosted(post: ScheduledSocialPost) {
  return {
    ...post,
    status: "posted" as const,
    postedAt: new Date().toISOString()
  };
}

export function approveSocialAdDraft(draft: SocialAdDraft) {
  return {
    ...draft,
    status: "approved" as const,
    approvedAt: new Date().toISOString()
  };
}

export function rejectSocialAdDraft(draft: SocialAdDraft) {
  return {
    ...draft,
    status: "rejected" as const,
    rejectedAt: new Date().toISOString()
  };
}

export function markSocialAdDraftLaunched(draft: SocialAdDraft) {
  return {
    ...draft,
    status: "launched" as const,
    launchedAt: new Date().toISOString()
  };
}

export function listToTextarea(values: string[]) {
  return values.join("\n");
}

function parseSocialPlatforms(value: string): SocialPlatformId[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry): entry is SocialPlatformId => defaultPlatforms.includes(entry as SocialPlatformId));
}

function textareaToList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildPlatform(
  company: CompanyProfile,
  platform: SocialPlatformId,
  label: string,
  publishingMode: SocialPlatformConnection["publishingMode"],
  analyticsMode: SocialPlatformConnection["analyticsMode"],
  capabilities: string[],
  accountLabel: string
): SocialPlatformConnection {
  return {
    id: `social-platform-${company.slug}-${platform}`,
    companySlug: company.slug,
    platform,
    label,
    status: "planned",
    publishingMode,
    analyticsMode,
    capabilities,
    accountLabel,
    nextAction: `Preparar conexao desta plataforma para agenda, insights e operacao especializada de ${label}.`
  };
}

function hydratePlatform(companySlug: string, platform: SocialPlatformConnection): SocialPlatformConnection {
  if (!isVaultConfigured()) {
    return platform;
  }

  const googlePlatform = getGooglePlatformForSocialPlatform(platform.platform);
  if (googlePlatform) {
    const googleConnection = getStoredGoogleCompanyConnection(companySlug, googlePlatform);

    if (googleConnection) {
      return {
        ...platform,
        status: "connected",
        accountLabel: googleConnection.accountEmail,
        nextAction: `Conexao Google pronta para ${googleConnection.accountEmail}. Proximo passo: mapear o recurso operacional desta empresa dentro de ${platform.label}.`
      };
    }

    return {
      ...platform,
      status: hasGoogleConnectionOAuthConfigured() ? "action_required" : "planned",
      nextAction: hasGoogleConnectionOAuthConfigured()
        ? `Conectar ${platform.label} via Google OAuth do agente para liberar agenda, insights e publicacao assistida.`
        : "Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET para liberar o onboarding Google desta plataforma."
    };
  }

  const provider = getSocialAuthProvider(platform.platform);
  if (!provider) {
    return platform;
  }

  const socialConnection = getStoredSocialCompanyConnection(companySlug, platform.platform);

  if (socialConnection) {
    return {
      ...platform,
      status: "connected",
      accountLabel: socialConnection.accountLabel,
      nextAction: `Conta conectada com escopos isolados para ${platform.label}. Proximo passo: ativar publicacao e leitura de estatisticas reais desta empresa.`
    };
  }

  return {
    ...platform,
    status: hasSocialOAuthConfigured(provider) ? "action_required" : "planned",
    nextAction: hasSocialOAuthConfigured(provider)
      ? `Conectar ${platform.label} via OAuth do agente para liberar agenda, anuncios e analytics reais desta empresa.`
      : `Configure as credenciais ${provider.toUpperCase()} do agente para iniciar o onboarding desta plataforma.`
  };
}

function insight(
  companySlug: string,
  platform: SocialPlatformId,
  window: SocialInsightSnapshot["window"],
  followers: string,
  reach: string,
  engagementRate: string,
  clicks: string,
  conversions: string,
  note: string
): SocialInsightSnapshot {
  return {
    companySlug,
    platform,
    window,
    followers,
    reach,
    engagementRate,
    clicks,
    conversions,
    note
  };
}

function mapPublishingAssetTypeToPostFormat(assetType: PublishingApprovalRequest["assetType"]): ScheduledSocialPost["format"] {
  switch (assetType) {
    case "video":
      return "video";
    case "carousel":
      return "carousel";
    default:
      return "image";
  }
}

function mapCreativeAssetToAdPlatform(platformHint?: CompanyCreativeAsset["platformHint"]): SocialPlatformId {
  if (platformHint === "facebook" || platformHint === "google-ads") {
    return platformHint;
  }

  return "instagram";
}

function buildKeywordThemesFromCreativeAsset(asset: CompanyCreativeAsset, summary: string) {
  return [asset.title, summary]
    .flatMap((value) => value.split(/[,.]| e | com /i))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 4)
    .slice(0, 6);
}

function normalizeAssetUrls(assetUrls: string[] | undefined, assetUrl?: string) {
  const values = [...(assetUrls ?? [])];

  if (assetUrl && !values.includes(assetUrl)) {
    values.unshift(assetUrl);
  }

  return values.length > 0 ? values : undefined;
}
