import type {
  CanonicalAccount,
  CompanyConnection,
  CompanyWorkspace,
  ConnectorAuditEvent,
  ConnectorOverview,
  ControlTowerSummary,
  MetricSnapshot,
  PlatformId,
  UserProfessionalProfile
} from "@/lib/domain";
import { getCompanyAgentProfile } from "@/lib/agent-profiles";
import { buildApprovalsCenter } from "@/lib/approvals-center";
import {
  getCompanyCreativeAssets,
  getCompanyCreativeTools,
  getCompanyPublishingRequests
} from "@/lib/creative-tools";
import { getCompanyCrmProfile } from "@/lib/crm";
import { getCompanyConversionEvents } from "@/lib/conversion-runtime";
import { getCompanyDataOpsProfile } from "@/lib/data-ops";
import { getCompanyEngineeringWorkspaces, getCompanyTechnicalRequests } from "@/lib/engineering";
import { getCompanyKeywordStrategy, getCompanyLeads } from "@/lib/conversion";
import {
  getStoredAuditEvents,
  getStoredGoogleCompanyConnection,
  getStoredCompanyOperationalAlerts,
  getStoredMetricSnapshots,
  getStoredSocialExecutionLogs,
  isVaultConfigured
} from "@/lib/company-vault";
import { areAllEnvConfigured, pickConfiguredEnv } from "@/lib/env";
import { buildOperationalInbox, getCompanyExecutionPlans } from "@/lib/execution";
import { mergeWorkspaceMetricSnapshots } from "@/lib/google-data";
import { isGoogleManagedPlatform } from "@/lib/google-connections";
import { getCompanyAgentLearnings } from "@/lib/learning";
import { getCompanyReports } from "@/lib/reports";
import { getCompanyPaymentProfile, getCompanyPaymentRequests } from "@/lib/payments";
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
import { getCompanySchedulerJobs, getCompanySchedulerProfile } from "@/lib/scheduler";
import { getCompanySiteOpsProfile } from "@/lib/site-ops";
import { getCompanyStrategicPlan } from "@/lib/strategy";

type GlobalConnectorDefinition = {
  connector: PlatformId;
  label: string;
  access: "read" | "write" | "mixed";
  requiredEnv: string[];
  summary: string;
  nextAction: string;
};

