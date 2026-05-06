import {
  isCompanyVaultConfigured,
  readCompanyVaultPayload,
  writeCompanyVaultPayload
} from "@/infrastructure/persistence/company-vault-payload-store";
import {
  type StoredCompanyAutomationLock,
  type VaultPayload
} from "@/infrastructure/persistence/company-vault-schema";
import {
  acquireStoredAutomationLockInStores,
  appendStoredAuditEventToStores,
  appendStoredAutomationDeadLetterToStores,
  appendStoredAutomationRunToStores,
  getStoredAuditEventsFromStores,
  getStoredAutomationDeadLettersFromStores,
  getStoredAutomationLockFromStores,
  getStoredAutomationQueueFromStores,
  getStoredAutomationRunsFromStores,
  releaseStoredAutomationLockFromStores,
  removeStoredAutomationQueueItemFromStores,
  upsertStoredAutomationQueueItemInStores
} from "@/infrastructure/persistence/company-automation-storage";
import {
  listStoredPaymentApprovalRequests,
  listStoredPublishingApprovalRequests,
  upsertStoredPaymentApprovalRequestInCollection,
  upsertStoredPublishingApprovalRequestInCollection
} from "@/infrastructure/persistence/company-approvals-storage";
import {
  getLatestStoredCampaignIntelligenceBrief as findLatestStoredCampaignIntelligenceBrief,
  listStoredCampaignIntelligenceBriefs,
  upsertStoredCampaignIntelligenceBriefInCollection
} from "@/infrastructure/persistence/company-campaign-storage";
import {
  appendStoredCompanyReportToCollection,
  listStoredCompanyReports,
  listStoredMetricSnapshots,
  replaceStoredMetricSnapshotsForCompany
} from "@/infrastructure/persistence/company-reports-storage";
import {
  getActiveStoredCompanyPolicyMatrix as findActiveStoredCompanyPolicyMatrix,
  listStoredCompanyPolicyMatrices,
  upsertStoredCompanyPolicyMatrixInCollection
} from "@/infrastructure/persistence/company-policy-storage";
import {
  getStoredCompanyDataOpsProfileFromCollection,
  getStoredCompanyPaymentProfileFromCollection,
  getStoredCompanyProfileFromCollection,
  getStoredCompanySchedulerProfileFromCollection,
  getStoredDesktopAgentProfileFromCollection,
  getStoredInternetIntelligenceProfileFromCollection,
  getStoredUserProfessionalProfileFromCollection,
  listStoredCompanyCodeWorkspaces,
  listStoredCompanyDataOpsProfiles,
  listStoredCompanyProfiles,
  listStoredCompanySchedulerJobs,
  listStoredCompanySchedulerProfiles,
  listStoredUserProfessionalProfiles,
  upsertStoredCompanyCodeWorkspaceInCollection,
  upsertStoredCompanyDataOpsProfileInCollection,
  upsertStoredCompanyPaymentProfileInCollection,
  upsertStoredCompanyProfileInCollection,
  upsertStoredCompanySchedulerJobInCollection,
  upsertStoredCompanySchedulerProfileInCollection,
  upsertStoredDesktopAgentProfileInCollection,
  upsertStoredInternetIntelligenceProfileInCollection,
  upsertStoredUserProfessionalProfileInCollection
} from "@/infrastructure/persistence/company-profile-storage";
import {
  appendStoredCompanyExecutionPlanToCollection,
  getStoredCompanyKeywordStrategyFromCollection,
  getStoredCompanyStrategyFromCollection,
  listStoredCompanyExecutionPlans,
  listStoredCompanyKeywordStrategies,
  listStoredCompanyOperationalAlerts,
  listStoredCompanyStrategies,
  listStoredTechnicalRequests,
  replaceStoredCompanyOperationalAlertsInCollection,
  upsertStoredCompanyKeywordStrategyInCollection,
  upsertStoredCompanyOperationalAlertInCollection,
  upsertStoredCompanyStrategyInCollection,
  upsertStoredTechnicalRequestInCollection
} from "@/infrastructure/persistence/company-strategy-storage";
import {
  listStoredCompanyCreativeAssets,
  listStoredCreativeToolConnections,
  upsertStoredCompanyCreativeAssetInCollection,
  upsertStoredCreativeToolConnectionInCollection
} from "@/infrastructure/persistence/company-creative-storage";
import {
  listStoredCompanyAgentLearnings as listStoredCompanyAgentLearningsFromCollection,
  listStoredCompanyExperimentOutcomes as listStoredCompanyExperimentOutcomesFromCollection,
  listStoredCompanyLearningPlaybooks as listStoredCompanyLearningPlaybooksFromCollection,
  replaceStoredCompanyAgentLearningsInCollection,
  replaceStoredCompanyExperimentOutcomesInCollection,
  replaceStoredCompanyLearningPlaybooksInCollection,
  replaceStoredCrossTenantLearningPlaybooksInCollection
} from "@/infrastructure/persistence/company-learning-storage";
import {
  appendStoredSocialExecutionLogToCollection,
  getStoredCompanySocialProfileFromCollection,
  getStoredSocialPlatformBindingFromCollection,
  listStoredCompanySocialProfiles,
  listStoredScheduledSocialPosts,
  listStoredSocialAdDrafts,
  listStoredSocialExecutionLogs,
  listStoredSocialInsights,
  listStoredSocialPlatformBindings,
  listStoredSocialRuntimeTasks,
  upsertStoredCompanySocialProfileInCollection,
  upsertStoredScheduledSocialPostInCollection,
  upsertStoredSocialAdDraftInCollection,
  upsertStoredSocialInsightInCollection,
  upsertStoredSocialPlatformBindingInCollection,
  upsertStoredSocialRuntimeTaskInCollection
} from "@/infrastructure/persistence/company-social-storage";
import {
  getStoredCompanyCrmProfileFromCollection,
  getStoredCompanySiteOpsProfileFromCollection,
  listStoredCompanyConversionEvents,
  listStoredCompanyLeads,
  upsertStoredCompanyConversionEventInCollection,
  upsertStoredCompanyCrmProfileInCollection,
  upsertStoredCompanyLeadInCollection,
  upsertStoredCompanySiteOpsProfileInCollection
} from "@/infrastructure/persistence/company-commercial-storage";
import {
  CrmConnectionRecord,
  GoogleConnectionRecord,
  SiteCmsConnectionRecord,
  SocialConnectionRecord,
  TrackingCredentialRecord,
  getStoredCrmConnectionFromPayload,
  getStoredCrmConnectionsFromPayload,
  getStoredGoogleConnectionFromPayload,
  getStoredGoogleConnectionsFromPayload,
  getStoredSiteCmsConnectionFromPayload,
  getStoredSiteCmsConnectionsFromPayload,
  getStoredSocialConnectionFromPayload,
  getStoredSocialConnectionsFromPayload,
  getStoredTrackingCredentialFromPayload,
  upsertStoredCrmConnectionInPayload,
  upsertStoredGoogleConnectionInPayload,
  upsertStoredSiteCmsConnectionInPayload,
  upsertStoredSocialConnectionInPayload,
  upsertStoredTrackingCredentialInPayload
} from "@/infrastructure/persistence/company-connection-storage";
import type { CampaignIntelligenceBriefRecord } from "@/core/marketing/campaign-intelligence";
import type {
  CompanyAutomationDeadLetterItem,
  CompanyAutomationQueueItem,
  CompanyAutomationRun,
  CompanyAgentProfile,
  CompanyCodeWorkspace,
  CompanyCreativeAsset,
  CompanyDataOpsProfile,
  CompanyExecutionPlan,
  CompanyExperimentOutcome,
  CompanyAgentLearning,
  CompanyLearningPlaybook,
  CrossTenantLearningPlaybook,
  CompanyCrmProfile,
  CompanySiteOpsProfile,
  CompanyLead,
  CompanyConversionEvent,
  CompanyGeneratedReport,
  CompanyKeywordStrategy,
  CompanyOperationalAlert,
  CompanyPaymentProfile,
  CompanyPolicyMatrix,
  CompanySchedulerJob,
  CompanySchedulerProfile,
  CompanySocialOpsProfile,
  CompanyStrategicPlan,
  ConnectorAuditEvent,
  CreativeToolConnection,
  DesktopAgentProfile,
  InternetIntelligenceProfile,
  MetricSnapshot,
  PaymentApprovalRequest,
  PlatformId,
  PublishingApprovalRequest,
  ScheduledSocialPost,
  SocialExecutionLog,
  SocialInsightSnapshot,
  SocialAdDraft,
  SocialPlatformBinding,
  SocialPlatformId,
  SocialRuntimeTask,
  TechnicalRequest,
  UserProfessionalProfile
} from "@/lib/domain";

