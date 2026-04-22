import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getCompanyWorkspace } from "@/lib/connectors";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

type PageProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ decision?: string }>;
};

export default async function CompanyApprovalsPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);
  const professionalProfile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(companyId, professionalProfile);

  if (!workspace) {
    notFound();
  }

  const pendingItems = workspace.approvalsCenter.filter((item) => item.actions.length > 0);
  const completedItems = workspace.approvalsCenter.filter((item) => item.actions.length === 0);

  return (
    <main style={{ padding: "32px 0 80px" }}>
      <div className="shell" style={{ display: "grid", gap: 24 }}>
        <section className="glass" style={{ padding: 28, borderRadius: 28, display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href={`/empresas/${workspace.company.slug}`} className="tag">
              Voltar para o workspace
            </Link>
            <Link href={`/empresas/${workspace.company.slug}/scheduler`} className="tag">
              Abrir scheduler
            </Link>
          </div>
          <p className="eyebrow">Approval Center</p>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 1.6rem + 1.5vw, 3.2rem)" }}>{workspace.company.name}</h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7, maxWidth: 940 }}>
            Esta e a caixa unificada de aprovacoes do Agent Lion. Tudo que envolve risco financeiro, publicacao, anuncio ou disparo sensivel cai aqui antes da execucao final.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span className="tag">pendentes: {pendingItems.length}</span>
            <span className="tag">historico: {completedItems.length}</span>
            {query.decision ? <span className="tag">decisao: {query.decision}</span> : null}
          </div>
        </section>

        <section style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr 1fr" }}>
          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
            <h2 className="section-title">Aprovar agora</h2>
            {pendingItems.length === 0 ? (
              <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
                Nenhum item pendente no momento.
              </p>
            ) : (
              pendingItems.map((item) => (
                <ApprovalCard key={item.id} companySlug={workspace.company.slug} item={item} sessionReady={Boolean(session)} />
              ))
            )}
          </article>

          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
            <h2 className="section-title">Historico recente</h2>
            {completedItems.length === 0 ? (
              <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
                O historico de aprovacoes aparecera aqui conforme o Agent Lion operar.
              </p>
            ) : (
              completedItems.slice(0, 10).map((item) => (
                <article key={item.id} style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <strong>{item.title}</strong>
                    <span className="tag">{item.status}</span>
                  </div>
                  <span className="muted">
                    {item.kind} · {new Date(item.requestedAt).toLocaleString("pt-BR")}
                  </span>
                  <p style={{ margin: 0, lineHeight: 1.65 }}>{item.summary}</p>
                  <Link href={item.sourcePath} className="tag" style={{ width: "fit-content" }}>
                    Abrir origem
                  </Link>
                </article>
              ))
            )}
          </article>
        </section>
      </div>
    </main>
  );
}

function ApprovalCard({
  companySlug,
  item,
  sessionReady
}: {
  companySlug: string;
  item: {
    id: string;
    kind: string;
    status: string;
    title: string;
    requestedAt: string;
    requestedBy: string;
    summary: string;
    context: string;
    sourcePath: string;
    actions: string[];
  };
  sessionReady: boolean;
}) {
  return (
    <article style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <strong>{item.title}</strong>
        <span className="tag">{item.kind}</span>
      </div>
      <span className="muted">
        {item.context} · solicitado por {item.requestedBy} · {new Date(item.requestedAt).toLocaleString("pt-BR")}
      </span>
      <p style={{ margin: 0, lineHeight: 1.65 }}>{item.summary}</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {item.actions.map((action) => (
          <form key={action} action={`/api/companies/${companySlug}/approvals/${item.id}`} method="post">
            <input type="hidden" name="intent" value={action} />
            <button
              type="submit"
              className="tag"
              style={{ border: "none", cursor: sessionReady ? "pointer" : "not-allowed", opacity: sessionReady ? 1 : 0.6 }}
              disabled={!sessionReady}
            >
              {labelForAction(action)}
            </button>
          </form>
        ))}
        <Link href={item.sourcePath} className="tag">
          Abrir origem
        </Link>
      </div>
    </article>
  );
}

function labelForAction(action: string) {
  switch (action) {
    case "approve":
      return "Aprovar";
    case "deny":
      return "Negar";
    case "reject":
      return "Rejeitar";
    case "mark-posted":
      return "Marcar como concluido";
    case "create-social-post":
      return "Enviar para Social Ops";
    case "queue-runtime":
      return "Enviar para runtime";
    case "launch":
      return "Lancar";
    default:
      return "Executar";
  }
}

const cardStyle = {
  padding: 18,
  borderRadius: 18,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(148, 196, 208, 0.1)",
  display: "grid",
  gap: 10
} as const;
