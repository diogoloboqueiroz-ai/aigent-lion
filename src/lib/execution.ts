import {
  appendStoredCompanyExecutionPlan,
  getStoredCompanyExecutionPlans,
  getStoredCompanyOperationalAlerts,
  replaceStoredCompanyOperationalAlerts,
  upsertStoredCompanyCreativeAsset,
  upsertStoredSocialRuntimeTask
} from "@/lib/company-vault";
import { buildCreativeAssetsForExperiment } from "@/lib/creative-tools";
import type {
  CompanyOperationalAlert,
  CompanyExecutionAction,
  OperationalInboxItem,
  CompanyExecutionPlan,
  CompanyExecutionTrack,
  CompanyWorkspace,
  ExecutionApprovalMode,
  ExecutionPlanOrigin,
  ExecutionTrackPriority,
  PlatformId,
  UserProfessionalProfile
} from "@/lib/domain";
import { recordCompanyAuditEvent } from "@/lib/governance";
import { generateCompanyReport, saveGeneratedCompanyReport } from "@/lib/reports";
import {
  buildSocialRuntimeSyncTask,
  buildSocialRuntimeTaskForPost
} from "@/lib/social-runtime";

type GenerateExecutionPlanOptions = {
  origin?: ExecutionPlanOrigin;
};

type ExecutionAnalysis = {
  pendingApprovals: number;
  pendingPaymentApprovals: number;
  pendingPublishingApprovals: number;
  queuedRuntimeTasks: number;
  blockedRuntimeTasks: number;
  failedRuntimeTasks: number;
  overdueScheduledPosts: number;
  scheduledPostsReady: number;
  approvedPublishingBacklog: number;
  connectedPriorityChannels: number;
  priorityChannelGaps: CompanyWorkspace["connections"];
  reportsCount: number;
  realSocialInsights: number;
  analyticsReadyPlatforms: number;
  freshLearnings: number;
  activeLearnings: number;
  playbookLearnings: number;
  riskLearnings: number;
  conversionEventsSent: number;
  conversionEventsBlocked: number;
  conversionEventsFailed: number;
  wonLeads: number;
  wonRevenue: number;
};

export function getCompanyExecutionPlans(companySlug: string) {
  return getStoredCompanyExecutionPlans(companySlug);
}

export function saveCompanyExecutionPlan(plan: CompanyExecutionPlan) {
  appendStoredCompanyExecutionPlan(plan);
}

