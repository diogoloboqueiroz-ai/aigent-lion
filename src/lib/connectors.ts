import type {
  CompanyWorkspace,
  ConnectorAuditEvent,
  ConnectorOverview,
  ControlTowerSummary,
  UserProfessionalProfile
} from "@/lib/domain";
import { getCompanyAgentProfile } from "@/lib/agent-profiles";
import { buildApprovalsCenter } from "@/lib/approvals-center";
import {
  getCompanyCreativeAssets,
  getCompanyCreativeTools,
  getCompanyPublishingRequests
} from "@/lib/creative-tools";
import {
  globalConnectorDefinitions
} from "@/infrastructure/connectors/connector-overview-catalog";
import { workspaceSeeds } from "@/infrastructure/connectors/workspace-seeds";
import { buildHydratedCompanyWorkspace } from "@/infrastructure/connectors/workspace-hydration";
import {
  createTenantAutomationRepository,
  resolveTenantId
} from "@/infrastructure/persistence/tenant-automation-repository";
import { createTenantRuntimeGuardRepository } from "@/infrastructure/persistence/tenant-runtime-guard-repository";
import {
  getStoredCompanyExperimentOutcomes,
  getStoredCompanyLearningPlaybooks,
  getStoredCompanyOperationalAlerts,
  getStoredCrossTenantLearningPlaybooks,
  getStoredMetricSnapshots,
  getStoredSocialExecutionLogs
} from "@/lib/company-vault";
import { getCompanyKeywordStrategy, getCompanyLeads } from "@/lib/conversion";
import { getCompanyConversionEvents } from "@/lib/conversion-runtime";
import { getCompanyCrmProfile } from "@/lib/crm";
import { getCompanyDataOpsProfile } from "@/lib/data-ops";
import { getCompanyEngineeringWorkspaces, getCompanyTechnicalRequests } from "@/lib/engineering";
import { areAllEnvConfigured, pickConfiguredEnv } from "@/lib/env";
import { getCompanyExecutionPlans } from "@/lib/execution";
import { mergeWorkspaceMetricSnapshots } from "@/lib/google-data";
import { getCompanyAgentLearnings } from "@/lib/learning";
import { getCompanyPaymentProfile, getCompanyPaymentRequests } from "@/lib/payments";
import { getCompanyReports } from "@/lib/reports";
import { getCompanySchedulerJobs, getCompanySchedulerProfile } from "@/lib/scheduler";
import { getCompanySiteOpsProfile } from "@/lib/site-ops";
import {
  getCompanyScheduledPosts,
  getCompanySocialAdDrafts,
  getCompanySocialInsights,
  getCompanySocialOpsProfile,
  getCompanySocialPlatforms
} from "@/lib/social-ops";
import {
  getCompanySocialBindings,
  getCompanySocialRuntimeSummary,
  getCompanySocialRuntimeTasks
} from "@/lib/social-runtime";
import { getCompanyStrategicPlan } from "@/lib/strategy";

const tenantAutomationRepository = createTenantAutomationRepository();
const tenantRuntimeGuardRepository = createTenantRuntimeGuardRepository();

export function getConnectorOverview(): ConnectorOverview[] {
  return globalConnectorDefinitions.map((definition) => {
    const configuredEnv = pickConfiguredEnv(definition.requiredEnv);
    const isReady = areAllEnvConfigured(definition.requiredEnv);

    return {
      connector: definition.connector,
      label: definition.label,
      status: isReady ? "ready" : "missing_credentials",
      health: isReady ? "healthy" : configuredEnv.length > 0 ? "warning" : "critical",
      access: definition.access,
      requiredEnv: definition.requiredEnv,
      configuredEnv,
      summary: definition.summary,
      nextAction: definition.nextAction
    };
  });
}

