import type { CampaignIntelligenceBriefRecord } from "@/core/marketing/campaign-intelligence";
import {
  upsertStoredCompanyCrmConnectionSecret,
  upsertStoredCompanySiteCmsSecret,
  upsertStoredCompanyTrackingSecret,
  upsertStoredGoogleCompanyConnectionSecret,
  upsertStoredSocialCompanyConnectionSecret
} from "@/infrastructure/secrets/tenant-secrets-store";
import type {
  CrmConnectionMetadata,
  CrmConnectionRecord,
  GoogleConnectionMetadata,
  GoogleConnectionRecord,
  SiteCmsConnectionMetadata,
  SiteCmsConnectionRecord,
  SocialConnectionMetadata,
  SocialConnectionRecord,
  TrackingCredentialMetadata,
  TrackingCredentialRecord
} from "@/infrastructure/persistence/company-connection-storage";
import type {
  CompanyAgentLearning,
  CompanyAgentProfile,
  CompanyAutomationDeadLetterItem,
  CompanyAutomationQueueItem,
  CompanyAutomationRun,
  CompanyCodeWorkspace,
  CompanyConversionEvent,
  CompanyCreativeAsset,
  CompanyCrmProfile,
  CompanyDataOpsProfile,
  CompanyExecutionPlan,
  CompanyExperimentOutcome,
  CompanyGeneratedReport,
  CompanyKeywordStrategy,
  CompanyLead,
  CompanyLearningPlaybook,
  CompanyOperationalAlert,
  CompanyPaymentProfile,
  CompanyPolicyMatrix,
  CompanySchedulerJob,
  CompanySchedulerProfile,
  CompanySiteOpsProfile,
  CompanySocialOpsProfile,
  CompanyStrategicPlan,
  ConnectorAuditEvent,
  CreativeToolConnection,
  CrossTenantLearningPlaybook,
  DesktopAgentProfile,
  InternetIntelligenceProfile,
  MetricSnapshot,
  PaymentApprovalRequest,
  PublishingApprovalRequest,
  ScheduledSocialPost,
  SocialAdDraft,
  SocialExecutionLog,
  SocialInsightSnapshot,
  SocialPlatformBinding,
  SocialRuntimeTask,
  TechnicalRequest,
  UserProfessionalProfile
} from "@/lib/domain";

export type StoredCompanyAutomationLock = {
  companySlug: string;
  runId: string;
  actor: string;
  lockedAt: string;
  expiresAt: string;
};

