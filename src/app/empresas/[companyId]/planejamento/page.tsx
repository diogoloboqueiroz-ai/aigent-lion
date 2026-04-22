import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getSessionFromCookies } from "@/lib/session";
import { getCompanyWorkspace } from "@/lib/connectors";
import { competitorsToTextarea, listToTextarea } from "@/lib/strategy";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

type PageProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ saved?: string }>;
};

export default async function CompanyStrategyPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);
  const professionalProfile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(companyId, professionalProfile);

  if (!workspace) {
    notFound();
  }

  const strategy = workspace.strategyPlan;

  return (
    <main style={{ padding: "32px 0 80px" }}>
      <div className="shell" style={{ display: "grid", gap: 24 }}>
        <section className="glass" style={{ padding: 28, borderRadius: 28, display: "grid", gap: 14 }}>
          <Link href={`/empresas/${workspace.company.slug}`} className="tag" style={{ width: "fit-content" }}>
            Voltar para o workspace
          </Link>
          <p className="eyebrow">Planejamento Estrategico</p>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 1.6rem + 1.5vw, 3.3rem)" }}>
            {workspace.company.name}
          </h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7, maxWidth: 920 }}>
            Aqui o agente alinha metas, alcance, budget, rotina diaria e leitura de concorrentes junto com o usuario. Esse plano fica salvo individualmente para a empresa.
          </p>
          {professionalProfile ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.7, maxWidth: 920 }}>
              Contexto profissional aplicado: {professionalProfile.professionalTitle} com foco em{" "}
              {professionalProfile.strategicNorthStar.toLowerCase()}.
            </p>
          ) : null}
          {query.saved ? <div className="tag" style={{ width: "fit-content" }}>Planejamento salvo</div> : null}
        </section>

        <section style={{ display: "grid", gap: 20, gridTemplateColumns: "1.1fr 0.9fr" }}>
          <form
            action={`/api/companies/${workspace.company.slug}/strategy`}
            method="post"
            className="glass"
            style={{ padding: 22, borderRadius: 22, display: "grid", gap: 18 }}
          >
            <section style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
              <Field label="Horizonte de planejamento" name="planningHorizon" defaultValue={strategy.planningHorizon} />
              <Field label="Budget mensal" name="monthlyBudget" defaultValue={strategy.monthlyBudget} />
              <Field label="Objetivo principal" name="primaryObjective" defaultValue={strategy.primaryObjective} />
              <Field label="Objetivo secundario" name="secondaryObjective" defaultValue={strategy.secondaryObjective} />
              <Field label="Meta de alcance" name="reachGoal" defaultValue={strategy.reachGoal} />
              <Field label="Meta de leads" name="leadGoal" defaultValue={strategy.leadGoal} />
              <Field label="Meta de receita" name="revenueGoal" defaultValue={strategy.revenueGoal} />
              <Field label="Meta de CPA" name="cpaTarget" defaultValue={strategy.cpaTarget} />
              <Field label="Meta de ROAS" name="roasTarget" defaultValue={strategy.roasTarget} />
              <Field
                label="Canais prioritarios (separe por virgula)"
                name="priorityChannels"
                defaultValue={strategy.priorityChannels.join(", ")}
              />
            </section>

            <TextAreaField label="Mercados prioritarios" name="priorityMarkets" defaultValue={listToTextarea(strategy.priorityMarkets)} />
            <TextAreaField label="Iniciativas estrategicas" name="strategicInitiatives" defaultValue={listToTextarea(strategy.strategicInitiatives)} />
            <TextAreaField label="Rituais diarios" name="dailyRituals" defaultValue={listToTextarea(strategy.dailyRituals)} />
            <TextAreaField label="Rituais semanais" name="weeklyRituals" defaultValue={listToTextarea(strategy.weeklyRituals)} />
            <TextAreaField label="Riscos a monitorar" name="risksToWatch" defaultValue={listToTextarea(strategy.risksToWatch)} />
            <TextAreaField
              label="Concorrentes (um bloco por concorrente: nome | posicionamento | canais | ofertas | forcas | fraquezas | notas)"
              name="competitors"
              defaultValue={competitorsToTextarea(strategy.competitors)}
            />
            <TextAreaField label="Notas de alinhamento com o usuario" name="userAlignmentNotes" defaultValue={strategy.userAlignmentNotes} />

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
              Salvar planejamento
            </button>
          </form>

          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
            <h2 className="section-title">Perfil profissional aplicado</h2>
            {professionalProfile ? (
              <>
                <p style={{ margin: 0, lineHeight: 1.65 }}>
                  Cargo: <strong>{professionalProfile.professionalTitle}</strong>
                </p>
                <p style={{ margin: 0, lineHeight: 1.65 }}>
                  Estilo de decisao: <strong>{professionalProfile.decisionStyle}</strong>
                </p>
                <p style={{ margin: 0, lineHeight: 1.65 }}>
                  Alavanca principal: <strong>{professionalProfile.growthLevers[0] ?? "Nao definida"}</strong>
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                  {professionalProfile.learnedPatterns.slice(0, 4).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <Link href="/perfil-profissional" className="tag" style={{ width: "fit-content" }}>
                  Refinar memoria profissional
                </Link>
              </>
            ) : (
              <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                Entre com Google para aplicar sua memoria profissional no planejamento desta empresa.
              </p>
            )}
          </article>
        </section>
      </div>
    </main>
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
