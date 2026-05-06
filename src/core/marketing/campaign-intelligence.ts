import {
  buildOptimizationExperiments,
  buildOptimizationScorecards
} from "@/lib/execution";
import type {
  CompanyCmoStrategicDecision,
  CompanyExperimentOutcome,
  CompanyLearningPlaybook,
  CompanyOptimizationExperiment,
  CompanyOptimizationScorecard,
  CompanyWorkspace,
  PlatformId,
  SocialPlatformId
} from "@/lib/domain";

export type CampaignFunnelStageName = "awareness" | "consideration" | "conversion" | "retention";

export type CampaignReadiness = "ready" | "needs_connection" | "observe" | "blocked";

export type CampaignChannelKey =
  | PlatformId
  | SocialPlatformId
  | "site"
  | "crm"
  | "email"
  | "content";

export type CampaignFunnelStage = {
  stage: CampaignFunnelStageName;
  objective: string;
  currentBottleneck: string;
  recommendedActions: string[];
  metrics: string[];
  evidence: string[];
};

export type CampaignChannelPlan = {
  channel: CampaignChannelKey;
  label: string;
  role: string;
  readiness: CampaignReadiness;
  recommendedDecision: "scale" | "hold" | "fix" | "pause" | "prepare";
  confidence: number;
  nextActions: string[];
  metricsToWatch: string[];
  creativeNeeds: string[];
  evidence: string[];
};

export type CampaignCopyAngle = {
  id: string;
  title: string;
  funnelStage: CampaignFunnelStageName;
  audience: string;
  promise: string;
  proof: string[];
  callToAction: string;
  guardrails: string[];
  source: "agent_profile" | "learning_playbook" | "experiment" | "strategy";
};

export type CampaignVisualPrompt = {
  id: string;
  assetType: "image" | "video" | "carousel";
  platform: CampaignChannelKey;
  format: string;
  prompt: string;
  negativePrompt: string;
  qaChecklist: string[];
  riskNotes: string[];
  sourceAngleId?: string;
};

export type CampaignAnalyticsPlan = {
  targetMetric: string;
  observationWindowDays: number;
  baselineSummary: string;
  requiredEvents: string[];
  attributionGaps: string[];
  optimizationQuestions: string[];
  reportingCadence: string;
};

export type CampaignExperimentPlan = {
  id: string;
  title: string;
  hypothesis: string;
  channel: string;
  targetMetric: string;
  variants: string[];
  successCriteria: string;
  observationWindowDays: number;
  confidence: number;
  evidence: string[];
};

export type CampaignIntelligenceBrief = {
  id: string;
  companySlug: string;
  companyName: string;
  generatedAt: string;
  objective: string;
  weeklyThesis: string;
  primaryBet: string;
  dominantConstraint: CompanyCmoStrategicDecision["dominantConstraint"];
  readinessScore: number;
  executiveSummary: string;
  funnel: CampaignFunnelStage[];
  channels: CampaignChannelPlan[];
  copyAngles: CampaignCopyAngle[];
  visualPrompts: CampaignVisualPrompt[];
  analyticsPlan: CampaignAnalyticsPlan;
  experiments: CampaignExperimentPlan[];
  risks: string[];
  nextBestActions: string[];
  provenance: {
    cmoDecisionId?: string;
    sourceScorecardIds: string[];
    sourceExperimentIds: string[];
    sourcePlaybookIds: string[];
    sourceOutcomeIds: string[];
  };
};

export type CampaignIntelligenceBriefRecordStatus = "materialized" | "archived";

export type CampaignIntelligenceBriefRecord = CampaignIntelligenceBrief & {
  version: number;
  status: CampaignIntelligenceBriefRecordStatus;
  savedAt: string;
  savedBy: string;
  source: "api" | "workspace_page" | "worker";
};

type BuildCampaignIntelligenceBriefInput = {
  workspace: CompanyWorkspace;
  cmoDecision?: CompanyCmoStrategicDecision;
  generatedAt?: string;
};

type MaterializeCampaignIntelligenceBriefInput = {
  brief: CampaignIntelligenceBrief;
  actor: string;
  previousVersion?: number;
  source?: CampaignIntelligenceBriefRecord["source"];
  savedAt?: string;
};

const DEFAULT_CHANNELS: CampaignChannelKey[] = ["meta", "google-ads", "instagram", "linkedin", "site", "crm"];