export type VaultPayload = {
  googleConnections: GoogleConnectionMetadata[];
  socialConnections: SocialConnectionMetadata[];
  crmConnections: CrmConnectionMetadata[];
  siteCmsConnections: SiteCmsConnectionMetadata[];
  trackingCredentials: TrackingCredentialMetadata[];
  automationLocks: StoredCompanyAutomationLock[];
  companyAutomationQueue: CompanyAutomationQueueItem[];
  companyAutomationDeadLetters: CompanyAutomationDeadLetterItem[];
  companyProfiles: CompanyAgentProfile[];
  companyCodeWorkspaces: CompanyCodeWorkspace[];
  companyDataOpsProfiles: CompanyDataOpsProfile[];
  companySocialProfiles: CompanySocialOpsProfile[];
  companySchedulerProfiles: CompanySchedulerProfile[];
  companySchedulerJobs: CompanySchedulerJob[];
  scheduledSocialPosts: ScheduledSocialPost[];
  socialAdDrafts: SocialAdDraft[];
  socialInsights: SocialInsightSnapshot[];
  socialBindings: SocialPlatformBinding[];
  socialExecutionLogs: SocialExecutionLog[];
  socialRuntimeTasks: SocialRuntimeTask[];
  desktopAgentProfile: DesktopAgentProfile | null;
  internetIntelligenceProfile: InternetIntelligenceProfile | null;
  userProfiles: UserProfessionalProfile[];
  companyStrategies: CompanyStrategicPlan[];
  companyReports: CompanyGeneratedReport[];
  companyAgentLearnings: CompanyAgentLearning[];
  companyExecutionPlans: CompanyExecutionPlan[];
  companyExperimentOutcomes: CompanyExperimentOutcome[];
  companyLearningPlaybooks: CompanyLearningPlaybook[];
  crossTenantLearningPlaybooks: CrossTenantLearningPlaybook[];
  companyPolicyMatrices: CompanyPolicyMatrix[];
  campaignIntelligenceBriefs: CampaignIntelligenceBriefRecord[];
  companyAutomationRuns: CompanyAutomationRun[];
  companyCrmProfiles: CompanyCrmProfile[];
  companySiteOpsProfiles: CompanySiteOpsProfile[];
  companyLeads: CompanyLead[];
  companyConversionEvents: CompanyConversionEvent[];
  companyOperationalAlerts: CompanyOperationalAlert[];
  companyKeywordStrategies: CompanyKeywordStrategy[];
  companyPaymentProfiles: CompanyPaymentProfile[];
  companyCreativeAssets: CompanyCreativeAsset[];
  creativeToolConnections: CreativeToolConnection[];
  paymentApprovalRequests: PaymentApprovalRequest[];
  publishingApprovalRequests: PublishingApprovalRequest[];
  metricSnapshots: MetricSnapshot[];
  technicalRequests: TechnicalRequest[];
  auditEvents: ConnectorAuditEvent[];
};

export function createEmptyVaultPayload(): VaultPayload {
  return {
    googleConnections: [],
    socialConnections: [],
    crmConnections: [],
    siteCmsConnections: [],
    trackingCredentials: [],
    automationLocks: [],
    companyAutomationQueue: [],
    companyAutomationDeadLetters: [],
    companyProfiles: [],
    companyCodeWorkspaces: [],
    companyDataOpsProfiles: [],
    companySocialProfiles: [],
    companySchedulerProfiles: [],
    companySchedulerJobs: [],
    scheduledSocialPosts: [],
    socialAdDrafts: [],
    socialInsights: [],
    socialBindings: [],
    socialExecutionLogs: [],
    socialRuntimeTasks: [],
    desktopAgentProfile: null,
    internetIntelligenceProfile: null,
    userProfiles: [],
    companyStrategies: [],
    companyReports: [],
    companyAgentLearnings: [],
    companyExecutionPlans: [],
    companyExperimentOutcomes: [],
    companyLearningPlaybooks: [],
    crossTenantLearningPlaybooks: [],
    companyPolicyMatrices: [],
    campaignIntelligenceBriefs: [],
    companyAutomationRuns: [],
    companyCrmProfiles: [],
    companySiteOpsProfiles: [],
    companyLeads: [],
    companyConversionEvents: [],
    companyOperationalAlerts: [],
    companyKeywordStrategies: [],
    companyPaymentProfiles: [],
    companyCreativeAssets: [],
    creativeToolConnections: [],
    paymentApprovalRequests: [],
    publishingApprovalRequests: [],
    metricSnapshots: [],
    technicalRequests: [],
    auditEvents: []
  };
}

