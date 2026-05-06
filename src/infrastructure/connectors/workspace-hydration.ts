import { buildWorkspaceAutomationRuntimeHealth } from "@/lib/agents/runtime";
import { buildOperationalInbox } from "@/lib/execution";
import { getPersistedAuditEvents } from "@/infrastructure/persistence/company-automation-storage";
import { getPersistedGoogleCompanyConnection } from "@/infrastructure/persistence/company-connection-storage";
import type {
  CanonicalAccount,
  CompanyConnection,
  CompanyWorkspace,
  ConnectorAuditEvent,
  MetricSnapshot,
  UserProfessionalProfile
} from "@/lib/domain";
import { isGoogleManagedPlatform } from "@/lib/google-connections";

export type WorkspaceSeedHydration = {
  company: CompanyWorkspace["company"];
  stage: CompanyWorkspace["stage"];
  agentMode: CompanyWorkspace["agentMode"];
  summary: string;
  nextActions: string[];
  accounts: CanonicalAccount[];
  connections: CompanyConnection[];
  snapshots: MetricSnapshot[];
  audit: ConnectorAuditEvent[];
};

export type WorkspaceHydrationDependencies = {
  professionalProfile?: UserProfessionalProfile | null;
  socialPlatforms: CompanyWorkspace["socialPlatforms"];
  scheduledPosts: CompanyWorkspace["scheduledPosts"];
  socialAdDrafts: CompanyWorkspace["socialAdDrafts"];
  socialBindings: CompanyWorkspace["socialBindings"];
  socialRuntimeTasks: CompanyWorkspace["socialRuntimeTasks"];
  paymentRequests: CompanyWorkspace["paymentRequests"];
  publishingRequests: CompanyWorkspace["publishingRequests"];
  approvalsCenter: CompanyWorkspace["approvalsCenter"];
  schedulerProfile: CompanyWorkspace["schedulerProfile"];
  schedulerJobs: CompanyWorkspace["schedulerJobs"];
  executionPlans: CompanyWorkspace["executionPlans"];
  operationalAlerts: CompanyWorkspace["operationalAlerts"];
  agentLearnings: CompanyWorkspace["agentLearnings"];
  experimentOutcomes: CompanyWorkspace["experimentOutcomes"];
  learningPlaybooks: CompanyWorkspace["learningPlaybooks"];
  sharedLearningPlaybooks: NonNullable<CompanyWorkspace["sharedLearningPlaybooks"]>;
  paymentProfile: CompanyWorkspace["paymentProfile"];
  creativeTools: CompanyWorkspace["creativeTools"];
  creativeAssets: CompanyWorkspace["creativeAssets"];
  crmProfile: CompanyWorkspace["crmProfile"];
  siteOpsProfile: CompanyWorkspace["siteOpsProfile"];
  leads: CompanyWorkspace["leads"];
  conversionEvents: CompanyWorkspace["conversionEvents"];
  engineeringWorkspaces: CompanyWorkspace["engineeringWorkspaces"];
  technicalRequests: CompanyWorkspace["technicalRequests"];
  socialInsights: CompanyWorkspace["socialInsights"];
  socialProfile: CompanyWorkspace["socialProfile"];
  socialRuntime: CompanyWorkspace["socialRuntime"];
  socialExecutionLogs: CompanyWorkspace["socialExecutionLogs"];
  reports: CompanyWorkspace["reports"];
  automationRuns: CompanyWorkspace["automationRuns"];
  automationQueue: CompanyWorkspace["automationQueue"];
  automationDeadLetters: CompanyWorkspace["automationDeadLetters"];
  executionIntents: CompanyWorkspace["executionIntents"];
  connectorCircuitBreakers: CompanyWorkspace["connectorCircuitBreakers"];
  agentProfile: CompanyWorkspace["agentProfile"];
  strategyPlan: CompanyWorkspace["strategyPlan"];
  dataOpsProfile: CompanyWorkspace["dataOpsProfile"];
  keywordStrategy: CompanyWorkspace["keywordStrategy"];
  snapshots: MetricSnapshot[];
};