export function buildCampaignIntelligenceBrief(
  input: BuildCampaignIntelligenceBriefInput
): CampaignIntelligenceBrief {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const workspace = input.workspace;
  const scorecards = selectScorecards(workspace, input.cmoDecision);
  const experiments = selectExperiments(workspace, scorecards, input.cmoDecision);
  const dominantConstraint = input.cmoDecision?.dominantConstraint ?? inferDominantConstraint(workspace, scorecards);
  const weeklyThesis =
    input.cmoDecision?.weeklyThesis ??
    `Concentrar a semana em ${workspace.strategyPlan.primaryObjective} com foco no gargalo dominante de ${dominantConstraint}.`;
  const primaryBet =
    input.cmoDecision?.primaryBet ??
    buildFallbackPrimaryBet(workspace, dominantConstraint, scorecards);
  const channels = buildChannelPlans(workspace, scorecards, input.cmoDecision);
  const funnel = buildFunnel(workspace, dominantConstraint, channels);
  const copyAngles = buildCopyAngles(workspace, dominantConstraint);
  const visualPrompts = buildVisualPrompts(workspace, copyAngles, channels);
  const analyticsPlan = buildAnalyticsPlan(workspace, dominantConstraint, scorecards);
  const experimentPlans = buildExperimentPlans(workspace, experiments);
  const risks = buildRisks(workspace, channels, scorecards);
  const readinessScore = computeReadinessScore(channels, risks, analyticsPlan);
  const nextBestActions = buildNextBestActions(funnel, channels, experimentPlans, risks);

  return {
    id: `campaign-brief-${workspace.company.slug}-${Date.parse(generatedAt) || Date.now()}`,
    companySlug: workspace.company.slug,
    companyName: workspace.company.name,
    generatedAt,
    objective: workspace.strategyPlan.primaryObjective || workspace.company.primaryGoal,
    weeklyThesis,
    primaryBet,
    dominantConstraint,
    readinessScore,
    executiveSummary: buildExecutiveSummary({
      workspace,
      dominantConstraint,
      readinessScore,
      channels,
      experimentPlans
    }),
    funnel,
    channels,
    copyAngles,
    visualPrompts,
    analyticsPlan,
    experiments: experimentPlans,
    risks,
    nextBestActions,
    provenance: {
      cmoDecisionId: input.cmoDecision?.id,
      sourceScorecardIds: scorecards.map((scorecard) => scorecard.id),
      sourceExperimentIds: experiments.map((experiment) => experiment.id),
      sourcePlaybookIds: workspace.learningPlaybooks.map((playbook) => playbook.id),
      sourceOutcomeIds: workspace.experimentOutcomes.map((outcome) => outcome.id)
    }
  };
}

export function materializeCampaignIntelligenceBrief(
  input: MaterializeCampaignIntelligenceBriefInput
): CampaignIntelligenceBriefRecord {
  const savedAt = input.savedAt ?? new Date().toISOString();

  return {
    ...input.brief,
    version: Math.max(1, (input.previousVersion ?? 0) + 1),
    status: "materialized",
    savedAt,
    savedBy: input.actor,
    source: input.source ?? "api"
  };
}

function selectScorecards(
  workspace: CompanyWorkspace,
  cmoDecision?: CompanyCmoStrategicDecision
): CompanyOptimizationScorecard[] {
  if (cmoDecision?.scorecards.length) {
    return cmoDecision.scorecards;
  }

  const fromPlans = workspace.executionPlans.flatMap((plan) => plan.optimizationScorecards ?? []);

  if (fromPlans.length > 0) {
    return fromPlans;
  }

  try {
    return buildOptimizationScorecards(workspace);
  } catch {
    return [];
  }
}

function selectExperiments(
  workspace: CompanyWorkspace,
  scorecards: CompanyOptimizationScorecard[],
  cmoDecision?: CompanyCmoStrategicDecision
): CompanyOptimizationExperiment[] {
  if (cmoDecision?.recommendedExperiments.length) {
    return cmoDecision.recommendedExperiments;
  }

  const fromPlans = workspace.executionPlans.flatMap((plan) => plan.recommendedExperiments ?? []);

  if (fromPlans.length > 0) {
    return fromPlans;
  }

  try {
    return buildOptimizationExperiments(workspace, scorecards);
  } catch {
    return [];
  }
}

function inferDominantConstraint(
  workspace: CompanyWorkspace,
  scorecards: CompanyOptimizationScorecard[]
): CompanyCmoStrategicDecision["dominantConstraint"] {
  const failedConversionSignals = workspace.conversionEvents.filter(
    (event) => event.status === "blocked" || event.status === "failed"
  ).length;
  const connectedPriorityChannels = workspace.strategyPlan.priorityChannels.filter((platform) =>
    isChannelConnected(workspace, platform)
  ).length;
  const qualifiedLeads = workspace.leads.filter((lead) => lead.stage === "qualified" || lead.stage === "proposal")
    .length;
  const wonLeads = workspace.leads.filter((lead) => lead.stage === "won").length;
  const wastefulChannels = scorecards.filter(
    (scorecard) => scorecard.decision === "pause" || scorecard.decision === "fix"
  ).length;

  if (failedConversionSignals > 0) {
    return "tracking";
  }

  if (qualifiedLeads > 0 && wonLeads === 0) {
    return "conversion";
  }

  if (connectedPriorityChannels === 0) {
    return "acquisition";
  }

  if (wastefulChannels > 0) {
    return "acquisition";
  }

  if (workspace.creativeAssets.length === 0 && workspace.socialProfile.contentPillars.length > 0) {
    return "content";
  }

  return "acquisition";
}

function buildFallbackPrimaryBet(
  workspace: CompanyWorkspace,
  dominantConstraint: CompanyCmoStrategicDecision["dominantConstraint"],
  scorecards: CompanyOptimizationScorecard[]
) {
  const scaleCandidate = scorecards.find((scorecard) => scorecard.decision === "scale");

  if (scaleCandidate) {
    return `Escalar ${scaleCandidate.channel} com guarda de risco e medicao em ${scaleCandidate.window}.`;
  }

  if (dominantConstraint === "tracking") {
    return "Corrigir tracking e dispatch de conversao antes de aumentar spend.";
  }

  if (dominantConstraint === "conversion") {
    return "Converter demanda existente com oferta, follow-up e prova mais fortes.";
  }

  return `Preparar canais prioritarios de ${workspace.company.name} para uma campanha mensuravel.`;
}

