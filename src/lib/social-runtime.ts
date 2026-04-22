import {
  getStoredSocialPlatformBinding,
  getStoredSocialRuntimeTasks
} from "@/lib/company-vault";
import type {
  CompanyProfile,
  CompanySocialRuntime,
  ScheduledSocialPost,
  SocialAdDraft,
  SocialPlatformBinding,
  SocialPlatformConnection,
  SocialPlatformId,
  SocialRuntimeTask
} from "@/lib/domain";

const bindingConfig: Record<
  SocialPlatformId,
  {
    targetType: SocialPlatformBinding["targetType"];
    requirements: string[];
    note: string;
  }
> = {
  instagram: {
    targetType: "business_account",
    requirements: [
      "Definir o Instagram Business Account ID usado na publicacao.",
      "Definir o alvo analitico da conta para sincronizacao."
    ],
    note: "Instagram precisa apontar para o Instagram Business Account ID correto e, para posts com midia, exige asset publico final aprovado. Nesta fase a runtime publica feed, reel e story com URL publica aprovada."
  },
  facebook: {
    targetType: "page",
    requirements: [
      "Definir o Page ID oficial da empresa para publicacao.",
      "Definir o alvo analitico da pagina para insights.",
      "Mapear o ad account, o Page ID usado em anuncios e o pixel/evento quando houver operacao paga."
    ],
    note: "Facebook precisa de page binding claro para posts, agenda e estatisticas reais. Para anuncios, o Agent Lion tambem usa ad account, page_id e pixel/evento quando houver conversao."
  },
  "google-ads": {
    targetType: "customer",
    requirements: [
      "Definir o customer ID final da conta Google Ads.",
      "Opcionalmente informar o manager customer ID para chamadas via MCC.",
      "Definir um nome base de campanha e cap diario quando houver politica de budget."
    ],
    note: "Google Ads usa o customer ID da empresa como alvo operacional. A runtime pode criar budget, campanha, ad group, keywords e responsive search ad quando a conta estiver mapeada."
  },
  "google-business": {
    targetType: "location",
    requirements: [
      "Selecionar o recurso da ficha no formato accounts/{accountId}/locations/{locationId}.",
      "Opcionalmente informar analyticsTargetId como locations/{locationId} para performance; se ficar vazio, o Agent Lion extrai do recurso acima."
    ],
    note: "GBP publica local posts standard via localPosts e sincroniza performance real via Business Profile Performance API."
  },
  linkedin: {
    targetType: "organization",
    requirements: [
      "Cadastrar o organization URN da empresa.",
      "Confirmar o alvo analitico para posts e conteudo patrocinado."
    ],
    note: "LinkedIn costuma operar via organization URN para postagem e analytics B2B."
  },
  tiktok: {
    targetType: "business_account",
    requirements: [
      "Definir o identificador da conta/business account usada na publicacao.",
      "Definir o alvo analitico para sincronizacao de desempenho.",
      "Usar assets em URL publica de dominio verificado para Direct Post com PULL_FROM_URL."
    ],
    note: "TikTok opera Direct Post para video e fotos via URL publica e sincroniza followers e desempenho recente via Display APIs."
  },
  youtube: {
    targetType: "channel",
    requirements: [
      "Selecionar o channel ID que recebera os videos.",
      "Confirmar o alvo analitico do canal para shorts e videos."
    ],
    note: "YouTube usa upload resumable para videos e shorts, com thumbnail complementar quando houver asset de imagem. Para analytics real, a conexao precisa incluir youtube.readonly e yt-analytics.readonly."
  }
};

export function getCompanySocialBindings(
  company: CompanyProfile,
  platforms: SocialPlatformConnection[]
) {
  return platforms.map((platform) => hydrateBinding(company, platform));
}

