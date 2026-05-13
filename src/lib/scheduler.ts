import {
  getStoredCompanySchedulerJobs,
  getStoredCompanySchedulerProfile
} from "@/lib/company-vault";
import type {
  CompanyProfile,
  CompanySchedulerJob,
  CompanySchedulerProfile,
  SchedulerCadence
} from "@/lib/domain";
import type { UserProfessionalProfile } from "@/lib/domain";

export function getCompanySchedulerProfile(
  company: CompanyProfile,
  professionalProfile?: UserProfessionalProfile | null
): CompanySchedulerProfile {
  const defaults = buildDefaultSchedulerProfile(company, professionalProfile);
  const stored = getStoredCompanySchedulerProfile(company.slug);
  if (stored) {
    return {
      ...defaults,
      ...stored,
      schedulerAlertMinimumPriority:
        stored.schedulerAlertMinimumPriority ?? defaults.schedulerAlertMinimumPriority,
      emailAlertMinimumPriority: stored.emailAlertMinimumPriority ?? defaults.emailAlertMinimumPriority,
      alertRecipients: stored.alertRecipients ?? defaults.alertRecipients,
      financeAlertRecipients: stored.financeAlertRecipients ?? defaults.financeAlertRecipients,
      runtimeAlertRecipients: stored.runtimeAlertRecipients ?? defaults.runtimeAlertRecipients,
      strategyAlertRecipients: stored.strategyAlertRecipients ?? defaults.strategyAlertRecipients,
      approvalAlertRecipients: stored.approvalAlertRecipients ?? defaults.approvalAlertRecipients,
      connectionAlertRecipients: stored.connectionAlertRecipients ?? defaults.connectionAlertRecipients
    };
  }

  return defaults;
}

function buildDefaultSchedulerProfile(
  company: CompanyProfile,
  professionalProfile?: UserProfessionalProfile | null
): CompanySchedulerProfile {
  return {
    companySlug: company.slug,
    status: "seeded",
    timezone: company.timezone,
    quietHours: "22:00-07:00",
    approvalDigestTime: "09:00",
    incidentWatch: "Monitorar CPA, falhas de sync, tokens, contas desconectadas e rejeicoes de criativo.",
    schedulerAlertMinimumPriority: "critical",
    emailAlertMinimumPriority: "critical",
    alertRecipients: professionalProfile?.email ? [professionalProfile.email] : [],
    financeAlertRecipients: [],
    runtimeAlertRecipients: [],
    strategyAlertRecipients: [],
    approvalAlertRecipients: [],
    connectionAlertRecipients: [],
    weekStartsOn: "segunda",
    notes:
      professionalProfile?.planningCadence ??
      "Rodar verificacoes diarias, consolidar resumo semanal e escalar bloqueios para a central de aprovacoes.",
    updatedAt: new Date().toISOString()
  };
}

export function parseSchedulerProfileForm(formData: FormData, current: CompanySchedulerProfile) {
  return {
    ...current,
    status: "customized" as const,
    timezone: String(formData.get("timezone") ?? current.timezone),
    quietHours: String(formData.get("quietHours") ?? current.quietHours),
    approvalDigestTime: String(formData.get("approvalDigestTime") ?? current.approvalDigestTime),
    incidentWatch: String(formData.get("incidentWatch") ?? current.incidentWatch),
    schedulerAlertMinimumPriority: String(
      formData.get("schedulerAlertMinimumPriority") ?? current.schedulerAlertMinimumPriority
    ) as CompanySchedulerProfile["schedulerAlertMinimumPriority"],
    emailAlertMinimumPriority: String(
      formData.get("emailAlertMinimumPriority") ?? current.emailAlertMinimumPriority
    ) as CompanySchedulerProfile["emailAlertMinimumPriority"],
    alertRecipients: parseEmailRecipients(String(formData.get("alertRecipients") ?? current.alertRecipients.join("\n"))),
    financeAlertRecipients: parseEmailRecipients(
      String(formData.get("financeAlertRecipients") ?? current.financeAlertRecipients.join("\n"))
    ),
    runtimeAlertRecipients: parseEmailRecipients(
      String(formData.get("runtimeAlertRecipients") ?? current.runtimeAlertRecipients.join("\n"))
    ),
    strategyAlertRecipients: parseEmailRecipients(
      String(formData.get("strategyAlertRecipients") ?? current.strategyAlertRecipients.join("\n"))
    ),
    approvalAlertRecipients: parseEmailRecipients(
      String(formData.get("approvalAlertRecipients") ?? current.approvalAlertRecipients.join("\n"))
    ),
    connectionAlertRecipients: parseEmailRecipients(
      String(formData.get("connectionAlertRecipients") ?? current.connectionAlertRecipients.join("\n"))
    ),
    weekStartsOn: String(formData.get("weekStartsOn") ?? current.weekStartsOn),
    notes: String(formData.get("notes") ?? current.notes),
    updatedAt: new Date().toISOString()
  };
}

