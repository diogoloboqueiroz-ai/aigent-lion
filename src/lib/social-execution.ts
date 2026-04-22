import {
  appendStoredSocialExecutionLog,
  getStoredScheduledSocialPosts,
  getStoredSocialAdDrafts,
  getStoredSocialCompanyConnection,
  getStoredSocialPlatformBinding,
  upsertStoredPublishingApprovalRequest,
  upsertStoredScheduledSocialPost,
  upsertStoredSocialAdDraft,
  upsertStoredSocialInsight,
  upsertStoredSocialRuntimeTask
} from "@/lib/company-vault";
import {
  getCompanyPublishingRequests,
  markPublishingRequestPosted
} from "@/lib/creative-tools";
import { buildSpendCapMessage, isBudgetAboveSpendCap } from "@/lib/governance";
import { ensureFreshGoogleCompanyConnection } from "@/lib/google-runtime";
import type {
  CompanyProfile,
  ScheduledSocialPost,
  SocialAdDraft,
  SocialExecutionLog,
  SocialExecutionMetric,
  SocialInsightSnapshot,
  SocialPlatformId,
  SocialRuntimeTask
} from "@/lib/domain";
import {
  markScheduledSocialPostPosted,
  markSocialAdDraftLaunched
} from "@/lib/social-ops";
import { getCompanyPaymentProfile } from "@/lib/payments";
import { ensureFreshSocialCompanyConnection } from "@/lib/social-runtime-auth";
import {
  blockSocialRuntimeTask,
  completeSocialRuntimeTask,
  failSocialRuntimeTask,
  startSocialRuntimeTask
} from "@/lib/social-runtime";

const META_GRAPH_VERSION = "v23.0";
const LINKEDIN_VERSION = process.env.LINKEDIN_API_VERSION ?? "202603";
const GOOGLE_ADS_API_VERSION = "v23";

type ExecutionResult = {
  task: SocialRuntimeTask;
  log: SocialExecutionLog;
};

export type SocialRuntimeExecutionBatch = {
  results: ExecutionResult[];
  total: number;
  completed: number;
  blocked: number;
  failed: number;
};

type MetaPageContext = {
  pageId: string;
  pageToken: string;
  pageName?: string;
  followersCount?: number;
};

type LinkedInOrganizationResponse = {
  localizedName?: string;
  vanityName?: string;
  name?: {
    localized?: Record<string, string>;
  };
};

type LinkedInShareStatistics = {
  clickCount?: number;
  commentCount?: number;
  engagement?: number;
  impressionCount?: number;
  likeCount?: number;
  shareCount?: number;
  uniqueImpressionsCount?: number;
  uniqueImpressionsCounts?: number;
};

type LinkedInShareStatisticsElement = {
  timeRange?: {
    start?: number;
    end?: number;
  };
  totalShareStatistics?: LinkedInShareStatistics;
};

type LinkedInShareAggregate = {
  uniqueImpressions: number;
  clicks: number;
  impressions: number;
  engagementRatio: number;
};

type RichPublicationResult = {
  externalRef?: string;
  outcome: string;
  summary: string;
  detail: string;
  metrics: SocialExecutionMetric[];
};

type DownloadedAsset = {
  bytes: Buffer;
  contentType: string;
};

function getBudgetGuardrailMessage(company: CompanyProfile, budget: string | undefined) {
  const paymentProfile = getCompanyPaymentProfile(company);
  return isBudgetAboveSpendCap({
    budget,
    spendCap: paymentProfile.spendCap
  })
    ? buildSpendCapMessage({
        budget,
        spendCap: paymentProfile.spendCap
      })
    : undefined;
}

type LinkedInImageUploadInit = {
  value?: {
    uploadUrl?: string;
    image?: string;
  };
};

type LinkedInVideoUploadInit = {
  value?: {
    video?: string;
    uploadInstructions?: Array<{
      uploadUrl?: string;
      firstByte?: number;
      lastByte?: number;
    }>;
  };
};

type LinkedInImageAssetStatus = {
  status?: string;
};

type LinkedInVideoAssetStatus = {
  status?: string;
  processingFailureReason?: string;
};

type TikTokCreatorInfo = {
  creator_username?: string;
  creator_nickname?: string;
  privacy_level_options?: string[];
  comment_disabled?: boolean;
  duet_disabled?: boolean;
  stitch_disabled?: boolean;
  max_video_post_duration_sec?: number;
};

type TikTokPublishInitData = {
  publish_id?: string;
  upload_url?: string;
};

type TikTokPublishStatusData = {
  status?: string;
  fail_reason?: string;
  publicaly_available_post_id?: Array<string | number>;
  uploaded_bytes?: number;
  downloaded_bytes?: number;
};

type TikTokUserInfo = {
  display_name?: string;
  username?: string;
  follower_count?: number;
  likes_count?: number;
  video_count?: number;
};

type TikTokVideo = {
  id?: string;
  create_time?: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
};

type YouTubeVideoInsertResponse = {
  id?: string;
  snippet?: {
    channelId?: string;
    channelTitle?: string;
    title?: string;
  };
  status?: {
    privacyStatus?: string;
  };
};

type GoogleBusinessLocalPostResponse = {
  name?: string;
  searchUrl?: string;
  state?: string;
};

type YouTubeChannelListResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
    };
    statistics?: {
      subscriberCount?: string;
    };
  }>;
};

type YouTubeAnalyticsReportResponse = {
  rows?: Array<Array<string | number>>;
};

type YouTubeAnalyticsWindowAggregate = {
  views: number;
  likes: number;
  comments: number;
  estimatedMinutesWatched: number;
  engagementRate: number;
};

type GoogleBusinessLocationResponse = {
  title?: string;
};

type GoogleBusinessPerformanceResponse = {
  multiDailyMetricTimeSeries?: Array<{
    dailyMetricTimeSeries?: Array<{
      dailyMetric?: string;
      timeSeries?: {
        datedValues?: Array<{
          date?: {
            year?: number;
            month?: number;
            day?: number;
          };
          value?: string;
        }>;
      };
    }>;
  }>;
};

type GoogleBusinessWindowAggregate = {
  impressions: number;
  actions: number;
  websiteClicks: number;
  callClicks: number;
  directionRequests: number;
  engagementRate: number;
};

export async function executeSocialRuntimeTask(
  company: CompanyProfile,
  task: SocialRuntimeTask,
  actor: string
): Promise<ExecutionResult> {
  const runningTask = startSocialRuntimeTask(task);
  upsertStoredSocialRuntimeTask(runningTask);

  const startedAt = runningTask.lastAttemptAt ?? new Date().toISOString();

  try {
    if (runningTask.kind === "launch_ad") {
      const draft = getStoredSocialAdDrafts(company.slug).find((entry) => entry.id === runningTask.sourceItemId);

      if (!draft) {
        return persistResult(
          failSocialRuntimeTask(runningTask, "O rascunho do anuncio nao foi encontrado no workspace."),
          buildLog({
            companySlug: company.slug,
            task: runningTask,
            status: "failed",
            actor,
            startedAt,
            summary: "Nao foi possivel localizar o anuncio da runtime.",
            detail: "A tarefa ficou sem o draft-fonte correspondente e precisa ser reenfileirada."
          })
        );
      }

      return executeLaunchAdTask(company, runningTask, draft, actor, startedAt);
    }

    if (runningTask.kind === "publish_post") {
      const post = getStoredScheduledSocialPosts(company.slug).find((entry) => entry.id === runningTask.sourceItemId);

      if (!post) {
        return persistResult(
          failSocialRuntimeTask(runningTask, "O post original nao foi encontrado no workspace."),
          buildLog({
            companySlug: company.slug,
            task: runningTask,
            status: "failed",
            actor,
            startedAt,
            summary: "Nao foi possivel localizar o post da runtime.",
            detail: "A tarefa ficou sem o item-fonte correspondente e precisa ser reenfileirada."
          })
        );
      }

      return executePublishTask(company, runningTask, post, actor, startedAt);
    }

    return executeAnalyticsSync(company, runningTask, actor, startedAt);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha inesperada no executor social.";
    return persistResult(
      failSocialRuntimeTask(runningTask, message),
      buildLog({
        companySlug: company.slug,
        task: runningTask,
        status: "failed",
        actor,
        startedAt,
        summary: "A execucao falhou durante a chamada da plataforma.",
        detail: message
      })
    );
  }
}

export async function executeSocialRuntimeBatch(
  company: CompanyProfile,
  tasks: SocialRuntimeTask[],
  actor: string
): Promise<SocialRuntimeExecutionBatch> {
  const orderedTasks = [...tasks].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const results: ExecutionResult[] = [];

  for (const task of orderedTasks) {
    results.push(await executeSocialRuntimeTask(company, task, actor));
  }

  return summarizeSocialRuntimeBatch(results);
}

export function summarizeSocialRuntimeBatch(results: ExecutionResult[]): SocialRuntimeExecutionBatch {
  return {
    results,
    total: results.length,
    completed: results.filter((result) => result.task.status === "completed").length,
    blocked: results.filter((result) => result.task.status === "blocked").length,
    failed: results.filter((result) => result.task.status === "failed").length
  };
}

