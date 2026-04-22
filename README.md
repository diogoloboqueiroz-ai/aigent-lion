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
10. o studio criativo usa ferramentas externas para criar drafts, exports e videos, mas segura a postagem ate sua aprovacao
11. o Lab de Engenharia permite conectar repositorios e abrir problemas tecnicos para o agente ler codigo e propor correcoes
12. o motor de conversao e os pedidos de pagamento tambem ficam isolados por empresa
13. a rota `/stack-martech` mostra a camada de expertise do agente nas ferramentas mais usadas em marketing e o nivel real de cobertura de cada uma
14. a rota `/agente-desktop` configura o acesso local ao computador para o agente gerar arquivos, organizar pastas e trabalhar com apps aprovados
15. a rota `/inteligencia-web` configura a pesquisa online e os updates em tempo real usados pelo agente
16. a rota `/empresas/[companyId]/social` concentra agenda de posts, social insights e fila de anuncios por empresa
17. o workspace social agora tambem pode iniciar conexoes reais para Meta/Instagram, LinkedIn, TikTok, YouTube e Google Business
18. a rota `/empresas/[companyId]/social/runtime` controla bindings, fila operacional e sincronizacao das plataformas sociais
19. o studio agora pode salvar plataforma sugerida, caption, asset URL, multiplos assets e landing URL para virar post social aproveitavel sem retrabalho
20. a runtime social agora tambem registra logs, executa publicacao organica real em Facebook, LinkedIn e Instagram (imagem unica e carousel) e sincroniza insights reais do Facebook quando o binding e o token permitem
21. a rota `/empresas/[companyId]/aprovacoes` centraliza aprovacoes de pagamento, publicacao, posts e anuncios
22. a rota `/empresas/[companyId]/scheduler` agenda e opera as rotinas recorrentes do Agent Lion, inclusive consumindo social sync e publicacao automatica de posts aprovados

## Proximas fases

1. Substituir snapshots mock por leituras reais nas APIs read-only, incluindo GA4 e Google Sheets.
2. Conectar progressivamente a stack martech catalogada em `/stack-martech`, priorizando as ferramentas prontas para OAuth/API.
3. Adicionar armazenamento persistente de auditoria e experimento.
4. Criar tela de aprovacoes para criativos, budgets e automacoes.
