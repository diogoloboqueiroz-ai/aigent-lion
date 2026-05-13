import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { buildAigentEvolutionCenterSnapshot } from "@/core/aigent-lion/evolution-center";
import { getCompanyWorkspace } from "@/lib/connectors";
import { requireCompanyPermission } from "@/lib/rbac";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";
import { EvolutionCenterClient } from "./evolution-center-client";

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function AigentEvolutionCenterPage({ params }: PageProps) {
  const { companyId } = await params;
  const session = getSessionFromCookies(await cookies());
  const professionalProfile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(companyId, professionalProfile);

  if (!workspace) {
    notFound();
  }

  const permissionCheck = requireCompanyPermission({
    companySlug: workspace.company.slug,
    profile: professionalProfile,
    permission: "governance:review",
    actor: session?.email ?? "anonymous"
  });

  if (!permissionCheck.allowed) {
    return (
      <main style={{ padding: "32px 0 88px" }}>
        <div className="shell">
          <section className="glass" style={{ padding: 28, borderRadius: 28, display: "grid", gap: 12 }}>
            <Link href={`/empresas/${workspace.company.slug}`} className="tag" style={{ width: "fit-content" }}>
              Voltar ao workspace
            </Link>
            <p className="eyebrow">Aigent Evolution Center</p>
            <h1 className="premium-hero-title">Acesso protegido pelo Policy Shield.</h1>
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
              {permissionCheck.message} Audit ID: {permissionCheck.auditId}. O Evolution Center pode gerar tarefas
              Codex acionaveis, mas nao faz merge, deploy ou mudanca sensivel sem aprovacao.
            </p>
            <div className="premium-status-strip">
              <div className="status-pill status-blocked">
                <span className="muted">Estado</span>
                <strong>Aguardando permissao</strong>
                <span className="muted">Necessario escopo governance:review para ver riscos e prompts.</span>
              </div>
              <div className="status-pill status-readiness">
                <span className="muted">Modo seguro</span>
                <strong>Sem merge automatico</strong>
                <span className="muted">O centro gera plano e evidencia; execucao continua humana/approval-first.</span>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const snapshot = await buildAigentEvolutionCenterSnapshot({
    companyId: workspace.company.slug,
    actor: session?.email ?? "anonymous",
    message: "Aigent Evolution Center initial audit.",
    intent: "mission_control",
    autonomy: "approval_required",
    professionalProfile: professionalProfile ?? undefined
  });

  if (!snapshot) {
    notFound();
  }

  return (
    <main style={{ padding: "32px 0 88px" }}>
      <div className="shell" style={{ display: "grid", gap: 24 }}>
        <section style={heroStyle}>
          <div className="premium-nav">
            <Link href={`/empresas/${workspace.company.slug}/mission-control`} className="tag">
              Voltar ao Mission Control
            </Link>
            <div className="premium-nav-actions">
              <Link href={`/empresas/${workspace.company.slug}/aigent`} className="tag">Aigent Chat</Link>
              <Link href={`/empresas/${workspace.company.slug}/social/runtime`} className="tag">Runtime</Link>
              <Link href={`/empresas/${workspace.company.slug}/aprovacoes`} className="tag">Aprovacoes</Link>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12, maxWidth: 1080 }}>
            <p className="eyebrow">Aigent Evolution Center</p>
            <h1 className="premium-hero-title">O cerebro agora revisa a si mesmo.</h1>
            <p className="muted" style={{ margin: 0, lineHeight: 1.75, fontSize: "1.05rem" }}>
              {snapshot.selfImprovement.summary}
            </p>
          </div>
          <div className="premium-status-strip">
            <div className="status-pill status-live">
              <span className="muted">Motor conectado</span>
              <strong>Self-Improvement real</strong>
              <span className="muted">Usa sinais do runtime, gates, policy, learning e maturidade do agente.</span>
            </div>
            <div className="status-pill status-readiness">
              <span className="muted">Limite operacional</span>
              <strong>Nao faz merge/deploy</strong>
              <span className="muted">Tarefas Codex exigem revisao; alto risco exige aprovacao.</span>
            </div>
            <div className={`status-pill ${snapshot.releaseRisk.requiresApproval ? "status-blocked" : "status-live"}`}>
              <span className="muted">Release risk</span>
              <strong>{snapshot.releaseRisk.requiresApproval ? "Approval required" : "Safe to continue"}</strong>
              <span className="muted">Baseado em risco, arquivos afetados, policy e gates.</span>
            </div>
          </div>

          <div className="grid-auto">
            <HeroMetric label="Maturity" value={`${snapshot.selfImprovement.systemMaturityScore}/100`} />
            <HeroMetric label="Release risk" value={snapshot.releaseRisk.level} />
            <HeroMetric label="Codex tasks" value={String(snapshot.codexTasks.length)} />
            <HeroMetric label="Quality gates" value={`${snapshot.qualityGates.filter((gate) => gate.status === "pass").length}/${snapshot.qualityGates.length}`} />
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 18 }}>
          {snapshot.qualityGates.map((gate) => (
            <article key={gate.id} className="glass" style={{ padding: 18, borderRadius: 20, display: "grid", gap: 8 }}>
              <span className="tag" style={{ width: "fit-content" }}>{gate.status}</span>
              <strong>{gate.label}</strong>
              <span className="muted" style={{ lineHeight: 1.55 }}>{gate.summary}</span>
            </article>
          ))}
        </section>

        <EvolutionCenterClient
          companySlug={workspace.company.slug}
          initialSnapshot={snapshot}
        />
      </div>
    </main>
  );
}

function HeroMetric(props: { label: string; value: string }) {
  return (
    <article className="glass" style={{ padding: 18, borderRadius: 20 }}>
      <span className="muted" style={{ fontSize: 13 }}>{props.label}</span>
      <strong style={{ display: "block", fontSize: "1.55rem", marginTop: 6 }}>{props.value}</strong>
    </article>
  );
}

const heroStyle = {
  padding: 30,
  borderRadius: 34,
  display: "grid",
  gap: 24,
  border: "1px solid rgba(244, 199, 120, 0.22)",
  background:
    "radial-gradient(circle at 18% 12%, rgba(244, 199, 120, 0.2), transparent 31%), radial-gradient(circle at 82% 16%, rgba(126, 224, 179, 0.18), transparent 30%), rgba(6, 15, 21, 0.92)",
  boxShadow: "0 30px 90px rgba(0, 0, 0, 0.34)"
};