async function executePublishTask(
  company: CompanyProfile,
  task: SocialRuntimeTask,
  post: ScheduledSocialPost,
  actor: string,
  startedAt: string
): Promise<ExecutionResult> {
  const binding = requireBinding(company.slug, task.platform);

  if (!binding?.publishingReady || !binding.targetId) {
    return persistResult(
      blockSocialRuntimeTask(task, "Defina um alvo operacional valido antes de publicar nesta plataforma."),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: "Publicacao bloqueada por falta de target operacional.",
        detail: "O binding da plataforma ainda nao tem targetId pronto para publicacao."
      })
    );
  }

  if (task.platform === "facebook") {
    const connection = getStoredSocialCompanyConnection(company.slug, "facebook");

    if (!connection) {
      return persistResult(
        blockSocialRuntimeTask(task, "Conecte a conta Meta desta empresa antes de publicar no Facebook."),
        buildLog({
          companySlug: company.slug,
          task,
          status: "blocked",
          actor,
          startedAt,
          summary: "Facebook sem conexao OAuth valida.",
          detail: "A runtime precisa de um token Meta ativo para buscar o Page Access Token e publicar."
        })
      );
    }

    const page = await resolveMetaPageContext(binding.targetId, connection.accessToken);
    const publication = await publishFacebookPost(page, post);
    upsertStoredScheduledSocialPost(markScheduledSocialPostPosted(post));

    return persistResult(
      completeSocialRuntimeTask(
        task,
        publication.outcome,
        publication.externalRef
      ),
      buildLog({
        companySlug: company.slug,
        task,
        status: "completed",
        actor,
        startedAt,
        summary: publication.summary,
        detail: publication.detail,
        externalRef: publication.externalRef,
        metrics: publication.metrics
      })
    );
  }

  if (task.platform === "instagram") {
    const connection =
      getStoredSocialCompanyConnection(company.slug, "instagram") ??
      getStoredSocialCompanyConnection(company.slug, "facebook");

    if (!connection) {
      return persistResult(
        blockSocialRuntimeTask(task, "Conecte a conta Meta/Instagram desta empresa antes de publicar no Instagram."),
        buildLog({
          companySlug: company.slug,
          task,
          status: "blocked",
          actor,
          startedAt,
          summary: "Instagram sem conexao OAuth valida.",
          detail: "A runtime precisa de um token Meta com acesso ao Instagram Business Account da empresa."
        })
      );
    }

    const assetUrls = getPostAssetUrls(post);
    if (assetUrls.length === 0) {
      return persistResult(
        blockSocialRuntimeTask(task, "Informe uma URL publica do asset final antes de publicar no Instagram."),
        buildLog({
          companySlug: company.slug,
          task,
          status: "blocked",
          actor,
          startedAt,
          summary: "Instagram sem asset publico.",
          detail: "O fluxo de media publish precisa receber ao menos uma image_url final acessivel pela API da Meta."
        })
      );
    }

    const caption = buildPostCaption(post);
    const creationId =
      post.format === "story"
        ? await createInstagramStoryContainer(binding.targetId, assetUrls[0], connection.accessToken)
        : post.format === "carousel"
        ? await createInstagramCarousel(binding.targetId, assetUrls, caption, connection.accessToken)
        : post.format === "video" || post.format === "reel"
          ? await createInstagramVideoContainer(
              binding.targetId,
              assetUrls[0],
              caption,
              connection.accessToken,
              post.format
            )
          : await createInstagramSingleImage(binding.targetId, assetUrls[0], caption, connection.accessToken);

    if (!creationId) {
      throw new Error("A Meta nao retornou o creation_id do media container do Instagram.");
    }

    if (post.format === "video" || post.format === "reel" || isInstagramStoryVideo(post)) {
      await waitForInstagramContainerReady(creationId, connection.accessToken);
    }

    const publish = await fetchTextResponse<{
      id?: string;
    }>(`https://graph.facebook.com/${META_GRAPH_VERSION}/${binding.targetId}/media_publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        creation_id: creationId,
        access_token: connection.accessToken
      }),
      signal: AbortSignal.timeout(15_000)
    });

    const externalRef = publish.data?.id ?? creationId;
    upsertStoredScheduledSocialPost(markScheduledSocialPostPosted(post));

    return persistResult(
      completeSocialRuntimeTask(
        task,
        "Post publicado no Instagram com sucesso via media publish usando o asset final aprovado.",
        externalRef
      ),
      buildLog({
        companySlug: company.slug,
        task,
        status: "completed",
        actor,
        startedAt,
        summary:
          post.format === "carousel"
            ? "Instagram publicou o carousel aprovado."
            : post.format === "reel"
              ? "Instagram publicou o reel aprovado."
              : post.format === "video"
                ? "Instagram publicou o video aprovado."
                : "Instagram publicou a imagem aprovada.",
        detail:
          post.format === "carousel"
            ? "O Agent Lion criou os containers filhos, montou o carousel e publicou o conjunto aprovado no Instagram Business Account vinculado."
            : post.format === "reel"
              ? "O Agent Lion criou o media container do tipo REELS, aguardou o processamento e publicou o reel final no Instagram Business Account vinculado."
              : post.format === "video"
                ? "O Agent Lion criou o media container de video, aguardou o processamento e publicou o video final no Instagram Business Account vinculado."
                : "O Agent Lion criou o media container e publicou a imagem final no Instagram Business Account vinculado.",
        externalRef,
        metrics: [
          metric("Conta IG", binding.targetLabel),
          metric("Formato", post.format),
          metric("Assets", String(assetUrls.length)),
          metric("Media ID", externalRef ?? "n/d")
        ]
      })
    );
  }

  if (task.platform === "linkedin") {
    const connection = getStoredSocialCompanyConnection(company.slug, "linkedin");

    if (!connection) {
      return persistResult(
        blockSocialRuntimeTask(task, "Conecte a conta LinkedIn desta empresa antes de publicar."),
        buildLog({
          companySlug: company.slug,
          task,
          status: "blocked",
          actor,
          startedAt,
          summary: "LinkedIn sem conexao OAuth valida.",
          detail: "A runtime precisa de um token LinkedIn ativo com permissoes sociais liberadas."
        })
      );
    }

    const author = normalizeLinkedInAuthor(binding.targetId);
    const publication = await publishLinkedInPost(author, connection.accessToken, post);
    upsertStoredScheduledSocialPost(markScheduledSocialPostPosted(post));

    return persistResult(
      completeSocialRuntimeTask(
        task,
        publication.outcome,
        publication.externalRef
      ),
      buildLog({
        companySlug: company.slug,
        task,
        status: "completed",
        actor,
        startedAt,
        summary: publication.summary,
        detail: publication.detail,
        externalRef: publication.externalRef,
        metrics: publication.metrics
      })
    );
  }

  if (task.platform === "tiktok") {
    let connection: Awaited<ReturnType<typeof ensureFreshSocialCompanyConnection>>;
    try {
      connection = await ensureFreshSocialCompanyConnection(company.slug, "tiktok");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Conecte a conta TikTok desta empresa antes de publicar.";
      return persistResult(
        blockSocialRuntimeTask(task, message),
        buildLog({
          companySlug: company.slug,
          task,
          status: "blocked",
          actor,
          startedAt,
          summary: "TikTok sem conexao OAuth valida.",
          detail:
            "A runtime precisa de um token TikTok com video.publish antes de iniciar o Direct Post. Quando houver refresh_token, o Agent Lion tenta renovar a credencial automaticamente."
        })
      );
    }

    const publication = await publishTikTokPost(connection.accessToken, post);
    upsertStoredScheduledSocialPost(markScheduledSocialPostPosted(post));

    return persistResult(
      completeSocialRuntimeTask(
        task,
        publication.outcome,
        publication.externalRef
      ),
      buildLog({
        companySlug: company.slug,
        task,
        status: "completed",
        actor,
        startedAt,
        summary: publication.summary,
        detail: publication.detail,
        externalRef: publication.externalRef,
        metrics: publication.metrics
      })
    );
  }

  if (task.platform === "youtube") {
    let connection: Awaited<ReturnType<typeof ensureFreshGoogleCompanyConnection>>;

    try {
      connection = await ensureFreshGoogleCompanyConnection(company.slug, "youtube");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Conecte o YouTube desta empresa antes de publicar.";
      return persistResult(
        blockSocialRuntimeTask(task, message),
        buildLog({
          companySlug: company.slug,
          task,
          status: "blocked",
          actor,
          startedAt,
          summary: "YouTube sem conexao OAuth valida.",
          detail: message
        })
      );
    }

    const publication = await publishYouTubePost(company, connection.accessToken, post);
    upsertStoredScheduledSocialPost(markScheduledSocialPostPosted(post));

    return persistResult(
      completeSocialRuntimeTask(
        task,
        publication.outcome,
        publication.externalRef
      ),
      buildLog({
        companySlug: company.slug,
        task,
        status: "completed",
        actor,
        startedAt,
        summary: publication.summary,
        detail: publication.detail,
        externalRef: publication.externalRef,
        metrics: publication.metrics
      })
    );
  }

  if (task.platform === "google-business") {
    let connection: Awaited<ReturnType<typeof ensureFreshGoogleCompanyConnection>>;

    try {
      connection = await ensureFreshGoogleCompanyConnection(company.slug, "business-profile");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Conecte o Google Business Profile desta empresa antes de publicar.";
      return persistResult(
        blockSocialRuntimeTask(task, message),
        buildLog({
          companySlug: company.slug,
          task,
          status: "blocked",
          actor,
          startedAt,
          summary: "Google Business Profile sem conexao OAuth valida.",
          detail: message
        })
      );
    }

    const publication = await publishGoogleBusinessPost(company, binding, connection.accessToken, post);
    upsertStoredScheduledSocialPost(markScheduledSocialPostPosted(post));

    return persistResult(
      completeSocialRuntimeTask(
        task,
        publication.outcome,
        publication.externalRef
      ),
      buildLog({
        companySlug: company.slug,
        task,
        status: "completed",
        actor,
        startedAt,
        summary: publication.summary,
        detail: publication.detail,
        externalRef: publication.externalRef,
        metrics: publication.metrics
      })
    );
  }

  return persistResult(
    blockSocialRuntimeTask(
      task,
      buildUnsupportedPublishReason(task.platform)
    ),
    buildLog({
      companySlug: company.slug,
      task,
      status: "blocked",
      actor,
      startedAt,
      summary: `Publicacao real em ${task.platform} ainda esta em expansao.`,
      detail: buildUnsupportedPublishReason(task.platform)
    })
  );
}

async function executeLaunchAdTask(
  company: CompanyProfile,
  task: SocialRuntimeTask,
  draft: SocialAdDraft,
  actor: string,
  startedAt: string
): Promise<ExecutionResult> {
  const binding = requireBinding(company.slug, draft.platform);

  if (!binding?.paidMediaReady) {
    return persistResult(
      blockSocialRuntimeTask(task, buildAdLaunchBlockedReason(draft.platform)),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: "Lancamento de anuncio bloqueado por mapeamento incompleto.",
        detail: buildAdLaunchBlockedReason(draft.platform)
      })
    );
  }

  if (draft.platform === "facebook" || draft.platform === "instagram") {
    return executeMetaAdLaunch(company, task, draft, binding, actor, startedAt);
  }

  if (draft.platform === "google-ads") {
    return executeGoogleAdsLaunch(company, task, draft, binding, actor, startedAt);
  }

  return persistResult(
    blockSocialRuntimeTask(task, `O executor real de anuncios para ${draft.platform} ainda esta em expansao.`),
    buildLog({
      companySlug: company.slug,
      task,
      status: "blocked",
      actor,
      startedAt,
      summary: `Anuncios em ${draft.platform} ainda nao estao suportados com mutacao real.`,
      detail: `O Agent Lion ja opera Meta Ads e Google Ads nesta fase. ${draft.platform} entra na sequencia seguinte do roadmap.`
    })
  );
}

async function executeMetaAdLaunch(
  company: CompanyProfile,
  task: SocialRuntimeTask,
  draft: SocialAdDraft,
  binding: NonNullable<ReturnType<typeof requireBinding>>,
  actor: string,
  startedAt: string
): Promise<ExecutionResult> {
  const connection =
    getStoredSocialCompanyConnection(company.slug, draft.platform) ??
    getStoredSocialCompanyConnection(company.slug, "facebook") ??
    getStoredSocialCompanyConnection(company.slug, "instagram");

  if (!connection) {
    return persistResult(
      blockSocialRuntimeTask(task, "Conecte a conta Meta desta empresa antes de lancar anuncios."),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: "Meta Ads sem conexao OAuth valida.",
        detail: "A runtime precisa de um token Meta com ads_management e business_management antes de criar campanha, ad set, criativo e anuncio."
      })
    );
  }

  if (!binding.adAccountId || !binding.pageId) {
    return persistResult(
      blockSocialRuntimeTask(task, "Mapeie ad account e page_id antes de lancar anuncios Meta."),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: "Meta Ads sem ad account/page_id.",
        detail: "O binding desta empresa ainda nao recebeu o ad account e o page_id usados para mutacao real."
      })
    );
  }

  if (!draft.landingUrl) {
    return persistResult(
      blockSocialRuntimeTask(task, "Defina a landing URL final do anuncio antes de lancar no Meta Ads."),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: "Meta Ads sem URL de destino.",
        detail: "A mutacao real do criativo usa a landing URL final da oferta aprovada."
      })
    );
  }

  if (!draft.assetUrl && draft.platform !== "facebook") {
    return persistResult(
      blockSocialRuntimeTask(task, "Defina uma URL publica do asset criativo antes de lancar no ecossistema Meta."),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: "Meta Ads sem asset publico final.",
        detail: "Nesta fase a automacao usa image hash via adimages; o anuncio precisa receber um asset aprovado e acessivel."
      })
    );
  }

  const accountId = normalizeMetaAdAccountId(binding.adAccountId);
  const objective = mapMetaCampaignObjective(draft.objective);
  const spendCapMessage = getBudgetGuardrailMessage(company, binding.dailyBudgetCap ?? draft.budget);
  if (spendCapMessage) {
    return persistResult(
      blockSocialRuntimeTask(task, spendCapMessage),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: "Meta Ads bloqueado por spend cap.",
        detail: spendCapMessage
      })
    );
  }
  const dailyBudget = String(parseCurrencyToMinorUnits(binding.dailyBudgetCap ?? draft.budget, 100));
  const campaignName = binding.campaignLabel?.trim() || draft.title;
  const adSetName = `${draft.title} - conjunto`;
  const adName = `${draft.title} - anuncio`;
  const launchState = draft.launchState?.platform === "meta" ? draft.launchState : undefined;

  const campaignId =
    launchState?.campaignId ||
    binding.campaignId ||
    (await createMetaCampaign(accountId, connection.accessToken, {
      name: campaignName,
      objective
    }));

  if (launchState?.campaignId) {
    await updateMetaEntity(launchState.campaignId, connection.accessToken, {
      name: campaignName,
      status: "ACTIVE"
    });
  }

  const adSetId =
    launchState?.adSetId ||
    binding.adSetId ||
    (await createMetaAdSet(accountId, connection.accessToken, {
      name: adSetName,
      campaignId,
      dailyBudget,
      objective,
      pageId: binding.pageId,
      pixelId: binding.pixelId,
      conversionEvent: binding.conversionEvent,
      countryCode: inferCountryCode(company.region),
      landingUrl: draft.landingUrl
    }));

  if (launchState?.adSetId) {
    await updateMetaEntity(launchState.adSetId, connection.accessToken, {
      name: adSetName,
      daily_budget: dailyBudget,
      status: "ACTIVE"
    });
  }

  const imageHash = draft.assetUrl
    ? await uploadMetaImage(accountId, connection.accessToken, draft.assetUrl)
    : launchState?.imageHash;

  const creativeId = await createMetaCreative(accountId, connection.accessToken, {
    name: `${draft.title} - criativo`,
    pageId: binding.pageId,
    instagramActorId: binding.instagramActorId ?? binding.targetId,
    landingUrl: draft.landingUrl,
    message: buildAdPrimaryText(draft),
    headline: draft.headline ?? draft.title,
    description: draft.description ?? draft.creativeAngle,
    callToAction: draft.callToAction,
    imageHash
  });

  let adId = launchState?.adId;
  if (adId) {
    await updateMetaEntity(adId, connection.accessToken, {
      name: adName,
      status: "ACTIVE",
      creative: JSON.stringify({ creative_id: creativeId })
    });
  } else {
    adId = await createMetaAd(accountId, connection.accessToken, {
      name: adName,
      adSetId,
      creativeId
    });
  }

  upsertStoredSocialAdDraft({
    ...draft,
    launchState: {
      platform: "meta",
      campaignId,
      adSetId,
      adId,
      creativeId,
      imageHash,
      updatedAt: new Date().toISOString()
    }
  });

  return persistResult(
    completeSocialRuntimeTask(
      task,
      "Campanha Meta Ads criada ou atualizada com campanha, ad set, criativo e anuncio ativos.",
      adId
    ),
    buildLog({
      companySlug: company.slug,
      task,
      status: "completed",
      actor,
      startedAt,
      summary: "Meta Ads executou o lancamento real do anuncio.",
      detail:
        "O Agent Lion usou o ad account mapeado da empresa para criar ou atualizar campanha, ad set, criativo e anuncio com o asset aprovado.",
      externalRef: adId,
      metrics: [
        metric("Conta Ads", accountId),
        metric("Campanha", campaignId),
        metric("Ad Set", adSetId),
        metric("Anuncio", adId ?? "n/d")
      ]
    })
  );
}

async function executeGoogleAdsLaunch(
  company: CompanyProfile,
  task: SocialRuntimeTask,
  draft: SocialAdDraft,
  binding: NonNullable<ReturnType<typeof requireBinding>>,
  actor: string,
  startedAt: string
): Promise<ExecutionResult> {
  const customerId = normalizeGoogleAdsCustomerId(binding.targetId);

  if (!customerId) {
    return persistResult(
      blockSocialRuntimeTask(task, "Defina o customer ID final da conta Google Ads antes de lancar campanhas."),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: "Google Ads sem customer ID operacional.",
        detail: "A mutacao real do Google Ads precisa do customer ID da empresa no binding da runtime."
      })
    );
  }

  if (!draft.landingUrl) {
    return persistResult(
      blockSocialRuntimeTask(task, "Defina a URL final da oferta antes de lancar no Google Ads."),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: "Google Ads sem final URL.",
        detail: "O anuncio de pesquisa precisa da final URL para montar o Responsive Search Ad."
      })
    );
  }

  const keywordThemes = normalizeKeywordThemes(draft.keywordThemes, draft.title, draft.audience);
  if (keywordThemes.length === 0) {
    return persistResult(
      blockSocialRuntimeTask(task, "Informe pelo menos uma keyword ou tema de busca antes de lancar no Google Ads."),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: "Google Ads sem keywords.",
        detail: "A fase atual cria campanhas Search com keywords explicitas para manter governanca e previsibilidade."
      })
    );
  }

  const connection = await ensureFreshGoogleCompanyConnection(company.slug, "google-ads");
  const launchState = draft.launchState?.platform === "google-ads" ? draft.launchState : undefined;
  const spendCapMessage = getBudgetGuardrailMessage(company, binding.dailyBudgetCap ?? draft.budget);
  if (spendCapMessage) {
    return persistResult(
      blockSocialRuntimeTask(task, spendCapMessage),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: "Google Ads bloqueado por spend cap.",
        detail: spendCapMessage
      })
    );
  }
  const budgetMicros = String(parseCurrencyToMicros(binding.dailyBudgetCap ?? draft.budget, 50));
  const campaignName = binding.campaignLabel?.trim() || draft.title;
  const adGroupName = `${draft.title} - grupo`;

  const budgetResourceName =
    launchState?.budgetId ||
    (await mutateGoogleAdsResource<{ resourceName?: string }>(customerId, connection.accessToken, binding.managerAccountId, "campaignBudgets", [
      {
        create: {
          name: `${campaignName} - budget`,
          deliveryMethod: "STANDARD",
          amountMicros: budgetMicros
        }
      }
    ])).results[0]?.resourceName;

  if (!budgetResourceName) {
    throw new Error("O Google Ads nao retornou o resource name do budget criado.");
  }

  if (launchState?.budgetId) {
    await mutateGoogleAdsResource(customerId, connection.accessToken, binding.managerAccountId, "campaignBudgets", [
      {
        update: {
          resourceName: launchState.budgetId,
          amountMicros: budgetMicros
        },
        updateMask: "amount_micros"
      }
    ]);
  }

  const campaignResourceName =
    resolveGoogleAdsResourceName(customerId, binding.campaignId, "campaigns") ||
    launchState?.campaignId ||
    (await mutateGoogleAdsResource<{ resourceName?: string }>(customerId, connection.accessToken, binding.managerAccountId, "campaigns", [
      {
        create: {
          name: campaignName,
          status: "ENABLED",
          advertisingChannelType: "SEARCH",
          manualCpc: {},
          campaignBudget: budgetResourceName,
          networkSettings: {
            targetGoogleSearch: true,
            targetSearchNetwork: true,
            targetContentNetwork: false,
            targetPartnerSearchNetwork: false
          },
          startDate: formatGoogleAdsDate(draft.scheduledStart)
        }
      }
    ])).results[0]?.resourceName;

  if (!campaignResourceName) {
    throw new Error("O Google Ads nao retornou o resource name da campanha criada.");
  }

  if (launchState?.campaignId || binding.campaignId) {
    await mutateGoogleAdsResource(customerId, connection.accessToken, binding.managerAccountId, "campaigns", [
      {
        update: {
          resourceName: campaignResourceName,
          name: campaignName,
          status: "ENABLED",
          campaignBudget: budgetResourceName
        },
        updateMask: "name,status,campaign_budget"
      }
    ]);
  }

  const adGroupResourceName =
    resolveGoogleAdsResourceName(customerId, binding.adGroupId, "adGroups") ||
    launchState?.adGroupId ||
    (await mutateGoogleAdsResource<{ resourceName?: string }>(customerId, connection.accessToken, binding.managerAccountId, "adGroups", [
      {
        create: {
          name: adGroupName,
          campaign: campaignResourceName,
          status: "ENABLED",
          type: "SEARCH_STANDARD",
          cpcBidMicros: String(parseCurrencyToMicros("R$ 1,00", 1))
        }
      }
    ])).results[0]?.resourceName;

  if (!adGroupResourceName) {
    throw new Error("O Google Ads nao retornou o resource name do ad group criado.");
  }

  if (launchState?.adGroupId || binding.adGroupId) {
    await mutateGoogleAdsResource(customerId, connection.accessToken, binding.managerAccountId, "adGroups", [
      {
        update: {
          resourceName: adGroupResourceName,
          name: adGroupName,
          status: "ENABLED"
        },
        updateMask: "name,status"
      }
    ]);
  }

  const keywordResults =
    launchState?.keywordResourceNames && launchState.keywordResourceNames.length > 0
      ? {
          results: launchState.keywordResourceNames.map((resourceName) => ({ resourceName }))
        }
      : await mutateGoogleAdsResource<{ resourceName?: string }>(
          customerId,
          connection.accessToken,
          binding.managerAccountId,
          "adGroupCriteria",
          keywordThemes.map((keyword) => ({
            create: {
              adGroup: adGroupResourceName,
              status: "ENABLED",
              keyword: {
                text: keyword,
                matchType: "PHRASE"
              }
            }
          }))
        );

  const headlines = normalizeResponsiveSearchAssets(
    [draft.headline, draft.title, draft.callToAction, draft.creativeAngle],
    30,
    3
  ).map((text) => ({ text }));
  const descriptions = normalizeResponsiveSearchAssets(
    [draft.description, draft.creativeAngle, buildAdPrimaryText(draft)],
    90,
    2
  ).map((text) => ({ text }));

  if (headlines.length === 0 || descriptions.length === 0) {
    throw new Error("O anuncio de pesquisa precisa de headlines e descriptions validas para o Responsive Search Ad.");
  }

  let adGroupAdResourceName = launchState?.adGroupAdId;
  if (adGroupAdResourceName) {
    await mutateGoogleAdsResource(
      customerId,
      connection.accessToken,
      binding.managerAccountId,
      "adGroupAds",
      [
        {
          update: {
            resourceName: adGroupAdResourceName,
            status: "ENABLED",
            ad: {
              finalUrls: [draft.landingUrl],
              responsiveSearchAd: {
                headlines,
                descriptions
              }
            }
          },
          updateMask:
            "status,ad.final_urls,ad.responsive_search_ad.headlines,ad.responsive_search_ad.descriptions"
        }
      ]
    );
  } else {
    adGroupAdResourceName = (
      await mutateGoogleAdsResource<{ resourceName?: string }>(
        customerId,
        connection.accessToken,
        binding.managerAccountId,
        "adGroupAds",
        [
          {
            create: {
              adGroup: adGroupResourceName,
              status: "ENABLED",
              ad: {
                finalUrls: [draft.landingUrl],
                responsiveSearchAd: {
                  headlines,
                  descriptions
                }
              }
            }
          }
        ]
      )
    ).results[0]?.resourceName;
  }

  if (!adGroupAdResourceName) {
    throw new Error("O Google Ads nao retornou o resource name do anuncio criado.");
  }

  upsertStoredSocialAdDraft({
    ...draft,
    launchState: {
      platform: "google-ads",
      budgetId: budgetResourceName,
      campaignId: campaignResourceName,
      adGroupId: adGroupResourceName,
      adGroupAdId: adGroupAdResourceName,
      keywordResourceNames: keywordResults.results
        .map((entry) => entry.resourceName)
        .filter((entry): entry is string => typeof entry === "string"),
      updatedAt: new Date().toISOString()
    }
  });

  return persistResult(
    completeSocialRuntimeTask(
      task,
      "Campanha Google Ads criada ou atualizada com budget, campanha, ad group, keywords e responsive search ad ativos.",
      adGroupAdResourceName
    ),
    buildLog({
      companySlug: company.slug,
      task,
      status: "completed",
      actor,
      startedAt,
      summary: "Google Ads executou a mutacao real da campanha.",
      detail:
        "O Agent Lion criou ou atualizou budget, campanha Search, ad group, keywords em frase e Responsive Search Ad na conta Google Ads mapeada.",
      externalRef: adGroupAdResourceName,
      metrics: [
        metric("Customer ID", customerId),
        metric("Campanha", campaignResourceName),
        metric("Ad Group", adGroupResourceName),
        metric("Keywords", String(keywordThemes.length))
      ]
    })
  );
}

async function executeAnalyticsSync(
  company: CompanyProfile,
  task: SocialRuntimeTask,
  actor: string,
  startedAt: string
): Promise<ExecutionResult> {
  const binding = requireBinding(company.slug, task.platform);

  if (!binding?.analyticsReady || !binding.analyticsTargetId && !binding.targetId) {
    return persistResult(
      blockSocialRuntimeTask(task, "Vincule o alvo analitico da plataforma antes de rodar a sincronizacao."),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: "Sync bloqueado por falta de target analitico.",
        detail: "A plataforma ainda nao recebeu analyticsTargetId ou targetId para leitura real."
      })
    );
  }

  if (task.platform === "instagram") {
    return executeInstagramAnalyticsSync(company, task, binding, actor, startedAt);
  }

  if (task.platform === "tiktok") {
    return executeTikTokAnalyticsSync(company, task, binding, actor, startedAt);
  }

  if (task.platform === "linkedin") {
    return executeLinkedInAnalyticsSync(company, task, binding, actor, startedAt);
  }

  if (task.platform === "youtube") {
    return executeYouTubeAnalyticsSync(company, task, binding, actor, startedAt);
  }

  if (task.platform === "google-business") {
    return executeGoogleBusinessAnalyticsSync(company, task, binding, actor, startedAt);
  }

  if (task.platform !== "facebook") {
    return persistResult(
      blockSocialRuntimeTask(task, buildUnsupportedAnalyticsReason(task.platform)),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: `Sync real de ${task.platform} ainda nao esta disponivel nesta fase.`,
        detail: buildUnsupportedAnalyticsReason(task.platform)
      })
    );
  }

  const connection = getStoredSocialCompanyConnection(company.slug, "facebook");
  if (!connection) {
    return persistResult(
      blockSocialRuntimeTask(task, "Conecte a conta Meta desta empresa antes de sincronizar insights do Facebook."),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: "Sync bloqueado por falta de token Meta.",
        detail: "A rotina precisa de uma conexao Meta valida para buscar Page Insights."
      })
    );
  }

  const page = await resolveMetaPageContext(binding.analyticsTargetId ?? binding.targetId ?? "", connection.accessToken);
  const insightsResponse = await fetchJson<{
    data?: Array<{
      period?: string;
      values?: Array<{ value?: number; end_time?: string }>;
    }>;
  }>(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${page.pageId}/insights?metric=page_impressions_unique&access_token=${encodeURIComponent(page.pageToken)}`,
    {
      headers: {
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(15_000)
    }
  );

  const weeklyReach = getLatestMetricValue(insightsResponse.data?.data, "week");
  const monthlyReach = getLatestMetricValue(insightsResponse.data?.data, "days_28");

  const weeklySnapshot = createFacebookInsightSnapshot(company.slug, "7d", page.followersCount, weeklyReach);
  const monthlySnapshot = createFacebookInsightSnapshot(company.slug, "28d", page.followersCount, monthlyReach);

  upsertStoredSocialInsight(weeklySnapshot);
  upsertStoredSocialInsight(monthlySnapshot);

  return persistResult(
    completeSocialRuntimeTask(
      task,
      "Insights reais do Facebook sincronizados com sucesso para o workspace."
    ),
    buildLog({
      companySlug: company.slug,
      task,
      status: "completed",
      actor,
      startedAt,
      summary: "O Agent Lion atualizou os snapshots reais do Facebook.",
      detail:
        "A sincronizacao trouxe seguidores e alcance da pagina diretamente da Meta. Cliques e engajamento detalhado entram na proxima rodada do executor.",
      metrics: [
        metric("Pagina", page.pageName ?? binding.targetLabel),
        metric("Seguidores", formatMetricValue(page.followersCount)),
        metric("Alcance 7d", weeklySnapshot.reach),
        metric("Alcance 28d", monthlySnapshot.reach)
      ]
    })
  );
}

async function executeInstagramAnalyticsSync(
  company: CompanyProfile,
  task: SocialRuntimeTask,
  binding: NonNullable<ReturnType<typeof requireBinding>>,
  actor: string,
  startedAt: string
): Promise<ExecutionResult> {
  const connection =
    getStoredSocialCompanyConnection(company.slug, "instagram") ??
    getStoredSocialCompanyConnection(company.slug, "facebook");

  if (!connection) {
    return persistResult(
      blockSocialRuntimeTask(task, "Conecte a conta Meta/Instagram desta empresa antes de sincronizar insights do Instagram."),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: "Sync bloqueado por falta de token Meta/Instagram.",
        detail: "A rotina precisa de uma conexao Meta valida com acesso ao Instagram Business Account da empresa."
      })
    );
  }

  const igUserId = binding.analyticsTargetId ?? binding.targetId ?? "";
  const profile = await fetchJson<{
    username?: string;
    followers_count?: number;
  }>(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${igUserId}?fields=username,followers_count&access_token=${encodeURIComponent(connection.accessToken)}`,
    {
      headers: {
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(15_000)
    }
  );

  const now = new Date();
  const since = new Date(now);
  since.setDate(now.getDate() - 29);

  const insights = await fetchJson<{
    data?: Array<{
      name?: string;
      values?: Array<{
        value?: number | { value?: number };
        end_time?: string;
      }>;
    }>;
  }>(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${igUserId}/insights?metric=reach,profile_views&period=day&since=${Math.floor(since.getTime() / 1000)}&until=${Math.floor(now.getTime() / 1000)}&access_token=${encodeURIComponent(connection.accessToken)}`,
    {
      headers: {
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(15_000)
    }
  );

  const weeklyReach = sumInstagramInsightValues(insights.data?.data, "reach", 7);
  const monthlyReach = sumInstagramInsightValues(insights.data?.data, "reach", 28);
  const weeklyProfileViews = sumInstagramInsightValues(insights.data?.data, "profile_views", 7);
  const monthlyProfileViews = sumInstagramInsightValues(insights.data?.data, "profile_views", 28);

  const weeklySnapshot = createInstagramInsightSnapshot(
    company.slug,
    "7d",
    profile.data?.followers_count,
    weeklyReach,
    weeklyProfileViews,
    profile.data?.username
  );
  const monthlySnapshot = createInstagramInsightSnapshot(
    company.slug,
    "28d",
    profile.data?.followers_count,
    monthlyReach,
    monthlyProfileViews,
    profile.data?.username
  );

  upsertStoredSocialInsight(weeklySnapshot);
  upsertStoredSocialInsight(monthlySnapshot);

  return persistResult(
    completeSocialRuntimeTask(
      task,
      "Insights reais do Instagram sincronizados com sucesso para o workspace."
    ),
    buildLog({
      companySlug: company.slug,
      task,
      status: "completed",
      actor,
      startedAt,
      summary: "O Agent Lion atualizou os snapshots reais do Instagram.",
      detail:
        "A sincronizacao trouxe seguidores, alcance e profile views diretamente do Instagram Business via Graph API.",
      metrics: [
        metric("Conta IG", profile.data?.username ?? binding.targetLabel),
        metric("Seguidores", formatMetricValue(profile.data?.followers_count)),
        metric("Alcance 7d", weeklySnapshot.reach),
        metric("Alcance 28d", monthlySnapshot.reach)
      ]
    })
  );
}

