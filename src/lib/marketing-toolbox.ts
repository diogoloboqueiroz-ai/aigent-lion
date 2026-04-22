export type MarketingToolCoverage =
  | "integrado"
  | "oauth_api_pronto"
  | "browser_assisted"
  | "playbook_pronto";

export type MarketingToolApproval =
  | "livre_interno"
  | "aprovacao_publicacao"
  | "aprovacao_gasto"
  | "aprovacao_mudanca_sensivel";

export type MarketingToolCategory = {
  id: string;
  label: string;
  summary: string;
  tools: MarketingToolExpertise[];
};

export type MarketingToolExpertise = {
  id: string;
  name: string;
  vendor: string;
  categoryId: string;
  marketRole: string;
  whyItMatters: string;
  coverage: MarketingToolCoverage;
  approval: MarketingToolApproval;
  capabilities: string[];
};

const marketingToolbox: MarketingToolCategory[] = [
  {
    id: "analytics-bi",
    label: "Analytics e BI",
    summary: "Base para leitura de funil, atribuicao, consolidado executivo e rotinas de dados.",
    tools: [
      buildTool("ga4", "Google Analytics 4", "Google", "analytics-bi", "Analytics de site e app", "Ler funil, canais, receita e eventos para orientar estrategia.", "integrado", "livre_interno", ["runReport", "funil", "conversoes", "channel mix"]),
      buildTool("search-console", "Google Search Console", "Google", "analytics-bi", "Busca organica", "Monitorar cliques, impressoes, CTR, queries e cobertura organica.", "integrado", "livre_interno", ["queries", "paginas", "seo tecnico", "sitemaps"]),
      buildTool("google-sheets", "Google Sheets", "Google", "analytics-bi", "Operacao e consolidado", "Organizar KPIs, backlog, alertas e relatorios operacionais por empresa.", "integrado", "livre_interno", ["kpi sheets", "executive summaries", "alertas", "backlog"]),
      buildTool("looker-studio", "Looker Studio", "Google", "analytics-bi", "Dashboards", "Transformar fontes em dashboards executivos e de performance.", "playbook_pronto", "livre_interno", ["dashboards", "visualizacao", "diretoria"]),
      buildTool("bigquery", "BigQuery", "Google", "analytics-bi", "Data warehouse", "Concentrar dados de marketing, CRM e funil para analise mais profunda e historica.", "playbook_pronto", "livre_interno", ["warehouse", "joins", "historico", "modelagem"]),
      buildTool("hotjar", "Hotjar / Microsoft Clarity", "Hotjar/Microsoft", "analytics-bi", "Comportamento e CRO", "Investigar mapa de calor, gravacoes e pontos de friccao.", "playbook_pronto", "livre_interno", ["heatmaps", "recordings", "ux friction"]),
      buildTool("tableau", "Tableau / Power BI", "Salesforce/Microsoft", "analytics-bi", "BI avancado", "Consolidar leitura multi-fonte em analise de negocio e cohorts.", "playbook_pronto", "livre_interno", ["bi", "cohorts", "forecast"])
    ]
  },
  {
    id: "paid-media",
    label: "Midia Paga e Presenca",
    summary: "Ferramentas centrais para aquisicao, distribuicao e presenca local com controle de gasto.",
    tools: [
      buildTool("google-ads", "Google Ads", "Google", "paid-media", "Busca e performance", "Estruturar campanhas, keywords, assets, budget e leitura de CPA/ROAS.", "oauth_api_pronto", "aprovacao_gasto", ["search", "pmax", "keywords", "bidding"]),
      buildTool("google-ads-editor", "Google Ads Editor", "Google", "paid-media", "Edicao em massa", "Acelerar reestruturacao, bulk edits e governanca de campanhas grandes.", "playbook_pronto", "aprovacao_gasto", ["bulk edits", "campaign structure", "offline review"]),
      buildTool("meta-ads-manager", "Meta Ads Manager", "Meta", "paid-media", "Social paid", "Operar campanhas, criativos, audiencias e ciclo de aprendizado em Meta.", "oauth_api_pronto", "aprovacao_gasto", ["campaigns", "adsets", "creatives", "audiences"]),
      buildTool("meta-business-suite", "Meta Business Suite", "Meta", "paid-media", "Operacao social", "Gerir calendario, caixa de entrada, publicacoes e ativos da operacao Meta.", "browser_assisted", "aprovacao_publicacao", ["publishing", "inbox", "calendar", "social ops"]),
      buildTool("meta-commerce-manager", "Meta Commerce Manager", "Meta", "paid-media", "Catalogo social", "Controlar catalogo, produtos e experiencias de comercio em Meta.", "playbook_pronto", "aprovacao_mudanca_sensivel", ["catalog", "product sets", "commerce"]),
      buildTool("linkedin-ads", "LinkedIn Ads", "LinkedIn", "paid-media", "B2B paid", "Ativar campanhas de geracao de demanda para publico profissional.", "playbook_pronto", "aprovacao_gasto", ["b2b", "lead gen", "account targeting"]),
      buildTool("tiktok-ads", "TikTok Ads", "TikTok", "paid-media", "Video social", "Distribuir criativos curtos, creator-style e escalar awareness e performance.", "playbook_pronto", "aprovacao_gasto", ["short video", "ugccreative", "social scale"]),
      buildTool("merchant-center", "Google Merchant Center", "Google", "paid-media", "Catalogo e shopping", "Sincronizar feed, produtos e performance de ecommerce.", "playbook_pronto", "aprovacao_mudanca_sensivel", ["shopping feeds", "catalog", "product ads"]),
      buildTool("business-profile", "Google Business Profile", "Google", "paid-media", "Presenca local", "Cuidar de dados locais, horarios, atributos e reputacao operacional.", "oauth_api_pronto", "aprovacao_mudanca_sensivel", ["local seo", "horarios", "atributos", "perfil local"])
    ]
  },
  {
    id: "seo-content",
    label: "SEO e Conteudo",
    summary: "Camada de descoberta, autoridade, pesquisa de pauta e distribuicao organica.",
    tools: [
      buildTool("semrush", "Semrush", "Semrush", "seo-content", "Pesquisa competitiva", "Expandir keywords, tracking de ranking e inteligencia de concorrentes.", "playbook_pronto", "livre_interno", ["keyword gap", "serp analysis", "rank tracking"]),
      buildTool("ahrefs", "Ahrefs", "Ahrefs", "seo-content", "SEO e backlinks", "Mapear conteudo, backlinks, oportunidades e lacunas organicas.", "playbook_pronto", "livre_interno", ["backlinks", "keywords", "content gap"]),
      buildTool("wordpress", "WordPress", "WordPress", "seo-content", "CMS", "Publicar paginas, posts, landing pages e evoluir arquitetura de conteudo.", "playbook_pronto", "aprovacao_publicacao", ["cms", "landing pages", "blog"]),
      buildTool("youtube-studio", "YouTube Studio", "Google", "seo-content", "Video organico", "Versionar metadata, playlists e distribuicao de video.", "playbook_pronto", "aprovacao_publicacao", ["video seo", "metadata", "playlists"]),
      buildTool("google-trends", "Google Trends", "Google", "seo-content", "Pesquisa de demanda", "Detectar sazonalidade, comparacao de termos e timing de conteudo.", "playbook_pronto", "livre_interno", ["trends", "seasonality", "topic research"]),
      buildTool("notion-seo", "Notion", "Notion", "seo-content", "Calendario e briefing", "Organizar pauta, briefings, playbooks e backlog editorial.", "playbook_pronto", "livre_interno", ["editorial calendar", "knowledge base", "briefs"])
    ]
  },
  {
    id: "crm-lifecycle",
    label: "CRM, Email e Lifecycle",
    summary: "Ferramentas para captar, nutrir, vender melhor e trabalhar reativacao sem perder governanca.",
    tools: [
      buildTool("hubspot", "HubSpot", "HubSpot", "crm-lifecycle", "CRM e automacao", "Orquestrar funil, lead status, email e automacoes comerciais.", "integrado", "aprovacao_mudanca_sensivel", ["crm", "automation", "lifecycle", "pipeline"]),
      buildTool("rd-station", "RD Station", "RD Station", "crm-lifecycle", "Marketing automation", "Operar inbound, nutricao, automacoes e lead scoring no contexto Brasil.", "playbook_pronto", "aprovacao_mudanca_sensivel", ["landing pages", "emails", "automations"]),
      buildTool("mailchimp", "Mailchimp", "Mailchimp", "crm-lifecycle", "Email marketing", "Criar campanhas, segmentacoes e jornadas simples de email.", "playbook_pronto", "aprovacao_publicacao", ["newsletter", "segments", "journeys"]),
      buildTool("klaviyo", "Klaviyo", "Klaviyo", "crm-lifecycle", "Retention e ecommerce", "Ativar abandono, recompra, campanhas e fluxos baseados em comportamento.", "playbook_pronto", "aprovacao_publicacao", ["retention", "ecommerce", "behavioral flows"]),
      buildTool("activecampaign", "ActiveCampaign", "ActiveCampaign", "crm-lifecycle", "Automacao e CRM leve", "Conectar formularios, tags, lead scoring e sequencias orientadas a venda.", "playbook_pronto", "aprovacao_mudanca_sensivel", ["automation", "crm lite", "lead scoring"]),
      buildTool("gmail", "Gmail", "Google", "crm-lifecycle", "Email operacional", "Enviar follow-ups e cadencias com escopo minimo e trilha de auditoria.", "oauth_api_pronto", "aprovacao_publicacao", ["send-only", "follow-up", "operational email"])
    ]
  },
  {
    id: "creative-social",
    label: "Criacao, Edicao e Social",
    summary: "Ferramentas para gerar assets, editar imagem e video, adaptar formatos e operar publicacao social assistida.",
    tools: [
      buildTool("openai-chatgpt", "OpenAI / ChatGPT", "OpenAI", "creative-social", "Copy e estrategia", "Gerar copy, roteiros, prompts, variacoes e analise de oferta.", "integrado", "livre_interno", ["copy", "scripts", "analysis", "creative ideation"]),
      buildTool("canva", "Canva", "Canva", "creative-social", "Design rapido", "Criar pecas, adaptar formatos sociais e manter consistencia visual.", "oauth_api_pronto", "aprovacao_publicacao", ["design", "resize", "templates", "exports"]),
      buildTool("photoshop", "Adobe Photoshop API", "Adobe", "creative-social", "Edicao visual", "Executar recortes, mockups, variacoes e pos-producao controlada.", "oauth_api_pronto", "aprovacao_publicacao", ["editing", "mockups", "background removal"]),
      buildTool("adobe-express", "Adobe Express", "Adobe", "creative-social", "Pecas e video curto", "Montar criativos rapidos e adaptacoes multi-formato.", "browser_assisted", "aprovacao_publicacao", ["quick social", "brand templates", "video snippets"]),
      buildTool("premiere-pro", "Adobe Premiere Pro", "Adobe", "creative-social", "Edicao de video", "Refinar cortes, storytelling, versoes e entregas de video em nivel profissional.", "playbook_pronto", "aprovacao_publicacao", ["video editing", "cuts", "exports", "social versions"]),
      buildTool("after-effects", "Adobe After Effects", "Adobe", "creative-social", "Motion design", "Criar animacoes, motion graphics e vinhetas para pecas premium.", "playbook_pronto", "aprovacao_publicacao", ["motion", "animation", "visual polish"]),
      buildTool("lightroom", "Adobe Lightroom", "Adobe", "creative-social", "Tratamento de imagem", "Padronizar cor, melhorar fotos e preparar banco visual para campanha.", "playbook_pronto", "aprovacao_publicacao", ["color grading", "photo treatment", "presets"]),
      buildTool("google-vids", "Google Vids", "Google", "creative-social", "Video colaborativo", "Montar videos a partir de materiais do Workspace e roteiros do agente.", "browser_assisted", "aprovacao_publicacao", ["workspace video", "scripts", "voiceover"]),
      buildTool("youtube-studio-creative", "YouTube Studio", "Google", "creative-social", "Distribuicao de video", "Preparar metadata, thumbnails, shorts e filas de publicacao.", "playbook_pronto", "aprovacao_publicacao", ["metadata", "thumbnails", "shorts"]),
      buildTool("capcut", "CapCut", "CapCut", "creative-social", "Video curto", "Editar reels, shorts e UGC com foco em agilidade.", "playbook_pronto", "aprovacao_publicacao", ["short video", "captions", "reels"]),
      buildTool("figma", "Figma", "Figma", "creative-social", "Colaboracao criativa", "Estruturar wireframes, direcao visual e handoff de pecas e paginas.", "playbook_pronto", "livre_interno", ["wireframes", "mockups", "handoff"])
    ]
  },
  {
    id: "automation-ops",
    label: "Automacao e Operacao",
    summary: "Ferramentas para tagueamento, integracao, acompanhamento de time e automacao do dia a dia.",
    tools: [
      buildTool("gtm", "Google Tag Manager", "Google", "automation-ops", "Tagueamento", "Gerenciar eventos, pixels e tracking sem depender de deploy simples.", "playbook_pronto", "aprovacao_mudanca_sensivel", ["tracking", "pixels", "events"]),
      buildTool("google-drive", "Google Drive", "Google", "automation-ops", "Repositorio operacional", "Centralizar ativos, relatorios, briefs e materiais em fluxo de trabalho.", "oauth_api_pronto", "livre_interno", ["storage", "versioning", "handoff"]),
      buildTool("zapier", "Zapier", "Zapier", "automation-ops", "Integracao no-code", "Conectar apps, leads, alertas e automacoes operacionais.", "playbook_pronto", "aprovacao_mudanca_sensivel", ["integrations", "alerts", "lead routing"]),
      buildTool("make", "Make", "Make", "automation-ops", "Automacao visual", "Montar cenarios de integracao mais flexiveis e encadeados.", "playbook_pronto", "aprovacao_mudanca_sensivel", ["workflows", "multi-step automation", "ops"]),
      buildTool("slack", "Slack", "Slack", "automation-ops", "Operacao de time", "Disparar alertas, aprovacoes e comunicacao interna do agente.", "playbook_pronto", "livre_interno", ["alerts", "approvals", "team comms"]),
      buildTool("notion", "Notion", "Notion", "automation-ops", "Base operacional", "Centralizar playbooks, aprovacoes, briefing e acompanhamento.", "playbook_pronto", "livre_interno", ["wiki", "playbooks", "briefs", "tasks"]),
      buildTool("asana", "Asana / Trello", "Asana/Trello", "automation-ops", "Gestao de execucao", "Transformar plano em fila, ownership e follow-up operacional.", "playbook_pronto", "livre_interno", ["task management", "owner tracking", "execution"])
    ]
  }
];

