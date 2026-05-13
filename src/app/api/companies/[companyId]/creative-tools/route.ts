import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  companyRouteJson,
  requireCompanyRouteAccess,
  requireResolvedCompanyRoutePermission
} from "@/lib/api/company-route-auth";
import {
  buildCreativeAssetFromPublishingDraft,
  buildGeneratedCreativeAsset,
  buildPublishingApprovalRequest,
  getCompanyCreativeAssets,
  getCompanyCreativeTools,
  getCompanyPublishingRequests
} from "@/lib/creative-tools";
import { getCompanyWorkspace } from "@/lib/connectors";
import {
  upsertStoredCompanyCreativeAsset,
  upsertStoredCreativeToolConnection,
  upsertStoredPublishingApprovalRequest
} from "@/lib/company-vault";
import type {
  CreativeAutomationMode,
  CreativeToolProvider,
  CreativeToolStatus,
  PublishingApprovalRequest
} from "@/lib/domain";
import { recordCompanyAuditEvent } from "@/lib/governance";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

export async function GET(
  _request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  const access = await requireCompanyRouteAccess({
    companyId,
    permission: "execution:generate"
  });

  if (!access.ok) {
    return access.response;
  }

  return companyRouteJson(
    {
      tools: getCompanyCreativeTools(access.workspace.company),
      creativeAssets: getCompanyCreativeAssets(access.workspace.company.slug),
      publishingRequests: getCompanyPublishingRequests(access.workspace.company.slug)
    }
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);

  if (!session) {
    return NextResponse.redirect(new URL("/?auth=login-required", request.url), { status: 303 });
  }

  const professionalProfile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(companyId, professionalProfile);

  if (!workspace) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "save-tool");
  const forbidden = requireResolvedCompanyRoutePermission({
    workspace,
    profile: professionalProfile,
    session,
    permission: intent === "request-publish" ? "governance:review" : "execution:generate"
  });

  if (forbidden) {
    return forbidden;
  }

  if (intent === "generate-creative") {
    const assetType = String(formData.get("assetType") ?? "post") as PublishingApprovalRequest["assetType"];
    const createdWith = String(formData.get("createdWith") ?? "openai-api") as CreativeToolProvider;
    const platformHint = String(formData.get("platformHint") ?? "").trim();
    const asset = buildGeneratedCreativeAsset({
      company: workspace.company,
      title: String(formData.get("title") ?? "Novo draft gerado pelo Agent Lion"),
      assetType,
      destination: String(formData.get("destination") ?? "Studio"),
      createdWith,
      requestedBy: session.email,
      summary: String(formData.get("summary") ?? "Draft criativo gerado internamente pelo Studio."),
      generationPrompt: String(formData.get("generationPrompt") ?? "").trim() || "Criar uma variacao criativa alinhada a conversao e marca.",
      platformHint: (platformHint || undefined) as PublishingApprovalRequest["platformHint"],
      scheduledFor: String(formData.get("scheduledFor") ?? "").trim() || undefined,
      sourceExperimentId: String(formData.get("sourceExperimentId") ?? "").trim() || undefined,
      variantLabel: String(formData.get("variantLabel") ?? "").trim() || undefined
    });

    upsertStoredCompanyCreativeAsset(asset);
    recordCompanyAuditEvent({
      companySlug: workspace.company.slug,
      connector: "system",
      kind: "decision",
      title: "Studio gerou draft nativo",
      details: `O Agent Lion abriu o draft ${asset.title} com prompt salvo e QA inicial por ${session.email}.`
    });

    return NextResponse.redirect(new URL(`/empresas/${companyId}/studio?generated=1`, request.url), {
      status: 303
    });
  }

  if (intent === "request-publish") {
    const assetType = String(formData.get("assetType") ?? "post") as PublishingApprovalRequest["assetType"];
    const createdWith = String(formData.get("createdWith") ?? "canva") as CreativeToolProvider;
    const platformHint = String(formData.get("platformHint") ?? "").trim();
    const asset = buildCreativeAssetFromPublishingDraft({
      company: workspace.company,
      title: String(formData.get("title") ?? "Postagem pronta para aprovacao"),
      assetType,
      destination: String(formData.get("destination") ?? "Instagram"),
      platformHint: (platformHint || undefined) as PublishingApprovalRequest["platformHint"],
      createdWith,
      summary: String(formData.get("summary") ?? ""),
      caption: String(formData.get("caption") ?? "").trim() || undefined,
      assetUrl: String(formData.get("assetUrl") ?? "").trim() || undefined,
      assetUrls: parseTextareaList(formData.get("assetUrls")),
      landingUrl: String(formData.get("landingUrl") ?? "").trim() || undefined,
      scheduledFor: String(formData.get("scheduledFor") ?? "").trim() || undefined,
      requestedBy: session.email
    });
    upsertStoredCompanyCreativeAsset(asset);

    upsertStoredPublishingApprovalRequest(
      buildPublishingApprovalRequest({
        company: workspace.company,
        sourceAssetId: asset.id,
        sourceAssetVersionId: asset.latestVersionId,
        title: asset.title,
        assetType,
        destination: asset.destination,
        platformHint: asset.platformHint,
        createdWith,
        summary: asset.summary,
        caption: asset.versions[0]?.caption,
        assetUrl: asset.versions[0]?.assetUrl,
        assetUrls: asset.versions[0]?.assetUrls,
        landingUrl: asset.versions[0]?.landingUrl,
        scheduledFor: asset.versions[0]?.scheduledFor,
        requestedBy: session.email
      })
    );
    recordCompanyAuditEvent({
      companySlug: workspace.company.slug,
      connector: "system",
      kind: "decision",
      title: "Studio criou ativo e abriu aprovacao",
      details: `O ativo ${asset.title} foi salvo no Studio com QA inicial e enviado para a fila de aprovacao por ${session.email}.`,
      priority: asset.versions[0]?.qaChecks.some((check) => check.status === "blocked") ? "high" : "medium"
    });

    return NextResponse.redirect(new URL(`/empresas/${companyId}/studio?requested=1`, request.url), {
      status: 303
    });
  }

  const provider = String(formData.get("provider") ?? "") as CreativeToolProvider;
  const currentTool = getCompanyCreativeTools(workspace.company).find((tool) => tool.provider === provider);

  if (!currentTool) {
    return NextResponse.json({ error: "Ferramenta nao encontrada" }, { status: 404 });
  }

  upsertStoredCreativeToolConnection({
    ...currentTool,
    status: String(formData.get("status") ?? currentTool.status) as CreativeToolStatus,
    automationMode: String(formData.get("automationMode") ?? currentTool.automationMode) as CreativeAutomationMode,
    accountLabel: String(formData.get("accountLabel") ?? currentTool.accountLabel),
    notes: String(formData.get("notes") ?? currentTool.notes),
    lastValidatedAt: new Date().toISOString()
  });
  recordCompanyAuditEvent({
    companySlug: workspace.company.slug,
    connector: "system",
    kind: "info",
    title: "Ferramenta criativa atualizada",
    details: `${currentTool.label} foi ajustada no Studio por ${session.email}.`
  });

  return NextResponse.redirect(new URL(`/empresas/${companyId}/studio?saved=1`, request.url), {
    status: 303
  });
}

function parseTextareaList(value: FormDataEntryValue | null) {
  const items = String(value ?? "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return items.length > 0 ? items : undefined;
}