export function buildHydratedCompanyWorkspace(
  seed: WorkspaceSeedHydration,
  dependencies: WorkspaceHydrationDependencies
): CompanyWorkspace {
  const hydratedWorkspace = {
    company: seed.company,
    stage: seed.stage,
    agentMode: seed.agentMode,
    summary: seed.summary,
    nextActions: seed.nextActions,
    agentProfile: dependencies.agentProfile,
    strategyPlan: dependencies.strategyPlan,
    dataOpsProfile: dependencies.dataOpsProfile,
    keywordStrategy: dependencies.keywordStrategy,
    socialProfile: dependencies.socialProfile,
    socialPlatforms: dependencies.socialPlatforms,
    scheduledPosts: dependencies.scheduledPosts,
    socialAdDrafts: dependencies.socialAdDrafts,
    socialInsights: dependencies.socialInsights,
    socialBindings: dependencies.socialBindings,
    socialRuntime: dependencies.socialRuntime,
    socialRuntimeTasks: dependencies.socialRuntimeTasks,
    socialExecutionLogs: dependencies.socialExecutionLogs,
    approvalsCenter: dependencies.approvalsCenter,
    schedulerProfile: dependencies.schedulerProfile,
    schedulerJobs: dependencies.schedulerJobs,
    operationalAlerts: dependencies.operationalAlerts,
    agentLearnings: dependencies.agentLearnings,
    experimentOutcomes: dependencies.experimentOutcomes,
    learningPlaybooks: dependencies.learningPlaybooks,
    sharedLearningPlaybooks: dependencies.sharedLearningPlaybooks,
    paymentProfile: dependencies.paymentProfile,
    paymentRequests: dependencies.paymentRequests,
    creativeTools: dependencies.creativeTools,
    creativeAssets: dependencies.creativeAssets,
    publishingRequests: dependencies.publishingRequests,
    crmProfile: dependencies.crmProfile,
    siteOpsProfile: dependencies.siteOpsProfile,
    leads: dependencies.leads,
    conversionEvents: dependencies.conversionEvents,
    engineeringWorkspaces: dependencies.engineeringWorkspaces,
    technicalRequests: dependencies.technicalRequests,
    accounts: seed.accounts,
    connections: seed.connections.map((connection) => hydrateWorkspaceConnection(seed.company.slug, connection)),
    snapshots: dependencies.snapshots,
    reports: dependencies.reports,
    executionPlans: dependencies.executionPlans,
    automationRuns: dependencies.automationRuns,
    automationQueue: dependencies.automationQueue,
    automationDeadLetters: dependencies.automationDeadLetters,
    executionIntents: dependencies.executionIntents,
    connectorCircuitBreakers: dependencies.connectorCircuitBreakers,
    audit: hydrateWorkspaceAudit(seed.company.slug, seed.audit)
  };

  return {
    ...hydratedWorkspace,
    automationRuntimeHealth: buildWorkspaceAutomationRuntimeHealth(hydratedWorkspace),
    operationalInbox: buildOperationalInbox(hydratedWorkspace)
  };
}

export function hydrateWorkspaceConnection(companySlug: string, connection: CompanyConnection) {
  if (connection.auth !== "oauth" || !isGoogleManagedPlatform(connection.platform)) {
    return connection;
  }

  const storedConnection = getPersistedGoogleCompanyConnection(companySlug, connection.platform);
  if (!storedConnection) {
    return connection;
  }

  return {
    ...connection,
    status: "connected" as const,
    scopes: storedConnection.scopes,
    accountLabels: [storedConnection.accountEmail],
    lastSync: storedConnection.updatedAt,
    nextAction: `Conexao pronta via agente para ${storedConnection.accountEmail}. Proximo passo: mapear o recurso real desta conta dentro da empresa.`
  };
}

export function hydrateWorkspaceAudit(companySlug: string, audit: ConnectorAuditEvent[]) {
  const storedAudit = getPersistedAuditEvents(companySlug);
  const connectionAudit = buildConnectionAudit(companySlug);

  return [...storedAudit, ...connectionAudit, ...audit].sort((left, right) =>
    right.timestamp.localeCompare(left.timestamp)
  );
}

function buildConnectionAudit(companySlug: string) {
  const platforms: CompanyConnection["platform"][] = ["ga4", "google-ads", "google-sheets", "search-console", "gmail", "youtube", "business-profile"];
  return platforms
    .map((platform) => getPersistedGoogleCompanyConnection(companySlug, platform))
    .filter((connection): connection is NonNullable<ReturnType<typeof getPersistedGoogleCompanyConnection>> => Boolean(connection))
    .map((connection, index) => ({
      id: `audit-${companySlug}-vault-${index}`,
      timestamp: connection.updatedAt,
      connector: connection.platform,
      kind: "info" as const,
      title: `Conta Google conectada para ${connection.platform}`,
      details: `${connection.accountEmail} autorizou o agente para esta empresa com escopos isolados por workspace.`
    }));
}