function buildChannelPlans(
  workspace: CompanyWorkspace,
  scorecards: CompanyOptimizationScorecard[],
  cmoDecision?: CompanyCmoStrategicDecision
): CampaignChannelPlan[] {
  const channelKeys = selectCampaignChannels(workspace, cmoDecision);

  return channelKeys.map((channel) => {
    const scorecard = findScorecardForChannel(scorecards, channel);
    const connected = isChannelConnected(workspace, channel);
    const blocked = isChannelBlocked(workspace, channel);
    const readiness = blocked ? "blocked" : connected ? "ready" : scorecard ? "observe" : "needs_connection";
    const recommendedDecision = scorecard?.decision ?? (connected ? "hold" : "prepare");
    const confidence = scorecard ? clamp(scorecard.score / 100, 0.35, 0.92) : connected ? 0.58 : 0.42;

    return {
      channel,
      label: getChannelLabel(channel),
      role: getChannelRole(channel),
      readiness,
      recommendedDecision,
      confidence,
      nextActions: buildChannelNextActions(workspace, channel, readiness, scorecard),
      metricsToWatch: getChannelMetrics(channel, workspace),
      creativeNeeds: getCreativeNeeds(channel, workspace),
      evidence: buildChannelEvidence(workspace, channel, scorecard)
    };
  });
}

function selectCampaignChannels(
  workspace: CompanyWorkspace,
  cmoDecision?: CompanyCmoStrategicDecision
): CampaignChannelKey[] {
  const channels = new Set<CampaignChannelKey>();

  for (const platform of workspace.strategyPlan.priorityChannels) {
    channels.add(platform);
  }

  for (const platform of workspace.socialProfile.priorityPlatforms) {
    channels.add(platform);
  }

  for (const channel of [...(cmoDecision?.winningChannels ?? []), ...(cmoDecision?.losingChannels ?? [])]) {
    if (channel.platform) {
      channels.add(channel.platform);
    }
  }

  if (workspace.siteOpsProfile.primarySiteUrl || workspace.siteOpsProfile.landingPageUrls.length > 0) {
    channels.add("site");
  }

  if (workspace.crmProfile.provider !== "none" || workspace.leads.length > 0) {
    channels.add("crm");
  }

  for (const fallback of DEFAULT_CHANNELS) {
    if (channels.size >= 6) {
      break;
    }
    channels.add(fallback);
  }

  return Array.from(channels).slice(0, 8);
}

function buildFunnel(
  workspace: CompanyWorkspace,
  dominantConstraint: CompanyCmoStrategicDecision["dominantConstraint"],
  channels: CampaignChannelPlan[]
): CampaignFunnelStage[] {
  const totalLeads = workspace.leads.length;
  const wonLeads = workspace.leads.filter((lead) => lead.stage === "won").length;
  const qualifiedLeads = workspace.leads.filter((lead) => lead.stage === "qualified" || lead.stage === "proposal")
    .length;
  const failedSignals = workspace.conversionEvents.filter(
    (event) => event.status === "blocked" || event.status === "failed"
  ).length;
  const readyAcquisitionChannels = channels.filter(
    (channel) =>
      channel.readiness === "ready" &&
      ["meta", "google-ads", "instagram", "linkedin", "tiktok", "youtube"].includes(channel.channel)
  ).length;

  return [
    {
      stage: "awareness",
      objective: "Gerar demanda qualificada com canais conectados e narrativa consistente.",
      currentBottleneck:
        readyAcquisitionChannels === 0
          ? "Canais de aquisicao ainda precisam de conexao ou alvo operacional pronto."
          : dominantConstraint === "acquisition"
            ? "Aquisicao e o gargalo dominante desta semana."
            : "Aquisicao deve alimentar o funil sem roubar foco do gargalo dominante.",
      recommendedActions: [
        "Priorizar canais com maior prontidao e evidencia recente.",
        "Transformar pilares de conteudo em angles testaveis por canal.",
        "Evitar abrir novos canais antes de resolver conexoes criticas."
      ],
      metrics: ["reach", "ctr", "cpc", "qualified_sessions"],
      evidence: [
        `${readyAcquisitionChannels} canais de aquisicao prontos.`,
        `${workspace.socialInsights.length} snapshots sociais disponiveis.`
      ]
    },
    {
      stage: "consideration",
      objective: "Aumentar confianca com prova, diferenciadores e criativos por segmento.",
      currentBottleneck:
        workspace.creativeAssets.length === 0
          ? "Biblioteca criativa ainda nao tem ativos para reutilizar em campanha."
          : "A consideracao depende de reaproveitar os ativos e aprendizados com mais disciplina.",
      recommendedActions: [
        "Converter diferenciadores em provas e objecoes respondidas.",
        "Criar variacoes de imagem, video curto e carrossel para o mesmo angle.",
        "Usar playbooks ativos apenas dentro do contexto de validade."
      ],
      metrics: ["engagement_rate", "landing_view_rate", "save_rate", "lead_quality"],
      evidence: [
        `${workspace.creativeAssets.length} ativos criativos no workspace.`,
        `${workspace.learningPlaybooks.length} playbooks de aprendizado disponiveis.`
      ]
    },
    {
      stage: "conversion",
      objective: "Converter interesse em lead, oportunidade e receita atribuivel.",
      currentBottleneck:
        failedSignals > 0
          ? "Dispatch de conversao tem bloqueios/falhas e reduz confianca do aprendizado."
          : qualifiedLeads > 0 && wonLeads === 0
            ? "Existe demanda qualificada, mas a passagem para venda ainda nao provou receita."
            : "O funil precisa manter captura, CRM e tracking sincronizados.",
      recommendedActions: [
        "Validar eventos de conversao antes de declarar vencedor/perdedor.",
        "Roteirizar follow-up por score e origem do lead.",
        "Registrar receita, ticket e LTV para calibrar CAC e ROAS."
      ],
      metrics: ["lead_rate", "qualified_rate", "win_rate", "cpa", "roas"],
      evidence: [
        `${totalLeads} leads registrados.`,
        `${qualifiedLeads} leads qualificados/proposta.`,
        `${failedSignals} sinais de conversao bloqueados/falhos.`
      ]
    },
    {
      stage: "retention",
      objective: "Transformar clientes e aprendizados em prova, upsell e reducao de desperdicio.",
      currentBottleneck:
        wonLeads === 0
          ? "Ainda nao ha vitorias comerciais suficientes para criar retencao forte."
          : "Retencao deve alimentar prova social e aprendizado reutilizavel.",
      recommendedActions: [
        "Transformar vendas ganhas em prova e segmento vencedor.",
        "Registrar falhas, recusas e bloqueios como memoria operacional.",
        "Promover playbooks somente com evidencia estatistica suficiente."
      ],
      metrics: ["ltv", "repeat_purchase", "referral", "playbook_reuse_rate"],
      evidence: [`${wonLeads} leads ganhos.`, `${workspace.experimentOutcomes.length} outcomes de experimento.`]
    }
  ];
}