export function getCompanySchedulerJobs(
  company: CompanyProfile,
  professionalProfile?: UserProfessionalProfile | null
) {
  const stored = getStoredCompanySchedulerJobs(company.slug);
  const defaults = getDefaultSchedulerJobs(company, professionalProfile);

  return defaults
    .map((job) => mergeSchedulerJob(job, stored.find((entry) => entry.id === job.id)))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function parseSchedulerJobForm(formData: FormData, current: CompanySchedulerJob) {
  const nextCadence = String(formData.get("cadence") ?? current.cadence) as CompanySchedulerJob["cadence"];

  return {
    ...current,
    status: String(formData.get("status") ?? current.status) as CompanySchedulerJob["status"],
    cadence: nextCadence,
    autonomy: String(formData.get("autonomy") ?? current.autonomy) as CompanySchedulerJob["autonomy"],
    objective: String(formData.get("objective") ?? current.objective),
    actionSummary: String(formData.get("actionSummary") ?? current.actionSummary),
    nextRunAt: normalizeNextRun(String(formData.get("nextRunAt") ?? current.nextRunAt), nextCadence)
  };
}

export function runSchedulerJob(job: CompanySchedulerJob, lastResult?: string) {
  const now = new Date();
  return {
    ...job,
    lastRunAt: now.toISOString(),
    nextRunAt: computeNextRun(now, job.cadence).toISOString(),
    lastResult: lastResult ?? buildRunResult(job, now)
  };
}

function getDefaultSchedulerJobs(company: CompanyProfile, professionalProfile?: UserProfessionalProfile | null) {
  const now = new Date();

  return [
    buildJob(company, {
      slug: "approval-digest",
      label: "Digest diario de aprovacoes",
      category: "approvals",
      cadence: "daily",
      autonomy: "approval_required",
      objective: "Consolidar itens pendentes e disparar a rotina de aprovacao do dia.",
      actionSummary: "Ler payment requests, publicacoes, social posts e anuncios pendentes e abrir a central de aprovacao."
    }, now),
    buildJob(company, {
      slug: "competitor-radar",
      label: "Radar diario de concorrentes",
      category: "social",
      cadence: "daily",
      autonomy: "advisory",
      objective: "Atualizar sinais competitivos e oportunidades por plataforma.",
      actionSummary: "Comparar concorrentes, revisar watchlists e registrar aprendizados no relatorio diario."
    }, now),
    buildJob(company, {
      slug: "social-sync",
      label: "Sync de social analytics",
      category: "social",
      cadence: "business_days",
      autonomy: "auto_low_risk",
      objective: "Sincronizar estatisticas sociais, alcance, engajamento e cliques.",
      actionSummary: "Executar a fila operacional de sync nas plataformas prontas para analytics."
    }, now),
    buildJob(company, {
      slug: "google-data-sync",
      label: "Sync real de Google data ops",
      category: "reporting",
      cadence: "daily",
      autonomy: "auto_low_risk",
      objective: "Sincronizar GA4, Search Console e consolidado operacional em Sheets.",
      actionSummary: "Ler propriedades Google conectadas da empresa, persistir snapshots reais e escrever o resumo executivo no Sheets aprovado."
    }, now),
    buildJob(company, {
      slug: "social-publish",
      label: "Publicacao social programada",
      category: "social",
      cadence: "hourly",
      autonomy: "auto_low_risk",
      objective: "Consumir posts aprovados e vencidos na agenda social com publish auditavel.",
      actionSummary: "Criar ou consumir tarefas da runtime e publicar automaticamente posts ja aprovados no horario."
    }, now),
    buildJob(company, {
      slug: "runtime-drain",
      label: "Drain da runtime social",
      category: "social",
      cadence: "hourly",
      autonomy: "auto_low_risk",
      objective: "Consumir a fila operacional ja enfileirada e registrar os resultados da runtime.",
      actionSummary: "Executar em lote as tarefas queued da runtime social, preservando logs, bloqueios e falhas auditaveis."
    }, now),
    buildJob(company, {
      slug: "execution-pulse",
      label: "Pulso operacional do Agent Lion",
      category: "operations",
      cadence: "daily",
      autonomy: "auto_low_risk",
      objective: "Rodar o ciclo autonomo oficial do Agent Lion e transformar sinais reais em prioridades, execucao governada e aprendizado.",
      actionSummary:
        "Executar contexto -> diagnostico -> tese do CMO -> decisao -> policy -> execucao low-risk -> aprendizado, e depois salvar o plano executivo derivado do ciclo."
    }, now),
    buildJob(company, {
      slug: "agent-runtime-drain",
      label: "Drain da fila oficial do Agent Lion",
      category: "operations",
      cadence: "hourly",
      autonomy: "auto_low_risk",
      objective: "Consumir a fila oficial do ciclo autonomo com retries, locks e rastreabilidade.",
      actionSummary:
        "Drenar a fila oficial do Agent Lion, processando ciclos enfileirados fora do request que os originou."
    }, now),
    buildJob(company, {
      slug: "learning-pulse",
      label: "Learning loop do Agent Lion",
      category: "operations",
      cadence: "daily",
      autonomy: "auto_low_risk",
      objective: "Consolidar memoria reutilizavel a partir de planos, alertas, runtime, relatorios e sinais sociais.",
      actionSummary:
        "Transformar execucoes, bloqueios, oportunidades e sinais vivos em playbooks, riscos e aprendizados persistentes para o proximo ciclo."
    }, now),
    buildJob(company, {
      slug: "weekly-report",
      label: "Relatorio semanal de marketing",
      category: "reporting",
      cadence: "weekly",
      autonomy: "advisory",
      objective: "Fechar a semana com relatorio executivo e proximos testes.",
      actionSummary: "Consolidar GA4, social, search, ads e runtime para produzir o resumo semanal."
    }, now),
    buildJob(company, {
      slug: "ads-health",
      label: "Check diario de saude de campanhas",
      category: "ads",
      cadence: "daily",
      autonomy: "auto_low_risk",
      objective: "Detectar spikes de CPA, queda de CTR e contas com risco.",
      actionSummary: "Rodar health checks, abrir alertas e preparar fila de excecoes para aprovacao."
    }, now),
    buildJob(company, {
      slug: "crm-follow-up",
      label: "Cadencia de leads e follow-up",
      category: "crm",
      cadence: professionalProfile?.planningCadence?.includes("semanal") ? "daily" : "business_days",
      autonomy: "approval_required",
      objective: "Garantir que leads e contatos recebam o proximo passo correto.",
      actionSummary: "Avaliar leads pendentes, priorizar respostas e preparar follow-ups com escopo minimo."
    }, now),
    buildJob(company, {
      slug: "seo-watch",
      label: "Watch diario de SEO e Search Console",
      category: "seo",
      cadence: "daily",
      autonomy: "advisory",
      objective: "Detectar quedas de CTR, paginas em alerta e oportunidades organicas.",
      actionSummary: "Checar Search Console, sitemap, backlog tecnico e abrir tarefas para o agente."
    }, now)
  ];
}

function buildJob(
  company: CompanyProfile,
  input: {
    slug: string;
    label: string;
    category: CompanySchedulerJob["category"];
    cadence: CompanySchedulerJob["cadence"];
    autonomy: CompanySchedulerJob["autonomy"];
    objective: string;
    actionSummary: string;
  },
  seed: Date
): CompanySchedulerJob {
  return {
    id: `scheduler-${company.slug}-${input.slug}`,
    companySlug: company.slug,
    label: input.label,
    category: input.category,
    cadence: input.cadence,
    status: "active",
    autonomy: input.autonomy,
    objective: input.objective,
    actionSummary: input.actionSummary,
    nextRunAt: computeNextRun(seed, input.cadence).toISOString()
  };
}

function computeNextRun(seed: Date, cadence: SchedulerCadence) {
  const next = new Date(seed);

  if (cadence === "hourly") {
    next.setHours(next.getHours() + 1, 0, 0, 0);
    return next;
  }

  next.setHours(9, 0, 0, 0);

  if (cadence === "daily") {
    next.setDate(next.getDate() + 1);
    return next;
  }

  if (cadence === "weekly") {
    next.setDate(next.getDate() + 7);
    return next;
  }

  next.setDate(next.getDate() + 1);
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

function normalizeNextRun(value: string, cadence: SchedulerCadence) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return computeNextRun(new Date(), cadence).toISOString();
  }

  return parsed.toISOString();
}

