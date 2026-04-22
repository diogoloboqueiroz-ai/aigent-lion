import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getCompanyWorkspace } from "@/lib/connectors";
import {
  getExecutionTrackPriorityLabel,
  getOperationalAlertChannelLabel,
  getOperationalAlertStatusLabel
} from "@/lib/execution";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

type PageProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ saved?: string }>;
};

export default async function CompanySchedulerPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);
  const professionalProfile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(companyId, professionalProfile);

  if (!workspace) {
    notFound();
  }

  const openOperationalAlerts = workspace.operationalAlerts.filter((alert) => alert.status !== "resolved");
  const criticalOperationalAlerts = openOperationalAlerts.filter((alert) => alert.priority === "critical");
  const priorityOptions = [
    { value: "critical", label: "critica" },
    { value: "high", label: "alta" },
    { value: "medium", label: "media" },
    { value: "low", label: "baixa" }
  ];

  return (
    <main style={{ padding: "32px 0 80px" }}>
      <div className="shell" style={{ display: "grid", gap: 24 }}>
        <section className="glass" style={{ padding: 28, borderRadius: 28, display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href={`/empresas/${workspace.company.slug}`} className="tag">
              Voltar para o workspace
            </Link>
            <Link href={`/empresas/${workspace.company.slug}/aprovacoes`} className="tag">
              Approval Center
            </Link>
          </div>
          <p className="eyebrow">Scheduler do Agent Lion</p>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 1.6rem + 1.5vw, 3.2rem)" }}>{workspace.company.name}</h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7, maxWidth: 940 }}>
            O scheduler define quando o Agent Lion roda verificacoes, relatórios, syncs sociais, checks de campanhas, follow-up e a digest de aprovacoes de cada empresa.
          </p>
          {query.saved ? <span className="tag">Atualizacao registrada: {query.saved}</span> : null}
        </section>

        <section style={{ display: "grid", gap: 20, gridTemplateColumns: "0.9fr 1.1fr" }}>
          <form
            action={`/api/companies/${workspace.company.slug}/scheduler`}
            method="post"
            className="glass"
            style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}
          >
            <input type="hidden" name="intent" value="save-profile" />
            <h2 className="section-title">Perfil do scheduler</h2>
            <Field label="Timezone" name="timezone" defaultValue={workspace.schedulerProfile.timezone} />
            <Field label="Quiet hours" name="quietHours" defaultValue={workspace.schedulerProfile.quietHours} />
            <Field label="Horario do digest de aprovacoes" name="approvalDigestTime" defaultValue={workspace.schedulerProfile.approvalDigestTime} />
            <Field label="Inicio da semana" name="weekStartsOn" defaultValue={workspace.schedulerProfile.weekStartsOn} />
            <TextAreaField label="Watch de incidentes" name="incidentWatch" defaultValue={workspace.schedulerProfile.incidentWatch} />
            <SelectField
              label="Abrir alerta no scheduler a partir de"
              name="schedulerAlertMinimumPriority"
              defaultValue={workspace.schedulerProfile.schedulerAlertMinimumPriority}
              options={priorityOptions}
            />
            <SelectField
              label="Mandar email a partir de"
              name="emailAlertMinimumPriority"
              defaultValue={workspace.schedulerProfile.emailAlertMinimumPriority}
              options={priorityOptions}
            />
            <TextAreaField
              label="Destinatarios padrao"
              name="alertRecipients"
              defaultValue={workspace.schedulerProfile.alertRecipients.join("\n")}
            />
            <TextAreaField
              label="Financeiro"
              name="financeAlertRecipients"
              defaultValue={workspace.schedulerProfile.financeAlertRecipients.join("\n")}
            />
            <TextAreaField
              label="Runtime social"
              name="runtimeAlertRecipients"
              defaultValue={workspace.schedulerProfile.runtimeAlertRecipients.join("\n")}
            />
            <TextAreaField
              label="Estrategia"
              name="strategyAlertRecipients"
              defaultValue={workspace.schedulerProfile.strategyAlertRecipients.join("\n")}
            />
            <TextAreaField
              label="Aprovacoes"
              name="approvalAlertRecipients"
              defaultValue={workspace.schedulerProfile.approvalAlertRecipients.join("\n")}
            />
            <TextAreaField
              label="Conexoes"
              name="connectionAlertRecipients"
              defaultValue={workspace.schedulerProfile.connectionAlertRecipients.join("\n")}
            />
            <TextAreaField label="Notas de operacao" name="notes" defaultValue={workspace.schedulerProfile.notes} />
            <span className="muted" style={{ lineHeight: 1.6 }}>
              Use um email por linha ou separe por virgula. Se a rota especifica estiver vazia, o Agent Lion cai nos destinatarios padrao e depois no operador atual. O email nunca desce abaixo do piso de alerta configurado para o scheduler.
            </span>
            <button
              type="submit"
              className="tag"
              style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
              disabled={!session}
            >
              Salvar scheduler
            </button>
          </form>

          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
            <h2 className="section-title">Resumo das rotinas</h2>
            <div className="grid-auto" style={{ gap: 12 }}>
              <InfoCard label="Jobs ativos" value={String(workspace.schedulerJobs.filter((job) => job.status === "active").length)} />
              <InfoCard label="Jobs pausados" value={String(workspace.schedulerJobs.filter((job) => job.status === "paused").length)} />
              <InfoCard label="Aprovacoes pendentes" value={String(workspace.approvalsCenter.filter((item) => item.actions.length > 0).length)} />
              <InfoCard label="Fila social ativa" value={String(workspace.socialRuntime.queuedTasks)} />
              <InfoCard label="Planos operacionais" value={String(workspace.executionPlans.length)} />
              <InfoCard label="Alertas criticos" value={String(criticalOperationalAlerts.length)} />
              <InfoCard
                label="Piso scheduler"
                value={getExecutionTrackPriorityLabel(workspace.schedulerProfile.schedulerAlertMinimumPriority)}
              />
              <InfoCard
                label="Piso email"
                value={getExecutionTrackPriorityLabel(workspace.schedulerProfile.emailAlertMinimumPriority)}
              />
              <InfoCard label="Padrao" value={String(workspace.schedulerProfile.alertRecipients.length || 1)} />
              <InfoCard label="Financeiro" value={String(workspace.schedulerProfile.financeAlertRecipients.length)} />
              <InfoCard label="Runtime" value={String(workspace.schedulerProfile.runtimeAlertRecipients.length)} />
              <InfoCard label="Estrategia" value={String(workspace.schedulerProfile.strategyAlertRecipients.length)} />
            </div>
            <p style={{ margin: 0, lineHeight: 1.65 }}>
              O scheduler conversa com a central de aprovacoes, a runtime social, os relatorios e o restante da operacao. O objetivo aqui e evitar que o Agent Lion dependa de execucao manual para as rotinas repetitivas.
            </p>
          </article>
        </section>

        <section className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <h2 className="section-title">Alertas operacionais</h2>
            <span className="tag">abertos: {openOperationalAlerts.length}</span>
          </div>
          <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
            Quando o pulso operacional encontra um item na severidade configurada para o scheduler, ele abre um alerta persistente aqui. Voce pode reconhecer o alerta para tirar o ruido ou resolver quando o problema sair de cena.
          </p>
          {workspace.operationalAlerts.length === 0 ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
              Nenhum alerta operacional registrado ainda. O proximo pulso critico do Agent Lion vai aparecer aqui.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {workspace.operationalAlerts.map((alert) => (
                <article key={alert.id} style={jobCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <strong>{alert.title}</strong>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className="tag">{getExecutionTrackPriorityLabel(alert.priority)}</span>
                      <span className="tag">{getOperationalAlertStatusLabel(alert.status)}</span>
                    </div>
                  </div>
                  <p style={{ margin: 0, lineHeight: 1.65 }}>{alert.message}</p>
                  <span className="muted">
                    Aberto em {new Date(alert.createdAt).toLocaleString("pt-BR")} · ultima atualizacao{" "}
                    {new Date(alert.updatedAt).toLocaleString("pt-BR")}
                  </span>
                  {alert.evidence?.length ? (
                    <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                      {alert.evidence.map((entry) => (
                        <li key={entry}>{entry}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {alert.channels.map((channel) => (
                      <span key={channel} className="tag">
                        {getOperationalAlertChannelLabel(channel)}
                      </span>
                    ))}
                    {alert.channels.includes("email_ready") ? (
                      <span className="tag">
                        {alert.emailSentAt
                          ? "email enviado"
                          : alert.emailLastError
                            ? "email falhou"
                            : "email pendente"}
                      </span>
                    ) : null}
                  </div>
                  {alert.emailSentAt ? (
                    <span className="muted">
                      Email enviado para {(alert.emailDeliveredTo ?? (alert.emailRecipient ? [alert.emailRecipient] : ["o operador"])).join(", ")} em{" "}
                      {new Date(alert.emailSentAt).toLocaleString("pt-BR")}.
                    </span>
                  ) : null}
                  {alert.emailLastError ? (
                    <span className="muted">
                      Ultima falha de email: {alert.emailLastError}
                    </span>
                  ) : null}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {alert.status === "open" ? (
                      <form action={`/api/companies/${workspace.company.slug}/scheduler`} method="post">
                        <input type="hidden" name="intent" value="ack-alert" />
                        <input type="hidden" name="alertId" value={alert.id} />
                        <button
                          type="submit"
                          className="tag"
                          style={{ border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
                          disabled={!session}
                        >
                          Reconhecer alerta
                        </button>
                      </form>
                    ) : null}
                    {alert.status !== "resolved" ? (
                      <form action={`/api/companies/${workspace.company.slug}/scheduler`} method="post">
                        <input type="hidden" name="intent" value="resolve-alert" />
                        <input type="hidden" name="alertId" value={alert.id} />
                        <button
                          type="submit"
                          className="tag"
                          style={{ border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
                          disabled={!session}
                        >
                          Marcar resolvido
                        </button>
                      </form>
                    ) : null}
                    <Link href={alert.sourcePath} className="tag">
                      {alert.sourceLabel}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 18 }}>
          <h2 className="section-title">Jobs recorrentes</h2>
          <div style={{ display: "grid", gap: 16 }}>
            {workspace.schedulerJobs.map((job) => (
              <article key={job.id} style={jobCardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <strong>{job.label}</strong>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className="tag">{job.category}</span>
                    <span className="tag">{job.status}</span>
                    <span className="tag">{job.cadence}</span>
                  </div>
                </div>
                <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>{job.objective}</p>
                <p style={{ margin: 0, lineHeight: 1.65 }}>{job.actionSummary}</p>
                <div className="grid-auto" style={{ gap: 12 }}>
                  <InfoCard label="Autonomia" value={job.autonomy} />
                  <InfoCard label="Proxima execucao" value={new Date(job.nextRunAt).toLocaleString("pt-BR")} />
                  <InfoCard label="Ultima execucao" value={job.lastRunAt ? new Date(job.lastRunAt).toLocaleString("pt-BR") : "Ainda nao rodou"} />
                </div>
                {job.lastResult ? (
                  <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                    Ultimo resultado: {job.lastResult}
                  </p>
                ) : null}
                <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(0, 1fr) auto" }}>
                  <form
                    action={`/api/companies/${workspace.company.slug}/scheduler`}
                    method="post"
                    style={{ display: "grid", gap: 14 }}
                  >
                    <input type="hidden" name="intent" value="save-job" />
                    <input type="hidden" name="jobId" value={job.id} />
                    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr 1fr" }}>
                      <SelectField
                        label="Status"
                        name="status"
                        defaultValue={job.status}
                        options={["active", "paused"]}
                      />
                      <SelectField
                        label="Cadencia"
                        name="cadence"
                        defaultValue={job.cadence}
                        options={["hourly", "daily", "weekly", "business_days"]}
                      />
                      <SelectField
                        label="Autonomia"
                        name="autonomy"
                        defaultValue={job.autonomy}
                        options={["advisory", "auto_low_risk", "approval_required"]}
                      />
                    </div>
                    <Field label="Objetivo" name="objective" defaultValue={job.objective} />
                    <TextAreaField label="Acao operacional" name="actionSummary" defaultValue={job.actionSummary} />
                    <Field label="Proxima execucao (ISO)" name="nextRunAt" defaultValue={job.nextRunAt} />
                    <button
                      type="submit"
                      className="tag"
                      style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
                      disabled={!session}
                    >
                      Salvar job
                    </button>
                  </form>
                  <form action={`/api/companies/${workspace.company.slug}/scheduler`} method="post" style={{ alignSelf: "end" }}>
                    <input type="hidden" name="intent" value="run-job" />
                    <input type="hidden" name="jobId" value={job.id} />
                    <button
                      type="submit"
                      className="tag"
                      style={{ border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
                      disabled={!session}
                    >
                      Rodar agora
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span>{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        style={inputStyle}
      />
    </label>
  );
}

function TextAreaField({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span>{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={3}
        style={{ ...inputStyle, resize: "vertical" }}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<string | { value: string; label: string }>;
}) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span>{label}</span>
      <select name={name} defaultValue={defaultValue} style={inputStyle}>
        {options.map((option) => (
          <option key={typeof option === "string" ? option : option.value} value={typeof option === "string" ? option : option.value}>
            {typeof option === "string" ? option : option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="glass" style={{ padding: 18, borderRadius: 18, display: "grid", gap: 8 }}>
      <span className="muted" style={{ fontSize: 14 }}>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

const inputStyle = {
  borderRadius: 14,
  border: "1px solid rgba(148, 196, 208, 0.16)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  padding: "12px 14px"
} as const;

const jobCardStyle = {
  padding: 18,
  borderRadius: 18,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(148, 196, 208, 0.1)",
  display: "grid",
  gap: 12
} as const;