export function generateCompanyExecutionPlan(
  workspace: CompanyWorkspace,
  professionalProfile?: UserProfessionalProfile | null,
  options?: GenerateExecutionPlanOptions
): CompanyExecutionPlan {
  const analysis = buildExecutionAnalysis(workspace);
  const optimizationScorecards = buildOptimizationScorecards(workspace);
  const recommendedExperiments = buildOptimizationExperiments(workspace, optimizationScorecards);
  const topKeywords = workspace.keywordStrategy.primaryKeywords.slice(0, 3);
  const topAngles = workspace.keywordStrategy.conversionAngles.slice(0, 2);
  const topChannels = workspace.strategyPlan.priorityChannels.slice(0, 3);
  const latestReport = workspace.reports[0];
  const latestCmoDecision = workspace.automationRuns[0]?.cmoDecision;
  const paymentGuardrail = workspace.paymentProfile.approvalRule;
  const topPlaybook = workspace.agentLearnings.find(
    (learning) => learning.kind === "playbook" || learning.kind === "opportunity"
  );
  const topRiskLearning = workspace.agentLearnings.find(
    (learning) => learning.kind === "risk" || learning.kind === "warning"
  );

  const tracks: CompanyExecutionTrack[] = [
    buildOperationsTrack(workspace, analysis),
    buildTrack({
      id: `${workspace.company.slug}-ads`,
      track: "google-ads",
      title: "Ajuste de aquisicao paga",
      objective: workspace.strategyPlan.primaryObjective,
      rationale: `Direcionar verba para keywords e ofertas com maior intencao, protegendo ${workspace.strategyPlan.cpaTarget.toLowerCase()}.`,
      approvalMode: "operator_approval",
      cadence:
        getConnectionStatus(workspace, "google-ads") === "connected"
          ? "revisao diaria com mutacao assistida"
          : "onboarding imediato seguido de auditoria inicial",
      budgetImpact: "medio",
      successMetric: workspace.strategyPlan.cpaTarget,
      actions: [
        getConnectionStatus(workspace, "google-ads") === "connected"
          ? `Subir ou revisar grupos com foco em ${topKeywords.join(", ")}.`
          : "Conectar Google Ads e mapear o customer id antes de abrir mutacoes.",
        getConnectionStatus(workspace, "google-ads") === "connected"
          ? "Pausar termos caros sem sinal de conversao."
          : "Validar escopo de leitura e naming da conta antes da primeira rodada de otimização.",
        `Aplicar o angulo de conversao: ${topAngles[0] ?? "prova e clareza de oferta"}.`
      ],
      priority:
        getConnectionStatus(workspace, "google-ads") !== "connected"
          ? "high"
          : hasUnderperformingSnapshot(workspace, "google-ads")
            ? "high"
            : "medium",
      confidence: getConnectionStatus(workspace, "google-ads") === "connected" ? 0.86 : 0.73,
      trigger:
        getConnectionStatus(workspace, "google-ads") !== "connected"
          ? "Conta Ads ainda nao esta plenamente operacional."
          : "Snapshot mais recente de paid media pede leitura de eficiencia.",
      evidence: [
        `Status de Google Ads: ${getConnectionStatus(workspace, "google-ads")}.`,
        getSnapshotEvidence(workspace, "google-ads")
      ]
    }),
    buildTrack({
      id: `${workspace.company.slug}-content`,
      track: "content",
      title: "Esteira de conteudo de autoridade",
      objective: "Ganhar alcance qualificado e elevar confianca antes da decisao.",
      rationale: `Usar os pilares ${workspace.agentProfile.contentPillars.slice(0, 2).join(" e ")} para sustentar conversao e SEO.`,
      approvalMode: "auto_low_risk",
      cadence: "planejamento semanal com producao continua",
      budgetImpact: "baixo",
      successMetric: workspace.strategyPlan.reachGoal,
      actions: [
        analysis.approvedPublishingBacklog > 0
          ? `Transformar ${analysis.approvedPublishingBacklog} aprovacoes ja liberadas em agenda real no Social Ops.`
          : `Criar 2 posts e 1 roteiro curto usando ${topKeywords.join(", ")}.`,
        `Manter tom de voz: ${workspace.agentProfile.brandVoice}.`,
        "Reforcar CTA para lead qualificado ou contato imediato."
      ],
      priority:
        analysis.scheduledPostsReady === 0 || analysis.approvedPublishingBacklog > 0
          ? "high"
          : "medium",
      confidence: 0.9,
      trigger: `Posts agendados: ${analysis.scheduledPostsReady} · backlog aprovado: ${analysis.approvedPublishingBacklog}.`,
      evidence: [
        `${workspace.publishingRequests.length} pedidos de publicacao no pipeline.`,
        `${analysis.pendingPublishingApprovals} pedidos ainda aguardam decisao final.`
      ]
    }),
    buildTrack({
      id: `${workspace.company.slug}-meta`,
      track: "meta",
      title: "Escala e refresh criativo em Meta",
      objective: "Ampliar alcance e manter frequencia saudavel com criativos renovados.",
      rationale: "Usar testes de mensagem e prova social para ganhar tracao sem perder eficiencia.",
      approvalMode: "operator_approval",
      cadence: "refresh semanal com leitura diaria de fadiga",
      budgetImpact: "medio",
      successMetric: workspace.strategyPlan.roasTarget,
      actions: [
        hasUnderperformingSnapshot(workspace, "meta")
          ? "Revisar fadiga criativa, segmentacao e oferta antes de ampliar budget."
          : `Criar 2 variacoes de criativo usando ${topAngles[1] ?? topAngles[0] ?? "prova social"}.`,
        "Separar campanha de prospeccao e remarketing por objetivo.",
        "Trocar criativos fatigados antes de ampliar budget."
      ],
      priority:
        hasUnderperformingSnapshot(workspace, "meta") ||
        countRuntimeTasksForPlatforms(workspace, ["facebook", "instagram"]) > 0
          ? "high"
          : "medium",
      confidence: getLatestSnapshot(workspace, "meta") ? 0.84 : 0.72,
      trigger: `Backlog Meta/Instagram: ${countRuntimeTasksForPlatforms(workspace, ["facebook", "instagram"])} tarefas abertas.`,
      evidence: [
        getSnapshotEvidence(workspace, "meta"),
        `${workspace.socialProfile.priorityPlatforms.filter((platform) => platform === "facebook" || platform === "instagram").length} plataformas Meta entre as prioridades sociais.`
      ]
    }),
    buildTrack({
      id: `${workspace.company.slug}-seo`,
      track: "seo",
      title: "Bloco SEO e captura organica",
      objective: "Aumentar share organico e reduzir dependencia de midia paga.",
      rationale: `Priorizar consultas de alta intencao e gaps detectados no mercado de ${workspace.company.sector.toLowerCase()}.`,
      approvalMode: "auto_low_risk",
      cadence: "revisao semanal de conteudo e paginas",
      budgetImpact: "baixo",
      successMetric: workspace.strategyPlan.reachGoal,
      actions: [
        getConnectionStatus(workspace, "search-console") === "connected"
          ? `Expandir clusters de long tail: ${workspace.keywordStrategy.longTailKeywords.slice(0, 2).join(", ")}.`
          : "Conectar Search Console para priorizar consultas reais antes de expandir o backlog.",
        "Revisar titles, H1 e mensagem de landing para maior clareza comercial.",
        "Abrir backlog de conteudo-resposta para as principais dores do ICP."
      ],
      priority:
        getConnectionStatus(workspace, "search-console") !== "connected" &&
        topChannels.includes("search-console")
          ? "high"
          : "medium",
      confidence: getConnectionStatus(workspace, "search-console") === "connected" ? 0.82 : 0.68,
      trigger: `Status de Search Console: ${getConnectionStatus(workspace, "search-console")}.`,
      evidence: [
        `Keywords principais: ${topKeywords.join(", ")}.`,
        `${workspace.strategyPlan.competitors.length} concorrentes ja estao mapeados no plano estrategico.`
      ]
    }),
    buildTrack({
      id: `${workspace.company.slug}-local`,
      track: "business-profile",
      title: "Presenca local e autoridade",
      objective: "Melhorar visibilidade local e confianca comercial.",
      rationale: "Atualizar sinais locais ajuda conversao e sustenta busca organica em mercados de decisao rapida.",
      approvalMode: "auto_low_risk",
      cadence: "revisao semanal e checagem diaria de consistencia",
      budgetImpact: "baixo",
      successMetric: workspace.strategyPlan.reachGoal,
      actions: [
        getConnectionStatus(workspace, "business-profile") === "connected"
          ? "Revisar horarios, servicos, atributos e consistencia dos dados do negocio."
          : "Conectar o Perfil da Empresa antes de prometer automacao local.",
        "Preparar respostas e captacao de provas sociais conforme playbook da marca.",
        "Alinhar mensagens locais com a oferta principal e a landing."
      ],
      priority:
        workspace.company.sector.toLowerCase().includes("saude") &&
        getConnectionStatus(workspace, "business-profile") !== "connected"
          ? "medium"
          : "low",
      confidence: getConnectionStatus(workspace, "business-profile") === "connected" ? 0.78 : 0.64,
      trigger: `Setor ${workspace.company.sector} com dependencia local relevante.`,
      evidence: [`Status de Business Profile: ${getConnectionStatus(workspace, "business-profile")}.`]
    }),
    buildTrack({
      id: `${workspace.company.slug}-email`,
      track: "gmail",
      title: "Cadencia de reativacao e follow-up",
      objective: "Recuperar demanda morna e encurtar o tempo de resposta comercial.",
      rationale: "Usar contato de baixo custo para aumentar conversao sem ampliar investimento de midia.",
      approvalMode: "operator_approval",
      cadence: "disparo semanal e follow-up em ate 24h",
      budgetImpact: "baixo",
      successMetric: workspace.strategyPlan.leadGoal,
      actions: [
        getConnectionStatus(workspace, "gmail") === "connected"
          ? "Preparar cadencia de 3 mensagens com CTA unico."
          : "Conectar Gmail com escopo minimo para destravar follow-up e reativacao.",
        "Segmentar leads por intencao, sem usar dados pessoais indevidos.",
        "Testar assunto orientado a dor versus beneficio."
      ],
      priority: getConnectionStatus(workspace, "gmail") !== "connected" ? "medium" : "medium",
      confidence: getConnectionStatus(workspace, "gmail") === "connected" ? 0.8 : 0.67,
      trigger: `Meta de leads ativa: ${workspace.strategyPlan.leadGoal}.`,
      evidence: [`Status de Gmail: ${getConnectionStatus(workspace, "gmail")}.`]
    })
  ].filter((track) => {
    if (track.track === "content" || track.track === "seo" || track.track === "gmail" || track.track === "operations") {
      return true;
    }

    return isPlatformTrack(track.track) ? topChannels.includes(track.track) : false;
  });

  const sortedTracks = enrichTracksWithProfessionalProfile(tracks, professionalProfile, latestReport?.summary).sort(
    (a, b) => getPriorityScore(b.priority) - getPriorityScore(a.priority) || (b.confidence ?? 0) - (a.confidence ?? 0)
  );

  const weeklyFocus = [
    latestCmoDecision
      ? `Tese do CMO Agent: ${latestCmoDecision.weeklyThesis}`
      : sortedTracks[0]
      ? `Atacar primeiro: ${sortedTracks[0].title.toLowerCase()}.`
      : `Proteger ${workspace.strategyPlan.primaryObjective.toLowerCase()}.`,
    `Executar nos canais: ${topChannels.join(", ") || "google-ads, ga4, search-console"}.`,
    `Priorizar as keywords: ${topKeywords.join(", ")}.`
  ];

  if (analysis.pendingApprovals > 0) {
    weeklyFocus.push(`Nao deixar ${analysis.pendingApprovals} aprovacoes virarem gargalo silencioso.`);
  }

  if (topPlaybook) {
    weeklyFocus.push(`Reaplicar aprendizado ativo: ${topPlaybook.title.toLowerCase()}.`);
  }

  if (topRiskLearning) {
    weeklyFocus.push(`Conter risco vivo: ${topRiskLearning.summary}`);
  }

  if (analysis.conversionEventsBlocked + analysis.conversionEventsFailed > 0) {
    weeklyFocus.push(
      `Fechar o gap de atribuicao: ${analysis.conversionEventsBlocked} bloqueios e ${analysis.conversionEventsFailed} falhas ainda impedem um loop de aprendizado mais forte.`
    );
  }

  if (professionalProfile) {
    weeklyFocus.push(`Aplicar o estilo decisorio: ${professionalProfile.decisionStyle}.`);
  }

  if (latestCmoDecision?.primaryBet) {
    weeklyFocus.push(`Aposta principal desta rodada: ${latestCmoDecision.primaryBet}.`);
  }

  return {
    id: `execution-${workspace.company.slug}-${Date.now()}`,
    companySlug: workspace.company.slug,
    companyName: workspace.company.name,
    generatedAt: new Date().toISOString(),
    title: `Plano operacional orientado por sinais - ${workspace.company.name}`,
    summary: `Plano de execucao para ${workspace.company.name}, guiado por sinais reais do workspace. Hoje o foco principal e ${sortedTracks[0]?.title.toLowerCase() ?? "organizar a operacao"}, com ${analysis.pendingApprovals} pendencias acionaveis, ${analysis.queuedRuntimeTasks + analysis.blockedRuntimeTasks + analysis.failedRuntimeTasks} itens abertos na runtime social e ${analysis.conversionEventsSent}/${analysis.conversionEventsBlocked}/${analysis.conversionEventsFailed} sinais de conversao em sent/bloqueado/falha.`,
    weeklyFocus,
    launchChecklist: [
      `Validar se as conexoes prioritarias estao ativas: ${topChannels.join(", ")}.`,
      analysis.priorityChannelGaps.length > 0
        ? `Resolver ${analysis.priorityChannelGaps.length} gaps de conexao antes de ampliar autonomia.`
        : "Conexoes principais prontas para a proxima rodada operacional.",
      "Confirmar metas da semana com base em alcance, leads e eficiencia.",
      analysis.queuedRuntimeTasks + analysis.blockedRuntimeTasks + analysis.failedRuntimeTasks > 0
        ? "Ler a runtime social antes de abrir novas frentes para nao empilhar backlog."
        : "Runtime social sem fila critica no momento.",
      `Respeitar a regra de aprovacao financeira: ${paymentGuardrail}.`,
      "Registrar toda mudanca relevante na trilha de auditoria."
    ],
    approvalQueue: buildApprovalQueue(workspace, analysis, professionalProfile),
    operatorContext: professionalProfile
      ? `${professionalProfile.displayName} atua como ${professionalProfile.professionalTitle.toLowerCase()} e quer ${professionalProfile.strategicNorthStar.toLowerCase()}.${latestCmoDecision ? ` O CMO Agent definiu foco em ${latestCmoDecision.dominantConstraint}.` : ""}`
      : latestCmoDecision
        ? `Plano gerado com foco estrategico do CMO Agent em ${latestCmoDecision.dominantConstraint}.`
        : "Plano gerado sem memoria profissional do operador.",
    origin: options?.origin ?? "manual",
    autopilotSummary: buildAutopilotSummary(workspace, analysis, optimizationScorecards),
    decisionSignals: buildDecisionSignals(analysis, optimizationScorecards),
    learningHighlights: workspace.agentLearnings.slice(0, 3).map((learning) => ({
      title: learning.title,
      summary: learning.summary,
      kind: learning.kind,
      priority: learning.priority,
      confidence: learning.confidence,
      sourcePath: learning.sourcePath,
      sourceLabel: learning.sourceLabel
    })),
    optimizationScorecards,
    recommendedExperiments,
    recommendedActions: buildRecommendedActions(
      workspace,
      analysis,
      optimizationScorecards,
      recommendedExperiments
    ),
    tracks: sortedTracks
  };
}