export type { StoredCompanyAutomationLock } from "@/infrastructure/persistence/company-vault-schema";

export type StoredGoogleCompanyConnection = GoogleConnectionRecord;
export type StoredSocialCompanyConnection = SocialConnectionRecord;

export type StoredCompanyAgentProfile = CompanyAgentProfile;
export type StoredCompanyCodeWorkspace = CompanyCodeWorkspace;
export type StoredCompanyDataOpsProfile = CompanyDataOpsProfile;
export type StoredCompanySocialOpsProfile = CompanySocialOpsProfile;
export type StoredCompanySchedulerProfile = CompanySchedulerProfile;
export type StoredCompanySchedulerJob = CompanySchedulerJob;
export type StoredCompanyStrategicPlan = CompanyStrategicPlan;
export type StoredCompanyGeneratedReport = CompanyGeneratedReport;
export type StoredCompanyAgentLearning = CompanyAgentLearning;
export type StoredCompanyExecutionPlan = CompanyExecutionPlan;
export type StoredCompanyExperimentOutcome = CompanyExperimentOutcome;
export type StoredCompanyLearningPlaybook = CompanyLearningPlaybook;
export type StoredCrossTenantLearningPlaybook = CrossTenantLearningPlaybook;
export type StoredCompanyPolicyMatrix = CompanyPolicyMatrix;
export type StoredCampaignIntelligenceBrief = CampaignIntelligenceBriefRecord;
export type StoredCompanyAutomationRun = CompanyAutomationRun;
export type StoredCompanyAutomationQueueItem = CompanyAutomationQueueItem;
export type StoredCompanyAutomationDeadLetterItem = CompanyAutomationDeadLetterItem;
export type StoredCompanyCrmProfile = CompanyCrmProfile;
export type StoredCompanySiteOpsProfile = CompanySiteOpsProfile;
export type StoredCompanyLead = CompanyLead;
export type StoredCompanyOperationalAlert = CompanyOperationalAlert;
export type StoredCompanyKeywordStrategy = CompanyKeywordStrategy;
export type StoredCompanyPaymentProfile = CompanyPaymentProfile;
export type StoredCompanyCreativeAsset = CompanyCreativeAsset;
export type StoredCreativeToolConnection = CreativeToolConnection;
export type StoredPaymentApprovalRequest = PaymentApprovalRequest;
export type StoredPublishingApprovalRequest = PublishingApprovalRequest;
export type StoredMetricSnapshot = MetricSnapshot;
export type StoredScheduledSocialPost = ScheduledSocialPost;
export type StoredSocialAdDraft = SocialAdDraft;
export type StoredSocialInsightSnapshot = SocialInsightSnapshot;
export type StoredSocialPlatformBinding = SocialPlatformBinding;
export type StoredSocialExecutionLog = SocialExecutionLog;
export type StoredSocialRuntimeTask = SocialRuntimeTask;
export type StoredTechnicalRequest = TechnicalRequest;
export type StoredUserProfessionalProfile = UserProfessionalProfile;
export type StoredDesktopAgentProfile = DesktopAgentProfile;
export type StoredInternetIntelligenceProfile = InternetIntelligenceProfile;
export type StoredCompanyCrmConnection = CrmConnectionRecord;

