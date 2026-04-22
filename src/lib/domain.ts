export type PlatformId =
  | "ga4"
  | "google-sheets"
  | "search-console"
  | "google-ads"
  | "meta"
  | "business-profile"
  | "gmail"
  | "youtube";

export type ConnectionStatus = "ready" | "missing_credentials" | "planned";
export type HealthState = "healthy" | "warning" | "critical";
export type WorkspaceStage = "onboarding" | "active" | "stabilizing";
export type CompanyConnectionStatus = "connected" | "action_required" | "not_connected";
export type AuthStrategy = "oauth" | "token" | "service_account";
export type ProfileTrainingStatus = "seeded" | "customized";
export type ReportType = "daily_competitor" | "weekly_marketing";
export type PaymentProvider = "stripe";
export type PaymentProfileStatus = "not_configured" | "ready" | "approval_required";
export type PaymentApprovalStatus = "pending" | "approved" | "denied" | "executed";
export type CreativeToolProvider =
  | "openai-api"
  | "gemini"
  | "claude"
  | "runway"
  | "canva"
  | "photoshop-api"
  | "adobe-express"
  | "premiere-pro"
  | "after-effects"
  | "lightroom"
  | "capcut"
  | "figma"
  | "google-vids"
  | "youtube"
  | "google-drive";
export type CreativeToolStatus = "connected" | "action_required" | "planned";
export type CreativeAutomationMode = "create_autonomously" | "publish_requires_approval" | "manual_only";
export type PublishingApprovalStatus = "pending" | "approved" | "rejected" | "posted";
export type ExecutionApprovalMode = "auto_low_risk" | "operator_approval" | "policy_review";
export type ExecutionTrackPriority = "critical" | "high" | "medium" | "low";
export type ExecutionPlanOrigin = "manual" | "scheduler";
export type ExecutionTrack = PlatformId | "content" | "seo" | "strategy" | "operations";
export type CodeWorkspaceStatus = "connected" | "planned" | "attention_needed";
export type CodeWorkspaceAccess = "read" | "write";
export type TechnicalRequestStatus = "backlog" | "investigating" | "solution_ready" | "resolved";
export type TechnicalRequestPriority = "low" | "medium" | "high";
export type LeadSource =
  | "site_form"
  | "landing_page"
  | "whatsapp"
  | "meta_ads"
  | "google_ads"
  | "organic"
  | "manual"
  | "crm_import";
export type LeadStage = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";
export type LeadConsentStatus = "granted" | "unknown" | "denied";
export type CrmProvider = "none" | "hubspot" | "rd-station" | "activecampaign" | "mailchimp" | "klaviyo";
export type CrmSyncMode = "manual_review" | "scheduler_sync" | "push_on_capture";
export type CrmLeadSyncStatus = "local_only" | "pending_sync" | "synced" | "sync_error";
export type LeadRouteBucket = "sales" | "nurture" | "vip" | "reactivation";
export type LeadCadenceState = "idle" | "active" | "paused" | "completed";
export type LeadCadenceTrack = "inbound_fast_follow" | "nurture" | "proposal_followup" | "reactivation";
export type SiteCaptureMode = "disabled" | "server_secret" | "allowlisted_browser";
export type SiteOpsStatus = "seeded" | "customized" | "connected";
export type SiteCmsProvider = "none" | "wordpress" | "custom";
export type SiteCmsConnectionStatus = "not_connected" | "connected" | "action_required";
export type ConversionDestination = "ga4" | "meta_capi" | "google_ads";
export type ConversionDispatchStatus = "queued" | "sent" | "blocked" | "failed";
export type OptimizationHealth = "winning" | "learning" | "at_risk" | "wasteful";
export type OptimizationDecision = "scale" | "hold" | "fix" | "pause";
export type OptimizationExperimentStatus = "planned" | "running" | "won" | "lost";
export type CreativeAssetVersionStatus = "draft" | "ready_for_approval" | "approved" | "published";
export type CreativeQaStatus = "passed" | "warning" | "blocked";

export type CanonicalAccount = {
  id: string;
  platform: PlatformId;
  name: string;
  timezone: string;
  currency?: string;
  accessLevel: "read" | "write" | "mixed";
};

