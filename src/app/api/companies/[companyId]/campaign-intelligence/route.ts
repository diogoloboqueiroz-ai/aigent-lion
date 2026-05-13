import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildCampaignActivationPlan } from "@/core/marketing/campaign-activation";
import {
  buildCampaignIntelligenceBrief,
  materializeCampaignIntelligenceBrief
} from "@/core/marketing/campaign-intelligence";
import { runCmoAgent } from "@/lib/agents/cmo-agent";
import { buildCompanyContext } from "@/lib/agents/memory-engine";
import {
  getStoredCampaignIntelligenceBriefs,
  upsertStoredScheduledSocialPost,
  upsertStoredSocialAdDraft,
  upsertStoredCampaignIntelligenceBrief
} from "@/lib/company-vault";
import { getCompanyWorkspace } from "@/lib/connectors";
import { recordCompanyAuditEvent } from "@/lib/governance";
import { requireCompanyPermission } from "@/lib/rbac";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";
import type { TriggerEvent } from "@/lib/agents/types";

export async function GET(
  request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  const session = getSessionFromCookies(await cookies());

  if (!session) {
    return jsonResponse({ error: "Sessao invalida" }, 401);
  }

  const professionalProfile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(companyId, professionalProfile);

  if (!workspace) {
    return jsonResponse({ error: "Empresa nao encontrada" }, 404);
  }

  const permissionCheck = requireCompanyPermission({
    companySlug: workspace.company.slug,
    profile: professionalProfile,
    permission: "agent:decide",
    actor: session.email
  });

  if (!permissionCheck.allowed) {
    return jsonResponse({ error: permissionCheck.message, auditId: permissionCheck.auditId }, 403);
  }

  const url = new URL(request.url);
  const trigger = buildCampaignPreviewTrigger(
    workspace.company.slug,
    session.email,
    url.searchParams.get("summary")
  );
  const companyContext = buildCompanyContext({
    workspace,
    trigger
  });
  const cmoDecision = runCmoAgent(companyContext);
  const brief = buildCampaignIntelligenceBrief({
    workspace,
    cmoDecision
  });
  const savedBriefs = getStoredCampaignIntelligenceBriefs(workspace.company.slug);

  return jsonResponse({
    brief,
    latestSavedBrief: savedBriefs[0] ?? null,
    savedBriefs
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  const session = getSessionFromCookies(await cookies());

  if (!session) {
    return jsonResponse({ error: "Sessao invalida" }, 401);
  }

  const professionalProfile = getUserProfessionalProfile(session);
  const workspace = getCompanyWorkspace(companyId, professionalProfile);

  if (!workspace) {
    return jsonResponse({ error: "Empresa nao encontrada" }, 404);
  }

  const postInput = await readPostInput(request);
  const intent = postInput.intent === "prepare-drafts" ? "prepare-drafts" : "materialize";
  const permissionCheck = requireCompanyPermission({
    companySlug: workspace.company.slug,
    profile: professionalProfile,
    permission: intent === "prepare-drafts" ? "execution:generate" : "agent:decide",
    actor: session.email
  });

  if (!permissionCheck.allowed) {
    return jsonResponse({ error: permissionCheck.message, auditId: permissionCheck.auditId }, 403);
  }

  const trigger = buildCampaignPreviewTrigger(
    workspace.company.slug,
    session.email,
    intent === "prepare-drafts"
      ? "Preparacao de drafts a partir do Campaign Intelligence Brief."
      : "Materializacao do Campaign Intelligence Brief."
  );
  const companyContext = buildCompanyContext({
    workspace,
    trigger
  });
  const cmoDecision = runCmoAgent(companyContext);
  const brief = buildCampaignIntelligenceBrief({
    workspace,
    cmoDecision
  });
  const savedBriefs = getStoredCampaignIntelligenceBriefs(workspace.company.slug);
  const record = materializeCampaignIntelligenceBrief({
    brief,
    actor: session.email,
    previousVersion: savedBriefs[0]?.version,
    source: postInput.isForm ? "workspace_page" : "api"
  });

  upsertStoredCampaignIntelligenceBrief(record);
  const audit = recordCompanyAuditEvent({
    companySlug: workspace.company.slug,
    connector: "system",
    kind: "decision",
    title: "Campaign Intelligence Brief materializado",
    details: `Brief ${record.id} v${record.version} salvo por ${session.email} com readiness ${record.readinessScore}/100 e ${record.channels.length} canais planejados.`
  });

  if (intent === "prepare-drafts") {
    const activationPlan = buildCampaignActivationPlan({
      workspace,
      brief: record,
      actor: session.email
    });

    for (const post of activationPlan.scheduledPosts) {
      upsertStoredScheduledSocialPost(post);
    }

    for (const draft of activationPlan.socialAdDrafts) {
      upsertStoredSocialAdDraft(draft);
    }

    const activationAudit = recordCompanyAuditEvent({
      companySlug: workspace.company.slug,
      connector: "system",
      kind: "decision",
      title: "Drafts de campanha preparados",
      details: `Campaign Activation ${activationPlan.id} preparou ${activationPlan.scheduledPosts.length} posts e ${activationPlan.socialAdDrafts.length} ads, todos pendentes de aprovacao.`
    });

    if (postInput.isForm) {
      return NextResponse.redirect(
        new URL(
          `/empresas/${workspace.company.slug}/campanhas?drafts=1&version=${record.version}&posts=${activationPlan.scheduledPosts.length}&ads=${activationPlan.socialAdDrafts.length}`,
          request.url
        ),
        { status: 303 }
      );
    }

    return jsonResponse({
      brief: record,
      activationPlan,
      auditIds: [audit.id, activationAudit.id]
    });
  }

  if (postInput.isForm) {
    return NextResponse.redirect(
      new URL(`/empresas/${workspace.company.slug}/campanhas?saved=1&version=${record.version}`, request.url),
      { status: 303 }
    );
  }

  return jsonResponse({
    brief: record,
    auditId: audit.id
  });
}

function jsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

async function readPostInput(request: Request) {
  if (!isFormRequest(request)) {
    const payload = await request.json().catch(() => null);
    return {
      isForm: false,
      intent: isRecord(payload) ? String(payload.intent ?? "materialize") : "materialize"
    };
  }

  const formData = await request.formData();
  return {
    isForm: true,
    intent: String(formData.get("intent") ?? "materialize")
  };
}

function isFormRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildCampaignPreviewTrigger(
  companySlug: string,
  actor: string,
  summary: string | null
): TriggerEvent {
  const createdAt = new Date().toISOString();

  return {
    id: `campaign-intelligence-${companySlug}-${Date.parse(createdAt)}`,
    companySlug,
    type: "api_preview",
    actor,
    summary: summary?.trim() || "Campaign intelligence preview.",
    createdAt
  };
}
