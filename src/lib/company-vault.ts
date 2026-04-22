import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  CompanyAgentProfile,
  CompanyCodeWorkspace,
  CompanyCreativeAsset,
  CompanyDataOpsProfile,
  CompanyExecutionPlan,
  CompanyAgentLearning,
  CompanyCrmProfile,
  CompanySiteOpsProfile,
  CompanyLead,
  CompanyConversionEvent,
  CompanyGeneratedReport,
  CompanyKeywordStrategy,
  CompanyOperationalAlert,
  CompanyPaymentProfile,
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

export type StoredGoogleCompanyConnection = {
  companySlug: string;
  platform: PlatformId;
  accountEmail: string;
  accountName: string;
  googleSub: string;
  scopes: string[];
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredSocialCompanyConnection = {
  companySlug: string;
  platform: SocialPlatformId;
  provider: "meta" | "linkedin" | "tiktok";
  accountLabel: string;
  externalUserId?: string;
  scopes: string[];
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
};

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
export type StoredCompanyCrmConnection = {
  companySlug: string;
  provider: "hubspot";
  accessToken: string;
  accountLabel?: string;
  portalId?: string;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
};

export type StoredCompanySiteCmsConnection = {
  companySlug: string;
  provider: "wordpress";
  siteUrl: string;
  username: string;
  appPassword: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredCompanyTrackingCredential = {
  companySlug: string;
  ga4ApiSecret?: string;
  metaAccessToken?: string;
  createdAt: string;
  updatedAt: string;
};

type VaultPayload = {
  googleConnections: StoredGoogleCompanyConnection[];
  socialConnections: StoredSocialCompanyConnection[];
  crmConnections: StoredCompanyCrmConnection[];
  siteCmsConnections: StoredCompanySiteCmsConnection[];
  trackingCredentials: StoredCompanyTrackingCredential[];
  companyProfiles: StoredCompanyAgentProfile[];
  companyCodeWorkspaces: StoredCompanyCodeWorkspace[];
  companyDataOpsProfiles: StoredCompanyDataOpsProfile[];
  companySocialProfiles: StoredCompanySocialOpsProfile[];
  companySchedulerProfiles: StoredCompanySchedulerProfile[];
  companySchedulerJobs: StoredCompanySchedulerJob[];
  scheduledSocialPosts: StoredScheduledSocialPost[];
  socialAdDrafts: StoredSocialAdDraft[];
  socialInsights: StoredSocialInsightSnapshot[];
  socialBindings: StoredSocialPlatformBinding[];
  socialExecutionLogs: StoredSocialExecutionLog[];
  socialRuntimeTasks: StoredSocialRuntimeTask[];
  desktopAgentProfile: StoredDesktopAgentProfile | null;
  internetIntelligenceProfile: StoredInternetIntelligenceProfile | null;
  userProfiles: StoredUserProfessionalProfile[];
  companyStrategies: StoredCompanyStrategicPlan[];
  companyReports: StoredCompanyGeneratedReport[];
  companyAgentLearnings: StoredCompanyAgentLearning[];
  companyExecutionPlans: StoredCompanyExecutionPlan[];
  companyCrmProfiles: StoredCompanyCrmProfile[];
  companySiteOpsProfiles: StoredCompanySiteOpsProfile[];
  companyLeads: StoredCompanyLead[];
  companyConversionEvents: CompanyConversionEvent[];
  companyOperationalAlerts: StoredCompanyOperationalAlert[];
  companyKeywordStrategies: StoredCompanyKeywordStrategy[];
  companyPaymentProfiles: StoredCompanyPaymentProfile[];
  companyCreativeAssets: StoredCompanyCreativeAsset[];
  creativeToolConnections: StoredCreativeToolConnection[];
  paymentApprovalRequests: StoredPaymentApprovalRequest[];
  publishingApprovalRequests: StoredPublishingApprovalRequest[];
  metricSnapshots: StoredMetricSnapshot[];
  technicalRequests: StoredTechnicalRequest[];
  auditEvents: ConnectorAuditEvent[];
};

const DATA_DIR = path.join(process.cwd(), ".data");
const VAULT_FILE = path.join(DATA_DIR, "company-agent.vault");

function getVaultSecret() {
  return process.env.VAULT_ENCRYPTION_KEY;
}

function getVaultKey() {
  const secret = getVaultSecret();
  if (!secret) return null;
  return createHash("sha256").update(secret).digest();
}

export function isVaultConfigured() {
  return Boolean(getVaultSecret());
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function createEmptyPayload(): VaultPayload {
  return {
    googleConnections: [],
    socialConnections: [],
    crmConnections: [],
    siteCmsConnections: [],
    trackingCredentials: [],
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

function encrypt(text: string) {
  const key = getVaultKey();
  if (!key) {
    throw new Error("VAULT_ENCRYPTION_KEY ausente");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString("base64url"),
    tag: tag.toString("base64url"),
    content: encrypted.toString("base64url")
  });
}

function decrypt(value: string) {
  const key = getVaultKey();
  if (!key) {
    throw new Error("VAULT_ENCRYPTION_KEY ausente");
  }

  const parsed = JSON.parse(value) as {
    iv: string;
    tag: string;
    content: string;
  };

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(parsed.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(parsed.tag, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parsed.content, "base64url")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}

function readVaultPayload(): VaultPayload {
  if (!isVaultConfigured() || !existsSync(VAULT_FILE)) {
    return createEmptyPayload();
  }

  try {
    const encrypted = readFileSync(VAULT_FILE, "utf8");
    const parsed = JSON.parse(decrypt(encrypted)) as Partial<VaultPayload>;

    return {
      googleConnections: parsed.googleConnections ?? [],
      socialConnections: parsed.socialConnections ?? [],
      crmConnections: parsed.crmConnections ?? [],
      siteCmsConnections: parsed.siteCmsConnections ?? [],
      trackingCredentials: parsed.trackingCredentials ?? [],
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
      companyAgentLearnings: parsed.companyAgentLearnings ?? [],
      companyExecutionPlans: parsed.companyExecutionPlans ?? [],
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
  } catch {
    return createEmptyPayload();
  }
}

function writeVaultPayload(payload: VaultPayload) {
  ensureDataDir();
  writeFileSync(VAULT_FILE, encrypt(JSON.stringify(payload, null, 2)), "utf8");
}

export function getStoredGoogleCompanyConnections() {
  return readVaultPayload().googleConnections;
}

export function getStoredCompanyCrmConnections(companySlug?: string) {
  const connections = readVaultPayload().crmConnections;
  return companySlug ? connections.filter((connection) => connection.companySlug === companySlug) : connections;
}

export function getStoredCompanySiteCmsConnections(companySlug?: string) {
  const connections = readVaultPayload().siteCmsConnections;
  return companySlug ? connections.filter((connection) => connection.companySlug === companySlug) : connections;
}

export function getStoredCompanyTrackingCredential(companySlug: string) {
  return readVaultPayload().trackingCredentials.find((credential) => credential.companySlug === companySlug);
}

export function upsertStoredCompanyTrackingCredential(credential: StoredCompanyTrackingCredential) {
  const payload = readVaultPayload();
  const existing = payload.trackingCredentials.find((entry) => entry.companySlug === credential.companySlug);
  const nextCredentials = payload.trackingCredentials.filter((entry) => entry.companySlug !== credential.companySlug);

  nextCredentials.push({
    ...credential,
    createdAt: existing?.createdAt ?? credential.createdAt
  });

  writeVaultPayload({
    ...payload,
    trackingCredentials: nextCredentials
  });
}

export function getStoredCompanySiteCmsConnection(
  companySlug: string,
  provider: StoredCompanySiteCmsConnection["provider"]
) {
  return getStoredCompanySiteCmsConnections(companySlug).find((connection) => connection.provider === provider);
}

export function upsertStoredCompanySiteCmsConnection(connection: StoredCompanySiteCmsConnection) {
  const payload = readVaultPayload();
  const existing = payload.siteCmsConnections.find(
    (entry) => entry.companySlug === connection.companySlug && entry.provider === connection.provider
  );
  const nextConnections = payload.siteCmsConnections.filter(
    (entry) => !(entry.companySlug === connection.companySlug && entry.provider === connection.provider)
  );

  nextConnections.push({
    ...connection,
    createdAt: existing?.createdAt ?? connection.createdAt
  });

  writeVaultPayload({
    ...payload,
    siteCmsConnections: nextConnections
  });
}

export function getStoredCompanyCrmConnection(
  companySlug: string,
  provider: StoredCompanyCrmConnection["provider"]
) {
  return getStoredCompanyCrmConnections(companySlug).find((connection) => connection.provider === provider);
}

export function upsertStoredCompanyCrmConnection(connection: StoredCompanyCrmConnection) {
  const payload = readVaultPayload();
  const existing = payload.crmConnections.find(
    (entry) => entry.companySlug === connection.companySlug && entry.provider === connection.provider
  );
  const nextConnections = payload.crmConnections.filter(
    (entry) => !(entry.companySlug === connection.companySlug && entry.provider === connection.provider)
  );

  nextConnections.push({
    ...connection,
    createdAt: existing?.createdAt ?? connection.createdAt
  });

  writeVaultPayload({
    ...payload,
    crmConnections: nextConnections
  });
}

export function getStoredSocialCompanyConnections(companySlug?: string) {
  const connections = readVaultPayload().socialConnections;
  return companySlug ? connections.filter((connection) => connection.companySlug === companySlug) : connections;
}

export function getStoredSocialCompanyConnection(companySlug: string, platform: SocialPlatformId) {
  return getStoredSocialCompanyConnections(companySlug).find((connection) => connection.platform === platform);
}

export function upsertStoredSocialCompanyConnection(connection: StoredSocialCompanyConnection) {
  const payload = readVaultPayload();
  const nextConnections = payload.socialConnections.filter(
    (entry) => !(entry.companySlug === connection.companySlug && entry.platform === connection.platform)
  );

  nextConnections.push(connection);
  writeVaultPayload({
    ...payload,
    socialConnections: nextConnections
  });
}

export function getStoredGoogleCompanyConnection(companySlug: string, platform: PlatformId) {
  return getStoredGoogleCompanyConnections().find(
    (connection) => connection.companySlug === companySlug && connection.platform === platform
  );
}

export function upsertStoredGoogleCompanyConnection(connection: StoredGoogleCompanyConnection) {
  const payload = readVaultPayload();
  const existing = payload.googleConnections.find(
    (entry) => entry.companySlug === connection.companySlug && entry.platform === connection.platform
  );
  const nextConnections = payload.googleConnections.filter(
    (entry) => !(entry.companySlug === connection.companySlug && entry.platform === connection.platform)
  );

  nextConnections.push({
    ...connection,
    createdAt: existing?.createdAt ?? connection.createdAt
  });

  writeVaultPayload({
    ...payload,
    googleConnections: nextConnections
  });
}

export function getStoredUserProfessionalProfiles() {
  return readVaultPayload().userProfiles;
}

export function getStoredUserProfessionalProfile(userKey: string) {
  return getStoredUserProfessionalProfiles().find((profile) => profile.userKey === userKey);
}

export function upsertStoredUserProfessionalProfile(profile: StoredUserProfessionalProfile) {
  const payload = readVaultPayload();
  const nextProfiles = payload.userProfiles.filter((entry) => entry.userKey !== profile.userKey);

  nextProfiles.push(profile);
  writeVaultPayload({
    ...payload,
    userProfiles: nextProfiles
  });
}

export function getStoredCompanyProfiles() {
  return readVaultPayload().companyProfiles;
}

export function getStoredCompanyCodeWorkspaces(companySlug?: string) {
  const workspaces = readVaultPayload().companyCodeWorkspaces;
  return companySlug ? workspaces.filter((workspace) => workspace.companySlug === companySlug) : workspaces;
}

export function upsertStoredCompanyCodeWorkspace(workspace: StoredCompanyCodeWorkspace) {
  const payload = readVaultPayload();
  const nextWorkspaces = payload.companyCodeWorkspaces.filter((entry) => entry.id !== workspace.id);

  nextWorkspaces.push(workspace);
  writeVaultPayload({
    ...payload,
    companyCodeWorkspaces: nextWorkspaces
  });
}

export function getStoredCompanyDataOpsProfiles() {
  return readVaultPayload().companyDataOpsProfiles;
}

export function getStoredCompanySocialProfiles() {
  return readVaultPayload().companySocialProfiles;
}

export function getStoredCompanySchedulerProfiles() {
  return readVaultPayload().companySchedulerProfiles;
}

export function getStoredCompanySchedulerProfile(companySlug: string) {
  return getStoredCompanySchedulerProfiles().find((profile) => profile.companySlug === companySlug);
}

export function upsertStoredCompanySchedulerProfile(profile: StoredCompanySchedulerProfile) {
  const payload = readVaultPayload();
  const nextProfiles = payload.companySchedulerProfiles.filter((entry) => entry.companySlug !== profile.companySlug);

  nextProfiles.push(profile);
  writeVaultPayload({
    ...payload,
    companySchedulerProfiles: nextProfiles
  });
}

export function getStoredCompanySchedulerJobs(companySlug?: string) {
  const jobs = readVaultPayload().companySchedulerJobs;
  return companySlug ? jobs.filter((job) => job.companySlug === companySlug) : jobs;
}

export function upsertStoredCompanySchedulerJob(job: StoredCompanySchedulerJob) {
  const payload = readVaultPayload();
  const nextJobs = payload.companySchedulerJobs.filter((entry) => entry.id !== job.id);

  nextJobs.push(job);
  writeVaultPayload({
    ...payload,
    companySchedulerJobs: nextJobs
  });
}

export function getStoredSocialPlatformBindings(companySlug?: string) {
  const bindings = readVaultPayload().socialBindings;
  return companySlug ? bindings.filter((binding) => binding.companySlug === companySlug) : bindings;
}

export function getStoredSocialPlatformBinding(companySlug: string, platform: SocialPlatformId) {
  return getStoredSocialPlatformBindings(companySlug).find((binding) => binding.platform === platform);
}

export function upsertStoredSocialPlatformBinding(binding: StoredSocialPlatformBinding) {
  const payload = readVaultPayload();
  const nextBindings = payload.socialBindings.filter(
    (entry) => !(entry.companySlug === binding.companySlug && entry.platform === binding.platform)
  );

  nextBindings.push(binding);
  writeVaultPayload({
    ...payload,
    socialBindings: nextBindings
  });
}

export function getStoredCompanySocialProfile(companySlug: string) {
  return getStoredCompanySocialProfiles().find((profile) => profile.companySlug === companySlug);
}

export function upsertStoredCompanySocialProfile(profile: StoredCompanySocialOpsProfile) {
  const payload = readVaultPayload();
  const nextProfiles = payload.companySocialProfiles.filter((entry) => entry.companySlug !== profile.companySlug);

  nextProfiles.push(profile);
  writeVaultPayload({
    ...payload,
    companySocialProfiles: nextProfiles
  });
}

export function getStoredScheduledSocialPosts(companySlug?: string) {
  const posts = readVaultPayload().scheduledSocialPosts;
  return companySlug ? posts.filter((post) => post.companySlug === companySlug) : posts;
}

export function upsertStoredScheduledSocialPost(post: StoredScheduledSocialPost) {
  const payload = readVaultPayload();
  const nextPosts = payload.scheduledSocialPosts.filter(
    (entry) =>
      entry.id !== post.id &&
      !(
        post.sourceApprovalRequestId &&
        entry.companySlug === post.companySlug &&
        entry.sourceApprovalRequestId === post.sourceApprovalRequestId
      ) &&
      !(
        post.sourceAssetVersionId &&
        entry.companySlug === post.companySlug &&
        entry.platform === post.platform &&
        entry.sourceAssetVersionId === post.sourceAssetVersionId &&
        entry.status !== "rejected"
      )
  );

  nextPosts.push(post);
  writeVaultPayload({
    ...payload,
    scheduledSocialPosts: nextPosts
  });
}

export function getStoredSocialAdDrafts(companySlug?: string) {
  const drafts = readVaultPayload().socialAdDrafts;
  return companySlug ? drafts.filter((draft) => draft.companySlug === companySlug) : drafts;
}

export function upsertStoredSocialAdDraft(draft: StoredSocialAdDraft) {
  const payload = readVaultPayload();
  const nextDrafts = payload.socialAdDrafts.filter(
    (entry) =>
      entry.id !== draft.id &&
      !(
        draft.sourceAssetVersionId &&
        entry.companySlug === draft.companySlug &&
        entry.platform === draft.platform &&
        entry.sourceAssetVersionId === draft.sourceAssetVersionId &&
        entry.status !== "rejected"
      )
  );

  nextDrafts.push(draft);
  writeVaultPayload({
    ...payload,
    socialAdDrafts: nextDrafts
  });
}

export function getStoredSocialInsights(companySlug?: string) {
  const insights = readVaultPayload().socialInsights;
  return companySlug ? insights.filter((snapshot) => snapshot.companySlug === companySlug) : insights;
}

export function upsertStoredSocialInsight(snapshot: StoredSocialInsightSnapshot) {
  const payload = readVaultPayload();
  const nextInsights = payload.socialInsights.filter(
    (entry) =>
      !(
        entry.companySlug === snapshot.companySlug &&
        entry.platform === snapshot.platform &&
        entry.window === snapshot.window
      )
  );

  nextInsights.push(snapshot);
  writeVaultPayload({
    ...payload,
    socialInsights: nextInsights
  });
}

export function getStoredSocialExecutionLogs(companySlug?: string) {
  const logs = readVaultPayload().socialExecutionLogs;
  return companySlug ? logs.filter((log) => log.companySlug === companySlug) : logs;
}

export function appendStoredSocialExecutionLog(log: StoredSocialExecutionLog) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    socialExecutionLogs: [log, ...payload.socialExecutionLogs].slice(0, 500)
  });
}

export function getStoredSocialRuntimeTasks(companySlug?: string) {
  const tasks = readVaultPayload().socialRuntimeTasks;
  return companySlug ? tasks.filter((task) => task.companySlug === companySlug) : tasks;
}

export function upsertStoredSocialRuntimeTask(task: StoredSocialRuntimeTask) {
  const payload = readVaultPayload();
  const nextTasks = payload.socialRuntimeTasks.filter(
    (entry) =>
      entry.id !== task.id &&
      !(
        entry.companySlug === task.companySlug &&
        entry.kind === task.kind &&
        entry.platform === task.platform &&
        entry.sourceItemId === task.sourceItemId &&
        entry.status !== "completed"
      )
  );

  nextTasks.unshift(task);
  writeVaultPayload({
    ...payload,
    socialRuntimeTasks: nextTasks.slice(0, 400)
  });
}

export function getStoredDesktopAgentProfile() {
  return readVaultPayload().desktopAgentProfile;
}

export function upsertStoredDesktopAgentProfile(profile: StoredDesktopAgentProfile) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    desktopAgentProfile: profile
  });
}