export type CanonicalCampaign = {
  id: string;
  accountId: string;
  platform: PlatformId;
  name: string;
  objective: string;
  status: "active" | "paused" | "draft";
  dailyBudget?: number;
};

export type MetricSnapshot = {
  companyId?: string;
  companyName?: string;
  platform: PlatformId;
  window: "24h" | "7d" | "28d";
  spend?: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  revenue?: number;
  ctr?: number;
  cpa?: number;
  capturedAt?: string;
  source?: "seed" | "google_data_sync";
  notes: string[];
};

export type ConnectorAuditEvent = {
  id: string;
  timestamp: string;
  connector: PlatformId | "system";
  kind: "info" | "warning" | "decision";
  title: string;
  details: string;
};

export type ConnectorOverview = {
  connector: PlatformId;
  label: string;
  status: ConnectionStatus;
  health: HealthState;
  access: "read" | "write" | "mixed";
  requiredEnv: string[];
  configuredEnv: string[];
  summary: string;
  nextAction: string;
};

export type CompanyProfile = {
  id: string;
  slug: string;
  name: string;
  sector: string;
  region: string;
  timezone: string;
  primaryGoal: string;
};

export type CompanyConnection = {
  id: string;
  platform: PlatformId;
  label: string;
  status: CompanyConnectionStatus;
  auth: AuthStrategy;
  scopes: string[];
  accountLabels: string[];
  lastSync?: string;
  vaultNamespace: string;
  nextAction: string;
};

export type CompanyAgentProfile = {
  companySlug: string;
  companyName: string;
  trainingStatus: ProfileTrainingStatus;
  updatedAt: string;
  businessSummary: string;
  brandVoice: string;
  idealCustomerProfile: string;
  offerStrategy: string;
  differentiators: string[];
  approvedChannels: PlatformId[];
  contentPillars: string[];
  geoFocus: string[];
  conversionEvents: string[];
  efficiencyRules: string[];
  forbiddenClaims: string[];
  operatorNotes: string;
  systemPrompt: string;
};

export type UserProfessionalProfile = {
  userKey: string;
  email: string;
  displayName: string;
  trainingStatus: ProfileTrainingStatus;
  updatedAt: string;
  professionalTitle: string;
  businessModel: string;
  strategicNorthStar: string;
  decisionStyle: string;
  planningCadence: string;
  costDiscipline: string;
  expertiseAreas: string[];
  preferredChannels: PlatformId[];
  targetSectors: string[];
  clientSelectionRules: string[];
  approvalPreferences: string[];
  growthLevers: string[];
  learnedPatterns: string[];
  noGoRules: string[];
  strategicNotes: string;
  systemPrompt: string;
};

export type CompanyCompetitor = {
  name: string;
  positioning: string;
  strengths: string[];
  weaknesses: string[];
  observedChannels: PlatformId[];
  offers: string[];
  notes: string;
};

export type CompanyStrategicPlan = {
  companySlug: string;
  status: "seeded" | "customized";
  updatedAt: string;
  planningHorizon: string;
  primaryObjective: string;
  secondaryObjective: string;
  monthlyBudget: string;
  reachGoal: string;
  leadGoal: string;
  revenueGoal: string;
  cpaTarget: string;
  roasTarget: string;
  priorityChannels: PlatformId[];
  priorityMarkets: string[];
  strategicInitiatives: string[];
  dailyRituals: string[];
  weeklyRituals: string[];
  risksToWatch: string[];
  userAlignmentNotes: string;
  competitors: CompanyCompetitor[];
};

export type CompanyDataOpsProfile = {
  companySlug: string;
  status: "seeded" | "customized";
  updatedAt: string;
  reportingCadence: string;
  analyticsObjective: string;
  sheetsWorkspaceName: string;
  ga4PropertyId: string;
  searchConsoleSiteUrl: string;
  sheetsSpreadsheetId: string;
  sheetsOverviewRange: string;
  primaryKpis: string[];
  sheetAutomations: string[];
  approvedWriteActions: string[];
  autonomyRule: string;
  systemNotes: string;
  lastSyncedAt?: string;
  lastSyncSummary?: string;
};