export function normalizeVaultPayload(parsed: Partial<VaultPayload> & Record<string, unknown>) {
  let migratedLegacySecrets = false;

  const googleConnections = (Array.isArray(parsed.googleConnections) ? parsed.googleConnections : []).flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const candidate = entry as Partial<GoogleConnectionRecord & GoogleConnectionMetadata>;
    if (!candidate.companySlug || !candidate.platform) {
      return [];
    }

    if (typeof candidate.accessToken === "string" && candidate.accessToken) {
      upsertStoredGoogleCompanyConnectionSecret({
        companySlug: candidate.companySlug,
        platform: candidate.platform,
        accessToken: candidate.accessToken,
        refreshToken: candidate.refreshToken,
        updatedAt: candidate.updatedAt ?? new Date().toISOString()
      });
      migratedLegacySecrets = true;
    }

    return [{
      companySlug: candidate.companySlug,
      platform: candidate.platform,
      accountEmail: candidate.accountEmail ?? "",
      accountName: candidate.accountName ?? "",
      googleSub: candidate.googleSub ?? "",
      scopes: candidate.scopes ?? [],
      expiresAt: candidate.expiresAt,
      hasRefreshToken: Boolean(candidate.refreshToken) || Boolean(candidate.hasRefreshToken),
      createdAt: candidate.createdAt ?? new Date().toISOString(),
      updatedAt: candidate.updatedAt ?? new Date().toISOString()
    }];
  });

  const socialConnections = (Array.isArray(parsed.socialConnections) ? parsed.socialConnections : []).flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const candidate = entry as Partial<SocialConnectionRecord & SocialConnectionMetadata>;
    if (!candidate.companySlug || !candidate.platform || !candidate.provider) {
      return [];
    }

    if (typeof candidate.accessToken === "string" && candidate.accessToken) {
      upsertStoredSocialCompanyConnectionSecret({
        companySlug: candidate.companySlug,
        platform: candidate.platform,
        accessToken: candidate.accessToken,
        refreshToken: candidate.refreshToken,
        updatedAt: candidate.updatedAt ?? new Date().toISOString()
      });
      migratedLegacySecrets = true;
    }

    return [{
      companySlug: candidate.companySlug,
      platform: candidate.platform,
      provider: candidate.provider,
      accountLabel: candidate.accountLabel ?? "",
      externalUserId: candidate.externalUserId,
      scopes: candidate.scopes ?? [],
      expiresAt: candidate.expiresAt,
      hasRefreshToken: Boolean(candidate.refreshToken) || Boolean(candidate.hasRefreshToken),
      createdAt: candidate.createdAt ?? new Date().toISOString(),
      updatedAt: candidate.updatedAt ?? new Date().toISOString()
    }];
  });

  const crmConnections = (Array.isArray(parsed.crmConnections) ? parsed.crmConnections : []).flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const candidate = entry as Partial<CrmConnectionRecord>;
    if (!candidate.companySlug || !candidate.provider) {
      return [];
    }

    if (typeof candidate.accessToken === "string" && candidate.accessToken) {
      upsertStoredCompanyCrmConnectionSecret({
        companySlug: candidate.companySlug,
        provider: candidate.provider,
        accessToken: candidate.accessToken,
        updatedAt: candidate.updatedAt ?? new Date().toISOString()
      });
      migratedLegacySecrets = true;
    }

    return [{
      companySlug: candidate.companySlug,
      provider: candidate.provider,
      accountLabel: candidate.accountLabel,
      portalId: candidate.portalId,
      scopes: candidate.scopes ?? [],
      createdAt: candidate.createdAt ?? new Date().toISOString(),
      updatedAt: candidate.updatedAt ?? new Date().toISOString()
    }];
  });

  const siteCmsConnections = (Array.isArray(parsed.siteCmsConnections) ? parsed.siteCmsConnections : []).flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const candidate = entry as Partial<SiteCmsConnectionRecord>;
    if (!candidate.companySlug || !candidate.provider || !candidate.siteUrl || !candidate.username) {
      return [];
    }

    if (typeof candidate.appPassword === "string" && candidate.appPassword) {
      upsertStoredCompanySiteCmsSecret({
        companySlug: candidate.companySlug,
        provider: candidate.provider,
        appPassword: candidate.appPassword,
        updatedAt: candidate.updatedAt ?? new Date().toISOString()
      });
      migratedLegacySecrets = true;
    }

    return [{
      companySlug: candidate.companySlug,
      provider: candidate.provider,
      siteUrl: candidate.siteUrl,
      username: candidate.username,
      createdAt: candidate.createdAt ?? new Date().toISOString(),
      updatedAt: candidate.updatedAt ?? new Date().toISOString()
    }];
  });

  const trackingCredentials = (Array.isArray(parsed.trackingCredentials) ? parsed.trackingCredentials : []).flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const candidate = entry as Partial<TrackingCredentialRecord & TrackingCredentialMetadata>;
    if (!candidate.companySlug) {
      return [];
    }

    if (candidate.ga4ApiSecret || candidate.metaAccessToken) {
      upsertStoredCompanyTrackingSecret({
        companySlug: candidate.companySlug,
        ga4ApiSecret: candidate.ga4ApiSecret,
        metaAccessToken: candidate.metaAccessToken,
        updatedAt: candidate.updatedAt ?? new Date().toISOString()
      });
      migratedLegacySecrets = true;
    }

    return [{
      companySlug: candidate.companySlug,
      hasGa4ApiSecret: Boolean(candidate.ga4ApiSecret) || Boolean(candidate.hasGa4ApiSecret),
      hasMetaAccessToken: Boolean(candidate.metaAccessToken) || Boolean(candidate.hasMetaAccessToken),
      createdAt: candidate.createdAt ?? new Date().toISOString(),
      updatedAt: candidate.updatedAt ?? new Date().toISOString()
    }];
  });

  const payload: VaultPayload = {
    googleConnections,
    socialConnections,
    crmConnections,
    siteCmsConnections,
    trackingCredentials,
    automationLocks: parsed.automationLocks ?? [],
    companyAutomationQueue: parsed.companyAutomationQueue ?? [],
    companyAutomationDeadLetters: parsed.companyAutomationDeadLetters ?? [],
    companyProfiles: parsed.companyProfiles ?? [],
    companyCodeWorkspaces: parsed.companyCodeWorkspaces ?? [],
    companyDataOpsProfiles: parsed.companyDataOpsProfiles ?? [],
    companySocialProfiles: parsed.companySocialProfiles ?? [],
    companySchedulerProfiles: parsed.companySchedulerProfiles ?? [],
    companySchedulerJobs: parsed.companySchedulerJobs ?? [],
    scheduledSocialPosts: parsed.scheduledSocialPosts ?? [],
    socialAdDrafts: parsed.socialAdDrafts ?? [],
    socialInsights: parsed.socialInsights ?? [],
    socialBindings: parsed.socialBindings ?? [],
    socialExecutionLogs: parsed.socialExecutionLogs ?? [],
    socialRuntimeTasks: parsed.socialRuntimeTasks ?? [],
    desktopAgentProfile: parsed.desktopAgentProfile ?? null,
    internetIntelligenceProfile: parsed.internetIntelligenceProfile ?? null,
    userProfiles: parsed.userProfiles ?? [],
    companyStrategies: parsed.companyStrategies ?? [],
    companyReports: parsed.companyReports ?? [],
    companyAgentLearnings: (parsed.companyAgentLearnings ?? []).map(normalizeStoredAgentLearning),
    companyExecutionPlans: parsed.companyExecutionPlans ?? [],
    companyExperimentOutcomes: (parsed.companyExperimentOutcomes ?? []).map(normalizeStoredExperimentOutcome),
    companyLearningPlaybooks: (parsed.companyLearningPlaybooks ?? []).map(normalizeStoredLearningPlaybook),
    crossTenantLearningPlaybooks: (parsed.crossTenantLearningPlaybooks ?? []).map(
      normalizeStoredCrossTenantLearningPlaybook
    ),
    companyPolicyMatrices: parsed.companyPolicyMatrices ?? [],
    campaignIntelligenceBriefs: parsed.campaignIntelligenceBriefs ?? [],
    companyAutomationRuns: parsed.companyAutomationRuns ?? [],
    companyCrmProfiles: parsed.companyCrmProfiles ?? [],
    companySiteOpsProfiles: parsed.companySiteOpsProfiles ?? [],
    companyLeads: parsed.companyLeads ?? [],
    companyConversionEvents: parsed.companyConversionEvents ?? [],
    companyOperationalAlerts: parsed.companyOperationalAlerts ?? [],
    companyKeywordStrategies: parsed.companyKeywordStrategies ?? [],
    companyPaymentProfiles: parsed.companyPaymentProfiles ?? [],
    companyCreativeAssets: parsed.companyCreativeAssets ?? [],
    creativeToolConnections: parsed.creativeToolConnections ?? [],
    paymentApprovalRequests: parsed.paymentApprovalRequests ?? [],
    publishingApprovalRequests: parsed.publishingApprovalRequests ?? [],
    metricSnapshots: parsed.metricSnapshots ?? [],
    technicalRequests: parsed.technicalRequests ?? [],
    auditEvents: parsed.auditEvents ?? []
  };

  return {
    payload,
    migratedLegacySecrets
  };
}

