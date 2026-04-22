import {
  getStoredCompanyCreativeAssets,
  getStoredCreativeToolConnections,
  getStoredPublishingApprovalRequests
} from "@/lib/company-vault";
import type {
  CompanyCreativeAsset,
  CompanyCreativeAssetVersion,
  CompanyCreativeQaCheck,
  CompanyOptimizationExperiment,
  CompanyProfile,
  CreativeToolConnection,
  CreativeToolProvider,
  PublishingApprovalRequest
} from "@/lib/domain";

export function getCompanyCreativeTools(company: CompanyProfile) {
  const storedConnections = getStoredCreativeToolConnections(company.slug);
  const defaults = getDefaultCreativeTools(company);

  return defaults.map((tool) => {
    const stored = storedConnections.find((entry) => entry.provider === tool.provider);
    return stored ?? tool;
  });
}

export function getCompanyPublishingRequests(companySlug: string) {
  return getStoredPublishingApprovalRequests(companySlug).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

export function getCompanyCreativeAssets(companySlug: string) {
  return getStoredCompanyCreativeAssets(companySlug).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function buildPublishingApprovalRequest(input: {
  company: CompanyProfile;
  sourceAssetId?: string;
  sourceAssetVersionId?: string;
  title: string;
  assetType: PublishingApprovalRequest["assetType"];
  destination: string;
  platformHint?: PublishingApprovalRequest["platformHint"];
  createdWith: CreativeToolProvider;
  summary: string;
  caption?: string;
  assetUrl?: string;
  assetUrls?: string[];
  landingUrl?: string;
  scheduledFor?: string;
  requestedBy: string;
}) {
  return {
    id: `publish-${input.company.slug}-${Date.now()}`,
    companySlug: input.company.slug,
    sourceAssetId: input.sourceAssetId,
    sourceAssetVersionId: input.sourceAssetVersionId,
    title: input.title,
    assetType: input.assetType,
    destination: input.destination,
    platformHint: input.platformHint,
    createdWith: input.createdWith,
    requestedAt: new Date().toISOString(),
    requestedBy: input.requestedBy,
    status: "pending" as const,
    summary: input.summary,
    caption: input.caption,
    assetUrl: input.assetUrl,
    assetUrls: normalizeAssetUrls(input.assetUrls, input.assetUrl),
    landingUrl: input.landingUrl,
    scheduledFor: input.scheduledFor,
    userApprovalRequired: true as const
  };
}

export function buildCreativeAssetFromPublishingDraft(input: {
  company: CompanyProfile;
  title: string;
  assetType: PublishingApprovalRequest["assetType"];
  destination: string;
  platformHint?: PublishingApprovalRequest["platformHint"];
  createdWith: CreativeToolProvider;
  summary: string;
  caption?: string;
  assetUrl?: string;
  assetUrls?: string[];
  landingUrl?: string;
  scheduledFor?: string;
  requestedBy: string;
}) {
  const createdAt = new Date().toISOString();
  const version = buildCreativeAssetVersion({
    assetType: input.assetType,
    sourceTool: input.createdWith,
    summary: input.summary,
    caption: input.caption,
    assetUrl: input.assetUrl,
    assetUrls: input.assetUrls,
    landingUrl: input.landingUrl,
    scheduledFor: input.scheduledFor
  });

  return {
    id: `creative-${input.company.slug}-${Date.now()}`,
    companySlug: input.company.slug,
    title: input.title,
    assetType: input.assetType,
    origin: "manual",
    platformHint: input.platformHint,
    destination: input.destination,
    createdWith: input.createdWith,
    requestedBy: input.requestedBy,
    createdAt,
    updatedAt: createdAt,
    latestVersionId: version.id,
    summary: input.summary,
    tags: buildCreativeAssetTags(input),
    versions: [version]
  } satisfies CompanyCreativeAsset;
}

export function buildGeneratedCreativeAsset(input: {
  company: CompanyProfile;
  title: string;
  assetType: PublishingApprovalRequest["assetType"];
  destination: string;
  createdWith: CreativeToolProvider;
  requestedBy: string;
  summary: string;
  generationPrompt: string;
  platformHint?: PublishingApprovalRequest["platformHint"];
  scheduledFor?: string;
  sourceExperimentId?: string;
  variantLabel?: string;
}) {
  const createdAt = new Date().toISOString();
  const version = buildCreativeAssetVersion({
    assetType: input.assetType,
    sourceTool: input.createdWith,
    summary: input.summary,
    generationPrompt: input.generationPrompt,
    scheduledFor: input.scheduledFor,
    variantLabel: input.variantLabel
  });

  return {
    id: `creative-${input.company.slug}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    companySlug: input.company.slug,
    title: input.title,
    assetType: input.assetType,
    origin: input.sourceExperimentId ? "experiment" : "generated",
    sourceExperimentId: input.sourceExperimentId,
    platformHint: input.platformHint,
    destination: input.destination,
    createdWith: input.createdWith,
    requestedBy: input.requestedBy,
    createdAt,
    updatedAt: createdAt,
    latestVersionId: version.id,
    summary: input.summary,
    tags: buildCreativeAssetTags({
      assetType: input.assetType,
      destination: input.destination,
      platformHint: input.platformHint,
      createdWith: input.createdWith
    }),
    versions: [version]
  } satisfies CompanyCreativeAsset;
}

export function buildCreativeAssetsForExperiment(input: {
  company: CompanyProfile;
  experiment: CompanyOptimizationExperiment;
  createdWith: CreativeToolProvider;
  requestedBy: string;
}) {
  const platformHint = mapExperimentChannelToPlatform(input.experiment.channel);
  const destination = mapExperimentChannelToDestination(input.experiment.channel);
  const assetType = mapExperimentChannelToAssetType(input.experiment.channel);

  return input.experiment.variants.map((variant, index) =>
    buildGeneratedCreativeAsset({
      company: input.company,
      title: `${input.experiment.title} - Variante ${String.fromCharCode(65 + index)}`,
      assetType,
      destination,
      createdWith: input.createdWith,
      requestedBy: input.requestedBy,
      summary: `${input.experiment.hypothesis} Variante baseada em: ${variant}.`,
      generationPrompt: [
        `Canal: ${input.experiment.channel}.`,
        `Hipotese: ${input.experiment.hypothesis}`,
        `Metrica principal: ${input.experiment.primaryMetric}.`,
        `Criar uma versao focada em: ${variant}.`,
        `Manter coerencia com a marca e CTA orientado a conversao.`
      ].join(" "),
      platformHint,
      sourceExperimentId: input.experiment.id,
      variantLabel: `Variante ${String.fromCharCode(65 + index)}`
    })
  );
}

export function syncCreativeAssetVersionStatus(
  asset: CompanyCreativeAsset,
  versionId: string | undefined,
  status: CompanyCreativeAssetVersion["status"]
) {
  const targetVersionId = versionId ?? asset.latestVersionId;
  return {
    ...asset,
    updatedAt: new Date().toISOString(),
    versions: asset.versions.map((version) =>
      version.id === targetVersionId
        ? {
            ...version,
            status
          }
        : version
    )
  } satisfies CompanyCreativeAsset;
}

export function approvePublishingRequest(request: PublishingApprovalRequest) {
  return {
    ...request,
    status: "approved" as const,
    approvedAt: new Date().toISOString()
  };
}

export function rejectPublishingRequest(request: PublishingApprovalRequest) {
  return {
    ...request,
    status: "rejected" as const,
    rejectedAt: new Date().toISOString()
  };
}

export function markPublishingRequestPosted(request: PublishingApprovalRequest) {
  return {
    ...request,
    status: "posted" as const,
    postedAt: new Date().toISOString()
  };
}

export function getCreativeToolLabel(provider: CreativeToolProvider) {
  switch (provider) {
    case "openai-api":
      return "OpenAI / ChatGPT";
    case "gemini":
      return "Google Gemini";
    case "claude":
      return "Claude";
    case "runway":
      return "Runway";
    case "photoshop-api":
      return "Adobe Photoshop API";
    case "adobe-express":
      return "Adobe Express";
    case "premiere-pro":
      return "Adobe Premiere Pro";
    case "after-effects":
      return "Adobe After Effects";
    case "lightroom":
      return "Adobe Lightroom";
    case "capcut":
      return "CapCut";
    case "figma":
      return "Figma";
    case "google-vids":
      return "Google Vids";
    case "google-drive":
      return "Google Drive";
    default:
      return provider;
  }
}

function getDefaultCreativeTools(company: CompanyProfile): CreativeToolConnection[] {
  return [
    buildTool(company, {
      provider: "openai-api",
      label: "OpenAI / ChatGPT para copy e estrategia",
      status: "action_required",
      automationMode: "create_autonomously",
      accessMethod: "api_key",
      capabilities: ["copy", "briefs", "roteiros", "analise estrategica"],
      accountLabel: "API separada da assinatura ChatGPT",
      notes:
        "Usar para gerar copy, roteiros, analises e prompts. A criacao pode ser autonoma, mas publicar precisa passar pela fila de aprovacao."
    }),
    buildTool(company, {
      provider: "gemini",
      label: "Google Gemini para ideias, pesquisa e apoio criativo",
      status: "planned",
      automationMode: "create_autonomously",
      accessMethod: "browser_assisted",
      capabilities: ["research", "creative ideation", "summaries", "workspace support"],
      accountLabel: `${company.name} - Gemini`,
      notes:
        "Complementa brainstorm, refinamento de briefing e apoio ao ecossistema Google."
    }),
    buildTool(company, {
      provider: "claude",
      label: "Claude para estrategia, revisao e escrita longa",
      status: "planned",
      automationMode: "create_autonomously",
      accessMethod: "browser_assisted",
      capabilities: ["long-form writing", "analysis", "strategy", "review"],
      accountLabel: `${company.name} - Claude`,
      notes:
        "Bom para refinamento de estrategia, revisao de copys e documentos mais extensos."
    }),
    buildTool(company, {
      provider: "runway",
      label: "Runway para video e IA visual",
      status: "planned",
      automationMode: "create_autonomously",
      accessMethod: "browser_assisted",
      capabilities: ["ai video", "video generation", "motion", "visual experiments"],
      accountLabel: `${company.name} - Runway`,
      notes:
        "Usar para prototipos de video, variações visuais e aceleracao criativa antes da aprovacao final."
    }),
    buildTool(company, {
      provider: "canva",
      label: "Canva para layouts e redimensionamento",
      status: "planned",
      automationMode: "create_autonomously",
      accessMethod: "oauth",
      capabilities: ["design", "social", "templates", "resize", "export"],
      accountLabel: `${company.name} - brand kit`,
      notes:
        "Conectar a conta para gerar e exportar criativos e adaptar artes para formatos sociais."
    }),
    buildTool(company, {
      provider: "photoshop-api",
      label: "Adobe Photoshop API para edicao automatizada",
      status: "planned",
      automationMode: "create_autonomously",
      accessMethod: "api_key",
      capabilities: ["image editing", "mockups", "variations", "background"],
      accountLabel: `${company.name} - Adobe Firefly Services`,
      notes:
        "Ideal para edicoes em lote, mockups, recortes e variacoes visuais com mais controle."
    }),
    buildTool(company, {
      provider: "adobe-express",
      label: "Adobe Express para criativos rapidos",
      status: "planned",
      automationMode: "create_autonomously",
      accessMethod: "browser_assisted",
      capabilities: ["social content", "video snippets", "templates", "brand controls"],
      accountLabel: `${company.name} - Adobe Express`,
      notes:
        "Pode funcionar como camada de design rapido e video curto. Publicacao continua bloqueada ate aprovacao."
    }),
    buildTool(company, {
      provider: "premiere-pro",
      label: "Adobe Premiere Pro para edicao de video",
      status: "planned",
      automationMode: "create_autonomously",
      accessMethod: "browser_assisted",
      capabilities: ["video editing", "social cuts", "exports", "timelines"],
      accountLabel: `${company.name} - Premiere Pro`,
      notes:
        "Usar para versoes finais, cortes sociais e empacotamento de video antes da fila de aprovacao."
    }),
    buildTool(company, {
      provider: "after-effects",
      label: "Adobe After Effects para motion e animacao",
      status: "planned",
      automationMode: "create_autonomously",
      accessMethod: "browser_assisted",
      capabilities: ["motion design", "animation", "templates", "transitions"],
      accountLabel: `${company.name} - After Effects`,
      notes:
        "Ideal para motion graphics, aberturas, legendas animadas e acabamento premium."
    }),
    buildTool(company, {
      provider: "lightroom",
      label: "Adobe Lightroom para tratamento de imagem",
      status: "planned",
      automationMode: "create_autonomously",
      accessMethod: "browser_assisted",
      capabilities: ["color grading", "photo presets", "image cleanup", "batch treatment"],
      accountLabel: `${company.name} - Lightroom`,
      notes:
        "Padroniza o banco visual e melhora fotos antes de entrarem em criativos e campanhas."
    }),
    buildTool(company, {
      provider: "google-vids",
      label: "Google Vids para video assistido",
      status: "planned",
      automationMode: "create_autonomously",
      accessMethod: "browser_assisted",
      capabilities: ["scripted video", "slides to video", "drive media", "voiceover"],
      accountLabel: `${company.name} - Google Workspace`,
      notes:
        "Usar para montar videos com material do Drive e do Workspace. Se nao houver API oficial aberta para o fluxo desejado, operar em modo browser-assisted."
    }),
    buildTool(company, {
      provider: "youtube",
      label: "YouTube para publicar video",
      status: "planned",
      automationMode: "publish_requires_approval",
      accessMethod: "oauth",
      capabilities: ["upload", "metadata", "privacy controls", "distribution"],
      accountLabel: `${company.name} - canal oficial`,
      notes:
        "O agente pode preparar o upload, titulo, descricao e tags, mas deve pedir aprovacao antes de publicar."
    }),
    buildTool(company, {
      provider: "capcut",
      label: "CapCut para reels e shorts",
      status: "planned",
      automationMode: "create_autonomously",
      accessMethod: "browser_assisted",
      capabilities: ["short video", "captions", "reels", "fast editing"],
      accountLabel: `${company.name} - CapCut`,
      notes:
        "Acelera criacao de reels, shorts, legendas e variacoes rapidas de video."
    }),
    buildTool(company, {
      provider: "figma",
      label: "Figma para layout e aprovacao visual",
      status: "planned",
      automationMode: "create_autonomously",
      accessMethod: "browser_assisted",
      capabilities: ["wireframes", "visual planning", "mockups", "handoff"],
      accountLabel: `${company.name} - Figma`,
      notes:
        "Ajuda no planejamento visual de landing pages, campanhas e aprovacoes de direcao criativa."
    }),
    buildTool(company, {
      provider: "google-drive",
      label: "Google Drive para ativos e aprovacao",
      status: "planned",
      automationMode: "create_autonomously",
      accessMethod: "oauth",
      capabilities: ["storage", "review links", "asset handoff", "versioning"],
      accountLabel: `${company.name} - pasta de ativos`,
      notes:
        "Centraliza rascunhos, exportacoes e links de revisao antes da publicacao."
    })
  ];
}

function normalizeAssetUrls(assetUrls: string[] | undefined, assetUrl?: string) {
  const values = [...(assetUrls ?? [])];

  if (assetUrl && !values.includes(assetUrl)) {
    values.unshift(assetUrl);
  }

  return values.length > 0 ? values : undefined;
}

function buildCreativeAssetVersion(input: {
  assetType: PublishingApprovalRequest["assetType"];
  sourceTool: CreativeToolProvider;
  summary: string;
  generationPrompt?: string;
  variantLabel?: string;
  caption?: string;
  assetUrl?: string;
  assetUrls?: string[];
  landingUrl?: string;
  scheduledFor?: string;
}) {
  const createdAt = new Date().toISOString();
  const assetUrls = normalizeAssetUrls(input.assetUrls, input.assetUrl);
  const qaChecks = buildCreativeQaChecks({
    assetType: input.assetType,
    summary: input.summary,
    caption: input.caption,
    assetUrls,
    landingUrl: input.landingUrl,
    scheduledFor: input.scheduledFor
  });

  return {
    id: `creative-version-${Date.now()}`,
    createdAt,
    sourceTool: input.sourceTool,
    summary: input.summary,
    generationPrompt: input.generationPrompt,
    variantLabel: input.variantLabel,
    caption: input.caption,
    assetUrl: input.assetUrl,
    assetUrls,
    landingUrl: input.landingUrl,
    scheduledFor: input.scheduledFor,
    status: qaChecks.some((check) => check.status === "blocked")
      ? "draft"
      : "ready_for_approval",
    qaChecks
  } satisfies CompanyCreativeAssetVersion;
}

function mapExperimentChannelToPlatform(channel: string): PublishingApprovalRequest["platformHint"] | undefined {
  switch (channel) {
    case "meta":
      return "instagram";
    case "google-ads":
      return undefined;
    case "youtube":
      return "youtube";
    case "linkedin":
      return "linkedin";
    case "tiktok":
      return "tiktok";
    default:
      return undefined;
  }
}

function mapExperimentChannelToDestination(channel: string) {
  switch (channel) {
    case "meta":
      return "Meta Ads / Social";
    case "google-ads":
      return "Google Ads";
    case "youtube":
      return "YouTube";
    case "linkedin":
      return "LinkedIn";
    case "tiktok":
      return "TikTok";
    default:
      return "Studio";
  }
}

function mapExperimentChannelToAssetType(channel: string): PublishingApprovalRequest["assetType"] {
  switch (channel) {
    case "youtube":
    case "tiktok":
      return "video";
    default:
      return "post";
  }
}

function buildCreativeQaChecks(input: {
  assetType: PublishingApprovalRequest["assetType"];
  summary: string;
  caption?: string;
  assetUrls?: string[];
  landingUrl?: string;
  scheduledFor?: string;
}) {
  const checks: CompanyCreativeQaCheck[] = [];
  const hasAssets = Boolean(input.assetUrls?.length);
  const hasCaption = Boolean(input.caption?.trim());
  const hasLandingUrl = Boolean(input.landingUrl?.trim());
  const requiresAsset =
    input.assetType === "image" ||
    input.assetType === "video" ||
    input.assetType === "carousel" ||
    input.assetType === "post";
  const requiresLanding = input.assetType === "email" || input.assetType === "landing";
  const hasSchedule = Boolean(input.scheduledFor?.trim());

  checks.push({
    id: `qa-summary-${Date.now()}`,
    label: "Briefing minimo",
    status: input.summary.trim().length >= 24 ? "passed" : "blocked",
    detail:
      input.summary.trim().length >= 24
        ? "Resumo com contexto minimo para aprovacoes e handoff."
        : "Resuma melhor objetivo, CTA e publico antes de seguir."
  });
  checks.push({
    id: `qa-caption-${Date.now()}`,
    label: "Caption / copy",
    status: hasCaption ? "passed" : "warning",
    detail: hasCaption ? "Legenda pronta para revisao." : "A legenda ainda nao foi preenchida."
  });
  checks.push({
    id: `qa-assets-${Date.now()}`,
    label: "Assets finais",
    status: hasAssets ? "passed" : requiresAsset ? "blocked" : "warning",
    detail: hasAssets
      ? "Asset publico informado para o Studio."
      : requiresAsset
        ? "Este tipo de criativo precisa de URL publica final antes de seguir."
        : "Ainda nao existe URL publica do asset final."
  });
  if (input.assetType === "carousel") {
    checks.push({
      id: `qa-carousel-${Date.now()}`,
      label: "Estrutura de carousel",
      status: (input.assetUrls?.length ?? 0) >= 2 ? "passed" : "blocked",
      detail:
        (input.assetUrls?.length ?? 0) >= 2
          ? "Carousel com multiplos cards ja disponiveis."
          : "Carousel precisa de pelo menos 2 assets publicados."
    });
  }
  checks.push({
    id: `qa-landing-${Date.now()}`,
    label: "Destino / CTA",
    status: hasLandingUrl ? "passed" : requiresLanding ? "blocked" : "warning",
    detail: hasLandingUrl
      ? "Landing ou URL de destino informada."
      : requiresLanding
        ? "Este ativo precisa de URL de destino antes da aprovacao."
        : "A URL de destino ainda nao foi conectada ao criativo."
  });
  checks.push({
    id: `qa-schedule-${Date.now()}`,
    label: "Janela operacional",
    status: hasSchedule ? "passed" : "warning",
    detail: hasSchedule
      ? "Horario sugerido informado para a fila operacional."
      : "Ainda nao existe uma data sugerida para o envio/publicacao."
  });

  return checks;
}

function buildCreativeAssetTags(input: {
  assetType: PublishingApprovalRequest["assetType"];
  destination: string;
  platformHint?: PublishingApprovalRequest["platformHint"];
  createdWith: CreativeToolProvider;
}) {
  return [input.assetType, input.destination, input.platformHint, input.createdWith]
    .filter(Boolean)
    .map((entry) => String(entry).trim())
    .filter((entry, index, entries) => entries.indexOf(entry) === index);
}

function buildTool(
  company: CompanyProfile,
  input: Omit<CreativeToolConnection, "id" | "companySlug" | "lastValidatedAt">
): CreativeToolConnection {
  return {
    id: `tool-${company.slug}-${input.provider}`,
    companySlug: company.slug,
    ...input
  };
}