export function materializeExecutionPlanActions(
  workspace: CompanyWorkspace,
  plan: CompanyExecutionPlan,
  actor: string,
  professionalProfile?: UserProfessionalProfile | null
) {
  const nextActions = (plan.recommendedActions ?? []).map((action) => {
    if (action.kind === "queue_due_social_posts") {
      const duePosts = workspace.scheduledPosts.filter(
        (post) => post.status === "scheduled" && new Date(post.scheduledFor).getTime() <= Date.now()
      );
      let created = 0;

      for (const post of duePosts) {
        const binding = workspace.socialBindings.find((entry) => entry.platform === post.platform);
        if (!binding) {
          continue;
        }

        const existingTask = workspace.socialRuntimeTasks.find(
          (entry) =>
            entry.kind === "publish_post" &&
            entry.sourceItemId === post.id &&
            entry.status !== "completed"
        );

        if (existingTask) {
          continue;
        }

        upsertStoredSocialRuntimeTask(buildSocialRuntimeTaskForPost(post, binding, actor));
        created += 1;
      }

      return {
        ...action,
        status: created > 0 ? ("executed" as const) : ("blocked" as const),
        outcome:
          created > 0
            ? `${created} posts aprovados foram enfileirados para publicacao auditavel.`
            : "Nenhum post novo precisou entrar na fila agora."
      };
    }

    if (action.kind === "queue_social_sync") {
      const bindings = workspace.socialBindings.filter((binding) => binding.analyticsReady);
      let created = 0;

      for (const binding of bindings) {
        const existingTask = workspace.socialRuntimeTasks.find(
          (entry) =>
            entry.kind === "sync_analytics" &&
            entry.platform === binding.platform &&
            entry.status !== "completed"
        );

        if (existingTask) {
          continue;
        }

        upsertStoredSocialRuntimeTask(
          buildSocialRuntimeSyncTask(workspace.company.slug, binding.platform, binding, actor)
        );
        created += 1;
      }

      return {
        ...action,
        status: created > 0 ? ("executed" as const) : ("blocked" as const),
        outcome:
          created > 0
            ? `${created} tarefas de analytics foram adicionadas a runtime social.`
            : "As plataformas analiticas ja estavam enfileiradas ou sem alvo pronto."
      };
    }

    if (action.kind === "generate_weekly_report") {
      const latestWeekly = workspace.reports.find((report) => report.type === "weekly_marketing");
      const latestWeeklyAgeMs = latestWeekly ? Date.now() - new Date(latestWeekly.generatedAt).getTime() : Number.POSITIVE_INFINITY;

      if (latestWeeklyAgeMs < 12 * 60 * 60 * 1000) {
        return {
          ...action,
          status: "blocked" as const,
          outcome: "Ja existe um relatorio semanal recente; pulei a duplicacao neste ciclo."
        };
      }

      const report = generateCompanyReport(workspace, "weekly_marketing", professionalProfile);
      saveGeneratedCompanyReport(report);

      return {
        ...action,
        status: "executed" as const,
        outcome: `Relatorio semanal gerado: ${report.title}.`
      };
    }

    if (action.kind === "review_approvals") {
      return {
        ...action,
        status: "blocked" as const,
        outcome: "Essa acao exige decisao humana na central de aprovacoes."
      };
    }

    if (action.kind === "resolve_runtime_blockers") {
      return {
        ...action,
        status: "blocked" as const,
        outcome: "Essa acao exige revisao operacional na runtime social antes do proximo replay."
      };
    }

    if (action.kind === "resolve_conversion_dispatch") {
      return {
        ...action,
        status: "blocked" as const,
        outcome: "Essa acao exige revisao operacional na trilha de conversao e atribuicao antes do proximo replay."
      };
    }

    if (action.kind === "scale_winning_channel") {
      return {
        ...action,
        status: "blocked" as const,
        outcome: "Escala automatica ainda pede confirmacao de budget, criativo e spend cap antes da mutacao."
      };
    }

    if (action.kind === "hold_learning_channel") {
      return {
        ...action,
        status: "blocked" as const,
        outcome: "O canal ainda esta em aprendizado; por enquanto o Agent Lion apenas recomenda manter observacao e coleta de sinal."
      };
    }

    if (action.kind === "fix_underperforming_channel") {
      return {
        ...action,
        status: "blocked" as const,
        outcome: "O canal precisa de revisao de tracking, criativo ou oferta antes de nova mutacao automatica."
      };
    }

    if (action.kind === "pause_wasteful_channel") {
      return {
        ...action,
        status: "blocked" as const,
        outcome: "A pausa automatica foi segurada ate haver confirmacao do operador sobre budget, contratos e janela da campanha."
      };
    }

    if (action.kind === "launch_ab_test") {
      const experiment = plan.recommendedExperiments?.find(
        (entry) => entry.id === action.sourceExperimentId
      );

      if (!experiment) {
        return {
          ...action,
          status: "blocked" as const,
          outcome: "O experimento sugerido nao foi encontrado no plano atual."
        };
      }

      const createdAssets = buildCreativeAssetsForExperiment({
        company: workspace.company,
        experiment,
        createdWith: "openai-api",
        requestedBy: actor
      });

      for (const asset of createdAssets) {
        upsertStoredCompanyCreativeAsset(asset);
      }

      recordCompanyAuditEvent({
        companySlug: workspace.company.slug,
        connector: "system",
        kind: "decision",
        title: "Experimento A/B materializado no Studio",
        details: `${createdAssets.length} drafts criativos foram abertos para ${experiment.title}.`,
        priority: "medium"
      });

      return {
        ...action,
        status: "executed" as const,
        outcome: `${createdAssets.length} variacoes do experimento foram abertas no Studio como drafts auditaveis.`
      };
    }

    return {
      ...action,
      status: "blocked" as const,
      outcome: "Essa acao ainda depende de onboarding manual ou reconexao operacional."
    };
  });

  return {
    ...plan,
    recommendedActions: nextActions
  };
}

export function buildOperationalInbox(
  workspace: Pick<CompanyWorkspace, "company" | "executionPlans">
): OperationalInboxItem[] {
  const latestPlan = workspace.executionPlans[0];

  if (!latestPlan) {
    return [];
  }

  return (latestPlan.recommendedActions ?? [])
    .filter(
      (action) =>
        action.status === "recommended" || (action.status === "blocked" && action.mode !== "auto_low_risk")
    )
    .map((action) => ({
      id: `inbox-${latestPlan.id}-${action.id}`,
      companySlug: workspace.company.slug,
      sourcePlanId: latestPlan.id,
      sourceActionId: action.id,
      sourceActionKind: action.kind,
      alertType: action.alertType,
      title: action.title,
      summary: action.status === "blocked" ? action.outcome ?? action.detail : action.detail,
      priority: action.priority,
      mode: action.mode,
      state: getOperationalInboxState(action),
      openedAt: latestPlan.generatedAt,
      evidence: action.evidence,
      sourcePath: getOperationalInboxSourcePath(workspace.company.slug, action.kind),
      sourceLabel: getOperationalInboxSourceLabel(action.kind),
      outcome: action.outcome
    }))
    .sort(
      (a, b) =>
        getPriorityScore(b.priority) - getPriorityScore(a.priority) || b.openedAt.localeCompare(a.openedAt)
    );
}