export type CompanyGeneratedReport = {
  id: string;
  companySlug: string;
  companyName: string;
  type: ReportType;
  generatedAt: string;
  title: string;
  summary: string;
  highlights: string[];
  risks: string[];
  actions: string[];
  metrics: Array<{ label: string; value: string; context?: string }>;
  sections: Array<{ title: string; bullets: string[] }>;
};

export type CompanyExecutionTrack = {
  id: string;
  track: ExecutionTrack;
  title: string;
  objective: string;
  rationale: string;
  approvalMode: ExecutionApprovalMode;
  cadence: string;
  budgetImpact: string;
  successMetric: string;
  actions: string[];
  priority?: ExecutionTrackPriority;
  confidence?: number;
  trigger?: string;
  evidence?: string[];
};

export type ExecutionPlanActionKind =
  | "queue_due_social_posts"
  | "queue_social_sync"
  | "generate_weekly_report"
  | "review_approvals"
  | "resolve_channel_gap"
  | "resolve_runtime_blockers"
  | "resolve_conversion_dispatch"
  | "scale_winning_channel"
  | "hold_learning_channel"
  | "fix_underperforming_channel"
  | "pause_wasteful_channel"
  | "launch_ab_test";

export type ExecutionPlanActionStatus = "recommended" | "executed" | "blocked";
export type OperationalAlertType = "general" | "finance" | "runtime" | "approvals" | "connections" | "strategy";

export type CompanyExecutionAction = {
  id: string;
  kind: ExecutionPlanActionKind;
  title: string;
  detail: string;
  mode: ExecutionApprovalMode;
  priority: ExecutionTrackPriority;
  status: ExecutionPlanActionStatus;
  alertType: OperationalAlertType;
  outcome?: string;
  evidence?: string[];
  targetPlatform?: PlatformId | SocialPlatformId;
  sourceExperimentId?: string;
};

export type OperationalInboxState = "needs_review" | "needs_unblock" | "ready_to_run";

export type OperationalInboxItem = {
  id: string;
  companySlug: string;
  sourcePlanId: string;
  sourceActionId: string;
  sourceActionKind: ExecutionPlanActionKind;
  alertType: OperationalAlertType;
  title: string;
  summary: string;
  priority: ExecutionTrackPriority;
  mode: ExecutionApprovalMode;
  state: OperationalInboxState;
  openedAt: string;
  evidence?: string[];
  sourcePath: string;
  sourceLabel: string;
  outcome?: string;
};

export type OperationalAlertStatus = "open" | "acknowledged" | "resolved";
export type OperationalAlertChannel = "scheduler" | "email_ready";

export type CompanyOperationalAlert = {
  id: string;
  companySlug: string;
  sourcePlanId: string;
  sourceActionId: string;
  sourceActionKind: ExecutionPlanActionKind;
  alertType: OperationalAlertType;
  title: string;
  message: string;
  priority: ExecutionTrackPriority;
  status: OperationalAlertStatus;
  channels: OperationalAlertChannel[];
  createdAt: string;
  updatedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  sourcePath: string;
  sourceLabel: string;
  evidence?: string[];
  emailRecipient?: string;
  emailRecipients?: string[];
  emailDeliveredTo?: string[];
  emailAttemptedAt?: string;
  emailSentAt?: string;
  emailLastError?: string;
};

export type AgentLearningKind = "playbook" | "risk" | "warning" | "opportunity";
export type AgentLearningStatus = "fresh" | "active" | "historical";
export type AgentLearningSource =
  | "execution_plan"
  | "operational_alert"
  | "runtime_log"
  | "report"
  | "social_insight"
  | "conversion_event";

export type CompanyAgentLearning = {
  id: string;
  companySlug: string;
  kind: AgentLearningKind;
  status: AgentLearningStatus;
  priority: ExecutionTrackPriority;
  confidence: number;
  title: string;
  summary: string;
  recommendedAction?: string;
  evidence?: string[];
  sourceType: AgentLearningSource;
  sourcePath: string;
  sourceLabel: string;
  generatedAt: string;
  updatedAt: string;
  lastAppliedAt?: string;
};