export function getCompanySocialBinding(
  company: CompanyProfile,
  platform: SocialPlatformId,
  platforms?: SocialPlatformConnection[]
) {
  const availablePlatforms = platforms ?? [];
  const matchedPlatform =
    availablePlatforms.find((entry) => entry.platform === platform) ??
    ({
      id: `social-platform-${company.slug}-${platform}`,
      companySlug: company.slug,
      platform,
      label: platform,
      status: "planned",
      publishingMode: "playbook",
      analyticsMode: "manual_review",
      capabilities: [],
      accountLabel: `${company.name} - ${platform}`,
      nextAction: "Preparar configuracao operacional da plataforma."
    } satisfies SocialPlatformConnection);

  return hydrateBinding(company, matchedPlatform);
}

export function parseSocialBindingForm(formData: FormData, current: SocialPlatformBinding) {
  const targetId = String(formData.get("targetId") ?? current.targetId ?? "").trim();
  const analyticsTargetId = String(formData.get("analyticsTargetId") ?? current.analyticsTargetId ?? "").trim();
  const targetLabel = String(formData.get("targetLabel") ?? current.targetLabel).trim();
  const adAccountId = String(formData.get("adAccountId") ?? current.adAccountId ?? "").trim();
  const campaignLabel = String(formData.get("campaignLabel") ?? current.campaignLabel ?? "").trim();
  const campaignId = String(formData.get("campaignId") ?? current.campaignId ?? "").trim();
  const adSetId = String(formData.get("adSetId") ?? current.adSetId ?? "").trim();
  const adGroupId = String(formData.get("adGroupId") ?? current.adGroupId ?? "").trim();
  const pageId = String(formData.get("pageId") ?? current.pageId ?? "").trim();
  const instagramActorId = String(formData.get("instagramActorId") ?? current.instagramActorId ?? "").trim();
  const pixelId = String(formData.get("pixelId") ?? current.pixelId ?? "").trim();
  const conversionEvent = String(formData.get("conversionEvent") ?? current.conversionEvent ?? "").trim();
  const managerAccountId = String(formData.get("managerAccountId") ?? current.managerAccountId ?? "").trim();
  const dailyBudgetCap = String(formData.get("dailyBudgetCap") ?? current.dailyBudgetCap ?? "").trim();
  const status =
    current.status === "blocked"
      ? "blocked"
      : targetId
        ? "connected"
        : "needs_target";
  const analyticsReady =
    status !== "blocked" &&
    current.platform !== "google-ads" &&
    Boolean(analyticsTargetId || targetId);

  return {
    ...current,
    targetLabel,
    targetId: targetId || undefined,
    analyticsTargetId: analyticsTargetId || undefined,
    publishingReady: status !== "blocked" && Boolean(targetId),
    analyticsReady,
    paidMediaReady: status !== "blocked" && isPaidMediaBindingReady(current.platform, {
      targetId: targetId || undefined,
      adAccountId: adAccountId || undefined,
      pageId: pageId || undefined,
      instagramActorId: instagramActorId || undefined
    }),
    adAccountId: adAccountId || undefined,
    campaignLabel: campaignLabel || undefined,
    campaignId: campaignId || undefined,
    adSetId: adSetId || undefined,
    adGroupId: adGroupId || undefined,
    pageId: pageId || undefined,
    instagramActorId: instagramActorId || undefined,
    pixelId: pixelId || undefined,
    conversionEvent: conversionEvent || undefined,
    managerAccountId: managerAccountId || undefined,
    dailyBudgetCap: dailyBudgetCap || undefined,
    status,
    note: String(formData.get("note") ?? current.note),
    updatedAt: new Date().toISOString()
  } satisfies SocialPlatformBinding;
}

function isPaidMediaBindingReady(
  platform: SocialPlatformId,
  input: {
    targetId?: string;
    adAccountId?: string;
    pageId?: string;
    instagramActorId?: string;
  }
) {
  if (platform === "google-ads") {
    return Boolean(input.targetId);
  }

  if (platform === "facebook") {
    return Boolean(input.adAccountId && (input.pageId || input.targetId));
  }

  if (platform === "instagram") {
    return Boolean(input.adAccountId && input.pageId && (input.instagramActorId || input.targetId));
  }

  return false;
}