export type StoredCompanySiteCmsConnection = SiteCmsConnectionRecord;

export type StoredCompanyTrackingCredential = TrackingCredentialRecord;

export function isVaultConfigured() {
  return isCompanyVaultConfigured();
}

function readVaultPayload(): VaultPayload {
  return readCompanyVaultPayload();
}

function writeVaultPayload(payload: VaultPayload) {
  writeCompanyVaultPayload(payload);
}

export function getStoredGoogleCompanyConnections() {
  return getStoredGoogleConnectionsFromPayload(readVaultPayload());
}

export function getStoredCompanyAutomationLock(companySlug: string) {
  return getStoredAutomationLockFromStores(readVaultPayload(), companySlug);
}

export function acquireStoredCompanyAutomationLock(lock: StoredCompanyAutomationLock) {
  const payload = readVaultPayload();
  return acquireStoredAutomationLockInStores({
    payload,
    writePayload: writeVaultPayload,
    lock
  });
}

export function releaseStoredCompanyAutomationLock(companySlug: string, runId?: string) {
  releaseStoredAutomationLockFromStores({
    payload: readVaultPayload(),
    writePayload: writeVaultPayload,
    companySlug,
    runId
  });
}

export function getStoredCompanyCrmConnections(companySlug?: string) {
  return getStoredCrmConnectionsFromPayload(readVaultPayload(), companySlug);
}