function buildCopyAngles(
  workspace: CompanyWorkspace,
  dominantConstraint: CompanyCmoStrategicDecision["dominantConstraint"]
): CampaignCopyAngle[] {
  const angles: CampaignCopyAngle[] = [];
  const profile = workspace.agentProfile;
  const guardrails = buildGuardrails(workspace);
  const stage = dominantConstraint === "conversion" ? "conversion" : dominantConstraint === "content" ? "consideration" : "awareness";

  angles.push({
    id: `angle-${workspace.company.slug}-offer`,
    title: "Oferta central com promessa verificavel",
    funnelStage: stage,
    audience: profile.idealCustomerProfile,
    promise: profile.offerStrategy || workspace.strategyPlan.primaryObjective,
    proof: profile.differentiators.slice(0, 4),
    callToAction: buildCallToAction(dominantConstraint),
    guardrails,
    source: "agent_profile"
  });

  for (const [index, playbook] of selectReliablePlaybooks(workspace.learningPlaybooks).entries()) {
    angles.push({
      id: `angle-${workspace.company.slug}-playbook-${index + 1}`,
      title: playbook.title,
      funnelStage: mapChannelToFunnelStage(playbook.channel),
      audience: profile.idealCustomerProfile,
      promise: playbook.recommendedAction,
      proof: playbook.evidence.slice(0, 4),
      callToAction: playbook.reuseGuidance[0] ?? buildCallToAction(dominantConstraint),
      guardrails: [
        ...guardrails,
        `Reusar apenas no escopo: ${playbook.validityScope.channel || playbook.channel}.`
      ],
      source: "learning_playbook"
    });
  }

  for (const [index, outcome] of selectExperimentAngles(workspace.experimentOutcomes).entries()) {
    angles.push({
      id: `angle-${workspace.company.slug}-outcome-${index + 1}`,
      title: outcome.title,
      funnelStage: mapChannelToFunnelStage(outcome.channel),
      audience: profile.idealCustomerProfile,
      promise: outcome.winningVariant ?? outcome.hypothesis,
      proof: outcome.evidence.slice(0, 3),
      callToAction: outcome.reuseRecommendation ?? buildCallToAction(dominantConstraint),
      guardrails,
      source: "experiment"
    });
  }

  for (const pillar of profile.contentPillars.slice(0, Math.max(0, 4 - angles.length))) {
    angles.push({
      id: `angle-${workspace.company.slug}-pillar-${slugify(pillar)}`,
      title: pillar,
      funnelStage: "consideration",
      audience: profile.idealCustomerProfile,
      promise: `Mostrar ${pillar.toLowerCase()} com linguagem de ${profile.brandVoice}.`,
      proof: profile.differentiators.slice(0, 3),
      callToAction: buildCallToAction(dominantConstraint),
      guardrails,
      source: "strategy"
    });
  }

  return angles.slice(0, 6);
}