export function getCompanySocialRuntimeTasks(companySlug: string) {
  return getStoredSocialRuntimeTasks(companySlug).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getCompanySocialRuntimeSummary(
  companySlug: string,
  bindings: SocialPlatformBinding[],
  tasks: SocialRuntimeTask[]
): CompanySocialRuntime {
  const connectedPlatforms = bindings.filter((binding) => binding.status !== "blocked").length;
  const publishReadyPlatforms = bindings.filter((binding) => binding.publishingReady).length;
  const analyticsReadyPlatforms = bindings.filter((binding) => binding.analyticsReady).length;
  const adLaunchReadyPlatforms = bindings.filter((binding) => binding.paidMediaReady).length;
  const queuedTasks = tasks.filter((task) => task.status === "queued").length;
  const runningTasks = tasks.filter((task) => task.status === "running").length;
  const blockedTasks = tasks.filter((task) => task.status === "blocked").length;
  const failedTasks = tasks.filter((task) => task.status === "failed").length;
  const completedTasks = tasks.filter((task) => task.status === "completed").length;

  return {
    companySlug,
    connectedPlatforms,
    publishReadyPlatforms,
    analyticsReadyPlatforms,
    adLaunchReadyPlatforms,
    queuedTasks,
    runningTasks,
    blockedTasks,
    failedTasks,
    completedTasks,
    nextPriority: buildNextPriority(bindings, tasks)
  };
}

export function buildSocialRuntimeTaskForPost(
  post: ScheduledSocialPost,
  binding: SocialPlatformBinding,
  requestedBy: string
) {
  const readiness = getPostPublishReadinessReason(post, binding);

  return {
    id: `social-runtime-post-${post.id}`,
    companySlug: post.companySlug,
    platform: post.platform,
    kind: "publish_post" as const,
    status: readiness.status,
    title: `Publicar: ${post.title}`,
    reason: readiness.reason,
    requestedBy,
    createdAt: new Date().toISOString(),
    sourceItemId: post.id,
    targetId: binding.targetId,
    sourceExperimentId: post.sourceExperimentId,
    variantLabel: post.variantLabel,
    attemptCount: 0
  } satisfies SocialRuntimeTask;
}

export function buildSocialRuntimeTaskForAd(
  draft: SocialAdDraft,
  binding: SocialPlatformBinding,
  requestedBy: string
) {
  const readiness = getAdLaunchReadinessReason(draft, binding);

  return {
    id: `social-runtime-ad-${draft.id}`,
    companySlug: draft.companySlug,
    platform: draft.platform,
    kind: "launch_ad" as const,
    status: readiness.status,
    title: `Lancar anuncio: ${draft.title}`,
    reason: readiness.reason,
    requestedBy,
    createdAt: new Date().toISOString(),
    sourceItemId: draft.id,
    targetId: binding.targetId,
    sourceExperimentId: draft.sourceExperimentId,
    variantLabel: draft.variantLabel,
    attemptCount: 0
  } satisfies SocialRuntimeTask;
}

export function buildSocialRuntimeSyncTask(
  companySlug: string,
  platform: SocialPlatformId,
  binding: SocialPlatformBinding,
  requestedBy: string
) {
  return {
    id: `social-runtime-sync-${companySlug}-${platform}`,
    companySlug,
    platform,
    kind: "sync_analytics" as const,
    status: binding.analyticsReady ? "queued" : "blocked",
    title: `Sincronizar estatisticas de ${platform}`,
    reason: binding.analyticsReady
      ? "Fila pronta para sincronizar insights reais desta plataforma."
      : "Vincule o alvo analitico da plataforma antes de rodar a sincronizacao.",
    requestedBy,
    createdAt: new Date().toISOString(),
    targetId: binding.analyticsTargetId ?? binding.targetId,
    attemptCount: 0
  } satisfies SocialRuntimeTask;
}

export function startSocialRuntimeTask(task: SocialRuntimeTask) {
  return {
    ...task,
    status: "running" as const,
    lastAttemptAt: new Date().toISOString(),
    attemptCount: (task.attemptCount ?? 0) + 1,
    lastResult: "Execucao iniciada pelo runtime do Agent Lion."
  };
}

export function completeSocialRuntimeTask(task: SocialRuntimeTask, summary: string, externalRef?: string) {
  return {
    ...task,
    status: "completed" as const,
    completedAt: new Date().toISOString(),
    lastResult: summary,
    reason: summary,
    externalRef: externalRef ?? task.externalRef
  };
}

export function blockSocialRuntimeTask(task: SocialRuntimeTask, reason: string) {
  return {
    ...task,
    status: "blocked" as const,
    lastResult: reason,
    reason
  };
}

export function failSocialRuntimeTask(task: SocialRuntimeTask, reason: string) {
  return {
    ...task,
    status: "failed" as const,
    lastResult: reason,
    reason
  };
}

function hydrateBinding(company: CompanyProfile, platform: SocialPlatformConnection): SocialPlatformBinding {
  const config = bindingConfig[platform.platform];
  const stored = getStoredSocialPlatformBinding(company.slug, platform.platform);

  if (stored) {
    return {
      ...stored,
      status: platform.status === "connected" ? stored.status : "blocked",
      publishingReady: platform.status === "connected" ? stored.publishingReady : false,
      analyticsReady: platform.status === "connected" ? stored.analyticsReady : false,
      paidMediaReady: platform.status === "connected" ? stored.paidMediaReady : false,
      note: platform.status === "connected" ? stored.note : "Reconecte a plataforma antes de usar a fila operacional."
    };
  }

  const isConnected = platform.status === "connected";
  return {
    id: `social-binding-${company.slug}-${platform.platform}`,
    companySlug: company.slug,
    platform: platform.platform,
    targetType: config.targetType,
    targetLabel: platform.accountLabel,
    targetId: undefined,
    analyticsTargetId: undefined,
    status: isConnected ? "needs_target" : "blocked",
    publishingReady: false,
    analyticsReady: false,
    paidMediaReady: false,
    adAccountId: undefined,
    campaignLabel: undefined,
    campaignId: undefined,
    adSetId: undefined,
    adGroupId: undefined,
    pageId: undefined,
    instagramActorId: undefined,
    pixelId: undefined,
    conversionEvent: undefined,
    managerAccountId: undefined,
    dailyBudgetCap: undefined,
    requirements: config.requirements,
    note: isConnected
      ? config.note
      : "A plataforma ainda nao foi conectada. Finalize o OAuth antes de definir o alvo operacional.",
    updatedAt: new Date().toISOString()
  };
}

function getPublishReadinessReason(binding: SocialPlatformBinding, approvalReady: boolean) {
  if (!approvalReady) {
    return {
      status: "blocked" as const,
      reason: "O item ainda nao esta aprovado para entrar na fila operacional."
    };
  }

  if (binding.status === "blocked") {
    return {
      status: "blocked" as const,
      reason: "A plataforma ainda nao esta conectada. Finalize o onboarding antes de publicar."
    };
  }

  if (!binding.publishingReady || !binding.targetId) {
    return {
      status: "blocked" as const,
      reason: "Defina o alvo de publicacao desta plataforma antes de enviar para a fila."
    };
  }

  return {
    status: "queued" as const,
    reason: "Fila pronta para publicacao assistida assim que o executor da plataforma rodar."
  };
}

function getAdLaunchReadinessReason(draft: SocialAdDraft, binding: SocialPlatformBinding) {
  if (draft.status !== "approved") {
    return {
      status: "blocked" as const,
      reason: "O anuncio ainda nao esta aprovado para entrar na fila operacional."
    };
  }

  if (binding.status === "blocked") {
    return {
      status: "blocked" as const,
      reason: "A plataforma ainda nao esta conectada. Finalize o onboarding antes de lancar anuncios."
    };
  }

  if (!binding.paidMediaReady) {
    return {
      status: "blocked" as const,
      reason: buildAdBindingReason(draft.platform)
    };
  }

  return {
    status: "queued" as const,
    reason: "Fila pronta para mutacao real de paid media assim que o executor rodar."
  };
}

function getPostPublishReadinessReason(post: ScheduledSocialPost, binding: SocialPlatformBinding) {
  const base = getPublishReadinessReason(binding, post.status === "scheduled");

  if (base.status === "blocked") {
    return base;
  }

  const mediaAssetCount = post.assetUrls?.length ?? (post.assetUrl ? 1 : 0);
  if (requiresMediaAsset(post.platform, post.format) && mediaAssetCount === 0) {
    return {
      status: "blocked" as const,
      reason: `A publicacao em ${post.platform} exige uma URL publica do asset final antes de entrar na runtime.`
    };
  }

  if (post.format === "carousel" && mediaAssetCount < 2) {
    return {
      status: "blocked" as const,
      reason: "Carousel precisa de pelo menos 2 assets publicos aprovados antes de entrar na runtime."
    };
  }

  if (post.platform === "instagram" && !binding.targetId) {
    return {
      status: "blocked" as const,
      reason: "Informe o Instagram Business Account ID desta empresa antes de publicar no Instagram."
    };
  }

  return {
    status: "queued" as const,
    reason: "Fila pronta para publicacao assistida com os requisitos minimos desta plataforma."
  };
}

function requiresMediaAsset(platform: ScheduledSocialPost["platform"], format: ScheduledSocialPost["format"]) {
  if (platform === "instagram" || platform === "tiktok" || platform === "youtube") {
    return true;
  }

  return format === "video" || format === "carousel" || format === "reel" || format === "short" || format === "story";
}

function buildNextPriority(bindings: SocialPlatformBinding[], tasks: SocialRuntimeTask[]) {
  const blockedBinding = bindings.find((binding) => binding.status === "needs_target");
  if (blockedBinding) {
    return `Vincular o alvo operacional de ${blockedBinding.platform} para liberar publicacao e analytics reais.`;
  }

  const paidMediaGap = bindings.find(
    (binding) =>
      (binding.platform === "facebook" || binding.platform === "instagram" || binding.platform === "google-ads") &&
      binding.status !== "blocked" &&
      !binding.paidMediaReady
  );
  if (paidMediaGap) {
    return buildAdBindingReason(paidMediaGap.platform);
  }

  const blockedTask = tasks.find((task) => task.status === "blocked");
  const failedTask = tasks.find((task) => task.status === "failed");
  if (failedTask) {
    return `Revisar e tentar novamente a tarefa ${failedTask.title}: ${failedTask.reason}`;
  }

  if (blockedTask) {
    return blockedTask.reason;
  }

  const runningTask = tasks.find((task) => task.status === "running");
  if (runningTask) {
    return `Acompanhar a execucao em andamento de ${runningTask.platform}: ${runningTask.title}.`;
  }

  const queuedTask = tasks.find((task) => task.status === "queued");
  if (queuedTask) {
    return `Executar a fila operacional de ${queuedTask.platform}: ${queuedTask.title}.`;
  }

  return "Conectar mais plataformas ou enviar novos posts/anuncios aprovados para a runtime queue.";
}

function buildAdBindingReason(platform: SocialPlatformId) {
  switch (platform) {
    case "google-ads":
      return "Mapeie o customer ID do Google Ads e, se usar MCC, informe tambem o manager customer ID antes de lancar campanhas.";
    case "instagram":
      return "Mapeie ad account, page_id e instagram_actor_id antes de lancar anuncios no ecossistema Meta para Instagram.";
    case "facebook":
      return "Mapeie ad account e page_id antes de lancar anuncios do Meta Ads para Facebook.";
    default:
      return "Complete o binding de paid media desta plataforma antes de lancar anuncios.";
  }
}
