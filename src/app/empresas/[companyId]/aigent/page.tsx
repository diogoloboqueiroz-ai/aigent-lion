import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AigentChatClient } from "@/app/empresas/[companyId]/aigent/aigent-chat-client";
import { buildMissionControlSnapshot } from "@/core/aigent-lion/mission-control";
import { getCompanyWorkspace } from "@/lib/connectors";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function AigentLionChatPage({ params }: PageProps) {
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

  return (
    <main style={{ padding: "32px 0 88px" }}>
      <div className="shell" style={{ display: "grid", gap: 24 }}>
        <section
          className="glass"
          style={{
            padding: 30,
            borderRadius: 30,
            display: "grid",
            gap: 18,
            background:
              "linear-gradient(135deg, rgba(126, 224, 179, 0.14), rgba(244, 199, 120, 0.08)), rgba(8, 16, 24, 0.76)"
          }}
        >
          <div className="premium-nav">
            <Link href={`/empresas/${workspace.company.slug}`} className="tag">
              Voltar ao workspace
            </Link>
            <Link href={`/empresas/${workspace.company.slug}/mission-control`} className="tag">
              Mission Control
            </Link>
          </div>
          <div style={{ display: "grid", gap: 10, maxWidth: 980 }}>
            <p className="eyebrow">Supreme Brain</p>
            <h1 className="premium-hero-title">
              O Aigent Lion opera como um time inteiro de crescimento.
            </h1>
            <p className="muted" style={{ margin: 0, lineHeight: 1.75, fontSize: "1.04rem" }}>
              Fale com o cerebro operacional para diagnosticar, planejar, criar campanha, gerar assets, avaliar risco e
              decidir o proximo passo. Ele nao e um chatbot: ele responde com contexto, policy, artefatos e proximas acoes.
            </p>
          </div>
          <div className="premium-status-strip">
            <div className="status-pill status-readiness">
              <span className="muted">Modo de execucao</span>
              <strong>Advisory seguro</strong>
              <span className="muted">O chat prepara decisoes; acoes sensiveis exigem policy/approval.</span>
            </div>
            <div className="status-pill status-live">
              <span className="muted">Agentes internos</span>
              <strong>Supreme Brain + especialistas</strong>
              <span className="muted">CMO, Campaign OS, Creative, Analytics, Learning e Compliance.</span>
            </div>
            <div className="status-pill status-readiness">
              <span className="muted">Dados usados</span>
              <strong>Workspace + runtime snapshot</strong>
              <span className="muted">Quando um conector nao esta pronto, o Lion sinaliza readiness/mock.</span>
            </div>
          </div>
          <div className="grid-auto">
            <MetricCard label="Gargalo" value={snapshot?.cmoDecision.dominantConstraint ?? "n/d"} detail="CMO Thesis" />
            <MetricCard label="Readiness" value={`${snapshot?.campaignOS.launchReadiness.score ?? 0}/100`} detail="Campaign OS" />
            <MetricCard label="Trust" value={`${snapshot?.controlTower.health.trustScore ?? 0}/100`} detail="Execution Plane" />
            <MetricCard label="Aprovacoes" value={String(snapshot?.approvals.totalPending ?? 0)} detail="Policy Shield" />
          </div>
        </section>

        <AigentChatClient companyId={workspace.company.slug} />
      </div>
    </main>
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