function buildVisualPrompts(
  workspace: CompanyWorkspace,
  copyAngles: CampaignCopyAngle[],
  channels: CampaignChannelPlan[]
): CampaignVisualPrompt[] {
  const visualChannels = channels
    .filter((channel) => ["meta", "instagram", "facebook", "linkedin", "tiktok", "youtube", "google-ads"].includes(channel.channel))
    .slice(0, 4);
  const selectedAngles = copyAngles.slice(0, Math.max(2, Math.min(4, copyAngles.length)));
  const prompts: CampaignVisualPrompt[] = [];
  const forbiddenClaims = workspace.agentProfile.forbiddenClaims;

  for (const [index, angle] of selectedAngles.entries()) {
    const channel = visualChannels[index % Math.max(visualChannels.length, 1)];
    const platform = channel?.channel ?? "instagram";
    const assetType = platform === "youtube" || platform === "tiktok" ? "video" : index % 3 === 2 ? "carousel" : "image";

    prompts.push({
      id: `visual-${workspace.company.slug}-${index + 1}`,
      assetType,
      platform,
      format: buildVisualFormat(platform, assetType),
      prompt: [
        `Create a premium ${assetType} concept for ${workspace.company.name}.`,
        `Audience: ${angle.audience}.`,
        `Main message: ${angle.promise}.`,
        `Brand voice: ${workspace.agentProfile.brandVoice}.`,
        `Visual direction: editorial, high-trust, modern growth operating system, not generic stock marketing.`,
        `Include a clear focal point and enough negative space for headline overlay.`
      ].join(" "),
      negativePrompt: [
        "No fake testimonials.",
        "No exaggerated income claims.",
        "No cluttered layout.",
        "No generic AI-glow dashboard cliche.",
        ...forbiddenClaims.map((claim) => `Avoid claim: ${claim}.`)
      ].join(" "),
      qaChecklist: [
        "Headline is readable on mobile.",
        "Creative matches the selected funnel stage.",
        "Claim is supported by available proof.",
        "No sensitive or forbidden claim appears.",
        "Landing or CTA expectation is explicit."
      ],
      riskNotes: buildVisualRiskNotes(workspace, angle),
      sourceAngleId: angle.id
    });
  }

  return prompts;
}

function buildAnalyticsPlan(
  workspace: CompanyWorkspace,
  dominantConstraint: CompanyCmoStrategicDecision["dominantConstraint"],
  scorecards: CompanyOptimizationScorecard[]
): CampaignAnalyticsPlan {
  const failedSignals = workspace.conversionEvents.filter(
    (event) => event.status === "blocked" || event.status === "failed"
  );
  const targetMetric = dominantConstraint === "tracking"
    ? "conversion_dispatch_health"
    : dominantConstraint === "conversion"
      ? "lead_to_revenue_rate"
      : scorecards.find((scorecard) => scorecard.decision === "scale")?.channel ?? "qualified_acquisition_efficiency";
  const requiredEvents = Array.from(
    new Set([
      ...workspace.agentProfile.conversionEvents,
      workspace.siteOpsProfile.conversionEventName,
      "lead_qualified",
      "opportunity_won"
    ].filter(Boolean))
  );
  const attributionGaps = [
    ...(!isChannelConnected(workspace, "ga4") ? ["GA4 precisa estar conectado para leitura de funil."] : []),
    ...(!isChannelConnected(workspace, "search-console") ? ["Search Console ausente limita leitura organica."] : []),
    ...(failedSignals.length > 0 ? [`${failedSignals.length} eventos de conversao precisam de reprocessamento.`] : []),
    ...(workspace.leads.some((lead) => !lead.utmSource) ? ["Leads sem UTM reduzem confianca de atribuicao."] : [])
  ];

  return {
    targetMetric,
    observationWindowDays: dominantConstraint === "tracking" ? 7 : 14,
    baselineSummary: buildBaselineSummary(workspace, scorecards),
    requiredEvents,
    attributionGaps,
    optimizationQuestions: [
      "Qual canal gera lead qualificado com menor friccao?",
      "Qual angle aumenta taxa de captura sem piorar qualidade?",
      "Qual criativo merece scale, hold, fix ou pause?",
      "Quais bloqueios de tracking invalidam a leitura de vencedor?"
    ],
    reportingCadence: workspace.dataOpsProfile.reportingCadence || "weekly"
  };
}

function buildExperimentPlans(
  workspace: CompanyWorkspace,
  experiments: CompanyOptimizationExperiment[]
): CampaignExperimentPlan[] {
  const fromExperiments = experiments.map((experiment) => ({
    id: experiment.id,
    title: experiment.title,
    hypothesis: experiment.hypothesis,
    channel: experiment.channel,
    targetMetric: experiment.primaryMetric,
    variants: experiment.variants,
    successCriteria: experiment.successCriteria,
    observationWindowDays: experiment.observationWindowDays,
    confidence: experiment.confidence,
    evidence: [
      ...(experiment.sourceScorecardId ? [`Scorecard: ${experiment.sourceScorecardId}`] : []),
      ...(experiment.sourceRunId ? [`Run: ${experiment.sourceRunId}`] : [])
    ]
  }));

  if (fromExperiments.length > 0) {
    return fromExperiments.slice(0, 5);
  }

  return [
    {
      id: `experiment-${workspace.company.slug}-offer-angle`,
      title: "Teste de angle principal por promessa e prova",
      hypothesis:
        "Uma promessa mais especifica, sustentada por prova operacional, aumenta lead qualificado sem depender de mais budget.",
      channel: workspace.strategyPlan.priorityChannels[0] ?? "meta",
      targetMetric: "qualified_lead_rate",
      variants: ["Promessa de eficiencia", "Prova de autoridade", "Reducao de risco"],
      successCriteria: "Aumentar qualified_lead_rate em 15% sem piorar CPA.",
      observationWindowDays: 14,
      confidence: 0.52,
      evidence: ["Experimento gerado por falta de backlog experimental suficiente."]
    }
  ];
}

