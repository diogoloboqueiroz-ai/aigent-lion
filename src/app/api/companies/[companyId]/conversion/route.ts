import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCompanyWorkspace } from "@/lib/connectors";
import {
  applyLeadCommercialAutopilot,
  connectHubSpotPrivateApp,
  getCompanyCrmProfile,
  parseCrmProfileForm,
  queueLeadForCrmIfNeeded,
  rotateCompanyCrmCaptureSecret,
  shouldPushLeadImmediately,
  syncCompanyLeadsToCrm,
  syncLeadToCrm
} from "@/lib/crm";
import {
  upsertStoredCompanyKeywordStrategy,
  upsertStoredCompanyCrmProfile,
  upsertStoredCompanyLead
} from "@/lib/company-vault";
import {
  buildCompanyLead,
  getLeadRouteBucketLabel,
  getLeadSyncStatusLabel,
  textareaToList,
  updateCompanyLead
} from "@/lib/conversion";
import { syncLeadConversionSignals } from "@/lib/conversion-runtime";
import { recordCompanyAuditEvent } from "@/lib/governance";
import { getSessionFromCookies } from "@/lib/session";

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
      conversion: workspace.keywordStrategy,
      crmProfile: workspace.crmProfile,
      leads: workspace.leads,
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
  const workspace = getCompanyWorkspace(companyId);
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);

  if (!session) {
    return NextResponse.redirect(new URL("/?auth=login-required", request.url), { status: 303 });
  }

  if (!workspace) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "save-strategy");
  const crmProfile = getCompanyCrmProfile(workspace.company);

  if (intent === "save-crm") {
    const nextProfile = parseCrmProfileForm(formData, crmProfile);
    const hubspotToken = String(formData.get("hubspotToken") ?? "").trim();

    upsertStoredCompanyCrmProfile(nextProfile);

    if (nextProfile.provider === "hubspot" && hubspotToken) {
      await connectHubSpotPrivateApp(workspace.company.slug, nextProfile, hubspotToken);
    }
    recordCompanyAuditEvent({
      companySlug: workspace.company.slug,
      connector: "system",
      kind: "decision",
      title: "Perfil de CRM atualizado",
      details: `O CRM da empresa foi ajustado para ${nextProfile.provider} em modo ${nextProfile.syncMode} por ${session.email}.`
    });

    return NextResponse.redirect(new URL(`/empresas/${companyId}/conversao?crmSaved=1`, request.url), {
      status: 303
    });
  }

  if (intent === "rotate-capture-key") {
    upsertStoredCompanyCrmProfile(rotateCompanyCrmCaptureSecret(crmProfile));
    recordCompanyAuditEvent({
      companySlug: workspace.company.slug,
      connector: "system",
      kind: "warning",
      title: "Chave de captura rotacionada",
      details: `A chave de captura publica do CRM foi rotacionada por ${session.email}.`
    });

    return NextResponse.redirect(new URL(`/empresas/${companyId}/conversao?captureKey=rotated`, request.url), {
      status: 303
    });
  }

  if (intent === "sync-crm") {
    const syncResult = await syncCompanyLeadsToCrm({
      company: workspace.company,
      profile: crmProfile,
      leads: workspace.leads
    });
    recordCompanyAuditEvent({
      companySlug: workspace.company.slug,
      connector: "system",
      kind: syncResult.failed > 0 ? "warning" : "info",
      title: "Sincronizacao de CRM executada",
      details: syncResult.summary,
      priority: syncResult.failed > 0 ? "high" : "low"
    });

    return NextResponse.redirect(
      new URL(`/empresas/${companyId}/conversao?crmSync=${encodeURIComponent(syncResult.summary)}`, request.url),
      { status: 303 }
    );
  }

  if (intent === "create-lead") {
    const lead = buildCompanyLead({
      company: workspace.company,
      fullName: String(formData.get("fullName") ?? "Lead sem nome"),
      email: String(formData.get("email") ?? "").trim() || undefined,
      phone: String(formData.get("phone") ?? "").trim() || undefined,
      source: String(formData.get("source") ?? "manual") as ReturnType<typeof buildCompanyLead>["source"],
      channel: String(formData.get("channel") ?? "Operacao manual"),
      campaignName: String(formData.get("campaignName") ?? "").trim() || undefined,
      owner: String(formData.get("owner") ?? crmProfile.defaultOwner ?? session.email),
      nextAction: String(formData.get("nextAction") ?? "Fazer primeiro contato"),
      nextFollowUpAt: String(formData.get("nextFollowUpAt") ?? "").trim() || undefined,
      revenuePotential: parseCurrencyField(formData.get("revenuePotential")),
      consentStatus: String(formData.get("consentStatus") ?? "unknown") as ReturnType<typeof buildCompanyLead>["consentStatus"],
      notes: textareaToList(formData.get("notes")),
      originPath: `/empresas/${companyId}/conversao`
    });

    const commercialLead = applyLeadCommercialAutopilot(crmProfile, lead);
    const persistedLead = queueLeadForCrmIfNeeded(commercialLead, crmProfile);
    upsertStoredCompanyLead(persistedLead);
    recordCompanyAuditEvent({
      companySlug: workspace.company.slug,
      connector: "system",
      kind: "info",
      title: "Lead criado no funil canonico",
      details: `${persistedLead.fullName} entrou na rota ${getLeadRouteBucketLabel(persistedLead.routeBucket)} com sync ${persistedLead.syncStatus}.`
    });

    if (shouldPushLeadImmediately(crmProfile)) {
      const syncedLead = await syncLeadToCrm(workspace.company, crmProfile, persistedLead);
      await syncLeadConversionSignals({
        company: workspace.company,
        lead: syncedLead,
        siteOpsProfile: workspace.siteOpsProfile
      });
      return NextResponse.redirect(
        new URL(
          `/empresas/${companyId}/conversao?lead=1&crmLeadStatus=${encodeURIComponent(getLeadSyncStatusLabel(syncedLead.syncStatus))}`,
          request.url
        ),
        { status: 303 }
      );
    }

    await syncLeadConversionSignals({
      company: workspace.company,
      lead: persistedLead,
      siteOpsProfile: workspace.siteOpsProfile
    });

    return NextResponse.redirect(
      new URL(
        `/empresas/${companyId}/conversao?lead=1&crmLeadStatus=${encodeURIComponent(getLeadSyncStatusLabel(persistedLead.syncStatus))}`,
        request.url
      ),
      { status: 303 }
    );
  }

  if (intent === "update-lead") {
    const leadId = String(formData.get("leadId") ?? "");
    const currentLead = workspace.leads.find((lead) => lead.id === leadId);

    if (!currentLead) {
      return NextResponse.json({ error: "Lead nao encontrado" }, { status: 404 });
    }

    const updatedLead = queueLeadForCrmIfNeeded(
      applyLeadCommercialAutopilot(
        crmProfile,
        updateCompanyLead(currentLead, {
          stage: String(formData.get("stage") ?? currentLead.stage) as typeof currentLead.stage,
          nextAction: String(formData.get("nextAction") ?? currentLead.nextAction),
          nextFollowUpAt: String(formData.get("nextFollowUpAt") ?? "").trim() || undefined,
          owner: String(formData.get("owner") ?? currentLead.owner),
          revenuePotential: parseCurrencyField(formData.get("revenuePotential")) ?? currentLead.revenuePotential,
          revenueActual: parseCurrencyField(formData.get("revenueActual")) ?? currentLead.revenueActual,
          opportunityValue: parseCurrencyField(formData.get("opportunityValue")) ?? currentLead.opportunityValue,
          lifetimeValue: parseCurrencyField(formData.get("lifetimeValue")) ?? currentLead.lifetimeValue,
          lostReason: String(formData.get("lostReason") ?? "").trim() || currentLead.lostReason,
          lastContactedAt: String(formData.get("lastContactedAt") ?? "").trim() || currentLead.lastContactedAt,
          note: String(formData.get("note") ?? "").trim() || undefined
        })
      ),
      crmProfile
    );

    upsertStoredCompanyLead(updatedLead);
    recordCompanyAuditEvent({
      companySlug: workspace.company.slug,
      connector: "system",
      kind: "decision",
      title: "Lead atualizado no funil",
      details: `${updatedLead.fullName} agora esta em ${updatedLead.stage} na rota ${getLeadRouteBucketLabel(updatedLead.routeBucket)}.`
    });

    if (shouldPushLeadImmediately(crmProfile)) {
      const syncedLead = await syncLeadToCrm(workspace.company, crmProfile, updatedLead);
      await syncLeadConversionSignals({
        company: workspace.company,
        lead: syncedLead,
        siteOpsProfile: workspace.siteOpsProfile
      });
      return NextResponse.redirect(
        new URL(
          `/empresas/${companyId}/conversao?leadUpdated=1&crmLeadStatus=${encodeURIComponent(getLeadSyncStatusLabel(syncedLead.syncStatus))}`,
          request.url
        ),
        {
          status: 303
        }
      );
    }

    await syncLeadConversionSignals({
      company: workspace.company,
      lead: updatedLead,
      siteOpsProfile: workspace.siteOpsProfile
    });

    return NextResponse.redirect(
      new URL(
        `/empresas/${companyId}/conversao?leadUpdated=1&crmLeadStatus=${encodeURIComponent(getLeadSyncStatusLabel(updatedLead.syncStatus))}`,
        request.url
      ),
      {
        status: 303
      }
    );
  }

  upsertStoredCompanyKeywordStrategy({
    ...workspace.keywordStrategy,
    status: "customized",
    updatedAt: new Date().toISOString(),
    mainOffer: String(formData.get("mainOffer") ?? ""),
    primaryKeywords: textareaToList(formData.get("primaryKeywords")),
    longTailKeywords: textareaToList(formData.get("longTailKeywords")),
    negativeKeywords: textareaToList(formData.get("negativeKeywords")),
    conversionAngles: textareaToList(formData.get("conversionAngles")),
    landingMessages: textareaToList(formData.get("landingMessages")),
    audienceSignals: textareaToList(formData.get("audienceSignals")),
    approvedDataSources: textareaToList(formData.get("approvedDataSources")),
    blockedDataSources: textareaToList(formData.get("blockedDataSources")),
    optimizationRules: textareaToList(formData.get("optimizationRules")),
    complianceNote: String(formData.get("complianceNote") ?? "")
  });
  recordCompanyAuditEvent({
    companySlug: workspace.company.slug,
    connector: "system",
    kind: "info",
    title: "Estrategia de conversao ajustada",
    details: `As regras de conversao e mensagens de landing foram atualizadas por ${session.email}.`
  });

  return NextResponse.redirect(new URL(`/empresas/${companyId}/conversao?saved=1`, request.url), { status: 303 });
}

function parseCurrencyField(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}