export function getStoredInternetIntelligenceProfile() {
  return readVaultPayload().internetIntelligenceProfile;
}

export function upsertStoredInternetIntelligenceProfile(profile: StoredInternetIntelligenceProfile) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    internetIntelligenceProfile: profile
  });
}

export function getStoredCompanyDataOpsProfile(companySlug: string) {
  return getStoredCompanyDataOpsProfiles().find((profile) => profile.companySlug === companySlug);
}

export function upsertStoredCompanyDataOpsProfile(profile: StoredCompanyDataOpsProfile) {
  const payload = readVaultPayload();
  const nextProfiles = payload.companyDataOpsProfiles.filter((entry) => entry.companySlug !== profile.companySlug);

  nextProfiles.push(profile);
  writeVaultPayload({
    ...payload,
    companyDataOpsProfiles: nextProfiles
  });
}

export function getStoredCompanyProfile(companySlug: string) {
  return getStoredCompanyProfiles().find((profile) => profile.companySlug === companySlug);
}

export function upsertStoredCompanyProfile(profile: StoredCompanyAgentProfile) {
  const payload = readVaultPayload();
  const nextProfiles = payload.companyProfiles.filter((entry) => entry.companySlug !== profile.companySlug);

  nextProfiles.push(profile);
  writeVaultPayload({
    ...payload,
    companyProfiles: nextProfiles
  });
}