export type CompanyExecutionPlan = {
  id: string;
  companySlug: string;
  companyName: string;
  generatedAt: string;
  title: string;
  summary: string;
  weeklyFocus: string[];
  launchChecklist: string[];
  approvalQueue: Array<{
    title: string;
    reason: string;
    mode: ExecutionApprovalMode;
  }>;
  operatorContext: string;
  origin?: ExecutionPlanOrigin;
  autopilotSummary?: string;
  decisionSignals?: Array<{
    label: string;
    value: string;
    context?: string;
  }>;
  learningHighlights?: Array<{
    title: string;
    summary: string;
    kind: AgentLearningKind;
    priority: ExecutionTrackPriority;
    confidence: number;
    sourcePath: string;
    sourceLabel: string;
  }>;
  optimizationScorecards?: CompanyOptimizationScorecard[];
  recommendedExperiments?: CompanyOptimizationExperiment[];
  recommendedActions?: CompanyExecutionAction[];
  tracks: CompanyExecutionTrack[];
};

export type CompanyKeywordStrategy = {
  companySlug: string;
  status: "seeded" | "customized";
  updatedAt: string;
  mainOffer: string;
  primaryKeywords: string[];
  longTailKeywords: string[];
  negativeKeywords: string[];
  conversionAngles: string[];
  landingMessages: string[];
  audienceSignals: string[];
  approvedDataSources: string[];
  blockedDataSources: string[];
  optimizationRules: string[];
  complianceNote: string;
};

export type CompanyLead = {
  id: string;
  companySlug: string;
  fullName: string;
  email?: string;
  phone?: string;
  source: LeadSource;
  channel: string;
  campaignName?: string;
  clientEventId?: string;
  routeBucket?: LeadRouteBucket;
  routeReason?: string;
  stage: LeadStage;
  score: number;
  owner: string;
  nextAction: string;
  nextFollowUpAt?: string;
  cadenceState?: LeadCadenceState;
  cadenceTrack?: LeadCadenceTrack;
  cadenceStep?: number;
  lastContactedAt?: string;
  revenuePotential?: number;
  opportunityValue?: number;
  revenueActual?: number;
  lifetimeValue?: number;
  lostReason?: string;
  consentStatus: LeadConsentStatus;
  notes: string[];
  capturedAt: string;
  lastTouchedAt: string;
  originPath?: string;
  pageUrl?: string;
  referrerUrl?: string;
  gaClientId?: string;
  userAgent?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  syncStatus: CrmLeadSyncStatus;
  externalCrmProvider?: Exclude<CrmProvider, "none">;
  externalCrmId?: string;
  syncError?: string;
  lastSyncedAt?: string;
};

export type CompanyConversionEvent = {
  id: string;
  companySlug: string;
  leadId: string;
  destination: ConversionDestination;
  eventName: string;
  leadStage: LeadStage;
  status: ConversionDispatchStatus;
  summary: string;
  detail: string;
  createdAt: string;
  updatedAt: string;
  lastAttemptAt?: string;
  sentAt?: string;
  externalRef?: string;
  dedupeKey?: string;
  value?: number;
  currency?: string;
  sourcePath?: string;
};

export type CompanyCrmProfile = {
  companySlug: string;
  provider: CrmProvider;
  status: "seeded" | "customized" | "connected" | "action_required";
  syncMode: CrmSyncMode;
  accountLabel?: string;
  portalId?: string;
  defaultOwner: string;
  salesOwner?: string;
  nurtureOwner?: string;
  vipOwner?: string;
  captureSecret?: string;
  routingMode?: "score_based" | "manual_only";
  retentionDays?: number;
  requireConsentForEmail?: boolean;
  requireConsentForAds?: boolean;
  lastSyncAt?: string;
  lastSyncSummary?: string;
  notes: string;
  updatedAt: string;
};

