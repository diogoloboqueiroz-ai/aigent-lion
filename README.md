# Agent Lion

Projeto novo, isolado da landing page, para estruturar uma operacao de marketing com IA de forma modular, auditavel e segura.

## O que existe aqui

- Dashboard inicial em Next.js App Router
- Blueprint tipado do agente de marketing
- API interna para expor arquitetura, integracoes, guardrails e roadmap
- Base pronta para evoluir para conectores read-only, auditoria e policy engine
- Camada de dados por empresa para Google Analytics, Search Console e Google Sheets operacionais
- Camada global de expertise martech com mapeamento das ferramentas mais usadas do mercado
- Camada de agente desktop local para operar arquivos, pastas, exports e apps aprovados no computador
- Camada de inteligencia web para pesquisa online e atualizacoes em tempo real
- Camada de social ops para agenda, posts programados, anuncios e estatisticas por plataforma
- Camada de runtime social para bindings por plataforma, fila operacional e sync de estatisticas por empresa
- Camada de Campaign Intelligence para transformar tese CMO, funil, canais, copy, prompts visuais, riscos e experimentos em um brief acionavel por empresa
- Camada Supreme Brain em `src/core/aigent-lion` para unificar diagnostico, CMO thesis, decisoes, policy, learning, Campaign OS, criatividade e observabilidade em uma resposta operacional unica
- Mission Control premium por empresa em `/empresas/[companyId]/mission-control`, com estado do cerebro, worker, execution plane, observability channel, gargalos, next best actions e memoria estrategica
- Chat operacional do Aigent Lion em `/empresas/[companyId]/aigent` e API dedicada em `/api/companies/[companyId]/aigent-lion/chat`, sempre usando o Supreme Brain em vez de chatbot generico
- Aigent Evolution Center em `/empresas/[companyId]/evolution-center`, usando API `/api/companies/[companyId]/aigent-lion/evolution` para rodar Self-Improvement Engine, Codex Task Generator e Release Risk Analyzer
- Campaign OS em `src/core/marketing/campaign-os.ts` para gerar campanha multicanal completa com funil, copies, ads, calendario, experimentos, analytics, riscos e plano de aprovacao
- Multimodal Creative Engine em `src/core/creative` para prompts de imagem, roteiros de video, storyboard, thumbnail, QA criativo e riscos de claim/compliance
- Learning rigor em `src/core/learning/learning-rigor.ts` para classificar evidencias, evitar falsos positivos, aplicar decay de confianca e limitar reuso por canal/segmento
- Production gates em `src/core/runtime/production-gates.ts` e `npm run agent:production:check` para impedir configuracao insegura do agente em producao
- Self-Improvement Engine em `src/core/aigent-lion/self-improvement-engine.ts` para transformar sinais fracos do produto em tarefas Codex acionaveis com risco de release e aprovacao
- Ativacao segura de campanha para transformar briefs materializados em drafts de posts e ads pendentes de aprovacao
- Ponte Approval Center -> Social Runtime para enviar posts/ads aprovados para a fila operacional com origem do brief preservada
- Executor social real com logs persistidos, publicacao organica em Facebook/LinkedIn e sync vivo de Facebook quando a conta estiver pronta
- Ponte entre Studio e Social Ops para reaproveitar assets aprovados, captions e links de destino
- Publicacao real de imagem unica e carousel no Instagram Business quando os assets publicos e o binding estiverem prontos
- Approval Center unificado para pagamentos, publicacoes, posts sociais e anuncios
- Scheduler recorrente por empresa para digest de aprovacoes, relatorios, social sync, publicacao automatica, ads health e rotinas de CRM/SEO

## Rodar localmente

```bash
npm install
npm run dev
```

## Variaveis de ambiente da fase 1

Use `.env.example` como base. Nesta etapa, o projeto ja sabe verificar readiness de conectores read-only para:

- GA4
- Search Console
- Google Ads
- Meta Marketing API
- Login do operador via Google