export function getStoredCompanySiteCmsConnections(companySlug?: string) {
  return getStoredSiteCmsConnectionsFromPayload(readVaultPayload(), companySlug);
}

export function getStoredCompanyTrackingCredential(companySlug: string) {
  return getStoredTrackingCredentialFromPayload(readVaultPayload(), companySlug);
}

export function upsertStoredCompanyTrackingCredential(credential: StoredCompanyTrackingCredential) {
  upsertStoredTrackingCredentialInPayload({
    payload: readVaultPayload(),
    writePayload: writeVaultPayload,
    credential
  });
}

export function getStoredCompanySiteCmsConnection(
  companySlug: string,
  provider: StoredCompanySiteCmsConnection["provider"]
) {
  return getStoredSiteCmsConnectionFromPayload(readVaultPayload(), companySlug, provider);
}

export function upsertStoredCompanySiteCmsConnection(connection: StoredCompanySiteCmsConnection) {
  upsertStoredSiteCmsConnectionInPayload({
    payload: readVaultPayload(),
    writePayload: writeVaultPayload,
    connection
  });
}

export function getStoredCompanyCrmConnection(
  companySlug: string,
  provider: StoredCompanyCrmConnection["provider"]
) {
  return getStoredCrmConnectionFromPayload(readVaultPayload(), companySlug, provider);
}

export function upsertStoredCompanyCrmConnection(connection: StoredCompanyCrmConnection) {
  upsertStoredCrmConnectionInPayload({
    payload: readVaultPayload(),
    writePayload: writeVaultPayload,
    connection
  });
}

export function getStoredSocialCompanyConnections(companySlug?: string) {
  return getStoredSocialConnectionsFromPayload(readVaultPayload(), companySlug);
}

export function getStoredSocialCompanyConnection(companySlug: string, platform: SocialPlatformId) {
  return getStoredSocialConnectionFromPayload(readVaultPayload(), companySlug, platform);
}

export function upsertStoredSocialCompanyConnection(connection: StoredSocialCompanyConnection) {
  upsertStoredSocialConnectionInPayload({
    payload: readVaultPayload(),
    writePayload: writeVaultPayload,
    connection
  });
}

export function getStoredGoogleCompanyConnection(companySlug: string, platform: PlatformId) {
  return getStoredGoogleConnectionFromPayload(readVaultPayload(), companySlug, platform);
}

export function upsertStoredGoogleCompanyConnection(connection: StoredGoogleCompanyConnection) {
  upsertStoredGoogleConnectionInPayload({
    payload: readVaultPayload(),
    writePayload: writeVaultPayload,
    connection
  });
}

export function getStoredUserProfessionalProfiles() {
  return listStoredUserProfessionalProfiles(readVaultPayload().userProfiles);
}

export function getStoredUserProfessionalProfile(userKey: string) {
  return getStoredUserProfessionalProfileFromCollection(readVaultPayload().userProfiles, userKey);
}

export function upsertStoredUserProfessionalProfile(profile: StoredUserProfessionalProfile) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    userProfiles: upsertStoredUserProfessionalProfileInCollection(payload.userProfiles, profile)
  });
}

export function getStoredCompanyProfiles() {
  return listStoredCompanyProfiles(readVaultPayload().companyProfiles);
}

export function getStoredCompanyCodeWorkspaces(companySlug?: string) {
  return listStoredCompanyCodeWorkspaces(readVaultPayload().companyCodeWorkspaces, companySlug);
}

export function upsertStoredCompanyCodeWorkspace(workspace: StoredCompanyCodeWorkspace) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companyCodeWorkspaces: upsertStoredCompanyCodeWorkspaceInCollection(
      payload.companyCodeWorkspaces,
      workspace
    )
  });
}

export function getStoredCompanyDataOpsProfiles() {
  return listStoredCompanyDataOpsProfiles(readVaultPayload().companyDataOpsProfiles);
}

export function getStoredCompanySocialProfiles() {
  return listStoredCompanySocialProfiles(readVaultPayload().companySocialProfiles);
}

export function getStoredCompanySchedulerProfiles() {
  return listStoredCompanySchedulerProfiles(readVaultPayload().companySchedulerProfiles);
}

export function getStoredCompanySchedulerProfile(companySlug: string) {
  return getStoredCompanySchedulerProfileFromCollection(
    readVaultPayload().companySchedulerProfiles,
    companySlug
  );
}

