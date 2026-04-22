import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getSessionFromCookies } from "@/lib/session";
import { getCompanyWorkspace } from "@/lib/connectors";
import type { CompanyConversionEvent } from "@/lib/domain";
import {
  getLeadCadenceTrackLabel,
  getLeadRouteBucketLabel,
  getLeadSourceLabel,
  getLeadSyncStatusLabel,
  getLeadStageLabel,
  listToTextarea
} from "@/lib/conversion";

type PageProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ saved?: string; lead?: string; leadUpdated?: string; crmSaved?: string; crmSync?: string; captureKey?: string; crmLeadStatus?: string }>;
};

export default async function CompanyConversionPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);
  const workspace = getCompanyWorkspace(companyId);

  if (!workspace) {
    notFound();
  }

  const conversion = workspace.keywordStrategy;
  const sentConversionEvents = workspace.conversionEvents.filter((event) => event.status === "sent");
  const blockedConversionEvents = workspace.conversionEvents.filter((event) => event.status === "blocked");
  const failedConversionEvents = workspace.conversionEvents.filter((event) => event.status === "failed");
  const wonRevenue = workspace.leads.reduce((total, lead) => total + (lead.revenueActual ?? 0), 0);
  const googleAdsBinding = workspace.socialBindings.find((binding) => binding.platform === "google-ads");
  const googleAdsOfflineReady = Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
      googleAdsBinding?.targetId &&
      googleAdsBinding?.conversionEvent
  );
  const destinationHealth = summarizeDestinationHealth(workspace.conversionEvents);

  return (
    <main style={{ padding: "32px 0 80px" }}>
      <div className="shell" style={{ display: "grid", gap: 24 }}>
        <section className="glass" style={{ padding: 28, borderRadius: 28, display: "grid", gap: 14 }}>
          <Link href={`/empresas/${workspace.company.slug}`} className="tag" style={{ width: "fit-content" }}>
            Voltar para o workspace
          </Link>
          <p className="eyebrow">Inteligencia de Conversao</p>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 1.6rem + 1.5vw, 3.3rem)" }}>
            {workspace.company.name}
          </h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7, maxWidth: 940 }}>
            Esse modulo organiza palavras-chave, long tails, angulos de conversao, mensagens de landing e fontes de dados permitidas. A intencao aqui e aumentar conversao com inteligencia de mercado e dados consentidos, nao com uso indevido de dados pessoais.
          </p>
          {query.saved ? <div className="tag" style={{ width: "fit-content" }}>Estrategia de conversao salva</div> : null}
          {query.lead ? <div className="tag" style={{ width: "fit-content" }}>Lead registrado no CRM canonico</div> : null}
          {query.leadUpdated ? <div className="tag" style={{ width: "fit-content" }}>Lead atualizado</div> : null}
          {query.crmSaved ? <div className="tag" style={{ width: "fit-content" }}>CRM externo configurado</div> : null}
          {query.crmSync ? <div className="tag" style={{ width: "fit-content" }}>{query.crmSync}</div> : null}
          {query.captureKey ? <div className="tag" style={{ width: "fit-content" }}>Chave de captura rotacionada</div> : null}
          {query.crmLeadStatus ? <div className="tag" style={{ width: "fit-content" }}>Status CRM do lead: {query.crmLeadStatus}</div> : null}
        </section>

        <section style={{ display: "grid", gap: 20, gridTemplateColumns: "1.05fr 0.95fr" }}>
          <form
            action={`/api/companies/${workspace.company.slug}/conversion`}
            method="post"
            className="glass"
            style={{ padding: 22, borderRadius: 22, display: "grid", gap: 18 }}
          >
            <Field label="Oferta principal" name="mainOffer" defaultValue={conversion.mainOffer} />
            <TextAreaField label="Palavras-chave principais" name="primaryKeywords" defaultValue={listToTextarea(conversion.primaryKeywords)} />
            <TextAreaField label="Palavras-chave long tail" name="longTailKeywords" defaultValue={listToTextarea(conversion.longTailKeywords)} />
            <TextAreaField label="Negative keywords" name="negativeKeywords" defaultValue={listToTextarea(conversion.negativeKeywords)} />
            <TextAreaField label="Angulos de conversao" name="conversionAngles" defaultValue={listToTextarea(conversion.conversionAngles)} />
            <TextAreaField label="Mensagens de landing" name="landingMessages" defaultValue={listToTextarea(conversion.landingMessages)} />
            <TextAreaField label="Sinais de audiencia" name="audienceSignals" defaultValue={listToTextarea(conversion.audienceSignals)} />
            <TextAreaField label="Fontes de dados aprovadas" name="approvedDataSources" defaultValue={listToTextarea(conversion.approvedDataSources)} />
            <TextAreaField label="Fontes bloqueadas" name="blockedDataSources" defaultValue={listToTextarea(conversion.blockedDataSources)} />
            <TextAreaField label="Regras de otimizacao" name="optimizationRules" defaultValue={listToTextarea(conversion.optimizationRules)} />
            <TextAreaField label="Nota de compliance" name="complianceNote" defaultValue={conversion.complianceNote} />

            <button
              type="submit"
              className="tag"
              style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
              disabled={!session}
            >
              Salvar estrategia de conversao
            </button>
          </form>

          <div style={{ display: "grid", gap: 18 }}>
            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
              <h2 className="section-title">Funil canonico de leads</h2>
              <div className="grid-auto" style={{ gap: 12 }}>
                <InfoCard label="Leads totais" value={String(workspace.leads.length)} />
                <InfoCard label="Novos" value={String(workspace.leads.filter((lead) => lead.stage === "new").length)} />
                <InfoCard label="Qualificados" value={String(workspace.leads.filter((lead) => lead.stage === "qualified").length)} />
                <InfoCard label="Ganhos" value={String(workspace.leads.filter((lead) => lead.stage === "won").length)} />
                <InfoCard label="Rota vendas" value={String(workspace.leads.filter((lead) => lead.routeBucket === "sales" || lead.routeBucket === "vip").length)} />
                <InfoCard label="Rota nutricao" value={String(workspace.leads.filter((lead) => lead.routeBucket === "nurture").length)} />
              </div>
              <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                Esta caixa passa a ser a fonte canonica do Agent Lion para captacao, follow-up e feedback de receita. Agora ela tambem pode sincronizar contatos com HubSpot e receber capturas reais de sites e landing pages.
              </p>
            </article>

            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
              <h2 className="section-title">Dispatch e atribuicao</h2>
              <div className="grid-auto" style={{ gap: 12 }}>
                <InfoCard label="Eventos enviados" value={String(sentConversionEvents.length)} />
                <InfoCard label="Eventos bloqueados" value={String(blockedConversionEvents.length)} />
                <InfoCard label="Eventos falhos" value={String(failedConversionEvents.length)} />
                <InfoCard label="Receita ganha" value={formatCurrency(wonRevenue)} />
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <span className="muted">
                  GA4 e Meta CAPI usam o mesmo `event_id` do browser quando o lead chega com `clientEventId`. Google Ads offline depende do binding operacional da conta.
                </span>
                <span className="muted">
                  Google Ads offline: {googleAdsOfflineReady ? "pronto para upload" : "ainda precisa de customer ID, conversion action ou developer token"}.
                </span>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {destinationHealth.map((item) => (
                  <article
                    key={item.destination}
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
                      <strong>{item.destination}</strong>
                      <span className="tag">{item.summary}</span>
                    </div>
                    <span className="muted">
                      Sent {item.sent} · bloqueados {item.blocked} · falhas {item.failed}
                    </span>
                  </article>
                ))}
              </div>
            </article>

            <form
              action={`/api/companies/${workspace.company.slug}/conversion`}
              method="post"
              className="glass"
              style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}
            >
              <input type="hidden" name="intent" value="create-lead" />
              <h2 className="section-title">Registrar lead</h2>
              <Field label="Nome completo" name="fullName" defaultValue="" />
              <Field label="Email" name="email" defaultValue="" />
              <Field label="Telefone" name="phone" defaultValue="" />
              <Field label="Canal" name="channel" defaultValue="Operacao manual" />
              <Field label="Campanha" name="campaignName" defaultValue="" />
              <Field
                label="Owner"
                name="owner"
                defaultValue={workspace.crmProfile.defaultOwner || session?.email || "operacao@agentlion.ai"}
              />
              <Field label="Proxima acao" name="nextAction" defaultValue="Fazer primeiro contato" />
              <Field label="Follow-up" name="nextFollowUpAt" defaultValue="" type="datetime-local" />
              <Field label="Receita potencial" name="revenuePotential" defaultValue="" />
              <SelectField
                label="Origem"
                name="source"
                defaultValue="manual"
                options={[
                  { value: "manual", label: "manual" },
                  { value: "site_form", label: "site" },
                  { value: "landing_page", label: "landing page" },
                  { value: "whatsapp", label: "whatsapp" },
                  { value: "meta_ads", label: "meta ads" },
                  { value: "google_ads", label: "google ads" },
                  { value: "organic", label: "organico" },
                  { value: "crm_import", label: "crm import" }
                ]}
              />
              <SelectField
                label="Consentimento"
                name="consentStatus"
                defaultValue="unknown"
                options={[
                  { value: "unknown", label: "desconhecido" },
                  { value: "granted", label: "concedido" },
                  { value: "denied", label: "negado" }
                ]}
              />
              <TextAreaField label="Notas" name="notes" defaultValue="" />
              <button
                type="submit"
                className="tag"
                style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
                disabled={!session}
              >
                Criar lead
              </button>
            </form>
          </div>
        </section>

        <section style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr 1fr" }}>
          <form
            action={`/api/companies/${workspace.company.slug}/conversion`}
            method="post"
            className="glass"
            style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}
          >
            <input type="hidden" name="intent" value="save-crm" />
            <h2 className="section-title">CRM externo</h2>
            <SelectField
              label="Provider"
              name="provider"
              defaultValue={workspace.crmProfile.provider}
              options={[
                { value: "none", label: "somente CRM canonico" },
                { value: "hubspot", label: "HubSpot" },
                { value: "rd-station", label: "RD Station" },
                { value: "activecampaign", label: "ActiveCampaign" },
                { value: "mailchimp", label: "Mailchimp" },
                { value: "klaviyo", label: "Klaviyo" }
              ]}
            />
            <SelectField
              label="Modo de sync"
              name="syncMode"
              defaultValue={workspace.crmProfile.syncMode}
              options={[
                { value: "scheduler_sync", label: "sincronizar pelo scheduler" },
                { value: "push_on_capture", label: "empurrar no capture/create" },
                { value: "manual_review", label: "somente local / revisao" }
              ]}
            />
            <Field label="Owner padrao" name="defaultOwner" defaultValue={workspace.crmProfile.defaultOwner} />
            <Field label="Owner vendas" name="salesOwner" defaultValue={workspace.crmProfile.salesOwner ?? ""} />
            <Field label="Owner nutricao" name="nurtureOwner" defaultValue={workspace.crmProfile.nurtureOwner ?? ""} />
            <Field label="Owner VIP" name="vipOwner" defaultValue={workspace.crmProfile.vipOwner ?? ""} />
            <SelectField
              label="Modo de roteamento"
              name="routingMode"
              defaultValue={workspace.crmProfile.routingMode ?? "score_based"}
              options={[
                { value: "score_based", label: "score e contexto" },
                { value: "manual_only", label: "somente manual" }
              ]}
            />
            <Field label="Retencao de dados (dias)" name="retentionDays" defaultValue={String(workspace.crmProfile.retentionDays ?? 180)} />
            <Field label="Token privado do HubSpot (opcional para trocar)" name="hubspotToken" defaultValue="" type="password" />
            <label style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input type="checkbox" name="requireConsentForEmail" defaultChecked={workspace.crmProfile.requireConsentForEmail !== false} />
              <span>Exigir consentimento para nutricao por email</span>
            </label>
            <label style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input type="checkbox" name="requireConsentForAds" defaultChecked={workspace.crmProfile.requireConsentForAds !== false} />
              <span>Exigir consentimento antes de uso publicitario identificavel</span>
            </label>
            <TextAreaField label="Notas operacionais" name="notes" defaultValue={workspace.crmProfile.notes} rows={4} />
            <button
              type="submit"
              className="tag"
              style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
              disabled={!session}
            >
              Salvar CRM externo
            </button>
            <div style={{ display: "grid", gap: 8 }}>
              <span className="tag" style={{ width: "fit-content" }}>status {workspace.crmProfile.status}</span>
              <span className="muted">
                Provider atual: {workspace.crmProfile.provider === "none"
                  ? "CRM canonico apenas"
                  : workspace.crmProfile.accountLabel ?? `${workspace.crmProfile.provider} em configuracao`}
              </span>
              {workspace.crmProfile.portalId ? <span className="muted">Portal: {workspace.crmProfile.portalId}</span> : null}
              {workspace.crmProfile.lastSyncSummary ? <span className="muted">Ultimo sync: {workspace.crmProfile.lastSyncSummary}</span> : null}
            </div>
          </form>

          <div style={{ display: "grid", gap: 18 }}>
            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
              <h2 className="section-title">Captura para site e landing page</h2>
              <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                Use este endpoint para enviar leads reais do site, landing page, webhook ou automacao direto para a caixa canonica do Agent Lion.
              </p>
              <Field
                label="Endpoint publico"
                name="captureEndpoint"
                defaultValue={`${process.env.NEXT_PUBLIC_APP_URL ?? "https://seu-dominio.com"}/api/companies/${workspace.company.slug}/conversion/capture`}
              />
              <Field
                label="Chave de captura"
                name="captureSecretPreview"
                defaultValue={workspace.crmProfile.captureSecret ?? "salve o CRM para gerar a primeira chave"}
              />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <form action={`/api/companies/${workspace.company.slug}/conversion`} method="post">
                  <input type="hidden" name="intent" value="rotate-capture-key" />
                  <button
                    type="submit"
                    className="tag"
                    style={{ border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
                    disabled={!session}
                  >
                    Rotacionar chave
                  </button>
                </form>
                <form action={`/api/companies/${workspace.company.slug}/conversion`} method="post">
                  <input type="hidden" name="intent" value="sync-crm" />
                  <button
                    type="submit"
                    className="tag"
                    style={{ border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
                    disabled={!session}
                  >
                    Sincronizar leads agora
                  </button>
                </form>
              </div>
              <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                Envie `fullName`, `email`, `phone`, `source`, `channel`, `campaignName` e a chave no header `x-agent-lion-capture-key` ou no corpo como `captureKey`.
              </p>
            </article>

            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
              <h2 className="section-title">Autonomia de CRM</h2>
              <div className="grid-auto" style={{ gap: 12 }}>
                <InfoCard label="Pendentes de sync" value={String(workspace.leads.filter((lead) => lead.syncStatus === "pending_sync").length)} />
                <InfoCard label="Sincronizados" value={String(workspace.leads.filter((lead) => lead.syncStatus === "synced").length)} />
                <InfoCard label="Erro de sync" value={String(workspace.leads.filter((lead) => lead.syncStatus === "sync_error").length)} />
                <InfoCard label="Modo atual" value={workspace.crmProfile.syncMode} />
                <InfoCard label="Roteamento" value={workspace.crmProfile.routingMode ?? "score_based"} />
                <InfoCard label="Retencao" value={`${workspace.crmProfile.retentionDays ?? 180} dias`} />
              </div>
            </article>

            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
              <h2 className="section-title">Eventos recentes de conversao</h2>
              {workspace.conversionEvents.length === 0 ? (
                <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
                  Nenhum evento registrado ainda. O proximo lead capturado vai aparecer aqui por destino com dedupe e referencia externa.
                </p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {workspace.conversionEvents.slice(0, 8).map((event) => (
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
                        Valor {formatCurrency(event.value ?? 0)}
                        {event.externalRef ? ` · ref ${event.externalRef}` : ""}
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
          <h2 className="section-title">Pipeline de leads</h2>
          {workspace.leads.length === 0 ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
              Nenhum lead registrado ainda. O proximo passo natural e ligar formularios, landing pages, campanhas e o endpoint de captura a esta caixa canonica.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {workspace.leads.map((lead) => (
                <form
                  key={lead.id}
                  action={`/api/companies/${workspace.company.slug}/conversion`}
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
                  <input type="hidden" name="intent" value="update-lead" />
                  <input type="hidden" name="leadId" value={lead.id} />
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <strong>{lead.fullName}</strong>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className="tag">{getLeadStageLabel(lead.stage)}</span>
                      <span className="tag">score {lead.score}</span>
                      <span className="tag">{getLeadSourceLabel(lead.source)}</span>
                      <span className="tag">{getLeadRouteBucketLabel(lead.routeBucket)}</span>
                      <span className="tag">{getLeadCadenceTrackLabel(lead.cadenceTrack)}</span>
                      <span className="tag">{getLeadSyncStatusLabel(lead.syncStatus)}</span>
                    </div>
                  </div>
                  <span className="muted">
                    {lead.channel}
                    {lead.campaignName ? ` | ${lead.campaignName}` : ""}
                    {lead.email ? ` | ${lead.email}` : ""}
                    {lead.phone ? ` | ${lead.phone}` : ""}
                  </span>
                  {lead.externalCrmId ? <span className="muted">CRM ID: {lead.externalCrmId}</span> : null}
                  {lead.syncError ? (
                    <span className="muted" style={{ color: "#ffb4b4" }}>
                      Erro CRM: {lead.syncError}
                    </span>
                  ) : null}
                  {lead.routeReason ? <span className="muted">Rota: {lead.routeReason}</span> : null}
                  <p style={{ margin: 0, lineHeight: 1.65 }}>
                    Proxima acao: <strong>{lead.nextAction}</strong>
                  </p>
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                    <SelectField
                      label="Estagio"
                      name="stage"
                      defaultValue={lead.stage}
                      options={[
                        { value: "new", label: "novo" },
                        { value: "contacted", label: "contatado" },
                        { value: "qualified", label: "qualificado" },
                        { value: "proposal", label: "proposta" },
                        { value: "won", label: "ganho" },
                        { value: "lost", label: "perdido" }
                      ]}
                    />
                    <Field label="Owner" name="owner" defaultValue={lead.owner} />
                    <Field label="Proxima acao" name="nextAction" defaultValue={lead.nextAction} />
                    <Field label="Follow-up" name="nextFollowUpAt" defaultValue={lead.nextFollowUpAt ? lead.nextFollowUpAt.slice(0, 16) : ""} type="datetime-local" />
                    <Field label="Receita potencial" name="revenuePotential" defaultValue={lead.revenuePotential ? String(lead.revenuePotential) : ""} />
                    <Field label="Oportunidade" name="opportunityValue" defaultValue={lead.opportunityValue ? String(lead.opportunityValue) : ""} />
                    <Field label="Receita realizada" name="revenueActual" defaultValue={lead.revenueActual ? String(lead.revenueActual) : ""} />
                    <Field label="LTV" name="lifetimeValue" defaultValue={lead.lifetimeValue ? String(lead.lifetimeValue) : ""} />
                    <Field label="Ultimo contato" name="lastContactedAt" defaultValue={lead.lastContactedAt ? lead.lastContactedAt.slice(0, 16) : ""} type="datetime-local" />
                    <Field label="Motivo da perda" name="lostReason" defaultValue={lead.lostReason ?? ""} />
                  </div>
                  <TextAreaField label="Adicionar nota" name="note" defaultValue="" rows={3} />
                  {lead.notes.length ? (
                    <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                      {lead.notes.map((note) => (
                        <li key={`${lead.id}-${note}`}>{note}</li>
                      ))}
                    </ul>
                  ) : null}
                  <button
                    type="submit"
                    className="tag"
                    style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
                    disabled={!session}
                  >
                    Atualizar lead
                  </button>
                </form>
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
  type = "text"
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span>{label}</span>
      <input
        type={type}
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
  rows = 5
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

function SelectField({
  label,
  name,
  defaultValue,
  options
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span>{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        style={{
          borderRadius: 14,
          border: "1px solid rgba(148, 196, 208, 0.16)",
          background: "rgba(255,255,255,0.04)",
          color: "inherit",
          padding: "12px 14px"
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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

function summarizeDestinationHealth(events: CompanyConversionEvent[]) {
  const counters = new Map<
    string,
    { destination: string; sent: number; blocked: number; failed: number; summary: string }
  >();

  for (const event of events) {
    const current = counters.get(event.destination) ?? {
      destination: event.destination,
      sent: 0,
      blocked: 0,
      failed: 0,
      summary: "saudavel"
    };

    current.sent += event.status === "sent" ? 1 : 0;
    current.blocked += event.status === "blocked" ? 1 : 0;
    current.failed += event.status === "failed" ? 1 : 0;
    current.summary =
      current.failed > 0 ? "falhas abertas" : current.blocked > 0 ? "bloqueios ativos" : "saudavel";

    counters.set(event.destination, current);
  }

  return Array.from(counters.values());
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2
  }).format(value);
}