Mesmo sem credenciais, o dashboard e a API de overview funcionam com snapshots mock para evoluirmos a interface e o modelo canonico com seguranca.

Para habilitar login e onboarding de contas Google por empresa, configure tambem:

- `AUTH_SESSION_SECRET`
- `VAULT_ENCRYPTION_KEY`

Para habilitar onboarding social real por empresa, configure tambem:

- `META_APP_ID`
- `META_APP_SECRET`
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `LINKEDIN_API_VERSION`
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`

## Multiempresa

O app agora foi desenhado para atuar como uma torre de controle multiempresa:

- uma conta de operador entra via Google
- cada empresa tem workspace individual
- cada workspace tem contas, conexoes, auditoria e snapshots isolados
- cada empresa tem um perfil individual do agente com voz, ICP, oferta, canais e regras de eficiencia
- cada empresa tem planejamento estrategico, metas, rituais e benchmark de concorrentes salvos individualmente
- cada empresa pode gerar radar diario de concorrentes e relatorio semanal especializado de marketing
- cada empresa tem um motor de conversao com keywords, long tails, mensagens de landing e regras de otimizacao
- cada empresa pode gerar um plano operacional assistido com campanhas, conteudo, SEO, automacoes e matriz de aprovacao
- cada empresa tem uma central `/empresas/[companyId]/campanhas` que traduz o cerebro estrategico em plano multicanal, experimentos, QA criativo e analytics
- cada empresa tem uma central `/empresas/[companyId]/mission-control` que mostra o Supreme Brain como torre operacional: estado do agente, CMO thesis, risco, policy, learning, fila, dead-letter e next best actions
- cada empresa tem um chat operacional `/empresas/[companyId]/aigent` para conversar com o Aigent Lion e receber diagnostico, plano, ativos, agentes usados, riscos, aprovacao e proximas acoes
- cada empresa tem um `/empresas/[companyId]/evolution-center` para o proprio Lion revisar sua maturidade, gerar tarefas Codex e exigir aprovacao quando o release tiver risco alto
- cada empresa pode manter uma operacao de dados propria, com GA4, Search Console e Google Sheets para relatorios, alertas e consolidacao de KPI
- cada empresa pode ter uma operacao social completa com Instagram, Facebook, Google, LinkedIn, TikTok e YouTube para calendario, posts programados, anuncios e insights
- o onboarding social agora ja possui fluxo OAuth por empresa para Meta/Instagram, LinkedIn e TikTok, com conexoes salvas em cofre criptografado por workspace
- cada empresa agora tambem possui runtime social com alvo operacional por plataforma, fila de publicacao e sync analitico auditavel
- cada empresa agora possui tambem um Approval Center unico e um Scheduler dedicado para organizar o trabalho recorrente do Agent Lion
- cada empresa tem um studio criativo para conectar OpenAI/ChatGPT, Canva, Adobe/Photoshop, Google Drive, YouTube e fluxos browser-assisted como Google Vids
- o studio criativo agora cobre tambem Gemini, Claude, Runway, Premiere Pro, After Effects, Lightroom, CapCut e Figma
- o agente pode criar assets com autonomia, mas qualquer publicacao entra obrigatoriamente em fila de aprovacao antes de postar
- cada empresa tambem pode ter um Lab de Engenharia para leitura de codigo, backlog tecnico, investigacao de bugs e geracao de solucoes
- cada empresa pode manter um perfil financeiro com aprovacao obrigatoria antes de qualquer pagamento
- o operador tambem possui um perfil profissional proprio, salvo por login Google, para ensinar ao agente seu jeito de pensar estrategia, custo, aprovacao e crescimento
- o agente pode crescer para conectar Google Ads, GA4, Search Console, Gmail, Business Profile e Meta por empresa
- o agente carrega uma matriz de expertise em stack martech, cobrindo analytics, BI, CRM, automacao, SEO, midia paga, social, criacao e operacao
- o agente tambem pode agir localmente no computador, gerando arquivos e organizando pastas e apps aprovados, com guardrails para publicacao, pagamento e acoes sensiveis
- o agente pode pesquisar a internet e acompanhar atualizacoes em tempo real com dominios, fontes e topicos aprovados
- conexoes Google por empresa ficam guardadas em cofre criptografado local para desenvolvimento

Fluxo atual de onboarding:

1. operador entra com Google
2. abre o workspace da empresa
3. clica em "Conectar com Google" no canal desejado
4. o agente guarda a autorizacao no cofre local criptografado e atualiza o workspace
5. o perfil individual do agente pode ser refinado e salvo separadamente para cada empresa
6. o operador pode treinar sua memoria profissional em `/perfil-profissional`
7. o planejamento estrategico e os relatorios passam a considerar esse contexto profissional junto com o perfil da empresa
8. o plano operacional transforma estrategia em execucao com trilhas por canal e fila de aprovacao
9. a area `/empresas/[companyId]/dados` configura como o agente usa GA4, Search Console e Google Sheets internamente para operar a empresa
10. a rota `/empresas/[companyId]/campanhas` mostra o brief vivo de campanha: funil, canais, copies, prompts visuais, riscos, analytics e experimentos
11. a rota `/empresas/[companyId]/mission-control` mostra o cerebro operacional completo: status, gargalo dominante, CMO thesis, next best actions, Campaign OS, approvals, learning memory e Creative Engine
12. a rota `/empresas/[companyId]/aigent` permite conversar com o Aigent Lion usando o Supreme Brain, com resposta estruturada para diagnostico, estrategia, plano, ativos, riscos, metricas e aprendizado
13. a rota `/empresas/[companyId]/evolution-center` executa a autoavaliacao operacional do Lion, gera tarefas Codex reais e analisa risco de release
14. o studio criativo usa ferramentas externas para criar drafts, exports e videos, mas segura a postagem ate sua aprovacao
15. o Lab de Engenharia permite conectar repositorios e abrir problemas tecnicos para o agente ler codigo e propor correcoes
16. o motor de conversao e os pedidos de pagamento tambem ficam isolados por empresa
17. a rota `/stack-martech` mostra a camada de expertise do agente nas ferramentas mais usadas em marketing e o nivel real de cobertura de cada uma
18. a rota `/agente-desktop` configura o acesso local ao computador para o agente gerar arquivos, organizar pastas e trabalhar com apps aprovados
19. a rota `/inteligencia-web` configura a pesquisa online e os updates em tempo real usados pelo agente
20. a rota `/empresas/[companyId]/social` concentra agenda de posts, social insights e fila de anuncios por empresa
21. o workspace social agora tambem pode iniciar conexoes reais para Meta/Instagram, LinkedIn, TikTok, YouTube e Google Business
22. a rota `/empresas/[companyId]/social/runtime` controla bindings, fila operacional e sincronizacao das plataformas sociais
23. o studio agora pode salvar plataforma sugerida, caption, asset URL, multiplos assets e landing URL para virar post social aproveitavel sem retrabalho
24. a runtime social agora tambem registra logs, executa publicacao organica real em Facebook, LinkedIn e Instagram (imagem unica e carousel) e sincroniza insights reais do Facebook quando o binding e o token permitem
25. a rota `/empresas/[companyId]/aprovacoes` centraliza aprovacoes de pagamento, publicacao, posts e anuncios
26. a rota `/empresas/[companyId]/scheduler` agenda e opera as rotinas recorrentes do Agent Lion, inclusive consumindo social sync e publicacao automatica de posts aprovados

## Proximas fases

1. Substituir snapshots mock por leituras reais nas APIs read-only, incluindo GA4 e Google Sheets.
2. Conectar progressivamente a stack martech catalogada em `/stack-martech`, priorizando as ferramentas prontas para OAuth/API.
3. Adicionar armazenamento persistente de auditoria e experimento.
4. Criar tela de aprovacoes para criativos, budgets e automacoes.