export function getStoredCompanyStrategies() {
  return readVaultPayload().companyStrategies;
}

export function getStoredCompanyStrategy(companySlug: string) {
  return getStoredCompanyStrategies().find((strategy) => strategy.companySlug === companySlug);
}

export function upsertStoredCompanyStrategy(strategy: StoredCompanyStrategicPlan) {
  const payload = readVaultPayload();
  const nextStrategies = payload.companyStrategies.filter((entry) => entry.companySlug !== strategy.companySlug);

  nextStrategies.push(strategy);
  writeVaultPayload({
    ...payload,
    companyStrategies: nextStrategies
  });
}

export function getStoredCompanyReports(companySlug?: string) {
  const reports = readVaultPayload().companyReports;
  return companySlug ? reports.filter((report) => report.companySlug === companySlug) : reports;
}

export function appendStoredCompanyReport(report: StoredCompanyGeneratedReport) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companyReports: [report, ...payload.companyReports].slice(0, 200)
  });
}

export function getStoredMetricSnapshots(companyId?: string) {
  const snapshots = readVaultPayload().metricSnapshots;
  return companyId ? snapshots.filter((snapshot) => snapshot.companyId === companyId) : snapshots;
}

export function replaceStoredMetricSnapshots(companyId: string, snapshots: StoredMetricSnapshot[]) {
  const payload = readVaultPayload();
  const nextSnapshots = [
    ...snapshots,
    ...payload.metricSnapshots.filter((entry) => entry.companyId !== companyId)
  ].slice(0, 360);

  writeVaultPayload({
    ...payload,
    metricSnapshots: nextSnapshots
  });
}