export function syncOperationalAlerts(input: {
  companySlug: string;
  plan: CompanyExecutionPlan;
  emailReady: boolean;
  schedulerMinimumPriority?: ExecutionTrackPriority;
  emailMinimumPriority?: ExecutionTrackPriority;
}) {
  const inbox = buildOperationalInbox({
    company: {
      slug: input.companySlug
    } as CompanyWorkspace["company"],
    executionPlans: [input.plan]
  });
  const existingAlerts = getStoredCompanyOperationalAlerts(input.companySlug);
  const existingById = new Map(existingAlerts.map((alert) => [alert.id, alert]));
  const now = new Date().toISOString();
  const nextAlerts: CompanyOperationalAlert[] = [];
  const activeAlertIds = new Set<string>();
  const schedulerMinimumPriority = input.schedulerMinimumPriority ?? "critical";
  const emailMinimumPriority = getStricterPriority(
    input.emailMinimumPriority ?? "critical",
    schedulerMinimumPriority
  );

  for (const item of inbox.filter((entry) => isPriorityAtLeast(entry.priority, schedulerMinimumPriority))) {
    const alertId = `alert-${item.sourceActionId}`;
    const previous = existingById.get(alertId);
    const channels: CompanyOperationalAlert["channels"] = [
      "scheduler",
      ...(input.emailReady && isPriorityAtLeast(item.priority, emailMinimumPriority) ? (["email_ready"] as const) : [])
    ];

    activeAlertIds.add(alertId);
    nextAlerts.push({
      id: alertId,
      companySlug: input.companySlug,
      sourcePlanId: input.plan.id,
      sourceActionId: item.sourceActionId,
      sourceActionKind: item.sourceActionKind,
      alertType: item.alertType,
      title: `Alerta ${getExecutionTrackPriorityLabel(item.priority)}: ${item.title}`,
      message: item.summary,
      priority: item.priority,
      status:
        previous && previous.status !== "resolved"
          ? previous.status
          : "open",
      channels: [...channels],
      createdAt:
        previous && previous.status !== "resolved"
          ? previous.createdAt
          : now,
      updatedAt: now,
      acknowledgedAt:
        previous && previous.status !== "resolved"
          ? previous.acknowledgedAt
          : undefined,
      emailRecipient:
        previous && previous.status !== "resolved"
          ? previous.emailRecipient
          : undefined,
      emailRecipients:
        previous && previous.status !== "resolved"
          ? previous.emailRecipients
          : undefined,
      emailDeliveredTo:
        previous && previous.status !== "resolved"
          ? previous.emailDeliveredTo
          : undefined,
      emailAttemptedAt:
        previous && previous.status !== "resolved"
          ? previous.emailAttemptedAt
          : undefined,
      emailSentAt:
        previous && previous.status !== "resolved"
          ? previous.emailSentAt
          : undefined,
      emailLastError:
        previous && previous.status !== "resolved"
          ? previous.emailLastError
          : undefined,
      sourcePath: item.sourcePath,
      sourceLabel: item.sourceLabel,
      evidence: item.evidence
    });
  }

  const resolvedAlerts = existingAlerts
    .filter((alert) => !activeAlertIds.has(alert.id))
    .map((alert) =>
      alert.status === "resolved"
        ? alert
        : {
            ...alert,
            status: "resolved" as const,
            updatedAt: now,
            resolvedAt: now
          }
    );

  const syncedAlerts = [...nextAlerts, ...resolvedAlerts]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 120);

  replaceStoredCompanyOperationalAlerts(input.companySlug, syncedAlerts);

  return syncedAlerts;
}

function buildTrack(track: CompanyExecutionTrack) {
  return track;
}

function buildApprovalQueue(
  workspace: CompanyWorkspace,
  analysis: ExecutionAnalysis,
  professionalProfile?: UserProfessionalProfile | null
) {
  return [
    {
      title: "Mudancas de budget e lances",
      reason: `Impactam diretamente ${workspace.strategyPlan.cpaTarget.toLowerCase()} e o ritmo de gasto.`,
      mode: "operator_approval" as const
    },
    {
      title: "Novos criativos e claims",
      reason:
        analysis.pendingPublishingApprovals > 0
          ? `${analysis.pendingPublishingApprovals} itens ja aguardam validacao de mensagem ou reputacao.`
          : "Precisam checar politica, coerencia de oferta e risco reputacional.",
      mode: "policy_review" as const
    },
    {
      title: "Rotinas de conteudo e SEO de baixo risco",
      reason: professionalProfile?.approvalPreferences[0] ?? "Podem rodar com autonomia assistida e revisao posterior.",
      mode: "auto_low_risk" as const
    }
  ];
}

function enrichTracksWithProfessionalProfile(
  tracks: CompanyExecutionTrack[],
  professionalProfile?: UserProfessionalProfile | null,
  latestReportSummary?: string
) {
  return tracks.map((track) => ({
    ...track,
    rationale: [
      track.rationale,
      latestReportSummary ? `Base recente: ${latestReportSummary}` : null,
      professionalProfile?.growthLevers[0]
        ? `Alavanca do operador: ${professionalProfile.growthLevers[0]}.`
        : null
    ]
      .filter(Boolean)
      .join(" ")
  }));
}

export function getApprovalModeLabel(mode: ExecutionApprovalMode) {
  switch (mode) {
    case "auto_low_risk":
      return "auto low risk";
    case "policy_review":
      return "policy review";
    default:
      return "operator approval";
  }
}

function isPlatformTrack(track: CompanyExecutionTrack["track"]): track is PlatformId {
  return [
    "ga4",
    "google-sheets",
    "search-console",
    "google-ads",
    "meta",
    "business-profile",
    "gmail",
    "youtube"
  ].includes(track);
}

function buildExecutionAnalysis(workspace: CompanyWorkspace): ExecutionAnalysis {
  const topChannels = workspace.strategyPlan.priorityChannels.slice(0, 3);

  return {
    pendingApprovals: workspace.approvalsCenter.filter((item) => item.actions.length > 0).length,
    pendingPaymentApprovals: workspace.paymentRequests.filter((request) => request.status === "pending").length,
    pendingPublishingApprovals: workspace.publishingRequests.filter((request) => request.status === "pending").length,
    queuedRuntimeTasks: workspace.socialRuntimeTasks.filter((task) => task.status === "queued").length,
    blockedRuntimeTasks: workspace.socialRuntimeTasks.filter((task) => task.status === "blocked").length,
    failedRuntimeTasks: workspace.socialRuntimeTasks.filter((task) => task.status === "failed").length,
    overdueScheduledPosts: workspace.scheduledPosts.filter(
      (post) => post.status === "scheduled" && new Date(post.scheduledFor).getTime() <= Date.now()
    ).length,
    scheduledPostsReady: workspace.scheduledPosts.filter((post) => post.status === "scheduled").length,
    approvedPublishingBacklog: workspace.publishingRequests.filter((request) => request.status === "approved").length,
    connectedPriorityChannels: topChannels.filter(
      (channel) => workspace.connections.some((connection) => connection.platform === channel && connection.status === "connected")
    ).length,
    priorityChannelGaps: workspace.connections.filter(
      (connection) => topChannels.includes(connection.platform) && connection.status !== "connected"
    ),
    reportsCount: workspace.reports.length,
    realSocialInsights: workspace.socialInsights.filter((insight) => insight.reach !== "n/d").length,
    analyticsReadyPlatforms: workspace.socialBindings.filter((binding) => binding.analyticsReady).length,
    freshLearnings: workspace.agentLearnings.filter((learning) => learning.status === "fresh").length,
    activeLearnings: workspace.agentLearnings.filter((learning) => learning.status !== "historical").length,
    playbookLearnings: workspace.agentLearnings.filter((learning) => learning.kind === "playbook").length,
    riskLearnings: workspace.agentLearnings.filter(
      (learning) => learning.kind === "risk" || learning.kind === "warning"
    ).length,
    conversionEventsSent: workspace.conversionEvents.filter((event) => event.status === "sent").length,
    conversionEventsBlocked: workspace.conversionEvents.filter((event) => event.status === "blocked").length,
    conversionEventsFailed: workspace.conversionEvents.filter((event) => event.status === "failed").length,
    wonLeads: workspace.leads.filter((lead) => lead.stage === "won").length,
    wonRevenue: workspace.leads.reduce((total, lead) => total + (lead.revenueActual ?? 0), 0)
  };
}

