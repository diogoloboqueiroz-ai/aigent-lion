import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getCompanyWorkspace } from "@/lib/connectors";
import { getCreativeToolLabel } from "@/lib/creative-tools";
import type { SocialPlatformId } from "@/lib/domain";
import { listToTextarea } from "@/lib/social-ops";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

type PageProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ saved?: string; post?: string; ad?: string; decision?: string; connect?: string }>;
};

export default async function CompanySocialPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);
  const professionalProfile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(companyId, professionalProfile);

  if (!workspace) {
    notFound();
  }

  const suggestedSchedule = buildNextDayInputValue(workspace.socialProfile.updatedAt);

  return (
    <main style={{ padding: "32px 0 80px" }}>
      <div className="shell" style={{ display: "grid", gap: 24 }}>
        <section className="glass" style={{ padding: 28, borderRadius: 28, display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href={`/empresas/${workspace.company.slug}`} className="tag" style={{ width: "fit-content" }}>
              Voltar para o workspace
            </Link>
            <Link href={`/empresas/${workspace.company.slug}/social/runtime`} className="tag" style={{ width: "fit-content" }}>
              Abrir runtime social
            </Link>
            <Link href={`/empresas/${workspace.company.slug}/aprovacoes`} className="tag" style={{ width: "fit-content" }}>
              Approval Center
            </Link>
            <Link href={`/empresas/${workspace.company.slug}/scheduler`} className="tag" style={{ width: "fit-content" }}>
              Scheduler
            </Link>
          </div>
          <p className="eyebrow">Social Ops e Anuncios</p>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 1.6rem + 1.5vw, 3.3rem)" }}>{workspace.company.name}</h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7, maxWidth: 980 }}>
            O agente atua como especialista em Instagram, Facebook, Google, LinkedIn, TikTok e YouTube para criar agenda, programar posts, preparar anuncios e ler estatisticas de cada plataforma.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span className="tag">runtime queue: {workspace.socialRuntime.queuedTasks}</span>
            <span className="tag">publish ready: {workspace.socialRuntime.publishReadyPlatforms}</span>
            <span className="tag">analytics ready: {workspace.socialRuntime.analyticsReadyPlatforms}</span>
          </div>
          {query.saved ? <div className="tag" style={{ width: "fit-content" }}>Perfil social salvo</div> : null}
          {query.post ? <div className="tag" style={{ width: "fit-content" }}>{buildPostMessage(query.post)}</div> : null}
          {query.ad ? <div className="tag" style={{ width: "fit-content" }}>{buildAdMessage(query.ad)}</div> : null}
          {query.decision ? <div className="tag" style={{ width: "fit-content" }}>Decisao registrada: {query.decision}</div> : null}
          {query.connect ? <div className="tag" style={{ width: "fit-content" }}>Conexao social: {query.connect}</div> : null}
        </section>

        <section style={{ display: "grid", gap: 20, gridTemplateColumns: "1.05fr 0.95fr" }}>
          <form
            action={`/api/companies/${workspace.company.slug}/social`}
            method="post"
            className="glass"
            style={{ padding: 22, borderRadius: 22, display: "grid", gap: 16 }}
          >
            <input type="hidden" name="intent" value="save-profile" />
            <Field label="Objetivo principal" name="primaryObjective" defaultValue={workspace.socialProfile.primaryObjective} />
            <Field label="Cadencia editorial" name="publishingCadence" defaultValue={workspace.socialProfile.publishingCadence} />
            <Field
              label="Plataformas prioritarias (separe por virgula)"
              name="priorityPlatforms"
              defaultValue={workspace.socialProfile.priorityPlatforms.join(", ")}
            />
            <TextAreaField label="Pilares de conteudo" name="contentPillars" defaultValue={listToTextarea(workspace.socialProfile.contentPillars)} />
            <TextAreaField label="Objetivos de anuncios" name="adObjectives" defaultValue={listToTextarea(workspace.socialProfile.adObjectives)} />
            <TextAreaField label="Notas de audiencia" name="audienceNotes" defaultValue={listToTextarea(workspace.socialProfile.audienceNotes)} />
            <TextAreaField label="Regra de autonomia" name="autonomyRule" defaultValue={workspace.socialProfile.autonomyRule} />
            <TextAreaField label="Regra de aprovacao" name="approvalRule" defaultValue={workspace.socialProfile.approvalRule} />
            <TextAreaField label="Politica de agenda" name="schedulingPolicy" defaultValue={workspace.socialProfile.schedulingPolicy} />
            <TextAreaField label="Rotina analitica" name="analyticsRoutine" defaultValue={workspace.socialProfile.analyticsRoutine} />

            <button
              type="submit"
              className="tag"
              style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
              disabled={!session}
            >
              Salvar social ops
            </button>
          </form>

          <div style={{ display: "grid", gap: 18 }}>
            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
              <h2 className="section-title">Especialista por plataforma</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {workspace.socialPlatforms.map((platform) => (
                  <div
                    key={platform.id}
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
                      <strong>{platform.label}</strong>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <span className="tag">{platform.status}</span>
                        <a href={buildPlatformConnectHref(workspace.company.slug, platform.platform)} className="tag">
                          {platform.status === "connected" ? "Reconectar" : "Conectar conta"}
                        </a>
                      </div>
                    </div>
                    <span className="muted">
                      Publicacao: {platform.publishingMode} · Analytics: {platform.analyticsMode}
                    </span>
                    <span>Conta: {platform.accountLabel}</span>
                    <span>Capacidades: {platform.capabilities.join(", ")}</span>
                    <p style={{ margin: 0, lineHeight: 1.6 }}>{platform.nextAction}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
              <h2 className="section-title">Estatisticas das plataformas</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {workspace.socialInsights.map((insight) => (
                  <div
                    key={`${insight.platform}-${insight.window}`}
                    style={{
                      padding: 16,
                      borderRadius: 18,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(148, 196, 208, 0.1)",
                      display: "grid",
                      gap: 8
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <strong>{insight.platform}</strong>
                      <span className="tag">{insight.window}</span>
                    </div>
                    <span>Seguidores: {insight.followers}</span>
                    <span>Reach: {insight.reach}</span>
                    <span>Engajamento: {insight.engagementRate}</span>
                    <span>Clicks: {insight.clicks}</span>
                    <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>{insight.note}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr 1fr" }}>
          <form
            action={`/api/companies/${workspace.company.slug}/social`}
            method="post"
            className="glass"
            style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}
          >
            <input type="hidden" name="intent" value="create-post" />
            <h2 className="section-title">Programar post</h2>
            <Field label="Titulo" name="title" defaultValue="Post semanal da campanha" />
            <SelectField label="Plataforma" name="platform" defaultValue="instagram" options={POST_PLATFORM_OPTIONS} />
            <SelectField label="Formato" name="format" defaultValue="carousel" options={POST_FORMAT_OPTIONS} />
            <Field label="Agendar para" name="scheduledFor" defaultValue={suggestedSchedule} />
            <Field label="Ferramenta usada" name="createdWith" defaultValue={workspace.creativeTools[0]?.provider ?? "canva"} />
            <TextAreaField label="Resumo do post" name="summary" defaultValue="Objetivo, CTA, oferta e observacoes do material." />
            <TextAreaField label="Legenda / caption" name="caption" defaultValue="Legenda final aprovada para a plataforma." />
            <Field label="URL publica do asset" name="assetUrl" defaultValue="https://..." />
            <TextAreaField label="Multiplos assets (um por linha)" name="assetUrls" defaultValue={"https://cdn.exemplo.com/card-1.jpg\nhttps://cdn.exemplo.com/card-2.jpg"} />
            <Field label="URL de destino / landing" name="landingUrl" defaultValue="https://..." />
            <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
              Facebook, Instagram, LinkedIn, TikTok, YouTube e Google Business ja entram na runtime, incluindo Stories do Instagram quando o asset final estiver em URL publica.
            </p>
            <button
              type="submit"
              className="tag"
              style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
              disabled={!session}
            >
              Criar post programado
            </button>
          </form>

          <form
            action={`/api/companies/${workspace.company.slug}/social`}
            method="post"
            className="glass"
            style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}
          >
            <input type="hidden" name="intent" value="create-ad" />
            <h2 className="section-title">Criar anuncio</h2>
            <Field label="Titulo do anuncio" name="title" defaultValue="Campanha de leads social" />
            <SelectField
              label="Plataforma / canal"
              name="platform"
              defaultValue="instagram"
              options={[
                { value: "instagram", label: "Instagram / Meta Ads" },
                { value: "facebook", label: "Facebook / Meta Ads" },
                { value: "google-ads", label: "Google Ads Search" }
              ]}
            />
            <Field label="Objetivo" name="objective" defaultValue="Geracao de leads" />
            <Field label="Budget" name="budget" defaultValue="R$ 120/dia" />
            <Field label="Inicio previsto" name="scheduledStart" defaultValue={suggestedSchedule} />
            <Field label="Headline principal" name="headline" defaultValue="Agende sua avaliacao com especialistas" />
            <Field label="Descricao curta" name="description" defaultValue="Oferta aprovada para captacao qualificada com CTA claro." />
            <Field label="Landing URL final" name="landingUrl" defaultValue="https://..." />
            <Field label="Asset principal (URL publica)" name="assetUrl" defaultValue="https://..." />
            <TextAreaField label="Assets adicionais (um por linha)" name="assetUrls" defaultValue={"https://cdn.exemplo.com/ad-1.jpg\nhttps://cdn.exemplo.com/ad-2.jpg"} />
            <TextAreaField label="Keywords / temas de busca" name="keywordThemes" defaultValue={"ortodontista premium\nclinica odontologica premium"} />
            <TextAreaField label="Publico" name="audience" defaultValue="Descreva publico, localizacao e comportamento." />
            <TextAreaField label="Angulo criativo" name="creativeAngle" defaultValue="Hook principal, prova e oferta." />
            <TextAreaField label="CTA" name="callToAction" defaultValue="Fale com a equipe agora" />
            <button
              type="submit"
              className="tag"
              style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
              disabled={!session}
            >
              Criar draft de anuncio
            </button>
          </form>
        </section>

        <section className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 18 }}>
          <h2 className="section-title">Fila de posts programados</h2>
          {workspace.scheduledPosts.length === 0 ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>Nenhum post agendado ainda.</p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {workspace.scheduledPosts.map((post) => (
                <article key={post.id} style={queueStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <strong>{post.title}</strong>
                    <span className="tag">{post.status}</span>
                  </div>
                  <span className="muted">
                    {post.platform} · {post.format} · {getCreativeToolLabel(post.createdWith)}
                  </span>
                  <span>Agendado para: {new Date(post.scheduledFor).toLocaleString("pt-BR")}</span>
                  {post.sourceApprovalRequestId ? (
                    <span className="tag" style={{ width: "fit-content" }}>
                      Aprovacao do Studio reaproveitada sem segunda aprovacao
                    </span>
                  ) : null}
                  {post.sourceAssetId ? (
                    <span className="tag" style={{ width: "fit-content" }}>
                      Ativo do Studio conectado ao Social Ops
                    </span>
                  ) : null}
                  {post.sourceExperimentId ? (
                    <span className="tag" style={{ width: "fit-content" }}>
                      Experimento: {post.sourceExperimentId}
                    </span>
                  ) : null}
                  {post.variantLabel ? (
                    <span className="tag" style={{ width: "fit-content" }}>
                      Variante: {post.variantLabel}
                    </span>
                  ) : null}
                  <p style={{ margin: 0, lineHeight: 1.6 }}>{post.summary}</p>
                  {post.caption ? <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>Caption: {post.caption}</p> : null}
                  {post.assetUrl ? (
                    <a href={post.assetUrl} target="_blank" rel="noreferrer" className="tag" style={{ width: "fit-content" }}>
                      Abrir asset
                    </a>
                  ) : null}
                  {post.assetUrls && post.assetUrls.length > 1 ? (
                    <span className="tag" style={{ width: "fit-content" }}>
                      {post.assetUrls.length} assets no carrossel
                    </span>
                  ) : null}
                  {session ? (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {post.status === "pending_approval" ? <ActionButton companySlug={workspace.company.slug} itemId={post.id} intent="approve" label="Aprovar e agendar" /> : null}
                      {post.status === "scheduled" ? <ActionButton companySlug={workspace.company.slug} itemId={post.id} intent="mark-posted" label="Marcar como publicado" /> : null}
                      {post.status !== "posted" && post.status !== "rejected" ? <ActionButton companySlug={workspace.company.slug} itemId={post.id} intent="reject" label="Rejeitar" /> : null}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 18 }}>
          <h2 className="section-title">Fila de anuncios</h2>
          {workspace.socialAdDrafts.length === 0 ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>Nenhum draft de anuncio ainda.</p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {workspace.socialAdDrafts.map((draft) => (
                <article key={draft.id} style={queueStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <strong>{draft.title}</strong>
                    <span className="tag">{draft.status}</span>
                  </div>
                  <span className="muted">
                    {draft.platform} · {draft.objective}
                  </span>
                  <span>Budget: {draft.budget}</span>
                  <span>Inicio previsto: {new Date(draft.scheduledStart).toLocaleString("pt-BR")}</span>
                  <p style={{ margin: 0, lineHeight: 1.6 }}>
                    Publico: {draft.audience}. Angulo: {draft.creativeAngle}. CTA: {draft.callToAction}.
                  </p>
                  {draft.headline ? <span className="muted">Headline: {draft.headline}</span> : null}
                  {draft.description ? <span className="muted">Descricao: {draft.description}</span> : null}
                  {draft.landingUrl ? (
                    <a href={draft.landingUrl} target="_blank" rel="noreferrer" className="tag" style={{ width: "fit-content" }}>
                      Abrir destino
                    </a>
                  ) : null}
                  {draft.assetUrl ? (
                    <a href={draft.assetUrl} target="_blank" rel="noreferrer" className="tag" style={{ width: "fit-content" }}>
                      Abrir asset
                    </a>
                  ) : null}
                  {draft.keywordThemes && draft.keywordThemes.length > 0 ? (
                    <span className="tag" style={{ width: "fit-content" }}>
                      Keywords: {draft.keywordThemes.join(", ")}
                    </span>
                  ) : null}
                  {draft.status === "approved" ? (
                    <span className="tag" style={{ width: "fit-content" }}>
                      Aprovado e pronto para runtime auditavel
                    </span>
                  ) : null}
                  {draft.sourceAssetId ? (
                    <span className="tag" style={{ width: "fit-content" }}>
                      Ativo do Studio conectado ao Ads Ops
                    </span>
                  ) : null}
                  {draft.sourceExperimentId ? (
                    <span className="tag" style={{ width: "fit-content" }}>
                      Experimento: {draft.sourceExperimentId}
                    </span>
                  ) : null}
                  {draft.variantLabel ? (
                    <span className="tag" style={{ width: "fit-content" }}>
                      Variante: {draft.variantLabel}
                    </span>
                  ) : null}
                  {draft.launchState ? (
                    <span className="tag" style={{ width: "fit-content" }}>
                      Runtime vinculada: {draft.launchState.platform}
                    </span>
                  ) : null}
                  {session ? (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {draft.status === "pending_approval" ? <ActionButton companySlug={workspace.company.slug} itemId={draft.id} intent="approve" label="Aprovar anuncio" /> : null}
                      {draft.status === "approved" ? <ActionButton companySlug={workspace.company.slug} itemId={draft.id} intent="queue-runtime" label="Enviar para runtime" /> : null}
                      {draft.status !== "launched" && draft.status !== "rejected" ? <ActionButton companySlug={workspace.company.slug} itemId={draft.id} intent="reject" label="Rejeitar" /> : null}
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

function TextAreaField({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
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

function ActionButton({
  companySlug,
  itemId,
  intent,
  label
}: {
  companySlug: string;
  itemId: string;
  intent: string;
  label: string;
}) {
  return (
    <form action={`/api/companies/${companySlug}/social/${itemId}`} method="post">
      <input type="hidden" name="intent" value={intent} />
      <button type="submit" className="tag" style={{ border: "none", cursor: "pointer" }}>
        {label}
      </button>
    </form>
  );
}

const queueStyle = {
  padding: 18,
  borderRadius: 18,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(148, 196, 208, 0.1)",
  display: "grid",
  gap: 10
} satisfies CSSProperties;

function buildPostMessage(value: string) {
  switch (value) {
    case "from-studio":
      return "Post aprovado no Studio entrou direto como agendado";
    case "studio-asset":
      return "Asset do Studio virou item operacional no Social Ops";
    case "already-linked":
      return "Esse pedido ja esta vinculado a um post no Social Ops";
    default:
      return "Post programado criado";
  }
}

function buildAdMessage(value: string) {
  switch (value) {
    case "studio-asset":
      return "Asset do Studio virou draft operacional de anuncio";
    case "already-linked":
      return "Esse asset ja esta vinculado a um anuncio no Social Ops";
    default:
      return "Draft de anuncio criado";
  }
}

function buildNextDayInputValue(seedIso: string) {
  const date = new Date(seedIso);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 16);
}

function buildPlatformConnectHref(companySlug: string, platform: SocialPlatformId) {
  if (platform === "google-ads") {
    return `/api/auth/google/connect/start?companyId=${companySlug}&platform=google-ads`;
  }

  if (platform === "google-business") {
    return `/api/auth/google/connect/start?companyId=${companySlug}&platform=business-profile`;
  }

  if (platform === "youtube") {
    return `/api/auth/google/connect/start?companyId=${companySlug}&platform=youtube`;
  }

  return `/api/auth/social/connect/start?companyId=${companySlug}&platform=${platform}`;
}

const POST_PLATFORM_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "google-business", label: "Google Business Profile" }
];

const POST_FORMAT_OPTIONS = [
  { value: "image", label: "Imagem unica" },
  { value: "carousel", label: "Carousel / multiplas imagens" },
  { value: "video", label: "Video" },
  { value: "story", label: "Story (Instagram)" },
  { value: "reel", label: "Reel" },
  { value: "short", label: "Short / video curto" }
];