export function getStoredCompanyAgentLearnings(companySlug?: string) {
  const learnings = readVaultPayload().companyAgentLearnings;
  return companySlug ? learnings.filter((learning) => learning.companySlug === companySlug) : learnings;
}

export function replaceStoredCompanyAgentLearnings(
  companySlug: string,
  learnings: StoredCompanyAgentLearning[]
) {
  const payload = readVaultPayload();
  const nextLearnings = [
    ...learnings,
    ...payload.companyAgentLearnings.filter((entry) => entry.companySlug !== companySlug)
  ].slice(0, 240);

  writeVaultPayload({
    ...payload,
    companyAgentLearnings: nextLearnings
  });
}

export function getStoredCompanyExecutionPlans(companySlug?: string) {
  const plans = readVaultPayload().companyExecutionPlans;
  return companySlug ? plans.filter((plan) => plan.companySlug === companySlug) : plans;
}

export function appendStoredCompanyExecutionPlan(plan: StoredCompanyExecutionPlan) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    companyExecutionPlans: [plan, ...payload.companyExecutionPlans].slice(0, 120)
  });
}

export function getStoredCompanyCrmProfile(companySlug: string) {
  return readVaultPayload().companyCrmProfiles.find((profile) => profile.companySlug === companySlug);
}

export function upsertStoredCompanyCrmProfile(profile: StoredCompanyCrmProfile) {
  const payload = readVaultPayload();
  const nextProfiles = payload.companyCrmProfiles.filter((entry) => entry.companySlug !== profile.companySlug);

  nextProfiles.push(profile);
  writeVaultPayload({
    ...payload,
    companyCrmProfiles: nextProfiles
  });
}

