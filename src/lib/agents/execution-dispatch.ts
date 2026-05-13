import { dispatchQueuedLeadConversionSignals } from "@/lib/conversion-runtime";
import { upsertPersistedCompanyCreativeAsset } from "@/infrastructure/persistence/company-creative-storage";
import { upsertPersistedCompanyLead } from "@/infrastructure/persistence/company-commercial-storage";
import { upsertPersistedSocialRuntimeTask } from "@/infrastructure/persistence/company-social-storage";
import {
  applyLeadCommercialAutopilot,
  queueLeadForCrmIfNeeded,
  syncCompanyLeadsToCrm
} from "@/lib/crm";
import { buildCreativeAssetsForExperiment, buildGeneratedCreativeAsset } from "@/lib/creative-tools";
import { mergeWorkspaceMetricSnapshots, syncCompanyGoogleDataOps } from "@/lib/google-data";
import { recordCompanyAuditEvent } from "@/lib/governance";
import { syncCompanyLearningMemory } from "@/lib/learning";
import { generateCompanyReport, saveGeneratedCompanyReport } from "@/lib/reports";
import { publishLandingPageToWordPress } from "@/lib/site-cms";
import { buildSocialRuntimeSyncTask } from "@/lib/social-runtime";
import { buildExperimentFromExecutionJob } from "@/core/runtime/job-planner";
import {
  resolveExecutionDispatchHandler,
  runExecutionDispatchWithRetries,
  slugifyExecutionValue,
  type ExecutionDispatchRegistry
} from "@/core/runtime/execution-dispatch-contract";
import type {
  AutomationOutcome,
  CompanyContext,
  ExecutionJob,
  Experiment
} from "@/lib/agents/types";

export function buildExperimentArtifacts(job: ExecutionJob): Experiment {
  return buildExperimentFromExecutionJob(job);
}

export function simulateExecutionAdapter(
  context: CompanyContext,
  job: ExecutionJob,
  startedAt: string,
  auditReference: string
): AutomationOutcome {
  const finishedAt = new Date().toISOString();

  switch (job.type) {
    case "queue_social_sync":
      return {
        jobId: job.id,
        companySlug: context.companySlug,
        status: "completed",
        summary: "A fila de sync social foi preparada para o proximo ciclo operacional.",
        outputs: {
          executor: "simulated",
          readyPlatforms: context.workspace.socialBindings.filter((binding) => binding.analyticsReady).length,
          queuedTasks: context.kpis.runtimeQueued
        },
        startedAt,
        finishedAt,
        auditReferences: [auditReference]
      };
    case "prepare_growth_report":
      return {
        jobId: job.id,
        companySlug: context.companySlug,
        status: "completed",
        summary: "O Agent Lion preparou um baseline de relatorio para o proximo consolidado executivo.",
        outputs: {
          executor: "simulated",
          suggestedReportType: "weekly_marketing",
          recentReports: context.recentReports.length
        },
        startedAt,
        finishedAt,
        auditReferences: [auditReference]
      };
    case "audit_connectors":
      return {
        jobId: job.id,
        companySlug: context.companySlug,
        status: "completed",
        summary: "O Agent Lion consolidou o readiness dos conectores e os proximos desbloqueios.",
        outputs: {
          executor: "simulated",
          ready: context.kpis.connectorCoverage.ready,
          partial: context.kpis.connectorCoverage.partial,
          blocked: context.kpis.connectorCoverage.blocked
        },
        startedAt,
        finishedAt,
        auditReferences: [auditReference]
      };
    case "stabilize_runtime":
      return {
        jobId: job.id,
        companySlug: context.companySlug,
        status: "completed",
        summary: "O Agent Lion preparou um plano de estabilizacao da runtime a partir das ultimas falhas e bloqueios.",
        outputs: {
          executor: "simulated",
          blockedTasks: context.kpis.runtimeBlocked,
          failedTasks: context.kpis.runtimeFailed,
          suggestedReplay: context.kpis.runtimeBlocked + context.kpis.runtimeFailed === 0 ? "none" : "manual"
        },
        startedAt,
        finishedAt,
        auditReferences: [auditReference]
      };
    case "stabilize_tracking":
      return {
        jobId: job.id,
        companySlug: context.companySlug,
        status: "completed",
        summary: "O Agent Lion preparou a trilha de correcoes para tracking e dispatch de conversao.",
        outputs: {
          executor: "simulated",
          blockedConversions: context.workspace.conversionEvents.filter((event) => event.status === "blocked").length,
          failedConversions: context.workspace.conversionEvents.filter((event) => event.status === "failed").length
        },
        startedAt,
        finishedAt,
        auditReferences: [auditReference]
      };
    default:
      return {
        jobId: job.id,
        companySlug: context.companySlug,
        status: "completed",
        summary: "A acao foi preparada em modo adaptador, sem mutacao externa real nesta fase.",
        outputs: {
          executor: "simulated",
          actionType: job.type,
          autonomyMode: job.autonomyMode
        },
        startedAt,
        finishedAt,
        auditReferences: [auditReference]
      };
  }
}