function parseEmailRecipients(value: string) {
  return value
    .split(/[\n,;]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry, index, entries) => Boolean(entry) && entries.indexOf(entry) === index);
}

function mergeSchedulerJob(defaultJob: CompanySchedulerJob, storedJob?: CompanySchedulerJob) {
  if (!storedJob) {
    return defaultJob;
  }

  const merged = { ...defaultJob, ...storedJob };

  if (defaultJob.id.endsWith("execution-pulse") && isLegacyExecutionPulseJob(storedJob)) {
    return {
      ...merged,
      autonomy: defaultJob.autonomy,
      objective: defaultJob.objective,
      actionSummary: defaultJob.actionSummary
    };
  }

  return merged;
}

function isLegacyExecutionPulseJob(job: CompanySchedulerJob) {
  return (
    job.autonomy === "advisory" &&
    job.objective === "Gerar um plano operacional priorizado a partir dos sinais reais do workspace." &&
    job.actionSummary ===
      "Ler approvals, conexoes, runtime, social insights, snapshots e relatorios para salvar a proxima rodada de foco operacional."
  );
}

function buildRunResult(job: CompanySchedulerJob, executedAt: Date) {
  const timestamp = executedAt.toLocaleString("pt-BR");

  switch (job.category) {
    case "approvals":
      return `Digest de aprovacoes consolidado em ${timestamp}.`;
    case "social":
      return `Rotina social processada em ${timestamp} com foco em fila operacional e analytics.`;
    case "reporting":
      return `Resumo executivo atualizado em ${timestamp}.`;
    case "ads":
      return `Health check de campanhas executado em ${timestamp}.`;
    case "crm":
      return `Cadencia de leads revisada em ${timestamp}.`;
    case "operations":
      return `Pulso operacional recalculado em ${timestamp}.`;
    default:
      return `Watch de SEO executado em ${timestamp}.`;
  }
}