export function getStoredCompanySiteOpsProfile(companySlug: string) {
  return readVaultPayload().companySiteOpsProfiles.find((profile) => profile.companySlug === companySlug);
}

export function upsertStoredCompanySiteOpsProfile(profile: StoredCompanySiteOpsProfile) {
  const payload = readVaultPayload();
  const nextProfiles = payload.companySiteOpsProfiles.filter((entry) => entry.companySlug !== profile.companySlug);

  nextProfiles.push(profile);
  writeVaultPayload({
    ...payload,
    companySiteOpsProfiles: nextProfiles
  });
}

export function getStoredCompanyLeads(companySlug?: string) {
  const leads = readVaultPayload().companyLeads;
  return companySlug ? leads.filter((lead) => lead.companySlug === companySlug) : leads;
}

export function upsertStoredCompanyLead(lead: StoredCompanyLead) {
  const payload = readVaultPayload();
  const nextLeads = payload.companyLeads.filter((entry) => entry.id !== lead.id);

  nextLeads.push(lead);
  writeVaultPayload({
    ...payload,
    companyLeads: nextLeads.sort((left, right) => right.lastTouchedAt.localeCompare(left.lastTouchedAt)).slice(0, 500)
  });
}

export function getStoredCompanyConversionEvents(companySlug?: string) {
  const events = readVaultPayload().companyConversionEvents;
  return companySlug ? events.filter((event) => event.companySlug === companySlug) : events;
}

