import Link from "next/link";
import { cookies } from "next/headers";
import { getDesktopAgentProfile, listToTextarea } from "@/lib/desktop-agent";
import { getSessionFromCookies } from "@/lib/session";

type PageProps = {
  searchParams: Promise<{ saved?: string }>;
};

export default async function DesktopAgentPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);
  const profile = getDesktopAgentProfile();

  return (
    <main style={{ padding: "32px 0 80px" }}>
      <div className="shell" style={{ display: "grid", gap: 24 }}>
        <section className="glass" style={{ padding: 28, borderRadius: 28, display: "grid", gap: 14 }}>
          <Link href="/" className="tag" style={{ width: "fit-content" }}>
            Voltar para control tower
          </Link>
          <p className="eyebrow">Agente Desktop</p>
          <h1 style={{ margin: 0, fontSize: "clamp(2.1rem, 1.7rem + 1.5vw, 3.5rem)" }}>
            Acesso local ao computador com guardrails
          </h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.75, maxWidth: 980 }}>
            Esta area transforma o agente em operador local do computador: ele pode gerar arquivos, organizar pastas, preparar exports, abrir apps e trabalhar em documentos. Publicacao, pagamento, exclusoes sensiveis e mudancas no sistema continuam protegidos por aprovacao.
          </p>
          {query.saved ? (
            <div className="tag" style={{ width: "fit-content" }}>
              Perfil do agente desktop salvo
            </div>
          ) : null}
          <div className="grid-auto">
            <InfoCard label="Modo" value={profile.accessMode} />
            <InfoCard label="Pastas aprovadas" value={String(profile.approvedRoots.length)} />
            <InfoCard label="Apps liberados" value={String(profile.allowedApps.length)} />
            <InfoCard label="Acoes autonomas" value={String(profile.autonomousActions.length)} />
          </div>
        </section>

        <section style={{ display: "grid", gap: 20, gridTemplateColumns: "1.05fr 0.95fr" }}>
          <form
            action="/api/desktop-agent"
            method="post"
            className="glass"
            style={{ padding: 22, borderRadius: 22, display: "grid", gap: 16 }}
          >
            <TextAreaField label="Pastas aprovadas para leitura e trabalho" name="approvedRoots" defaultValue={listToTextarea(profile.approvedRoots)} />
            <TextAreaField label="Pastas de saida e exports" name="outputRoots" defaultValue={listToTextarea(profile.outputRoots)} />
            <TextAreaField label="Apps liberados para o agente" name="allowedApps" defaultValue={listToTextarea(profile.allowedApps)} />
            <TextAreaField label="Acoes autonomas" name="autonomousActions" defaultValue={listToTextarea(profile.autonomousActions)} />
            <TextAreaField
              label="Acoes que exigem sua aprovacao"
              name="approvalRequiredActions"
              defaultValue={listToTextarea(profile.approvalRequiredActions)}
            />
            <TextAreaField label="Acoes bloqueadas" name="blockedActions" defaultValue={listToTextarea(profile.blockedActions)} />
            <TextAreaField label="Notas de runtime" name="runtimeNotes" defaultValue={profile.runtimeNotes} />

            <button
              type="submit"
              className="tag"
              style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
              disabled={!session}
            >
              Salvar agente desktop
            </button>
          </form>

          <div style={{ display: "grid", gap: 18 }}>
            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
              <h2 className="section-title">O que ele pode fazer</h2>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                {profile.autonomousActions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
              <h2 className="section-title">O que continua protegido</h2>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                {profile.approvalRequiredActions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
              <h2 className="section-title">Bloqueios de seguranca</h2>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                {profile.blockedActions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="glass" style={{ padding: 18, borderRadius: 18, display: "grid", gap: 8 }}>
      <span className="muted" style={{ fontSize: 14 }}>
        {label}
      </span>
      <strong>{value}</strong>
    </article>
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
        rows={5}
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