function buildRisks(
  workspace: CompanyWorkspace,
  channels: CampaignChannelPlan[],
  scorecards: CompanyOptimizationScorecard[]
) {
  const risks = new Set<string>();
  const blockedChannels = channels.filter((channel) => channel.readiness === "blocked");
  const missingChannels = channels.filter((channel) => channel.readiness === "needs_connection");
  const failedConversionEvents = workspace.conversionEvents.filter(
    (event) => event.status === "blocked" || event.status === "failed"
  );

  if (blockedChannels.length > 0) {
    risks.add(`Canais bloqueados: ${blockedChannels.map((channel) => channel.label).join(", ")}.`);
  }

  if (missingChannels.length > 0) {
    risks.add(`Conexoes pendentes podem impedir execucao real: ${missingChannels.map((channel) => channel.label).join(", ")}.`);
  }

  if (failedConversionEvents.length > 0) {
    risks.add(`${failedConversionEvents.length} eventos de conversao bloqueados/falhos podem distorcer aprendizado.`);
  }

  if (workspace.agentProfile.forbiddenClaims.length > 0) {
    risks.add("Existem claims proibidos configurados; todo criativo precisa de QA antes de publicar.");
  }

  if (scorecards.some((scorecard) => scorecard.decision === "pause" && (scorecard.spend ?? 0) > 0)) {
    risks.add("Ha canal com decisao pause e spend recente; exigir policy review antes de qualquer scale.");
  }

  if (workspace.crmProfile.requireConsentForEmail || workspace.crmProfile.requireConsentForAds) {
    risks.add("Consentimento de lead deve ser validado antes de cadencias, remarketing ou audiences.");
  }

  return Array.from(risks).slice(0, 8);
}

function buildNextBestActions(
  funnel: CampaignFunnelStage[],
  channels: CampaignChannelPlan[],
  experiments: CampaignExperimentPlan[],
  risks: string[]
) {
  const actions = new Set<string>();
  const firstRisk = risks[0];
  const connectionGap = channels.find((channel) => channel.readiness === "needs_connection");
  const scaleChannel = channels.find((channel) => channel.recommendedDecision === "scale");
  const fixChannel = channels.find((channel) => channel.recommendedDecision === "fix" || channel.recommendedDecision === "pause");

  if (firstRisk) {
    actions.add(`Mitigar risco antes do scale: ${firstRisk}`);
  }

  if (scaleChannel) {
    actions.add(`Preparar scale controlado em ${scaleChannel.label} com janela de observacao e caps.`);
  }

  if (fixChannel) {
    actions.add(`Corrigir ${fixChannel.label} antes de liberar novo budget ou criativo.`);
  }

  if (connectionGap) {
    actions.add(`Completar conexao de ${connectionGap.label} para tirar campanha do modo simulado.`);
  }

  if (experiments[0]) {
    actions.add(`Rodar experimento: ${experiments[0].title}.`);
  }

  actions.add(`Comecar pelo funil de ${funnel[0].stage} com metrica ${funnel[0].metrics[0]}.`);

  return Array.from(actions).slice(0, 6);
}

function buildExecutiveSummary(input: {
  workspace: CompanyWorkspace;
  dominantConstraint: CompanyCmoStrategicDecision["dominantConstraint"];
  readinessScore: number;
  channels: CampaignChannelPlan[];
  experimentPlans: CampaignExperimentPlan[];
}) {
  const readyChannels = input.channels.filter((channel) => channel.readiness === "ready").length;
  const topExperiment = input.experimentPlans[0]?.title ?? "teste de oferta e criativo";

  return `${input.workspace.company.name} esta com foco dominante em ${input.dominantConstraint}. O brief recomenda operar ${readyChannels} canais prontos, readiness ${input.readinessScore}/100, e usar ${topExperiment} como aprendizado principal antes de expandir risco.`;
}

function computeReadinessScore(
  channels: CampaignChannelPlan[],
  risks: string[],
  analyticsPlan: CampaignAnalyticsPlan
) {
  const readyRatio = channels.length === 0
    ? 0
    : channels.filter((channel) => channel.readiness === "ready").length / channels.length;
  const blockedPenalty = channels.filter((channel) => channel.readiness === "blocked").length * 12;
  const riskPenalty = risks.length * 4;
  const attributionPenalty = analyticsPlan.attributionGaps.length * 5;
  return Math.max(10, Math.min(96, Math.round(35 + readyRatio * 55 - blockedPenalty - riskPenalty - attributionPenalty)));
}

function buildChannelNextActions(
  workspace: CompanyWorkspace,
  channel: CampaignChannelKey,
  readiness: CampaignReadiness,
  scorecard?: CompanyOptimizationScorecard
) {
  if (readiness === "blocked") {
    return ["Resolver bloqueio de alvo/conector.", "Registrar motivo na auditoria antes de reprocessar."];
  }

  if (readiness === "needs_connection") {
    return [`Conectar ${getChannelLabel(channel)} ou marcar como playbook manual.`, "Definir conta/alvo e escopo de permissao."];
  }

  if (scorecard?.decision === "scale") {
    return ["Preparar scale incremental com cap de spend.", "Preservar criativo/segmento vencedor e medir regressao."];
  }

  if (scorecard?.decision === "pause") {
    return ["Pausar aumento de investimento.", "Criar diagnostico de causa: oferta, tracking, publico ou criativo."];
  }

  if (scorecard?.decision === "fix") {
    return ["Criar variante corretiva.", "Revalidar evento e landing antes de nova rodada."];
  }

  if (channel === "crm") {
    return ["Roteirizar follow-up por score.", `Usar owner padrao: ${workspace.crmProfile.defaultOwner}.`];
  }

  if (channel === "site") {
    return ["Revisar headline, prova e captura.", "Confirmar eventos da landing antes do trafego."];
  }

  return ["Preparar briefing de criativo por angle.", "Observar desempenho antes de scale automatico."];
}