export type CompanySiteOpsProfile = {
  companySlug: string;
  status: SiteOpsStatus;
  primarySiteUrl: string;
  landingPageUrls: string[];
  captureMode: SiteCaptureMode;
  allowedOrigins: string[];
  trackingDomain: string;
  gtmContainerId: string;
  ga4MeasurementId: string;
  metaPixelId: string;
  googleAdsConversionId: string;
  googleAdsConversionLabel: string;
  conversionEventName: string;
  webhookTargets: string[];
  cmsProvider: SiteCmsProvider;
  cmsConnectionStatus: SiteCmsConnectionStatus;
  cmsSiteUrl: string;
  cmsUsername: string;
  cmsLastSyncAt?: string;
  cmsLastSyncSummary?: string;
  lastPublishedLandingTitle?: string;
  lastPublishedLandingUrl?: string;
  notes: string;
  updatedAt: string;
};

export type CompanyPaymentProfile = {
  companySlug: string;
  provider: PaymentProvider;
  status: PaymentProfileStatus;
  customerId?: string;
  paymentMethodId?: string;
  brand?: string;
  last4?: string;
  cardholderName?: string;
  defaultCurrency: string;
  spendCap: string;
  approvalRule: string;
  updatedAt: string;
};

export type PaymentApprovalRequest = {
  id: string;
  companySlug: string;
  provider: PaymentProvider;
  title: string;
  description: string;
  amount: string;
  currency: string;
  requestedAt: string;
  requestedBy: string;
  status: PaymentApprovalStatus;
  approvedAt?: string;
  deniedAt?: string;
  executedAt?: string;
  userApprovalRequired: true;
};

export type CreativeToolConnection = {
  id: string;
  companySlug: string;
  provider: CreativeToolProvider;
  label: string;
  status: CreativeToolStatus;
  automationMode: CreativeAutomationMode;
  accessMethod: "oauth" | "api_key" | "browser_assisted" | "manual_export";
  capabilities: string[];
  accountLabel: string;
  notes: string;
  lastValidatedAt?: string;
};

export type CompanyCreativeQaCheck = {
  id: string;
  label: string;
  status: CreativeQaStatus;
  detail: string;
};

export type CompanyCreativeAssetVersion = {
  id: string;
  createdAt: string;
  sourceTool: CreativeToolProvider;
  summary: string;
  generationPrompt?: string;
  variantLabel?: string;
  caption?: string;
  assetUrl?: string;
  assetUrls?: string[];
  landingUrl?: string;
  scheduledFor?: string;
  status: CreativeAssetVersionStatus;
  qaChecks: CompanyCreativeQaCheck[];
};

export type CompanyCreativeAsset = {
  id: string;
  companySlug: string;
  title: string;
  assetType: PublishingApprovalRequest["assetType"];
  origin?: "manual" | "generated" | "experiment";
  sourceExperimentId?: string;
  platformHint?: SocialPlatformId;
  destination: string;
  createdWith: CreativeToolProvider;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
  latestVersionId: string;
  summary: string;
  tags: string[];
  versions: CompanyCreativeAssetVersion[];
};

export type PublishingApprovalRequest = {
  id: string;
  companySlug: string;
  sourceAssetId?: string;
  sourceAssetVersionId?: string;
  title: string;
  assetType: "image" | "video" | "carousel" | "email" | "landing" | "post";
  destination: string;
  platformHint?: SocialPlatformId;
  createdWith: CreativeToolProvider;
  requestedAt: string;
  requestedBy: string;
  status: PublishingApprovalStatus;
  summary: string;
  caption?: string;
  assetUrl?: string;
  assetUrls?: string[];
  landingUrl?: string;
  scheduledFor?: string;
  userApprovalRequired: true;
  approvedAt?: string;
  rejectedAt?: string;
  postedAt?: string;
};

export type CompanyCodeWorkspace = {
  id: string;
  companySlug: string;
  label: string;
  path: string;
  stack: string;
  objective: string;
  status: CodeWorkspaceStatus;
  access: CodeWorkspaceAccess;
  notes: string;
};

export type TechnicalRequest = {
  id: string;
  companySlug: string;
  title: string;
  area: "site" | "automation" | "integration" | "performance" | "bug" | "analytics";
  priority: TechnicalRequestPriority;
  status: TechnicalRequestStatus;
  summary: string;
  expectedOutcome: string;
  agentPlan: string[];
  approvalsRequired: string[];
  createdAt: string;
};