async function executeTikTokAnalyticsSync(
  company: CompanyProfile,
  task: SocialRuntimeTask,
  binding: NonNullable<ReturnType<typeof requireBinding>>,
  actor: string,
  startedAt: string
): Promise<ExecutionResult> {
  let connection: Awaited<ReturnType<typeof ensureFreshSocialCompanyConnection>>;
  try {
    connection = await ensureFreshSocialCompanyConnection(company.slug, "tiktok");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Conecte a conta TikTok desta empresa antes de sincronizar insights.";
    return persistResult(
      blockSocialRuntimeTask(task, message),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: "Sync bloqueado por falta de token TikTok.",
        detail:
          "A rotina precisa de uma conexao TikTok valida com user.info.stats e video.list. Quando houver refresh_token, o Agent Lion tenta renovar a credencial automaticamente."
      })
    );
  }

  const profile = await fetchTikTokUserInfo(connection.accessToken);
  const recentVideos = await listTikTokRecentVideos(connection.accessToken, 28);

  const weeklyAggregate = aggregateTikTokVideos(recentVideos, 7);
  const monthlyAggregate = aggregateTikTokVideos(recentVideos, 28);

  const weeklySnapshot = createTikTokInsightSnapshot(
    company.slug,
    "7d",
    profile,
    weeklyAggregate
  );
  const monthlySnapshot = createTikTokInsightSnapshot(
    company.slug,
    "28d",
    profile,
    monthlyAggregate
  );

  upsertStoredSocialInsight(weeklySnapshot);
  upsertStoredSocialInsight(monthlySnapshot);

  return persistResult(
    completeSocialRuntimeTask(
      task,
      "Insights reais do TikTok sincronizados com sucesso para o workspace."
    ),
    buildLog({
      companySlug: company.slug,
      task,
      status: "completed",
      actor,
      startedAt,
      summary: "O Agent Lion atualizou os snapshots reais do TikTok.",
      detail:
        "A sincronizacao trouxe seguidores via user.info e consolidou views e engajamento dos videos recentes via video.list do TikTok.",
      metrics: [
        metric("Conta TikTok", profile.display_name ?? profile.username ?? binding.targetLabel),
        metric("Seguidores", formatMetricValue(profile.follower_count)),
        metric("Views 7d", weeklySnapshot.reach),
        metric("Views 28d", monthlySnapshot.reach)
      ]
    })
  );
}

