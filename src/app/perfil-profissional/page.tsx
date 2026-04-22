import Link from "next/link";
import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/session";
import { buildProfessionalSummary, getUserProfessionalProfile, listToTextarea } from "@/lib/user-profiles";

type PageProps = {
  searchParams: Promise<{ saved?: string }>;
};

export default async function ProfessionalProfilePage({ searchParams }: PageProps) {
  const query = await searchParams;
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);
  const profile = getUserProfessionalProfile(session);

  if (!session || !profile) {
    return (
      <main style={{ padding: "32px 0 80px" }}>
        <div className="shell" style={{ display: "grid", gap: 24 }}>
          <section className="glass" style={{ padding: 28, borderRadius: 28, display: "grid", gap: 14 }}>
            <Link href="/" className="tag" style={{ width: "fit-content" }}>
              Voltar para control tower
            </Link>
            <p className="eyebrow">Perfil Profissional</p>
            <h1 style={{ margin: 0, fontSize: "clamp(2rem, 1.6rem + 1.5vw, 3.3rem)" }}>
              Login necessario
            </h1>
            <p className="muted" style={{ margin: 0, lineHeight: 1.7, maxWidth: 760 }}>
              Entre com Google na tela inicial para salvar sua memoria profissional e usar esse contexto nas estrategias das empresas.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: "32px 0 80px" }}>
      <div className="shell" style={{ display: "grid", gap: 24 }}>
        <section className="glass" style={{ padding: 28, borderRadius: 28, display: "grid", gap: 14 }}>
          <Link href="/" className="tag" style={{ width: "fit-content" }}>
            Voltar para control tower
          </Link>
          <p className="eyebrow">Perfil Profissional</p>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 1.6rem + 1.5vw, 3.3rem)" }}>
            {profile.displayName}
          </h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7, maxWidth: 900 }}>
            Esse perfil ensina ao agente como voce trabalha profissionalmente: seu estilo de decisao, criterios de aprovacao, alavancas de crescimento e aprendizados que devem guiar as estrategias em cada empresa.
          </p>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>{buildProfessionalSummary(profile)}</p>
          {query.saved ? <div className="tag" style={{ width: "fit-content" }}>Perfil profissional salvo</div> : null}
        </section>

        <section style={{ display: "grid", gap: 20, gridTemplateColumns: "1.05fr 0.95fr" }}>
          <form
            action="/api/me/profile"
            method="post"
            className="glass"
            style={{ padding: 22, borderRadius: 22, display: "grid", gap: 16 }}
          >
            <h2 className="section-title">Editar memoria profissional</h2>
            <Field label="Cargo ou papel profissional" name="professionalTitle" defaultValue={profile.professionalTitle} />
            <Field label="Modelo de negocio" name="businessModel" defaultValue={profile.businessModel} />
            <Field label="North star estrategico" name="strategicNorthStar" defaultValue={profile.strategicNorthStar} />
            <Field label="Estilo de decisao" name="decisionStyle" defaultValue={profile.decisionStyle} />
            <Field label="Cadencia de planejamento" name="planningCadence" defaultValue={profile.planningCadence} />
            <Field label="Disciplina de custo" name="costDiscipline" defaultValue={profile.costDiscipline} />
            <TextAreaField label="Areas de especialidade" name="expertiseAreas" defaultValue={listToTextarea(profile.expertiseAreas)} />
            <TextAreaField label="Canais preferidos" name="preferredChannels" defaultValue={listToTextarea(profile.preferredChannels)} />
            <TextAreaField label="Setores foco" name="targetSectors" defaultValue={listToTextarea(profile.targetSectors)} />
            <TextAreaField
              label="Regras para selecionar operacoes"
              name="clientSelectionRules"
              defaultValue={listToTextarea(profile.clientSelectionRules)}
            />
            <TextAreaField
              label="Preferencias de aprovacao"
              name="approvalPreferences"
              defaultValue={listToTextarea(profile.approvalPreferences)}
            />
            <TextAreaField label="Alavancas de crescimento" name="growthLevers" defaultValue={listToTextarea(profile.growthLevers)} />
            <TextAreaField label="Aprendizados do operador" name="learnedPatterns" defaultValue={listToTextarea(profile.learnedPatterns)} />
            <TextAreaField label="Regras inegociaveis" name="noGoRules" defaultValue={listToTextarea(profile.noGoRules)} />
            <TextAreaField label="Notas estrategicas" name="strategicNotes" defaultValue={profile.strategicNotes} rows={5} />
            <button
              type="submit"
              className="tag"
              style={{ width: "fit-content", border: "none", cursor: "pointer" }}
            >
              Salvar perfil profissional
            </button>
          </form>

          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 16 }}>
            <h2 className="section-title">Prompt profissional gerado</h2>
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
            <div className="grid-auto" style={{ gap: 12 }}>
              <InfoCard label="Status" value={profile.trainingStatus} />
              <InfoCard label="E-mail" value={profile.email} />
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
  defaultValue,
  rows = 4
}: {
  label: string;
  name: string;
  defaultValue: string;
  rows?: number;
}) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span>{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={rows}
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