export async function executeRealLowRiskActionAdapter(
  context: CompanyContext,
  job: ExecutionJob,
  startedAt: string,
  auditReference: string
): Promise<AutomationOutcome | null> {
  const handler = resolveExecutionDispatchHandler(REAL_LOW_RISK_DISPATCHERS, job.type);
  return handler ? handler(context, job, startedAt, auditReference) : null;
}

const REAL_LOW_RISK_DISPATCHERS: ExecutionDispatchRegistry = {
  queue_social_sync: queueRealSocialSyncTasks,
  stabilize_runtime: stabilizeRealRuntime,
  prepare_growth_report: prepareRealGrowthReport,
  audit_connectors: auditRealConnectorReadiness,
  stabilize_tracking: stabilizeRealTracking,
  follow_up_leads: followUpRealLeads,
  refresh_creatives: refreshRealCreatives,
  launch_experiment: launchRealExperiment
};

async function queueRealSocialSyncTasks(
  context: CompanyContext,
  job: ExecutionJob,
  startedAt: string,
  auditReference: string
): Promise<AutomationOutcome> {
  const eligibleBindings = context.workspace.socialBindings.filter((binding) => binding.analyticsReady);
  let createdTasks = 0;
  let skippedTasks = 0;

  for (const binding of eligibleBindings) {
    const existingTask = context.workspace.socialRuntimeTasks.find(
      (entry) =>
        entry.kind === "sync_analytics" &&
        entry.platform === binding.platform &&
        entry.status !== "completed"
    );

    if (existingTask) {
      skippedTasks += 1;
      continue;
    }

    upsertPersistedSocialRuntimeTask(
      buildSocialRuntimeSyncTask(
        context.companySlug,
        binding.platform,
        binding,
        `agent:${job.id}`
      )
    );
    createdTasks += 1;
  }

  const finishedAt = new Date().toISOString();
  return {
    jobId: job.id,
    companySlug: context.companySlug,
    status: "completed",
    summary:
      createdTasks > 0
        ? `${createdTasks} tarefas reais de sync social foram enfileiradas pelo Agent Lion.`
        : "Nenhuma nova tarefa de sync precisou ser criada; a fila social ja refletia o estado atual.",
    outputs: {
      executor: "social-runtime",
      createdTasks,
      skippedTasks,
      eligibleBindings: eligibleBindings.length
    },
    startedAt,
    finishedAt,
    auditReferences: [auditReference]
  };
}