async function executeYouTubeAnalyticsSync(
  company: CompanyProfile,
  task: SocialRuntimeTask,
  binding: NonNullable<ReturnType<typeof requireBinding>>,
  actor: string,
  startedAt: string
): Promise<ExecutionResult> {
  let connection: Awaited<ReturnType<typeof ensureFreshGoogleCompanyConnection>>;
  try {
    connection = await ensureFreshGoogleCompanyConnection(company.slug, "youtube");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Conecte o YouTube desta empresa antes de sincronizar analytics.";
    return persistResult(
      blockSocialRuntimeTask(task, message),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: "YouTube sem conexao OAuth valida para analytics.",
        detail:
          "A rotina precisa de uma conexao Google/YouTube ativa. Quando houver refresh_token, o Agent Lion renova a credencial automaticamente antes da consulta."
      })
    );
  }

  if (!hasYouTubeAnalyticsScopes(connection.scopes)) {
    return persistResult(
      blockSocialRuntimeTask(
        task,
        "Reconecte o YouTube desta empresa para liberar youtube.readonly e yt-analytics.readonly para analytics real."
      ),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: "YouTube conectado com escopo insuficiente para analytics.",
        detail:
          "O upload do YouTube segue funcionando com youtube.upload, mas os relatórios reais desta fase exigem youtube.readonly e yt-analytics.readonly na mesma conexao."
      })
    );
  }

  const preferredChannelId = normalizeYouTubeChannelId(binding.analyticsTargetId ?? binding.targetId ?? "");
  const channel = await fetchYouTubeChannelProfile(connection.accessToken, preferredChannelId);
  const channelId = channel.id ?? preferredChannelId;

  if (!channelId) {
    return persistResult(
      blockSocialRuntimeTask(
        task,
        "Defina o channel ID do YouTube ou reconecte a conta para permitir a identificacao automatica do canal."
      ),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: "Nao foi possivel identificar o canal do YouTube.",
        detail:
          "A runtime precisa do channel ID ou de uma conexao Google capaz de retornar o canal autenticado via channels.list."
      })
    );
  }

  const weeklyAggregate = await queryYouTubeAnalyticsWindow(connection.accessToken, channelId, 7);
  const monthlyAggregate = await queryYouTubeAnalyticsWindow(connection.accessToken, channelId, 28);

  const weeklySnapshot = createYouTubeInsightSnapshot(
    company.slug,
    "7d",
    channel.statistics?.subscriberCount,
    weeklyAggregate,
    channel.snippet?.title ?? binding.targetLabel
  );
  const monthlySnapshot = createYouTubeInsightSnapshot(
    company.slug,
    "28d",
    channel.statistics?.subscriberCount,
    monthlyAggregate,
    channel.snippet?.title ?? binding.targetLabel
  );

  upsertStoredSocialInsight(weeklySnapshot);
  upsertStoredSocialInsight(monthlySnapshot);

  return persistResult(
    completeSocialRuntimeTask(
      task,
      "Analytics reais do YouTube sincronizados com sucesso para o workspace."
    ),
    buildLog({
      companySlug: company.slug,
      task,
      status: "completed",
      actor,
      startedAt,
      summary: "O Agent Lion atualizou os snapshots reais do YouTube.",
      detail:
        "A sincronizacao combinou channels.list do YouTube Data API com reports.query do YouTube Analytics API para trazer inscritos, views e engajamento recente.",
      metrics: [
        metric("Canal", channel.snippet?.title ?? binding.targetLabel),
        metric("Inscritos", weeklySnapshot.followers),
        metric("Views 7d", weeklySnapshot.reach),
        metric("Views 28d", monthlySnapshot.reach)
      ]
    })
  );
}

async function executeGoogleBusinessAnalyticsSync(
  company: CompanyProfile,
  task: SocialRuntimeTask,
  binding: NonNullable<ReturnType<typeof requireBinding>>,
  actor: string,
  startedAt: string
): Promise<ExecutionResult> {
  let connection: Awaited<ReturnType<typeof ensureFreshGoogleCompanyConnection>>;
  try {
    connection = await ensureFreshGoogleCompanyConnection(company.slug, "business-profile");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Conecte o Google Business Profile desta empresa antes de sincronizar insights.";
    return persistResult(
      blockSocialRuntimeTask(task, message),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: "Google Business sem conexao OAuth valida para analytics.",
        detail:
          "A rotina precisa de uma conexao business.manage ativa para buscar performance da ficha local."
      })
    );
  }

  const locationName = normalizeGoogleBusinessAnalyticsLocationName(
    binding.analyticsTargetId ?? binding.targetId ?? ""
  );

  if (!locationName) {
    return persistResult(
      blockSocialRuntimeTask(
        task,
        "Defina o analyticsTargetId do Google Business como locations/{locationId} ou use um target publish no formato accounts/{accountId}/locations/{locationId}."
      ),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: "Google Business sem location ID valido para analytics.",
        detail:
          "A Performance API usa o recurso locations/{locationId}. Quando voce informa o recurso completo de publish, o Agent Lion extrai automaticamente o locationId."
      })
    );
  }

  const location = await fetchGoogleBusinessLocationProfile(connection.accessToken, locationName);
  const metricSeries = await fetchGoogleBusinessPerformanceMetrics(connection.accessToken, locationName, 28);
  const weeklyAggregate = aggregateGoogleBusinessMetrics(metricSeries, 7);
  const monthlyAggregate = aggregateGoogleBusinessMetrics(metricSeries, 28);

  const weeklySnapshot = createGoogleBusinessInsightSnapshot(
    company.slug,
    "7d",
    weeklyAggregate,
    location.title ?? binding.targetLabel
  );
  const monthlySnapshot = createGoogleBusinessInsightSnapshot(
    company.slug,
    "28d",
    monthlyAggregate,
    location.title ?? binding.targetLabel
  );

  upsertStoredSocialInsight(weeklySnapshot);
  upsertStoredSocialInsight(monthlySnapshot);

  return persistResult(
    completeSocialRuntimeTask(
      task,
      "Performance real do Google Business Profile sincronizada com sucesso para o workspace."
    ),
    buildLog({
      companySlug: company.slug,
      task,
      status: "completed",
      actor,
      startedAt,
      summary: "O Agent Lion atualizou os snapshots reais do Google Business Profile.",
      detail:
        "A sincronizacao combinou Business Information para identificar a ficha e Business Profile Performance API para consolidar impressoes e acoes locais recentes.",
      metrics: [
        metric("Ficha", location.title ?? binding.targetLabel),
        metric("Impressoes 7d", weeklySnapshot.reach),
        metric("Acoes 7d", weeklySnapshot.clicks),
        metric("Impressoes 28d", monthlySnapshot.reach)
      ]
    })
  );
}

async function executeLinkedInAnalyticsSync(
  company: CompanyProfile,
  task: SocialRuntimeTask,
  binding: NonNullable<ReturnType<typeof requireBinding>>,
  actor: string,
  startedAt: string
): Promise<ExecutionResult> {
  const connection = getStoredSocialCompanyConnection(company.slug, "linkedin");

  if (!connection) {
    return persistResult(
      blockSocialRuntimeTask(task, "Conecte a conta LinkedIn desta empresa antes de sincronizar insights."),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: "Sync bloqueado por falta de token LinkedIn.",
        detail: "A rotina precisa de uma conexao LinkedIn valida com acesso administrativo a organizacao."
      })
    );
  }

  if (!hasLinkedInAnalyticsScope(connection.scopes)) {
    return persistResult(
      blockSocialRuntimeTask(
        task,
        "Reconecte o LinkedIn desta empresa para liberar o escopo rw_organization_admin exigido pelos endpoints oficiais de analytics."
      ),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: "LinkedIn conectado com escopo insuficiente para analytics.",
        detail:
          "Os endpoints oficiais de Organization Lookup, Network Sizes e Share Statistics exigem rw_organization_admin. A conta conectada precisa refazer o OAuth com esse escopo."
      })
    );
  }

  const organizationTarget = binding.analyticsTargetId ?? binding.targetId ?? "";
  const organizationUrn = normalizeLinkedInOrganizationUrn(organizationTarget);

  if (!organizationUrn) {
    return persistResult(
      blockSocialRuntimeTask(
        task,
        "Defina o alvo analitico do LinkedIn como organization URN ou organization ID antes de sincronizar."
      ),
      buildLog({
        companySlug: company.slug,
        task,
        status: "blocked",
        actor,
        startedAt,
        summary: "Sync bloqueado por organization target invalido.",
        detail:
          "LinkedIn analytics real exige um alvo no formato urn:li:organization:{id} ou o organization ID numerico equivalente."
      })
    );
  }

  const organizationId = extractLinkedInOrganizationId(organizationUrn);
  let organizationLabel = binding.targetLabel;

  try {
    const organization = await fetchJson<LinkedInOrganizationResponse>(
      `https://api.linkedin.com/rest/organizations/${organizationId}`,
      {
        headers: buildLinkedInHeaders(connection.accessToken),
        signal: AbortSignal.timeout(15_000)
      }
    );

    organizationLabel = resolveLinkedInOrganizationLabel(organization.data) ?? organizationLabel;
  } catch {
    // Mantemos o label manual se o lookup nao responder.
  }

  const followers = await fetchJson<{
    firstDegreeSize?: number;
  }>(
    `https://api.linkedin.com/rest/networkSizes/${encodeURIComponent(organizationUrn)}?edgeType=COMPANY_FOLLOWED_BY_MEMBER`,
    {
      headers: buildLinkedInHeaders(connection.accessToken),
      signal: AbortSignal.timeout(15_000)
    }
  );

  const range = buildLinkedInAnalyticsRange(28);
  const timeIntervals = encodeURIComponent(
    `(timeRange:(start:${range.startMs},end:${range.endMs}),timeGranularityType:DAY)`
  );

  const shareStats = await fetchJson<{
    elements?: LinkedInShareStatisticsElement[];
  }>(
    `https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(organizationUrn)}&timeIntervals=${timeIntervals}`,
    {
      headers: buildLinkedInHeaders(connection.accessToken),
      signal: AbortSignal.timeout(15_000)
    }
  );

  const weeklyAggregate = aggregateLinkedInShareStatistics(shareStats.data?.elements, 7);
  const monthlyAggregate = aggregateLinkedInShareStatistics(shareStats.data?.elements, 28);

  const weeklySnapshot = createLinkedInInsightSnapshot(
    company.slug,
    "7d",
    followers.data?.firstDegreeSize,
    weeklyAggregate,
    organizationLabel
  );
  const monthlySnapshot = createLinkedInInsightSnapshot(
    company.slug,
    "28d",
    followers.data?.firstDegreeSize,
    monthlyAggregate,
    organizationLabel
  );

  upsertStoredSocialInsight(weeklySnapshot);
  upsertStoredSocialInsight(monthlySnapshot);

  return persistResult(
    completeSocialRuntimeTask(
      task,
      "Insights reais do LinkedIn sincronizados com sucesso para o workspace."
    ),
    buildLog({
      companySlug: company.slug,
      task,
      status: "completed",
      actor,
      startedAt,
      summary: "O Agent Lion atualizou os snapshots reais do LinkedIn.",
      detail:
        "A sincronizacao trouxe seguidores via Network Sizes e performance organica via Organization Share Statistics do LinkedIn.",
      metrics: [
        metric("Organizacao", organizationLabel),
        metric("Seguidores", formatMetricValue(followers.data?.firstDegreeSize)),
        metric("Reach 7d", weeklySnapshot.reach),
        metric("Reach 28d", monthlySnapshot.reach)
      ]
    })
  );
}

function requireBinding(companySlug: string, platform: SocialPlatformId) {
  return getStoredSocialPlatformBinding(companySlug, platform);
}