export function upsertStoredCompanyConversionEvent(event: CompanyConversionEvent) {
  const payload = readVaultPayload();
  const nextEvents = payload.companyConversionEvents.filter((entry) => entry.id !== event.id);

  nextEvents.push(event);
  writeVaultPayload({
    ...payload,
    companyConversionEvents: nextEvents
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 800)
  });
}

export function getStoredCompanyOperationalAlerts(companySlug?: string) {
  const alerts = readVaultPayload().companyOperationalAlerts;
  return companySlug ? alerts.filter((alert) => alert.companySlug === companySlug) : alerts;
}

export function upsertStoredCompanyOperationalAlert(alert: StoredCompanyOperationalAlert) {
  const payload = readVaultPayload();
  const nextAlerts = payload.companyOperationalAlerts.filter((entry) => entry.id !== alert.id);

  nextAlerts.push(alert);
  writeVaultPayload({
    ...payload,
    companyOperationalAlerts: nextAlerts
  });
}

export function replaceStoredCompanyOperationalAlerts(
  companySlug: string,
  alerts: StoredCompanyOperationalAlert[]
) {
  const payload = readVaultPayload();
  const nextAlerts = [
    ...alerts,
    ...payload.companyOperationalAlerts.filter((entry) => entry.companySlug !== companySlug)
  ].slice(0, 240);

  writeVaultPayload({
    ...payload,
    companyOperationalAlerts: nextAlerts
  });
}

