import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getCompanyWorkspace } from "@/lib/connectors";
import { isVaultConfigured } from "@/lib/company-vault";
import { isGoogleManagedPlatform } from "@/lib/google-connections";
import { getMarketingToolboxSummary } from "@/lib/marketing-toolbox";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function CompanyWorkspacePage({ params }: PageProps) {
  const { companyId } = await params;
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);
  const professionalProfile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(companyId, professionalProfile);
  const marketingToolSummary = getMarketingToolboxSummary();

  if (!workspace) {
    notFound();
  }

  return (
    <main style={{ padding: "32px 0 80px" }}>
      <div className="shell" style={{ display: "grid", gap: 24 }}>
        <section className="glass" style={{ padding: 28, borderRadius: 28, display: "grid", gap: 18 }}>
          <Link href="/" className="tag" style={{ width: "fit-content" }}>
            Voltar para control tower
          </Link>
          <div style={{ display: "grid", gap: 10 }}>
            <p className="eyebrow">Workspace Individual</p>
            <h1 style={{ margin: 0, fontSize: "clamp(2rem, 1.6rem + 1.5vw, 3.4rem)" }}>{workspace.company.name}</h1>
            <p className="muted" style={{ margin: 0, lineHeight: 1.7, maxWidth: 860 }}>
              {workspace.summary}
            </p>
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
              {session
                ? `Operador conectado: ${session.email}.`
                : "Faça login com Google na tela inicial antes de conectar contas desta empresa."}
              {" "}
              {isVaultConfigured()
                ? "Vault criptografado pronto para armazenar tokens por workspace."
                : "Configure VAULT_ENCRYPTION_KEY para armazenar tokens com seguranca."}
            </p>
          </div>
          <div className="grid-auto">
            <InfoCard label="Setor" value={workspace.company.sector} />
            <InfoCard label="Regiao" value={workspace.company.region} />
            <InfoCard label="Modo do agente" value={workspace.agentMode} />
            <InfoCard label="Estagio" value={workspace.stage} />
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href={`/empresas/${workspace.company.slug}/perfil`} className="tag">
              Perfil do agente
            </Link>
            <Link href={`/empresas/${workspace.company.slug}/conversao`} className="tag">
              Conversao
            </Link>
            <Link href={`/empresas/${workspace.company.slug}/planejamento`} className="tag">
              Planejamento
            </Link>
            <Link href={`/empresas/${workspace.company.slug}/dados`} className="tag">
              Dados
            </Link>
            <Link href={`/empresas/${workspace.company.slug}/social`} className="tag">
              Social
            </Link>
            <Link href={`/empresas/${workspace.company.slug}/operacao`} className="tag">
              Operacao
            </Link>
            <Link href={`/empresas/${workspace.company.slug}/studio`} className="tag">
              Studio
            </Link>
            <Link href={`/empresas/${workspace.company.slug}/engenharia`} className="tag">
              Engenharia
            </Link>
            <Link href={`/empresas/${workspace.company.slug}/relatorios`} className="tag">
              Relatorios
            </Link>
            <Link href={`/empresas/${workspace.company.slug}/pagamentos`} className="tag">
              Pagamentos
            </Link>
            <Link href={`/empresas/${workspace.company.slug}/aprovacoes`} className="tag">
              Aprovacoes
            </Link>
            <Link href={`/empresas/${workspace.company.slug}/scheduler`} className="tag">
              Scheduler
            </Link>
            <Link href="/stack-martech" className="tag">
              Stack martech
            </Link>
            <Link href="/perfil-profissional" className="tag">
              Perfil profissional
            </Link>
          </div>
        </section>

        <section style={{ display: "grid", gap: 18, gridTemplateColumns: "1.1fr 0.9fr" }}>
          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
              <h2 className="section-title">Perfil individual do agente</h2>
              <Link href={`/empresas/${workspace.company.slug}/perfil`} className="tag">
                Editar perfil
              </Link>
            </div>
            <span className="muted">
              Status: {workspace.agentProfile.trainingStatus} · Atualizado em{" "}
              {new Date(workspace.agentProfile.updatedAt).toLocaleString("pt-BR")}
            </span>
            <p style={{ margin: 0, lineHeight: 1.65 }}>{workspace.agentProfile.businessSummary}</p>
            <div className="grid-auto" style={{ gap: 12 }}>
              <InfoCard label="Tom de voz" value={workspace.agentProfile.brandVoice} />
              <InfoCard label="Oferta" value={workspace.agentProfile.offerStrategy} />
            </div>
          </article>

          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
            <h2 className="section-title">Perfil profissional do operador</h2>
            {professionalProfile ? (
              <>
                <span className="muted">
                  {professionalProfile.professionalTitle} Â· {professionalProfile.trainingStatus}
                </span>
                <p style={{ margin: 0, lineHeight: 1.65 }}>
                  North star: <strong>{professionalProfile.strategicNorthStar}</strong>
                </p>
                <p style={{ margin: 0, lineHeight: 1.65 }}>
                  Aprendizado aplicado: <strong>{professionalProfile.learnedPatterns[0] ?? "Sem aprendizado registrado"}</strong>
                </p>
                <Link href="/perfil-profissional" className="tag" style={{ width: "fit-content" }}>
                  Ajustar memoria profissional
                </Link>
              </>
            ) : (
              <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                Entre com Google para carregar seu perfil profissional e usar esse contexto nas estrategias desta empresa.
              </p>
            )}
          </article>

          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
            <h2 className="section-title">Conexoes desta empresa</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {workspace.connections.map((connection) => (
                <div
                  key={connection.id}
                  style={{
                    padding: 16,
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(148, 196, 208, 0.1)",
                    display: "grid",
                    gap: 8
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <strong>{connection.label}</strong>
                    <span className="tag">{connection.status}</span>
                  </div>
                  <span className="muted">
                    {connection.platform} · {connection.auth}
                  </span>
                  <span>Scopes: {connection.scopes.join(", ")}</span>
                  <span>Contas mapeadas: {connection.accountLabels.join(", ")}</span>
                  <span className="muted">Vault: {connection.vaultNamespace}</span>
                  <p style={{ margin: 0, lineHeight: 1.6 }}>{connection.nextAction}</p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {session && connection.auth === "oauth" && isGoogleManagedPlatform(connection.platform) ? (
                      <a
                        href={`/api/auth/google/connect/start?companyId=${workspace.company.slug}&platform=${connection.platform}`}
                        className="tag"
                      >
                        {connection.status === "connected" ? "Reconectar com Google" : "Conectar com Google"}
                      </a>
                    ) : null}
                    {!session && connection.auth === "oauth" && isGoogleManagedPlatform(connection.platform) ? (
                      <Link href="/" className="tag">
                        Entrar para conectar
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
            <h2 className="section-title">Proximas acoes</h2>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.85 }}>
              {workspace.nextActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </article>
        </section>

        <section style={{ display: "grid", gap: 18, gridTemplateColumns: "1fr 1fr" }}>
          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
              <h2 className="section-title">Plano estrategico</h2>
              <Link href={`/empresas/${workspace.company.slug}/planejamento`} className="tag">
                Abrir plano
              </Link>
            </div>
            <span className="muted">
              Status: {workspace.strategyPlan.status} · Atualizado em{" "}
              {new Date(workspace.strategyPlan.updatedAt).toLocaleString("pt-BR")}
            </span>
            <p style={{ margin: 0, lineHeight: 1.65 }}>
              Meta principal: <strong>{workspace.strategyPlan.primaryObjective}</strong>
            </p>
            <p style={{ margin: 0, lineHeight: 1.65 }}>
              Meta de alcance: <strong>{workspace.strategyPlan.reachGoal}</strong>
            </p>
            <p style={{ margin: 0, lineHeight: 1.65 }}>
              Concorrentes monitorados: <strong>{workspace.strategyPlan.competitors.length}</strong>
            </p>
          </article>

          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
              <h2 className="section-title">Plano operacional</h2>
              <Link href={`/empresas/${workspace.company.slug}/operacao`} className="tag">
                Abrir operacao
              </Link>
            </div>
            <p style={{ margin: 0, lineHeight: 1.65 }}>
              Planos salvos: <strong>{workspace.executionPlans.length}</strong>
            </p>
            <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
              O agente converte estrategia em trilhas de execucao com campanhas, conteudo, SEO e fila de aprovacao.
            </p>
            <p style={{ margin: 0, lineHeight: 1.65 }}>
              Ultimo plano: <strong>{workspace.executionPlans[0]?.title ?? "Nenhum plano salvo ainda"}</strong>
            </p>
            <p style={{ margin: 0, lineHeight: 1.65 }}>
              Inbox operacional aberta: <strong>{workspace.operationalInbox.length}</strong>
            </p>
            {workspace.operationalInbox[0] ? (
              <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                Topo da fila: {workspace.operationalInbox[0].title}
              </p>
            ) : null}
          </article>

          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
              <h2 className="section-title">Dados e automacao Google</h2>
              <Link href={`/empresas/${workspace.company.slug}/dados`} className="tag">
                Abrir dados
              </Link>
            </div>
            <span className="muted">
              Status: {workspace.dataOpsProfile.status} · Atualizado em{" "}
              {new Date(workspace.dataOpsProfile.updatedAt).toLocaleString("pt-BR")}
            </span>
            <p style={{ margin: 0, lineHeight: 1.65 }}>
              Cadencia: <strong>{workspace.dataOpsProfile.reportingCadence}</strong>
            </p>
            <p style={{ margin: 0, lineHeight: 1.65 }}>
              KPIs monitorados: <strong>{workspace.dataOpsProfile.primaryKpis.slice(0, 4).join(", ")}</strong>
            </p>
            <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
              O agente pode operar GA4, Search Console e Google Sheets em rotinas internas aprovadas para esta empresa.
            </p>
          </article>

          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
              <h2 className="section-title">Social, agenda e anuncios</h2>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href={`/empresas/${workspace.company.slug}/social`} className="tag">
                  Abrir social
                </Link>
                <Link href={`/empresas/${workspace.company.slug}/social/runtime`} className="tag">
                  Runtime
                </Link>
              </div>
            </div>
            <span className="muted">
              Status: {workspace.socialProfile.status} · Atualizado em{" "}
              {new Date(workspace.socialProfile.updatedAt).toLocaleString("pt-BR")}
            </span>
            <p style={{ margin: 0, lineHeight: 1.65 }}>
              Plataformas foco: <strong>{workspace.socialProfile.priorityPlatforms.join(", ")}</strong>
            </p>
            <p style={{ margin: 0, lineHeight: 1.65 }}>
              Posts programados: <strong>{workspace.scheduledPosts.length}</strong> · Anuncios em fila:{" "}
              <strong>{workspace.socialAdDrafts.length}</strong>
            </p>
            <p style={{ margin: 0, lineHeight: 1.65 }}>
              Runtime pronta para publicar: <strong>{workspace.socialRuntime.publishReadyPlatforms}</strong> · Sync pronto:{" "}
              <strong>{workspace.socialRuntime.analyticsReadyPlatforms}</strong> · Fila ativa:{" "}
              <strong>{workspace.socialRuntime.queuedTasks}</strong>
            </p>
            <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
              O agente pode estruturar agenda, programar posts, ler estatisticas e preparar anuncios com especializacao por plataforma.
            </p>
          </article>

          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
              <h2 className="section-title">Approval Center</h2>
              <Link href={`/empresas/${workspace.company.slug}/aprovacoes`} className="tag">
                Abrir aprovacoes
              </Link>
            </div>
            <p style={{ margin: 0, lineHeight: 1.65 }}>
              Pendentes: <strong>{workspace.approvalsCenter.filter((item) => item.actions.length > 0).length}</strong>
            </p>
            <p style={{ margin: 0, lineHeight: 1.65 }}>
              Itens recentes: <strong>{workspace.approvalsCenter.length}</strong>
            </p>
            <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
              O Agent Lion centraliza pagamentos, publicacoes, posts sociais e anuncios em uma unica caixa de aprovacao.
            </p>
          </article>

          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
              <h2 className="section-title">Scheduler</h2>
              <Link href={`/empresas/${workspace.company.slug}/scheduler`} className="tag">
                Abrir scheduler
              </Link>
            </div>
            <p style={{ margin: 0, lineHeight: 1.65 }}>
              Jobs ativos: <strong>{workspace.schedulerJobs.filter((job) => job.status === "active").length}</strong>
            </p>
            <p style={{ margin: 0, lineHeight: 1.65 }}>
              Timezone: <strong>{workspace.schedulerProfile.timezone}</strong>
            </p>
            <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
              O scheduler coordena rotinas de relatorio, social sync, health checks, SEO e digest de aprovacoes.
            </p>
          </article>

          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
              <h2 className="section-title">Motor de conversao</h2>
              <Link href={`/empresas/${workspace.company.slug}/conversao`} className="tag">
                Abrir conversao
              </Link>
            </div>
            <span className="muted">
              Status: {workspace.keywordStrategy.status} · Atualizado em{" "}
              {new Date(workspace.keywordStrategy.updatedAt).toLocaleString("pt-BR")}
            </span>
            <p style={{ margin: 0, lineHeight: 1.65 }}>
              Oferta principal: <strong>{workspace.keywordStrategy.mainOffer}</strong>
            </p>
            <p style={{ margin: 0, lineHeight: 1.65 }}>
              Keywords principais: <strong>{workspace.keywordStrategy.primaryKeywords.slice(0, 3).join(", ")}</strong>
            </p>
            <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
              {workspace.keywordStrategy.complianceNote}
            </p>
          </article>

          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
            <h2 className="section-title">Accounts canonicas</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {workspace.accounts.map((account) => (
                <div
                  key={account.id}
                  style={{
                    padding: 16,
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(148, 196, 208, 0.1)",
                    display: "grid",
                    gap: 6
                  }}
                >
                  <strong>{account.name}</strong>
                  <span className="muted">
                    {account.platform} · {account.accessLevel}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
            <h2 className="section-title">Metricas do workspace</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {workspace.snapshots.map((snapshot, index) => (
                <div
                  key={`${snapshot.platform}-${snapshot.window}-${index}`}
                  style={{
                    padding: 16,
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(148, 196, 208, 0.1)",
                    display: "grid",
                    gap: 8
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <strong>{snapshot.platform}</strong>
                    <span className="tag">{snapshot.window}</span>
                  </div>
                  <span>Spend: {snapshot.spend ? formatCurrency(snapshot.spend) : "-"}</span>
                  <span>Clicks: {snapshot.clicks ? formatInteger(snapshot.clicks) : "-"}</span>
                  <span>Conversions: {snapshot.conversions ? formatInteger(snapshot.conversions) : "-"}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
            <h2 className="section-title">Studio criativo</h2>
            <Link href={`/empresas/${workspace.company.slug}/studio`} className="tag">
              Abrir studio
            </Link>
          </div>
          <p style={{ margin: 0, lineHeight: 1.65 }}>
            Ferramentas catalogadas: <strong>{workspace.creativeTools.length}</strong>
          </p>
          <p style={{ margin: 0, lineHeight: 1.65 }}>
            Publicacoes pendentes:{" "}
            <strong>{workspace.publishingRequests.filter((request) => request.status === "pending").length}</strong>
          </p>
          <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
            O agente pode criar com autonomia, mas publicacao exige aprovacao explicita antes de ir ao ar.
          </p>
        </article>

        <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
            <h2 className="section-title">Expertise martech do agente</h2>
            <Link href="/stack-martech" className="tag">
              Abrir stack
            </Link>
          </div>
          <p style={{ margin: 0, lineHeight: 1.65 }}>
            Ferramentas mapeadas: <strong>{marketingToolSummary.tools}</strong>
          </p>
          <p style={{ margin: 0, lineHeight: 1.65 }}>
            Prontas para OAuth/API: <strong>{marketingToolSummary.oauthOrApiReady}</strong>
          </p>
          <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
            O agente carrega expertise em analytics, CRM, automacao, SEO, midia paga, criacao e operacao, aplicando isso dentro do contexto desta empresa.
          </p>
        </article>

        <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
            <h2 className="section-title">Lab de engenharia</h2>
            <Link href={`/empresas/${workspace.company.slug}/engenharia`} className="tag">
              Abrir engenharia
            </Link>
          </div>
          <p style={{ margin: 0, lineHeight: 1.65 }}>
            Repos cadastrados: <strong>{workspace.engineeringWorkspaces.length}</strong>
          </p>
          <p style={{ margin: 0, lineHeight: 1.65 }}>
            Solicitações abertas:{" "}
            <strong>{workspace.technicalRequests.filter((request) => request.status !== "resolved").length}</strong>
          </p>
          <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
            O agente passa a ler codigo, investigar bugs, gerar solucoes e organizar backlog tecnico por empresa.
          </p>
        </article>

        <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
            <h2 className="section-title">Pagamentos com aprovacao</h2>
            <Link href={`/empresas/${workspace.company.slug}/pagamentos`} className="tag">
              Abrir pagamentos
            </Link>
          </div>
          <span className="muted">
            Status: {workspace.paymentProfile.status} · Atualizado em{" "}
            {new Date(workspace.paymentProfile.updatedAt).toLocaleString("pt-BR")}
          </span>
          <p style={{ margin: 0, lineHeight: 1.65 }}>{workspace.paymentProfile.approvalRule}</p>
          <p style={{ margin: 0, lineHeight: 1.65 }}>
            Solicitações pendentes:{" "}
            <strong>{workspace.paymentRequests.filter((request) => request.status === "pending").length}</strong>
          </p>
        </article>

        <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
            <h2 className="section-title">Relatorios gerados</h2>
            <Link href={`/empresas/${workspace.company.slug}/relatorios`} className="tag">
              Abrir relatorios
            </Link>
          </div>
          {workspace.reports.length === 0 ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
              Nenhum relatorio salvo ainda. Gere o radar diario de concorrentes ou o relatorio semanal para esta empresa.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {workspace.reports.slice(0, 2).map((report) => (
                <div
                  key={report.id}
                  style={{
                    padding: 16,
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(148, 196, 208, 0.1)",
                    display: "grid",
                    gap: 6
                  }}
                >
                  <strong>{report.title}</strong>
                  <span className="muted">
                    {report.type} · {new Date(report.generatedAt).toLocaleString("pt-BR")}
                  </span>
                  <p style={{ margin: 0, lineHeight: 1.6 }}>{report.summary}</p>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
          <h2 className="section-title">Auditoria da empresa</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {workspace.audit.map((event) => (
              <div
                key={event.id}
                style={{
                  padding: 16,
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(148, 196, 208, 0.1)",
                  display: "grid",
                  gap: 6
                }}
              >
                <strong>{event.title}</strong>
                <span className="muted">
                  {event.connector} · {new Date(event.timestamp).toLocaleString("pt-BR")}
                </span>
                <p style={{ margin: 0, lineHeight: 1.6 }}>{event.details}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="glass" style={{ padding: 18, borderRadius: 18, display: "grid", gap: 8 }}>
      <span className="muted" style={{ fontSize: 14 }}>
        {label}
      </span>
      <strong>{value}</strong>
    </article>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2
  }).format(value);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}