async function resolveMetaPageContext(pageId: string, userAccessToken: string): Promise<MetaPageContext> {
  const response = await fetchJson<{
    access_token?: string;
    name?: string;
    followers_count?: number;
  }>(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}?fields=access_token,name,followers_count&access_token=${encodeURIComponent(userAccessToken)}`,
    {
      headers: {
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(15_000)
    }
  );

  if (!response.data?.access_token) {
    throw new Error("A Meta nao retornou um Page Access Token para esta pagina.");
  }

  return {
    pageId,
    pageToken: response.data.access_token,
    pageName: response.data.name,
    followersCount: response.data.followers_count
  };
}

function createFacebookInsightSnapshot(
  companySlug: string,
  window: SocialInsightSnapshot["window"],
  followersCount?: number,
  reachValue?: number
): SocialInsightSnapshot {
  return {
    companySlug,
    platform: "facebook",
    window,
    followers: formatMetricValue(followersCount),
    reach: formatMetricValue(reachValue),
    engagementRate: "n/d",
    clicks: "n/d",
    note:
      "Snapshot real vindo do Facebook Pages API. Nesta fase a runtime sincroniza seguidores e alcance; cliques e engajamento detalhado entram na proxima etapa."
  };
}

function createInstagramInsightSnapshot(
  companySlug: string,
  window: SocialInsightSnapshot["window"],
  followersCount?: number,
  reachValue?: number,
  profileViews?: number,
  username?: string
): SocialInsightSnapshot {
  return {
    companySlug,
    platform: "instagram",
    window,
    followers: formatMetricValue(followersCount),
    reach: formatMetricValue(reachValue),
    engagementRate: "n/d",
    clicks: formatMetricValue(profileViews),
    note: username
      ? `Snapshot real vindo do Instagram Graph API para @${username}. Nesta fase a runtime sincroniza seguidores, alcance e profile views.`
      : "Snapshot real vindo do Instagram Graph API. Nesta fase a runtime sincroniza seguidores, alcance e profile views."
  };
}

function createTikTokInsightSnapshot(
  companySlug: string,
  window: SocialInsightSnapshot["window"],
  profile: TikTokUserInfo,
  aggregate: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    engagementRate: number;
  }
): SocialInsightSnapshot {
  const label = profile.display_name ?? profile.username;

  return {
    companySlug,
    platform: "tiktok",
    window,
    followers: formatMetricValue(profile.follower_count),
    reach: formatMetricValue(aggregate.views),
    engagementRate: formatPercentage(aggregate.engagementRate),
    clicks: formatMetricValue(aggregate.likes),
    note: label
      ? `Snapshot real vindo das APIs oficiais do TikTok para ${label}. Nesta fase a runtime sincroniza seguidores e consolida views e engajamento recente dos videos publicos.`
      : "Snapshot real vindo das APIs oficiais do TikTok. Nesta fase a runtime sincroniza seguidores e consolida views e engajamento recente dos videos publicos."
  };
}

function createLinkedInInsightSnapshot(
  companySlug: string,
  window: SocialInsightSnapshot["window"],
  followersCount: number | undefined,
  aggregate: LinkedInShareAggregate,
  organizationLabel?: string
): SocialInsightSnapshot {
  return {
    companySlug,
    platform: "linkedin",
    window,
    followers: formatMetricValue(followersCount),
    reach: formatMetricValue(aggregate.uniqueImpressions),
    engagementRate: formatPercentage(aggregate.engagementRatio),
    clicks: formatMetricValue(aggregate.clicks),
    note: organizationLabel
      ? `Snapshot real vindo das APIs oficiais do LinkedIn para ${organizationLabel}. Nesta fase a runtime sincroniza seguidores e performance organica da organizacao.`
      : "Snapshot real vindo das APIs oficiais do LinkedIn. Nesta fase a runtime sincroniza seguidores e performance organica da organizacao."
  };
}

function createYouTubeInsightSnapshot(
  companySlug: string,
  window: SocialInsightSnapshot["window"],
  subscriberCount: string | undefined,
  aggregate: YouTubeAnalyticsWindowAggregate,
  channelLabel?: string
): SocialInsightSnapshot {
  return {
    companySlug,
    platform: "youtube",
    window,
    followers: formatMetricValue(parseMetricInteger(subscriberCount)),
    reach: formatMetricValue(aggregate.views),
    engagementRate: formatPercentage(aggregate.engagementRate),
    clicks: formatMetricValue(aggregate.likes),
    note: channelLabel
      ? `Snapshot real vindo das APIs oficiais do YouTube para ${channelLabel}. Nesta fase a runtime sincroniza inscritos, views, likes e comentarios recentes do canal.`
      : "Snapshot real vindo das APIs oficiais do YouTube. Nesta fase a runtime sincroniza inscritos, views, likes e comentarios recentes do canal."
  };
}

function createGoogleBusinessInsightSnapshot(
  companySlug: string,
  window: SocialInsightSnapshot["window"],
  aggregate: GoogleBusinessWindowAggregate,
  locationLabel?: string
): SocialInsightSnapshot {
  return {
    companySlug,
    platform: "google-business",
    window,
    followers: "n/d",
    reach: formatMetricValue(aggregate.impressions),
    engagementRate: formatPercentage(aggregate.engagementRate),
    clicks: formatMetricValue(aggregate.actions),
    note: locationLabel
      ? `Snapshot real vindo das APIs oficiais do Google Business Profile para ${locationLabel}. Nesta fase a runtime consolida impressoes locais, cliques de site, chamadas e rotas.`
      : "Snapshot real vindo das APIs oficiais do Google Business Profile. Nesta fase a runtime consolida impressoes locais, cliques de site, chamadas e rotas."
  };
}

function getLatestMetricValue(
  metrics: Array<{
    period?: string;
    values?: Array<{ value?: number; end_time?: string }>;
  }> | undefined,
  period: string
) {
  const values = metrics?.find((entry) => entry.period === period)?.values;
  if (!values?.length) {
    return undefined;
  }

  return values.at(-1)?.value;
}

function sumInstagramInsightValues(
  metrics: Array<{
    name?: string;
    values?: Array<{
      value?: number | { value?: number };
      end_time?: string;
    }>;
  }> | undefined,
  metricName: string,
  days: number
) {
  const values = metrics?.find((entry) => entry.name === metricName)?.values;
  if (!values?.length) {
    return undefined;
  }

  return values
    .slice(-days)
    .reduce((total, entry) => total + extractMetaInsightValue(entry.value), 0);
}

function aggregateTikTokVideos(videos: TikTokVideo[], days: number) {
  const cutoffSeconds = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
  const relevant = videos.filter((video) => (video.create_time ?? 0) >= cutoffSeconds);

  let views = 0;
  let likes = 0;
  let comments = 0;
  let shares = 0;

  for (const video of relevant) {
    views += toFiniteNumber(video.view_count);
    likes += toFiniteNumber(video.like_count);
    comments += toFiniteNumber(video.comment_count);
    shares += toFiniteNumber(video.share_count);
  }

  const engagements = likes + comments + shares;

  return {
    views,
    likes,
    comments,
    shares,
    engagementRate: views > 0 ? engagements / views : 0
  };
}

function extractMetaInsightValue(value: number | { value?: number } | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value && typeof value === "object" && typeof value.value === "number" && Number.isFinite(value.value)) {
    return value.value;
  }

  return 0;
}

function hasLinkedInAnalyticsScope(scopes: string[]) {
  return scopes.includes("rw_organization_admin");
}

function hasYouTubeAnalyticsScopes(scopes: string[]) {
  return scopes.includes("https://www.googleapis.com/auth/youtube.readonly") &&
    scopes.includes("https://www.googleapis.com/auth/yt-analytics.readonly");
}

function buildLinkedInHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
    "Linkedin-Version": LINKEDIN_VERSION
  };
}

function buildLinkedInAnalyticsRange(days: number) {
  const now = new Date();
  const endMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const startMs = endMs - days * 24 * 60 * 60 * 1000;

  return {
    startMs,
    endMs
  };
}

function aggregateLinkedInShareStatistics(
  elements: LinkedInShareStatisticsElement[] | undefined,
  days: number
): LinkedInShareAggregate {
  const relevant = [...(elements ?? [])]
    .sort((a, b) => (a.timeRange?.end ?? 0) - (b.timeRange?.end ?? 0))
    .slice(-days);

  let clicks = 0;
  let impressions = 0;
  let uniqueImpressions = 0;
  let engagementNumerator = 0;

  for (const entry of relevant) {
    const stats = entry.totalShareStatistics;
    if (!stats) {
      continue;
    }

    const clickCount = toFiniteNumber(stats.clickCount);
    const likeCount = toFiniteNumber(stats.likeCount);
    const commentCount = toFiniteNumber(stats.commentCount);
    const shareCount = toFiniteNumber(stats.shareCount);
    const impressionCount = toFiniteNumber(stats.impressionCount);

    clicks += clickCount;
    impressions += impressionCount;
    uniqueImpressions += getLinkedInUniqueImpressions(stats);
    engagementNumerator += clickCount + likeCount + commentCount + shareCount;
  }

  return {
    uniqueImpressions,
    clicks,
    impressions,
    engagementRatio: impressions > 0 ? engagementNumerator / impressions : 0
  };
}

async function fetchYouTubeChannelProfile(accessToken: string, channelId?: string) {
  const params = new URLSearchParams({
    part: "snippet,statistics"
  });

  if (channelId) {
    params.set("id", channelId);
  } else {
    params.set("mine", "true");
  }

  const response = await fetchJson<YouTubeChannelListResponse>(
    `https://www.googleapis.com/youtube/v3/channels?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(20_000)
    }
  );

  return response.data?.items?.[0] ?? {};
}

async function queryYouTubeAnalyticsWindow(accessToken: string, channelId: string, days: number) {
  const range = buildDateRange(days);
  const params = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate: range.startDate,
    endDate: range.endDate,
    metrics: "views,likes,comments,estimatedMinutesWatched"
  });

  const response = await fetchJson<YouTubeAnalyticsReportResponse>(
    `https://youtubeanalytics.googleapis.com/v2/reports?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(20_000)
    }
  );

  const row = response.data?.rows?.[0] ?? [];
  const views = toFiniteNumber(Number(row[0] ?? 0));
  const likes = toFiniteNumber(Number(row[1] ?? 0));
  const comments = toFiniteNumber(Number(row[2] ?? 0));
  const estimatedMinutesWatched = toFiniteNumber(Number(row[3] ?? 0));

  return {
    views,
    likes,
    comments,
    estimatedMinutesWatched,
    engagementRate: views > 0 ? (likes + comments) / views : 0
  } satisfies YouTubeAnalyticsWindowAggregate;
}

async function fetchGoogleBusinessLocationProfile(accessToken: string, locationName: string) {
  const params = new URLSearchParams({
    readMask: "title"
  });

  const response = await fetchJson<GoogleBusinessLocationResponse>(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(20_000)
    }
  );

  return response.data ?? {};
}

async function fetchGoogleBusinessPerformanceMetrics(accessToken: string, locationName: string, days: number) {
  const range = buildDateRange(days);
  const params = new URLSearchParams();
  const metrics = [
    "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
    "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
    "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
    "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
    "WEBSITE_CLICKS",
    "CALL_CLICKS",
    "BUSINESS_DIRECTION_REQUESTS"
  ];

  for (const metricName of metrics) {
    params.append("dailyMetrics", metricName);
  }

  params.set("dailyRange.start_date.year", range.start.year.toString());
  params.set("dailyRange.start_date.month", range.start.month.toString());
  params.set("dailyRange.start_date.day", range.start.day.toString());
  params.set("dailyRange.end_date.year", range.end.year.toString());
  params.set("dailyRange.end_date.month", range.end.month.toString());
  params.set("dailyRange.end_date.day", range.end.day.toString());

  const response = await fetchJson<GoogleBusinessPerformanceResponse>(
    `https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMultiDailyMetricsTimeSeries?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(20_000)
    }
  );

  return response.data?.multiDailyMetricTimeSeries ?? [];
}

function aggregateGoogleBusinessMetrics(
  series: NonNullable<GoogleBusinessPerformanceResponse["multiDailyMetricTimeSeries"]>,
  days: number
): GoogleBusinessWindowAggregate {
  const impressionMetrics = [
    "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
    "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
    "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
    "BUSINESS_IMPRESSIONS_MOBILE_SEARCH"
  ];

  const impressions = impressionMetrics.reduce(
    (total, metricName) => total + getGoogleBusinessMetricValue(series, metricName, days),
    0
  );
  const websiteClicks = getGoogleBusinessMetricValue(series, "WEBSITE_CLICKS", days);
  const callClicks = getGoogleBusinessMetricValue(series, "CALL_CLICKS", days);
  const directionRequests = getGoogleBusinessMetricValue(series, "BUSINESS_DIRECTION_REQUESTS", days);
  const actions = websiteClicks + callClicks + directionRequests;

  return {
    impressions,
    actions,
    websiteClicks,
    callClicks,
    directionRequests,
    engagementRate: impressions > 0 ? actions / impressions : 0
  };
}

function getGoogleBusinessMetricValue(
  series: NonNullable<GoogleBusinessPerformanceResponse["multiDailyMetricTimeSeries"]>,
  metricName: string,
  days: number
) {
  const datedValues =
    series
      .flatMap((entry) => entry.dailyMetricTimeSeries ?? [])
      .find((entry) => entry.dailyMetric === metricName)
      ?.timeSeries?.datedValues ?? [];

  return datedValues.slice(-days).reduce((total, entry) => total + (parseMetricInteger(entry.value) ?? 0), 0);
}

function normalizeYouTubeChannelId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const match = trimmed.match(/(UC[\w-]{10,})/);
  return match?.[1] ?? trimmed;
}

function normalizeGoogleBusinessAnalyticsLocationName(targetId: string) {
  const value = targetId.trim();
  if (!value) {
    return null;
  }

  if (value.startsWith("locations/")) {
    return value;
  }

  const match = value.match(/locations\/([^/?]+)/);
  return match ? `locations/${match[1]}` : null;
}

function buildDateRange(days: number) {
  const end = new Date();
  end.setDate(end.getDate() - 1);

  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));

  return {
    startDate: formatDateOnly(start),
    endDate: formatDateOnly(end),
    start: {
      year: start.getFullYear(),
      month: start.getMonth() + 1,
      day: start.getDate()
    },
    end: {
      year: end.getFullYear(),
      month: end.getMonth() + 1,
      day: end.getDate()
    }
  };
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getLinkedInUniqueImpressions(stats: LinkedInShareStatistics) {
  return toFiniteNumber(stats.uniqueImpressionsCount ?? stats.uniqueImpressionsCounts);
}

function resolveLinkedInOrganizationLabel(data: LinkedInOrganizationResponse | undefined) {
  if (!data) {
    return undefined;
  }

  if (data.localizedName?.trim()) {
    return data.localizedName.trim();
  }

  const localizedEntries = Object.values(data.name?.localized ?? {}).filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
  );

  if (localizedEntries.length > 0) {
    return localizedEntries[0];
  }

  return data.vanityName?.trim() || undefined;
}

function extractLinkedInOrganizationId(organizationUrn: string) {
  const parts = organizationUrn.split(":");
  return parts.at(-1) ?? organizationUrn;
}

function normalizeLinkedInAuthor(targetId: string) {
  const value = targetId.trim();

  if (value.startsWith("urn:li:")) {
    return value;
  }

  if (value.startsWith("organization:") || value.startsWith("person:")) {
    return `urn:li:${value}`;
  }

  return `urn:li:organization:${value}`;
}

function normalizeLinkedInOrganizationUrn(targetId: string) {
  const value = targetId.trim();

  if (!value) {
    return null;
  }

  if (value.startsWith("urn:li:person:") || value.startsWith("person:")) {
    return null;
  }

  if (value.startsWith("urn:li:organizationBrand:")) {
    return value.replace("urn:li:organizationBrand:", "urn:li:organization:");
  }

  if (value.startsWith("urn:li:organization:")) {
    return value;
  }

  if (value.startsWith("organizationBrand:")) {
    return `urn:li:organization:${value.slice("organizationBrand:".length)}`;
  }

  if (value.startsWith("organization:")) {
    return `urn:li:organization:${value.slice("organization:".length)}`;
  }

  return `urn:li:organization:${value}`;
}

function buildOrganicMessage(post: ScheduledSocialPost) {
  return buildPostCaption(post, 2800);
}

function buildPostCaption(post: ScheduledSocialPost, limit = 2200) {
  const parts = post.caption
    ? [post.caption, post.landingUrl]
    : [post.title, post.summary, post.landingUrl];
  return parts.join("\n\n").trim().slice(0, limit);
}

function getPostAssetUrls(post: ScheduledSocialPost) {
  const values = [...(post.assetUrls ?? [])];

  if (post.assetUrl && !values.includes(post.assetUrl)) {
    values.unshift(post.assetUrl);
  }

  return values;
}