export function getMarketingToolbox() {
  return marketingToolbox;
}

export function getMarketingToolboxSummary() {
  const tools = marketingToolbox.flatMap((category) => category.tools);

  return {
    categories: marketingToolbox.length,
    tools: tools.length,
    integrated: tools.filter((tool) => tool.coverage === "integrado").length,
    oauthOrApiReady: tools.filter((tool) => tool.coverage === "oauth_api_pronto").length,
    browserAssisted: tools.filter((tool) => tool.coverage === "browser_assisted").length,
    playbookReady: tools.filter((tool) => tool.coverage === "playbook_pronto").length
  };
}

export function getMarketingVendorFamilies() {
  const families = new Map<
    string,
    {
      vendor: string;
      tools: MarketingToolExpertise[];
    }
  >();

  for (const tool of marketingToolbox.flatMap((category) => category.tools)) {
    const entry = families.get(tool.vendor) ?? { vendor: tool.vendor, tools: [] };
    entry.tools.push(tool);
    families.set(tool.vendor, entry);
  }

  return [...families.values()]
    .map((entry) => ({
      ...entry,
      integrated: entry.tools.filter((tool) => tool.coverage === "integrado").length,
      apiReady: entry.tools.filter((tool) => tool.coverage === "oauth_api_pronto").length
    }))
    .sort((left, right) => right.tools.length - left.tools.length || left.vendor.localeCompare(right.vendor));
}

