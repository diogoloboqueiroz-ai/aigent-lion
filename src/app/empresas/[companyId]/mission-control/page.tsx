import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { buildMissionControlSnapshot } from "@/core/aigent-lion/mission-control";
import { getCompanyWorkspace } from "@/lib/connectors";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function MissionControlPage({ params }: PageProps) {
  const { companyId } = await params;
  const session = getSessionFromCookies(await cookies());
  const professionalProfile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(companyId, professionalProfile);

  if (!workspace) {
    notFound();
  }

  const snapshot = await buildMissionControlSnapshot({
    companyId: workspace.company.slug,
    actor: session?.email ?? "anonymous",
    intent: "mission_control",
    professionalProfile: professionalProfile ?? undefined
  });

  if (!snapshot) {
    notFound();
  }

  const tower = snapshot.controlTower;

  return (
    <main style={{ padding: "32px 0 88px" }}>
      <div className="shell" style={{ display: "grid", gap: 24 }}>
        <section style={heroStyle}>
          <div className="premium-nav">
            <Link href={`/empresas/${workspace.company.slug}`} className="tag">
              Voltar ao workspace
            </Link>
            <div className="premium-nav-actions">
              <Link href={`/empresas/${workspace.company.slug}/aigent`} className="tag">Chat operacional</Link>
              <Link href={`/empresas/${workspace.company.slug}/evolution-center`} className="tag">Evolution Center</Link>
              <Link href={`/empresas/${workspace.company.slug}/social/runtime`} className="tag">Execution Plane</Link>
              <Link href={`/empresas/${workspace.company.slug}/aprovacoes`} className="tag">Aprovacoes</Link>
            </div>
          </div>
          <div style={{ display: "grid", gap: 12, maxWidth: 1050 }}>
            <p className="eyebrow">Mission Control</p>
            <h1 className="premium-hero-title">
              Supreme Brain em comando operacional.
            </h1>
            <p className="muted" style={{ margin: 0, lineHeight: 1.75, fontSize: "1.05rem" }}>
              {snapshot.supremeBrain.executiveSummary}
            </p>
          </div>
          <div className="premium-status-strip">
            <StatusPill
              label="Fonte dos sinais"
              value="Snapshot + runtime"
              detail="KPIs e conectores podem estar em readiness ate as credenciais reais entrarem."
              tone="readiness"
            />
            <StatusPill
              label="Autonomia ativa"
              value={tower.health.autoExecutionRate > 0 ? "Low-risk ligada" : "Advisory / approval-first"}
              detail="Acoes sensiveis continuam passando por policy e approval."
              tone={tower.health.autoExecutionRate > 0 ? "live" : "readiness"}
            />
            <StatusPill
              label="Proximo passo"
              value={snapshot.actions[0]?.title ?? "Rodar ciclo do agente"}
              detail={snapshot.actions[0]?.requiresApproval ? "Precisa de aprovacao antes de executar." : "Pode seguir como preparacao segura."}
              tone={snapshot.actions[0]?.requiresApproval ? "blocked" : "live"}
            />
          </div>
          <div className="grid-auto">
            <MetricCard label="Gargalo dominante" value={snapshot.cmoDecision.dominantConstraint} detail={snapshot.cmoDecision.focusMetric} />
            <MetricCard label="Trust score" value={`${tower.health.trustScore}/100`} detail={`Runtime ${tower.health.runtimeStatus}`} />
            <MetricCard label="Campaign readiness" value={`${snapshot.campaignOS.launchReadiness.score}/100`} detail={snapshot.campaignOS.launchReadiness.status} />
            <MetricCard label="Evolution maturity" value={`${snapshot.selfImprovement.systemMaturityScore}/100`} detail={`Release ${snapshot.selfImprovement.releaseRisk.level}`} />
            <MetricCard label="Autonomia" value={`${Math.round(tower.health.autoExecutionRate * 100)}%`} detail="Auto-execution rate" />
          </div>
        </section>

        <section style={twoColumnStyle}>
          <Panel title="Estado do cerebro" eyebrow="Execution Plane">
            <div className="grid-auto">
              <MiniMetric label="Worker" value={tower.workerHealth.status} />
              <MiniMetric label="Execution plane" value={tower.workerHealth.expectedMode} />
              <MiniMetric label="Queue" value={String(tower.totals.queuedItems)} />
              <MiniMetric label="Dead letters" value={String(tower.totals.deadLetters)} />
              <MiniMetric label="Circuit breakers" value={String(tower.queuePressure.openCircuitBreakers)} />
              <MiniMetric label="Observability" value={tower.observabilityChannel.health} />
            </div>
          </Panel>

          <Panel title="Diagnostico atual" eyebrow="Growth Radar">
            <div style={{ display: "grid", gap: 10 }}>
              {snapshot.findings.slice(0, 5).map((finding) => (
                <SignalRow
                  key={finding.id}
                  title={finding.summary}
                  meta={`${finding.area} | ${finding.severity} | conf ${Math.round(finding.confidence * 100)}%`}
                  detail={finding.evidence[0] ?? finding.suspectedRootCause}
                />
              ))}
            </div>
          </Panel>
        </section>

        <section style={twoColumnStyle}>
          <Panel title="CMO Thesis da semana" eyebrow="Strategy">
            <div style={{ display: "grid", gap: 12 }}>
              <h3 style={panelTitleStyle}>{snapshot.cmoDecision.primaryBet}</h3>
              <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>{snapshot.cmoDecision.weeklyThesis}</p>
              <p style={{ margin: 0, lineHeight: 1.7 }}>{snapshot.cmoDecision.rationale}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {snapshot.cmoDecision.delegatedModules.map((module) => (
                  <span key={module} className="tag">{module}</span>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="Next Best Actions" eyebrow="Decision Engine">
            <div style={{ display: "grid", gap: 10 }}>
              {snapshot.actions.slice(0, 6).map((action) => (
                <SignalRow
                  key={action.id}
                  title={action.title}
                  meta={`impact ${action.impact} | urgency ${action.urgency} | risk ${action.risk}`}
                  detail={`${action.policyStatus ?? "policy pending"} | ${action.requiresApproval ? "approval required" : "auto-safe"}`}
                  href={action.href}
                />
              ))}
            </div>
          </Panel>
        </section>

        <section style={threeColumnStyle}>
          <Panel title="Campaign OS" eyebrow="Campaigns">
            <div style={{ display: "grid", gap: 10 }}>
              <MiniMetric label="Readiness" value={`${snapshot.campaignOS.launchReadiness.score}/100`} />
              <MiniMetric label="Canais" value={String(snapshot.campaignOS.channels.length)} />
              <MiniMetric label="Experimentos" value={String(snapshot.campaignOS.experiments.length)} />
              <MiniMetric label="Ads drafts" value={String(snapshot.campaignOS.adDrafts.length)} />
              <span className="muted" style={{ lineHeight: 1.55 }}>
                Status: campanha pronta para planejamento; lancamento real depende de conectores e approvals.
              </span>
              <Link href={`/empresas/${workspace.company.slug}/campanhas`} className="tag" style={{ width: "fit-content" }}>
                Abrir Campaign OS
              </Link>
            </div>
          </Panel>

          <Panel title="Learning Memory" eyebrow="Aprendizado">
            <div style={{ display: "grid", gap: 10 }}>
              {snapshot.learning.recentLearnings.slice(0, 4).map((learning) => (
                <span key={learning} className="muted" style={{ lineHeight: 1.55 }}>{learning}</span>
              ))}
              <MiniMetric label="Playbooks" value={String(snapshot.learning.playbooks.length)} />
              <MiniMetric label="Outcomes" value={String(snapshot.learning.outcomes.length)} />
            </div>
          </Panel>

          <Panel title="Creative Engine" eyebrow="Multimodal">
            <div style={{ display: "grid", gap: 10 }}>
              <MiniMetric label="Image prompts" value={String(snapshot.campaignOS.visualAssets.length)} />
              <MiniMetric label="Video scripts" value={String(snapshot.campaignOS.videoAssets.length)} />
              <MiniMetric label="Creative QA" value={`${snapshot.campaignOS.creativeQaScore}/100`} />
              <span className="muted" style={{ lineHeight: 1.55 }}>
                Status: prompts e roteiros preparados; geracao externa depende do conector criativo escolhido.
              </span>
              {snapshot.campaignOS.videoAssets.slice(0, 2).map((asset) => (
                <span key={asset.id} className="muted" style={{ lineHeight: 1.55 }}>{asset.hook}</span>
              ))}
            </div>
          </Panel>
        </section>

        <section style={twoColumnStyle}>
          <Panel title="Self-Improvement Engine" eyebrow="Evolution">
            <div style={{ display: "grid", gap: 10 }}>
              <MiniMetric label="Maturity" value={`${snapshot.selfImprovement.systemMaturityScore}/100`} />
              <MiniMetric label="Release risk" value={`${snapshot.selfImprovement.releaseRisk.score}/100 ${snapshot.selfImprovement.releaseRisk.level}`} />
              <MiniMetric label="Codex tasks" value={String(snapshot.selfImprovement.codexTasks.length)} />
              {snapshot.selfImprovement.recommendations.slice(0, 3).map((recommendation) => (
                <SignalRow
                  key={recommendation.id}
                  title={recommendation.title}
                  meta={`${recommendation.priority} | ${recommendation.area}`}
                  detail={recommendation.summary}
                  href={`/empresas/${workspace.company.slug}/evolution-center`}
                />
              ))}
            </div>
          </Panel>

          <Panel title="Risk & Policy Shield" eyebrow="Governanca">
            <div style={{ display: "grid", gap: 10 }}>
              <MiniMetric label="Aprovacoes sociais" value={String(snapshot.approvals.pendingSocial)} />
              <MiniMetric label="Pagamentos" value={String(snapshot.approvals.pendingPayments)} />
              <MiniMetric label="Total pendente" value={String(snapshot.approvals.totalPending)} />
              <span className="muted" style={{ lineHeight: 1.55 }}>
                O agente pode preparar trabalho, mas mutacoes sensiveis ficam presas no Policy Shield.
              </span>
              {snapshot.supremeBrain.approvalsRequired.slice(0, 4).map((approval) => (
                <SignalRow key={approval.id} title={approval.title} meta={approval.policyStatus} detail={approval.summary} />
              ))}
            </div>
          </Panel>

          <Panel title="Acoes rapidas" eyebrow="Operate">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href={`/empresas/${workspace.company.slug}/aigent`} className="tag">Falar com Supreme Brain</Link>
              <Link href={`/empresas/${workspace.company.slug}/evolution-center`} className="tag">Abrir Evolution Center</Link>
              <Link href={`/empresas/${workspace.company.slug}/social/runtime`} className="tag">Ver runtime</Link>
              <Link href={`/empresas/${workspace.company.slug}/aprovacoes`} className="tag">Abrir aprovacoes</Link>
              <form action={`/api/companies/${workspace.company.slug}/campaign-intelligence`} method="post">
                <input type="hidden" name="intent" value="prepare-drafts" />
                <button type="submit" className="tag" style={buttonStyle}>Criar drafts seguros</button>
              </form>
            </div>
            <pre style={answerStyle}>{snapshot.supremeBrain.answer}</pre>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Panel(props: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <article className="glass" style={{ padding: 24, borderRadius: 26, display: "grid", gap: 16 }}>
      <div>
        <p className="eyebrow">{props.eyebrow}</p>
        <h2 className="section-title">{props.title}</h2>
      </div>
      {props.children}
    </article>
  );
}

function MetricCard(props: { label: string; value: string; detail: string }) {
  return (
    <article className="glass" style={{ padding: 18, borderRadius: 20 }}>
      <span className="muted" style={{ fontSize: 13 }}>{props.label}</span>
      <strong style={{ display: "block", fontSize: "1.55rem", marginTop: 6 }}>{props.value}</strong>
      <span className="muted" style={{ fontSize: 13 }}>{props.detail}</span>
    </article>
  );
}

function MiniMetric(props: { label: string; value: string }) {
  return (
    <div style={miniMetricStyle}>
      <span className="muted">{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function StatusPill(props: {
  label: string;
  value: string;
  detail: string;
  tone: "live" | "readiness" | "blocked";
}) {
  return (
    <div className={`status-pill status-${props.tone}`}>
      <span className="muted">{props.label}</span>
      <strong>{props.value}</strong>
      <span className="muted" style={{ lineHeight: 1.45 }}>{props.detail}</span>
    </div>
  );
}

function SignalRow(props: { title: string; meta: string; detail: string; href?: string }) {
  const content = (
    <div style={signalRowStyle}>
      <strong className="premium-scroll-safe">{props.title}</strong>
      <span className="tag" style={{ width: "fit-content" }}>{props.meta}</span>
      <span className="muted" style={{ lineHeight: 1.55 }}>{props.detail}</span>
    </div>
  );

  return props.href ? <Link href={props.href}>{content}</Link> : content;
}

const heroStyle = {
  padding: 30,
  borderRadius: 34,
  display: "grid",
  gap: 24,
  border: "1px solid rgba(126, 224, 179, 0.2)",
  background:
    "radial-gradient(circle at 18% 12%, rgba(126, 224, 179, 0.22), transparent 32%), radial-gradient(circle at 82% 18%, rgba(244, 199, 120, 0.14), transparent 28%), rgba(6, 15, 21, 0.9)",
  boxShadow: "0 30px 90px rgba(0, 0, 0, 0.34)"
};

const twoColumnStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
  gap: 18
};

const threeColumnStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
  gap: 18
};

const panelTitleStyle = {
  margin: 0,
  fontSize: "1.35rem",
  letterSpacing: "-0.03em"
};

const miniMetricStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  border: "1px solid rgba(148, 196, 208, 0.14)",
  borderRadius: 16,
  padding: "12px 14px",
  background: "rgba(255, 255, 255, 0.035)"
};

const signalRowStyle = {
  border: "1px solid rgba(148, 196, 208, 0.14)",
  borderRadius: 18,
  padding: 14,
  background: "rgba(255, 255, 255, 0.035)",
  display: "grid",
  gap: 8
};

const buttonStyle = {
  cursor: "pointer",
  border: "1px solid rgba(126, 224, 179, 0.24)"
};

const answerStyle = {
  whiteSpace: "pre-wrap" as const,
  margin: 0,
  border: "1px solid rgba(126, 224, 179, 0.12)",
  borderRadius: 20,
  padding: 16,
  background: "rgba(2, 8, 12, 0.66)",
  color: "var(--foreground)",
  lineHeight: 1.58,
  fontFamily: "inherit",
  maxHeight: 460,
  overflow: "auto"
};