function buildChannelEvidence(
  workspace: CompanyWorkspace,
  channel: CampaignChannelKey,
  scorecard?: CompanyOptimizationScorecard
) {
  const evidence = new Set<string>();
  const socialInsight = workspace.socialInsights.find((insight) => insight.platform === channel);
  const binding = workspace.socialBindings.find((entry) => entry.platform === channel);
  const connection = workspace.connections.find((entry) => entry.platform === channel);

  if (scorecard) {
    evidence.add(scorecard.rationale);
    for (const item of scorecard.evidence.slice(0, 2)) {
      evidence.add(item);
    }
  }

  if (socialInsight) {
    evidence.add(`${getChannelLabel(channel)} ${socialInsight.window}: ${socialInsight.note}`);
  }

  if (binding) {
    evidence.add(`Binding ${binding.status}; publishing=${binding.publishingReady}; analytics=${binding.analyticsReady}.`);
  }

  if (connection) {
    evidence.add(`Conexao ${connection.status}: ${connection.nextAction}`);
  }

  if (evidence.size === 0) {
    evidence.add("Sem evidencia operacional recente; tratar como preparacao/observacao.");
  }

  return Array.from(evidence).slice(0, 4);
}

function getChannelMetrics(channel: CampaignChannelKey, workspace: CompanyWorkspace) {
  if (channel === "crm") {
    return ["response_time", "qualified_rate", "win_rate", "ticket", "ltv"];
  }

  if (channel === "site") {
    return ["landing_view_rate", "lead_rate", "form_completion", workspace.siteOpsProfile.conversionEventName || "conversion"];
  }

  if (channel === "google-ads" || channel === "meta") {
    return ["ctr", "cpa", "conversion_rate", "roas", "dispatch_health"];
  }

  if (channel === "youtube" || channel === "tiktok") {
    return ["view_rate", "hook_retention", "click_rate", "lead_quality"];
  }

  return ["reach", "engagement_rate", "clicks", "qualified_actions"];
}

function getCreativeNeeds(channel: CampaignChannelKey, workspace: CompanyWorkspace) {
  const pillars = workspace.agentProfile.contentPillars.slice(0, 2);

  if (channel === "google-ads") {
    return ["headlines responsivos", "descricoes por intencao", "landing com prova", ...pillars];
  }

  if (channel === "youtube" || channel === "tiktok") {
    return ["hook de 3 segundos", "roteiro curto", "prova visual", "CTA direto", ...pillars];
  }

  if (channel === "linkedin") {
    return ["narrativa de autoridade", "case/prova", "post carrossel", ...pillars];
  }

  if (channel === "site") {
    return ["headline", "prova", "secao de objecoes", "captura clara"];
  }

  if (channel === "crm") {
    return ["cadencia email/whatsapp", "script de follow-up", "motivo de contato"];
  }

  return ["imagem 4:5", "video curto", "carrossel de prova", ...pillars];
}

function buildGuardrails(workspace: CompanyWorkspace) {
  return [
    ...workspace.agentProfile.forbiddenClaims.map((claim) => `Nao usar claim: ${claim}.`),
    ...workspace.agentProfile.efficiencyRules.slice(0, 3),
    "Nao prometer resultado sem evidencia.",
    "Toda afirmacao sensivel precisa de fonte ou aprovacao."
  ];
}

function buildCallToAction(dominantConstraint: CompanyCmoStrategicDecision["dominantConstraint"]) {
  if (dominantConstraint === "conversion") {
    return "Solicitar diagnostico ou conversa comercial com contexto do problema.";
  }

  if (dominantConstraint === "tracking") {
    return "Validar operacao e receber plano de correcao mensuravel.";
  }

  if (dominantConstraint === "content") {
    return "Ver exemplos, prova e proximo passo da oferta.";
  }

  return "Entrar no funil com uma promessa clara e medicao de origem.";
}

function selectReliablePlaybooks(playbooks: CompanyLearningPlaybook[]) {
  return playbooks
    .filter((playbook) => playbook.status === "active" && playbook.confidence >= 0.55)
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 3);
}

function selectExperimentAngles(outcomes: CompanyExperimentOutcome[]) {
  return outcomes
    .filter((outcome) => outcome.status === "won" && Boolean(outcome.winningVariant || outcome.reuseRecommendation))
    .sort((left, right) => right.confidenceDelta - left.confidenceDelta)
    .slice(0, 2);
}

function mapChannelToFunnelStage(channel: string): CampaignFunnelStageName {
  const normalized = channel.toLowerCase();

  if (normalized.includes("crm") || normalized.includes("conversion") || normalized.includes("site")) {
    return "conversion";
  }

  if (normalized.includes("retention") || normalized.includes("ltv")) {
    return "retention";
  }

  if (normalized.includes("content") || normalized.includes("social")) {
    return "consideration";
  }

  return "awareness";
}

function buildVisualFormat(channel: CampaignChannelKey, assetType: CampaignVisualPrompt["assetType"]) {
  if (assetType === "video" && (channel === "youtube" || channel === "tiktok")) {
    return "vertical 9:16, 20-35 seconds";
  }

  if (assetType === "carousel") {
    return "4:5 carousel, 5-7 slides";
  }

  if (channel === "linkedin") {
    return "1.91:1 or 4:5 professional feed creative";
  }

  return "4:5 feed creative, mobile-first";
}

