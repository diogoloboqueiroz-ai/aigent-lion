import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getCompanyWorkspace } from "@/lib/connectors";
import { listToTextarea } from "@/lib/data-ops";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

type PageProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ saved?: string; syncStatus?: string }>;
};

const relevantPlatforms = new Set(["ga4", "google-sheets", "search-console"]);

export default async function CompanyDataOpsPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);
  const professionalProfile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(companyId, professionalProfile);

  if (!workspace) {
    notFound();
  }

  const dataOps = workspace.dataOpsProfile;
  const relevantConnections = workspace.connections.filter((connection) => relevantPlatforms.has(connection.platform));

  return (
    <main style={{ padding: "32px 0 80px" }}>
      <div className="shell" style={{ display: "grid", gap: 24 }}>
        <section className="glass" style={{ padding: 28, borderRadius: 28, display: "grid", gap: 14 }}>
          <Link href={`/empresas/${workspace.company.slug}`} className="tag" style={{ width: "fit-content" }}>
            Voltar para o workspace
          </Link>
          <p className="eyebrow">Dados e Automacao Google</p>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 1.6rem + 1.5vw, 3.3rem)" }}>{workspace.company.name}</h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7, maxWidth: 920 }}>
            Esta area ensina o agente a operar Google Analytics, Search Console e Google Sheets para relatorios, consolidacao de KPI, alertas e rotinas operacionais internas.
          </p>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7, maxWidth: 920 }}>
            A regra aqui e simples: o agente pode ler dados e atualizar documentos internos aprovados; postagens, gastos e mutacoes externas continuam passando por aprovacao quando exigido.
          </p>
          {query.saved ? (
            <div className="tag" style={{ width: "fit-content" }}>
              {query.saved === "sync" ? "Sincronizacao Google executada" : "Configuracao de dados salva"}
            </div>
          ) : null}
          {query.syncStatus ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.65, maxWidth: 920 }}>
              {query.syncStatus}
            </p>
          ) : null}
        </section>

        <section style={{ display: "grid", gap: 20, gridTemplateColumns: "1.1fr 0.9fr" }}>
          <form
            action={`/api/companies/${workspace.company.slug}/data-ops`}
            method="post"
            className="glass"
            style={{ padding: 22, borderRadius: 22, display: "grid", gap: 18 }}
          >
            <section style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
              <Field label="Cadencia de relatorio" name="reportingCadence" defaultValue={dataOps.reportingCadence} />
              <Field label="Nome da planilha mestre" name="sheetsWorkspaceName" defaultValue={dataOps.sheetsWorkspaceName} />
              <Field label="GA4 property ID" name="ga4PropertyId" defaultValue={dataOps.ga4PropertyId} />
              <Field label="Search Console site URL" name="searchConsoleSiteUrl" defaultValue={dataOps.searchConsoleSiteUrl} />
              <Field label="Spreadsheet ID" name="sheetsSpreadsheetId" defaultValue={dataOps.sheetsSpreadsheetId} />
              <Field label="Range de resumo no Sheets" name="sheetsOverviewRange" defaultValue={dataOps.sheetsOverviewRange} />
              <Field
                label="Objetivo analitico"
                name="analyticsObjective"
                defaultValue={dataOps.analyticsObjective}
                fullWidth
              />
            </section>

            <TextAreaField label="KPIs prioritarios" name="primaryKpis" defaultValue={listToTextarea(dataOps.primaryKpis)} />
            <TextAreaField
              label="Automacoes em Google Sheets"
              name="sheetAutomations"
              defaultValue={listToTextarea(dataOps.sheetAutomations)}
            />
            <TextAreaField
              label="Acoes de escrita aprovadas"
              name="approvedWriteActions"
              defaultValue={listToTextarea(dataOps.approvedWriteActions)}
            />
            <TextAreaField label="Regra de autonomia" name="autonomyRule" defaultValue={dataOps.autonomyRule} />
            <TextAreaField label="Notas do sistema" name="systemNotes" defaultValue={dataOps.systemNotes} />

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
              Salvar operacao de dados
            </button>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="submit"
                name="intent"
                value="sync-now"
                className="tag"
                style={{
                  border: "none",
                  cursor: session ? "pointer" : "not-allowed",
                  opacity: session ? 1 : 0.6
                }}
                disabled={!session}
              >
                Sincronizar Google agora
              </button>
              {dataOps.lastSyncedAt ? (
                <span className="muted" style={{ alignSelf: "center" }}>
                  Ultimo sync: {new Date(dataOps.lastSyncedAt).toLocaleString("pt-BR")}
                </span>
              ) : null}
            </div>
          </form>

          <div style={{ display: "grid", gap: 18 }}>
            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
              <h2 className="section-title">Conexoes Google relevantes</h2>
              {relevantConnections.length === 0 ? (
                <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                  Nenhuma conexao de Analytics, Search Console ou Sheets foi preparada para esta empresa ainda.
                </p>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {relevantConnections.map((connection) => (
                    <div
                      key={connection.id}
                      style={{
                        padding: 16,
                        borderRadius: 18,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(148, 196, 208, 0.1)",
                        display: "grid",
                        gap: 8
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <strong>{connection.label}</strong>
                        <span className="tag">{connection.status}</span>
                      </div>
                      <span className="muted">
                        {connection.platform} · {connection.auth}
                      </span>
                      <span>Scopes: {connection.scopes.join(", ")}</span>
                      <p style={{ margin: 0, lineHeight: 1.6 }}>{connection.nextAction}</p>
                      {session && connection.auth === "oauth" ? (
                        <a
                          href={`/api/auth/google/connect/start?companyId=${workspace.company.slug}&platform=${connection.platform}`}
                          className="tag"
                          style={{ width: "fit-content" }}
                        >
                          {connection.status === "connected" ? "Reconectar com Google" : "Conectar com Google"}
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
              <h2 className="section-title">Como o agente atua</h2>
              <div className="grid-auto" style={{ gap: 12 }}>
                <InfoCard label="Status" value={dataOps.status} />
                <InfoCard label="KPIs" value={String(dataOps.primaryKpis.length)} />
                <InfoCard label="Automacoes" value={String(dataOps.sheetAutomations.length)} />
                <InfoCard label="Escritas aprovadas" value={String(dataOps.approvedWriteActions.length)} />
              </div>
              <p style={{ margin: 0, lineHeight: 1.65 }}>
                Objetivo atual: <strong>{dataOps.analyticsObjective}</strong>
              </p>
              {dataOps.lastSyncSummary ? (
                <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                  {dataOps.lastSyncSummary}
                </p>
              ) : null}
              <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                O agente consolida rotinas internas em Sheets, prepara relatorios e protege a operacao com leitura diaria dos sinais de Analytics.
              </p>
            </article>

            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
              <h2 className="section-title">Snapshots Google vivos</h2>
              {workspace.snapshots.filter((snapshot) => snapshot.source === "google_data_sync").length === 0 ? (
                <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                  Ainda nao existe snapshot Google real salvo. Configure os recursos e rode a sincronizacao para substituir a leitura seedada.
                </p>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {workspace.snapshots
                    .filter((snapshot) => snapshot.source === "google_data_sync")
                    .map((snapshot) => (
                      <div
                        key={`${snapshot.platform}-${snapshot.window}-${snapshot.capturedAt ?? "seed"}`}
                        style={{
                          padding: 16,
                          borderRadius: 18,
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(148, 196, 208, 0.1)",
                          display: "grid",
                          gap: 8
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <strong>{snapshot.platform}</strong>
                          <span className="tag">{snapshot.window}</span>
                        </div>
                        <span className="muted">
                          Atualizado em {snapshot.capturedAt ? new Date(snapshot.capturedAt).toLocaleString("pt-BR") : "n/d"}
                        </span>
                        <span>
                          Cliques {snapshot.clicks ?? 0} · Impressoes {snapshot.impressions ?? 0} · Conversoes {snapshot.conversions ?? 0}
                        </span>
                        {snapshot.revenue ? <span>Receita {snapshot.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</span> : null}
                        <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
                          {snapshot.notes.join(" ")}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  defaultValue,
  fullWidth = false
}: {
  label: string;
  name: string;
  defaultValue: string;
  fullWidth?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 8, gridColumn: fullWidth ? "1 / -1" : undefined }}>
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="glass" style={{ padding: 18, borderRadius: 18, display: "grid", gap: 8 }}>
      <span className="muted" style={{ fontSize: 14 }}>
        {label}
      </span>
      <strong style={{ fontSize: "1.05rem" }}>{value}</strong>
    </article>
  );
}