async function stabilizeRealRuntime(
  context: CompanyContext,
  job: ExecutionJob,
  startedAt: string,
  auditReference: string
): Promise<AutomationOutcome> {
  const blockedTasks = context.workspace.socialRuntimeTasks.filter(
    (task) => (task.status === "blocked" || task.status === "failed") && task.kind === "sync_analytics"
  );
  let replayQueued = 0;
  let skipped = 0;

  for (const task of blockedTasks) {
    const binding = context.workspace.socialBindings.find((entry) => entry.platform === task.platform);
    if (!binding?.analyticsReady) {
      skipped += 1;
      continue;
    }

    const alreadyQueued = context.workspace.socialRuntimeTasks.find(
      (entry) =>
        entry.platform === task.platform &&
        entry.kind === "sync_analytics" &&
        (entry.status === "queued" || entry.status === "running")
    );

    if (alreadyQueued) {
      skipped += 1;
      continue;
    }

    upsertPersistedSocialRuntimeTask(
      buildSocialRuntimeSyncTask(context.companySlug, task.platform, binding, `agent:${job.id}`)
    );
    replayQueued += 1;
  }

  const finishedAt = new Date().toISOString();
  return {
    jobId: job.id,
    companySlug: context.companySlug,
    status: "completed",
    summary:
      replayQueued > 0
        ? `${replayQueued} replays de runtime foram preparados para retomar analytics bloqueado.`
        : "A runtime foi analisada, mas nenhum replay seguro adicional precisou ser criado.",
    outputs: {
      executor: "social-runtime",
      blockedTasks: blockedTasks.length,
      replayQueued,
      skipped
    },
    startedAt,
    finishedAt,
    auditReferences: [auditReference]
  };
}

async function prepareRealGrowthReport(
  context: CompanyContext,
  job: ExecutionJob,
  startedAt: string,
  auditReference: string
): Promise<AutomationOutcome> {
  const googleSync = await runWithRetries(
    () => syncCompanyGoogleDataOps(context.workspace),
    2,
    500
  );
  const mergedWorkspace = {
    ...context.workspace,
    snapshots: mergeWorkspaceMetricSnapshots(context.workspace.snapshots, googleSync.snapshots),
    dataOpsProfile: googleSync.profile
  };
  const report = generateCompanyReport(mergedWorkspace, "weekly_marketing");
  saveGeneratedCompanyReport(report);
  syncCompanyLearningMemory({
    workspace: {
      ...mergedWorkspace,
      reports: [report, ...context.workspace.reports]
    }
  });

  const finishedAt = new Date().toISOString();
  return {
    jobId: job.id,
    companySlug: context.companySlug,
    status: "completed",
    summary: `Relatorio semanal gerado com sync Google previo: ${report.title}.`,
    outputs: {
      executor: "reporting",
      reportId: report.id,
      reportType: report.type,
      syncedPlatforms: googleSync.syncedPlatforms,
      blockedPlatforms: googleSync.blockedPlatforms,
      failedPlatforms: googleSync.failedPlatforms,
      googleSummary: googleSync.summary
    },
    startedAt,
    finishedAt,
    auditReferences: [auditReference]
  };
}

async function stabilizeRealTracking(
  context: CompanyContext,
  job: ExecutionJob,
  startedAt: string,
  auditReference: string
): Promise<AutomationOutcome> {
  const conversionSync = await runWithRetries(
    () =>
      dispatchQueuedLeadConversionSignals({
        company: context.workspace.company,
        siteOpsProfile: context.workspace.siteOpsProfile,
        leads: context.workspace.leads
      }),
    2,
    400
  );
  const finishedAt = new Date().toISOString();

  return {
    jobId: job.id,
    companySlug: context.companySlug,
    status: "completed",
    summary:
      conversionSync.sent > 0
        ? `O Agent Lion replayou o tracking com ${conversionSync.sent} sinais enviados.`
        : "O Agent Lion reavaliou o tracking, mas nenhum sinal adicional saiu neste ciclo.",
    outputs: {
      executor: "conversion-runtime",
      sent: conversionSync.sent,
      blocked: conversionSync.blocked,
      failed: conversionSync.failed
    },
    startedAt,
    finishedAt,
    auditReferences: [auditReference]
  };
}

async function auditRealConnectorReadiness(
  context: CompanyContext,
  job: ExecutionJob,
  startedAt: string,
  auditReference: string
): Promise<AutomationOutcome> {
  const blocked = context.connectorCapabilities.filter((capability) => capability.status === "blocked");
  const partial = context.connectorCapabilities.filter((capability) => capability.status === "partial");
  const ready = context.connectorCapabilities.filter((capability) => capability.status === "ready");
  const readinessAudit = recordCompanyAuditEvent({
    companySlug: context.companySlug,
    connector: "system",
    kind: blocked.length > 0 ? "warning" : "info",
    title: "Connector readiness audit",
    details: `Ready ${ready.length} | partial ${partial.length} | blocked ${blocked.length}.`
  });
  const finishedAt = new Date().toISOString();

  return {
    jobId: job.id,
    companySlug: context.companySlug,
    status: "completed",
    summary: "O Agent Lion consolidou um readiness audit real dos conectores desta empresa.",
    outputs: {
      executor: "connector-audit",
      ready: ready.length,
      partial: partial.length,
      blocked: blocked.length,
      blockedConnectors: blocked.map((capability) => capability.connector)
    },
    startedAt,
    finishedAt,
    auditReferences: [auditReference, readinessAudit.id]
  };
}