export type DesktopAgentProfile = {
  status: "seeded" | "customized";
  updatedAt: string;
  accessMode: "full_desktop_guarded";
  approvedRoots: string[];
  outputRoots: string[];
  allowedApps: string[];
  autonomousActions: string[];
  approvalRequiredActions: string[];
  blockedActions: string[];
  runtimeNotes: string;
};

export type InternetIntelligenceProfile = {
  status: "seeded" | "customized";
  updatedAt: string;
  accessMode: "live_web_enabled";
  liveUpdateCadence: string;
  sourceTypes: string[];
  monitoredTopics: string[];
  allowedDomains: string[];
  blockedDomains: string[];
  autonomousResearchActions: string[];
  approvalRequiredActions: string[];
  runtimeNotes: string;
};

export type SocialPlatformId =
  | "instagram"
  | "facebook"
  | "google-ads"
  | "google-business"
  | "linkedin"
  | "tiktok"
  | "youtube";

export type SocialOpsStatus = "seeded" | "customized";
export type SocialPlatformConnectionStatus = "connected" | "action_required" | "planned";
export type ScheduledSocialPostStatus = "draft" | "pending_approval" | "scheduled" | "posted" | "rejected";
export type SocialAdDraftStatus = "draft" | "pending_approval" | "approved" | "launched" | "rejected";
export type SocialPlatformBindingStatus = "connected" | "needs_target" | "blocked";
export type SocialRuntimeTaskKind = "publish_post" | "launch_ad" | "sync_analytics";
export type SocialRuntimeTaskStatus = "queued" | "blocked" | "running" | "completed" | "failed";
export type SocialExecutionLogStatus = "running" | "blocked" | "completed" | "failed";
export type ApprovalCenterKind = "payment" | "publishing" | "social_post" | "social_ad";
export type ApprovalCenterAction =
  | "approve"
  | "deny"
  | "reject"
  | "mark-posted"
  | "launch"
  | "queue-runtime"
  | "create-social-post";
export type SchedulerProfileStatus = "seeded" | "customized";
export type SchedulerCadence = "hourly" | "daily" | "weekly" | "business_days";
export type SchedulerJobStatus = "active" | "paused";
export type SchedulerJobCategory = "approvals" | "reporting" | "social" | "seo" | "ads" | "crm" | "operations";
export type SchedulerJobAutonomy = "advisory" | "auto_low_risk" | "approval_required";

export type CompanySocialOpsProfile = {
  companySlug: string;
  status: SocialOpsStatus;
  updatedAt: string;
  primaryObjective: string;
  publishingCadence: string;
  autonomyRule: string;
  approvalRule: string;
  schedulingPolicy: string;
  analyticsRoutine: string;
  priorityPlatforms: SocialPlatformId[];
  contentPillars: string[];
  adObjectives: string[];
  audienceNotes: string[];
};

export type CompanyOptimizationScorecard = {
  id: string;
  channel: string;
  platform?: PlatformId | SocialPlatformId;
  window: "7d" | "28d";
  health: OptimizationHealth;
  decision: OptimizationDecision;
  score: number;
  spend?: number;
  conversions?: number;
  revenue?: number;
  cpa?: number;
  ctr?: number;
  conversionSignalsSent: number;
  conversionSignalsBlocked: number;
  conversionSignalsFailed: number;
  rationale: string;
  evidence: string[];
};

export type CompanyOptimizationExperiment = {
  id: string;
  title: string;
  channel: string;
  hypothesis: string;
  primaryMetric: string;
  variants: string[];
  status: OptimizationExperimentStatus;
  nextAction: string;
};

export type SocialPlatformConnection = {
  id: string;
  companySlug: string;
  platform: SocialPlatformId;
  label: string;
  status: SocialPlatformConnectionStatus;
  publishingMode: "api_ready" | "browser_assisted" | "playbook";
  analyticsMode: "api_ready" | "manual_review" | "mixed";
  capabilities: string[];
  accountLabel: string;
  nextAction: string;
};