function buildOperationsTrack(workspace: CompanyWorkspace, analysis: ExecutionAnalysis): CompanyExecutionTrack {
  const topRiskLearning = workspace.agentLearnings.find(
    (learning) => learning.kind === "risk" || learning.kind === "warning"
  );
  const actions = [
    analysis.pendingApprovals > 0
      ? `Resolver ${analysis.pendingApprovals} itens acionaveis no Approval Center para destravar conteudo, spend e publicacoes.`
      : "Manter a caixa de aprovacao limpa para nao criar gargalo oculto.",
    analysis.priorityChannelGaps.length > 0
      ? `Reconectar ou concluir onboarding em ${analysis.priorityChannelGaps.length} canais prioritarios antes da proxima rodada automatica.`
      : "Confirmar que os canais prioritarios seguem conectados e auditaveis.",
    analysis.queuedRuntimeTasks + analysis.blockedRuntimeTasks + analysis.failedRuntimeTasks > 0
      ? `Drenar ou corrigir a runtime social: queued ${analysis.queuedRuntimeTasks}, bloqueadas ${analysis.blockedRuntimeTasks}, falhas ${analysis.failedRuntimeTasks}.`
      : "Runtime social sem pressao critica neste momento.",
    topRiskLearning ? `Aplicar o aprendizado vivo: ${topRiskLearning.summary}` : "Nenhum risco aprendido exige replay adicional neste ciclo."
  ];

  return buildTrack({
    id: `${workspace.company.slug}-operations`,
    track: "operations",
    title: "Pulso operacional e desbloqueios",
    objective: "Remover gargalos que impedem o Agent Lion de operar com autonomia crescente.",
    rationale:
      "A camada operacional ganhou prioridade propria para que approvals, conexoes e fila social sejam tratados como primeiro-class citizens, e nao como efeitos colaterais.",
    approvalMode: "operator_approval",
    cadence: "triagem diaria com replay imediato depois de cada bloqueio",
    budgetImpact: "baixo",
    successMetric: "Fila limpa, aprovacoes sem atraso e canais prioritarios prontos.",
    actions,
    priority:
      analysis.priorityChannelGaps.length > 0 || analysis.blockedRuntimeTasks > 0 || analysis.failedRuntimeTasks > 0
        ? "critical"
        : analysis.pendingApprovals > 0 || analysis.queuedRuntimeTasks > 0 || analysis.overdueScheduledPosts > 0
          ? "high"
          : "medium",
    confidence: 0.95,
    trigger: `Aprovacoes ${analysis.pendingApprovals} · runtime ${analysis.queuedRuntimeTasks}/${analysis.blockedRuntimeTasks}/${analysis.failedRuntimeTasks}.`,
    evidence: [
      `${analysis.priorityChannelGaps.length} gaps de conexao nos canais prioritarios.`,
      `${analysis.overdueScheduledPosts} posts programados ja passaram do horario.`,
      `${analysis.pendingPaymentApprovals} aprovacoes financeiras e ${analysis.pendingPublishingApprovals} editoriais ainda estao pendentes.`
    ]
  });
}

function buildAutopilotSummary(
  workspace: CompanyWorkspace,
  analysis: ExecutionAnalysis,
  scorecards: NonNullable<CompanyExecutionPlan["optimizationScorecards"]>
) {
  const winningChannels = scorecards.filter((card) => card.health === "winning").length;
  const atRiskChannels = scorecards.filter((card) => card.health === "at_risk").length;
  const wastefulChannels = scorecards.filter((card) => card.health === "wasteful").length;

  if (winningChannels > 0 && atRiskChannels === 0 && wastefulChannels === 0) {
    return `Autonomia orientada por resultado: o Agent Lion ja enxerga ${winningChannels} canal(is) vencedores e pode preparar escala assistida com mais confianca.`;
  }

  if (analysis.riskLearnings > 0) {
    return `Autonomia com memoria ativa: o Agent Lion ja acumula ${analysis.activeLearnings} aprendizados reutilizaveis, mas ainda precisa conter ${analysis.riskLearnings} riscos vivos antes de ampliar autonomia.`;
  }

  if (
    analysis.pendingApprovals === 0 &&
    analysis.priorityChannelGaps.length === 0 &&
    analysis.queuedRuntimeTasks === 0 &&
    analysis.blockedRuntimeTasks === 0 &&
    analysis.failedRuntimeTasks === 0 &&
    analysis.conversionEventsBlocked === 0 &&
    analysis.conversionEventsFailed === 0 &&
    analysis.overdueScheduledPosts === 0
  ) {
    return `Autonomia crescente: ${workspace.company.name} esta perto de operar em modo semi-autonomo sem gargalos visiveis.`;
  }

  if (
    analysis.priorityChannelGaps.length > 0 ||
    analysis.blockedRuntimeTasks > 0 ||
    analysis.failedRuntimeTasks > 0 ||
    analysis.conversionEventsBlocked > 0 ||
    analysis.conversionEventsFailed > 0 ||
    atRiskChannels > 0 ||
    wastefulChannels > 0
  ) {
    return "Autonomia parcial: o Agent Lion ja executa partes da operacao, mas ainda depende de desbloqueios em conexoes, runtime ou atribuicao de conversao.";
  }

  return "Autonomia assistida: a operacao esta funcional, mas approvals e fila ainda precisam de acompanhamento proximo.";
}

function buildDecisionSignals(
  analysis: ExecutionAnalysis,
  scorecards: NonNullable<CompanyExecutionPlan["optimizationScorecards"]>
): NonNullable<CompanyExecutionPlan["decisionSignals"]> {
  const winningChannels = scorecards.filter((card) => card.health === "winning").length;
  const atRiskChannels = scorecards.filter((card) => card.health === "at_risk").length;
  const wastefulChannels = scorecards.filter((card) => card.health === "wasteful").length;

  return [
    {
      label: "Aprovacoes",
      value: String(analysis.pendingApprovals),
      context: `${analysis.pendingPaymentApprovals} de pagamento e ${analysis.pendingPublishingApprovals} de publicacao seguem pendentes.`
    },
    {
      label: "Runtime social",
      value: `${analysis.queuedRuntimeTasks}/${analysis.blockedRuntimeTasks}/${analysis.failedRuntimeTasks}`,
      context: "Formato queued/bloqueada/falha para medir pressao operacional da fila."
    },
    {
      label: "Canais prioritarios",
      value: `${analysis.connectedPriorityChannels}/${analysis.connectedPriorityChannels + analysis.priorityChannelGaps.length || 1}`,
      context: "Quantos canais principais ja estao realmente prontos para operar."
    },
    {
      label: "Social analytics",
      value: `${analysis.realSocialInsights}/${analysis.analyticsReadyPlatforms || 1}`,
      context: "Snapshots reais disponiveis versus plataformas com analytics pronto."
    },
    {
      label: "Relatorios",
      value: String(analysis.reportsCount),
      context: "Volume de memoria executiva salva para esta empresa."
    },
    {
      label: "Memoria do agente",
      value: `${analysis.freshLearnings}/${analysis.activeLearnings}`,
      context: `${analysis.playbookLearnings} playbooks e ${analysis.riskLearnings} alertas/riscos continuam ativos na memoria operacional.`
    },
    {
      label: "Conversoes",
      value: `${analysis.conversionEventsSent}/${analysis.conversionEventsBlocked}/${analysis.conversionEventsFailed}`,
      context:
        analysis.wonRevenue > 0
          ? `${analysis.wonLeads} leads ganhos e ${formatCurrency(analysis.wonRevenue)} em receita real ja retroalimentam o workspace.`
          : "Formato sent/bloqueado/falha para medir saude do dispatch de atribuicao."
    },
    {
      label: "Otimizacao",
      value: `${winningChannels}/${atRiskChannels}/${wastefulChannels}`,
      context: "Formato vencedor/em risco/desperdicio para orientar scale, fix ou pause por canal."
    }
  ];
}

