import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getSessionFromCookies } from "@/lib/session";
import { getCompanyWorkspace } from "@/lib/connectors";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

type PageProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ generated?: string }>;
};

export default async function CompanyReportsPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);
  const professionalProfile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(companyId, professionalProfile);

  if (!workspace) {
    notFound();
  }

  return (
    <main style={{ padding: "32px 0 80px" }}>
      <div className="shell" style={{ display: "grid", gap: 24 }}>
        <section className="glass" style={{ padding: 28, borderRadius: 28, display: "grid", gap: 14 }}>
          <Link href={`/empresas/${workspace.company.slug}`} className="tag" style={{ width: "fit-content" }}>
            Voltar para o workspace
          </Link>
          <p className="eyebrow">Relatorios do Agente</p>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 1.6rem + 1.5vw, 3.3rem)" }}>
            {workspace.company.name}
          </h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7, maxWidth: 900 }}>
            O agente agora consegue gerar relatorio diario de concorrentes e relatorio semanal especializado de marketing para cada empresa.
          </p>
          {professionalProfile ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.7, maxWidth: 900 }}>
              Esses relatorios tambem incorporam sua memoria profissional para ajustar prioridades, linguagem estrategica e disciplina de custo.
            </p>
          ) : null}
          {query.generated ? <div className="tag" style={{ width: "fit-content" }}>Relatorio gerado: {query.generated}</div> : null}
        </section>

        <section style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr 1fr" }}>
          <form
            action={`/api/companies/${workspace.company.slug}/reports`}
            method="post"
            className="glass"
            style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}
          >
            <h2 className="section-title">Gerar radar diario de concorrentes</h2>
            <input type="hidden" name="type" value="daily_competitor" />
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
              Gera uma leitura diaria de concorrentes, oportunidades de resposta, riscos e prioridades imediatas.
            </p>
            <button
              type="submit"
              className="tag"
              style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
              disabled={!session}
            >
              Gerar relatorio diario
            </button>
          </form>

          <form
            action={`/api/companies/${workspace.company.slug}/reports`}
            method="post"
            className="glass"
            style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}
          >
            <h2 className="section-title">Gerar relatorio semanal de marketing</h2>
            <input type="hidden" name="type" value="weekly_marketing" />
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
              Consolida metas, performance, riscos e plano tatico da proxima semana com base no perfil e no planejamento da empresa.
            </p>
            <button
              type="submit"
              className="tag"
              style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
              disabled={!session}
            >
              Gerar relatorio semanal
            </button>
          </form>
        </section>

        <section className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 18 }}>
          <h2 className="section-title">Historico de relatorios</h2>
          {workspace.reports.length === 0 ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
              Nenhum relatorio salvo ainda. Gere o primeiro relatorio para esta empresa.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              {workspace.reports.map((report) => (
                <article
                  key={report.id}
                  style={{
                    padding: 18,
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(148, 196, 208, 0.1)",
                    display: "grid",
                    gap: 12
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
                    <strong>{report.title}</strong>
                    <span className="tag">{report.type}</span>
                  </div>
                  <span className="muted">{new Date(report.generatedAt).toLocaleString("pt-BR")}</span>
                  <p style={{ margin: 0, lineHeight: 1.65 }}>{report.summary}</p>
                  <div style={{ display: "grid", gap: 10 }}>
                    <strong>Highlights</strong>
                    <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                      {report.highlights.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <strong>Acoes</strong>
                    <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                      {report.actions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  {report.sections.map((section) => (
                    <div key={section.title} style={{ display: "grid", gap: 8 }}>
                      <strong>{section.title}</strong>
                      <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                        {section.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