export type SocialAdLaunchState = {
  platform: "meta" | "google-ads";
  campaignId?: string;
  adSetId?: string;
  adId?: string;
  creativeId?: string;
  imageHash?: string;
  budgetId?: string;
  adGroupId?: string;
  adGroupAdId?: string;
  assetResourceNames?: string[];
  keywordResourceNames?: string[];
  updatedAt: string;
};

export type ScheduledSocialPost = {
  id: string;
  companySlug: string;
  platform: SocialPlatformId;
  title: string;
  format: "image" | "video" | "carousel" | "story" | "reel" | "short";
  scheduledFor: string;
  createdWith: CreativeToolProvider;
  summary: string;
  caption?: string;
  assetUrl?: string;
  assetUrls?: string[];
  landingUrl?: string;
  sourceApprovalRequestId?: string;
  sourceAssetId?: string;
  sourceAssetVersionId?: string;
  sourceExperimentId?: string;
  variantLabel?: string;
  status: ScheduledSocialPostStatus;
  requestedBy: string;
  requiresApproval: true;
  approvedAt?: string;
  postedAt?: string;
  rejectedAt?: string;
};

export type SocialAdDraft = {
  id: string;
  companySlug: string;
  platform: SocialPlatformId;
  title: string;
  objective: string;
  budget: string;
  audience: string;
  creativeAngle: string;
  callToAction: string;
  headline?: string;
  description?: string;
  assetUrl?: string;
  assetUrls?: string[];
  landingUrl?: string;
  keywordThemes?: string[];
  sourceAssetId?: string;
  sourceAssetVersionId?: string;
  sourceExperimentId?: string;
  variantLabel?: string;
  scheduledStart: string;
  status: SocialAdDraftStatus;
  requestedBy: string;
  requiresApproval: true;
  approvedAt?: string;
  launchedAt?: string;
  rejectedAt?: string;
  launchState?: SocialAdLaunchState;
};

export type SocialInsightSnapshot = {
  companySlug: string;
  platform: SocialPlatformId;
  window: "7d" | "28d";
  followers: string;
  reach: string;
  engagementRate: string;
  clicks: string;
  conversions?: string;
  note: string;
};

export type SocialPlatformBinding = {
  id: string;
  companySlug: string;
  platform: SocialPlatformId;
  targetType: "page" | "organization" | "business_account" | "location" | "channel" | "customer";
  targetLabel: string;
  targetId?: string;
  analyticsTargetId?: string;
  status: SocialPlatformBindingStatus;
  publishingReady: boolean;
  analyticsReady: boolean;
  paidMediaReady: boolean;
  adAccountId?: string;
  campaignLabel?: string;
  campaignId?: string;
  adSetId?: string;
  adGroupId?: string;
  pageId?: string;
  instagramActorId?: string;
  pixelId?: string;
  conversionEvent?: string;
  managerAccountId?: string;
  dailyBudgetCap?: string;
  requirements: string[];
  note: string;
  updatedAt: string;
};

export type SocialRuntimeTask = {
  id: string;
  companySlug: string;
  platform: SocialPlatformId;
  kind: SocialRuntimeTaskKind;
  status: SocialRuntimeTaskStatus;
  title: string;
  reason: string;
  requestedBy: string;
  createdAt: string;
  sourceItemId?: string;
  targetId?: string;
  sourceExperimentId?: string;
  variantLabel?: string;
  attemptCount: number;
  lastAttemptAt?: string;
  lastResult?: string;
  externalRef?: string;
  completedAt?: string;
};

export type SocialExecutionMetric = {
  label: string;
  value: string;
};

export type SocialExecutionLog = {
  id: string;
  companySlug: string;
  taskId: string;
  platform: SocialPlatformId;
  kind: SocialRuntimeTaskKind;
  status: SocialExecutionLogStatus;
  summary: string;
  detail: string;
  startedAt: string;
  finishedAt?: string;
  actor: string;
  externalRef?: string;
  sourceExperimentId?: string;
  variantLabel?: string;
  metrics: SocialExecutionMetric[];
};

export type CompanySocialRuntime = {
  companySlug: string;
  connectedPlatforms: number;
  publishReadyPlatforms: number;
  analyticsReadyPlatforms: number;
  adLaunchReadyPlatforms: number;
  queuedTasks: number;
  runningTasks: number;
  blockedTasks: number;
  failedTasks: number;
  completedTasks: number;
  nextPriority: string;
};

