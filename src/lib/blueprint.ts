import { brand } from "@/lib/brand";

export type AutomationMode = "assistido" | "semi-autonomo" | "autonomo";
export type RiskLevel = "baixo" | "medio" | "alto";
export type IntegrationAccess = "read" | "write" | "mixed";

export type SystemModule = {
  id: string;
  title: string;
  summary: string;
  cadence: string;
  outcomes: string[];
};

export type Integration = {
  id: string;
  platform: string;
  purpose: string;
  auth: string;
  minimumScope: string;
  access: IntegrationAccess;
  risk: RiskLevel;
  phase: string;
};

export type Guardrail = {
  id: string;
  title: string;
  severity: RiskLevel;
  description: string;
};

export type Phase = {
  id: string;
  name: string;
  duration: string;
  objective: string;
  deliverables: string[];
};

export type Control = {
  id: string;
  area: string;
  owner: string;
  rule: string;
};

export type MarketingSystemBlueprint = {
  name: string;
  version: string;
  automationMode: AutomationMode;
  positioning: string;
  architectureSummary: string;
  principles: string[];
  modules: SystemModule[];
  integrations: Integration[];
  guardrails: Guardrail[];
  phases: Phase[];
  controls: Control[];
  kpis: string[];
};

export const blueprint: MarketingSystemBlueprint = {
  name: brand.name,
  version: "2026-03-28",
  automationMode: "assistido",
  positioning: brand.positioning,
  architectureSummary:
    "O orquestrador gera plano, hipoteses, briefs e prioridades. Os executores validam payloads, aplicam policy engine, registram auditoria e so entao liberam mutacoes de baixo risco.",
  principles: [
    "Separar raciocinio de IA da execucao em APIs.",
    "Comecar com conectores read-only antes de publicar qualquer alteracao.",
    "Auditar toda decisao, aprovacao e mutacao.",
    "Aplicar least privilege e autorizacao incremental em OAuth.",
    "Tratar compliance como parte da arquitetura, nao como etapa final.",
    "Dominar o stack martech real do mercado e deixar explicito o nivel de prontidao de cada ferramenta."
  ],
  modules: [
    {
      id: "orchestrator",
      title: "Orquestrador de Estrategia",
      summary: "Converte metas do negocio em planos, jobs, experimentos e pedidos de aprovacao.",
      cadence: "Sob demanda e diario",
      outcomes: [
        "backlog de campanhas",
        "briefs de criativo",
        "acoes priorizadas por risco e impacto"
      ]
    },
    {
      id: "paid-media",
      title: "Google Ads e Meta Ads",
      summary: "Monitora campanhas, identifica anomalias e sugere ou executa mutacoes low-risk.",
      cadence: "Horario e diario",
      outcomes: [
        "controle de pacing",
        "pausas automaticas limitadas",
        "backlog de testes A/B"
      ]
    },
    {
      id: "social-ops",
      title: "Social Ops e Publicacao",
      summary: "Planeja calendario, programa posts, acompanha insights e prepara anuncios por plataforma.",
      cadence: "Diario e semanal",
      outcomes: [
        "agenda de conteudo",
        "posts programados",
        "drafts de anuncios",
        "estatisticas por rede"
      ]
    },
    {
      id: "seo-local",
      title: "SEO e Presenca Local",
      summary: "Acompanha Search Console, backlog tecnico, conteudo e consistencia do perfil local.",
      cadence: "Diario e semanal",
      outcomes: [
        "alertas de queda de CTR",
        "sitemaps e oportunidades",
        "tarefas de perfil local"
      ]
    },
    {
      id: "creative-studio",
      title: "Estudio de Criativos",
      summary: "Gera copys, conceitos visuais e roteiros usando ferramentas criativas conectadas, com aprovacao obrigatoria so na publicacao.",
      cadence: "Semanal e por campanha",
      outcomes: [
        "variacoes de copy",
        "roteiros de video curto",
        "assets pendentes de aprovacao",
        "fila de publicacao antes de postar"
      ]
    },
    {
      id: "desktop-ops",
      title: "Agente Desktop Local",
      summary: "Opera arquivos, pastas, exports e apps locais aprovados para agir como assistente real no computador.",
      cadence: "Sob demanda e diario",
      outcomes: [
        "geracao de arquivos locais",
        "organizacao de ativos",
        "exports criativos",
        "automacao de trabalho no desktop"
      ]
    },
    {
      id: "approval-center",
      title: "Approval Center",
      summary: "Centraliza pagamentos, publicacoes, posts e anuncios que exigem decisao humana antes da execucao.",
      cadence: "Continuo e diario",
      outcomes: [
        "fila unica de aprovacoes",
        "historico de decisoes",
        "menos contexto espalhado entre modulos"
      ]
    },
    {
      id: "scheduler",
      title: "Scheduler Recorrente",
      summary: "Agenda verificacoes, syncs, relatórios, digest de aprovacoes e health checks por empresa.",
      cadence: "Horario, diario e semanal",
      outcomes: [
        "jobs recorrentes",
        "execucao previsivel",
        "historico de rodadas"
      ]
    },
    {
      id: "web-intel",
      title: "Inteligencia Web em Tempo Real",
      summary: "Pesquisa a internet, monitora concorrentes, documentacoes, noticias e mudancas de plataforma para atualizar a estrategia continuamente.",
      cadence: "Continuo, diario e semanal",
      outcomes: [
        "watchlists de mercado",
        "alertas de mudanca de plataforma",
        "insights competitivos",
        "relatorios atualizados com sinais online"
      ]
    },
    {
      id: "crm-lite",
      title: "Leads e Cadencias",
      summary: "Recebe leads, aplica regras de consentimento e dispara follow-up com escopo minimo.",
      cadence: "Em tempo real",
      outcomes: [
        "roteamento de leads",
        "emails de follow-up",
        "opt-out e retention"
      ]
    },
    {
      id: "observability",
      title: "Observabilidade e Relatorios",
      summary: "Consolida sinais de Ads, GA4, Search Console, Google Sheets operacional e CRM em um modelo canonico.",
      cadence: "Diario, semanal e mensal",
      outcomes: [
        "painel executivo",
        "alertas operacionais",
        "historico explicavel de decisoes",
        "planilhas operacionais sempre atualizadas"
      ]
    }
  ],
  integrations: [
    {
      id: "openai",
      platform: "OpenAI API / ChatGPT",
      purpose: "Gerar copy, estrategias, roteiros, briefs e apoio de decisao para o agente.",
      auth: "Project API key",
      minimumScope: "API access",
      access: "write",
      risk: "medio",
      phase: "Fase 2"
    },
    {
      id: "canva",
      platform: "Canva Connect APIs",
      purpose: "Montar designs, redimensionar formatos e exportar criativos em fluxo assistido.",
      auth: "OAuth 2.0",
      minimumScope: "Connect APIs / design and asset scopes",
      access: "write",
      risk: "medio",
      phase: "Fase 2"
    },
    {
      id: "photoshop-api",
      platform: "Adobe Photoshop API",
      purpose: "Editar imagens, gerar variacoes, mockups e automatizar pos-producao criativa.",
      auth: "Adobe developer credentials",
      minimumScope: "Firefly / Photoshop API access",
      access: "write",
      risk: "medio",
      phase: "Fase 2"
    },
    {
      id: "adobe-express",
      platform: "Adobe Express",
      purpose: "Criar pecas rapidas e videos curtos em fluxo browser-assisted quando fizer sentido.",
      auth: "Adobe account",
      minimumScope: "Workspace access",
      access: "write",
      risk: "medio",
      phase: "Fase 2"
    },
    {
      id: "desktop-bridge",
      platform: "Desktop bridge local",
      purpose: "Permitir que o agente gere arquivos, organize pastas e opere apps locais aprovados no computador.",
      auth: "Sessao local + guardrails",
      minimumScope: "Pastas e apps aprovados",
      access: "mixed",
      risk: "alto",
      phase: "Fase 2 -> Fase 3"
    },
    {
      id: "web-research",
      platform: "Pesquisa web e fontes em tempo real",
      purpose: "Permitir que o agente pesquise internet, acompanhe concorrentes e traga atualizacoes online para a operacao.",
      auth: "Navegacao web + politica de fontes",
      minimumScope: "Fontes aprovadas",
      access: "read",
      risk: "medio",
      phase: "Fase 1 -> Fase 2"
    },
    {
      id: "ga4",
      platform: "Google Analytics Data API",
      purpose: "Capturar funil, canais, conversoes e apoiar atribuicao.",
      auth: "OAuth 2.0 ou service account",
      minimumScope: "analytics.readonly",
      access: "read",
      risk: "baixo",
      phase: "Fase 1"
    },
    {
      id: "search-console",
      platform: "Search Console API",
      purpose: "Monitorar queries, paginas, CTR e sitemaps.",
      auth: "OAuth 2.0",
      minimumScope: "webmasters.readonly",
      access: "read",
      risk: "baixo",
      phase: "Fase 1"
    },
    {
      id: "google-sheets",
      platform: "Google Sheets API",
      purpose: "Atualizar planilhas operacionais, consolidados executivos, alertas e historico de KPI por empresa.",
      auth: "OAuth 2.0",
      minimumScope: "spreadsheets",
      access: "mixed",
      risk: "baixo",
      phase: "Fase 1 -> Fase 2"
    },
    {
      id: "google-ads",
      platform: "Google Ads API",
      purpose: "Ler performance, estrutura de campanhas e futuramente executar mutacoes controladas.",
      auth: "OAuth 2.0 + developer token",
      minimumScope: "adwords",
      access: "mixed",
      risk: "alto",
      phase: "Fase 1 -> Fase 3"
    },
    {
      id: "meta",
      platform: "Meta Marketing API",
      purpose: "Ler insights de contas e preparar execucao de campanhas e criativos.",
      auth: "OAuth token + app secret proof",
      minimumScope: "ads_management",
      access: "mixed",
      risk: "alto",
      phase: "Fase 1 -> Fase 3"
    },
    {
      id: "linkedin-posts",
      platform: "LinkedIn Posts API",
      purpose: "Publicar posts de organizacao, trabalhar formatos de conteudo e alimentar o motor de social ops.",
      auth: "OAuth 2.0",
      minimumScope: "Posts API access",
      access: "mixed",
      risk: "medio",
      phase: "Fase 2 -> Fase 3"
    },
    {
      id: "tiktok-posting",
      platform: "TikTok Content Posting API",
      purpose: "Estruturar fila de videos curtos e programacao operacional para TikTok.",
      auth: "OAuth 2.0",
      minimumScope: "Content Posting API access",
      access: "mixed",
      risk: "medio",
      phase: "Fase 2 -> Fase 3"
    },
    {
      id: "business-profile",
      platform: "Business Profile APIs",
      purpose: "Atualizar horarios, atributos e consistencia da presenca local.",
      auth: "OAuth 2.0",
      minimumScope: "business.manage",
      access: "mixed",
      risk: "medio",
      phase: "Fase 2"
    },
    {
      id: "gmail",
      platform: "Gmail API",
      purpose: "Enviar follow-up com escopo minimo e sem leitura ampla da caixa.",
      auth: "OAuth 2.0",
      minimumScope: "gmail.send",
      access: "write",
      risk: "medio",
      phase: "Fase 2"
    },
    {
      id: "youtube",
      platform: "YouTube Data API",
      purpose: "Publicar e versionar videos de campanha quando a operacao exigir.",
      auth: "OAuth 2.0",
      minimumScope: "youtube.upload",
      access: "write",
      risk: "medio",
      phase: "Fase 2"
    }
  ],
  guardrails: [
    {
      id: "write-mode-off",
      title: "Write mode desligado por padrao",
      severity: "alto",
      description: "Toda mutacao nasce bloqueada ate passar por validacao, feature flag e auditoria."
    },
    {
      id: "budget-limits",
      title: "Cap de budget e pacing",
      severity: "alto",
      description: "Aumentos de gasto fora de faixa sao bloqueados e pausas automaticas precisam de rollback simples."
    },
    {
      id: "creative-policy",
      title: "Filtro de politica para criativos",
      severity: "alto",
      description: "A linguagem e validada contra promessas irreais, atributos pessoais e claims de risco."
    },
    {
      id: "oauth-minimum",
      title: "Escopo minimo em OAuth",
      severity: "medio",
      description: "Toda integracao sobe de permissao por justificativa, nunca por conveniencia."
    },
    {
      id: "consent-retention",
      title: "Consentimento e retencao",
      severity: "alto",
      description: "Cada lead precisa de base legal, prazo de retencao e mecanismo de exclusao ou oposicao."
    },
    {
      id: "desktop-guardrails",
      title: "Acesso local com limites",
      severity: "alto",
      description: "Excluir arquivos sensiveis, instalar software, alterar sistema, pagar ou publicar continua exigindo aprovacao."
    },
    {
      id: "web-sources",
      title: "Pesquisa online com fontes aprovadas",
      severity: "medio",
      description: "O agente pode pesquisar em tempo real, mas deve respeitar dominios aprovados, evitar fontes duvidosas e nao usar dados pessoais nao autorizados."
    },
    {
      id: "social-spend-approval",
      title: "Aprovacao obrigatoria para anuncios",
      severity: "alto",
      description: "O agente pode preparar e otimizar drafts e agenda, mas qualquer spend em anuncios continua exigindo liberacao explicita."
    }
  ],
  phases: [
    {
      id: "phase-0",
      name: "Fundacao",
      duration: "2 semanas",
      objective: "Criar o contrato do sistema, trilha de auditoria e modelo canonico.",
      deliverables: [
        "blueprint tipado",
        "dashboard interno",
        "camada de policy engine",
        "modelo canonico de campanhas, leads e criativos"
      ]
    },
    {
      id: "phase-1",
      name: "Conectores read-only",
      duration: "3 a 4 semanas",
      objective: "Ler dados com seguranca antes de agir.",
      deliverables: [
        "GA4 read-only",
        "Search Console read-only",
        "Google Ads read-only",
        "Meta read-only",
        "alertas e relatorios"
      ]
    },
    {
      id: "phase-2",
      name: "Criativos e CRM assistidos",
      duration: "2 a 3 semanas",
      objective: "Acoplar criacao de assets, Gmail send-only e presenca local com aprovacao humana.",
      deliverables: [
        "gerador de briefs e copys",
        "score de risco de politica",
        "cadencias de follow-up",
        "tarefas de business profile"
      ]
    },
    {
      id: "phase-3",
      name: "Automacao semi-autonoma",
      duration: "3 semanas",
      objective: "Liberar apenas mutacoes low-risk e com rollback.",
      deliverables: [
        "pausas automaticas de baixo risco",
        "caps de budget",
        "aprovacoes por excecao",
        "rotina de experimentos"
      ]
    }
  ],
  controls: [
    {
      id: "lgpd",
      area: "LGPD",
      owner: "Legal + Engenharia",
      rule: "Documentar base legal, cookies/pixels, opt-out e retencao por lead."
    },
    {
      id: "google-policy",
      area: "Google API User Data Policy",
      owner: "Security + Tech Lead",
      rule: "Aplicar escopo minimo, disclosures corretos e uso limitado aos fins declarados."
    },
    {
      id: "ads-governance",
      area: "Ads Governance",
      owner: "Midia + QA",
      rule: "Toda copy e landing precisam passar por checklist de politica antes de publicar."
    },
    {
      id: "audit-log",
      area: "Auditoria",
      owner: "Produto + Engenharia",
      rule: "Toda decisao relevante precisa ter contexto, payload e aprovador registrados."
    }
  ],
  kpis: [
    "CPA, CAC, ROAS e spend pacing",
    "CTR, CVR e taxa de rejeicao por criativo",
    "Cliques organicos, posicao media e CTR do Search Console",
    "Tempo de resposta ao lead e taxa de follow-up",
    "Tempo entre insight detectado e acao aprovada"
  ]
};
