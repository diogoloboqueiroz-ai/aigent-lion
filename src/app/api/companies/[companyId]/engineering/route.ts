import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCompanyWorkspace } from "@/lib/connectors";
import {
  upsertStoredCompanyCodeWorkspace,
  upsertStoredCompanySiteOpsProfile,
  upsertStoredTechnicalRequest
} from "@/lib/company-vault";
import { buildTechnicalRequest, getCompanyEngineeringWorkspaces, getCompanyTechnicalRequests } from "@/lib/engineering";
import { connectWordPressSite, publishLandingPageToWordPress } from "@/lib/site-cms";
import { getCompanyTrackingCredentials, saveCompanyTrackingCredentials } from "@/lib/conversion-runtime";
import { getCompanySiteOpsProfile, parseSiteOpsProfileForm } from "@/lib/site-ops";
import type { CodeWorkspaceAccess, CodeWorkspaceStatus, TechnicalRequest, TechnicalRequestPriority } from "@/lib/domain";
import { getSessionFromCookies } from "@/lib/session";
import { getUserProfessionalProfile } from "@/lib/user-profiles";

export async function GET(
  _request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  const workspace = getCompanyWorkspace(companyId);

  if (!workspace) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
  }

  return NextResponse.json(
    {
      siteOpsProfile: getCompanySiteOpsProfile(workspace.company),
      trackingCredentials: getCompanyTrackingCredentials(workspace.company.slug),
      engineeringWorkspaces: getCompanyEngineeringWorkspaces(workspace.company),
      technicalRequests: getCompanyTechnicalRequests(workspace.company.slug),
      conversionEvents: workspace.conversionEvents
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
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
  const intent = String(formData.get("intent") ?? "save-workspace");
  const siteOpsProfile = getCompanySiteOpsProfile(workspace.company);

  if (intent === "save-site-ops") {
    upsertStoredCompanySiteOpsProfile(parseSiteOpsProfileForm(formData, siteOpsProfile));

    return NextResponse.redirect(new URL(`/empresas/${companyId}/engenharia?siteSaved=1`, request.url), {
      status: 303
    });
  }

  if (intent === "save-tracking-secrets") {
    saveCompanyTrackingCredentials({
      companySlug: workspace.company.slug,
      current: getCompanyTrackingCredentials(workspace.company.slug),
      ga4ApiSecret: String(formData.get("ga4ApiSecret") ?? ""),
      metaAccessToken: String(formData.get("metaAccessToken") ?? "")
    });

    return NextResponse.redirect(new URL(`/empresas/${companyId}/engenharia?trackingSaved=1`, request.url), {
      status: 303
    });
  }

  if (intent === "connect-wordpress") {
    try {
      await connectWordPressSite({
        companySlug: workspace.company.slug,
        profile: siteOpsProfile,
        siteUrl: String(formData.get("cmsSiteUrl") ?? siteOpsProfile.cmsSiteUrl),
        username: String(formData.get("cmsUsername") ?? ""),
        appPassword: String(formData.get("cmsAppPassword") ?? "")
      });

      return NextResponse.redirect(new URL(`/empresas/${companyId}/engenharia?cmsSaved=1`, request.url), {
        status: 303
      });
    } catch (error) {
      upsertStoredCompanySiteOpsProfile({
        ...siteOpsProfile,
        cmsProvider: "wordpress",
        cmsConnectionStatus: "action_required",
        cmsSiteUrl: String(formData.get("cmsSiteUrl") ?? siteOpsProfile.cmsSiteUrl),
        cmsUsername: String(formData.get("cmsUsername") ?? siteOpsProfile.cmsUsername),
        cmsLastSyncAt: new Date().toISOString(),
        cmsLastSyncSummary: error instanceof Error ? error.message : "Falha ao conectar WordPress.",
        updatedAt: new Date().toISOString()
      });

      return NextResponse.redirect(
        new URL(`/empresas/${companyId}/engenharia?cmsError=${encodeURIComponent("Falha ao conectar WordPress")}`, request.url),
        { status: 303 }
      );
    }
  }

  if (intent === "publish-wordpress-landing") {
    try {
      const title = String(formData.get("landingTitle") ?? "Landing Agent Lion").trim();
      const result = await publishLandingPageToWordPress({
        companySlug: workspace.company.slug,
        profile: siteOpsProfile,
        title,
        slug: slugify(String(formData.get("landingSlug") ?? title)),
        summary: String(formData.get("landingSummary") ?? "").trim(),
        bulletPoints: splitLines(String(formData.get("landingBullets") ?? "")),
        ctaLabel: String(formData.get("landingCtaLabel") ?? "Falar com a equipe").trim() || "Falar com a equipe",
        ctaUrl: String(formData.get("landingCtaUrl") ?? (siteOpsProfile.primarySiteUrl || "https://seu-site.com")).trim(),
        status: String(formData.get("landingStatus") ?? "draft") as "draft" | "publish" | "pending" | "private"
      });

      return NextResponse.redirect(
        new URL(
          `/empresas/${companyId}/engenharia?landingPublished=${encodeURIComponent(result.pageUrl ?? title)}`,
          request.url
        ),
        { status: 303 }
      );
    } catch (error) {
      upsertStoredCompanySiteOpsProfile({
        ...siteOpsProfile,
        cmsConnectionStatus: "action_required",
        cmsLastSyncAt: new Date().toISOString(),
        cmsLastSyncSummary: error instanceof Error ? error.message : "Falha ao publicar landing no WordPress.",
        updatedAt: new Date().toISOString()
      });

      return NextResponse.redirect(
        new URL(
          `/empresas/${companyId}/engenharia?landingError=${encodeURIComponent("Falha ao publicar landing")}`,
          request.url
        ),
        { status: 303 }
      );
    }
  }

  if (intent === "create-request") {
    upsertStoredTechnicalRequest(
      buildTechnicalRequest({
        company: workspace.company,
        title: String(formData.get("title") ?? "Problema tecnico"),
        area: String(formData.get("area") ?? "bug") as TechnicalRequest["area"],
        priority: String(formData.get("priority") ?? "medium") as TechnicalRequestPriority,
        summary: String(formData.get("summary") ?? ""),
        expectedOutcome: String(formData.get("expectedOutcome") ?? "")
      })
    );

    return NextResponse.redirect(new URL(`/empresas/${companyId}/engenharia?requested=1`, request.url), {
      status: 303
    });
  }

  const workspaceId = String(formData.get("workspaceId") ?? "");
  const currentWorkspace = getCompanyEngineeringWorkspaces(workspace.company).find(
    (entry) => entry.id === workspaceId
  );

  if (!currentWorkspace) {
    return NextResponse.json({ error: "Workspace tecnico nao encontrado" }, { status: 404 });
  }

  upsertStoredCompanyCodeWorkspace({
    ...currentWorkspace,
    path: String(formData.get("path") ?? currentWorkspace.path),
    stack: String(formData.get("stack") ?? currentWorkspace.stack),
    objective: String(formData.get("objective") ?? currentWorkspace.objective),
    status: String(formData.get("status") ?? currentWorkspace.status) as CodeWorkspaceStatus,
    access: String(formData.get("access") ?? currentWorkspace.access) as CodeWorkspaceAccess,
    notes: String(formData.get("notes") ?? currentWorkspace.notes)
  });

  return NextResponse.redirect(new URL(`/empresas/${companyId}/engenharia?saved=1`, request.url), {
    status: 303
  });
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "landing-agent-lion";
}