async function publishFacebookPost(page: MetaPageContext, post: ScheduledSocialPost): Promise<RichPublicationResult> {
  const assetUrls = getPostAssetUrls(post);
  const caption = buildPostCaption(post);

  if (post.format === "video" && assetUrls[0]) {
    const response = await fetchTextResponse<{ id?: string }>(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${page.pageId}/videos`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          file_url: assetUrls[0],
          description: caption,
          title: post.title,
          access_token: page.pageToken
        }),
        signal: AbortSignal.timeout(20_000)
      }
    );

    return {
      externalRef: response.data?.id,
      outcome: "Post publicado no Facebook com video final aprovado.",
      summary: "Facebook publicou o video aprovado.",
      detail: "O Agent Lion usou o endpoint oficial de videos da Page para subir o asset final com titulo e descricao aprovados.",
      metrics: [
        metric("Pagina", page.pageName ?? "n/d"),
        metric("Formato", "video"),
        metric("Video ID", response.data?.id ?? "n/d")
      ]
    };
  }

  if ((post.format === "image" || post.format === "carousel") && assetUrls.length > 0) {
    if (post.format === "carousel" || assetUrls.length > 1) {
      const mediaIds: string[] = [];

      for (const assetUrl of assetUrls) {
        const media = await fetchTextResponse<{ id?: string }>(
          `https://graph.facebook.com/${META_GRAPH_VERSION}/${page.pageId}/photos`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
              url: assetUrl,
              published: "false",
              access_token: page.pageToken
            }),
            signal: AbortSignal.timeout(20_000)
          }
        );

        if (!media.data?.id) {
          throw new Error("O Facebook nao retornou o media_fbid de uma das fotos do carrossel.");
        }

        mediaIds.push(media.data.id);
      }

      const params = new URLSearchParams({
        message: caption,
        access_token: page.pageToken
      });

      mediaIds.forEach((mediaId, index) => {
        params.append(`attached_media[${index}]`, JSON.stringify({ media_fbid: mediaId }));
      });

      const response = await fetchTextResponse<{ id?: string }>(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/${page.pageId}/feed`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: params,
          signal: AbortSignal.timeout(20_000)
        }
      );

      return {
        externalRef: response.data?.id,
        outcome: "Post publicado no Facebook com multiplas imagens aprovadas.",
        summary: "Facebook publicou o post com imagens anexadas.",
        detail: "O Agent Lion subiu as imagens como fotos nao publicadas e montou um post unico com attached_media na Page.",
        metrics: [
          metric("Pagina", page.pageName ?? "n/d"),
          metric("Formato", "carousel"),
          metric("Assets", String(mediaIds.length)),
          metric("Post ID", response.data?.id ?? "n/d")
        ]
      };
    }

    const response = await fetchTextResponse<{ id?: string }>(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${page.pageId}/photos`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          url: assetUrls[0],
          caption,
          published: "true",
          access_token: page.pageToken
        }),
        signal: AbortSignal.timeout(20_000)
      }
    );

    return {
      externalRef: response.data?.id,
      outcome: "Post publicado no Facebook com imagem final aprovada.",
      summary: "Facebook publicou a imagem aprovada.",
      detail: "O Agent Lion usou o endpoint oficial de fotos da Page para publicar a imagem final com caption aprovada.",
      metrics: [
        metric("Pagina", page.pageName ?? "n/d"),
        metric("Formato", "image"),
        metric("Photo ID", response.data?.id ?? "n/d")
      ]
    };
  }

  const response = await fetchTextResponse<{ id?: string }>(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${page.pageId}/feed`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        message: buildOrganicMessage(post),
        access_token: page.pageToken
      }),
      signal: AbortSignal.timeout(15_000)
    }
  );

  return {
    externalRef: response.data?.id,
    outcome: "Post publicado no Facebook com sucesso em formato organico.",
    summary: "Facebook publicou o post organicamente.",
    detail: "O Agent Lion usou o Page Access Token da empresa para publicar a copy aprovada em formato organico.",
    metrics: [
      metric("Pagina", page.pageName ?? "n/d"),
      metric("Post ID", response.data?.id ?? "n/d")
    ]
  };
}

async function publishLinkedInPost(
  author: string,
  accessToken: string,
  post: ScheduledSocialPost
): Promise<RichPublicationResult> {
  const assetUrls = getPostAssetUrls(post);
  const commentary = buildOrganicMessage(post);

  const payload: Record<string, unknown> = {
    author,
    commentary,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: []
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false
  };

  if ((post.format === "image" || post.format === "carousel") && assetUrls.length > 0) {
    if (post.format === "carousel" || assetUrls.length > 1) {
      const imageIds = await Promise.all(
        assetUrls.map((assetUrl) => uploadLinkedInImageAsset(author, accessToken, assetUrl))
      );

      payload.content = {
        multiImage: {
          images: imageIds.map((id, index) => ({
            id,
            altText: `${post.title} ${index + 1}`
          }))
        }
      };
    } else {
      const imageId = await uploadLinkedInImageAsset(author, accessToken, assetUrls[0]);
      payload.content = {
        media: {
          altText: post.title,
          id: imageId
        }
      };
    }
  } else if ((post.format === "video" || post.format === "reel" || post.format === "short") && assetUrls[0]) {
    const videoId = await uploadLinkedInVideoAsset(author, accessToken, assetUrls[0]);
    payload.content = {
      media: {
        title: post.title,
        id: videoId
      }
    };
  }

  const response = await fetchTextResponse(
    "https://api.linkedin.com/rest/posts",
    {
      method: "POST",
      headers: buildLinkedInHeaders(accessToken),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000)
    },
    true
  );

  const externalRef = response.headers.get("x-restli-id") ?? undefined;
  const formatLabel =
    post.format === "carousel"
      ? "multi-image"
      : post.format === "reel" || post.format === "short"
        ? "video"
        : post.format;

  return {
    externalRef,
    outcome:
      payload.content && formatLabel !== "video"
        ? "Post publicado no LinkedIn com midia aprovada."
        : payload.content
          ? "Post publicado no LinkedIn com video aprovado."
          : "Post publicado no LinkedIn com sucesso em formato organico.",
    summary:
      post.format === "carousel"
        ? "LinkedIn publicou o post com multiplas imagens."
        : post.format === "image"
          ? "LinkedIn publicou a imagem aprovada."
          : post.format === "video" || post.format === "reel" || post.format === "short"
            ? "LinkedIn publicou o video aprovado."
            : "LinkedIn publicou o post organicamente.",
    detail:
      post.format === "carousel"
        ? "O Agent Lion subiu cada imagem pela Images API e criou um post multiImage no endpoint oficial de Posts."
        : post.format === "image"
          ? "O Agent Lion subiu a imagem final pela Images API e publicou o post com media id oficial."
          : post.format === "video" || post.format === "reel" || post.format === "short"
            ? "O Agent Lion inicializou o upload, enviou o binario do video pela Videos API, aguardou o status AVAILABLE e publicou o post com video."
            : "O Agent Lion enviou a copy aprovada para o endpoint oficial de Posts do LinkedIn.",
    metrics: [
      metric("Autor", author),
      metric("Formato", formatLabel),
      metric("Post ID", externalRef ?? "n/d")
    ]
  };
}

async function publishTikTokPost(accessToken: string, post: ScheduledSocialPost): Promise<RichPublicationResult> {
  const assetUrls = getPostAssetUrls(post);
  if (assetUrls.length === 0) {
    throw new Error("Informe uma URL publica do asset final antes de publicar no TikTok.");
  }

  const creatorInfo = await fetchTikTokCreatorInfo(accessToken);

  if (post.format === "video" || post.format === "short" || post.format === "reel") {
    return publishTikTokVideoPost(accessToken, post, assetUrls[0], creatorInfo);
  }

  if (post.format === "image" || post.format === "carousel") {
    return publishTikTokPhotoPost(accessToken, post, assetUrls, creatorInfo);
  }

  throw new Error(
    "TikTok Direct Post desta fase aceita video, short, reel, imagem unica e sequencia de fotos via PHOTO."
  );
}

async function publishTikTokVideoPost(
  accessToken: string,
  post: ScheduledSocialPost,
  assetUrl: string,
  creatorInfo: TikTokCreatorInfo
): Promise<RichPublicationResult> {
  const title = buildTikTokCaption(post);
  const primaryPrivacyLevel = selectTikTokPrivacyLevel(creatorInfo, "video");

  let initialized: TikTokPublishInitData;
  try {
    initialized = await initializeTikTokVideoDirectPost(accessToken, {
      title,
      privacyLevel: primaryPrivacyLevel,
      videoUrl: assetUrl,
      creatorInfo
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("unaudited_client_can_only_post_to_private_accounts") &&
      creatorInfo.privacy_level_options?.includes("SELF_ONLY") &&
      primaryPrivacyLevel !== "SELF_ONLY"
    ) {
      initialized = await initializeTikTokVideoDirectPost(accessToken, {
        title,
        privacyLevel: "SELF_ONLY",
        videoUrl: assetUrl,
        creatorInfo
      });
    } else {
      throw error;
    }
  }

  const status = await waitForTikTokPublishCompletion(accessToken, initialized.publish_id ?? "");
  const postId = status.publicaly_available_post_id?.[0];
  const externalRef = postId ? String(postId) : initialized.publish_id;
  const publishedPrivately = !postId;

  return {
    externalRef,
    outcome: publishedPrivately
      ? "Video enviado ao TikTok com sucesso; a publicacao foi concluida sem post publico retornado."
      : "Video publicado no TikTok com sucesso via Direct Post.",
    summary:
      post.format === "short" || post.format === "reel"
        ? "TikTok publicou o video curto aprovado."
        : "TikTok publicou o video aprovado.",
    detail: publishedPrivately
      ? "O Agent Lion iniciou o Direct Post no TikTok, aguardou o status PUBLISH_COMPLETE e preservou o publish_id. Em clientes nao auditados ou posts privados, o post publico pode nao ser retornado pela API."
      : "O Agent Lion iniciou o Direct Post no TikTok com PULL_FROM_URL, aguardou a moderacao e recebeu o post_id publico da plataforma.",
    metrics: [
      metric("Conta TikTok", creatorInfo.creator_nickname ?? creatorInfo.creator_username ?? "n/d"),
      metric("Formato", post.format === "short" ? "short" : "video"),
      metric("Post ID", externalRef ?? "n/d")
    ]
  };
}

async function publishTikTokPhotoPost(
  accessToken: string,
  post: ScheduledSocialPost,
  assetUrls: string[],
  creatorInfo: TikTokCreatorInfo
): Promise<RichPublicationResult> {
  const title = buildTikTokCaption(post);
  const primaryPrivacyLevel = selectTikTokPrivacyLevel(creatorInfo, "photo");

  let initialized: TikTokPublishInitData;
  try {
    initialized = await initializeTikTokPhotoDirectPost(accessToken, {
      title,
      description: buildOrganicMessage(post),
      privacyLevel: primaryPrivacyLevel,
      photoImages: assetUrls,
      creatorInfo
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("unaudited_client_can_only_post_to_private_accounts") &&
      creatorInfo.privacy_level_options?.includes("SELF_ONLY") &&
      primaryPrivacyLevel !== "SELF_ONLY"
    ) {
      initialized = await initializeTikTokPhotoDirectPost(accessToken, {
        title,
        description: buildOrganicMessage(post),
        privacyLevel: "SELF_ONLY",
        photoImages: assetUrls,
        creatorInfo
      });
    } else {
      throw error;
    }
  }

  const status = await waitForTikTokPublishCompletion(accessToken, initialized.publish_id ?? "");
  const postId = status.publicaly_available_post_id?.[0];
  const externalRef = postId ? String(postId) : initialized.publish_id;
  const publishedPrivately = !postId;

  return {
    externalRef,
    outcome: publishedPrivately
      ? "Fotos enviadas ao TikTok com sucesso; a publicacao foi concluida sem post publico retornado."
      : "Fotos publicadas no TikTok com sucesso via Direct Post.",
    summary:
      assetUrls.length > 1
        ? "TikTok publicou a sequencia de fotos aprovada."
        : "TikTok publicou a foto aprovada.",
    detail: publishedPrivately
      ? "O Agent Lion enviou as fotos via endpoint PHOTO do TikTok, aguardou o status PUBLISH_COMPLETE e preservou o publish_id quando a API nao retornou post publico."
      : "O Agent Lion enviou as fotos via endpoint PHOTO do TikTok, aguardou a moderacao e recebeu o post_id publico da plataforma.",
    metrics: [
      metric("Conta TikTok", creatorInfo.creator_nickname ?? creatorInfo.creator_username ?? "n/d"),
      metric("Formato", assetUrls.length > 1 ? "photo-sequence" : "photo"),
      metric("Assets", String(assetUrls.length)),
      metric("Post ID", externalRef ?? "n/d")
    ]
  };
}

async function publishYouTubePost(
  company: CompanyProfile,
  accessToken: string,
  post: ScheduledSocialPost
): Promise<RichPublicationResult> {
  if (post.format !== "video" && post.format !== "short" && post.format !== "reel") {
    throw new Error("YouTube desta fase aceita apenas uploads de video, short ou reel.");
  }

  const assetUrls = getPostAssetUrls(post);
  if (assetUrls.length === 0) {
    throw new Error("Informe uma URL publica do video final antes de publicar no YouTube.");
  }

  const videoAsset = await downloadRemoteAsset(assetUrls[0]);
  const metadata = buildYouTubeVideoMetadata(company, post);
  const initResponse = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(videoAsset.bytes.length),
        "X-Upload-Content-Type": videoAsset.contentType
      },
      body: JSON.stringify(metadata),
      signal: AbortSignal.timeout(30_000)
    }
  );

  if (!initResponse.ok) {
    throw new Error(await initResponse.text() || "Falha ao iniciar a sessao de upload resumable no YouTube.");
  }

  const uploadUrl = initResponse.headers.get("Location");
  if (!uploadUrl) {
    throw new Error("O YouTube nao retornou a URL da sessao resumable.");
  }

  const upload = await fetchJson<YouTubeVideoInsertResponse>(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Length": String(videoAsset.bytes.length),
      "Content-Type": videoAsset.contentType
    },
    body: videoAsset.bytes as unknown as BodyInit,
    signal: AbortSignal.timeout(300_000)
  });

  const videoId = upload.data?.id;
  if (!videoId) {
    throw new Error("O YouTube nao retornou o video ID apos o upload.");
  }

  const thumbnailUrl = findThumbnailAssetUrl(post);
  let thumbnailAttached = false;
  if (thumbnailUrl) {
    try {
      await setYouTubeThumbnail(accessToken, videoId, thumbnailUrl);
      thumbnailAttached = true;
    } catch {
      thumbnailAttached = false;
    }
  }

  const channelLabel =
    upload.data?.snippet?.channelTitle ??
    upload.data?.snippet?.channelId ??
    "Canal YouTube conectado";

  return {
    externalRef: videoId,
    outcome:
      "Video enviado ao YouTube com sucesso via videos.insert. Projetos nao auditados pelo YouTube podem ter a visibilidade reduzida automaticamente para private.",
    summary:
      post.format === "short" || post.format === "reel"
        ? "YouTube recebeu o short aprovado."
        : "YouTube recebeu o video aprovado.",
    detail: thumbnailAttached
      ? "O Agent Lion abriu uma sessao resumable do YouTube, subiu o binario do video e aplicou uma thumbnail complementar quando disponivel."
      : "O Agent Lion abriu uma sessao resumable do YouTube e subiu o binario do video com titulo, descricao e privacidade operacional.",
    metrics: [
      metric("Canal", channelLabel),
      metric("Formato", post.format === "reel" ? "short-video" : post.format),
      metric("Video ID", videoId),
      metric("Thumbnail", thumbnailAttached ? "aplicada" : "nao aplicada")
    ]
  };
}

async function publishGoogleBusinessPost(
  company: CompanyProfile,
  binding: NonNullable<ReturnType<typeof requireBinding>>,
  accessToken: string,
  post: ScheduledSocialPost
): Promise<RichPublicationResult> {
  const locationName = normalizeGoogleBusinessLocationName(binding.targetId ?? "");
  if (!locationName) {
    throw new Error(
      "Use o targetId do Google Business no formato accounts/{accountId}/locations/{locationId} para publicar via API."
    );
  }

  if (post.format === "video" || post.format === "short" || post.format === "reel" || post.format === "story") {
    throw new Error("Google Business Profile desta fase aceita posts standard com foto opcional, nao uploads de video.");
  }

  const assetUrl = findImageAssetUrl(post);
  const payload: Record<string, unknown> = {
    languageCode: resolveCompanyLanguageCode(company.region),
    summary: buildGoogleBusinessSummary(post),
    topicType: "STANDARD"
  };

  if (post.landingUrl) {
    payload.callToAction = {
      actionType: "LEARN_MORE",
      url: post.landingUrl
    };
  }

  if (assetUrl) {
    payload.media = [
      {
        mediaFormat: "PHOTO",
        sourceUrl: assetUrl
      }
    ];
  }

  const response = await fetchJson<GoogleBusinessLocalPostResponse>(
    `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000)
    }
  );

  const externalRef = response.data?.name ?? response.data?.searchUrl;

  return {
    externalRef,
    outcome: "Atualizacao local publicada com sucesso no Google Business Profile.",
    summary: "Google Business Profile publicou a atualizacao aprovada.",
    detail: assetUrl
      ? "O Agent Lion criou um local post standard com CTA e foto opcional usando o endpoint oficial de localPosts do Google Business Profile."
      : "O Agent Lion criou um local post standard com CTA opcional usando o endpoint oficial de localPosts do Google Business Profile.",
    metrics: [
      metric("Location", binding.targetLabel),
      metric("CTA", post.landingUrl ? "LEARN_MORE" : "sem CTA"),
      metric("Post", externalRef ?? "n/d")
    ]
  };
}

