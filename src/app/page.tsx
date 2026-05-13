import Link from "next/link";
import { cookies } from "next/headers";
import { brand } from "@/lib/brand";
import { blueprint } from "@/lib/blueprint";
import { isVaultConfigured } from "@/lib/company-vault";
import { getDesktopAgentProfile } from "@/lib/desktop-agent";
import { getInternetIntelligenceProfile } from "@/lib/internet-intel";
import { getAuditFeed, getCompanyWorkspaces, getConnectorOverview, getControlTowerSummary, getSnapshotFeed } from "@/lib/connectors";
import { hasGoogleOAuthConfigured } from "@/lib/google-auth";
import { getMarketingToolbox, getMarketingToolboxSummary } from "@/lib/marketing-toolbox";
import { getSessionFromCookies } from "@/lib/session";
import { buildProfessionalSummary, getUserProfessionalProfile } from "@/lib/user-profiles";

const riskColor: Record<string, string> = {
  baixo: "#7ee0b3",
  medio: "#ffbe5c",
  alto: "#ff7f7f"
};

const healthColor: Record<string, string> = {
  healthy: "#7ee0b3",
  warning: "#ffbe5c",
  critical: "#ff7f7f"
};

export default async function Home() {
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);
  const professionalProfile = getUserProfessionalProfile(session);
  const connectorOverview = getConnectorOverview();
  const workspaces = getCompanyWorkspaces(professionalProfile);
  const controlTowerSummary = getControlTowerSummary();
  const snapshots = getSnapshotFeed();
  const auditFeed = getAuditFeed();
  const vaultReady = isVaultConfigured();
  const marketingToolbox = getMarketingToolbox();
  const marketingToolSummary = getMarketingToolboxSummary();
  const desktopAgent = getDesktopAgentProfile();
  const internetIntel = getInternetIntelligenceProfile();
  const googleOAuthReady = hasGoogleOAuthConfigured();
  const readinessCards = [
    {
      label: "Login Google",
      value: googleOAuthReady ? "Ativo" : "Aguardando OAuth",
      detail: googleOAuthReady
        ? "Operador pode entrar e abrir os workspaces multiempresa."
        : "Credenciais Google ainda nao foram conectadas neste ambiente.",
      tone: googleOAuthReady ? "live" : "readiness"
    },
    {
      label: "Cofre de conexoes",
      value: vaultReady ? "Seguro" : "Readiness",
      detail: vaultReady
        ? "Namespace criptografado pronto para credenciais por empresa."
        : "Defina a chave do vault antes de persistir tokens reais.",
      tone: vaultReady ? "live" : "readiness"
    },
    {
      label: "Autonomia",
      value: `${blueprint.automationMode} por padrao`,
      detail: "Acoes sensiveis seguem protegidas por policy, aprovacao e auditoria.",
      tone: "live"
    }
  ] as const;

  return (
    <main style={{ padding: "32px 0 80px" }}>
      <div className="shell" style={{ display: "grid", gap: 28 }}>
        <section
          className="glass"
          style={{
            padding: 28,
            borderRadius: 28,
            position: "relative",
            overflow: "hidden"
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(135deg, rgba(126,224,179,0.10), transparent 35%), radial-gradient(circle at 100% 0, rgba(255,190,92,0.12), transparent 25%)",
              pointerEvents: "none"
            }}
          />
          <div style={{ position: "relative", display: "grid", gap: 18 }}>
            <div className="premium-nav">
              <div className="tag">{blueprint.automationMode} por padrao</div>
              {session ? (
                <div className="premium-nav-actions">
                  <span className="tag">Google login ativo</span>
                  <Link href="/perfil-profissional" className="tag">
                    Perfil profissional
                  </Link>
                  <Link href="/stack-martech" className="tag">
                    Stack martech
                  </Link>
                  <Link href="/agente-desktop" className="tag">
                    Agente desktop
                  </Link>
                  <Link href="/inteligencia-web" className="tag">
                    Inteligencia web
                  </Link>
                  {professionalProfile ? <span className="tag">{professionalProfile.trainingStatus}</span> : null}
                  <span className="muted">
                    {session.name} · {session.email}
                  </span>
                  <a href="/api/auth/logout" className="tag">
                    Sair
                  </a>
                </div>
              ) : (
                <div className="premium-nav-actions">
                  <a href="/api/auth/google/start" className="tag">
                    {googleOAuthReady ? "Entrar com Google" : "Preparar login Google"}
                  </a>
                  <Link href="/stack-martech" className="tag">
                    Ver readiness martech
                  </Link>
                  <Link href="/inteligencia-web" className="tag">
                    Inteligencia web
                  </Link>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gap: 12, maxWidth: 920 }}>
              <p className="eyebrow">{brand.controlTowerLabel}</p>
              <h1 style={{ margin: 0, fontSize: "clamp(2.4rem, 1.8rem + 2vw, 4.6rem)", lineHeight: 0.95 }}>
                {blueprint.name}
              </h1>
              <p style={{ margin: 0, fontSize: "1.08rem", lineHeight: 1.7, color: "#d6e7ec" }}>
                Operacao de marketing estilo agencia profissional, com login via Google, workspaces isolados por empresa e conexoes individuais para Google, Meta, Analytics, Sheets e outros canais.
              </p>
              <p className="muted" style={{ margin: 0, maxWidth: 860, lineHeight: 1.7 }}>
                O agente centraliza estrategia, conteudo, metricas, aprovacoes e economia de spend, mas cada empresa continua com seu proprio namespace de credenciais, trilha de auditoria e plano operacional.
              </p>
            </div>

            <div className="premium-status-strip" aria-label="Status operacional do Agent Lion">
              {readinessCards.map((card) => (
                <StatusPill key={card.label} {...card} />
              ))}
            </div>

            <div className="grid-auto">
              <MetricCard label="Empresas" value={String(controlTowerSummary.companies)} />
              <MetricCard label="Workspaces isolados" value={String(controlTowerSummary.isolatedWorkspaces)} />
              <MetricCard label="Relatorios gerados" value={String(controlTowerSummary.generatedReports)} />
              <MetricCard label="Aprovacoes pendentes" value={String(controlTowerSummary.pendingUnifiedApprovals)} />
              <MetricCard label="Posts pendentes" value={String(controlTowerSummary.pendingPublishingApprovals)} />
              <MetricCard label="Tickets tecnicos" value={String(controlTowerSummary.openTechnicalRequests)} />
              <MetricCard label="Ferramentas expert" value={String(marketingToolSummary.tools)} />
              <MetricCard label="Apps locais liberados" value={String(desktopAgent.allowedApps.length)} />
              <MetricCard label="Fontes web monitoradas" value={String(internetIntel.sourceTypes.length)} />
            </div>
          </div>
        </section>

        {professionalProfile ? (
          <Section
            heading="Memoria profissional do operador"
            subheading="Esse perfil fica salvo por login Google e ensina ao agente como voce pensa estrategia, crescimento, custo e aprovacao."
          >
            <div style={{ display: "grid", gap: 18, gridTemplateColumns: "1.1fr 0.9fr" }}>
              <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <strong>{professionalProfile.displayName}</strong>
                  <Link href="/perfil-profissional" className="tag">
                    Editar perfil
                  </Link>
                </div>
                <span className="muted">
                  Status: {professionalProfile.trainingStatus} Â· Atualizado em{" "}
                  {new Date(professionalProfile.updatedAt).toLocaleString("pt-BR")}
                </span>
                <p style={{ margin: 0, lineHeight: 1.65 }}>{buildProfessionalSummary(professionalProfile)}</p>
                <div className="grid-auto" style={{ gap: 12 }}>
                  <DataPoint label="Cargo" value={professionalProfile.professionalTitle} />
                  <DataPoint label="Cadencia" value={professionalProfile.planningCadence} />
                  <DataPoint label="Custo" value={professionalProfile.costDiscipline} />
                </div>
              </article>

              <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 12 }}>
                <strong>Aprendizados aplicados pelo agente</strong>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.85 }}>
                  {professionalProfile.learnedPatterns.slice(0, 4).map((pattern) => (
                    <li key={pattern}>{pattern}</li>
                  ))}
                </ul>
                <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                  Canais preferidos: {professionalProfile.preferredChannels.join(", ")}
                </p>
              </article>
            </div>
          </Section>
        ) : null}

        <Section
          heading="Como o agente opera como agencia profissional"
          subheading="Uma conta de operador entra com Google, e cada empresa conecta suas contas separadamente ao agente."
        >
          <div className="grid-auto">
            <PrincipleCard
              title="Login unificado"
              body="O operador entra via Google e acessa a torre de controle sem misturar credenciais de cliente no navegador."
            />
            <PrincipleCard
              title="Workspace por empresa"
              body="Cada empresa tem conexoes, contas, snapshots, auditoria e proximas acoes isoladas em seu proprio workspace."
            />
            <PrincipleCard
              title="Economia com performance"
              body="O agente prioriza read-only, pacing, comparacao entre canais e so libera mutacoes com guardrails para reduzir desperdicio."
            />
            <PrincipleCard
              title="Conteudo, postagem e metricas"
              body="A arquitetura separa criativos, distribuicao, email e medicao para virar um fluxo operacional de ponta a ponta."
            />
            <PrincipleCard
              title="Analytics e Sheets autonomos"
              body="O agente pode ler Google Analytics, Search Console e manter planilhas operacionais aprovadas sem depender de trabalho manual diario."
            />
            <PrincipleCard
              title="Dados com compliance"
              body="O agente usa dados consentidos, agregados e contextuais para vender melhor, sem depender de PII raspada da internet."
            />
            <PrincipleCard
              title="Pagamentos com liberacao"
              body="O metodo de pagamento pode ficar referenciado no sistema, mas cada servico exige solicitacao e aprovacao do usuario antes de executar."
            />
            <PrincipleCard
              title="Agente local no computador"
              body="O agente pode gerar arquivos, organizar pastas, preparar exports e operar apps locais aprovados, mantendo publicacao, pagamento e exclusoes sensiveis sob controle."
            />
            <PrincipleCard
              title="Pesquisa e updates em tempo real"
              body="O agente pode pesquisar a internet, monitorar mudancas de mercado e atualizar estrategia com fontes aprovadas e watchlists vivas."
            />
          </div>
        </Section>

        <Section
          heading="Inteligencia web em tempo real"
          subheading="A camada de pesquisa online permite que o agente acompanhe concorrentes, noticias, documentacao e mudancas de plataforma sem depender de pesquisa manual."
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/inteligencia-web" className="tag">
              Abrir inteligencia web
            </Link>
            <span className="tag">{internetIntel.allowedDomains.length} dominios aprovados</span>
            <span className="tag">{internetIntel.monitoredTopics.length} topicos vivos</span>
          </div>
          <div className="grid-auto">
            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 12 }}>
              <strong>Cadencia</strong>
              <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                {internetIntel.liveUpdateCadence}
              </p>
            </article>
            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 12 }}>
              <strong>Fontes</strong>
              <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                {internetIntel.sourceTypes.slice(0, 4).join(", ")}
              </p>
            </article>
            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 12 }}>
              <strong>Notas</strong>
              <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                {internetIntel.runtimeNotes}
              </p>
            </article>
          </div>
        </Section>

        <Section
          heading="Agente local no computador"
          subheading="A camada desktop deixa o agente agir como operador real de trabalho, com acesso local guardado por regras claras."
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/agente-desktop" className="tag">
              Abrir agente desktop
            </Link>
            <span className="tag">{desktopAgent.approvedRoots.length} pastas aprovadas</span>
            <span className="tag">{desktopAgent.allowedApps.length} apps liberados</span>
          </div>
          <div className="grid-auto">
            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 12 }}>
              <strong>Acoes autonomas</strong>
              <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                {desktopAgent.autonomousActions.slice(0, 2).join(" ")}
              </p>
            </article>
            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 12 }}>
              <strong>Guardrails</strong>
              <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                {desktopAgent.approvalRequiredActions.slice(0, 2).join(" ")}
              </p>
            </article>
            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 12 }}>
              <strong>Notas de runtime</strong>
              <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                {desktopAgent.runtimeNotes}
              </p>
            </article>
          </div>
        </Section>

        <Section
          heading="Expertise do agente no stack martech"
          subheading="O agente agora nasce preparado para raciocinar e operar nas ferramentas mais usadas pelo mercado, separando o que ja esta integrado do que entra por OAuth, API, browser-assisted ou playbook."
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/stack-martech" className="tag">
              Abrir stack martech completo
            </Link>
            <span className="tag">{marketingToolSummary.categories} categorias</span>
            <span className="tag">{marketingToolSummary.oauthOrApiReady} prontas para OAuth/API</span>
          </div>
          <div className="grid-auto">
            {marketingToolbox.map((category) => (
              <article key={category.id} className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <strong>{category.label}</strong>
                  <span className="tag">{category.tools.length} ferramentas</span>
                </div>
                <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                  {category.summary}
                </p>
                <p style={{ margin: 0, lineHeight: 1.65 }}>
                  {category.tools.slice(0, 4).map((tool) => tool.name).join(", ")}
                </p>
              </article>
            ))}
          </div>
        </Section>

        <Section
          heading="Empresas geridas pelo agente"
          subheading="Cada card abaixo representa uma empresa atendida individualmente, com escopos, contas e proximos passos proprios."
        >
          <div className="grid-auto">
            {workspaces.map((workspace) => (
              <article key={workspace.company.id} className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <strong style={{ fontSize: "1.1rem" }}>{workspace.company.name}</strong>
                    <span className="muted">
                      {workspace.company.sector} · {workspace.company.region}
                    </span>
                  </div>
                  <span className="tag">{workspace.stage}</span>
                </div>
                <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                  {workspace.summary}
                </p>
                <div className="grid-auto" style={{ gap: 12 }}>
                  <DataPoint label="Conexoes" value={String(workspace.connections.length)} />
                  <DataPoint
                    label="Conectadas"
                    value={String(workspace.connections.filter((connection) => connection.status === "connected").length)}
                  />
                  <DataPoint
                    label="Perfil"
                    value={workspace.agentProfile.trainingStatus}
                  />
                  <DataPoint
                    label="Relatorios"
                    value={String(workspace.reports.length)}
                  />
                  <DataPoint
                    label="Automacoes de dados"
                    value={String(workspace.dataOpsProfile.sheetAutomations.length)}
                  />
                </div>
                <p style={{ margin: 0, lineHeight: 1.6 }}>
                  Objetivo principal: <strong>{workspace.company.primaryGoal}</strong>
                </p>
                <Link href={`/empresas/${workspace.company.slug}`} className="tag" style={{ width: "fit-content" }}>
                  Abrir workspace individual
                </Link>
              </article>
            ))}
          </div>
        </Section>

        <Section
          heading="Conectores globais do agente"
          subheading="Essas credenciais pertencem ao proprio agente. Depois de prontas, cada empresa conecta suas contas individualmente por cima delas."
        >
          <div className="grid-auto">
            {connectorOverview.map((connector) => (
              <article key={connector.connector} className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
                  <strong>{connector.label}</strong>
                  <span className="tag" style={{ color: healthColor[connector.health] }}>
                    {connector.status}
                  </span>
                </div>
                <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
                  {connector.summary}
                </p>
                <span>Acesso: {connector.access}</span>
                <span>Credenciais globais: {connector.configuredEnv.length}/{connector.requiredEnv.length}</span>
                <code
                  style={{
                    display: "block",
                    padding: 12,
                    borderRadius: 14,
                    background: "rgba(4, 11, 15, 0.72)",
                    border: "1px solid rgba(148, 196, 208, 0.12)",
                    lineHeight: 1.6
                  }}
                >
                  {connector.requiredEnv.join(", ")}
                </code>
                <p style={{ margin: 0, lineHeight: 1.6 }}>{connector.nextAction}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section
          heading="Integracoes e acesso"
          subheading="O desenho privilegia read-only primeiro, write mode progressivo e contas separadas por empresa."
        >
          <div style={{ display: "grid", gap: 14 }}>
            {blueprint.integrations.map((integration) => (
              <article
                key={integration.id}
                className="glass"
                style={{
                  padding: 20,
                  borderRadius: 20,
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "1.4fr 2fr 1fr",
                  alignItems: "start"
                }}
              >
                <div style={{ display: "grid", gap: 8 }}>
                  <strong>{integration.platform}</strong>
                  <span className="muted">{integration.purpose}</span>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <span>Auth: {integration.auth}</span>
                  <span>Escopo minimo: {integration.minimumScope}</span>
                  <span>Fase: {integration.phase}</span>
                </div>
                <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
                  <span className="tag">{integration.access}</span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      color: riskColor[integration.risk]
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: riskColor[integration.risk]
                      }}
                    />
                    risco {integration.risk}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </Section>

        <section style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr 1fr" }}>
          <Section heading="Snapshots canonicos" subheading="As metricas continuam unificadas, mas cada snapshot carrega a empresa dona daquele resultado.">
            <div style={{ display: "grid", gap: 14 }}>
              {snapshots.map((snapshot, index) => (
                <article key={`${snapshot.companyId}-${snapshot.platform}-${snapshot.window}-${index}`} className="glass" style={{ padding: 20, borderRadius: 20, display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <strong>
                      {snapshot.companyName} · {snapshot.platform}
                    </strong>
                    <span className="tag">{snapshot.window}</span>
                  </div>
                  <div className="grid-auto" style={{ gap: 12 }}>
                    <DataPoint label="Spend" value={snapshot.spend ? formatCurrency(snapshot.spend) : "-"} />
                    <DataPoint label="Impressions" value={snapshot.impressions ? formatInteger(snapshot.impressions) : "-"} />
                    <DataPoint label="Clicks" value={snapshot.clicks ? formatInteger(snapshot.clicks) : "-"} />
                    <DataPoint label="Conversions" value={snapshot.conversions ? formatInteger(snapshot.conversions) : "-"} />
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.75 }}>
                    {snapshot.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </Section>

          <Section heading="Auditoria do control tower" subheading="O agente precisa registrar decisoes de todas as empresas e todas as plataformas de forma transparente.">
            <div style={{ display: "grid", gap: 14 }}>
              {auditFeed.map((event) => (
                <article key={event.id} className="glass" style={{ padding: 18, borderRadius: 18, display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <strong>{event.title}</strong>
                    <span className="tag">{event.kind}</span>
                  </div>
                  <span className="muted">
                    {event.connector} · {new Date(event.timestamp).toLocaleString("pt-BR")}
                  </span>
                  <p style={{ margin: 0, lineHeight: 1.65 }}>{event.details}</p>
                </article>
              ))}
            </div>
          </Section>
        </section>

        <section style={{ display: "grid", gap: 20, gridTemplateColumns: "1.2fr 0.8fr" }}>
          <Section heading="Guardrails" subheading="As regras abaixo protegem spend, acesso e reputacao antes da automacao crescer.">
            <div style={{ display: "grid", gap: 14 }}>
              {blueprint.guardrails.map((guardrail) => (
                <article key={guardrail.id} className="glass" style={{ padding: 18, borderRadius: 18, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
                    <strong>{guardrail.title}</strong>
                    <span className="tag" style={{ color: riskColor[guardrail.severity] }}>
                      {guardrail.severity}
                    </span>
                  </div>
                  <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                    {guardrail.description}
                  </p>
                </article>
              ))}
            </div>
          </Section>

          <Section heading="API interna" subheading="A app agora ja expoe endpoints para control tower, empresas e login Google.">
            <div className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
              <ApiCode>GET /api/blueprint</ApiCode>
              <ApiCode>GET /api/overview</ApiCode>
              <ApiCode>GET|POST /api/desktop-agent</ApiCode>
              <ApiCode>GET|POST /api/internet-intel</ApiCode>
              <ApiCode>GET /api/toolbox</ApiCode>
              <ApiCode>GET /api/companies</ApiCode>
              <ApiCode>GET /api/companies/:companyId</ApiCode>
              <ApiCode>GET|POST /api/me/profile</ApiCode>
              <ApiCode>GET|POST /api/companies/:companyId/creative-tools</ApiCode>
              <ApiCode>GET|POST /api/companies/:companyId/engineering</ApiCode>
              <ApiCode>GET|POST /api/companies/:companyId/execution</ApiCode>
              <ApiCode>GET|POST /api/companies/:companyId/data-ops</ApiCode>
              <ApiCode>GET|POST /api/companies/:companyId/strategy</ApiCode>
              <ApiCode>GET|POST /api/companies/:companyId/reports</ApiCode>
              <ApiCode>GET /api/companies/:companyId/approvals</ApiCode>
              <ApiCode>POST /api/companies/:companyId/approvals/:approvalId</ApiCode>
              <ApiCode>GET|POST /api/companies/:companyId/scheduler</ApiCode>
              <ApiCode>GET|POST /api/companies/:companyId/social/runtime</ApiCode>
              <ApiCode>POST /api/companies/:companyId/social/runtime/:taskId</ApiCode>
              <ApiCode>GET /api/auth/google/start</ApiCode>
              <ApiCode>GET /api/auth/google/connect/start?companyId=slug&platform=ga4</ApiCode>
              <ApiCode>GET /api/auth/google/connect/start?companyId=slug&platform=google-sheets</ApiCode>
              <ApiCode>GET /api/auth/social/connect/start?companyId=slug&platform=instagram</ApiCode>
              <ApiCode>GET /api/auth/social/connect/start?companyId=slug&platform=linkedin</ApiCode>
              <ApiCode>GET /api/auth/social/connect/start?companyId=slug&platform=tiktok</ApiCode>
              <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                O fluxo agora permite operador entrar com Google, abrir a torre de controle, navegar por cada empresa de forma isolada e conectar tambem Meta/Instagram, LinkedIn e TikTok por workspace.
              </p>
            </div>
          </Section>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="glass" style={{ padding: 18, borderRadius: 18, display: "grid", gap: 8 }}>
      <span className="muted" style={{ fontSize: 14 }}>
        {label}
      </span>
      <strong style={{ fontSize: "1.6rem" }}>{value}</strong>
    </article>
  );
}

function StatusPill({
  label,
  value,
  detail,
  tone
}: {
  label: string;
  value: string;
  detail: string;
  tone: "live" | "readiness" | "blocked";
}) {
  const toneClass = tone === "live" ? "status-live" : tone === "blocked" ? "status-blocked" : "status-readiness";

  return (
    <article className={`status-pill ${toneClass}`}>
      <span className="muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
      <strong>{value}</strong>
      <span className="muted" style={{ fontSize: 13, lineHeight: 1.45 }}>
        {detail}
      </span>
    </article>
  );
}

function PrincipleCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="glass" style={{ padding: 20, borderRadius: 22, minHeight: 148, display: "grid", alignContent: "start", gap: 10 }}>
      <span className="tag" style={{ width: "fit-content" }}>
        Agencia AI
      </span>
      <strong>{title}</strong>
      <p style={{ margin: 0, lineHeight: 1.65 }}>{body}</p>
    </article>
  );
}

function DataPoint({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 16,
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(148, 196, 208, 0.09)",
        display: "grid",
        gap: 4
      }}
    >
      <span className="muted" style={{ fontSize: 12 }}>
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}

function ApiCode({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        display: "block",
        padding: 16,
        borderRadius: 16,
        background: "rgba(4, 11, 15, 0.72)",
        border: "1px solid rgba(148, 196, 208, 0.12)",
        overflowX: "auto"
      }}
    >
      {children}
    </code>
  );
}

function Section({
  heading,
  subheading,
  children
}: {
  heading: string;
  subheading: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 6, maxWidth: 820 }}>
        <p className="eyebrow">Blueprint</p>
        <h2 className="section-title">{heading}</h2>
        <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
          {subheading}
        </p>
      </div>
      {children}
    </section>
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