export function getStoredCompanyKeywordStrategies() {
  return readVaultPayload().companyKeywordStrategies;
}

export function getStoredCompanyKeywordStrategy(companySlug: string) {
  return getStoredCompanyKeywordStrategies().find((strategy) => strategy.companySlug === companySlug);
}

export function upsertStoredCompanyKeywordStrategy(strategy: StoredCompanyKeywordStrategy) {
  const payload = readVaultPayload();
  const nextStrategies = payload.companyKeywordStrategies.filter((entry) => entry.companySlug !== strategy.companySlug);

  nextStrategies.push(strategy);
  writeVaultPayload({
    ...payload,
    companyKeywordStrategies: nextStrategies
  });
}

export function getStoredCompanyPaymentProfile(companySlug: string) {
  return readVaultPayload().companyPaymentProfiles.find((profile) => profile.companySlug === companySlug);
}

export function upsertStoredCompanyPaymentProfile(profile: StoredCompanyPaymentProfile) {
  const payload = readVaultPayload();
  const nextProfiles = payload.companyPaymentProfiles.filter((entry) => entry.companySlug !== profile.companySlug);

  nextProfiles.push(profile);
  writeVaultPayload({
    ...payload,
    companyPaymentProfiles: nextProfiles
  });
}

export function getStoredCompanyCreativeAssets(companySlug?: string) {
  const assets = readVaultPayload().companyCreativeAssets;
  return companySlug ? assets.filter((asset) => asset.companySlug === companySlug) : assets;
}

