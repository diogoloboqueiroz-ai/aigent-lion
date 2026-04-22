import Link from "next/link";
import { cookies } from "next/headers";
import { getInternetIntelligenceProfile, listToTextarea } from "@/lib/internet-intel";
import { getSessionFromCookies } from "@/lib/session";

type PageProps = {
  searchParams: Promise<{ saved?: string }>;
};

export default async function InternetIntelligencePage({ searchParams }: PageProps) {
  const query = await searchParams;
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);
  const profile = getInternetIntelligenceProfile();

  return (
    <main style={{ padding: "32px 0 80px" }}>
      <div className="shell" style={{ display: "grid", gap: 24 }}>
        <section className="glass" style={{ padding: 28, borderRadius: 28, display: "grid", gap: 14 }}>
          <Link href="/" className="tag" style={{ width: "fit-content" }}>
            Voltar para control tower
          </Link>
          <p className="eyebrow">Inteligencia Web</p>
          <h1 style={{ margin: 0, fontSize: "clamp(2.1rem, 1.7rem + 1.5vw, 3.5rem)" }}>
            Pesquisa na internet e atualizacoes em tempo real
          </h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.75, maxWidth: 980 }}>
            Esta camada permite que o agente pesquise a internet, acompanhe mudancas de mercado, monitore concorrentes e atualize sua leitura estrategica com sinais em tempo real.
          </p>
          {query.saved ? (
            <div className="tag" style={{ width: "fit-content" }}>
              Perfil de inteligencia web salvo
            </div>
          ) : null}
          <div className="grid-auto">
            <InfoCard label="Modo" value={profile.accessMode} />
            <InfoCard label="Cadencia" value={profile.liveUpdateCadence} />
            <InfoCard label="Fontes" value={String(profile.sourceTypes.length)} />
            <InfoCard label="Dominios aprovados" value={String(profile.allowedDomains.length)} />
          </div>
        </section>

        <section style={{ display: "grid", gap: 20, gridTemplateColumns: "1.05fr 0.95fr" }}>
          <form
            action="/api/internet-intel"
            method="post"
            className="glass"
            style={{ padding: 22, borderRadius: 22, display: "grid", gap: 16 }}
          >
            <Field label="Cadencia de atualizacao em tempo real" name="liveUpdateCadence" defaultValue={profile.liveUpdateCadence} />
            <TextAreaField label="Tipos de fonte monitorados" name="sourceTypes" defaultValue={listToTextarea(profile.sourceTypes)} />
            <TextAreaField label="Topicos monitorados" name="monitoredTopics" defaultValue={listToTextarea(profile.monitoredTopics)} />
            <TextAreaField label="Dominios e suites aprovados" name="allowedDomains" defaultValue={listToTextarea(profile.allowedDomains)} />
            <TextAreaField label="Fontes bloqueadas" name="blockedDomains" defaultValue={listToTextarea(profile.blockedDomains)} />
            <TextAreaField
              label="Acoes de pesquisa autonomas"
              name="autonomousResearchActions"
              defaultValue={listToTextarea(profile.autonomousResearchActions)}
            />
            <TextAreaField
              label="Acoes que exigem aprovacao"
              name="approvalRequiredActions"
              defaultValue={listToTextarea(profile.approvalRequiredActions)}
            />
            <TextAreaField label="Notas de runtime" name="runtimeNotes" defaultValue={profile.runtimeNotes} />

            <button
              type="submit"
              className="tag"
              style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
              disabled={!session}
            >
              Salvar inteligencia web
            </button>
          </form>

          <div style={{ display: "grid", gap: 18 }}>
            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
              <h2 className="section-title">Pesquisas autonomas</h2>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                {profile.autonomousResearchActions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
              <h2 className="section-title">Topicos vivos de monitoramento</h2>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                {profile.monitoredTopics.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
              <h2 className="section-title">Guardrails de internet</h2>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                {profile.approvalRequiredActions.map((item) => (
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

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
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
