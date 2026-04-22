import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getCompanyWorkspace } from "@/lib/connectors";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

type PageProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ saved?: string; queued?: string; executed?: string; decision?: string; task?: string }>;
};

export default async function CompanySocialRuntimePage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);
  const professionalProfile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(companyId, professionalProfile);

  if (!workspace) {
    notFound();
  }

  const scheduledPosts = workspace.scheduledPosts.filter((post) => post.status === "scheduled");
  const approvedAds = workspace.socialAdDrafts.filter((draft) => draft.status === "approved");

  return (
    <main style={{ padding: "32px 0 80px" }}>
      <div className="shell" style={{ display: "grid", gap: 24 }}>
        <section className="glass" style={{ padding: 28, borderRadius: 28, display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href={`/empresas/${workspace.company.slug}/social`} className="tag">
              Voltar para social ops
            </Link>
            <Link href={`/empresas/${workspace.company.slug}`} className="tag">
              Voltar para o workspace
            </Link>
          </div>
          <p className="eyebrow">Runtime social ao vivo</p>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 1.6rem + 1.5vw, 3.2rem)" }}>{workspace.company.name}</h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7, maxWidth: 980 }}>
            Essa camada transforma as conexoes em operacao auditavel: cada plataforma recebe um alvo operacional, a fila de publicacao ganha execucao real onde ja existe suporte seguro e a sincronizacao de estatisticas passa a salvar historico no workspace.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {query.saved ? <span className="tag">Binding salvo</span> : null}
            {query.queued ? <span className="tag">{buildQueuedMessage(query.queued)}</span> : null}
            {query.executed ? <span className="tag">{buildExecutedMessage(query.executed)}</span> : null}
            {query.decision ? <span className="tag">Runtime atualizada: {query.decision}</span> : null}
            {query.task ? <span className="tag">Tarefa: {query.task}</span> : null}
          </div>
        </section>

        <section className="grid-auto">
          <MetricCard label="Plataformas conectadas" value={String(workspace.socialRuntime.connectedPlatforms)} />
          <MetricCard label="Prontas para publicar" value={String(workspace.socialRuntime.publishReadyPlatforms)} />
          <MetricCard label="Prontas para analytics" value={String(workspace.socialRuntime.analyticsReadyPlatforms)} />
          <MetricCard label="Prontas para ads" value={String(workspace.socialRuntime.adLaunchReadyPlatforms)} />
          <MetricCard label="Fila ativa" value={String(workspace.socialRuntime.queuedTasks)} />
          <MetricCard label="Em execucao" value={String(workspace.socialRuntime.runningTasks)} />
          <MetricCard label="Bloqueios" value={String(workspace.socialRuntime.blockedTasks)} />
          <MetricCard label="Falhas" value={String(workspace.socialRuntime.failedTasks)} />
          <MetricCard label="Concluidas" value={String(workspace.socialRuntime.completedTasks)} />
        </section>

        <section className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 10 }}>
          <h2 className="section-title">Proxima prioridade</h2>
          <p style={{ margin: 0, lineHeight: 1.7 }}>{workspace.socialRuntime.nextPriority}</p>
        </section>

        <section className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
          <h2 className="section-title">Acoes em lote</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            Use a runtime para preparar a fila inteira de uma vez, sem enviar posts, anuncios e syncs manualmente item por item.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <BatchAction companySlug={workspace.company.slug} intent="execute-queued" label="Executar tudo que esta enfileirado" sessionReady={Boolean(session)} />
            <BatchAction companySlug={workspace.company.slug} intent="queue-ready-all" label="Enfileirar tudo que esta pronto" sessionReady={Boolean(session)} />
            <BatchAction companySlug={workspace.company.slug} intent="queue-ready-posts" label="Todos os posts prontos" sessionReady={Boolean(session)} />
            <BatchAction companySlug={workspace.company.slug} intent="queue-ready-ads" label="Todos os anuncios aprovados" sessionReady={Boolean(session)} />
            <BatchAction companySlug={workspace.company.slug} intent="queue-ready-syncs" label="Todos os syncs prontos" sessionReady={Boolean(session)} />
          </div>
        </section>

        <section style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <p className="eyebrow">Bindings</p>
            <h2 className="section-title">Alvos operacionais por plataforma</h2>
          </div>
          <div style={{ display: "grid", gap: 16 }}>
            {workspace.socialBindings.map((binding) => (
              <article key={binding.id} className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <strong>{binding.platform}</strong>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className="tag">{binding.status}</span>
                    <span className="tag">publish {binding.publishingReady ? "ready" : "blocked"}</span>
                    <span className="tag">analytics {binding.analyticsReady ? "ready" : "blocked"}</span>
                    <span className="tag">ads {binding.paidMediaReady ? "ready" : "blocked"}</span>
                  </div>
                </div>
                <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>{binding.note}</p>
                <div style={{ display: "grid", gap: 8 }}>
                  {binding.requirements.map((requirement) => (
                    <span key={requirement}>- {requirement}</span>
                  ))}
                </div>
                <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(0, 1fr) auto" }}>
                  <form
                    action={`/api/companies/${workspace.company.slug}/social/runtime`}
                    method="post"
                    style={{ display: "grid", gap: 14 }}
                  >
                    <input type="hidden" name="intent" value="save-binding" />
                    <input type="hidden" name="platform" value={binding.platform} />
                    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
                      <Field label="Nome do alvo" name="targetLabel" defaultValue={binding.targetLabel} />
                      <Field label={`ID de ${binding.targetType}`} name="targetId" defaultValue={binding.targetId ?? ""} />
                    </div>
                    <Field label="ID analitico" name="analyticsTargetId" defaultValue={binding.analyticsTargetId ?? ""} />
                    {binding.platform === "facebook" || binding.platform === "instagram" ? (
                      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
                        <Field label="Ad account ID" name="adAccountId" defaultValue={binding.adAccountId ?? ""} />
                        <Field label="Page ID para ads" name="pageId" defaultValue={binding.pageId ?? ""} />
                      </div>
                    ) : null}
                    {binding.platform === "instagram" ? (
                      <Field label="Instagram actor ID" name="instagramActorId" defaultValue={binding.instagramActorId ?? ""} />
                    ) : null}
                    {binding.platform === "google-ads" ? (
                      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
                        <Field label="Manager customer ID" name="managerAccountId" defaultValue={binding.managerAccountId ?? ""} />
                        <Field label="Nome base da campanha" name="campaignLabel" defaultValue={binding.campaignLabel ?? ""} />
                      </div>
                    ) : null}
                    {binding.platform === "google-ads" ? (
                      <Field label="Ad group existente (opcional)" name="adGroupId" defaultValue={binding.adGroupId ?? ""} />
                    ) : null}
                    {binding.platform === "google-ads" || binding.platform === "facebook" || binding.platform === "instagram" ? (
                      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
                        <Field label="Campaign ID existente (opcional)" name="campaignId" defaultValue={binding.campaignId ?? ""} />
                        <Field label="Cap diario opcional" name="dailyBudgetCap" defaultValue={binding.dailyBudgetCap ?? ""} />
                      </div>
                    ) : null}
                    {binding.platform === "facebook" || binding.platform === "instagram" ? (
                      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
                        <Field label="Pixel ID" name="pixelId" defaultValue={binding.pixelId ?? ""} />
                        <Field label="Evento de conversao" name="conversionEvent" defaultValue={binding.conversionEvent ?? ""} />
                      </div>
                    ) : null}
                    <TextAreaField label="Notas operacionais" name="note" defaultValue={binding.note} />
                    <button
                      type="submit"
                      className="tag"
                      style={{ border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6, width: "fit-content" }}
                      disabled={!session}
                    >
                      Salvar binding
                    </button>
                  </form>
                  <form action={`/api/companies/${workspace.company.slug}/social/runtime`} method="post" style={{ alignSelf: "end" }}>
                    <input type="hidden" name="intent" value="queue-sync" />
                    <input type="hidden" name="platform" value={binding.platform} />
                    <button
                      type="submit"
                      className="tag"
                      style={{ border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
                      disabled={!session}
                    >
                      Enfileirar sync
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr 1fr" }}>
          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
            <h2 className="section-title">Posts prontos para fila</h2>
            {scheduledPosts.length === 0 ? (
              <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
                Nenhum post aprovado e agendado pronto para runtime.
              </p>
            ) : (
              scheduledPosts.map((post) => (
                <article key={post.id} style={queueCardStyle}>
                  <strong>{post.title}</strong>
                  <span className="muted">
                    {post.platform} · {new Date(post.scheduledFor).toLocaleString("pt-BR")}
                  </span>
                  <p style={{ margin: 0, lineHeight: 1.6 }}>{post.summary}</p>
                  <form action={`/api/companies/${workspace.company.slug}/social/runtime`} method="post">
                    <input type="hidden" name="intent" value="queue-post" />
                    <input type="hidden" name="itemId" value={post.id} />
                    <button
                      type="submit"
                      className="tag"
                      style={{ border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
                      disabled={!session}
                    >
                      Enviar para runtime
                    </button>
                  </form>
                </article>
              ))
            )}
          </article>

          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
            <h2 className="section-title">Anuncios prontos para fila</h2>
            {approvedAds.length === 0 ? (
              <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
                Nenhum anuncio aprovado pronto para runtime.
              </p>
            ) : (
              approvedAds.map((draft) => (
                <article key={draft.id} style={queueCardStyle}>
                  <strong>{draft.title}</strong>
                  <span className="muted">
                    {draft.platform} · {draft.budget}
                  </span>
                  <p style={{ margin: 0, lineHeight: 1.6 }}>
                    Objetivo: {draft.objective}. Publico: {draft.audience}.
                  </p>
                  <form action={`/api/companies/${workspace.company.slug}/social/runtime`} method="post">
                    <input type="hidden" name="intent" value="queue-ad" />
                    <input type="hidden" name="itemId" value={draft.id} />
                    <button
                      type="submit"
                      className="tag"
                      style={{ border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
                      disabled={!session}
                    >
                      Enviar para runtime
                    </button>
                  </form>
                </article>
              ))
            )}
          </article>
        </section>

        <section className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 18 }}>
          <h2 className="section-title">Fila operacional</h2>
          {workspace.socialRuntimeTasks.length === 0 ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
              Nenhuma tarefa operacional ainda. Salve os bindings e envie posts, anuncios ou syncs para a runtime queue.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {workspace.socialRuntimeTasks.map((task) => (
                <article key={task.id} style={queueCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <strong>{task.title}</strong>
                    <span className="tag">{task.status}</span>
                  </div>
                  <span className="muted">
                    {task.platform} · {task.kind} · {new Date(task.createdAt).toLocaleString("pt-BR")}
                  </span>
                  {task.sourceExperimentId ? (
                    <span className="tag" style={{ width: "fit-content" }}>
                      Experimento: {task.sourceExperimentId}
                    </span>
                  ) : null}
                  {task.variantLabel ? (
                    <span className="tag" style={{ width: "fit-content" }}>
                      Variante: {task.variantLabel}
                    </span>
                  ) : null}
                  <p style={{ margin: 0, lineHeight: 1.6 }}>{task.reason}</p>
                  {task.lastResult ? (
                    <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
                      Ultimo resultado: {task.lastResult}
                    </p>
                  ) : null}
                  {task.status !== "completed" && task.status !== "running" ? (
                    <form action={`/api/companies/${workspace.company.slug}/social/runtime/${task.id}`} method="post">
                      <button
                        type="submit"
                        className="tag"
                        style={{ border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
                        disabled={!session}
                      >
                        {task.status === "failed" || task.status === "blocked" ? "Tentar novamente" : "Executar agora"}
                      </button>
                    </form>
                  ) : task.status === "running" ? <span className="tag">Executando...</span> : null}
                  {task.externalRef ? (
                    <span className="muted">Referencia externa: {task.externalRef}</span>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 18 }}>
          <h2 className="section-title">Historico de execucao</h2>
          {workspace.socialExecutionLogs.length === 0 ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
              Ainda nao ha execucoes registradas. Rode a fila ou use o scheduler para começar a trilha operacional.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {workspace.socialExecutionLogs.slice(0, 12).map((log) => (
                <article key={log.id} style={queueCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <strong>{log.summary}</strong>
                    <span className="tag">{log.status}</span>
                  </div>
                  <span className="muted">
                    {log.platform} Â· {log.kind} Â· {new Date(log.finishedAt ?? log.startedAt).toLocaleString("pt-BR")}
                  </span>
                  {log.sourceExperimentId ? (
                    <span className="tag" style={{ width: "fit-content" }}>
                      Experimento: {log.sourceExperimentId}
                    </span>
                  ) : null}
                  {log.variantLabel ? (
                    <span className="tag" style={{ width: "fit-content" }}>
                      Variante: {log.variantLabel}
                    </span>
                  ) : null}
                  <p style={{ margin: 0, lineHeight: 1.6 }}>{log.detail}</p>
                  {log.metrics.length > 0 ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {log.metrics.map((metric) => (
                        <span key={`${log.id}-${metric.label}`} className="tag">
                          {metric.label}: {metric.value}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {log.externalRef ? <span className="muted">Referencia externa: {log.externalRef}</span> : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="glass" style={{ padding: 18, borderRadius: 18, display: "grid", gap: 8 }}>
      <span className="muted" style={{ fontSize: 14 }}>{label}</span>
      <strong style={{ fontSize: "1.6rem" }}>{value}</strong>
    </article>
  );
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span>{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        style={{
          borderRadius: 14,
          border: "1px solid rgba(148, 196, 208, 0.16)",
          background: "rgba(255,255,255,0.04)",
          color: "inherit",
          padding: "12px 14px"
        }}
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
        style={{
          borderRadius: 14,
          border: "1px solid rgba(148, 196, 208, 0.16)",
          background: "rgba(255,255,255,0.04)",
          color: "inherit",
          padding: "12px 14px",
          resize: "vertical"
        }}
      />
    </label>
  );
}

function BatchAction({
  companySlug,
  intent,
  label,
  sessionReady
}: {
  companySlug: string;
  intent: string;
  label: string;
  sessionReady: boolean;
}) {
  return (
    <form action={`/api/companies/${companySlug}/social/runtime`} method="post">
      <input type="hidden" name="intent" value={intent} />
      <button
        type="submit"
        className="tag"
        style={{ border: "none", cursor: sessionReady ? "pointer" : "not-allowed", opacity: sessionReady ? 1 : 0.6 }}
        disabled={!sessionReady}
      >
        {label}
      </button>
    </form>
  );
}

function buildQueuedMessage(value: string) {
  if (!value.includes(":")) {
    switch (value) {
      case "post":
        return "Tarefa enfileirada: post";
      case "ad":
        return "Tarefa enfileirada: anuncio";
      case "sync":
        return "Tarefa enfileirada: sync";
      default:
        return `Tarefa enfileirada: ${value}`;
    }
  }

  const [intent, count] = value.split(":");
  switch (intent) {
    case "queue-ready-all":
      return `Fila preparada com ${count} itens prontos`;
    case "queue-ready-posts":
      return `Posts enviados para runtime: ${count}`;
    case "queue-ready-ads":
      return `Anuncios enviados para runtime: ${count}`;
    case "queue-ready-syncs":
      return `Syncs enviados para runtime: ${count}`;
    default:
      return `Tarefas enfileiradas: ${count}`;
  }
}

function buildExecutedMessage(value: string) {
  const [total, completed, blocked, failed] = value.split(":");
  return `Execucao em lote: ${completed}/${total} concluidas, ${blocked} bloqueadas e ${failed} com falha`;
}

const queueCardStyle = {
  padding: 18,
  borderRadius: 18,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(148, 196, 208, 0.1)",
  display: "grid",
  gap: 10
} as const;