export function upsertStoredCompanyCreativeAsset(asset: StoredCompanyCreativeAsset) {
  const payload = readVaultPayload();
  const nextAssets = payload.companyCreativeAssets.filter((entry) => entry.id !== asset.id);

  nextAssets.push(asset);
  writeVaultPayload({
    ...payload,
    companyCreativeAssets: nextAssets
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 400)
  });
}

export function getStoredCreativeToolConnections(companySlug?: string) {
  const connections = readVaultPayload().creativeToolConnections;
  return companySlug ? connections.filter((connection) => connection.companySlug === companySlug) : connections;
}

export function upsertStoredCreativeToolConnection(connection: StoredCreativeToolConnection) {
  const payload = readVaultPayload();
  const nextConnections = payload.creativeToolConnections.filter(
    (entry) => !(entry.companySlug === connection.companySlug && entry.provider === connection.provider)
  );

  nextConnections.push(connection);
  writeVaultPayload({
    ...payload,
    creativeToolConnections: nextConnections
  });
}

export function getStoredPaymentApprovalRequests(companySlug?: string) {
  const requests = readVaultPayload().paymentApprovalRequests;
  return companySlug ? requests.filter((request) => request.companySlug === companySlug) : requests;
}

export function upsertStoredPaymentApprovalRequest(request: StoredPaymentApprovalRequest) {
  const payload = readVaultPayload();
  const nextRequests = payload.paymentApprovalRequests.filter((entry) => entry.id !== request.id);

  nextRequests.push(request);
  writeVaultPayload({
    ...payload,
    paymentApprovalRequests: nextRequests
  });
}

export function getStoredPublishingApprovalRequests(companySlug?: string) {
  const requests = readVaultPayload().publishingApprovalRequests;
  return companySlug ? requests.filter((request) => request.companySlug === companySlug) : requests;
}

export function upsertStoredPublishingApprovalRequest(request: StoredPublishingApprovalRequest) {
  const payload = readVaultPayload();
  const nextRequests = payload.publishingApprovalRequests.filter((entry) => entry.id !== request.id);

  nextRequests.push(request);
  writeVaultPayload({
    ...payload,
    publishingApprovalRequests: nextRequests
  });
}

export function getStoredTechnicalRequests(companySlug?: string) {
  const requests = readVaultPayload().technicalRequests;
  return companySlug ? requests.filter((request) => request.companySlug === companySlug) : requests;
}

export function upsertStoredTechnicalRequest(request: StoredTechnicalRequest) {
  const payload = readVaultPayload();
  const nextRequests = payload.technicalRequests.filter((entry) => entry.id !== request.id);

  nextRequests.push(request);
  writeVaultPayload({
    ...payload,
    technicalRequests: nextRequests
  });
}

export function getStoredAuditEvents(companySlug?: string) {
  const events = readVaultPayload().auditEvents;
  return companySlug
    ? events.filter((event) => event.id.includes(`audit-${companySlug}-`) || event.details.includes(companySlug))
    : events;
}

export function appendStoredAuditEvent(event: ConnectorAuditEvent) {
  const payload = readVaultPayload();
  writeVaultPayload({
    ...payload,
    auditEvents: [event, ...payload.auditEvents]
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
      .slice(0, 800)
  });
}
