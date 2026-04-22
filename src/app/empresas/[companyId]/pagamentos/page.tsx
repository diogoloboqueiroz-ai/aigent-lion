import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getSessionFromCookies } from "@/lib/session";
import { getCompanyWorkspace } from "@/lib/connectors";

type PageProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ saved?: string; requested?: string; decision?: string }>;
};

export default async function CompanyPaymentsPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);
  const workspace = getCompanyWorkspace(companyId);

  if (!workspace) {
    notFound();
  }

  const paymentProfile = workspace.paymentProfile;

  return (
    <main style={{ padding: "32px 0 80px" }}>
      <div className="shell" style={{ display: "grid", gap: 24 }}>
        <section className="glass" style={{ padding: 28, borderRadius: 28, display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href={`/empresas/${workspace.company.slug}`} className="tag" style={{ width: "fit-content" }}>
              Voltar para o workspace
            </Link>
            <Link href={`/empresas/${workspace.company.slug}/aprovacoes`} className="tag" style={{ width: "fit-content" }}>
              Approval Center
            </Link>
          </div>
          <p className="eyebrow">Pagamentos com Aprovacao</p>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 1.6rem + 1.5vw, 3.3rem)" }}>
            {workspace.company.name}
          </h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7, maxWidth: 920 }}>
            O agente pode preparar pagamentos e salvar a referencia do metodo de pagamento, mas a execucao do servico so pode ocorrer depois da liberacao explicita do usuario. Aqui eu modelei esse fluxo como aprovacao obrigatoria.
          </p>
          {query.saved ? <div className="tag" style={{ width: "fit-content" }}>Perfil de pagamento salvo</div> : null}
          {query.requested ? <div className="tag" style={{ width: "fit-content" }}>Solicitacao de pagamento criada</div> : null}
          {query.decision ? <div className="tag" style={{ width: "fit-content" }}>Decisao registrada: {query.decision}</div> : null}
        </section>

        <section style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr 1fr" }}>
          <form
            action={`/api/companies/${workspace.company.slug}/payments`}
            method="post"
            className="glass"
            style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}
          >
            <input type="hidden" name="intent" value="save-profile" />
            <h2 className="section-title">Perfil de pagamento</h2>
            <Field label="Provider" name="provider" defaultValue={paymentProfile.provider} disabled />
            <Field label="Stripe customer id" name="customerId" defaultValue={paymentProfile.customerId ?? ""} />
            <Field label="Payment method id" name="paymentMethodId" defaultValue={paymentProfile.paymentMethodId ?? ""} />
            <Field label="Bandeira" name="brand" defaultValue={paymentProfile.brand ?? ""} />
            <Field label="Ultimos 4 digitos" name="last4" defaultValue={paymentProfile.last4 ?? ""} />
            <Field label="Titular" name="cardholderName" defaultValue={paymentProfile.cardholderName ?? ""} />
            <Field label="Moeda padrao" name="defaultCurrency" defaultValue={paymentProfile.defaultCurrency} />
            <Field label="Teto de gasto" name="spendCap" defaultValue={paymentProfile.spendCap} />
            <TextAreaField label="Regra de aprovacao" name="approvalRule" defaultValue={paymentProfile.approvalRule} />
            <button
              type="submit"
              className="tag"
              style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
              disabled={!session}
            >
              Salvar perfil financeiro
            </button>
          </form>

          <form
            action={`/api/companies/${workspace.company.slug}/payments`}
            method="post"
            className="glass"
            style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}
          >
            <input type="hidden" name="intent" value="request" />
            <h2 className="section-title">Solicitar aprovacao de pagamento</h2>
            <Field label="Titulo da solicitacao" name="title" defaultValue="Servico de marketing" />
            <TextAreaField label="Descricao" name="description" defaultValue="Descreva claramente o servico que sera executado pelo agente." />
            <Field label="Valor" name="amount" defaultValue="0,00" />
            <button
              type="submit"
              className="tag"
              style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
              disabled={!session}
            >
              Criar solicitacao
            </button>
          </form>
        </section>

        <section className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 16 }}>
          <h2 className="section-title">Fila de aprovacoes</h2>
          {workspace.paymentRequests.length === 0 ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
              Nenhuma solicitacao criada ainda.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {workspace.paymentRequests.map((request) => (
                <article
                  key={request.id}
                  style={{
                    padding: 18,
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(148, 196, 208, 0.1)",
                    display: "grid",
                    gap: 10
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <strong>{request.title}</strong>
                    <span className="tag">{request.status}</span>
                  </div>
                  <span className="muted">
                    {request.amount} {request.currency} · Solicitado por {request.requestedBy}
                  </span>
                  <p style={{ margin: 0, lineHeight: 1.65 }}>{request.description}</p>
                  {request.status === "pending" && session ? (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <form action={`/api/companies/${workspace.company.slug}/payments/${request.id}`} method="post">
                        <input type="hidden" name="intent" value="approve" />
                        <button type="submit" className="tag" style={{ border: "none", cursor: "pointer" }}>
                          Aprovar
                        </button>
                      </form>
                      <form action={`/api/companies/${workspace.company.slug}/payments/${request.id}`} method="post">
                        <input type="hidden" name="intent" value="deny" />
                        <button type="submit" className="tag" style={{ border: "none", cursor: "pointer" }}>
                          Negar
                        </button>
                      </form>
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

function Field({
  label,
  name,
  defaultValue,
  disabled
}: {
  label: string;
  name: string;
  defaultValue: string;
  disabled?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span>{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        style={{
          borderRadius: 14,
          border: "1px solid rgba(148, 196, 208, 0.16)",
          background: "rgba(255,255,255,0.04)",
          color: "inherit",
          padding: "12px 14px"
        }}
      />
    </label>
  );
}

function TextAreaField({
  label,
  name,
  defaultValue
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span>{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={4}
        style={{
          borderRadius: 14,
          border: "1px solid rgba(148, 196, 208, 0.16)",
          background: "rgba(255,255,255,0.04)",
          color: "inherit",
          padding: "12px 14px",
          resize: "vertical"
        }}
      />
    </label>
  );
}