async function followUpRealLeads(
  context: CompanyContext,
  job: ExecutionJob,
  startedAt: string,
  auditReference: string
): Promise<AutomationOutcome> {
  const now = new Date().toISOString();
  const candidates = context.workspace.leads.filter(
    (lead) =>
      lead.stage !== "won" &&
      lead.stage !== "lost" &&
      (!lead.nextFollowUpAt || lead.nextFollowUpAt <= now || lead.syncStatus !== "synced")
  );
  const routedLeads = candidates.map((lead) =>
    queueLeadForCrmIfNeeded(
      applyLeadCommercialAutopilot(context.workspace.crmProfile, lead),
      context.workspace.crmProfile
    )
  );

  for (const lead of routedLeads) {
    upsertPersistedCompanyLead(lead);
  }

  const syncResult = await runWithRetries(
    () =>
      syncCompanyLeadsToCrm({
        company: context.workspace.company,
        profile: context.workspace.crmProfile,
        leads: [
          ...routedLeads,
          ...context.workspace.leads.filter((lead) => !candidates.some((entry) => entry.id === lead.id))
        ]
      }),
    2,
    400
  );
  const finishedAt = new Date().toISOString();

  return {
    jobId: job.id,
    companySlug: context.companySlug,
    status: "completed",
    summary:
      routedLeads.length > 0
        ? `${routedLeads.length} leads tiveram owner, cadence ou sync comercial atualizados pelo Agent Lion.`
        : "Nao havia leads elegiveis para follow-up comercial neste ciclo.",
    outputs: {
      executor: "crm",
      routedLeads: routedLeads.length,
      syncedLeads: syncResult.synced,
      failedLeads: syncResult.failed,
      skippedLeads: syncResult.skipped,
      crmSummary: syncResult.summary
    },
    startedAt,
    finishedAt,
    auditReferences: [auditReference]
  };
}

async function refreshRealCreatives(
  context: CompanyContext,
  job: ExecutionJob,
  startedAt: string,
  auditReference: string
): Promise<AutomationOutcome> {
  const sourceExperimentIds = Array.isArray(job.inputs.sourceExperimentIds)
    ? job.inputs.sourceExperimentIds.map((entry) => String(entry))
    : [];
  const experiments = context.workspace.executionPlans[0]?.recommendedExperiments?.filter((experiment) =>
    sourceExperimentIds.includes(experiment.id)
  ) ?? [];
  const createdAssets =
    experiments.length > 0
      ? experiments.flatMap((experiment) =>
          buildCreativeAssetsForExperiment({
            company: context.workspace.company,
            experiment,
            createdWith: "openai-api",
            requestedBy: `agent:${job.id}`
          })
        )
      : [
          buildGeneratedCreativeAsset({
            company: context.workspace.company,
            title: `Refresh criativo - ${context.workspace.company.name}`,
            assetType: "post",
            destination: "Studio",
            createdWith: "openai-api",
            requestedBy: `agent:${job.id}`,
            summary: String(job.inputs.promptFocus ?? context.workspace.strategyPlan.primaryObjective),
            generationPrompt: String(job.inputs.promptFocus ?? context.workspace.strategyPlan.primaryObjective),
            platformHint: "instagram"
          })
        ];

  for (const asset of createdAssets) {
    upsertPersistedCompanyCreativeAsset(asset);
  }

  const finishedAt = new Date().toISOString();
  return {
    jobId: job.id,
    companySlug: context.companySlug,
    status: "completed",
    summary: `${createdAssets.length} drafts criativos foram adicionados ao Studio para a tese atual.`,
    outputs: {
      executor: "studio",
      createdAssets: createdAssets.length,
      sourceExperiments: experiments.map((experiment) => experiment.id)
    },
    startedAt,
    finishedAt,
    auditReferences: [auditReference]
  };
}

