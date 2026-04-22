import Link from "next/link";
import {
  getApprovalLabel,
  getCoverageLabel,
  getMarketingToolbox,
  getMarketingToolboxSummary,
  getMarketingVendorFamilies
} from "@/lib/marketing-toolbox";

export default function MartechStackPage() {
  const categories = getMarketingToolbox();
  const summary = getMarketingToolboxSummary();
  const vendorFamilies = getMarketingVendorFamilies();

  return (
    <main style={{ padding: "32px 0 80px" }}>
      <div className="shell" style={{ display: "grid", gap: 24 }}>
        <section className="glass" style={{ padding: 28, borderRadius: 28, display: "grid", gap: 16 }}>
          <Link href="/" className="tag" style={{ width: "fit-content" }}>
            Voltar para control tower
          </Link>
          <p className="eyebrow">Stack Martech Expert</p>
          <h1 style={{ margin: 0, fontSize: "clamp(2.2rem, 1.7rem + 1.8vw, 3.8rem)" }}>
            Expertise do agente nas ferramentas mais usadas em marketing
          </h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.75, maxWidth: 980 }}>
            Esta camada transforma o agente em operador de stack completo. Ele passa a raciocinar como especialista de analytics, CRM, midia paga, SEO, automacao, social, criacao e operacao, respeitando o nivel real de integracao e as regras de aprovacao.
          </p>
          <div className="grid-auto">
            <MetricCard label="Categorias" value={String(summary.categories)} />
            <MetricCard label="Ferramentas mapeadas" value={String(summary.tools)} />
            <MetricCard label="Integradas agora" value={String(summary.integrated)} />
            <MetricCard label="Prontas para OAuth/API" value={String(summary.oauthOrApiReady)} />
            <MetricCard label="Browser-assisted" value={String(summary.browserAssisted)} />
            <MetricCard label="Playbooks" value={String(summary.playbookReady)} />
          </div>
        </section>

        <section style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gap: 6, maxWidth: 860 }}>
            <p className="eyebrow">Suites dominadas</p>
            <h2 className="section-title">Google, Meta, Adobe, Canva e demais stacks</h2>
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
              O agente agora deixa explicito em quais suites ele atua para analise de dados, edicao, criacao, operacao e distribuicao.
            </p>
          </div>
          <div className="grid-auto">
            {vendorFamilies.map((family) => (
              <article key={family.vendor} className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <strong>{family.vendor}</strong>
                  <span className="tag">{family.tools.length} ferramentas</span>
                </div>
                <p style={{ margin: 0, lineHeight: 1.65 }}>
                  {family.tools.slice(0, 4).map((tool) => tool.name).join(", ")}
                </p>
                <div className="grid-auto" style={{ gap: 12 }}>
                  <InfoCard label="Integradas" value={String(family.integrated)} />
                  <InfoCard label="API/OAuth" value={String(family.apiReady)} />
                </div>
              </article>
            ))}
          </div>
        </section>

        {categories.map((category) => (
          <section key={category.id} style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gap: 6, maxWidth: 860 }}>
              <p className="eyebrow">Categoria</p>
              <h2 className="section-title">{category.label}</h2>
              <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
                {category.summary}
              </p>
            </div>
            <div className="grid-auto">
              {category.tools.map((tool) => (
                <article key={tool.id} className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <strong>{tool.name}</strong>
                    <span className="tag">{getCoverageLabel(tool.coverage)}</span>
                  </div>
                  <span className="muted">
                    {tool.vendor} · {tool.marketRole}
                  </span>
                  <p style={{ margin: 0, lineHeight: 1.65 }}>{tool.whyItMatters}</p>
                  <div className="grid-auto" style={{ gap: 12 }}>
                    <InfoCard label="Aprovacao" value={getApprovalLabel(tool.approval)} />
                    <InfoCard label="Capacidades" value={tool.capabilities.slice(0, 3).join(", ")} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
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
      <strong style={{ fontSize: "1.4rem" }}>{value}</strong>
    </article>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="glass" style={{ padding: 14, borderRadius: 16, display: "grid", gap: 6 }}>
      <span className="muted" style={{ fontSize: 12 }}>
        {label}
      </span>
      <strong>{value}</strong>
    </article>
  );
}