export type ApprovalCenterItem = {
  id: string;
  companySlug: string;
  kind: ApprovalCenterKind;
  status: PaymentApprovalStatus | PublishingApprovalStatus | ScheduledSocialPostStatus | SocialAdDraftStatus;
  title: string;
  requestedAt: string;
  requestedBy: string;
  summary: string;
  context: string;
  sourcePath: string;
  actions: ApprovalCenterAction[];
};

export type CompanySchedulerProfile = {
  companySlug: string;
  status: SchedulerProfileStatus;
  timezone: string;
  quietHours: string;
  approvalDigestTime: string;
  incidentWatch: string;
  schedulerAlertMinimumPriority: ExecutionTrackPriority;
  emailAlertMinimumPriority: ExecutionTrackPriority;
  alertRecipients: string[];
  financeAlertRecipients: string[];
  runtimeAlertRecipients: string[];
  strategyAlertRecipients: string[];
  approvalAlertRecipients: string[];
  connectionAlertRecipients: string[];
  weekStartsOn: string;
  notes: string;
  updatedAt: string;
};

export type CompanySchedulerJob = {
  id: string;
  companySlug: string;
  label: string;
  category: SchedulerJobCategory;
  cadence: SchedulerCadence;
  status: SchedulerJobStatus;
  autonomy: SchedulerJobAutonomy;
  objective: string;
  actionSummary: string;
  nextRunAt: string;
  lastRunAt?: string;
  lastResult?: string;
};

export type CompanyWorkspace = {
  company: CompanyProfile;
  stage: WorkspaceStage;
  agentMode: "assistido" | "semi-autonomo" | "autonomo";
  summary: string;
  nextActions: string[];
  agentProfile: CompanyAgentProfile;
  strategyPlan: CompanyStrategicPlan;
  dataOpsProfile: CompanyDataOpsProfile;
  keywordStrategy: CompanyKeywordStrategy;
  socialProfile: CompanySocialOpsProfile;
  socialPlatforms: SocialPlatformConnection[];
  scheduledPosts: ScheduledSocialPost[];
  socialAdDrafts: SocialAdDraft[];
  socialInsights: SocialInsightSnapshot[];
  socialBindings: SocialPlatformBinding[];
  socialRuntime: CompanySocialRuntime;
  socialRuntimeTasks: SocialRuntimeTask[];
  socialExecutionLogs: SocialExecutionLog[];
  approvalsCenter: ApprovalCenterItem[];
  operationalInbox: OperationalInboxItem[];
  operationalAlerts: CompanyOperationalAlert[];
  agentLearnings: CompanyAgentLearning[];
  schedulerProfile: CompanySchedulerProfile;
  schedulerJobs: CompanySchedulerJob[];
  paymentProfile: CompanyPaymentProfile;
  paymentRequests: PaymentApprovalRequest[];
  creativeTools: CreativeToolConnection[];
  creativeAssets: CompanyCreativeAsset[];
  publishingRequests: PublishingApprovalRequest[];
  crmProfile: CompanyCrmProfile;
  siteOpsProfile: CompanySiteOpsProfile;
  leads: CompanyLead[];
  conversionEvents: CompanyConversionEvent[];
  engineeringWorkspaces: CompanyCodeWorkspace[];
  technicalRequests: TechnicalRequest[];
  accounts: CanonicalAccount[];
  connections: CompanyConnection[];
  snapshots: MetricSnapshot[];
  reports: CompanyGeneratedReport[];
  executionPlans: CompanyExecutionPlan[];
  audit: ConnectorAuditEvent[];
};

export type ControlTowerSummary = {
  companies: number;
  connectedPlatforms: number;
  isolatedWorkspaces: number;
  companiesReadyForOps: number;
  companiesWithActionRequired: number;
  customizedProfiles: number;
  generatedReports: number;
  pendingUnifiedApprovals: number;
  pendingPaymentApprovals: number;
  pendingPublishingApprovals: number;
  openTechnicalRequests: number;
};