export function upsertStoredCompanySchedulerProfile(profile: StoredCompanySchedulerProfile) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companySchedulerProfiles: upsertStoredCompanySchedulerProfileInCollection(
      payload.companySchedulerProfiles,
      profile
    )
  });
}

export function getStoredCompanySchedulerJobs(companySlug?: string) {
  return listStoredCompanySchedulerJobs(readVaultPayload().companySchedulerJobs, companySlug);
}

export function upsertStoredCompanySchedulerJob(job: StoredCompanySchedulerJob) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companySchedulerJobs: upsertStoredCompanySchedulerJobInCollection(
      payload.companySchedulerJobs,
      job
    )
  });
}

export function getStoredSocialPlatformBindings(companySlug?: string) {
  return listStoredSocialPlatformBindings(readVaultPayload().socialBindings, companySlug);
}

export function getStoredSocialPlatformBinding(companySlug: string, platform: SocialPlatformId) {
  return getStoredSocialPlatformBindingFromCollection(
    readVaultPayload().socialBindings,
    companySlug,
    platform
  );
}

export function upsertStoredSocialPlatformBinding(binding: StoredSocialPlatformBinding) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    socialBindings: upsertStoredSocialPlatformBindingInCollection(
      payload.socialBindings,
      binding
    )
  });
}

export function getStoredCompanySocialProfile(companySlug: string) {
  return getStoredCompanySocialProfileFromCollection(
    readVaultPayload().companySocialProfiles,
    companySlug
  );
}

export function upsertStoredCompanySocialProfile(profile: StoredCompanySocialOpsProfile) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companySocialProfiles: upsertStoredCompanySocialProfileInCollection(
      payload.companySocialProfiles,
      profile
    )
  });
}

export function getStoredScheduledSocialPosts(companySlug?: string) {
  return listStoredScheduledSocialPosts(readVaultPayload().scheduledSocialPosts, companySlug);
}

export function upsertStoredScheduledSocialPost(post: StoredScheduledSocialPost) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    scheduledSocialPosts: upsertStoredScheduledSocialPostInCollection(
      payload.scheduledSocialPosts,
      post
    )
  });
}

export function getStoredSocialAdDrafts(companySlug?: string) {
  return listStoredSocialAdDrafts(readVaultPayload().socialAdDrafts, companySlug);
}

export function upsertStoredSocialAdDraft(draft: StoredSocialAdDraft) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    socialAdDrafts: upsertStoredSocialAdDraftInCollection(
      payload.socialAdDrafts,
      draft
    )
  });
}

export function getStoredSocialInsights(companySlug?: string) {
  return listStoredSocialInsights(readVaultPayload().socialInsights, companySlug);
}

export function upsertStoredSocialInsight(snapshot: StoredSocialInsightSnapshot) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    socialInsights: upsertStoredSocialInsightInCollection(
      payload.socialInsights,
      snapshot
    )
  });
}

export function getStoredSocialExecutionLogs(companySlug?: string) {
  return listStoredSocialExecutionLogs(readVaultPayload().socialExecutionLogs, companySlug);
}

export function appendStoredSocialExecutionLog(log: StoredSocialExecutionLog) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    socialExecutionLogs: appendStoredSocialExecutionLogToCollection(
      payload.socialExecutionLogs,
      log
    )
  });
}

export function getStoredSocialRuntimeTasks(companySlug?: string) {
  return listStoredSocialRuntimeTasks(readVaultPayload().socialRuntimeTasks, companySlug);
}

export function upsertStoredSocialRuntimeTask(task: StoredSocialRuntimeTask) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    socialRuntimeTasks: upsertStoredSocialRuntimeTaskInCollection(
      payload.socialRuntimeTasks,
      task
    )
  });
}

export function getStoredDesktopAgentProfile() {
  return getStoredDesktopAgentProfileFromCollection(readVaultPayload().desktopAgentProfile);
}

export function upsertStoredDesktopAgentProfile(profile: StoredDesktopAgentProfile) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    desktopAgentProfile: upsertStoredDesktopAgentProfileInCollection(profile)
  });
}

export function getStoredInternetIntelligenceProfile() {
  return getStoredInternetIntelligenceProfileFromCollection(
    readVaultPayload().internetIntelligenceProfile
  );
}

export function upsertStoredInternetIntelligenceProfile(profile: StoredInternetIntelligenceProfile) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    internetIntelligenceProfile: upsertStoredInternetIntelligenceProfileInCollection(profile)
  });
}