function buildRecommendedActions(
  workspace: CompanyWorkspace,
  analysis: ExecutionAnalysis,
  scorecards: NonNullable<CompanyExecutionPlan["optimizationScorecards"]>,
  experiments: NonNullable<CompanyExecutionPlan["recommendedExperiments"]>
): CompanyExecutionAction[] {
  const actions: CompanyExecutionAction[] = [];

  if (analysis.pendingApprovals > 0) {
    actions.push({
      id: `${workspace.company.slug}-action-approvals`,
      kind: "review_approvals",
      title: "Resolver aprovacoes pendentes",
      detail: "Levar os itens acionaveis para decisao humana antes de ampliar automacao ou spend.",
      mode: "operator_approval",
      priority: analysis.pendingPaymentApprovals > 0 ? "critical" : "high",
      status: "recommended",
      alertType: analysis.pendingPaymentApprovals > 0 ? "finance" : "approvals",
      evidence: [
        `${analysis.pendingApprovals} itens ainda estao bloqueando a operacao.`,
        `${analysis.pendingPaymentApprovals} aprovacoes financeiras exigem cuidado extra.`
      ]
    });
  }

  if (analysis.priorityChannelGaps.length > 0) {
    actions.push({
      id: `${workspace.company.slug}-action-gaps`,
      kind: "resolve_channel_gap",
      title: "Fechar gaps dos canais prioritarios",
      detail: "Concluir onboarding ou reconexao dos canais mais importantes para o plano da semana.",
      mode: "operator_approval",
      priority: "critical",
      status: "recommended",
      alertType: "connections",
      evidence: analysis.priorityChannelGaps.slice(0, 3).map(
        (connection) => `${connection.label} esta com status ${connection.status}.`
      )
    });
  }

  if (analysis.blockedRuntimeTasks > 0 || analysis.failedRuntimeTasks > 0) {
    actions.push({
      id: `${workspace.company.slug}-action-runtime-blockers`,
      kind: "resolve_runtime_blockers",
      title: "Destravar runtime social",
      detail: "Abrir a runtime social, entender bloqueios ou falhas e limpar a fila antes do proximo replay.",
      mode: "operator_approval",
      priority: analysis.failedRuntimeTasks > 0 ? "critical" : "high",
      status: "recommended",
      alertType: "runtime",
      evidence: [
        `${analysis.blockedRuntimeTasks} tarefas estao bloqueadas na runtime.`,
        `${analysis.failedRuntimeTasks} tarefas falharam e pedem replay assistido.`
      ]
    });
  }

  if (analysis.conversionEventsBlocked > 0 || analysis.conversionEventsFailed > 0) {
    actions.push({
      id: `${workspace.company.slug}-action-conversion-dispatch`,
      kind: "resolve_conversion_dispatch",
      title: "Destravar dispatch de conversao",
      detail: "Revisar mapping, credenciais e identificadores para devolver sinal confiavel ao GA4, Meta CAPI e Google Ads.",
      mode: "operator_approval",
      priority: analysis.conversionEventsFailed > 0 ? "critical" : "high",
      status: "recommended",
      alertType: "strategy",
      evidence: [
        `${analysis.conversionEventsBlocked} eventos bloqueados na runtime de conversao.`,
        `${analysis.conversionEventsFailed} eventos falharam no dispatch de atribuicao.`
      ]
    });
  }

  if (analysis.overdueScheduledPosts > 0 || analysis.scheduledPostsReady > 0) {
    actions.push({
      id: `${workspace.company.slug}-action-queue-posts`,
      kind: "queue_due_social_posts",
      title: "Enviar posts prontos para a runtime",
      detail: "Materializar os posts aprovados e vencidos na fila auditavel antes da janela de publicacao passar.",
      mode: "auto_low_risk",
      priority: analysis.overdueScheduledPosts > 0 ? "high" : "medium",
      status: "recommended",
      alertType: "general",
      evidence: [
        `${analysis.overdueScheduledPosts} posts ja estao vencidos.`,
        `${analysis.scheduledPostsReady} posts seguem agendados e prontos para fila.`
      ]
    });
  }

  if (analysis.analyticsReadyPlatforms > 0) {
    actions.push({
      id: `${workspace.company.slug}-action-sync`,
      kind: "queue_social_sync",
      title: "Enfileirar sync de analytics sociais",
      detail: "Adicionar tarefas de sync real para as plataformas com alvo analitico pronto.",
      mode: "auto_low_risk",
      priority: analysis.realSocialInsights < analysis.analyticsReadyPlatforms ? "high" : "medium",
      status: "recommended",
      alertType: "general",
      evidence: [
        `${analysis.analyticsReadyPlatforms} plataformas ja aceitam sync real.`,
        `${analysis.realSocialInsights} snapshots com dados reais ja foram salvos.`
      ]
    });
  }

  if (analysis.reportsCount === 0) {
    actions.push({
      id: `${workspace.company.slug}-action-report`,
      kind: "generate_weekly_report",
      title: "Gerar memoria executiva da semana",
      detail: "Salvar um relatorio semanal para transformar leitura operacional em contexto reutilizavel.",
      mode: "auto_low_risk",
      priority: "medium",
      status: "recommended",
      alertType: "strategy",
      evidence: ["Nenhum relatorio salvo ainda para esta empresa."]
    });
  }

  for (const scorecard of scorecards.slice(0, 4)) {
    const priority = scorecard.health === "wasteful" || scorecard.health === "at_risk"
      ? "high"
      : scorecard.health === "winning"
        ? "medium"
        : "low";

    if (scorecard.decision === "scale") {
      actions.push({
        id: `${workspace.company.slug}-action-scale-${scorecard.channel}`,
        kind: "scale_winning_channel",
        title: `Escalar ${getOptimizationChannelLabel(scorecard.channel)}`,
        detail: "O canal mostra sinal forte o suficiente para discutir ampliacao de budget ou de distribuicao.",
        mode: "operator_approval",
        priority,
        status: "recommended",
        alertType: "strategy",
        targetPlatform: scorecard.platform,
        evidence: scorecard.evidence
      });
      continue;
    }

    if (scorecard.decision === "fix") {
      actions.push({
        id: `${workspace.company.slug}-action-fix-${scorecard.channel}`,
        kind: "fix_underperforming_channel",
        title: `Corrigir ${getOptimizationChannelLabel(scorecard.channel)}`,
        detail: "O canal ainda vale atencao, mas tracking, criativo ou oferta precisam de ajuste antes da proxima mutacao.",
        mode: "operator_approval",
        priority,
        status: "recommended",
        alertType: "strategy",
        targetPlatform: scorecard.platform,
        evidence: scorecard.evidence
      });
      continue;
    }

    if (scorecard.decision === "pause") {
      actions.push({
        id: `${workspace.company.slug}-action-pause-${scorecard.channel}`,
        kind: "pause_wasteful_channel",
        title: `Segurar ${getOptimizationChannelLabel(scorecard.channel)}`,
        detail: "O canal esta consumindo energia ou budget sem retorno suficiente para a fase atual.",
        mode: "operator_approval",
        priority,
        status: "recommended",
        alertType: "finance",
        targetPlatform: scorecard.platform,
        evidence: scorecard.evidence
      });
      continue;
    }

    actions.push({
      id: `${workspace.company.slug}-action-hold-${scorecard.channel}`,
      kind: "hold_learning_channel",
      title: `Manter ${getOptimizationChannelLabel(scorecard.channel)} em aprendizado`,
      detail: "Ainda falta amostra para escalar ou cortar; o melhor movimento agora e observar e coletar mais sinal.",
      mode: "auto_low_risk",
      priority,
      status: "recommended",
      alertType: "general",
      targetPlatform: scorecard.platform,
      evidence: scorecard.evidence
    });
  }

  for (const experiment of experiments.slice(0, 3)) {
    actions.push({
      id: `${workspace.company.slug}-action-experiment-${experiment.id}`,
      kind: "launch_ab_test",
      title: `Abrir experimento: ${experiment.title}`,
      detail: experiment.nextAction,
      mode: "auto_low_risk",
      priority: "medium",
      status: "recommended",
      alertType: "strategy",
      sourceExperimentId: experiment.id,
      evidence: [experiment.hypothesis, `Variantes: ${experiment.variants.join(" vs ")}`]
    });
  }

  return dedupeExecutionActions(actions);
}

