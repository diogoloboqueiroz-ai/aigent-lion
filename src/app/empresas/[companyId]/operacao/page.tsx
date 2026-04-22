import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getCompanyWorkspace } from "@/lib/connectors";
import {
  generateCompanyExecutionPlan,
  getApprovalModeLabel,
  getExecutionTrackPriorityLabel
} from "@/lib/execution";
import {
  getAgentLearningKindLabel,
  getAgentLearningStatusLabel
} from "@/lib/learning";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

type PageProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ generated?: string; applied?: string; learned?: string }>;
};

export default async function CompanyOperationPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);
  const professionalProfile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(companyId, professionalProfile);

  if (!workspace) {
    notFound();
  }

  const previewPlan = generateCompanyExecutionPlan(workspace, professionalProfile);

  return (
    <main style={{ padding: "32px 0 80px" }}>
      <div className="shell" style={{ display: "grid", gap: 24 }}>
        <section className="glass" style={{ padding: 28, borderRadius: 28, display: "grid", gap: 14 }}>
          <Link href={`/empresas/${workspace.company.slug}`} className="tag" style={{ width: "fit-content" }}>
            Voltar para o workspace
          </Link>
          <p className="eyebrow">Plano Operacional</p>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 1.6rem + 1.5vw, 3.3rem)" }}>
            {workspace.company.name}
          </h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7, maxWidth: 940 }}>
            Esse modulo transforma estrategia em execucao: campanhas, conteudo, SEO, automacoes, prioridades e aprovacoes. Ele usa o perfil da empresa junto com sua memoria profissional para orientar a operacao.
          </p>
          {query.generated ? <div className="tag" style={{ width: "fit-content" }}>Plano operacional gerado e salvo</div> : null}
          {query.applied ? <div className="tag" style={{ width: "fit-content" }}>Acoes auto low risk aplicadas</div> : null}
          {query.learned ? <div className="tag" style={{ width: "fit-content" }}>Memoria operacional atualizada</div> : null}
        </section>

        <section style={{ display: "grid", gap: 20, gridTemplateColumns: "1.05fr 0.95fr" }}>
          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <h2 className="section-title">Preview operacional</h2>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <form action={`/api/companies/${workspace.company.slug}/execution`} method="post">
                  <input type="hidden" name="intent" value="generate-plan" />
                  <button
                    type="submit"
                    className="tag"
                    style={{
                      border: "none",
                      cursor: session ? "pointer" : "not-allowed",
                      opacity: session ? 1 : 0.6
                    }}
                    disabled={!session}
                  >
                    Gerar e salvar plano
                  </button>
                </form>
                <form action={`/api/companies/${workspace.company.slug}/execution`} method="post">
                  <input type="hidden" name="intent" value="apply-auto" />
                  <button
                    type="submit"
                    className="tag"
                    style={{
                      border: "none",
                      cursor: session ? "pointer" : "not-allowed",
                      opacity: session ? 1 : 0.6
                    }}
                    disabled={!session}
                  >
                    Aplicar acoes seguras
                  </button>
                </form>
                <form action={`/api/companies/${workspace.company.slug}/execution`} method="post">
                  <input type="hidden" name="intent" value="sync-learning" />
                  <button
                    type="submit"
                    className="tag"
                    style={{
                      border: "none",
                      cursor: session ? "pointer" : "not-allowed",
                      opacity: session ? 1 : 0.6
                    }}
                    disabled={!session}
                  >
                    Atualizar memoria
                  </button>
                </form>
              </div>
            </div>
            <span className="muted">{previewPlan.summary}</span>
            {previewPlan.autopilotSummary ? (
              <div
                style={{
                  padding: 14,
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(148, 196, 208, 0.1)"
                }}
              >
                {previewPlan.autopilotSummary}
              </div>
            ) : null}
            <div className="grid-auto" style={{ gap: 12 }}>
              {previewPlan.weeklyFocus.map((focus) => (
                <InfoCard key={focus} label="Foco da semana" value={focus} />
              ))}
            </div>
            {previewPlan.decisionSignals?.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                <strong>Sinais que moveram o plano</strong>
                <div className="grid-auto" style={{ gap: 12 }}>
                  {previewPlan.decisionSignals.map((signal) => (
                    <InfoCard
                      key={`${signal.label}-${signal.value}`}
                      label={signal.label}
                      value={signal.value}
                      description={signal.context}
                    />
                  ))}
                </div>
              </div>
            ) : null}
            {previewPlan.optimizationScorecards?.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                <strong>Scorecards de otimizacao</strong>
                <div style={{ display: "grid", gap: 10 }}>
                  {previewPlan.optimizationScorecards.map((scorecard) => (
                    <article
                      key={scorecard.id}
                      style={{
                        padding: 14,
                        borderRadius: 16,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(148, 196, 208, 0.1)",
                        display: "grid",
                        gap: 6
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <strong>{scorecard.channel}</strong>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span className="tag">{scorecard.health}</span>
                          <span className="tag">{scorecard.decision}</span>
                          <span className="tag">score {scorecard.score}</span>
                        </div>
                      </div>
                      <span>{scorecard.rationale}</span>
                      <span className="muted">
                        CPA {scorecard.cpa ? scorecard.cpa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "n/d"}
                        {" · "}
                        conv {scorecard.conversions ?? 0}
                        {" · "}
                        dispatch {scorecard.conversionSignalsSent}/{scorecard.conversionSignalsBlocked}/{scorecard.conversionSignalsFailed}
                      </span>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
            {previewPlan.recommendedExperiments?.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                <strong>Experimentos sugeridos</strong>
                <div style={{ display: "grid", gap: 10 }}>
                  {previewPlan.recommendedExperiments.map((experiment) => (
                    <article
                      key={experiment.id}
                      style={{
                        padding: 14,
                        borderRadius: 16,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(148, 196, 208, 0.1)",
                        display: "grid",
                        gap: 6
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <strong>{experiment.title}</strong>
                        <span className="tag">{experiment.status}</span>
                      </div>
                      <span>{experiment.hypothesis}</span>
                      <span className="muted">Variantes: {experiment.variants.join(" vs ")}</span>
                      <span className="muted">Proxima acao: {experiment.nextAction}</span>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
            {previewPlan.recommendedActions?.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                <strong>Acoes recomendadas pelo Agent Lion</strong>
                <div style={{ display: "grid", gap: 10 }}>
                  {previewPlan.recommendedActions.map((action) => (
                    <article
                      key={action.id}
                      style={{
                        padding: 14,
                        borderRadius: 16,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(148, 196, 208, 0.1)",
                        display: "grid",
                        gap: 6
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <strong>{action.title}</strong>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span className="tag">{getExecutionTrackPriorityLabel(action.priority)}</span>
                          <span className="tag">{action.status}</span>
                        </div>
                      </div>
                      <span>{action.detail}</span>
                      <span className="muted">{getApprovalModeLabel(action.mode)}</span>
                      {action.evidence?.length ? (
                        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                          {action.evidence.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : null}
                      {action.outcome ? <span className="muted">Resultado: {action.outcome}</span> : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
            {previewPlan.learningHighlights?.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                <strong>Memoria usada neste plano</strong>
                <div style={{ display: "grid", gap: 10 }}>
                  {previewPlan.learningHighlights.map((learning) => (
                    <article
                      key={`${learning.title}-${learning.sourcePath}`}
                      style={{
                        padding: 14,
                        borderRadius: 16,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(148, 196, 208, 0.1)",
                        display: "grid",
                        gap: 6
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <strong>{learning.title}</strong>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span className="tag">{getAgentLearningKindLabel(learning.kind)}</span>
                          <span className="tag">{getExecutionTrackPriorityLabel(learning.priority)}</span>
                          <span className="tag">{Math.round(learning.confidence * 100)}% confianca</span>
                        </div>
                      </div>
                      <span>{learning.summary}</span>
                      <Link href={learning.sourcePath} className="tag" style={{ width: "fit-content" }}>
                        {learning.sourceLabel}
                      </Link>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
            <div style={{ display: "grid", gap: 10 }}>
              <strong>Checklist de lancamento</strong>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                {previewPlan.launchChecklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <strong>Fila de aprovacao</strong>
              <div style={{ display: "grid", gap: 10 }}>
                {previewPlan.approvalQueue.map((item) => (
                  <div
                    key={item.title}
                    style={{
                      padding: 14,
                      borderRadius: 16,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(148, 196, 208, 0.1)",
                      display: "grid",
                      gap: 6
                    }}
                  >
                    <strong>{item.title}</strong>
                    <span className="tag" style={{ width: "fit-content" }}>
                      {getApprovalModeLabel(item.mode)}
                    </span>
                    <span className="muted">{item.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
            <h2 className="section-title">Contexto do operador</h2>
            <p style={{ margin: 0, lineHeight: 1.65 }}>{previewPlan.operatorContext}</p>
            <div style={{ display: "grid", gap: 10 }}>
              <strong>Canais conectados e prontos</strong>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                {workspace.connections
                  .filter((connection) => connection.status === "connected")
                  .map((connection) => (
                    <li key={connection.id}>
                      {connection.label} ({connection.platform})
                    </li>
                  ))}
              </ul>
            </div>
            <Link href="/perfil-profissional" className="tag" style={{ width: "fit-content" }}>
              Ajustar perfil profissional
            </Link>
          </article>
        </section>

        <section className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 18 }}>
          <h2 className="section-title">Trilhas de execucao</h2>
          <div style={{ display: "grid", gap: 14 }}>
            {previewPlan.tracks.map((track) => (
              <article
                key={track.id}
                style={{
                  padding: 18,
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(148, 196, 208, 0.1)",
                  display: "grid",
                  gap: 12
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <strong>{track.title}</strong>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className="tag">{track.track}</span>
                    {track.priority ? <span className="tag">{getExecutionTrackPriorityLabel(track.priority)}</span> : null}
                    {typeof track.confidence === "number" ? (
                      <span className="tag">{Math.round(track.confidence * 100)}% confianca</span>
                    ) : null}
                  </div>
                </div>
                <p style={{ margin: 0, lineHeight: 1.65 }}>
                  Objetivo: <strong>{track.objective}</strong>
                </p>
                <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                  {track.rationale}
                </p>
                {track.trigger ? (
                  <p style={{ margin: 0, lineHeight: 1.65 }}>
                    Gatilho: <strong>{track.trigger}</strong>
                  </p>
                ) : null}
                <div className="grid-auto" style={{ gap: 12 }}>
                  <InfoCard label="Aprovacao" value={getApprovalModeLabel(track.approvalMode)} />
                  <InfoCard label="Cadencia" value={track.cadence} />
                  <InfoCard label="Impacto de budget" value={track.budgetImpact} />
                  <InfoCard label="Metrica" value={track.successMetric} />
                </div>
                {track.evidence?.length ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <strong>Evidencias</strong>
                    <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                      {track.evidence.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                  {track.actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <h2 className="section-title">Memoria do Agent Lion</h2>
            <span className="tag">
              ativas: {workspace.agentLearnings.filter((learning) => learning.status !== "historical").length}
            </span>
          </div>
          {workspace.agentLearnings.length === 0 ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
              A memoria operacional ainda esta vazia. Rode o pulso operacional ou atualize a memoria para consolidar playbooks, riscos e oportunidades.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {workspace.agentLearnings.map((learning) => (
                <article
                  key={learning.id}
                  style={{
                    padding: 18,
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(148, 196, 208, 0.1)",
                    display: "grid",
                    gap: 10
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <strong>{learning.title}</strong>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className="tag">{getAgentLearningKindLabel(learning.kind)}</span>
                      <span className="tag">{getAgentLearningStatusLabel(learning.status)}</span>
                      <span className="tag">{getExecutionTrackPriorityLabel(learning.priority)}</span>
                      <span className="tag">{Math.round(learning.confidence * 100)}% confianca</span>
                    </div>
                  </div>
                  <span className="muted">
                    Atualizada em {new Date(learning.updatedAt).toLocaleString("pt-BR")}
                  </span>
                  <p style={{ margin: 0, lineHeight: 1.65 }}>{learning.summary}</p>
                  {learning.recommendedAction ? (
                    <p style={{ margin: 0, lineHeight: 1.65 }}>
                      Proxima melhor acao: <strong>{learning.recommendedAction}</strong>
                    </p>
                  ) : null}
                  {learning.evidence?.length ? (
                    <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                      {learning.evidence.map((entry) => (
                        <li key={entry}>{entry}</li>
                      ))}
                    </ul>
                  ) : null}
                  <Link href={learning.sourcePath} className="tag" style={{ width: "fit-content" }}>
                    {learning.sourceLabel}
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <h2 className="section-title">Inbox do Agent Lion</h2>
            <span className="tag">
              abertas: {workspace.operationalInbox.length}
            </span>
          </div>
          {workspace.executionPlans[0] ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
              Baseada no ultimo plano salvo em {new Date(workspace.executionPlans[0].generatedAt).toLocaleString("pt-BR")}.
            </p>
          ) : null}
          {!workspace.executionPlans[0] ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
              A inbox operacional aparece aqui depois que o scheduler ou voce salva o primeiro plano.
            </p>
          ) : workspace.operationalInbox.length === 0 ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
              O ultimo pulso nao deixou pendencias relevantes para revisao humana. A operacao ficou limpa neste ciclo.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {workspace.operationalInbox.map((item) => (
                <article
                  key={item.id}
                  style={{
                    padding: 18,
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(148, 196, 208, 0.1)",
                    display: "grid",
                    gap: 10
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <strong>{item.title}</strong>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className="tag">{getExecutionTrackPriorityLabel(item.priority)}</span>
                      <span className="tag">{labelForInboxState(item.state)}</span>
                    </div>
                  </div>
                  <span className="muted">
                    {getApprovalModeLabel(item.mode)} · aberta em {new Date(item.openedAt).toLocaleString("pt-BR")}
                  </span>
                  <p style={{ margin: 0, lineHeight: 1.65 }}>{item.summary}</p>
                  {item.evidence?.length ? (
                    <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                      {item.evidence.map((entry) => (
                        <li key={entry}>{entry}</li>
                      ))}
                    </ul>
                  ) : null}
                  <Link href={item.sourcePath} className="tag" style={{ width: "fit-content" }}>
                    {item.sourceLabel}
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 18 }}>
          <h2 className="section-title">Historico de planos salvos</h2>
          {workspace.executionPlans.length === 0 ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
              Nenhum plano salvo ainda. Gere o primeiro plano operacional para registrar a execucao desta empresa.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {workspace.executionPlans.map((plan) => (
                <article
                  key={plan.id}
                  style={{
                    padding: 18,
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(148, 196, 208, 0.1)",
                    display: "grid",
                    gap: 10
                  }}
                >
                  <strong>{plan.title}</strong>
                  <span className="muted">
                    {new Date(plan.generatedAt).toLocaleString("pt-BR")} · origem {plan.origin ?? "manual"}
                  </span>
                  <p style={{ margin: 0, lineHeight: 1.65 }}>{plan.summary}</p>
                  {plan.autopilotSummary ? (
                    <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                      {plan.autopilotSummary}
                    </p>
                  ) : null}
                  {plan.recommendedActions?.length ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      <strong>Acoes registradas</strong>
                      <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                        {plan.recommendedActions.map((action) => (
                          <li key={action.id}>
                            {action.title}: {action.status}
                            {action.outcome ? ` · ${action.outcome}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {plan.learningHighlights?.length ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      <strong>Memoria incorporada</strong>
                      <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                        {plan.learningHighlights.map((learning) => (
                          <li key={`${plan.id}-${learning.title}`}>
                            {learning.title}: {learning.summary}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function InfoCard({ label, value, description }: { label: string; value: string; description?: string }) {
  return (
    <article className="glass" style={{ padding: 18, borderRadius: 18, display: "grid", gap: 8 }}>
      <span className="muted" style={{ fontSize: 14 }}>
        {label}
      </span>
      <strong>{value}</strong>
      {description ? (
        <span className="muted" style={{ lineHeight: 1.55 }}>
          {description}
        </span>
      ) : null}
    </article>
  );
}

function labelForInboxState(state: "needs_review" | "needs_unblock" | "ready_to_run") {
  switch (state) {
    case "needs_review":
      return "precisa revisao";
    case "needs_unblock":
      return "precisa destravar";
    default:
      return "pronta para replay";
  }
}