function normalizeStoredAgentLearning(entry: CompanyAgentLearning): CompanyAgentLearning {
  return {
    ...entry,
    learningBoundary: entry.learningBoundary ?? "tenant_private",
    shareability: entry.shareability ?? "restricted"
  };
}

function normalizeStoredExperimentOutcome(
  entry: CompanyExperimentOutcome
): CompanyExperimentOutcome {
  return {
    ...entry,
    learningBoundary: entry.learningBoundary ?? "tenant_private",
    shareability: entry.shareability ?? "restricted",
    version: entry.version ?? 1,
    confidenceState: entry.confidenceState ?? "emerging",
    validFrom: entry.validFrom ?? entry.generatedAt,
    validUntil: entry.validUntil,
    validityScope:
      entry.validityScope ?? {
        channel: entry.channel ?? "unknown",
        targetMetric: entry.targetMetric ?? "primary_metric",
        observedWindow: entry.observedWindow ?? "7d",
        tenantOnly: entry.learningBoundary !== "cross_tenant_safe"
      }
  };
}

function normalizeStoredLearningPlaybook(
  entry: CompanyLearningPlaybook
): CompanyLearningPlaybook {
  return {
    ...entry,
    learningBoundary: entry.learningBoundary ?? "tenant_private",
    shareability: entry.shareability ?? "restricted",
    version: entry.version ?? 1,
    confidenceState: entry.confidenceState ?? "emerging",
    validFrom: entry.validFrom ?? entry.createdAt,
    validUntil: entry.validUntil,
    validityScope:
      entry.validityScope ?? {
        channel: entry.channel ?? "unknown",
        targetMetric: "primary_metric",
        observedWindow: "7d",
        tenantOnly: entry.learningBoundary !== "cross_tenant_safe"
      },
    failureMemory: entry.failureMemory ?? {
      count: entry.lossCount ?? 0
    },
    reuseGuidance:
      entry.reuseGuidance ??
      [
        entry.recommendedAction,
        "Revalidar o playbook antes de escalar fora do contexto em que ele nasceu."
      ].filter(Boolean)
  };
}

function normalizeStoredCrossTenantLearningPlaybook(
  entry: CrossTenantLearningPlaybook
): CrossTenantLearningPlaybook {
  return {
    ...entry,
    learningBoundary: "cross_tenant_safe",
    shareability: "shared",
    version: entry.version ?? 1,
    confidenceState: entry.confidenceState ?? "emerging",
    validFrom: entry.validFrom ?? entry.createdAt,
    validUntil: entry.validUntil,
    validityScope:
      entry.validityScope ?? {
        channel: entry.channel ?? "unknown",
        targetMetric: "primary_metric",
        observedWindow: "7d",
        tenantOnly: false
      },
    failureMemory: entry.failureMemory ?? {
      count: entry.lossCount ?? 0
    },
    reuseGuidance:
      entry.reuseGuidance ??
      [
        entry.recommendedAction,
        "Aplicar apenas como padrao anonimizado e revalidar no tenant atual."
      ].filter(Boolean)
  };
}
