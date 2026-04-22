import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getCompanyWorkspace } from "@/lib/connectors";
import { getCompanyTrackingCredentials } from "@/lib/conversion-runtime";
import { getSessionFromCookies } from "@/lib/session";
import {
  buildBrowserCaptureSnippet,
  buildCaptureEndpoint,
  buildServerCaptureSnippet,
  buildTrackingSnippet
} from "@/lib/site-ops";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

type PageProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{
    saved?: string;
    requested?: string;
    siteSaved?: string;
    trackingSaved?: string;
    cmsSaved?: string;
    cmsError?: string;
    landingPublished?: string;
    landingError?: string;
  }>;
};

export default async function CompanyEngineeringPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);
  const professionalProfile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(companyId, professionalProfile);
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://seu-dominio.com";
  const captureEndpoint = buildCaptureEndpoint(appBaseUrl, workspace?.company.slug ?? companyId);

  if (!workspace) {
    notFound();
  }

  const browserSnippet = buildBrowserCaptureSnippet({
    appUrl: appBaseUrl,
    companySlug: workspace.company.slug,
    profile: workspace.siteOpsProfile
  });
  const serverSnippet = buildServerCaptureSnippet({
    appUrl: appBaseUrl,
    companySlug: workspace.company.slug,
    captureSecret: workspace.crmProfile.captureSecret
  });
  const trackingSnippet = buildTrackingSnippet(workspace.siteOpsProfile);
  const trackingCredentials = getCompanyTrackingCredentials(workspace.company.slug);
  const googleAdsBinding = workspace.socialBindings.find((binding) => binding.platform === "google-ads");
  const googleAdsOfflineReady = Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
      googleAdsBinding?.targetId &&
      googleAdsBinding?.conversionEvent
  );
  const dedupeCoverage = workspace.conversionEvents.filter((event) => event.dedupeKey).length;

  return (
    <main style={{ padding: "32px 0 80px" }}>
      <div className="shell" style={{ display: "grid", gap: 24 }}>
        <section className="glass" style={{ padding: 28, borderRadius: 28, display: "grid", gap: 14 }}>
          <Link href={`/empresas/${workspace.company.slug}`} className="tag" style={{ width: "fit-content" }}>
            Voltar para o workspace
          </Link>
          <p className="eyebrow">Lab de Engenharia</p>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 1.6rem + 1.5vw, 3.3rem)" }}>
            {workspace.company.name}
          </h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7, maxWidth: 940 }}>
            Aqui o agente tambem atua como copiloto tecnico: le repositórios, entende stacks, recebe bugs, gera codigo, propõe correcoes e organiza investigacoes tecnicas.
          </p>
          {query.saved ? <div className="tag" style={{ width: "fit-content" }}>Workspace tecnico salvo</div> : null}
          {query.requested ? <div className="tag" style={{ width: "fit-content" }}>Solicitacao tecnica criada</div> : null}
          {query.siteSaved ? <div className="tag" style={{ width: "fit-content" }}>Site e tracking salvos</div> : null}
          {query.trackingSaved ? <div className="tag" style={{ width: "fit-content" }}>Credenciais de tracking salvas</div> : null}
          {query.cmsSaved ? <div className="tag" style={{ width: "fit-content" }}>WordPress conectado</div> : null}
          {query.cmsError ? <div className="tag" style={{ width: "fit-content" }}>{query.cmsError}</div> : null}
          {query.landingPublished ? <div className="tag" style={{ width: "fit-content" }}>Landing publicada: {query.landingPublished}</div> : null}
          {query.landingError ? <div className="tag" style={{ width: "fit-content" }}>{query.landingError}</div> : null}
        </section>

        <section style={{ display: "grid", gap: 20, gridTemplateColumns: "1.05fr 0.95fr" }}>
          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
            <h2 className="section-title">Capacidades tecnicas</h2>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.85 }}>
              <li>Ler codigo de sites, automacoes e integracoes.</li>
              <li>Diagnosticar bugs, problemas de performance e falhas de integração.</li>
              <li>Gerar patches, scripts e propostas de solucao.</li>
              <li>Organizar backlog tecnico por empresa.</li>
            </ul>
            <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
              O agente pode investigar e preparar correcoes sozinho. Mudancas externas sensiveis, deploy e alteracoes em produção continuam pedindo sua confirmacao.
            </p>
            <div className="grid-auto" style={{ gap: 12 }}>
              <InfoCard label="Repos cadastrados" value={String(workspace.engineeringWorkspaces.length)} />
              <InfoCard label="Solicitacoes abertas" value={String(workspace.technicalRequests.filter((request) => request.status !== "resolved").length)} />
              <InfoCard label="Perfil profissional" value={professionalProfile?.trainingStatus ?? "sem login"} />
            </div>
          </article>

          <form
            action={`/api/companies/${workspace.company.slug}/engineering`}
            method="post"
            className="glass"
            style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}
          >
            <input type="hidden" name="intent" value="create-request" />
            <h2 className="section-title">Abrir problema tecnico</h2>
            <Field label="Titulo" name="title" defaultValue="Ajuste no site ou automacao" />
            <label style={{ display: "grid", gap: 8 }}>
              <span>Area</span>
              <select name="area" defaultValue="bug" style={selectStyle}>
                <option value="bug">bug</option>
                <option value="site">site</option>
                <option value="automation">automation</option>
                <option value="integration">integration</option>
                <option value="performance">performance</option>
                <option value="analytics">analytics</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 8 }}>
              <span>Prioridade</span>
              <select name="priority" defaultValue="medium" style={selectStyle}>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </label>
            <TextAreaField label="Resumo do problema" name="summary" defaultValue="Descreva o que esta quebrado, o comportamento atual e qualquer contexto util." />
            <TextAreaField label="Resultado esperado" name="expectedOutcome" defaultValue="Explique como o sistema deveria se comportar depois da correcao." />
            <button
              type="submit"
              className="tag"
              style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
              disabled={!session}
            >
              Criar solicitacao tecnica
            </button>
          </form>
        </section>

        <section style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr 1fr" }}>
          <form
            action={`/api/companies/${workspace.company.slug}/engineering`}
            method="post"
            className="glass"
            style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}
          >
            <input type="hidden" name="intent" value="save-site-ops" />
            <h2 className="section-title">Site, landing e tracking</h2>
            <Field label="Site principal" name="primarySiteUrl" defaultValue={workspace.siteOpsProfile.primarySiteUrl} />
            <TextAreaField
              label="Landing pages prioritarias"
              name="landingPageUrls"
              defaultValue={workspace.siteOpsProfile.landingPageUrls.join("\n")}
            />
            <label style={{ display: "grid", gap: 8 }}>
              <span>Modo de captura</span>
              <select name="captureMode" defaultValue={workspace.siteOpsProfile.captureMode} style={selectStyle}>
                <option value="server_secret">webhook seguro com chave</option>
                <option value="allowlisted_browser">formulario browser com origin allowlist</option>
                <option value="disabled">desabilitado</option>
              </select>
            </label>
            <TextAreaField
              label="Origins permitidas"
              name="allowedOrigins"
              defaultValue={workspace.siteOpsProfile.allowedOrigins.join("\n")}
            />
            <Field label="Tracking domain" name="trackingDomain" defaultValue={workspace.siteOpsProfile.trackingDomain} />
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <Field label="GTM container" name="gtmContainerId" defaultValue={workspace.siteOpsProfile.gtmContainerId} />
              <Field label="GA4 measurement ID" name="ga4MeasurementId" defaultValue={workspace.siteOpsProfile.ga4MeasurementId} />
              <Field label="Meta Pixel ID" name="metaPixelId" defaultValue={workspace.siteOpsProfile.metaPixelId} />
              <Field
                label="Google Ads conversion ID"
                name="googleAdsConversionId"
                defaultValue={workspace.siteOpsProfile.googleAdsConversionId}
              />
              <Field
                label="Google Ads conversion label"
                name="googleAdsConversionLabel"
                defaultValue={workspace.siteOpsProfile.googleAdsConversionLabel}
              />
              <Field
                label="Evento de conversao"
                name="conversionEventName"
                defaultValue={workspace.siteOpsProfile.conversionEventName}
              />
            </div>
            <label style={{ display: "grid", gap: 8 }}>
              <span>CMS</span>
              <select name="cmsProvider" defaultValue={workspace.siteOpsProfile.cmsProvider} style={selectStyle}>
                <option value="none">nenhum</option>
                <option value="wordpress">wordpress</option>
                <option value="custom">custom</option>
              </select>
            </label>
            <Field label="URL do CMS" name="cmsSiteUrl" defaultValue={workspace.siteOpsProfile.cmsSiteUrl} />
            <TextAreaField
              label="Webhooks tecnicos"
              name="webhookTargets"
              defaultValue={workspace.siteOpsProfile.webhookTargets.join("\n")}
            />
            <TextAreaField label="Notas operacionais" name="notes" defaultValue={workspace.siteOpsProfile.notes} />
            <button
              type="submit"
              className="tag"
              style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
              disabled={!session}
            >
              Salvar operacao de site
            </button>
          </form>

          <div style={{ display: "grid", gap: 18 }}>
            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
              <h2 className="section-title">Kit de captura</h2>
              <div className="grid-auto" style={{ gap: 12 }}>
                <InfoCard label="Endpoint de captura" value={captureEndpoint} />
                <InfoCard label="Modo atual" value={workspace.siteOpsProfile.captureMode} />
                <InfoCard label="Origins prontas" value={String(workspace.siteOpsProfile.allowedOrigins.length)} />
                <InfoCard label="CMS" value={workspace.siteOpsProfile.cmsProvider} />
              </div>
              <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                O Agent Lion agora aceita duas trilhas: webhook seguro com chave para backend e formulario browser com origin allowlist para sites aprovados.
              </p>
              <CodeBlockField label="Snippet browser" value={browserSnippet} />
              <CodeBlockField label="Snippet server / webhook" value={serverSnippet} />
            </article>

            <form
              action={`/api/companies/${workspace.company.slug}/engineering`}
              method="post"
              className="glass"
              style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}
            >
              <input type="hidden" name="intent" value="save-tracking-secrets" />
              <h2 className="section-title">Dispatch de conversao</h2>
              <div className="grid-auto" style={{ gap: 12 }}>
                <InfoCard label="GA4 pronto" value={trackingCredentials.ga4Configured ? "sim" : "nao"} />
                <InfoCard label="Meta CAPI pronto" value={trackingCredentials.metaConfigured ? "sim" : "nao"} />
                <InfoCard label="Google Ads offline" value={googleAdsOfflineReady ? "sim" : "nao"} />
                <InfoCard label="Dedupe ativo" value={dedupeCoverage > 0 ? "sim" : "aguardando evento"} />
                <InfoCard label="Eventos enviados" value={String(workspace.conversionEvents.filter((event) => event.status === "sent").length)} />
                <InfoCard label="Eventos bloqueados" value={String(workspace.conversionEvents.filter((event) => event.status === "blocked").length)} />
              </div>
              <PasswordField label="GA4 API secret" name="ga4ApiSecret" />
              <PasswordField label="Meta access token" name="metaAccessToken" />
              <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                O Agent Lion usa esses segredos junto com Measurement ID e Pixel ID da empresa para devolver o sinal de lead as plataformas.
              </p>
              <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                Google Ads offline usa o binding operacional salvo em Social Runtime: `targetId` como customer ID, `managerAccountId` como MCC opcional e `conversionEvent` como conversion action.
              </p>
              <button
                type="submit"
                className="tag"
                style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
                disabled={!session}
              >
                Salvar credenciais de tracking
              </button>
            </form>

            <form
              action={`/api/companies/${workspace.company.slug}/engineering`}
              method="post"
              className="glass"
              style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}
            >
              <input type="hidden" name="intent" value="connect-wordpress" />
              <h2 className="section-title">Conectar WordPress</h2>
              <div className="grid-auto" style={{ gap: 12 }}>
                <InfoCard label="Status CMS" value={workspace.siteOpsProfile.cmsConnectionStatus} />
                <InfoCard label="Usuario atual" value={workspace.siteOpsProfile.cmsUsername || "nao conectado"} />
              </div>
              <Field label="URL do WordPress" name="cmsSiteUrl" defaultValue={workspace.siteOpsProfile.cmsSiteUrl} />
              <Field label="Usuario WordPress" name="cmsUsername" defaultValue={workspace.siteOpsProfile.cmsUsername} />
              <PasswordField label="Application password" name="cmsAppPassword" />
              {workspace.siteOpsProfile.cmsLastSyncSummary ? (
                <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                  Ultimo status: {workspace.siteOpsProfile.cmsLastSyncSummary}
                </p>
              ) : null}
              <button
                type="submit"
                className="tag"
                style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
                disabled={!session}
              >
                Conectar WordPress
              </button>
            </form>

            <form
              action={`/api/companies/${workspace.company.slug}/engineering`}
              method="post"
              className="glass"
              style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}
            >
              <input type="hidden" name="intent" value="publish-wordpress-landing" />
              <h2 className="section-title">Publicar landing no WordPress</h2>
              <Field label="Titulo" name="landingTitle" defaultValue="Landing Agent Lion" />
              <Field label="Slug" name="landingSlug" defaultValue="landing-agent-lion" />
              <TextAreaField
                label="Resumo"
                name="landingSummary"
                defaultValue="Pagina criada pelo Agent Lion para acelerar captacao com CTA claro, prova e formulario conectado."
              />
              <TextAreaField
                label="Bullets"
                name="landingBullets"
                defaultValue={"Beneficio principal claro\nProva e confianca acima da dobra\nCTA forte conectado ao CRM canonico"}
              />
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <Field label="CTA label" name="landingCtaLabel" defaultValue="Quero falar com a equipe" />
                <Field
                  label="CTA URL"
                  name="landingCtaUrl"
                  defaultValue={workspace.siteOpsProfile.primarySiteUrl || "https://seu-site.com/contato"}
                />
              </div>
              <label style={{ display: "grid", gap: 8 }}>
                <span>Status de publicacao</span>
                <select name="landingStatus" defaultValue="draft" style={selectStyle}>
                  <option value="draft">draft</option>
                  <option value="publish">publish</option>
                  <option value="pending">pending</option>
                  <option value="private">private</option>
                </select>
              </label>
              {workspace.siteOpsProfile.lastPublishedLandingUrl ? (
                <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                  Ultima landing: {workspace.siteOpsProfile.lastPublishedLandingTitle} {workspace.siteOpsProfile.lastPublishedLandingUrl}
                </p>
              ) : null}
              <button
                type="submit"
                className="tag"
                style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
                disabled={!session}
              >
                Publicar landing
              </button>
            </form>

            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
              <h2 className="section-title">Boilerplate de tracking</h2>
              <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                Use este push no `dataLayer` ou no seu gerenciador atual para costurar GTM, GA4, Meta Pixel e Google Ads com a captura do Lead canonico.
              </p>
              <CodeBlockField label="Tracking snippet" value={trackingSnippet} />
            </article>

            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
              <h2 className="section-title">Runtime de conversao</h2>
              {workspace.conversionEvents.length === 0 ? (
                <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                  Nenhum evento de conversao registrado ainda. O proximo lead capturado vai aparecer aqui com status por destino.
                </p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {workspace.conversionEvents.slice(0, 6).map((event) => (
                    <article
                      key={event.id}
                      style={{
                        padding: 14,
                        borderRadius: 16,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(148, 196, 208, 0.1)",
                        display: "grid",
                        gap: 6
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <strong>{event.eventName}</strong>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span className="tag">{event.destination}</span>
                          <span className="tag">{event.status}</span>
                        </div>
                      </div>
                      <span className="muted">{event.summary}</span>
                      <span className="muted">{event.detail}</span>
                      <span className="muted">
                        {event.externalRef ? `ref ${event.externalRef}` : "sem ref externa"}
                        {event.dedupeKey ? ` · dedupe ${event.dedupeKey}` : ""}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </article>
          </div>
        </section>

        <section className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 18 }}>
          <h2 className="section-title">Workspaces de codigo</h2>
          <div style={{ display: "grid", gap: 14 }}>
            {workspace.engineeringWorkspaces.map((codeWorkspace) => (
              <form
                key={codeWorkspace.id}
                action={`/api/companies/${workspace.company.slug}/engineering`}
                method="post"
                style={{
                  padding: 18,
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(148, 196, 208, 0.1)",
                  display: "grid",
                  gap: 12
                }}
              >
                <input type="hidden" name="intent" value="save-workspace" />
                <input type="hidden" name="workspaceId" value={codeWorkspace.id} />
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
                  <strong>{codeWorkspace.label}</strong>
                  <span className="tag">{codeWorkspace.status}</span>
                </div>
                <Field label="Caminho do repo ou workspace" name="path" defaultValue={codeWorkspace.path} />
                <Field label="Stack" name="stack" defaultValue={codeWorkspace.stack} />
                <Field label="Objetivo" name="objective" defaultValue={codeWorkspace.objective} />
                <label style={{ display: "grid", gap: 8 }}>
                  <span>Status</span>
                  <select name="status" defaultValue={codeWorkspace.status} style={selectStyle}>
                    <option value="connected">connected</option>
                    <option value="planned">planned</option>
                    <option value="attention_needed">attention_needed</option>
                  </select>
                </label>
                <label style={{ display: "grid", gap: 8 }}>
                  <span>Acesso</span>
                  <select name="access" defaultValue={codeWorkspace.access} style={selectStyle}>
                    <option value="read">read</option>
                    <option value="write">write</option>
                  </select>
                </label>
                <TextAreaField label="Notas" name="notes" defaultValue={codeWorkspace.notes} />
                <button
                  type="submit"
                  className="tag"
                  style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
                  disabled={!session}
                >
                  Salvar workspace tecnico
                </button>
              </form>
            ))}
          </div>
        </section>

        <section className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 18 }}>
          <h2 className="section-title">Backlog tecnico</h2>
          {workspace.technicalRequests.length === 0 ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
              Nenhuma solicitacao tecnica registrada ainda.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {workspace.technicalRequests.map((request) => (
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
                    {request.area} Â· prioridade {request.priority}
                  </span>
                  <p style={{ margin: 0, lineHeight: 1.65 }}>{request.summary}</p>
                  <p style={{ margin: 0, lineHeight: 1.65 }}>
                    Resultado esperado: <strong>{request.expectedOutcome}</strong>
                  </p>
                  <div style={{ display: "grid", gap: 8 }}>
                    <strong>Plano do agente</strong>
                    <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                      {request.agentPlan.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          )}
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

function PasswordField({ label, name }: { label: string; name: string }) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span>{label}</span>
      <input
        type="password"
        name={name}
        defaultValue=""
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

function CodeBlockField({ label, value }: { label: string; value: string }) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span>{label}</span>
      <textarea
        value={value}
        readOnly
        rows={10}
        style={{
          borderRadius: 14,
          border: "1px solid rgba(148, 196, 208, 0.16)",
          background: "rgba(8,18,24,0.88)",
          color: "inherit",
          padding: "12px 14px",
          resize: "vertical",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: 12,
          lineHeight: 1.6
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

const selectStyle = {
  borderRadius: 14,
  border: "1px solid rgba(148, 196, 208, 0.16)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  padding: "12px 14px"
} satisfies CSSProperties;