async function createInstagramSingleImage(
  igUserId: string,
  assetUrl: string,
  caption: string,
  accessToken: string
) {
  const creation = await fetchTextResponse<{
    id?: string;
  }>(`https://graph.facebook.com/${META_GRAPH_VERSION}/${igUserId}/media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      image_url: assetUrl,
      caption,
      access_token: accessToken
    }),
    signal: AbortSignal.timeout(15_000)
  });

  return creation.data?.id;
}

async function createInstagramStoryContainer(
  igUserId: string,
  assetUrl: string,
  accessToken: string
) {
  const params = new URLSearchParams({
    media_type: "STORIES",
    access_token: accessToken
  });

  if (isLikelyImageUrl(assetUrl)) {
    params.set("image_url", assetUrl);
  } else {
    params.set("video_url", assetUrl);
  }

  const creation = await fetchTextResponse<{
    id?: string;
  }>(`https://graph.facebook.com/${META_GRAPH_VERSION}/${igUserId}/media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params,
    signal: AbortSignal.timeout(20_000)
  });

  return creation.data?.id;
}

async function createInstagramVideoContainer(
  igUserId: string,
  assetUrl: string,
  caption: string,
  accessToken: string,
  format: "video" | "reel"
) {
  const params = new URLSearchParams({
    video_url: assetUrl,
    caption,
    access_token: accessToken
  });

  if (format === "reel") {
    params.set("media_type", "REELS");
    params.set("share_to_feed", "true");
  } else {
    params.set("media_type", "VIDEO");
  }

  const creation = await fetchTextResponse<{
    id?: string;
  }>(`https://graph.facebook.com/${META_GRAPH_VERSION}/${igUserId}/media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params,
    signal: AbortSignal.timeout(20_000)
  });

  return creation.data?.id;
}

async function waitForInstagramContainerReady(creationId: string, accessToken: string) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await fetchJson<{
      status?: string;
      status_code?: string;
    }>(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${creationId}?fields=status,status_code&access_token=${encodeURIComponent(accessToken)}`,
      {
        headers: {
          Accept: "application/json"
        },
        signal: AbortSignal.timeout(15_000)
      }
    );

    const status = response.data?.status_code ?? response.data?.status ?? "";
    if (status === "FINISHED" || status === "PUBLISHED") {
      return;
    }

    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`O container de video do Instagram retornou status ${status}.`);
    }

    await sleep(3_000);
  }

  throw new Error("O container de video do Instagram ainda nao terminou o processamento dentro da janela esperada.");
}

async function createInstagramCarousel(
  igUserId: string,
  assetUrls: string[],
  caption: string,
  accessToken: string
) {
  const children: string[] = [];

  for (const assetUrl of assetUrls) {
    const child = await fetchTextResponse<{
      id?: string;
    }>(`https://graph.facebook.com/${META_GRAPH_VERSION}/${igUserId}/media`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        image_url: assetUrl,
        is_carousel_item: "true",
        access_token: accessToken
      }),
      signal: AbortSignal.timeout(15_000)
    });

    if (!child.data?.id) {
      throw new Error("A Meta nao retornou um child media id para o carousel do Instagram.");
    }

    children.push(child.data.id);
  }

  const parent = await fetchTextResponse<{
    id?: string;
  }>(`https://graph.facebook.com/${META_GRAPH_VERSION}/${igUserId}/media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      media_type: "CAROUSEL",
      children: children.join(","),
      caption,
      access_token: accessToken
    }),
    signal: AbortSignal.timeout(15_000)
  });

  return parent.data?.id;
}

function isInstagramStoryVideo(post: ScheduledSocialPost) {
  return post.format === "story" && !isLikelyImageUrl(getPostAssetUrls(post)[0] ?? "");
}

async function uploadLinkedInImageAsset(author: string, accessToken: string, assetUrl: string) {
  const asset = await downloadRemoteAsset(assetUrl);
  const initialized = await fetchJson<LinkedInImageUploadInit>(
    "https://api.linkedin.com/rest/images?action=initializeUpload",
    {
      method: "POST",
      headers: buildLinkedInHeaders(accessToken),
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: author
        }
      }),
      signal: AbortSignal.timeout(15_000)
    }
  );

  const uploadUrl = initialized.data?.value?.uploadUrl;
  const imageId = initialized.data?.value?.image;
  if (!uploadUrl || !imageId) {
    throw new Error("O LinkedIn nao retornou a upload URL da imagem.");
  }

  await uploadBinaryToSignedUrl(uploadUrl, asset, asset.contentType);
  await waitForLinkedInImageAvailable(imageId, accessToken);

  return imageId;
}

async function uploadLinkedInVideoAsset(author: string, accessToken: string, assetUrl: string) {
  const asset = await downloadRemoteAsset(assetUrl);
  const initialized = await fetchJson<LinkedInVideoUploadInit>(
    "https://api.linkedin.com/rest/videos?action=initializeUpload",
    {
      method: "POST",
      headers: buildLinkedInHeaders(accessToken),
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: author,
          fileSizeBytes: asset.bytes.length,
          uploadCaptions: false,
          uploadThumbnail: false
        }
      }),
      signal: AbortSignal.timeout(15_000)
    }
  );

  const videoId = initialized.data?.value?.video;
  const instructions = initialized.data?.value?.uploadInstructions ?? [];
  if (!videoId || instructions.length === 0) {
    throw new Error("O LinkedIn nao retornou as instrucoes de upload do video.");
  }

  for (const instruction of instructions) {
    if (!instruction.uploadUrl) {
      throw new Error("O LinkedIn retornou uma instrucao de upload sem uploadUrl.");
    }

    const firstByte = instruction.firstByte ?? 0;
    const lastByte = instruction.lastByte ?? asset.bytes.length - 1;
    const chunk = asset.bytes.slice(firstByte, lastByte + 1);
    await uploadBinaryToSignedUrl(instruction.uploadUrl, { ...asset, bytes: chunk }, "application/octet-stream");
  }

  await waitForLinkedInVideoAvailable(videoId, accessToken);
  return videoId;
}

async function downloadRemoteAsset(assetUrl: string): Promise<DownloadedAsset> {
  const response = await fetch(assetUrl, {
    headers: {
      Accept: "*/*"
    },
    signal: AbortSignal.timeout(30_000)
  });

  if (!response.ok) {
    throw new Error(`Nao foi possivel baixar o asset remoto (${response.status} ${response.statusText}).`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error("O asset remoto retornou um corpo vazio.");
  }

  return {
    bytes,
    contentType: response.headers.get("content-type")?.trim() || "application/octet-stream"
  };
}

async function uploadBinaryToSignedUrl(uploadUrl: string, asset: DownloadedAsset, contentType: string) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType
    },
    body: asset.bytes as unknown as BodyInit,
    signal: AbortSignal.timeout(60_000)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Falha ao enviar o binario para a signed URL (${response.status} ${response.statusText}).`);
  }
}

async function waitForLinkedInImageAvailable(imageId: string, accessToken: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await fetchJson<LinkedInImageAssetStatus>(
      `https://api.linkedin.com/rest/images/${encodeURIComponent(imageId)}`,
      {
        headers: buildLinkedInHeaders(accessToken),
        signal: AbortSignal.timeout(15_000)
      }
    );

    const status = response.data?.status;
    if (status === "AVAILABLE") {
      return;
    }

    if (status === "PROCESSING_FAILED") {
      throw new Error("O LinkedIn falhou ao processar a imagem enviada.");
    }

    await sleep(2_000);
  }

  throw new Error("A imagem do LinkedIn ainda nao ficou AVAILABLE dentro da janela esperada.");
}

async function waitForLinkedInVideoAvailable(videoId: string, accessToken: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetchJson<LinkedInVideoAssetStatus>(
      `https://api.linkedin.com/rest/videos/${encodeURIComponent(videoId)}`,
      {
        headers: buildLinkedInHeaders(accessToken),
        signal: AbortSignal.timeout(15_000)
      }
    );

    const status = response.data?.status;
    if (status === "AVAILABLE") {
      return;
    }

    if (status === "PROCESSING_FAILED") {
      throw new Error(
        response.data?.processingFailureReason ||
          "O LinkedIn falhou ao processar o video enviado."
      );
    }

    await sleep(3_000);
  }

  throw new Error("O video do LinkedIn ainda nao ficou AVAILABLE dentro da janela esperada.");
}

async function fetchTikTokCreatorInfo(accessToken: string) {
  const response = await fetchTikTokJson<TikTokCreatorInfo>(
    "https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );

  return response.data ?? {};
}

async function initializeTikTokVideoDirectPost(
  accessToken: string,
  input: {
    title: string;
    privacyLevel: string;
    videoUrl: string;
    creatorInfo: TikTokCreatorInfo;
  }
) {
  const response = await fetchTikTokJson<TikTokPublishInitData>(
    "https://open.tiktokapis.com/v2/post/publish/video/init/",
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        post_info: {
          title: input.title,
          privacy_level: input.privacyLevel,
          disable_duet: Boolean(input.creatorInfo.duet_disabled),
          disable_comment: Boolean(input.creatorInfo.comment_disabled),
          disable_stitch: Boolean(input.creatorInfo.stitch_disabled),
          brand_content_toggle: false,
          brand_organic_toggle: false
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: input.videoUrl
        }
      })
    }
  );

  if (!response.data?.publish_id) {
    throw new Error("O TikTok nao retornou o publish_id da publicacao.");
  }

  return response.data;
}

async function initializeTikTokPhotoDirectPost(
  accessToken: string,
  input: {
    title: string;
    description: string;
    privacyLevel: string;
    photoImages: string[];
    creatorInfo: TikTokCreatorInfo;
  }
) {
  const response = await fetchTikTokJson<TikTokPublishInitData>(
    "https://open.tiktokapis.com/v2/post/publish/content/init/",
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        post_info: {
          title: input.title,
          description: input.description,
          privacy_level: input.privacyLevel,
          disable_comment: Boolean(input.creatorInfo.comment_disabled),
          auto_add_music: false
        },
        source_info: {
          source: "PULL_FROM_URL",
          photo_cover_index: 0,
          photo_images: input.photoImages
        },
        post_mode: "DIRECT_POST",
        media_type: "PHOTO"
      })
    }
  );

  if (!response.data?.publish_id) {
    throw new Error("O TikTok nao retornou o publish_id da publicacao em foto.");
  }

  return response.data;
}

async function waitForTikTokPublishCompletion(accessToken: string, publishId: string): Promise<TikTokPublishStatusData> {
  if (!publishId) {
    throw new Error("O TikTok nao retornou um publish_id valido para acompanhar o status.");
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetchTikTokJson<TikTokPublishStatusData>(
      "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          publish_id: publishId
        })
      }
    );

    const status = response.data?.status;
    if (status === "PUBLISH_COMPLETE") {
      return response.data ?? {};
    }

    if (status === "FAILED") {
      throw new Error(response.data?.fail_reason || "O TikTok reportou falha na publicacao.");
    }

    await sleep(4_000);
  }

  throw new Error("O TikTok ainda nao concluiu a publicacao dentro da janela esperada.");
}

async function fetchTikTokUserInfo(accessToken: string) {
  const response = await fetchTikTokJson<{
    user?: TikTokUserInfo;
  }>(
    "https://open.tiktokapis.com/v2/user/info/?fields=display_name,username,follower_count,likes_count,video_count",
    accessToken,
    {
      method: "GET"
    }
  );

  return response.data?.user ?? {};
}

async function listTikTokRecentVideos(accessToken: string, days: number) {
  const videos: TikTokVideo[] = [];
  const cutoffSeconds = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
  let cursor: number | undefined;

  for (let page = 0; page < 3; page += 1) {
    const response = await fetchTikTokJson<{
      videos?: TikTokVideo[];
      cursor?: number;
      has_more?: boolean;
    }>(
      "https://open.tiktokapis.com/v2/video/list/?fields=id,create_time,view_count,like_count,comment_count,share_count",
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          cursor,
          max_count: 20
        })
      }
    );

    const pageVideos = response.data?.videos ?? [];
    videos.push(...pageVideos);

    const oldestCreateTime = pageVideos.at(-1)?.create_time ?? Number.MAX_SAFE_INTEGER;
    if (!response.data?.has_more || oldestCreateTime < cutoffSeconds) {
      break;
    }

    cursor = response.data?.cursor;
    if (!cursor) {
      break;
    }
  }

  return videos;
}

function buildTikTokCaption(post: ScheduledSocialPost) {
  return buildOrganicMessage(post).slice(0, 2200);
}

function selectTikTokPrivacyLevel(creatorInfo: TikTokCreatorInfo, mode: "video" | "photo") {
  const options = creatorInfo.privacy_level_options ?? [];
  if (options.includes("PUBLIC_TO_EVERYONE")) {
    return "PUBLIC_TO_EVERYONE";
  }

  if (options.includes("SELF_ONLY")) {
    return "SELF_ONLY";
  }

  if (options.length > 0) {
    return options[0];
  }

  return mode === "photo" ? "SELF_ONLY" : "PUBLIC_TO_EVERYONE";
}

async function setYouTubeThumbnail(accessToken: string, videoId: string, thumbnailUrl: string) {
  const thumbnail = await downloadRemoteAsset(thumbnailUrl);
  const response = await fetch(
    `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": thumbnail.contentType
      },
      body: thumbnail.bytes as unknown as BodyInit,
      signal: AbortSignal.timeout(60_000)
    }
  );

  if (!response.ok) {
    throw new Error(await response.text() || "Falha ao enviar a thumbnail para o YouTube.");
  }
}

function buildYouTubeVideoMetadata(company: CompanyProfile, post: ScheduledSocialPost) {
  const tags = extractYouTubeTags(post);

  return {
    snippet: {
      title: post.title.slice(0, 100),
      description: buildOrganicMessage(post).slice(0, 5000),
      tags: tags.length > 0 ? tags : undefined,
      categoryId: "22",
      defaultLanguage: resolveCompanyLanguageCode(company.region)
    },
    status: {
      privacyStatus: "unlisted",
      selfDeclaredMadeForKids: false
    }
  };
}

function extractYouTubeTags(post: ScheduledSocialPost) {
  const matches = buildOrganicMessage(post).match(/#[\p{L}\p{N}_-]+/gu) ?? [];
  return [...new Set(matches.map((tag) => tag.replace(/^#/, "").slice(0, 30)).filter(Boolean))].slice(0, 15);
}

function findThumbnailAssetUrl(post: ScheduledSocialPost) {
  const assetUrls = getPostAssetUrls(post);
  return assetUrls.slice(1).find((assetUrl) => isLikelyImageUrl(assetUrl));
}

function findImageAssetUrl(post: ScheduledSocialPost) {
  return getPostAssetUrls(post).find((assetUrl) => isLikelyImageUrl(assetUrl));
}

function isLikelyImageUrl(value: string) {
  return /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(value);
}

function normalizeGoogleBusinessLocationName(targetId: string) {
  const value = targetId.trim();
  if (!value) {
    return null;
  }

  return value.startsWith("accounts/") ? value : null;
}

function buildGoogleBusinessSummary(post: ScheduledSocialPost) {
  return [post.title, post.summary, post.caption].filter(Boolean).join(" - ").slice(0, 1500);
}

function resolveCompanyLanguageCode(region: string) {
  return region.toLowerCase().includes("brasil") ? "pt-BR" : "en-US";
}

async function fetchTikTokJson<T>(input: string, accessToken: string, init: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      ...(init.headers ?? {})
    },
    signal: init.signal ?? AbortSignal.timeout(20_000)
  });

  const rawText = await response.text();
  const payload = rawText ? (JSON.parse(rawText) as { data?: T; error?: { code?: string; message?: string } }) : {};

  if (!response.ok) {
    const code = payload.error?.code ?? response.status;
    const message = payload.error?.message ?? (rawText || response.statusText);
    throw new Error(`TikTok API error (${code}): ${message}`);
  }

  if (payload.error?.code && payload.error.code !== "ok") {
    throw new Error(`TikTok API error (${payload.error.code}): ${payload.error.message ?? "Erro nao detalhado."}`);
  }

  return {
    data: payload.data,
    headers: response.headers
  };
}

async function createMetaCampaign(
  accountId: string,
  accessToken: string,
  input: {
    name: string;
    objective: string;
  }
) {
  const response = await fetchTextResponse<{ id?: string }>(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${accountId}/campaigns`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        name: input.name,
        objective: input.objective,
        status: "ACTIVE",
        special_ad_categories: "[]",
        access_token: accessToken
      }),
      signal: AbortSignal.timeout(15_000)
    }
  );

  if (!response.data?.id) {
    throw new Error("A Meta nao retornou o ID da campanha criada.");
  }

  return response.data.id;
}