export function buildMarketingToolPromptContext() {
  return marketingToolbox
    .map(
      (category) =>
        `${category.label}: ${category.tools.map((tool) => tool.name).join(", ")}.`
    )
    .join("\n");
}

export function getCoverageLabel(coverage: MarketingToolCoverage) {
  switch (coverage) {
    case "integrado":
      return "integrado agora";
    case "oauth_api_pronto":
      return "pronto para OAuth/API";
    case "browser_assisted":
      return "browser-assisted";
    default:
      return "playbook pronto";
  }
}

export function getApprovalLabel(approval: MarketingToolApproval) {
  switch (approval) {
    case "livre_interno":
      return "livre para operacao interna";
    case "aprovacao_publicacao":
      return "aprovacao antes de publicar";
    case "aprovacao_gasto":
      return "aprovacao antes de gastar";
    default:
      return "aprovacao para mudanca sensivel";
  }
}

function buildTool(
  id: string,
  name: string,
  vendor: string,
  categoryId: string,
  marketRole: string,
  whyItMatters: string,
  coverage: MarketingToolCoverage,
  approval: MarketingToolApproval,
  capabilities: string[]
): MarketingToolExpertise {
  return {
    id,
    name,
    vendor,
    categoryId,
    marketRole,
    whyItMatters,
    coverage,
    approval,
    capabilities
  };
}