type WorkspaceSeed = {
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

const globalConnectorDefinitions: GlobalConnectorDefinition[] = [
  {
    connector: "ga4",
    label: "GA4 Data API",
    access: "read",
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    summary: "Cliente global Google para iniciar conexoes por empresa em GA4.",
    nextAction: "Configurar client id/client secret do app do agente."
  },
  {
    connector: "google-sheets",
    label: "Google Sheets API",
    access: "mixed",
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    summary: "Canal operacional para consolidar KPIs, backlog e historico executivo em planilhas por empresa.",
    nextAction: "Conectar as planilhas-chave de cada empresa e permitir escrita apenas em documentos aprovados."
  },
  {
    connector: "search-console",
    label: "Search Console API",
    access: "read",
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    summary: "Reaproveita o OAuth Google para conectar propriedades Search Console por empresa.",
    nextAction: "Usar o mesmo app OAuth do Google e mapear sites por workspace."
  },
  {
    connector: "google-ads",
    label: "Google Ads API",
    access: "mixed",
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN"],
    summary: "Credencial global do agente para depois vincular contas Google Ads de cada empresa.",
    nextAction: "Adicionar developer token e testar leitura read-only em conta sandbox."
  },
  {
    connector: "meta",
    label: "Meta Marketing API",
    access: "mixed",
    requiredEnv: ["META_APP_ID", "META_APP_SECRET"],
    summary: "App global da Meta para conectar ad accounts individuais por empresa.",
    nextAction: "Configurar app id/app secret e preparar fluxo de token por empresa."
  },
  {
    connector: "business-profile",
    label: "Business Profile APIs",
    access: "mixed",
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    summary: "Mesmo stack Google, mas com permissao separada para perfis locais.",
    nextAction: "Confirmar aprovacao de acesso e quota antes do onboarding em massa."
  },
  {
    connector: "gmail",
    label: "Gmail API",
    access: "write",
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    summary: "Cliente global para enviar follow-up por empresa com escopo minimo.",
    nextAction: "Comecar por gmail.send e armazenar refresh token por workspace."
  },
  {
    connector: "youtube",
    label: "YouTube Data API",
    access: "write",
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    summary: "Canal de video opcional que pode ser conectado por empresa quando houver demanda.",
    nextAction: "Habilitar apenas nas empresas que realmente publicam video."
  }
];

const workspaceSeeds: WorkspaceSeed[] = [
  {
    company: {
      id: "company-ortho-prime",
      slug: "ortho-prime",
      name: "Ortho Prime",
      sector: "Saude",
      region: "Brasil",
      timezone: "America/Sao_Paulo",
      primaryGoal: "Gerar consultas premium com CAC previsivel"
    },
    stage: "active",
    agentMode: "assistido",
    summary: "Workspace de saude com foco em Google Ads, Meta e SEO local para captação qualificada.",
    nextActions: [
      "Conectar a propriedade real de GA4 desta empresa.",
      "Onboard da conta Google Ads via OAuth da empresa.",
      "Ativar Search Console e Business Profile em modo read-only."
    ],
    accounts: [
      {
        id: "acc-ortho-ga4",
        platform: "ga4",
        name: "GA4 - Ortho Prime",
        timezone: "America/Sao_Paulo",
        accessLevel: "read"
      },
      {
        id: "acc-ortho-ads",
        platform: "google-ads",
        name: "Google Ads - Ortho Prime",
        timezone: "America/Sao_Paulo",
        currency: "BRL",
        accessLevel: "mixed"
      },
      {
        id: "acc-ortho-sheets",
        platform: "google-sheets",
        name: "Planilha operacional - Ortho Prime",
        timezone: "America/Sao_Paulo",
        accessLevel: "mixed"
      }
    ],
    connections: [
      {
        id: "conn-ortho-ga4",
        platform: "ga4",
        label: "GA4 principal",
        status: "action_required",
        auth: "oauth",
        scopes: ["analytics.readonly"],
        accountLabels: ["properties/ortho-prime"],
        vaultNamespace: "vault://companies/ortho-prime/google",
        nextAction: "Autorizar a conta Google da empresa no agente e selecionar a property correta."
      },
      {
        id: "conn-ortho-gads",
        platform: "google-ads",
        label: "Conta Google Ads",
        status: "not_connected",
        auth: "oauth",
        scopes: ["adwords"],
        accountLabels: ["Sem conta vinculada"],
        vaultNamespace: "vault://companies/ortho-prime/google-ads",
        nextAction: "Conectar a conta Ads desta empresa pelo agente e mapear customer id."
      },
      {
        id: "conn-ortho-sheets",
        platform: "google-sheets",
        label: "Google Sheets operacional",
        status: "not_connected",
        auth: "oauth",
        scopes: ["spreadsheets"],
        accountLabels: ["Planilha operacional"],
        vaultNamespace: "vault://companies/ortho-prime/google-sheets",
        nextAction: "Conectar a planilha mestre desta empresa para atualizar KPIs e relatorios internos."
      },
      {
        id: "conn-ortho-meta",
        platform: "meta",
        label: "Ad account Meta",
        status: "action_required",
        auth: "token",
        scopes: ["ads_management"],
        accountLabels: ["act_1234567890"],
        lastSync: "2026-03-27T14:40:00.000Z",
        vaultNamespace: "vault://companies/ortho-prime/meta",
        nextAction: "Renovar token desta empresa e revalidar app secret proof."
      }
    ],
    snapshots: [
      {
        companyId: "company-ortho-prime",
        companyName: "Ortho Prime",
        platform: "google-ads",
        window: "7d",
        spend: 3200,
        impressions: 215000,
        clicks: 3900,
        conversions: 61,
        ctr: 0.0181,
        cpa: 52.46,
        notes: ["Snapshot isolado por empresa.", "Usar este formato para todas as workspaces."]
      },
      {
        companyId: "company-ortho-prime",
        companyName: "Ortho Prime",
        platform: "ga4",
        window: "7d",
        impressions: 12400,
        clicks: 840,
        conversions: 39,
        revenue: 18200,
        ctr: 0.0677,
        notes: ["Mock para o dashboard por empresa.", "Substituir por runReport assim que o OAuth entrar."]
      }
    ],
    audit: [
      {
        id: "audit-ortho-001",
        timestamp: "2026-03-28T17:05:00.000Z",
        connector: "meta",
        kind: "warning",
        title: "Token Meta precisa de renovacao",
        details: "A conexao desta empresa ficou em action_required ate renovar o token."
      },
      {
        id: "audit-ortho-002",
        timestamp: "2026-03-28T16:20:00.000Z",
        connector: "system",
        kind: "decision",
        title: "Operacao mantida em modo assistido",
        details: "A empresa segue com mutacoes bloqueadas ate concluir onboarding de contas."
      }
    ]
  },
  {
    company: {
      id: "company-casa-lume",
      slug: "casa-lume",
      name: "Casa Lume",
      sector: "E-commerce",
      region: "Brasil",
      timezone: "America/Sao_Paulo",
      primaryGoal: "Escalar receita com controle de ROAS e refresh criativo"
    },
    stage: "stabilizing",
    agentMode: "assistido",
    summary: "Workspace de varejo digital com dependencia forte de Meta Ads e GA4 para leitura de funil.",
    nextActions: [
      "Ativar Google Ads read-only para comparativo de performance.",
      "Conectar Gmail send-only para cadencias de abandono e reativacao.",
      "Padronizar naming de campanhas desta empresa."
    ],
    accounts: [
      {
        id: "acc-lume-meta",
        platform: "meta",
        name: "Meta Ads - Casa Lume",
        timezone: "America/Sao_Paulo",
        currency: "BRL",
        accessLevel: "mixed"
      },
      {
        id: "acc-lume-ga4",
        platform: "ga4",
        name: "GA4 - Casa Lume",
        timezone: "America/Sao_Paulo",
        accessLevel: "read"
      },
      {
        id: "acc-lume-sheets",
        platform: "google-sheets",
        name: "Control sheet - Casa Lume",
        timezone: "America/Sao_Paulo",
        accessLevel: "mixed"
      }
    ],
    connections: [
      {
        id: "conn-lume-meta",
        platform: "meta",
        label: "Ad account principal",
        status: "connected",
        auth: "token",
        scopes: ["ads_management"],
        accountLabels: ["act_9988776655"],
        lastSync: "2026-03-28T15:10:00.000Z",
        vaultNamespace: "vault://companies/casa-lume/meta",
        nextAction: "Conexao pronta. Proximo passo: incluir asset account e pagina oficial."
      },
      {
        id: "conn-lume-ga4",
        platform: "ga4",
        label: "Property GA4",
        status: "connected",
        auth: "oauth",
        scopes: ["analytics.readonly"],
        accountLabels: ["properties/casa-lume"],
        lastSync: "2026-03-28T15:12:00.000Z",
        vaultNamespace: "vault://companies/casa-lume/google",
        nextAction: "Conexao pronta. Validar mapeamento de conversoes importadas."
      },
      {
        id: "conn-lume-gmail",
        platform: "gmail",
        label: "Gmail operacional",
        status: "not_connected",
        auth: "oauth",
        scopes: ["gmail.send"],
        accountLabels: ["Sem conta vinculada"],
        vaultNamespace: "vault://companies/casa-lume/gmail",
        nextAction: "Conectar caixa de envio desta empresa com escopo minimo."
      },
      {
        id: "conn-lume-sheets",
        platform: "google-sheets",
        label: "Control sheet",
        status: "action_required",
        auth: "oauth",
        scopes: ["spreadsheets"],
        accountLabels: ["casa-lume-control-sheet"],
        vaultNamespace: "vault://companies/casa-lume/google-sheets",
        nextAction: "Reconectar a planilha operacional para liberar automacoes de KPI e alertas."
      }
    ],
    snapshots: [
      {
        companyId: "company-casa-lume",
        companyName: "Casa Lume",
        platform: "meta",
        window: "7d",
        spend: 5400,
        impressions: 460000,
        clicks: 9600,
        conversions: 102,
        ctr: 0.0209,
        cpa: 52.94,
        notes: ["Meta ja faz parte do workspace isolado desta empresa.", "ROAS e revenue podem entrar na proxima etapa."]
      },
      {
        companyId: "company-casa-lume",
        companyName: "Casa Lume",
        platform: "ga4",
        window: "7d",
        impressions: 22100,
        clicks: 1430,
        conversions: 126,
        revenue: 41800,
        ctr: 0.0647,
        notes: ["Snapshot mock conectado a uma empresa especifica.", "Usado para comparar performance entre workspaces."]
      }
    ],
    audit: [
      {
        id: "audit-lume-001",
        timestamp: "2026-03-28T16:40:00.000Z",
        connector: "ga4",
        kind: "info",
        title: "GA4 desta empresa sincronizado",
        details: "A property da Casa Lume foi marcada como pronta para consumo em read-only."
      }
    ]
  },
  {
    company: {
      id: "company-viva-ensino",
      slug: "viva-ensino",
      name: "Viva Ensino",
      sector: "Educacao",
      region: "Brasil",
      timezone: "America/Sao_Paulo",
      primaryGoal: "Aumentar matriculas com blend de SEO, Google Ads e e-mail"
    },
    stage: "onboarding",
    agentMode: "assistido",
    summary: "Workspace em onboarding para estruturar SEO, Google Ads e Gmail desde o inicio.",
    nextActions: [
      "Criar namespace seguro para tokens desta empresa.",
      "Conectar Search Console e Gmail antes das campanhas.",
      "Mapear convenios de naming e ownership de contas."
    ],
    accounts: [
      {
        id: "acc-viva-sc",
        platform: "search-console",
        name: "Search Console - Viva Ensino",
        timezone: "America/Sao_Paulo",
        accessLevel: "read"
      },
      {
        id: "acc-viva-sheets",
        platform: "google-sheets",
        name: "Planilha de matriculas e midia - Viva Ensino",
        timezone: "America/Sao_Paulo",
        accessLevel: "mixed"
      }
    ],
    connections: [
      {
        id: "conn-viva-sc",
        platform: "search-console",
        label: "Property Search Console",
        status: "not_connected",
        auth: "oauth",
        scopes: ["webmasters.readonly"],
        accountLabels: ["Nenhuma property selecionada"],
        vaultNamespace: "vault://companies/viva-ensino/google",
        nextAction: "Conectar propriedade desta empresa e validar ownership."
      },
      {
        id: "conn-viva-gmail",
        platform: "gmail",
        label: "Gmail academico",
        status: "not_connected",
        auth: "oauth",
        scopes: ["gmail.send"],
        accountLabels: ["Nenhuma caixa configurada"],
        vaultNamespace: "vault://companies/viva-ensino/gmail",
        nextAction: "Conectar conta de envio desta empresa pelo agente."
      },
      {
        id: "conn-viva-gads",
        platform: "google-ads",
        label: "Conta Ads futura",
        status: "not_connected",
        auth: "oauth",
        scopes: ["adwords"],
        accountLabels: ["Conta nao onboardada"],
        vaultNamespace: "vault://companies/viva-ensino/google-ads",
        nextAction: "Conectar Google Ads somente depois do baseline organico e GA4."
      },
      {
        id: "conn-viva-sheets",
        platform: "google-sheets",
        label: "Planilha de matriculas e midia",
        status: "not_connected",
        auth: "oauth",
        scopes: ["spreadsheets"],
        accountLabels: ["Nenhuma planilha aprovada"],
        vaultNamespace: "vault://companies/viva-ensino/google-sheets",
        nextAction: "Conectar a planilha central para consolidar matriculas, midia e relatorios."
      }
    ],
    snapshots: [
      {
        companyId: "company-viva-ensino",
        companyName: "Viva Ensino",
        platform: "search-console",
        window: "28d",
        impressions: 28400,
        clicks: 980,
        ctr: 0.0345,
        notes: ["Workspace ainda em onboarding.", "Este snapshot existe para validar a visualizacao por empresa."]
      }
    ],
    audit: [
      {
        id: "audit-viva-001",
        timestamp: "2026-03-28T14:10:00.000Z",
        connector: "system",
        kind: "decision",
        title: "Onboarding separado por namespace",
        details: "A empresa recebeu namespace proprio para manter tokens e logs isolados."
      }
    ]
  }
];

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

export function getCompanyWorkspaces(professionalProfile?: UserProfessionalProfile | null): CompanyWorkspace[] {
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
    const snapshots = mergeWorkspaceMetricSnapshots(
      workspace.snapshots,
      getStoredMetricSnapshots(workspace.company.id)
    );

    const hydratedWorkspace = {
      company: workspace.company,
      stage: workspace.stage,
      agentMode: workspace.agentMode,
      summary: workspace.summary,
      nextActions: workspace.nextActions,
      agentProfile: getCompanyAgentProfile(workspace.company),
      strategyPlan: getCompanyStrategicPlan(workspace.company, professionalProfile),
      dataOpsProfile: getCompanyDataOpsProfile(workspace.company, professionalProfile),
      keywordStrategy: getCompanyKeywordStrategy(workspace.company),
      socialProfile: getCompanySocialOpsProfile(workspace.company, professionalProfile),
      socialPlatforms,
      scheduledPosts,
      socialAdDrafts,
      socialInsights: getCompanySocialInsights(workspace.company),
      socialBindings,
      socialRuntime: getCompanySocialRuntimeSummary(workspace.company.slug, socialBindings, socialRuntimeTasks),
      socialRuntimeTasks,
      socialExecutionLogs: getStoredSocialExecutionLogs(workspace.company.slug),
      approvalsCenter,
      schedulerProfile,
      schedulerJobs,
      operationalAlerts,
      agentLearnings,
      paymentProfile: getCompanyPaymentProfile(workspace.company),
      paymentRequests,
      creativeTools: getCompanyCreativeTools(workspace.company),
      creativeAssets: getCompanyCreativeAssets(workspace.company.slug),
      publishingRequests,
      crmProfile: getCompanyCrmProfile(workspace.company),
      siteOpsProfile: getCompanySiteOpsProfile(workspace.company),
      leads: getCompanyLeads(workspace.company.slug),
      conversionEvents: getCompanyConversionEvents(workspace.company.slug),
      engineeringWorkspaces: getCompanyEngineeringWorkspaces(workspace.company),
      technicalRequests: getCompanyTechnicalRequests(workspace.company.slug),
      accounts: workspace.accounts,
      connections: workspace.connections.map((connection) => hydrateConnection(workspace.company.slug, connection)),
      snapshots,
      reports: getCompanyReports(workspace.company.slug),
      executionPlans,
      audit: hydrateAudit(workspace.company.slug, workspace.audit)
    };

    return {
      ...hydratedWorkspace,
      operationalInbox: buildOperationalInbox(hydratedWorkspace)
    };
  });
}

