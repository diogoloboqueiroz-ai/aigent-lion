import type {
  CanonicalAccount,
  CompanyConnection,
  CompanyWorkspace,
  ConnectorAuditEvent,
  MetricSnapshot
} from "@/lib/domain";

export type WorkspaceSeed = {
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

export const workspaceSeeds: WorkspaceSeed[] = [
  {
    company: {
      id: "company-aurora-health",
      slug: "aurora-health",
      name: "Aurora Health",
      sector: "Servicos locais",
      region: "Brasil",
      timezone: "America/Sao_Paulo",
      primaryGoal: "Gerar oportunidades premium com CAC previsivel"
    },
    stage: "active",
    agentMode: "assistido",
    summary: "Workspace de saude com foco em Google Ads, Meta e SEO local para captaÃ§Ã£o qualificada.",
    nextActions: [
      "Conectar a propriedade real de GA4 desta empresa.",
      "Onboard da conta Google Ads via OAuth da empresa.",
      "Ativar Search Console e Business Profile em modo read-only."
    ],
    accounts: [
      {
        id: "acc-aurora-ga4",
        platform: "ga4",
        name: "GA4 - Aurora Health",
        timezone: "America/Sao_Paulo",
        accessLevel: "read"
      },
      {
        id: "acc-aurora-ads",
        platform: "google-ads",
        name: "Google Ads - Aurora Health",
        timezone: "America/Sao_Paulo",
        currency: "BRL",
        accessLevel: "mixed"
      },
      {
        id: "acc-aurora-sheets",
        platform: "google-sheets",
        name: "Planilha operacional - Aurora Health",
        timezone: "America/Sao_Paulo",
        accessLevel: "mixed"
      }
    ],
    connections: [
      {
        id: "conn-aurora-ga4",
        platform: "ga4",
        label: "GA4 principal",
        status: "action_required",
        auth: "oauth",
        scopes: ["analytics.readonly"],
        accountLabels: ["properties/aurora-health"],
        vaultNamespace: "vault://companies/aurora-health/google",
        nextAction: "Autorizar a conta Google da empresa no agente e selecionar a property correta."
      },
      {
        id: "conn-aurora-gads",
        platform: "google-ads",
        label: "Conta Google Ads",
        status: "not_connected",
        auth: "oauth",
        scopes: ["adwords"],
        accountLabels: ["Sem conta vinculada"],
        vaultNamespace: "vault://companies/aurora-health/google-ads",
        nextAction: "Conectar a conta Ads desta empresa pelo agente e mapear customer id."
      },
      {
        id: "conn-aurora-sheets",
        platform: "google-sheets",
        label: "Google Sheets operacional",
        status: "not_connected",
        auth: "oauth",
        scopes: ["spreadsheets"],
        accountLabels: ["Planilha operacional"],
        vaultNamespace: "vault://companies/aurora-health/google-sheets",
        nextAction: "Conectar a planilha mestre desta empresa para atualizar KPIs e relatorios internos."
      },
      {
        id: "conn-aurora-meta",
        platform: "meta",
        label: "Ad account Meta",
        status: "action_required",
        auth: "token",
        scopes: ["ads_management"],
        accountLabels: ["act_1234567890"],
        lastSync: "2026-03-27T14:40:00.000Z",
        vaultNamespace: "vault://companies/aurora-health/meta",
        nextAction: "Renovar token desta empresa e revalidar app secret proof."
      }
    ],
    snapshots: [
      {
        companyId: "company-aurora-health",
        companyName: "Aurora Health",
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
        companyId: "company-aurora-health",
        companyName: "Aurora Health",
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
        id: "audit-aurora-001",
        timestamp: "2026-03-28T17:05:00.000Z",
        connector: "meta",
        kind: "warning",
        title: "Token Meta precisa de renovacao",
        details: "A conexao desta empresa ficou em action_required ate renovar o token."
      },
      {
        id: "audit-aurora-002",
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
        notes: [
          "Meta ja faz parte do workspace isolado desta empresa.",
          "ROAS e revenue podem entrar na proxima etapa."
        ]
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
        notes: [
          "Snapshot mock conectado a uma empresa especifica.",
          "Usado para comparar performance entre workspaces."
        ]
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
        notes: [
          "Workspace ainda em onboarding.",
          "Este snapshot existe para validar a visualizacao por empresa."
        ]
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