async function launchRealExperiment(
  context: CompanyContext,
  job: ExecutionJob,
  startedAt: string,
  auditReference: string
): Promise<AutomationOutcome> {
  const experiment = {
    id: String(job.inputs.experimentId ?? `job-${job.id}`),
    title: String(job.inputs.title ?? job.title),
    channel: String(job.inputs.channel ?? "meta"),
    hypothesis: String(job.inputs.hypothesis ?? job.rationale),
    primaryMetric: String(job.inputs.primaryMetric ?? "conversion_rate"),
    variants: Array.isArray(job.inputs.variants)
      ? job.inputs.variants.map((entry) => String(entry))
      : ["Variante A", "Variante B"],
    status: "planned" as const,
    successCriteria: String(
      job.inputs.successCriteria ?? "Mover o experimento para vencedor sem aumentar risco operacional."
    ),
    observationWindowDays: Number(job.inputs.observationWindowDays ?? 7),
    confidence: Number(job.inputs.confidence ?? 0.7),
    baselineMetricValue:
      typeof job.inputs.baselineMetricValue === "number" ? job.inputs.baselineMetricValue : undefined,
    sourceScorecardId:
      typeof job.inputs.sourceScorecardId === "string" ? job.inputs.sourceScorecardId : undefined,
    sourceRunId: typeof job.inputs.sourceRunId === "string" ? job.inputs.sourceRunId : undefined,
    lastEvaluatedAt:
      typeof job.inputs.lastEvaluatedAt === "string" ? job.inputs.lastEvaluatedAt : undefined,
    winningVariant:
      typeof job.inputs.winningVariant === "string" ? job.inputs.winningVariant : undefined,
    nextAction: String(job.inputs.nextAction ?? "Revisar vencedora apos observacao real.")
  };
  const createdAssets = buildCreativeAssetsForExperiment({
    company: context.workspace.company,
    experiment,
    createdWith: "openai-api",
    requestedBy: `agent:${job.id}`
  });

  for (const asset of createdAssets) {
    upsertPersistedCompanyCreativeAsset(asset);
  }

  let landingDraftUrl: string | undefined;
  if (
    job.inputs.buildLandingDraft === true &&
    context.workspace.siteOpsProfile.cmsProvider === "wordpress" &&
    context.workspace.siteOpsProfile.cmsConnectionStatus === "connected"
  ) {
    const landingResult = await runWithRetries(
      () =>
        publishLandingPageToWordPress({
          companySlug: context.companySlug,
          profile: context.workspace.siteOpsProfile,
          title: `Experimento - ${experiment.title}`,
          slug: slugifyExecutionValue(`experimento-${experiment.title}`),
          summary: experiment.hypothesis,
          bulletPoints: experiment.variants,
          ctaLabel: "Quero avancar",
          ctaUrl:
            String(job.inputs.landingUrl ?? "").trim() ||
            context.workspace.siteOpsProfile.primarySiteUrl ||
            "https://example.com",
          status: "draft"
        }),
      2,
      500
    );
    landingDraftUrl = landingResult.pageUrl;
  }

  const finishedAt = new Date().toISOString();
  return {
    jobId: job.id,
    companySlug: context.companySlug,
    status: "completed",
    summary:
      landingDraftUrl
        ? `${createdAssets.length} variantes e uma landing draft foram abertas para ${experiment.title}.`
        : `${createdAssets.length} variantes foram abertas para ${experiment.title}, prontas para observacao controlada.`,
    outputs: {
      executor: "experiment-runtime",
      experimentId: experiment.id,
      createdAssets: createdAssets.length,
      landingDraftUrl
    },
    startedAt,
    finishedAt,
    auditReferences: [auditReference]
  };
}

async function runWithRetries<T>(
  operation: () => Promise<T>,
  attempts: number,
  delayMs: number
) {
  return runExecutionDispatchWithRetries(operation, attempts, delayMs);
}