export function getStoredCompanyDataOpsProfile(companySlug: string) {
  return getStoredCompanyDataOpsProfileFromCollection(
    readVaultPayload().companyDataOpsProfiles,
    companySlug
  );
}

export function upsertStoredCompanyDataOpsProfile(profile: StoredCompanyDataOpsProfile) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companyDataOpsProfiles: upsertStoredCompanyDataOpsProfileInCollection(
      payload.companyDataOpsProfiles,
      profile
    )
  });
}

export function getStoredCompanyProfile(companySlug: string) {
  return getStoredCompanyProfileFromCollection(readVaultPayload().companyProfiles, companySlug);
}

export function upsertStoredCompanyProfile(profile: StoredCompanyAgentProfile) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companyProfiles: upsertStoredCompanyProfileInCollection(payload.companyProfiles, profile)
  });
}

export function getStoredCompanyStrategies() {
  return listStoredCompanyStrategies(readVaultPayload().companyStrategies);
}

export function getStoredCompanyStrategy(companySlug: string) {
  return getStoredCompanyStrategyFromCollection(readVaultPayload().companyStrategies, companySlug);
}

export function upsertStoredCompanyStrategy(strategy: StoredCompanyStrategicPlan) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companyStrategies: upsertStoredCompanyStrategyInCollection(
      payload.companyStrategies,
      strategy
    )
  });
}

export function getStoredCompanyReports(companySlug?: string) {
  return listStoredCompanyReports(readVaultPayload().companyReports, companySlug);
}

export function appendStoredCompanyReport(report: StoredCompanyGeneratedReport) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companyReports: appendStoredCompanyReportToCollection(payload.companyReports, report)
  });
}

export function getStoredMetricSnapshots(companyId?: string) {
  return listStoredMetricSnapshots(readVaultPayload().metricSnapshots, companyId);
}

export function replaceStoredMetricSnapshots(companyId: string, snapshots: StoredMetricSnapshot[]) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    metricSnapshots: replaceStoredMetricSnapshotsForCompany(
      payload.metricSnapshots,
      companyId,
      snapshots
    )
  });
}

export function getStoredCompanyAgentLearnings(companySlug?: string) {
  return listStoredCompanyAgentLearningsFromCollection(
    readVaultPayload().companyAgentLearnings,
    companySlug
  );
}

export function replaceStoredCompanyAgentLearnings(
  companySlug: string,
  learnings: StoredCompanyAgentLearning[]
) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companyAgentLearnings: replaceStoredCompanyAgentLearningsInCollection({
      existing: payload.companyAgentLearnings,
      companySlug,
      learnings
    })
  });
}

export function getStoredCompanyPolicyMatrices(companySlug?: string) {
  return listStoredCompanyPolicyMatrices(readVaultPayload().companyPolicyMatrices, companySlug);
}

export function getActiveStoredCompanyPolicyMatrix(companySlug: string) {
  return findActiveStoredCompanyPolicyMatrix(
    readVaultPayload().companyPolicyMatrices,
    companySlug
  );
}

export function upsertStoredCompanyPolicyMatrix(matrix: StoredCompanyPolicyMatrix) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companyPolicyMatrices: upsertStoredCompanyPolicyMatrixInCollection(
      payload.companyPolicyMatrices,
      matrix
    )
  });
}

export function getStoredCampaignIntelligenceBriefs(companySlug?: string) {
  return listStoredCampaignIntelligenceBriefs(
    readVaultPayload().campaignIntelligenceBriefs,
    companySlug
  );
}

export function getLatestStoredCampaignIntelligenceBrief(companySlug: string) {
  return findLatestStoredCampaignIntelligenceBrief(
    readVaultPayload().campaignIntelligenceBriefs,
    companySlug
  );
}

export function upsertStoredCampaignIntelligenceBrief(brief: StoredCampaignIntelligenceBrief) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    campaignIntelligenceBriefs: upsertStoredCampaignIntelligenceBriefInCollection(
      payload.campaignIntelligenceBriefs,
      brief
    )
  });
}

export function getStoredCompanyExecutionPlans(companySlug?: string) {
  return listStoredCompanyExecutionPlans(readVaultPayload().companyExecutionPlans, companySlug);
}

export function appendStoredCompanyExecutionPlan(plan: StoredCompanyExecutionPlan) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companyExecutionPlans: appendStoredCompanyExecutionPlanToCollection(
      payload.companyExecutionPlans,
      plan
    )
  });
}