export function getCompanyWorkspaces(
  professionalProfile?: UserProfessionalProfile | null
): CompanyWorkspace[] {
  return workspaceSeeds.map((workspace) => {
    const socialPlatforms = getCompanySocialPlatforms(workspace.company);
    const scheduledPosts = getCompanyScheduledPosts(workspace.company.slug);
    const socialAdDrafts = getCompanySocialAdDrafts(workspace.company.slug);
    const socialBindings = getCompanySocialBindings(workspace.company, socialPlatforms);
    const socialRuntimeTasks = getCompanySocialRuntimeTasks(workspace.company.slug);
    const paymentRequests = getCompanyPaymentRequests(workspace.company.slug);
    const publishingRequests = getCompanyPublishingRequests(workspace.company.slug);
    const approvalsCenter = buildApprovalsCenter({
      companySlug: workspace.company.slug,
      paymentRequests,
      publishingRequests,
      scheduledPosts,
      socialAdDrafts
    });
    const schedulerProfile = getCompanySchedulerProfile(workspace.company, professionalProfile);
    const schedulerJobs = getCompanySchedulerJobs(workspace.company, professionalProfile);
    const executionPlans = getCompanyExecutionPlans(workspace.company.slug);
    const operationalAlerts = getStoredCompanyOperationalAlerts(workspace.company.slug);
    const agentLearnings = getCompanyAgentLearnings(workspace.company.slug);
    const experimentOutcomes = getStoredCompanyExperimentOutcomes(workspace.company.slug);
    const learningPlaybooks = getStoredCompanyLearningPlaybooks(workspace.company.slug);
    const sharedLearningPlaybooks = getStoredCrossTenantLearningPlaybooks();
    const tenantId = resolveTenantId(workspace.company.slug);
    const automationQueue = tenantAutomationRepository.listQueue(tenantId);
    const automationDeadLetters = tenantAutomationRepository.listDeadLetters(tenantId);
    const executionIntents = tenantRuntimeGuardRepository.listExecutionIntents(tenantId);
    const connectorCircuitBreakers =
      tenantRuntimeGuardRepository.listConnectorCircuitBreakers(tenantId);
    const snapshots = mergeWorkspaceMetricSnapshots(
      workspace.snapshots,
      getStoredMetricSnapshots(workspace.company.id)
    );

    return buildHydratedCompanyWorkspace(workspace, {
      professionalProfile,
      socialPlatforms,
      scheduledPosts,
      socialAdDrafts,
      socialBindings,
      socialRuntimeTasks,
      paymentRequests,
      publishingRequests,
      approvalsCenter,
      schedulerProfile,
      schedulerJobs,
      executionPlans,
      operationalAlerts,
      agentLearnings,
      experimentOutcomes,
      learningPlaybooks,
      sharedLearningPlaybooks,
      paymentProfile: getCompanyPaymentProfile(workspace.company),
      creativeTools: getCompanyCreativeTools(workspace.company),
      creativeAssets: getCompanyCreativeAssets(workspace.company.slug),
      crmProfile: getCompanyCrmProfile(workspace.company),
      siteOpsProfile: getCompanySiteOpsProfile(workspace.company),
      leads: getCompanyLeads(workspace.company.slug),
      conversionEvents: getCompanyConversionEvents(workspace.company.slug),
      engineeringWorkspaces: getCompanyEngineeringWorkspaces(workspace.company),
      technicalRequests: getCompanyTechnicalRequests(workspace.company.slug),
      socialInsights: getCompanySocialInsights(workspace.company),
      socialProfile: getCompanySocialOpsProfile(workspace.company, professionalProfile),
      socialRuntime: getCompanySocialRuntimeSummary(
        workspace.company.slug,
        socialBindings,
        socialRuntimeTasks
      ),
      socialExecutionLogs: getStoredSocialExecutionLogs(workspace.company.slug),
      reports: getCompanyReports(workspace.company.slug),
      automationRuns: tenantAutomationRepository.listRuns(tenantId),
      automationQueue,
      automationDeadLetters,
      executionIntents,
      connectorCircuitBreakers,
      agentProfile: getCompanyAgentProfile(workspace.company),
      strategyPlan: getCompanyStrategicPlan(workspace.company, professionalProfile),
      dataOpsProfile: getCompanyDataOpsProfile(workspace.company, professionalProfile),
      keywordStrategy: getCompanyKeywordStrategy(workspace.company),
      snapshots
    });
  });
}

export function getCompanyWorkspace(
  companySlug: string,
  professionalProfile?: UserProfessionalProfile | null
) {
  return getCompanyWorkspaces(professionalProfile).find(
    (workspace) => workspace.company.slug === companySlug
  );
}

export function getSnapshotFeed(companySlug?: string) {
  const workspaces = companySlug
    ? getCompanyWorkspaces().filter((workspace) => workspace.company.slug === companySlug)
    : getCompanyWorkspaces();

  return workspaces.flatMap((workspace) => workspace.snapshots);
}

export function getAuditFeed(companySlug?: string): ConnectorAuditEvent[] {
  if (companySlug) {
    return getCompanyWorkspace(companySlug)?.audit ?? [];
  }

  return getCompanyWorkspaces().flatMap((workspace) => workspace.audit);
}

export function getControlTowerSummary(): ControlTowerSummary {
  const workspaces = getCompanyWorkspaces();
  const connectedPlatforms = workspaces.reduce(
    (total, workspace) =>
      total + workspace.connections.filter((connection) => connection.status === "connected").length,
    0
  );
  const companiesReadyForOps = workspaces.filter((workspace) =>
    workspace.connections.some((connection) => connection.status === "connected")
  ).length;
  const companiesWithActionRequired = workspaces.filter((workspace) =>
    workspace.connections.some((connection) => connection.status === "action_required")
  ).length;
  const customizedProfiles = workspaces.filter(
    (workspace) => workspace.agentProfile.trainingStatus === "customized"
  ).length;
  const generatedReports = workspaces.reduce((total, workspace) => total + workspace.reports.length, 0);
  const pendingUnifiedApprovals = workspaces.reduce(
    (total, workspace) =>
      total + workspace.approvalsCenter.filter((item) => item.actions.length > 0).length,
    0
  );
  const pendingPaymentApprovals = workspaces.reduce(
    (total, workspace) =>
      total + workspace.paymentRequests.filter((request) => request.status === "pending").length,
    0
  );
  const pendingPublishingApprovals = workspaces.reduce(
    (total, workspace) =>
      total + workspace.publishingRequests.filter((request) => request.status === "pending").length,
    0
  );
  const openTechnicalRequests = workspaces.reduce(
    (total, workspace) =>
      total + workspace.technicalRequests.filter((request) => request.status !== "resolved").length,
    0
  );

  return {
    companies: workspaces.length,
    connectedPlatforms,
    isolatedWorkspaces: workspaces.length,
    companiesReadyForOps,
    companiesWithActionRequired,
    customizedProfiles,
    generatedReports,
    pendingUnifiedApprovals,
    pendingPaymentApprovals,
    pendingPublishingApprovals,
    openTechnicalRequests
  };
}