export function getCompanyWorkspace(companySlug: string, professionalProfile?: UserProfessionalProfile | null) {
  return getCompanyWorkspaces(professionalProfile).find((workspace) => workspace.company.slug === companySlug);
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
    (total, workspace) => total + workspace.connections.filter((connection) => connection.status === "connected").length,
    0
  );
  const companiesReadyForOps = workspaces.filter((workspace) =>
    workspace.connections.some((connection) => connection.status === "connected")
  ).length;
  const companiesWithActionRequired = workspaces.filter((workspace) =>
    workspace.connections.some((connection) => connection.status === "action_required")
  ).length;
  const customizedProfiles = workspaces.filter((workspace) => workspace.agentProfile.trainingStatus === "customized").length;
  const generatedReports = workspaces.reduce((total, workspace) => total + workspace.reports.length, 0);
  const pendingUnifiedApprovals = workspaces.reduce(
    (total, workspace) => total + workspace.approvalsCenter.filter((item) => item.actions.length > 0).length,
    0
  );
  const pendingPaymentApprovals = workspaces.reduce(
    (total, workspace) => total + workspace.paymentRequests.filter((request) => request.status === "pending").length,
    0
  );
  const pendingPublishingApprovals = workspaces.reduce(
    (total, workspace) => total + workspace.publishingRequests.filter((request) => request.status === "pending").length,
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

function hydrateConnection(companySlug: string, connection: CompanyConnection): CompanyConnection {
  if (!isVaultConfigured() || connection.auth !== "oauth" || !isGoogleManagedPlatform(connection.platform)) {
    return connection;
  }

  const storedConnection = getStoredGoogleCompanyConnection(companySlug, connection.platform);
  if (!storedConnection) {
    return connection;
  }

  return {
    ...connection,
    status: "connected",
    scopes: storedConnection.scopes,
    accountLabels: [storedConnection.accountEmail],
    lastSync: storedConnection.updatedAt,
    nextAction: `Conexao pronta via agente para ${storedConnection.accountEmail}. Proximo passo: mapear o recurso real desta conta dentro da empresa.`
  };
}

function hydrateAudit(companySlug: string, audit: ConnectorAuditEvent[]) {
  if (!isVaultConfigured()) {
    return audit;
  }

  const storedAudit = getStoredAuditEvents(companySlug);

  const storedConnections = workspaceSeeds
    .find((workspace) => workspace.company.slug === companySlug)
    ?.connections.filter((connection) => connection.auth === "oauth" && isGoogleManagedPlatform(connection.platform))
    .map((connection) => getStoredGoogleCompanyConnection(companySlug, connection.platform))
    .filter((connection): connection is NonNullable<typeof connection> => Boolean(connection));

  const connectionAudit =
    storedConnections?.map((connection, index) => ({
      id: `audit-${companySlug}-vault-${index}`,
      timestamp: connection.updatedAt,
      connector: connection.platform,
      kind: "info" as const,
      title: `Conta Google conectada para ${connection.platform}`,
      details: `${connection.accountEmail} autorizou o agente para esta empresa com escopos isolados por workspace.`
    })) ?? [];

  return [...storedAudit, ...connectionAudit, ...audit].sort((left, right) =>
    right.timestamp.localeCompare(left.timestamp)
  );
}