export function getStoredCompanyExperimentOutcomes(companySlug?: string) {
  return listStoredCompanyExperimentOutcomesFromCollection(
    readVaultPayload().companyExperimentOutcomes,
    companySlug
  );
}

export function replaceStoredCompanyExperimentOutcomes(
  companySlug: string,
  outcomes: StoredCompanyExperimentOutcome[]
) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companyExperimentOutcomes: replaceStoredCompanyExperimentOutcomesInCollection({
      existing: payload.companyExperimentOutcomes,
      companySlug,
      outcomes
    })
  });
}

export function getStoredCompanyLearningPlaybooks(companySlug?: string) {
  return listStoredCompanyLearningPlaybooksFromCollection(
    readVaultPayload().companyLearningPlaybooks,
    companySlug
  );
}

export function replaceStoredCompanyLearningPlaybooks(
  companySlug: string,
  playbooks: StoredCompanyLearningPlaybook[]
) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companyLearningPlaybooks: replaceStoredCompanyLearningPlaybooksInCollection({
      existing: payload.companyLearningPlaybooks,
      companySlug,
      playbooks
    })
  });
}

export function getStoredCrossTenantLearningPlaybooks() {
  return readVaultPayload().crossTenantLearningPlaybooks;
}

export function replaceStoredCrossTenantLearningPlaybooks(
  playbooks: StoredCrossTenantLearningPlaybook[]
) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    crossTenantLearningPlaybooks: replaceStoredCrossTenantLearningPlaybooksInCollection(playbooks)
  });
}

export function getStoredCompanyAutomationRuns(companySlug?: string) {
  return getStoredAutomationRunsFromStores(readVaultPayload(), companySlug);
}

export function appendStoredCompanyAutomationRun(run: StoredCompanyAutomationRun) {
  appendStoredAutomationRunToStores({
    payload: readVaultPayload(),
    writePayload: writeVaultPayload,
    run
  });
}

export function getStoredCompanyAutomationQueue(companySlug?: string) {
  return getStoredAutomationQueueFromStores(readVaultPayload(), companySlug);
}

export function upsertStoredCompanyAutomationQueueItem(item: StoredCompanyAutomationQueueItem) {
  upsertStoredAutomationQueueItemInStores({
    payload: readVaultPayload(),
    writePayload: writeVaultPayload,
    item
  });
}

export function removeStoredCompanyAutomationQueueItem(itemId: string) {
  removeStoredAutomationQueueItemFromStores({
    payload: readVaultPayload(),
    writePayload: writeVaultPayload,
    itemId
  });
}

export function getStoredCompanyAutomationDeadLetters(companySlug?: string) {
  return getStoredAutomationDeadLettersFromStores(readVaultPayload(), companySlug);
}

export function appendStoredCompanyAutomationDeadLetter(item: StoredCompanyAutomationDeadLetterItem) {
  appendStoredAutomationDeadLetterToStores({
    payload: readVaultPayload(),
    writePayload: writeVaultPayload,
    item
  });
}

export function getStoredCompanyCrmProfile(companySlug: string) {
  return getStoredCompanyCrmProfileFromCollection(
    readVaultPayload().companyCrmProfiles,
    companySlug
  );
}

export function upsertStoredCompanyCrmProfile(profile: StoredCompanyCrmProfile) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companyCrmProfiles: upsertStoredCompanyCrmProfileInCollection(
      payload.companyCrmProfiles,
      profile
    )
  });
}

export function getStoredCompanySiteOpsProfile(companySlug: string) {
  return getStoredCompanySiteOpsProfileFromCollection(
    readVaultPayload().companySiteOpsProfiles,
    companySlug
  );
}

export function upsertStoredCompanySiteOpsProfile(profile: StoredCompanySiteOpsProfile) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companySiteOpsProfiles: upsertStoredCompanySiteOpsProfileInCollection(
      payload.companySiteOpsProfiles,
      profile
    )
  });
}

export function getStoredCompanyLeads(companySlug?: string) {
  return listStoredCompanyLeads(readVaultPayload().companyLeads, companySlug);
}

export function upsertStoredCompanyLead(lead: StoredCompanyLead) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companyLeads: upsertStoredCompanyLeadInCollection(payload.companyLeads, lead)
  });
}

export function getStoredCompanyConversionEvents(companySlug?: string) {
  return listStoredCompanyConversionEvents(
    readVaultPayload().companyConversionEvents,
    companySlug
  );
}