async function createMetaAdSet(
  accountId: string,
  accessToken: string,
  input: {
    name: string;
    campaignId: string;
    dailyBudget: string;
    objective: string;
    pageId: string;
    pixelId?: string;
    conversionEvent?: string;
    countryCode: string;
    landingUrl: string;
  }
) {
  const promotedObject =
    input.pixelId && input.conversionEvent
      ? JSON.stringify({
          pixel_id: input.pixelId,
          custom_event_type: input.conversionEvent
        })
      : undefined;

  const params = new URLSearchParams({
    name: input.name,
    campaign_id: input.campaignId,
    daily_budget: input.dailyBudget,
    billing_event: input.pixelId && input.conversionEvent ? "IMPRESSIONS" : "IMPRESSIONS",
    optimization_goal:
      input.pixelId && input.conversionEvent ? "OFFSITE_CONVERSIONS" : mapMetaOptimizationGoal(input.objective),
    targeting: JSON.stringify({
      geo_locations: {
        countries: [input.countryCode]
      }
    }),
    status: "ACTIVE",
    access_token: accessToken
  });

  if (promotedObject) {
    params.set("promoted_object", promotedObject);
  }

  const response = await fetchTextResponse<{ id?: string }>(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${accountId}/adsets`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params,
      signal: AbortSignal.timeout(15_000)
    }
  );

  if (!response.data?.id) {
    throw new Error("A Meta nao retornou o ID do ad set criado.");
  }

  return response.data.id;
}

async function uploadMetaImage(accountId: string, accessToken: string, assetUrl: string) {
  const response = await fetchJson<{
    images?: Record<string, { hash?: string }>;
  }>(`https://graph.facebook.com/${META_GRAPH_VERSION}/${accountId}/adimages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      url: assetUrl,
      access_token: accessToken
    }),
    signal: AbortSignal.timeout(15_000)
  });

  const hash = Object.values(response.data?.images ?? {}).find((entry) => entry.hash)?.hash;
  if (!hash) {
    throw new Error("A Meta nao retornou o image hash do criativo enviado.");
  }

  return hash;
}

async function createMetaCreative(
  accountId: string,
  accessToken: string,
  input: {
    name: string;
    pageId: string;
    instagramActorId?: string;
    landingUrl: string;
    message: string;
    headline: string;
    description: string;
    callToAction: string;
    imageHash?: string;
  }
) {
  const objectStorySpec: Record<string, unknown> = {
    page_id: input.pageId,
    link_data: {
      link: input.landingUrl,
      message: input.message,
      name: input.headline,
      description: input.description,
      call_to_action: {
        type: mapMetaCallToAction(input.callToAction),
        value: {
          link: input.landingUrl
        }
      }
    }
  };

  if (input.instagramActorId) {
    objectStorySpec.instagram_actor_id = input.instagramActorId;
  }

  if (input.imageHash) {
    (objectStorySpec.link_data as Record<string, unknown>).image_hash = input.imageHash;
  }

  const response = await fetchTextResponse<{ id?: string }>(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${accountId}/adcreatives`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        name: input.name,
        object_story_spec: JSON.stringify(objectStorySpec),
        access_token: accessToken
      }),
      signal: AbortSignal.timeout(15_000)
    }
  );

  if (!response.data?.id) {
    throw new Error("A Meta nao retornou o ID do criativo criado.");
  }

  return response.data.id;
}

async function createMetaAd(
  accountId: string,
  accessToken: string,
  input: {
    name: string;
    adSetId: string;
    creativeId: string;
  }
) {
  const response = await fetchTextResponse<{ id?: string }>(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${accountId}/ads`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        name: input.name,
        adset_id: input.adSetId,
        creative: JSON.stringify({ creative_id: input.creativeId }),
        status: "ACTIVE",
        access_token: accessToken
      }),
      signal: AbortSignal.timeout(15_000)
    }
  );

  if (!response.data?.id) {
    throw new Error("A Meta nao retornou o ID do anuncio criado.");
  }

  return response.data.id;
}

async function updateMetaEntity(
  entityId: string,
  accessToken: string,
  fields: Record<string, string>
) {
  await fetchTextResponse(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${entityId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        ...fields,
        access_token: accessToken
      }),
      signal: AbortSignal.timeout(15_000)
    },
    true
  );
}

async function mutateGoogleAdsResource<T extends { resourceName?: string }>(
  customerId: string,
  accessToken: string,
  managerAccountId: string | undefined,
  service: "campaignBudgets" | "campaigns" | "adGroups" | "adGroupCriteria" | "adGroupAds",
  operations: Array<Record<string, unknown>>
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "developer-token": requireGoogleAdsDeveloperToken()
  };

  const loginCustomerId = normalizeGoogleAdsCustomerId(managerAccountId);
  if (loginCustomerId) {
    headers["login-customer-id"] = loginCustomerId;
  }

  const response = await fetchJson<{
    results: T[];
  }>(
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/${service}:mutate`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        operations,
        partialFailure: false,
        validateOnly: false
      }),
      signal: AbortSignal.timeout(20_000)
    }
  );

  return response.data ?? { results: [] };
}

function requireGoogleAdsDeveloperToken() {
  const token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  if (!token) {
    throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN ausente para mutacoes reais no Google Ads.");
  }

  return token;
}

function normalizeMetaAdAccountId(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("act_") ? trimmed : `act_${trimmed}`;
}

function normalizeGoogleAdsCustomerId(value?: string) {
  if (!value) {
    return undefined;
  }

  const digits = value.replace(/\D/g, "");
  return digits.length > 0 ? digits : undefined;
}

function resolveGoogleAdsResourceName(
  customerId: string,
  candidate: string | undefined,
  collection: "campaigns" | "adGroups"
) {
  if (!candidate) {
    return undefined;
  }

  if (candidate.startsWith("customers/")) {
    return candidate;
  }

  const digits = candidate.replace(/\D/g, "");
  return digits ? `customers/${customerId}/${collection}/${digits}` : undefined;
}

function normalizeKeywordThemes(values: string[] | undefined, ...fallbacks: Array<string | undefined>) {
  const explicit = (values ?? []).map((entry) => entry.trim()).filter(Boolean);
  if (explicit.length > 0) {
    return explicit.slice(0, 10);
  }

  return fallbacks
    .flatMap((value) => String(value ?? "").split(/[,\n]/))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 3)
    .slice(0, 6);
}

function normalizeResponsiveSearchAssets(
  values: Array<string | undefined>,
  maxLength: number,
  minItems: number
) {
  const normalized = values
    .flatMap((value) => String(value ?? "").split(/[|\n]/))
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.slice(0, maxLength));

  const unique = [...new Set(normalized)];
  if (unique.length >= minItems) {
    return unique;
  }

  return [
    ...unique,
    ...["Atendimento especialista", "Fale com a equipe agora", "Agende sua avaliacao", "Oferta com foco em resultado"]
      .map((entry) => entry.slice(0, maxLength))
      .filter((entry) => !unique.includes(entry))
  ].slice(0, Math.max(minItems, unique.length));
}

function mapMetaCampaignObjective(objective: string) {
  const normalized = objective.toLowerCase();

  if (normalized.includes("lead")) {
    return "OUTCOME_LEADS";
  }

  if (normalized.includes("convers")) {
    return "OUTCOME_SALES";
  }

  if (normalized.includes("engaj")) {
    return "OUTCOME_ENGAGEMENT";
  }

  return "OUTCOME_TRAFFIC";
}

function mapMetaOptimizationGoal(objective: string) {
  const normalized = objective.toLowerCase();
  if (normalized.includes("lead") || normalized.includes("convers")) {
    return "LINK_CLICKS";
  }

  return "LINK_CLICKS";
}

function mapMetaCallToAction(value: string) {
  const normalized = value.toLowerCase();

  if (normalized.includes("fale") || normalized.includes("mensagem")) {
    return "CONTACT_US";
  }

  if (normalized.includes("agend")) {
    return "BOOK_TRAVEL";
  }

  if (normalized.includes("compr")) {
    return "SHOP_NOW";
  }

  return "LEARN_MORE";
}

function parseCurrencyToMinorUnits(input: string, fallback: number) {
  const parsed = parseLocalizedNumber(input);
  return Math.round((parsed ?? fallback) * 100);
}

function parseCurrencyToMicros(input: string, fallback: number) {
  const parsed = parseLocalizedNumber(input);
  return Math.round((parsed ?? fallback) * 1_000_000);
}

function parseLocalizedNumber(input: string) {
  const match = input.match(/-?[\d.,]+/);
  if (!match) {
    return undefined;
  }

  const raw = match[0];
  const normalized =
    raw.includes(",") && raw.includes(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.includes(",")
        ? raw.replace(",", ".")
        : raw;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

function formatGoogleAdsDate(value: string) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function inferCountryCode(region: string) {
  return region.toLowerCase().includes("brasil") ? "BR" : "US";
}

function buildAdPrimaryText(draft: SocialAdDraft) {
  const value = [draft.creativeAngle, draft.description, draft.callToAction, draft.title]
    .map((entry) => entry?.trim())
    .filter(Boolean)
    .join(" ")
    .trim();

  return value.slice(0, 500);
}

function buildAdLaunchBlockedReason(platform: SocialPlatformId) {
  switch (platform) {
    case "google-ads":
      return "Mapeie o customer ID do Google Ads e, se usar MCC, o manager customer ID desta empresa antes de lancar campanhas.";
    case "instagram":
      return "Mapeie ad account, page_id e instagram_actor_id antes de lancar anuncios Meta para Instagram.";
    case "facebook":
      return "Mapeie ad account e page_id antes de lancar anuncios Meta para Facebook.";
    default:
      return `Complete o binding operacional de paid media para ${platform} antes de lancar este anuncio.`;
  }
}

function buildUnsupportedPublishReason(platform: SocialPlatformId) {
  switch (platform) {
    case "google-ads":
      return "Google Ads opera midia paga pela trilha de anuncios. Ele nao usa a runtime de publicacao organica.";
    case "instagram":
      return "Instagram ja aceita imagem, carousel, video, reel e story nesta fase. Se a publicacao bloquear, revise o asset publico e o tipo de midia enviado.";
    case "tiktok":
      return "TikTok ja opera Direct Post para video e fotos via URL publica. Formatos que fogem disso continuam na proxima etapa.";
    case "youtube":
      return "YouTube ja opera upload de video via sessao resumable. Use assets de video finais e um thumbnail complementar quando houver.";
    case "google-business":
      return "Google Business Profile ja opera local posts standard com CTA e foto opcional quando o targetId estiver no formato accounts/{accountId}/locations/{locationId}.";
    default:
      return "A plataforma ainda nao recebeu um executor real de publicacao nesta fase.";
  }
}

function buildUnsupportedAnalyticsReason(platform: SocialPlatformId) {
  switch (platform) {
    case "google-ads":
      return "Google Ads ja alimenta dados reais via Google data ops. Use o sync dedicado de GA4/Search Console/Ads em vez da runtime social.";
    case "instagram":
      return "Instagram analytics real entra junto com a camada consolidada da Meta para midia, insights e media publish.";
    case "tiktok":
      return "TikTok ja sincroniza followers, views e engajamento recente via user.info e video.list. Vincule a conta e rode o sync da runtime.";
    case "youtube":
      return "YouTube ja sincroniza inscritos e desempenho recente por canal via channels.list e reports.query. Reconecte a conta se faltarem os escopos readonly.";
    case "google-business":
      return "Google Business Profile ja sincroniza performance local real via Business Profile Performance API quando o locationId estiver mapeado.";
    default:
      return "A plataforma ainda nao recebeu um executor analitico real nesta fase.";
  }
}

function persistResult(task: SocialRuntimeTask, log: SocialExecutionLog): ExecutionResult {
  upsertStoredSocialRuntimeTask(task);
  appendStoredSocialExecutionLog(log);

  if (task.kind === "publish_post" && task.status === "completed") {
    const post = getStoredScheduledSocialPosts(task.companySlug).find((entry) => entry.id === task.sourceItemId);
    if (post?.sourceApprovalRequestId) {
      const publishingRequest = getCompanyPublishingRequests(task.companySlug).find(
        (entry) => entry.id === post.sourceApprovalRequestId
      );

      if (publishingRequest && publishingRequest.status !== "posted") {
        upsertStoredPublishingApprovalRequest(markPublishingRequestPosted(publishingRequest));
      }
    }
  }

  if (task.kind === "launch_ad" && task.status === "completed") {
    const draft = getStoredSocialAdDrafts(task.companySlug).find((entry) => entry.id === task.sourceItemId);
    if (draft) {
      upsertStoredSocialAdDraft(markSocialAdDraftLaunched(draft));
    }
  }

  return {
    task,
    log
  };
}

function buildLog(input: {
  companySlug: string;
  task: SocialRuntimeTask;
  status: SocialExecutionLog["status"];
  actor: string;
  startedAt: string;
  summary: string;
  detail: string;
  externalRef?: string;
  metrics?: SocialExecutionMetric[];
}): SocialExecutionLog {
  return {
    id: `social-exec-${input.task.id}-${Date.now()}`,
    companySlug: input.companySlug,
    taskId: input.task.id,
    platform: input.task.platform,
    kind: input.task.kind,
    status: input.status,
    summary: input.summary,
    detail: input.detail,
    startedAt: input.startedAt,
    finishedAt: new Date().toISOString(),
    actor: input.actor,
    externalRef: input.externalRef,
    sourceExperimentId: input.task.sourceExperimentId,
    variantLabel: input.task.variantLabel,
    metrics: input.metrics ?? []
  };
}

function metric(label: string, value: string) {
  return { label, value };
}

function formatMetricValue(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/d";
  }

  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function formatPercentage(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/d";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: 1
  }).format(value);
}

function parseMetricInteger(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toFiniteNumber(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(input: string, init?: RequestInit) {
  const response = await fetch(input, init);
  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(rawText || `${response.status} ${response.statusText}`);
  }

  return {
    data: rawText ? (JSON.parse(rawText) as T) : undefined,
    headers: response.headers
  };
}

async function fetchTextResponse<T>(input: string, init?: RequestInit, allowEmpty = false) {
  const response = await fetch(input, init);
  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(rawText || `${response.status} ${response.statusText}`);
  }

  return {
    data: rawText || allowEmpty ? (rawText ? (JSON.parse(rawText) as T) : undefined) : undefined,
    headers: response.headers
  };
}
