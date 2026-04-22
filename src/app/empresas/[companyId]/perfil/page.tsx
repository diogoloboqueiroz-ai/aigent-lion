import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getCompanyWorkspace } from "@/lib/connectors";
import { getSessionFromCookies } from "@/lib/session";
import { listToTextarea } from "@/lib/agent-profiles";

type PageProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ saved?: string }>;
};

export default async function CompanyProfilePage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);
  const workspace = getCompanyWorkspace(companyId);

  if (!workspace) {
    notFound();
  }

  const profile = workspace.agentProfile;

  return (
    <main style={{ padding: "32px 0 80px" }}>
      <div className="shell" style={{ display: "grid", gap: 24 }}>
        <section className="glass" style={{ padding: 28, borderRadius: 28, display: "grid", gap: 14 }}>
          <Link href={`/empresas/${workspace.company.slug}`} className="tag" style={{ width: "fit-content" }}>
            Voltar para o workspace
          </Link>
          <p className="eyebrow">Perfil do Agente</p>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 1.6rem + 1.5vw, 3.3rem)" }}>
            {workspace.company.name}
          </h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7, maxWidth: 860 }}>
            Esse perfil funciona como a memoria operacional individual do agente para esta empresa. Ele define voz, ICP, ofertas, canais aprovados, regras de economia e o prompt-base usado nas rotinas.
          </p>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            {session
              ? `Operador conectado: ${session.email}.`
              : "Faça login com Google antes de salvar alteracoes neste perfil."}
          </p>
          {query.saved ? <div className="tag" style={{ width: "fit-content" }}>Perfil salvo com sucesso</div> : null}
        </section>

        <section style={{ display: "grid", gap: 20, gridTemplateColumns: "1.05fr 0.95fr" }}>
          <form
            action={`/api/companies/${workspace.company.slug}/profile`}
            method="post"
            className="glass"
            style={{ padding: 22, borderRadius: 22, display: "grid", gap: 16 }}
          >
            <h2 className="section-title">Editar perfil individual</h2>
            <Field label="Resumo do negocio" name="businessSummary" defaultValue={profile.businessSummary} />
            <Field label="Tom de voz" name="brandVoice" defaultValue={profile.brandVoice} />
            <Field label="ICP" name="idealCustomerProfile" defaultValue={profile.idealCustomerProfile} />
            <Field label="Estrategia de oferta" name="offerStrategy" defaultValue={profile.offerStrategy} />
            <TextAreaField label="Diferenciais" name="differentiators" defaultValue={listToTextarea(profile.differentiators)} />
            <TextAreaField label="Canais aprovados" name="approvedChannels" defaultValue={listToTextarea(profile.approvedChannels)} />
            <TextAreaField label="Pilares de conteudo" name="contentPillars" defaultValue={listToTextarea(profile.contentPillars)} />
            <TextAreaField label="Geo foco" name="geoFocus" defaultValue={listToTextarea(profile.geoFocus)} />
            <TextAreaField label="Eventos de conversao" name="conversionEvents" defaultValue={listToTextarea(profile.conversionEvents)} />
            <TextAreaField label="Regras de eficiencia" name="efficiencyRules" defaultValue={listToTextarea(profile.efficiencyRules)} />
            <TextAreaField label="Claims proibidos" name="forbiddenClaims" defaultValue={listToTextarea(profile.forbiddenClaims)} />
            <TextAreaField label="Notas do operador" name="operatorNotes" defaultValue={profile.operatorNotes} />
            <button
              type="submit"
              className="tag"
              style={{
                width: "fit-content",
                border: "none",
                cursor: session ? "pointer" : "not-allowed",
                opacity: session ? 1 : 0.6
              }}
              disabled={!session}
            >
              Salvar perfil treinado
            </button>
          </form>

          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 16 }}>
            <h2 className="section-title">Prompt operacional gerado</h2>
            <div
              style={{
                padding: 16,
                borderRadius: 18,
                background: "rgba(4, 11, 15, 0.72)",
                border: "1px solid rgba(148, 196, 208, 0.12)",
                whiteSpace: "pre-wrap",
                lineHeight: 1.65
              }}
            >
              {profile.systemPrompt}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <span className="muted">Status: {profile.trainingStatus}</span>
              <span className="muted">Atualizado em: {new Date(profile.updatedAt).toLocaleString("pt-BR")}</span>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

function Field({
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
      <input
        name={name}
        defaultValue={defaultValue}
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