export function upsertStoredCompanyConversionEvent(event: CompanyConversionEvent) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companyConversionEvents: upsertStoredCompanyConversionEventInCollection(
      payload.companyConversionEvents,
      event
    )
  });
}

export function getStoredCompanyOperationalAlerts(companySlug?: string) {
  return listStoredCompanyOperationalAlerts(
    readVaultPayload().companyOperationalAlerts,
    companySlug
  );
}

export function upsertStoredCompanyOperationalAlert(alert: StoredCompanyOperationalAlert) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companyOperationalAlerts: upsertStoredCompanyOperationalAlertInCollection(
      payload.companyOperationalAlerts,
      alert
    )
  });
}

export function replaceStoredCompanyOperationalAlerts(
  companySlug: string,
  alerts: StoredCompanyOperationalAlert[]
) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companyOperationalAlerts: replaceStoredCompanyOperationalAlertsInCollection({
      existing: payload.companyOperationalAlerts,
      companySlug,
      alerts
    })
  });
}

export function getStoredCompanyKeywordStrategies() {
  return listStoredCompanyKeywordStrategies(readVaultPayload().companyKeywordStrategies);
}

export function getStoredCompanyKeywordStrategy(companySlug: string) {
  return getStoredCompanyKeywordStrategyFromCollection(
    readVaultPayload().companyKeywordStrategies,
    companySlug
  );
}

export function upsertStoredCompanyKeywordStrategy(strategy: StoredCompanyKeywordStrategy) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companyKeywordStrategies: upsertStoredCompanyKeywordStrategyInCollection(
      payload.companyKeywordStrategies,
      strategy
    )
  });
}

export function getStoredCompanyPaymentProfile(companySlug: string) {
  return getStoredCompanyPaymentProfileFromCollection(
    readVaultPayload().companyPaymentProfiles,
    companySlug
  );
}

export function upsertStoredCompanyPaymentProfile(profile: StoredCompanyPaymentProfile) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companyPaymentProfiles: upsertStoredCompanyPaymentProfileInCollection(
      payload.companyPaymentProfiles,
      profile
    )
  });
}

export function getStoredCompanyCreativeAssets(companySlug?: string) {
  return listStoredCompanyCreativeAssets(readVaultPayload().companyCreativeAssets, companySlug);
}

export function upsertStoredCompanyCreativeAsset(asset: StoredCompanyCreativeAsset) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companyCreativeAssets: upsertStoredCompanyCreativeAssetInCollection(
      payload.companyCreativeAssets,
      asset
    )
  });
}

export function getStoredCreativeToolConnections(companySlug?: string) {
  return listStoredCreativeToolConnections(
    readVaultPayload().creativeToolConnections,
    companySlug
  );
}

export function upsertStoredCreativeToolConnection(connection: StoredCreativeToolConnection) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    creativeToolConnections: upsertStoredCreativeToolConnectionInCollection(
      payload.creativeToolConnections,
      connection
    )
  });
}

export function getStoredPaymentApprovalRequests(companySlug?: string) {
  return listStoredPaymentApprovalRequests(
    readVaultPayload().paymentApprovalRequests,
    companySlug
  );
}

export function upsertStoredPaymentApprovalRequest(request: StoredPaymentApprovalRequest) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    paymentApprovalRequests: upsertStoredPaymentApprovalRequestInCollection(
      payload.paymentApprovalRequests,
      request
    )
  });
}

export function getStoredPublishingApprovalRequests(companySlug?: string) {
  return listStoredPublishingApprovalRequests(
    readVaultPayload().publishingApprovalRequests,
    companySlug
  );
}

export function upsertStoredPublishingApprovalRequest(request: StoredPublishingApprovalRequest) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    publishingApprovalRequests: upsertStoredPublishingApprovalRequestInCollection(
      payload.publishingApprovalRequests,
      request
    )
  });
}

export function getStoredTechnicalRequests(companySlug?: string) {
  return listStoredTechnicalRequests(readVaultPayload().technicalRequests, companySlug);
}

export function upsertStoredTechnicalRequest(request: StoredTechnicalRequest) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    technicalRequests: upsertStoredTechnicalRequestInCollection(
      payload.technicalRequests,
      request
    )
  });
}

export function getStoredAuditEvents(companySlug?: string) {
  return getStoredAuditEventsFromStores(readVaultPayload(), companySlug);
}

export function appendStoredAuditEvent(event: ConnectorAuditEvent) {
  appendStoredAuditEventToStores({
    payload: readVaultPayload(),
    writePayload: writeVaultPayload,
    event
  });
}
