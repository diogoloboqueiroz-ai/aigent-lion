import { buildTriggerEvent } from "@/lib/agents/orchestrator";
import {
  drainAgentWorkerQueue,
  enqueueAgentWorkerRun,
  getQueueIdempotencyKeyForScheduler
} from "@/lib/agents/queue-processor";
import { buildAutomationControlTowerSummary } from "@/lib/agents/runtime";
import { getAgentRuntimeSnapshot } from "@/lib/agents/worker";
import {
  canInlineAgentWorkerExecution,
  getAgentExecutionPlaneMode,
  isExternalAgentExecutionPlane
} from "@/lib/agents/execution-plane";
import { sanitizeErrorMessage } from "@/core/observability/redaction";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCompanyWorkspace } from "@/lib/connectors";
import { syncCompanyLeadsToCrm } from "@/lib/crm";
import { dispatchQueuedLeadConversionSignals } from "@/lib/conversion-runtime";
import {
  getStoredCompanyOperationalAlerts,
  getStoredScheduledSocialPosts,
  getStoredSocialRuntimeTasks,
  upsertStoredCompanyOperationalAlert,
  upsertStoredSocialRuntimeTask,
  upsertStoredCompanySchedulerJob,
  upsertStoredCompanySchedulerProfile
} from "@/lib/company-vault";
import { executeSocialRuntimeBatch } from "@/lib/social-execution";
import {
  buildSocialRuntimeSyncTask,
  buildSocialRuntimeTaskForPost
} from "@/lib/social-runtime";
import { syncCompanyGoogleDataOps } from "@/lib/google-data";
import { syncCompanyLearningMemory } from "@/lib/learning";
import { requireCompanyPermission } from "@/lib/rbac";
import { parseSchedulerJobForm, parseSchedulerProfileForm, runSchedulerJob } from "@/lib/scheduler";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