export function buildOptimizationScorecards(
  workspace: CompanyWorkspace
): NonNullable<CompanyExecutionPlan["optimizationScorecards"]> {
  const priorityPlatforms = Array.from(
    new Set(
      workspace.strategyPlan.priorityChannels
        .map((platform) => getLatestSnapshot(workspace, platform))
        .filter((snapshot): snapshot is NonNullable<typeof snapshot> => Boolean(snapshot))
        .map((snapshot) => snapshot.platform)
    )
  );
  const fallbackPlatforms = Array.from(
    new Set(
      workspace.snapshots
        .filter((snapshot) =>
          snapshot.platform === "google-ads" ||
          snapshot.platform === "meta" ||
          snapshot.platform === "ga4"
        )
        .map((snapshot) => snapshot.platform)
    )
  );
  const targetPlatforms = Array.from(new Set([...priorityPlatforms, ...fallbackPlatforms])).slice(0, 5);
  const cpaTarget = parseCurrencyTarget(workspace.strategyPlan.cpaTarget);

  return targetPlatforms
    .map((platform) => {
      const snapshot = getLatestSnapshot(workspace, platform);
      if (!snapshot) {
        return null;
      }

      const destination = getConversionDestinationForPlatform(platform);
      const relatedEvents = destination
        ? workspace.conversionEvents.filter((event) => event.destination === destination)
        : [];
      const conversionSignalsSent = relatedEvents.filter((event) => event.status === "sent").length;
      const conversionSignalsBlocked = relatedEvents.filter((event) => event.status === "blocked").length;
      const conversionSignalsFailed = relatedEvents.filter((event) => event.status === "failed").length;
      const spend = snapshot.spend ?? 0;
      const conversions = snapshot.conversions ?? 0;
      const cpa = snapshot.cpa ?? (spend > 0 && conversions > 0 ? spend / conversions : undefined);
        const health = determineOptimizationHealth({
          spend,
          conversions,
          cpa,
        ctr: snapshot.ctr,
        conversionSignalsBlocked,
          conversionSignalsFailed,
          cpaTarget
        });
        const baseDecision = mapHealthToOptimizationDecision(health);
        const memoryBias = getOptimizationMemoryBias(workspace, platform);
        const decision = applyOptimizationMemoryDecisionBias(baseDecision, health, memoryBias);
        const score = applyOptimizationMemoryScoreBias(
          scoreOptimizationHealth(health, conversionSignalsSent, conversionSignalsBlocked, conversionSignalsFailed),
          memoryBias
        );
        const memoryEvidence = buildOptimizationMemoryEvidence(memoryBias);

        return {
          id: `scorecard-${workspace.company.slug}-${platform}`,
          channel: platform,
          platform,
          window: snapshot.window === "24h" ? "7d" : snapshot.window,
          health,
          decision,
          score,
          spend: snapshot.spend,
          conversions: snapshot.conversions,
          revenue: snapshot.revenue,
          cpa,
          ctr: snapshot.ctr,
          conversionSignalsSent,
          conversionSignalsBlocked,
          conversionSignalsFailed,
          rationale: buildOptimizationRationale(
            platform,
            health,
            cpa,
            cpaTarget,
            conversionSignalsBlocked,
            conversionSignalsFailed,
            memoryBias
          ),
          evidence: [
            getSnapshotEvidence(workspace, platform),
            `Dispatch ${conversionSignalsSent}/${conversionSignalsBlocked}/${conversionSignalsFailed} em sent/bloqueado/falha.`,
            ...(memoryEvidence ? [memoryEvidence] : [])
          ]
        };
      })
    .filter((scorecard): scorecard is NonNullable<typeof scorecard> => Boolean(scorecard))
    .sort((left, right) => right.score - left.score);
}

export function buildOptimizationExperiments(
  workspace: CompanyWorkspace,
  scorecards: NonNullable<CompanyExecutionPlan["optimizationScorecards"]>
): NonNullable<CompanyExecutionPlan["recommendedExperiments"]> {
  return scorecards
    .filter((scorecard) => scorecard.decision === "hold" || scorecard.decision === "fix")
    .slice(0, 3)
    .map((scorecard, index) => {
      const previousOutcome = workspace.experimentOutcomes.find(
        (outcome) => outcome.channel === scorecard.channel
      );
      const angleA = workspace.keywordStrategy.conversionAngles[index] ?? workspace.keywordStrategy.conversionAngles[0] ?? "prova social";
      const angleB = workspace.keywordStrategy.conversionAngles[index + 1] ?? workspace.keywordStrategy.landingMessages[0] ?? "clareza de oferta";

      return {
        id: `experiment-${workspace.company.slug}-${scorecard.channel}`,
        title: `Teste A/B em ${getOptimizationChannelLabel(scorecard.channel)}`,
        channel: scorecard.channel,
        hypothesis: `Se ${angleA.toLowerCase()} superar ${angleB.toLowerCase()}, ${getOptimizationChannelLabel(scorecard.channel)} deve ganhar eficiencia comercial.`,
        primaryMetric: workspace.strategyPlan.cpaTarget,
        variants: [angleA, angleB],
        status:
          previousOutcome?.status === "won"
            ? "won"
            : previousOutcome?.status === "lost"
              ? "lost"
              : "planned",
        sourceScorecardId: scorecard.id,
        baselineMetricValue: scorecard.cpa ?? scorecard.ctr ?? scorecard.score,
        successCriteria: `Ganhar eficiencia suficiente para mover ${getOptimizationChannelLabel(scorecard.channel)} de ${scorecard.decision} para scale sem elevar risco operacional.`,
        observationWindowDays: scorecard.window === "28d" ? 28 : 7,
        confidence: Number((Math.min(0.92, Math.max(0.42, scorecard.score / 100))).toFixed(2)),
        winningVariant: previousOutcome?.winningVariant,
        lastEvaluatedAt: previousOutcome?.updatedAt,
        nextAction: `Gerar duas variacoes de criativo/copy para ${getOptimizationChannelLabel(scorecard.channel)} e medir impacto em CTR, CPA e conversao.`
      };
    });
}

function getConnectionStatus(workspace: CompanyWorkspace, platform: PlatformId) {
  return workspace.connections.find((connection) => connection.platform === platform)?.status ?? "not_connected";
}

function getLatestSnapshot(workspace: CompanyWorkspace, platform: PlatformId) {
  return workspace.snapshots.find((snapshot) => snapshot.platform === platform);
}

function hasUnderperformingSnapshot(workspace: CompanyWorkspace, platform: PlatformId) {
  const snapshot = getLatestSnapshot(workspace, platform);
  if (!snapshot) {
    return false;
  }

  return (snapshot.spend ?? 0) > 0 && (((snapshot.conversions ?? 0) < 3) || ((snapshot.ctr ?? 0) > 0 && (snapshot.ctr ?? 0) < 0.015));
}

function countRuntimeTasksForPlatforms(workspace: CompanyWorkspace, platforms: string[]) {
  return workspace.socialRuntimeTasks.filter(
    (task) => platforms.includes(task.platform) && task.status !== "completed"
  ).length;
}

function getSnapshotEvidence(workspace: CompanyWorkspace, platform: PlatformId) {
  const snapshot = getLatestSnapshot(workspace, platform);
  if (!snapshot) {
    return "Sem snapshot recente salvo para este canal.";
  }

  const parts = [
    snapshot.spend ? `Spend ${formatCurrency(snapshot.spend)}` : null,
    snapshot.clicks ? `${formatInteger(snapshot.clicks)} clicks` : null,
    snapshot.conversions ? `${formatInteger(snapshot.conversions)} conversoes` : null,
    snapshot.ctr ? `CTR ${formatPercent(snapshot.ctr)}` : null,
    snapshot.cpa ? `CPA ${formatCurrency(snapshot.cpa)}` : null
  ].filter(Boolean);

  return parts.join(" · ") || "Snapshot sem dados suficientes.";
}

function getConversionDestinationForPlatform(platform: PlatformId) {
  switch (platform) {
    case "google-ads":
      return "google_ads" as const;
    case "meta":
      return "meta_capi" as const;
    case "ga4":
      return "ga4" as const;
    default:
      return undefined;
  }
}

function determineOptimizationHealth(input: {
  spend: number;
  conversions: number;
  cpa?: number;
  ctr?: number;
  conversionSignalsBlocked: number;
  conversionSignalsFailed: number;
  cpaTarget?: number;
}) {
  if (input.conversionSignalsBlocked > 0 || input.conversionSignalsFailed > 0) {
    return "at_risk" as const;
  }

  if (
    input.spend > 0 &&
    input.conversions >= 5 &&
    (!input.cpaTarget || (input.cpa ?? 0) <= input.cpaTarget * 1.05)
  ) {
    return "winning" as const;
  }

  if (
    input.spend > 0 &&
    ((input.conversions <= 1 && input.cpaTarget && (input.cpa ?? Number.POSITIVE_INFINITY) > input.cpaTarget * 1.2) ||
      ((input.ctr ?? 0) > 0 && (input.ctr ?? 0) < 0.01))
  ) {
    return "wasteful" as const;
  }

  return "learning" as const;
}

function mapHealthToOptimizationDecision(health: NonNullable<CompanyExecutionPlan["optimizationScorecards"]>[number]["health"]) {
  switch (health) {
    case "winning":
      return "scale" as const;
    case "wasteful":
      return "pause" as const;
    case "at_risk":
      return "fix" as const;
    default:
      return "hold" as const;
  }
}

function scoreOptimizationHealth(
  health: NonNullable<CompanyExecutionPlan["optimizationScorecards"]>[number]["health"],
  sent: number,
  blocked: number,
  failed: number
) {
  const base =
    health === "winning" ? 88 :
    health === "learning" ? 62 :
    health === "at_risk" ? 38 : 24;

  return Math.max(0, Math.min(100, base + sent * 2 - blocked * 6 - failed * 8));
}