function buildVisualRiskNotes(workspace: CompanyWorkspace, angle: CampaignCopyAngle) {
  const notes = new Set<string>();

  if (workspace.agentProfile.forbiddenClaims.length > 0) {
    notes.add("Rodar QA de claims antes de aprovar criativo.");
  }

  if (angle.proof.length === 0) {
    notes.add("Adicionar prova verificavel antes de publicar.");
  }

  if (workspace.crmProfile.requireConsentForAds) {
    notes.add("Nao usar remarketing/audience sem consentimento valido.");
  }

  notes.add("Nao publicar automaticamente nesta fase; gerar asset e enviar para approval.");

  return Array.from(notes);
}

function buildBaselineSummary(
  workspace: CompanyWorkspace,
  scorecards: CompanyOptimizationScorecard[]
) {
  const spend = sum(scorecards.map((scorecard) => scorecard.spend ?? 0));
  const conversions = sum(scorecards.map((scorecard) => scorecard.conversions ?? 0));
  const revenue = sum(scorecards.map((scorecard) => scorecard.revenue ?? 0));
  const sentSignals = workspace.conversionEvents.filter((event) => event.status === "sent").length;
  const blockedSignals = workspace.conversionEvents.filter(
    (event) => event.status === "blocked" || event.status === "failed"
  ).length;

  return `Scorecards=${scorecards.length}; spend=${formatNumber(spend)}; conversions=${formatNumber(conversions)}; revenue=${formatNumber(revenue)}; sinais enviados=${sentSignals}; sinais bloqueados/falhos=${blockedSignals}.`;
}

function isChannelConnected(workspace: CompanyWorkspace, channel: CampaignChannelKey) {
  if (channel === "site") {
    return Boolean(workspace.siteOpsProfile.primarySiteUrl || workspace.siteOpsProfile.landingPageUrls.length > 0);
  }

  if (channel === "crm") {
    return workspace.crmProfile.provider !== "none" && workspace.crmProfile.status !== "action_required";
  }

  if (channel === "email") {
    return workspace.connections.some((connection) => connection.platform === "gmail" && connection.status === "connected");
  }

  const connectionPlatform = mapChannelToConnectionPlatform(channel);
  const hasConnection = connectionPlatform
    ? workspace.connections.some((connection) => connection.platform === connectionPlatform && connection.status === "connected")
    : false;
  const hasSocialConnection = workspace.socialPlatforms.some(
    (platform) => platform.platform === channel && platform.status === "connected"
  );
  const hasReadyBinding = workspace.socialBindings.some(
    (binding) =>
      binding.platform === channel &&
      binding.status !== "blocked" &&
      (binding.analyticsReady || binding.publishingReady || binding.paidMediaReady)
  );

  return hasConnection || hasSocialConnection || hasReadyBinding;
}

function isChannelBlocked(workspace: CompanyWorkspace, channel: CampaignChannelKey) {
  return workspace.socialBindings.some((binding) => binding.platform === channel && binding.status === "blocked");
}

function findScorecardForChannel(
  scorecards: CompanyOptimizationScorecard[],
  channel: CampaignChannelKey
) {
  const normalized = normalizeChannel(channel);

  return scorecards.find((scorecard) => {
    const platform = scorecard.platform ? normalizeChannel(scorecard.platform) : "";
    const channelName = normalizeChannel(scorecard.channel);
    return platform === normalized || channelName.includes(normalized) || normalized.includes(channelName);
  });
}

function mapChannelToConnectionPlatform(channel: CampaignChannelKey): PlatformId | undefined {
  if (channel === "instagram" || channel === "facebook") {
    return "meta";
  }

  if (channel === "google-business") {
    return "business-profile";
  }

  if (["ga4", "google-sheets", "search-console", "google-ads", "meta", "gmail", "youtube"].includes(channel)) {
    return channel as PlatformId;
  }

  return undefined;
}

function getChannelLabel(channel: CampaignChannelKey) {
  const labels: Record<CampaignChannelKey, string> = {
    ga4: "GA4",
    "google-sheets": "Google Sheets",
    "search-console": "Search Console",
    "google-ads": "Google Ads",
    meta: "Meta Ads",
    "business-profile": "Google Business Profile",
    gmail: "Gmail",
    youtube: "YouTube",
    instagram: "Instagram",
    facebook: "Facebook",
    "google-business": "Google Business",
    linkedin: "LinkedIn",
    tiktok: "TikTok",
    site: "Site/Landing",
    crm: "CRM",
    email: "Email",
    content: "Conteudo"
  };

  return labels[channel];
}

function getChannelRole(channel: CampaignChannelKey) {
  if (channel === "ga4" || channel === "search-console" || channel === "google-sheets") {
    return "Medicao, atribuicao e inteligencia operacional.";
  }

  if (channel === "site") {
    return "Captura, prova e conversao.";
  }

  if (channel === "crm" || channel === "gmail" || channel === "email") {
    return "Follow-up, roteamento e receita.";
  }

  if (channel === "google-ads") {
    return "Captura de demanda com intencao.";
  }

  if (channel === "meta" || channel === "instagram" || channel === "facebook") {
    return "Demanda, criativo e retargeting com governanca.";
  }

  if (channel === "youtube" || channel === "tiktok") {
    return "Descoberta e prova visual em video.";
  }

  return "Distribuicao e autoridade.";
}

function normalizeChannel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function slugify(value: string) {
  return normalizeChannel(value) || "angle";
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