export async function GET(
  _request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  const workspace = getCompanyWorkspace(companyId);

  if (!workspace) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
  }

  const runtime = await getAgentRuntimeSnapshot(workspace.company.slug);

  return NextResponse.json(
    {
      schedulerProfile: workspace.schedulerProfile,
      schedulerJobs: workspace.schedulerJobs,
      operationalAlerts: workspace.operationalAlerts,
      automationControlTower: runtime?.controlTower ?? buildAutomationControlTowerSummary(workspace),
      automationQueue: runtime?.automationQueue ?? workspace.automationQueue,
      automationDeadLetters: runtime?.automationDeadLetters ?? workspace.automationDeadLetters,
      automationRuntimeHealth: runtime?.automationRuntimeHealth ?? workspace.automationRuntimeHealth
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);

  if (!session) {
    return NextResponse.redirect(new URL("/?auth=login-required", request.url), { status: 303 });
  }

  const professionalProfile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(companyId, professionalProfile);

  if (!workspace) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "save-profile");
  const requiredPermission =
    intent === "run-job"
      ? "scheduler:run"
      : "scheduler:manage";
  const permissionCheck = requireCompanyPermission({
    companySlug: workspace.company.slug,
    profile: professionalProfile,
    permission: requiredPermission,
    actor: session.email
  });

  if (!permissionCheck.allowed) {
    return NextResponse.json(
      { error: permissionCheck.message, auditId: permissionCheck.auditId },
      { status: 403 }
    );
  }

  if (intent === "save-profile") {
    upsertStoredCompanySchedulerProfile(parseSchedulerProfileForm(formData, workspace.schedulerProfile));

    return NextResponse.redirect(new URL(`/empresas/${companyId}/scheduler?saved=profile`, request.url), {
      status: 303
    });
  }

  if (intent === "ack-alert" || intent === "resolve-alert") {
    const alertId = String(formData.get("alertId") ?? "");
    const currentAlert = getStoredCompanyOperationalAlerts(workspace.company.slug).find((alert) => alert.id === alertId);

    if (!currentAlert) {
      return NextResponse.json({ error: "Alerta operacional nao encontrado" }, { status: 404 });
    }

    upsertStoredCompanyOperationalAlert({
      ...currentAlert,
      status: intent === "ack-alert" ? "acknowledged" : "resolved",
      updatedAt: new Date().toISOString(),
      acknowledgedAt: intent === "ack-alert" ? new Date().toISOString() : currentAlert.acknowledgedAt,
      resolvedAt: intent === "resolve-alert" ? new Date().toISOString() : currentAlert.resolvedAt
    });

    return NextResponse.redirect(new URL(`/empresas/${companyId}/scheduler?saved=${intent}`, request.url), {
      status: 303
    });
  }

  const jobId = String(formData.get("jobId") ?? "");
  const currentJob = workspace.schedulerJobs.find((job) => job.id === jobId);

  if (!currentJob) {
    return NextResponse.json({ error: "Job de scheduler nao encontrado" }, { status: 404 });
  }

  let nextJob = parseSchedulerJobForm(formData, currentJob);

  if (intent === "run-job") {
    if (currentJob.id.endsWith("social-sync")) {
      const analyticsBindings = workspace.socialBindings.filter((binding) => binding.analyticsReady);
      const tasksToExecute = [];

      for (const binding of analyticsBindings) {
        const task =
          workspace.socialRuntimeTasks.find(
            (entry) =>
              entry.kind === "sync_analytics" &&
              entry.platform === binding.platform &&
              entry.status !== "completed"
          ) ??
          buildSocialRuntimeSyncTask(workspace.company.slug, binding.platform, binding, session.email);

        if (!workspace.socialRuntimeTasks.some((entry) => entry.id === task.id)) {
          upsertStoredSocialRuntimeTask(task);
        }

        tasksToExecute.push(task);
      }

      const batch = await executeSocialRuntimeBatch(workspace.company, tasksToExecute, session.email);

      nextJob = runSchedulerJob(
        currentJob,
        analyticsBindings.length === 0
          ? "Nenhuma plataforma com analytics pronto para sincronizacao."
          : `Social sync executado: ${batch.completed} concluidas, ${batch.blocked} bloqueadas e ${batch.failed} com falha.`
      );
    } else if (currentJob.id.endsWith("google-data-sync")) {
      const googleSync = await syncCompanyGoogleDataOps(workspace);

      nextJob = runSchedulerJob(
        currentJob,
        googleSync.summary
      );
    } else if (currentJob.id.endsWith("social-publish")) {
      const now = new Date();
      const duePosts = getStoredScheduledSocialPosts(workspace.company.slug).filter(
        (post) => post.status === "scheduled" && new Date(post.scheduledFor).getTime() <= now.getTime()
      );
      const tasksToExecute = [];

      for (const post of duePosts) {
        const binding = workspace.socialBindings.find((entry) => entry.platform === post.platform);
        if (!binding) {
          continue;
        }

        const task =
          workspace.socialRuntimeTasks.find(
            (entry) =>
              entry.kind === "publish_post" &&
              entry.sourceItemId === post.id &&
              entry.status !== "completed"
          ) ??
          buildSocialRuntimeTaskForPost(post, binding, session.email);

        if (!workspace.socialRuntimeTasks.some((entry) => entry.id === task.id)) {
          upsertStoredSocialRuntimeTask(task);
        }

        tasksToExecute.push(task);
      }

      const batch = await executeSocialRuntimeBatch(workspace.company, tasksToExecute, session.email);

      nextJob = runSchedulerJob(
        currentJob,
        duePosts.length === 0
          ? "Nenhum post aprovado e vencido para publicar neste ciclo."
          : `Publicacao social executada: ${batch.completed} concluidas, ${batch.blocked} bloqueadas e ${batch.failed} com falha.`
      );
    } else if (currentJob.id.endsWith("runtime-drain")) {
      const queuedTasks = getStoredSocialRuntimeTasks(workspace.company.slug).filter((entry) => entry.status === "queued");
      const batch = await executeSocialRuntimeBatch(workspace.company, queuedTasks, session.email);

      nextJob = runSchedulerJob(
        currentJob,
        batch.total === 0
          ? "Nenhuma tarefa queued na runtime social neste ciclo."
          : `Runtime drenada: ${batch.completed} concluidas, ${batch.blocked} bloqueadas e ${batch.failed} com falha.`
      );
    } else if (currentJob.id.endsWith("approval-digest")) {
      nextJob = runSchedulerJob(
        currentJob,
        `Digest consolidado com ${workspace.approvalsCenter.filter((item) => item.actions.length > 0).length} aprovacoes pendentes.`
      );
    } else if (currentJob.id.endsWith("crm-follow-up")) {
      const activeLeads = workspace.leads.filter((lead) => lead.stage !== "won" && lead.stage !== "lost");
      const overdueFollowUps = activeLeads.filter(
        (lead) => lead.nextFollowUpAt && new Date(lead.nextFollowUpAt).getTime() <= Date.now()
      );
      const qualifiedLeads = activeLeads.filter(
        (lead) => lead.stage === "qualified" || lead.stage === "proposal"
      );
      const crmSync = await syncCompanyLeadsToCrm({
        company: workspace.company,
        profile: workspace.crmProfile,
        leads: workspace.leads
      });
      const conversionSync = await dispatchQueuedLeadConversionSignals({
        company: workspace.company,
        siteOpsProfile: workspace.siteOpsProfile,
        leads: workspace.leads
      });

      nextJob = runSchedulerJob(
        currentJob,
        activeLeads.length === 0
          ? "Nenhum lead canonico ativo para follow-up neste ciclo."
          : `Cadencia CRM revisada: ${activeLeads.length} leads ativos, ${overdueFollowUps.length} follow-ups vencidos, ${qualifiedLeads.length} oportunidades qualificadas. Sync externo: ${crmSync.summary}. Conversoes: ${conversionSync.sent} enviadas, ${conversionSync.blocked} bloqueadas e ${conversionSync.failed} com falha.`
      );
    } else if (currentJob.id.endsWith("execution-pulse")) {
      try {
        const trigger = buildTriggerEvent(workspace.company.slug, {
          triggerType: "scheduled_cycle",
          actor: `scheduler:${currentJob.id}`,
          summary: `${currentJob.label} disparou o ciclo autonomo oficial desta empresa.`
        });
        const queueItem = await enqueueAgentWorkerRun({
          companySlug: workspace.company.slug,
          actor: session.email,
          trigger,
          reason: `${currentJob.label} enfileirou um novo ciclo autonomo oficial para esta empresa.`,
          idempotencyKey: getQueueIdempotencyKeyForScheduler(
            workspace.company.slug,
            currentJob.id,
            currentJob.nextRunAt
          ),
          schedulerAutonomy: currentJob.autonomy,
          requestOrigin: new URL(request.url).origin,
          fallbackRecipientEmail: session.email,
          source: "scheduler"
        });

        nextJob = runSchedulerJob(
          currentJob,
          `Pulso autonomo enfileirado com sucesso na fila oficial do Agent Lion. Item: ${queueItem.id}. Autonomia: ${currentJob.autonomy}. Execution plane: ${getAgentExecutionPlaneMode()}.`
        );
      } catch (error) {
        const message = sanitizeErrorMessage(error, "Falha ao rodar o ciclo autonomo do scheduler.");
        nextJob = runSchedulerJob(currentJob, `Falha no ciclo autonomo oficial: ${message}`);
      }
    } else if (currentJob.id.endsWith("agent-runtime-drain")) {
      try {
        if (isExternalAgentExecutionPlane() && !canInlineAgentWorkerExecution()) {
          const runtimeSummary = buildAutomationControlTowerSummary(workspace);
          nextJob = runSchedulerJob(
            currentJob,
            `Execution plane externo ativo. Nenhum drain inline foi executado. Fila atual: ${runtimeSummary.queuePressure.queuedRuns} runs queued e ${runtimeSummary.queuePressure.queuedRetries} retries queued.`
          );
        } else {
        const drain = await drainAgentWorkerQueue({
          companySlug: workspace.company.slug,
          actor: session.email,
          executionContext: "inline_control_plane",
          professionalProfile,
          requestOrigin: new URL(request.url).origin,
          fallbackRecipientEmail: session.email,
          limit: 2
        });

        nextJob = runSchedulerJob(
          currentJob,
          drain.processed === 0
            ? "Nenhum ciclo autonomo aguardava consumo na fila oficial."
            : `Fila oficial drenada: ${drain.completed} concluidos, ${drain.requeued} requeued, ${drain.deadLettered} dead-letter.${drain.lastCompletedRunId ? ` Ultimo run: ${drain.lastCompletedRunId}.` : ""}`
        );
        }
      } catch (error) {
        const message = sanitizeErrorMessage(error, "Falha ao drenar a fila oficial do Agent Lion.");
        nextJob = runSchedulerJob(currentJob, `Falha no drain do worker oficial: ${message}`);
      }
    } else if (currentJob.id.endsWith("learning-pulse")) {
      const learnings = syncCompanyLearningMemory({
        workspace
      });
      const freshLearnings = learnings.filter((learning) => learning.status === "fresh").length;
      const activePlaybooks = learnings.filter(
        (learning) => learning.status !== "historical" && learning.kind === "playbook"
      ).length;

      nextJob = runSchedulerJob(
        currentJob,
        learnings.length === 0
          ? "Nenhum aprendizado persistente foi consolidado neste ciclo."
          : `Learning loop consolidado com ${freshLearnings} aprendizados novos e ${activePlaybooks} playbooks ativos.`
      );
    } else {
      nextJob = runSchedulerJob(currentJob);
    }
  }

  upsertStoredCompanySchedulerJob(nextJob);

  return NextResponse.redirect(new URL(`/empresas/${companyId}/scheduler?saved=${intent}`, request.url), {
    status: 303
  });
}
