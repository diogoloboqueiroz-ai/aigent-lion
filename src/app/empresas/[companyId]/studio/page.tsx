import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getCompanyWorkspace } from "@/lib/connectors";
import { getCreativeToolLabel } from "@/lib/creative-tools";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

type PageProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ saved?: string; requested?: string; generated?: string; decision?: string }>;
};

export default async function CompanyStudioPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);
  const professionalProfile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(companyId, professionalProfile);

  if (!workspace) {
    notFound();
  }

  const suggestedStudioSchedule = buildNextDayInputValue(workspace.socialProfile.updatedAt);

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
          <p className="eyebrow">Estudio Criativo</p>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 1.6rem + 1.5vw, 3.3rem)" }}>
            {workspace.company.name}
          </h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7, maxWidth: 960 }}>
            Aqui o agente pode usar ferramentas criativas e apps assinados para criar copys, layouts, imagens, videos e exports com autonomia. A regra fixa e esta: criar pode ser automatico, postar/publicar exige sua aprovacao.
          </p>
          {query.saved ? <div className="tag" style={{ width: "fit-content" }}>Ferramenta criativa atualizada</div> : null}
          {query.generated ? <div className="tag" style={{ width: "fit-content" }}>Draft criativo gerado no Studio</div> : null}
          {query.requested ? <div className="tag" style={{ width: "fit-content" }}>Pedido de publicacao criado</div> : null}
          {query.decision ? <div className="tag" style={{ width: "fit-content" }}>Decisao registrada: {query.decision}</div> : null}
        </section>

        <section style={{ display: "grid", gap: 20, gridTemplateColumns: "1.05fr 0.95fr" }}>
          <article className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}>
            <h2 className="section-title">Regra operacional</h2>
            <p style={{ margin: 0, lineHeight: 1.65 }}>
              O agente pode gerar drafts, exports, thumbnails, roteiros e artes sozinho.
            </p>
            <p style={{ margin: 0, lineHeight: 1.65 }}>
              Qualquer postagem, upload final, publicacao social ou disparo publico entra obrigatoriamente na fila de aprovacao.
            </p>
            <div className="grid-auto" style={{ gap: 12 }}>
              <InfoCard
                label="Ferramentas catalogadas"
                value={String(workspace.creativeTools.length)}
              />
              <InfoCard
                label="Posts pendentes"
                value={String(workspace.publishingRequests.filter((request) => request.status === "pending").length)}
              />
              <InfoCard
                label="Assets no Studio"
                value={String(workspace.creativeAssets.length)}
              />
              <InfoCard
                label="Perfil profissional"
                value={professionalProfile?.trainingStatus ?? "sem login"}
              />
            </div>
          </article>

          <form
            action={`/api/companies/${workspace.company.slug}/creative-tools`}
            method="post"
            className="glass"
            style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}
          >
            <input type="hidden" name="intent" value="generate-creative" />
            <h2 className="section-title">Gerar draft nativo</h2>
            <Field label="Titulo do draft" name="title" defaultValue="Novo draft gerado pelo Agent Lion" />
            <label style={{ display: "grid", gap: 8 }}>
              <span>Tipo de ativo</span>
              <select name="assetType" defaultValue="post" style={selectStyle}>
                <option value="post">Post</option>
                <option value="image">Imagem</option>
                <option value="video">Video</option>
                <option value="carousel">Carousel</option>
                <option value="email">Email</option>
                <option value="landing">Landing</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 8 }}>
              <span>Ferramenta motora</span>
              <select
                name="createdWith"
                defaultValue="openai-api"
                style={selectStyle}
              >
                {workspace.creativeTools.map((tool) => (
                  <option key={tool.provider} value={tool.provider}>
                    {getCreativeToolLabel(tool.provider)}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Destino" name="destination" defaultValue="Studio / backlog criativo" />
            <Field label="Agendar para" name="scheduledFor" defaultValue={suggestedStudioSchedule} />
            <label style={{ display: "grid", gap: 8 }}>
              <span>Plataforma sugerida</span>
              <select name="platformHint" defaultValue="instagram" style={selectStyle}>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="linkedin">LinkedIn</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="google-business">Google Business</option>
                <option value="">Sem plataforma fixa</option>
              </select>
            </label>
            <TextAreaField
              label="Resumo"
              name="summary"
              defaultValue="Draft criativo guiado por uma hipotese de conversao, pronto para virar asset ou experimento."
            />
            <TextAreaField
              label="Prompt de geracao"
              name="generationPrompt"
              defaultValue="Crie uma variacao criativa com promessa clara, prova de valor, CTA direto e alinhamento ao tom da marca."
            />
            <Field label="Rotulo da variante (opcional)" name="variantLabel" defaultValue="" />
            <button
              type="submit"
              className="tag"
              style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
              disabled={!session}
            >
              Gerar draft no Studio
            </button>
          </form>
        </section>

        <section style={{ display: "grid", gap: 20, gridTemplateColumns: "1.05fr 0.95fr" }}>
          <form
            action={`/api/companies/${workspace.company.slug}/creative-tools`}
            method="post"
            className="glass"
            style={{ padding: 22, borderRadius: 22, display: "grid", gap: 14 }}
          >
            <input type="hidden" name="intent" value="request-publish" />
            <h2 className="section-title">Solicitar aprovacao de postagem</h2>
            <Field label="Titulo do material" name="title" defaultValue="Novo criativo para aprovacao" />
            <label style={{ display: "grid", gap: 8 }}>
              <span>Tipo de ativo</span>
              <select
                name="assetType"
                defaultValue="post"
                style={selectStyle}
              >
                <option value="post">Post</option>
                <option value="image">Imagem</option>
                <option value="video">Video</option>
                <option value="carousel">Carousel</option>
                <option value="email">Email</option>
                <option value="landing">Landing</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 8 }}>
              <span>Plataforma social sugerida</span>
              <select
                name="platformHint"
                defaultValue="instagram"
                style={selectStyle}
              >
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="linkedin">LinkedIn</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="google-business">Google Business</option>
              </select>
            </label>
            <Field label="Destino" name="destination" defaultValue="Instagram / Facebook" />
            <Field label="Agendar para" name="scheduledFor" defaultValue={suggestedStudioSchedule} />
            <label style={{ display: "grid", gap: 8 }}>
              <span>Ferramenta usada</span>
              <select
                name="createdWith"
                defaultValue={workspace.creativeTools[0]?.provider ?? "canva"}
                style={selectStyle}
              >
                {workspace.creativeTools.map((tool) => (
                  <option key={tool.provider} value={tool.provider}>
                    {getCreativeToolLabel(tool.provider)}
                  </option>
                ))}
              </select>
            </label>
            <TextAreaField
              label="Resumo do que sera publicado"
              name="summary"
              defaultValue="Descreva o criativo, CTA, publico e objetivo antes de pedir a liberacao."
            />
            <TextAreaField
              label="Legenda / caption final"
              name="caption"
              defaultValue="Legenda aprovada para a plataforma, com CTA e hashtags quando fizer sentido."
            />
            <Field label="URL publica do asset" name="assetUrl" defaultValue="https://..." />
            <TextAreaField
              label="Multiplos assets (um por linha)"
              name="assetUrls"
              defaultValue={"https://cdn.exemplo.com/card-1.jpg\nhttps://cdn.exemplo.com/card-2.jpg"}
            />
            <Field label="URL de destino / landing" name="landingUrl" defaultValue="https://..." />
            <button
              type="submit"
              className="tag"
              style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
              disabled={!session}
            >
              Enviar para aprovacao
            </button>
          </form>
        </section>

        <section className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <h2 className="section-title">Biblioteca de assets</h2>
            <span className="tag">{workspace.creativeAssets.length} ativos</span>
          </div>
          {workspace.creativeAssets.length === 0 ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
              O Studio ainda nao recebeu assets versionados. O proximo pedido de publicacao ja entra aqui com QA inicial e historico de versoes.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {workspace.creativeAssets.map((asset) => {
                const latestVersion = asset.versions.find((version) => version.id === asset.latestVersionId) ?? asset.versions[0];
                const blockedChecks = latestVersion?.qaChecks.filter((check) => check.status === "blocked").length ?? 0;
                const warningChecks = latestVersion?.qaChecks.filter((check) => check.status === "warning").length ?? 0;
                const canCreatePost = asset.assetType !== "email" && asset.assetType !== "landing";
                const canCreateAd =
                  asset.assetType === "image" ||
                  asset.assetType === "video" ||
                  asset.assetType === "carousel" ||
                  asset.assetType === "post";
                const approvalReusable = latestVersion?.status === "approved" || latestVersion?.status === "published";

                return (
                  <article
                    key={asset.id}
                    style={{
                      padding: 18,
                      borderRadius: 18,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(148, 196, 208, 0.1)",
                      display: "grid",
                      gap: 12
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <strong>{asset.title}</strong>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span className="tag">{asset.assetType}</span>
                        {asset.origin ? <span className="tag">{asset.origin}</span> : null}
                        {asset.platformHint ? <span className="tag">{asset.platformHint}</span> : null}
                        {latestVersion ? <span className="tag">{latestVersion.status}</span> : null}
                      </div>
                    </div>
                    <span className="muted">
                      {asset.destination} Â· {getCreativeToolLabel(asset.createdWith)} Â· {asset.versions.length} versao(oes)
                    </span>
                    {asset.sourceExperimentId ? (
                      <span className="muted">Experimento fonte: {asset.sourceExperimentId}</span>
                    ) : null}
                    <p style={{ margin: 0, lineHeight: 1.65 }}>{asset.summary}</p>
                    <div className="grid-auto" style={{ gap: 12 }}>
                      <InfoCard label="QA bloqueios" value={String(blockedChecks)} />
                      <InfoCard label="QA alertas" value={String(warningChecks)} />
                      <InfoCard
                        label="Ultima atualizacao"
                        value={new Date(asset.updatedAt).toLocaleDateString("pt-BR")}
                      />
                    </div>
                    {approvalReusable ? (
                      <span className="tag" style={{ width: "fit-content" }}>
                        Aprovacao do Studio pronta para reaproveitar no Social Ops
                      </span>
                    ) : null}
                    {session && (canCreatePost || canCreateAd) ? (
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {canCreatePost ? (
                          <form action={`/api/companies/${workspace.company.slug}/social`} method="post">
                            <input type="hidden" name="intent" value="create-post-from-asset" />
                            <input type="hidden" name="assetId" value={asset.id} />
                            <button
                              type="submit"
                              className="tag"
                              style={{ width: "fit-content", border: "none", cursor: "pointer" }}
                            >
                              {approvalReusable ? "Criar post pronto" : "Criar draft social"}
                            </button>
                          </form>
                        ) : null}
                        {canCreateAd ? (
                          <form action={`/api/companies/${workspace.company.slug}/social`} method="post">
                            <input type="hidden" name="intent" value="create-ad-from-asset" />
                            <input type="hidden" name="assetId" value={asset.id} />
                            <button
                              type="submit"
                              className="tag"
                              style={{ width: "fit-content", border: "none", cursor: "pointer" }}
                            >
                              {approvalReusable ? "Criar anuncio pronto" : "Criar draft de anuncio"}
                            </button>
                          </form>
                        ) : null}
                      </div>
                    ) : null}
                    {latestVersion?.qaChecks.length ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        {latestVersion.generationPrompt ? (
                          <div
                            style={{
                              padding: 12,
                              borderRadius: 14,
                              background: "rgba(255,255,255,0.03)",
                              border: "1px solid rgba(148, 196, 208, 0.1)",
                              display: "grid",
                              gap: 4
                            }}
                          >
                            <strong>Prompt salvo</strong>
                            {latestVersion.variantLabel ? <span className="tag" style={{ width: "fit-content" }}>{latestVersion.variantLabel}</span> : null}
                            <span className="muted">{latestVersion.generationPrompt}</span>
                          </div>
                        ) : null}
                        <strong>Checklist de QA</strong>
                        <div style={{ display: "grid", gap: 8 }}>
                          {latestVersion.qaChecks.map((check) => (
                            <div
                              key={check.id}
                              style={{
                                padding: 12,
                                borderRadius: 14,
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(148, 196, 208, 0.1)",
                                display: "grid",
                                gap: 4
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                                <strong>{check.label}</strong>
                                <span className="tag">{check.status}</span>
                              </div>
                              <span className="muted">{check.detail}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 18 }}>
          <h2 className="section-title">Ferramentas criativas e apps</h2>
          <div style={{ display: "grid", gap: 14 }}>
            {workspace.creativeTools.map((tool) => (
              <form
                key={tool.id}
                action={`/api/companies/${workspace.company.slug}/creative-tools`}
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
                <input type="hidden" name="intent" value="save-tool" />
                <input type="hidden" name="provider" value={tool.provider} />
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
                  <strong>{tool.label}</strong>
                  <span className="tag">{tool.status}</span>
                </div>
                <div className="grid-auto" style={{ gap: 12 }}>
                  <InfoCard label="Acesso" value={tool.accessMethod} />
                  <InfoCard label="Autonomia" value={tool.automationMode} />
                </div>
                <label style={{ display: "grid", gap: 8 }}>
                  <span>Status</span>
                  <select name="status" defaultValue={tool.status} style={selectStyle}>
                    <option value="connected">connected</option>
                    <option value="action_required">action_required</option>
                    <option value="planned">planned</option>
                  </select>
                </label>
                <label style={{ display: "grid", gap: 8 }}>
                  <span>Modo de autonomia</span>
                  <select name="automationMode" defaultValue={tool.automationMode} style={selectStyle}>
                    <option value="create_autonomously">create_autonomously</option>
                    <option value="publish_requires_approval">publish_requires_approval</option>
                    <option value="manual_only">manual_only</option>
                  </select>
                </label>
                <Field label="Conta ou workspace" name="accountLabel" defaultValue={tool.accountLabel} />
                <div style={{ display: "grid", gap: 8 }}>
                  <strong>Capacidades</strong>
                  <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                    {tool.capabilities.map((capability) => (
                      <li key={capability}>{capability}</li>
                    ))}
                  </ul>
                </div>
                <TextAreaField label="Notas operacionais" name="notes" defaultValue={tool.notes} />
                <button
                  type="submit"
                  className="tag"
                  style={{ width: "fit-content", border: "none", cursor: session ? "pointer" : "not-allowed", opacity: session ? 1 : 0.6 }}
                  disabled={!session}
                >
                  Salvar ferramenta
                </button>
              </form>
            ))}
          </div>
        </section>

        <section className="glass" style={{ padding: 22, borderRadius: 22, display: "grid", gap: 18 }}>
          <h2 className="section-title">Fila de aprovacao de publicacoes</h2>
          {workspace.publishingRequests.length === 0 ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
              Nenhuma publicacao aguardando aprovacao ainda.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {workspace.publishingRequests.map((request) => (
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
                    {request.assetType} Â· {request.destination} Â· {getCreativeToolLabel(request.createdWith)}
                  </span>
                  <p style={{ margin: 0, lineHeight: 1.65 }}>{request.summary}</p>
                  {request.caption ? <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>Caption: {request.caption}</p> : null}
                  {request.assetUrl ? (
                    <a href={request.assetUrl} target="_blank" rel="noreferrer" className="tag" style={{ width: "fit-content" }}>
                      Abrir asset
                    </a>
                  ) : null}
                  {request.assetUrls && request.assetUrls.length > 1 ? (
                    <span className="tag" style={{ width: "fit-content" }}>
                      {request.assetUrls.length} assets prontos
                    </span>
                  ) : null}
                  {request.status === "pending" && session ? (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <ApprovalButton companySlug={workspace.company.slug} requestId={request.id} intent="approve" label="Aprovar" />
                      <ApprovalButton companySlug={workspace.company.slug} requestId={request.id} intent="reject" label="Rejeitar" />
                    </div>
                  ) : null}
                  {request.status === "approved" && session ? (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <ApprovalButton companySlug={workspace.company.slug} requestId={request.id} intent="create-social-post" label="Enviar para Social Ops" />
                      <ApprovalButton companySlug={workspace.company.slug} requestId={request.id} intent="mark-posted" label="Marcar como publicada" />
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

function ApprovalButton({
  companySlug,
  requestId,
  intent,
  label
}: {
  companySlug: string;
  requestId: string;
  intent: string;
  label: string;
}) {
  return (
    <form action={`/api/companies/${companySlug}/creative-tools/${requestId}`} method="post">
      <input type="hidden" name="intent" value={intent} />
      <button type="submit" className="tag" style={{ border: "none", cursor: "pointer" }}>
        {label}
      </button>
    </form>
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

function buildNextDayInputValue(seedIso: string) {
  const date = new Date(seedIso);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 16);
}
