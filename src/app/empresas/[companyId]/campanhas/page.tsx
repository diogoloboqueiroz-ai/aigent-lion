import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { buildCampaignIntelligenceBrief } from "@/core/marketing/campaign-intelligence";
import { runCmoAgent } from "@/lib/agents/cmo-agent";
import { buildCompanyContext } from "@/lib/agents/memory-engine";
import { getStoredCampaignIntelligenceBriefs } from "@/lib/company-vault";
import { getCompanyWorkspace } from "@/lib/connectors";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";
import type { TriggerEvent } from "@/lib/agents/types";

type PageProps = {
  params: Promise<{ companyId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CompanyCampaignsPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const query = (await searchParams) ?? {};
  const session = getSessionFromCookies(await cookies());
  const professionalProfile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(companyId, professionalProfile);

  if (!workspace) {
    notFound();
  }

  const trigger = buildCampaignPageTrigger(workspace.company.slug, session?.email);
  const context = buildCompanyContext({
    workspace,
    trigger
  });
  const cmoDecision = runCmoAgent(context);
  const brief = buildCampaignIntelligenceBrief({
    workspace,
    cmoDecision
  });
  const savedBriefs = getStoredCampaignIntelligenceBriefs(workspace.company.slug);
  const wasSaved = query.saved === "1";

  return (
    <main style={{ padding: "32px 0 88px" }}>
      <div className="shell" style={{ display: "grid", gap: 24 }}>
        <section
          className="glass"
          style={{
            padding: 30,
            borderRadius: 30,
            display: "grid",
            gap: 22,
            background:
              "linear-gradient(135deg, rgba(244, 199, 120, 0.12), rgba(71, 161, 177, 0.06)), rgba(8, 16, 24, 0.72)"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <Link href={`/empresas/${workspace.company.slug}`} className="tag" style={{ width: "fit-content" }}>
              Voltar ao workspace
            </Link>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {session ? (
                <>
                  <form
                    action={`/api/companies/${workspace.company.slug}/campaign-intelligence`}
                    method="post"
                  >
                    <input type="hidden" name="intent" value="materialize" />
                    <button type="submit" className="tag" style={buttonResetStyle}>
                      Materializar brief
                    </button>
                  </form>
                  <form
                    action={`/api/companies/${workspace.company.slug}/campaign-intelligence`}
                    method="post"
                  >
                    <input type="hidden" name="intent" value="prepare-drafts" />
                    <button type="submit" className="tag" style={buttonResetStyle}>
                      Preparar drafts seguros
                    </button>
                  </form>
                </>
              ) : null}
              <span className="tag">Campaign Intelligence v1</span>
            </div>
          </div>
          {wasSaved ? (
            <div style={savedBannerStyle}>
              Brief v{String(query.version ?? savedBriefs[0]?.version ?? "nova")} salvo na memoria operacional da empresa.
            </div>
          ) : null}
          {query.drafts === "1" ? (
            <div style={savedBannerStyle}>
              Drafts preparados com seguranca: {String(query.posts ?? 0)} posts e {String(query.ads ?? 0)} ads, todos pendentes de aprovacao.
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 10, maxWidth: 980 }}>
            <p className="eyebrow">Central premium de campanhas</p>
            <h1 style={{ margin: 0, fontSize: "clamp(2.2rem, 1.55rem + 2vw, 4.1rem)", letterSpacing: "-0.055em" }}>
              O cerebro traduz estrategia em campanha acionavel.
            </h1>
            <p className="muted" style={{ margin: 0, lineHeight: 1.75, fontSize: "1.02rem" }}>
              {brief.executiveSummary}
            </p>
          </div>
          <div className="grid-auto">
            <MetricCard label="Readiness" value={`${brief.readinessScore}/100`} detail="Prontidao antes de scale" />
            <MetricCard label="Gargalo dominante" value={brief.dominantConstraint} detail={brief.analyticsPlan.targetMetric} />
            <MetricCard label="Canais planejados" value={String(brief.channels.length)} detail="Com status e proximas acoes" />
            <MetricCard label="Experimentos" value={String(brief.experiments.length)} detail="Com janela e criterios" />
          </div>
        </section>

        <section className="glass" style={{ padding: 26, borderRadius: 26, display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <p className="eyebrow">Tese da semana</p>
            <h2 className="section-title">{brief.primaryBet}</h2>
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>{brief.weeklyThesis}</p>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {brief.nextBestActions.map((action) => (
              <div key={action} style={actionRowStyle}>
                <strong>Next best action</strong>
                <span className="muted">{action}</span>
              </div>
            ))}
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
          <article className="glass" style={{ padding: 24, borderRadius: 24, display: "grid", gap: 16 }}>
            <div>
              <p className="eyebrow">Funil</p>
              <h2 className="section-title">Do sinal ao aprendizado</h2>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {brief.funnel.map((stage) => (
                <div key={stage.stage} style={panelStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <strong style={{ textTransform: "capitalize" }}>{stage.stage}</strong>
                    <span className="tag">{stage.metrics.slice(0, 2).join(" / ")}</span>
                  </div>
                  <p style={{ margin: 0, lineHeight: 1.65 }}>{stage.objective}</p>
                  <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>{stage.currentBottleneck}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="glass" style={{ padding: 24, borderRadius: 24, display: "grid", gap: 16 }}>
            <div>
              <p className="eyebrow">Riscos e governanca</p>
              <h2 className="section-title">O que impede auto-execucao segura</h2>
            </div>
            {brief.risks.length > 0 ? (
              <div style={{ display: "grid", gap: 10 }}>
                {brief.risks.map((risk) => (
                  <div key={risk} style={riskStyle}>{risk}</div>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>Nenhum risco critico detectado para este brief.</p>
            )}
            <div style={panelStyle}>
              <strong>Plano de analytics</strong>
              <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>{brief.analyticsPlan.baselineSummary}</p>
              <span className="tag" style={{ width: "fit-content" }}>{brief.analyticsPlan.reportingCadence}</span>
            </div>
          </article>
        </section>

        <section className="glass" style={{ padding: 24, borderRadius: 24, display: "grid", gap: 16 }}>
          <div>
            <p className="eyebrow">Canais</p>
            <h2 className="section-title">Plano multicanal orientado por performance</h2>
          </div>
          <div className="grid-auto" style={{ alignItems: "stretch" }}>
            {brief.channels.map((channel) => (
              <article key={channel.channel} style={{ ...panelStyle, minHeight: 220 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <strong>{channel.label}</strong>
                  <span className="tag">{channel.readiness}</span>
                </div>
                <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>{channel.role}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span className="tag">{channel.recommendedDecision}</span>
                  <span className="tag">{formatPercent(channel.confidence)} confianca</span>
                </div>
                <p style={{ margin: 0, lineHeight: 1.6 }}>{channel.nextActions[0]}</p>
              </article>
            ))}
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
          <article className="glass" style={{ padding: 24, borderRadius: 24, display: "grid", gap: 16 }}>
            <div>
              <p className="eyebrow">Copy intelligence</p>
              <h2 className="section-title">Angles prontos para especialistas</h2>
            </div>
            {brief.copyAngles.slice(0, 4).map((angle) => (
              <div key={angle.id} style={panelStyle}>
                <strong>{angle.title}</strong>
                <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>{angle.promise}</p>
                <span className="tag" style={{ width: "fit-content" }}>{angle.funnelStage}</span>
              </div>
            ))}
          </article>

          <article className="glass" style={{ padding: 24, borderRadius: 24, display: "grid", gap: 16 }}>
            <div>
              <p className="eyebrow">Multimodal</p>
              <h2 className="section-title">Prompts visuais com QA e risco</h2>
            </div>
            {brief.visualPrompts.slice(0, 4).map((prompt) => (
              <div key={prompt.id} style={panelStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <strong>{prompt.assetType}</strong>
                  <span className="tag">{prompt.format}</span>
                </div>
                <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>{prompt.prompt}</p>
              </div>
            ))}
          </article>
        </section>

        <section className="glass" style={{ padding: 24, borderRadius: 24, display: "grid", gap: 16 }}>
          <div>
            <p className="eyebrow">Experimentos</p>
            <h2 className="section-title">Aprendizado fechado, nao achismo</h2>
          </div>
          <div className="grid-auto">
            {brief.experiments.map((experiment) => (
              <article key={experiment.id} style={panelStyle}>
                <strong>{experiment.title}</strong>
                <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>{experiment.hypothesis}</p>
                <span className="tag" style={{ width: "fit-content" }}>
                  {experiment.targetMetric} / {experiment.observationWindowDays}d
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="glass" style={{ padding: 24, borderRadius: 24, display: "grid", gap: 16 }}>
          <div>
            <p className="eyebrow">Memoria de campanha</p>
            <h2 className="section-title">Briefs materializados por tenant</h2>
            <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
              Cada materializacao vira historico auditavel para comparar tese, readiness, canais e experimentos ao longo do tempo.
            </p>
          </div>
          {savedBriefs.length > 0 ? (
            <div className="grid-auto">
              {savedBriefs.slice(0, 6).map((savedBrief) => (
                <article key={`${savedBrief.id}-${savedBrief.version}`} style={panelStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <strong>v{savedBrief.version} / {savedBrief.dominantConstraint}</strong>
                    <span className="tag">{savedBrief.readinessScore}/100</span>
                  </div>
                  <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>{savedBrief.primaryBet}</p>
                  <span className="muted">
                    Salvo por {savedBrief.savedBy} em {new Date(savedBrief.savedAt).toLocaleString("pt-BR")}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <div style={panelStyle}>
              <strong>Nenhum brief materializado ainda.</strong>
              <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                Gere o primeiro registro para transformar esta leitura estrategica em memoria operacional comparavel.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function buildCampaignPageTrigger(companySlug: string, actor?: string): TriggerEvent {
  const createdAt = new Date().toISOString();

  return {
    id: `campaign-page-${companySlug}-${Date.parse(createdAt)}`,
    companySlug,
    type: "api_preview",
    actor: actor ?? "agent-lion",
    summary: "Renderizacao da central de campanhas.",
    createdAt
  };
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div style={metricCardStyle}>
      <span className="muted">{label}</span>
      <strong style={{ fontSize: "1.6rem", letterSpacing: "-0.04em" }}>{value}</strong>
      <span className="muted">{detail}</span>
    </div>
  );
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

const panelStyle: CSSProperties = {
  padding: 16,
  borderRadius: 20,
  display: "grid",
  gap: 10,
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(148, 196, 208, 0.12)"
};

const actionRowStyle: CSSProperties = {
  ...panelStyle,
  gridTemplateColumns: "180px minmax(0, 1fr)",
  alignItems: "center"
};

const riskStyle: CSSProperties = {
  padding: 14,
  borderRadius: 18,
  background: "rgba(255, 179, 102, 0.08)",
  border: "1px solid rgba(255, 179, 102, 0.22)",
  lineHeight: 1.6
};

const metricCardStyle: CSSProperties = {
  padding: 18,
  borderRadius: 22,
  display: "grid",
  gap: 8,
  background: "rgba(255,255,255,0.045)",
  border: "1px solid rgba(244, 199, 120, 0.16)"
};

const buttonResetStyle: CSSProperties = {
  cursor: "pointer",
  font: "inherit"
};

const savedBannerStyle: CSSProperties = {
  padding: 14,
  borderRadius: 18,
  background: "rgba(107, 226, 179, 0.1)",
  border: "1px solid rgba(107, 226, 179, 0.24)",
  color: "#d9ffee"
};