function buildOptimizationRationale(
  platform: PlatformId,
  health: NonNullable<CompanyExecutionPlan["optimizationScorecards"]>[number]["health"],
  cpa: number | undefined,
  cpaTarget: number | undefined,
  blocked: number,
  failed: number,
  memoryBias: {
    winnerSignals: number;
    loserSignals: number;
  }
) {
  const memoryFragment =
    memoryBias.winnerSignals > 0 || memoryBias.loserSignals > 0
      ? ` Memoria recente do agente: ${memoryBias.winnerSignals} sinais vencedores e ${memoryBias.loserSignals} sinais de risco neste canal.`
      : "";

  if (health === "winning") {
    return `${getOptimizationChannelLabel(platform)} esta devolvendo sinal suficiente para discutir escala assistida.${memoryFragment}`;
  }

  if (health === "at_risk") {
    return `${getOptimizationChannelLabel(platform)} segue operacional, mas tracking ou dispatch ainda gera ${blocked + failed} sinais problematicos.${memoryFragment}`;
  }

  if (health === "wasteful") {
    return cpaTarget && cpa
      ? `${getOptimizationChannelLabel(platform)} esta acima da meta de CPA (${formatCurrency(cpa)} vs ${formatCurrency(cpaTarget)}).${memoryFragment}`
      : `${getOptimizationChannelLabel(platform)} esta consumindo mais energia do que retorno neste ciclo.${memoryFragment}`;
  }

  return `${getOptimizationChannelLabel(platform)} ainda precisa de mais amostra antes de escalar ou cortar.${memoryFragment}`;
}

function getOptimizationMemoryBias(workspace: CompanyWorkspace, platform: PlatformId) {
  const channel = platform.toLowerCase();
  const agentLearnings = workspace.agentLearnings ?? [];
  const experimentOutcomes = workspace.experimentOutcomes ?? [];
  const learningPlaybooks = workspace.learningPlaybooks ?? [];
  const winnerSignals = agentLearnings.filter(
    (learning) =>
      learning.status !== "historical" &&
      learning.kind === "playbook" &&
      learning.title.toLowerCase().includes(channel)
  ).length;
  const loserSignals = agentLearnings.filter(
    (learning) =>
      learning.status !== "historical" &&
      (learning.kind === "risk" || learning.kind === "warning") &&
      learning.title.toLowerCase().includes(channel)
  ).length;
  const experimentWins = experimentOutcomes.filter(
    (outcome) => outcome.channel === channel && outcome.status === "won"
  ).length;
  const experimentLosses = experimentOutcomes.filter(
    (outcome) =>
      outcome.channel === channel &&
      (outcome.status === "lost" || outcome.status === "inconclusive")
  ).length;
  const activePlaybooks = learningPlaybooks.filter(
    (playbook) => playbook.channel === channel && playbook.status === "active"
  ).length;
  const retiredPlaybooks = learningPlaybooks.filter(
    (playbook) => playbook.channel === channel && playbook.status === "retired"
  ).length;

  return {
    winnerSignals: winnerSignals + experimentWins + activePlaybooks,
    loserSignals: loserSignals + experimentLosses + retiredPlaybooks
  };
}

function applyOptimizationMemoryDecisionBias(
  decision: NonNullable<CompanyExecutionPlan["optimizationScorecards"]>[number]["decision"],
  health: NonNullable<CompanyExecutionPlan["optimizationScorecards"]>[number]["health"],
  memoryBias: ReturnType<typeof getOptimizationMemoryBias>
) {
  if (memoryBias.loserSignals >= 2 && (decision === "hold" || decision === "fix")) {
    return "pause" as const;
  }

  if (memoryBias.winnerSignals >= 2 && decision === "hold" && health === "learning") {
    return "scale" as const;
  }

  if (memoryBias.winnerSignals > memoryBias.loserSignals && decision === "fix") {
    return "hold" as const;
  }

  if (memoryBias.loserSignals > memoryBias.winnerSignals && decision === "scale") {
    return "hold" as const;
  }

  return decision;
}

function applyOptimizationMemoryScoreBias(
  score: number,
  memoryBias: ReturnType<typeof getOptimizationMemoryBias>
) {
  return Math.max(0, Math.min(100, score + memoryBias.winnerSignals * 6 - memoryBias.loserSignals * 6));
}

function buildOptimizationMemoryEvidence(memoryBias: ReturnType<typeof getOptimizationMemoryBias>) {
  if (memoryBias.winnerSignals === 0 && memoryBias.loserSignals === 0) {
    return undefined;
  }

  return `Memoria persistida do Agent Lion: ${memoryBias.winnerSignals} sinais vencedores e ${memoryBias.loserSignals} sinais de risco neste canal.`;
}

function dedupeExecutionActions(actions: CompanyExecutionAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.kind}:${action.targetPlatform ?? "none"}:${action.title}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getOptimizationChannelLabel(channel: string) {
  switch (channel) {
    case "google-ads":
      return "Google Ads";
    case "meta":
      return "Meta";
    case "ga4":
      return "GA4";
    case "search-console":
      return "Search Console";
    case "business-profile":
      return "Google Business Profile";
    default:
      return channel;
  }
}

function parseCurrencyTarget(value: string) {
  const normalized = value
    .replace(/[^\d.,-]/g, "")
    .replace(/\.(?=\d{3}\b)/g, "")
    .replace(",", ".");
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getPriorityScore(priority?: ExecutionTrackPriority) {
  switch (priority) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

function isPriorityAtLeast(priority: ExecutionTrackPriority | undefined, minimumPriority: ExecutionTrackPriority) {
  return getPriorityScore(priority) >= getPriorityScore(minimumPriority);
}

function getStricterPriority(left: ExecutionTrackPriority, right: ExecutionTrackPriority) {
  return getPriorityScore(left) >= getPriorityScore(right) ? left : right;
}

export function getExecutionTrackPriorityLabel(priority?: ExecutionTrackPriority) {
  switch (priority) {
    case "critical":
      return "critica";
    case "high":
      return "alta";
    case "medium":
      return "media";
    default:
      return "baixa";
  }
}

function getOperationalInboxSourcePath(
  companySlug: string,
  kind: CompanyExecutionAction["kind"]
) {
  switch (kind) {
    case "review_approvals":
      return `/empresas/${companySlug}/aprovacoes`;
    case "resolve_runtime_blockers":
      return `/empresas/${companySlug}/social/runtime`;
    case "resolve_conversion_dispatch":
      return `/empresas/${companySlug}/conversao`;
    case "scale_winning_channel":
    case "hold_learning_channel":
    case "fix_underperforming_channel":
    case "pause_wasteful_channel":
      return `/empresas/${companySlug}/operacao`;
    case "launch_ab_test":
      return `/empresas/${companySlug}/studio`;
    case "resolve_channel_gap":
      return `/empresas/${companySlug}`;
    default:
      return `/empresas/${companySlug}/operacao`;
  }
}

function getOperationalInboxSourceLabel(kind: CompanyExecutionAction["kind"]) {
  switch (kind) {
    case "review_approvals":
      return "Abrir Approval Center";
    case "resolve_runtime_blockers":
      return "Abrir runtime social";
    case "resolve_conversion_dispatch":
      return "Abrir conversao";
    case "scale_winning_channel":
    case "hold_learning_channel":
    case "fix_underperforming_channel":
    case "pause_wasteful_channel":
      return "Abrir operacao";
    case "launch_ab_test":
      return "Abrir Studio";
    case "resolve_channel_gap":
      return "Abrir workspace";
    default:
      return "Abrir operacao";
  }
}

function getOperationalInboxState(action: CompanyExecutionAction): OperationalInboxItem["state"] {
  if (action.status === "recommended") {
    return action.mode === "auto_low_risk" ? "ready_to_run" : "needs_review";
  }

  return action.mode === "auto_low_risk" ? "needs_unblock" : "needs_review";
}

export function getOperationalAlertStatusLabel(status: CompanyOperationalAlert["status"]) {
  switch (status) {
    case "acknowledged":
      return "reconhecido";
    case "resolved":
      return "resolvido";
    default:
      return "aberto";
  }
}

export function getOperationalAlertChannelLabel(channel: CompanyOperationalAlert["channels"][number]) {
  switch (channel) {
    case "email_ready":
      return "email pronto";
    default:
      return "scheduler";
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2
  }).format(value);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: 2
  }).format(value);
}
