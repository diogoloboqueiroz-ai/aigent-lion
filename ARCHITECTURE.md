# Agent Lion Architecture

## Status

Este documento registra a arquitetura apos as Fases 1 a 6 do endurecimento arquitetural do Agent Lion. O sistema ja possui um nucleo autonomo funcional, policy engine deterministico, runtime com intents e circuit breakers, persistencia tenant-scoped para trilhas criticas, learning loop formal com experiment outcomes/playbooks e um passe inicial de seguranca e testes.

O projeto ainda convive com duas camadas:

- uma camada legacy em `src/lib`, onde ainda vivem especialistas, hidratacao de workspace e parte do runtime
- uma camada core/infrastructure mais explicita, que esta se tornando a espinha dorsal do agente

A direcao continua sendo evoluir sem reescrever do zero.

O plano operacional de convergencia entre `src/core/*` e `src/lib/agents/*` esta registrado em [CORE_CONVERGENCE_PLAN.md](C:\Users\sarha\OneDrive\Desktop\super-agencia-ia\CORE_CONVERGENCE_PLAN.md).

## Product Intent

O Agent Lion nao e um chatbot nem um dashboard. Ele deve operar como um growth operating system multiempresa capaz de:

- perceber sinais internos e externos
- montar contexto persistente por tenant
- diagnosticar gargalos
- priorizar a melhor acao seguinte
- aplicar policy e autonomia por risco
- executar acoes ou abrir approvals
- observar resultado
- aprender com o efeito da decisao
- repetir o ciclo continuamente

## Current Architecture Snapshot

### Interface and control plane

- `src/app/empresas/[companyId]/*`
  - paginas de operacao, social, conversao, engenharia, scheduler, studio, aprovacoes e relatorios
- `src/app/empresas/[companyId]/campanhas`
  - central premium que materializa tese CMO, funil, canais, copy angles, prompts visuais, riscos e experimentos
- `src/app/api/*`
  - rotas HTTP da app e rotas por empresa
- `src/app/api/agent/*`
  - API dedicada ao nucleo autonomo (`run`, `diagnose`, `decide`, `learn`)

### Current domain and orchestration layer

- `src/lib/domain.ts`
  - tipos centrais do produto, incluindo perfil de empresa, conexoes, leads, social runtime, automation runs, queue, dead-letter e RBAC inicial
- `src/lib/agents/*`
  - nucleo do agente autonomo:
  - `orchestrator.ts`
  - `diagnostic-engine.ts`
  - `decision-engine.ts`
  - `cmo-agent.ts`
  - `policy-engine.ts`
  - `execution-engine.ts`
  - `execution-dispatch.ts`
  - `memory-engine.ts`
  - `runtime.ts`
  - `worker.ts`
  - `queue-processor.ts`
  - `reliability.ts`
  - `policy-registry.ts`

### Extracted core

- `src/core/domain/*`
  - contratos centrais do agente, sinais, contexto e traces de decisao
- `src/core/decision/*`
  - decision engine explicito, action planner, diagnostic core e CMO strategy testaveis
- `src/core/policy/*`
  - policy registry, policy matrix por tenant, autonomy scoring e avaliacao deterministica
- `src/core/learning/*`
  - learning engine, estatistica leve de evidencia e consolidacao formal de outcomes
- `src/core/marketing/*`
  - campaign intelligence: transforma workspace, CMO strategy, scorecards e playbooks em brief multicanal acionavel
  - campaign activation: materializa briefs em drafts seguros de posts e ads, sempre pendentes de aprovacao
- `src/core/audit/*`
  - decision provenance
- `src/core/runtime/*`
  - execution intents, gates, circuit breakers, runtime helpers, job planner e lifecycle do run

### Infrastructure layer

- `src/infrastructure/persistence/*`
  - repositorios tenant-scoped para automacao/runtime
- `src/infrastructure/secrets/*`
  - store separada para credenciais por tenant

### Existing product specialists

- `src/lib/execution.ts`
  - scorecards e recomendacoes de crescimento
- `src/lib/learning.ts`
  - memorizacao e consolidacao de learnings
- `src/lib/social-execution.ts`
  - execucao por canais sociais e ads
- `src/lib/approvals-center.ts`
  - unifica aprovacoes de pagamento, studio, posts e ads; drafts de campanha aprovados podem seguir para Social Runtime
- `src/lib/conversion-runtime.ts`
  - dispatch de eventos de conversao
- `src/lib/crm.ts`
  - CRM profile, roteamento e sync inicial
- `src/lib/site-ops.ts` / `src/lib/site-cms.ts`
  - operacao de sites, capture e CMS
- `src/lib/creative-tools.ts`
  - studio criativo, assets, QA e ponte com social
- `src/lib/scheduler.ts`
  - jobs recorrentes por empresa
- `src/lib/governance.ts`
  - auditoria atual e eventos de governanca

### Persistence and state

- `src/lib/company-vault.ts`
  - facade historica para business state legado e compatibilidade
- `src/lib/durable-store.ts`
  - provider ativo do durable store
- `src/lib/durable-store-provider.ts`
  - contrato do store
- `src/lib/durable-store-file.ts`
  - fallback local JSON para dev/local
- `src/infrastructure/persistence/managed-automation-store.ts`
  - backend gerenciado Postgres para runtime critico
- `src/scripts/check-managed-automation-store.ts`
  - schema check operacional para CI/deploy
- `src/infrastructure/persistence/worker-heartbeat-store.ts`
  - heartbeat do worker para control tower
- `src/infrastructure/persistence/company-automation-storage.ts`
  - espelhamento e merge de runs, queue, dead-letter e audit
- `src/infrastructure/persistence/company-connection-storage.ts`
  - metadata e hidratacao tenant-scoped de conexoes
- `src/infrastructure/persistence/company-social-storage.ts`
  - perfis sociais, bindings, posts, ad drafts, insights, runtime tasks e logs por tenant
- `src/infrastructure/persistence/company-commercial-storage.ts`
  - CRM profile, site ops profile, leads e conversion events por tenant
- `src/infrastructure/persistence/company-campaign-storage.ts`
  - briefs materializados por tenant, versionados para memoria operacional de campanhas
- `src/infrastructure/persistence/company-policy-matrix-storage.ts`
  - policy matrix persistida por tenant para governanca enterprise configuravel

## Bounded Contexts

### 1. Tenant Context

Responsavel por identidade da empresa, isolamento, profiles, estrategia, permissoes e mapa de conectores.

Codigo atual:

- `src/lib/domain.ts`
- `src/lib/connectors.ts`
- `src/lib/agent-profiles.ts`
- `src/lib/user-profiles.ts`
- `src/lib/rbac.ts`

### 2. Autonomous Decisioning

Responsavel por montar contexto, diagnosticar, definir tese, priorizar, avaliar policy e produzir intents de execucao.

Codigo atual:

- `src/lib/agents/memory-engine.ts`
- `src/lib/agents/diagnostic-engine.ts`
- `src/lib/agents/cmo-agent.ts`
- `src/lib/agents/decision-engine.ts`
- `src/lib/agents/policy-engine.ts`
- `src/lib/agents/policy-registry.ts`

### 3. Execution Runtime

Responsavel por jobs, fila, retries, runtime health, execution outcomes e contratos de execucao.

Codigo atual:

- `src/lib/agents/execution-engine.ts`
- `src/lib/agents/execution-dispatch.ts`
- `src/lib/agents/reliability.ts`
- `src/lib/agents/queue-processor.ts`
- `src/lib/agents/runtime.ts`
- `src/lib/agents/worker.ts`

### 4. Specialists / Growth Executors

Responsavel por executar trilhas profundas de dominio.

Codigo atual:

- `src/lib/social-execution.ts`
- `src/lib/conversion-runtime.ts`
- `src/lib/crm.ts`
- `src/lib/site-ops.ts`
- `src/lib/site-cms.ts`
- `src/lib/creative-tools.ts`
- `src/lib/google-data.ts`

### 5. Audit, Governance and Risk

Responsavel por approvals, trilha de auditoria, RBAC e autonomia por risco.

Codigo atual:

- `src/lib/governance.ts`
- `src/lib/approvals-center.ts`
- `src/lib/agents/policy-engine.ts`
- `src/lib/agents/policy-registry.ts`
- `src/lib/rbac.ts`

### 6. Learning and Experimentation

Responsavel por experimentos, scorecards, feedback, memorias e reuse seguro.

Codigo atual:

- `src/lib/learning.ts`
- `src/lib/execution.ts`
- `src/lib/agents/execution-engine.ts`
- `src/lib/agents/orchestrator.ts`

### 7. Persistence and Audit Store

Responsavel por estado critico, historico, queue, dead-letter, locks, audit e metadata de conectores.

Codigo atual:

- `src/lib/company-vault.ts`
- `src/lib/durable-store.ts`
- `src/lib/durable-store-provider.ts`
- `src/lib/durable-store-file.ts`
- `src/infrastructure/persistence/managed-automation-store.ts`
- `src/infrastructure/persistence/tenant-automation-repository.ts`
- `src/infrastructure/persistence/tenant-runtime-guard-repository.ts`
- `src/infrastructure/persistence/company-vault-storage.ts`
- `src/infrastructure/persistence/company-vault-hydration.ts`

## Critical Flows

### 1. Autonomous cycle

1. Trigger entra por API, scheduler ou runtime worker
2. `memory-engine` monta `CompanyContext`
3. `diagnostic-engine` produz findings
4. `cmo-agent` escolhe gargalo dominante e tese da semana
5. `decision-engine` prioriza acoes e oportunidades
6. `policy-engine` determina autonomia por risco
7. `execution-engine` prepara ou executa jobs permitidos
8. `feedback` gera learnings e atualiza memoria
9. `orchestrator` registra run, auditoria e proximos passos

### 2. Runtime and retry flow

1. Scheduler ou API enfileira `run_cycle`
2. `queue-processor` deduplica por `idempotencyKey`
3. Worker drena a queue
4. Falhas entram em retry com backoff
5. Falhas repetidas vao para dead-letter
6. `runtime.ts` agrega health e control tower summary

### 3. Specialist execution flow

1. Decision gera action e job
2. Policy permite ou bloqueia
3. `execution-engine` coordena o loop generico e delega para `execution-dispatch`
4. Especialista executa adaptador/conector
5. Outcome volta ao orchestrator
6. Learning loop recalibra scorecards e memoria

## Architectural Strengths

- O produto ja tem um nucleo autonomo explicito, nao apenas UI
- Existe nocao clara de multiempresa na maior parte dos modelos
- O ciclo ja tem policy, approvals e auditoria inicial
- Runtime ja possui queue, retry e dead-letter
- Ha especialistas reais por trilha critica: social, CRM, site, conversion, studio
- O scheduler ja conversa com o runtime autonomo
- O sistema ja registra learnings e influencia scorecards com memoria persistida

## Current Architectural Gaps

### 1. Core still mixed with legacy `src/lib`

A maior parte da inteligencia ainda vive em `src/lib`, com dominio, runtime, conectores e adaptadores no mesmo namespace logico. Isso dificulta:

- boundary enforcement
- isolamento de infraestrutura
- testes de tenancy
- reuso seguro do core fora do Next runtime

### 2. Persistence is improved, but still needs operational hardening

O durable store abstraido agora tem caminho gerenciado e fallback local JSON. As fragilidades restantes sao mais operacionais e de consolidacao:

- Postgres precisa ser obrigatorio nos ambientes reais
- ainda nao ha migration/schema check formal em pipeline
- `company-vault.ts` ainda guarda varias colecoes historicas
- ainda faltam repositorios dedicados por agregado restante
- append-only provenance ainda pode ser separado melhor de business state legado

### 3. Decision provenance is incomplete

O sistema ja registra runs e auditoria, mas ainda nao reconstitui completamente:

- quais sinais entraram
- quais hipoteses foram comparadas
- por que uma candidata perdeu para outra
- qual contexto versionado embasou a decisao

### 4. Policy model is still too narrow

Ja existe policy deterministica e policy matrix persistida por tenant, mas ainda falta ampliar a biblioteca de regras enterprise para:

- blast radius
- reputational risk
- compliance risk
- connector health floor
- confidence floor por action type
- required approvers por tenant ou categoria mais granular

### 5. Multi-tenancy is present, but isolation is not hardened

O tenant model conceitual existe, porem ainda faltam:

- repositorios explicitamente tenant-scoped
- testes de isolamento entre tenants
- limites mais formais entre secrets e business state
- controles mais fortes de autorizacao por empresa e por acao

### 6. UI and application layer still know too much

As rotas estao mais finas do que antes, mas a arquitetura ainda nao separa com nitidez:

- use cases da aplicacao
- interfaces HTTP
- runtime/worker
- conectores de infraestrutura

## Production Risks

### Security

- segredo de sessao agora falha de forma segura em producao se `AUTH_SESSION_SECRET` estiver ausente
- credenciais operacionais ja saem do business state principal e vao para `src/infrastructure/secrets/*`
- RBAC agora pode restringir acesso por tenant, mas ainda falta granularidade total por empresa/acao
- logging sensivel continua sob disciplina manual; o proximo passo e padronizar redaction helpers nos conectores

### Reliability

- worker dedicado existe em `src/scripts/agent-worker.ts`
- modo externo bloqueia consumo inline em producao sem override
- queue, dead-letter, intents e circuit breakers ja podem usar store gerenciada
- schema check existe via `npm run agent:store:check`
- heartbeat do worker entra no control tower
- restart supervisionado existe em `npm run agent:worker:supervised`
- ainda faltam SLOs formais e gate obrigatorio de deploy

### Observability

- control tower tecnico existe em `src/core/observability/agent-control-tower.ts`
- metrics export existe em `src/core/observability/metrics-export.ts`
- webhook direto e collector com forwarding externo ja existem
- health do canal de observabilidade entra no snapshot do runtime
- ainda falta conectar o collector a um destino real do ambiente e definir alertas/SLOs formais

### Learning quality

- o learning loop ja possui outcomes, playbooks versionados, reuse eligibility, cross-tenant safe learning e resumo estatistico por evidencia
- ainda precisa de validade por segmento/coorte e separacao causal mais forte entre correlacao e playbook reutilizavel

## Phase Refactor Plan

### Phase 1 — Diagnostic and architectural map

Objetivo:

- congelar o estado atual com clareza
- mapear bounded contexts
- identificar acoplamentos, riscos e lacunas de producao
- estabelecer plano de refatoracao sem quebrar o produto

Resultado desta fase:

- este `ARCHITECTURE.md`
- mapa dos fluxos criticos
- riscos principais documentados
- backlog de extracao por camadas

### Phase 2 — Core extraction

Destino alvo:

- `src/core/domain`
- `src/core/decision`
- `src/core/policy`
- `src/core/learning`
- `src/core/audit`
- `src/core/observability`
- `src/core/runtime`

Escopo:

- extrair entidades centrais de decisao
- introduzir `Signal`, `ContextSnapshot`, `Diagnosis`, `Hypothesis`, `CandidateAction`, `RiskAssessment`, `Decision`, `Outcome`, `LearningUpdate`
- desacoplar motores do Next runtime

### Phase 3 — Persistence and tenancy hardening

Destino alvo:

- `src/infrastructure/persistence`
- `src/infrastructure/secrets`
- `src/infrastructure/repositories`

Escopo:

- separar audit/event history de business state
- introduzir repositorios tenant-scoped
- migrar do provider local experimental para backend gerenciado
- remover fallbacks inseguros de segredos

### Phase 4 — Runtime and execution hardening

Destino alvo:

- `src/core/runtime`
- `src/infrastructure/queue`
- `src/infrastructure/connectors`

Escopo:

- modelo formal de job
- retries, timeouts, dedupe e idempotencia por intent
- circuit breaker por connector
- worker separado do processo web

### Phase 5 — Closed learning loop

Destino alvo:

- `src/core/learning`
- `src/application/use-cases/experiments`

Escopo:

- modelo de experimento
- baseline e success criteria
- outcome model
- update de confianca
- reuse seguro de playbooks

### Phase 6 — Security, testing and documentation

Escopo:

- hardening de sessao e segredos
- isolamento inicial por tenant no RBAC
- testes criticos de sessao, RBAC, decision, policy, runtime e learning loop
- documentacao operacional, de seguranca, policy e migracao

### Phase 7 — Final validation and migration closure

Escopo:

- lint
- tests
- build
- walkthrough operacional
- gap report residual

## Target Layering

Arquitetura alvo:

- `src/core/domain`
  - entidades, value objects e contratos centrais
- `src/core/decision`
  - decision engine, scoring, diagnosis, candidate actions
- `src/core/policy`
  - policy engine, autonomy scoring, risk model, approval requirements
- `src/core/learning`
  - experiment model, outcome model, confidence updates
- `src/core/audit`
  - decision provenance, event envelopes, correlation models
- `src/core/observability`
  - metrics, health summaries, control tower services
- `src/core/runtime`
  - execution intents, state transitions, job lifecycle
- `src/infrastructure/persistence`
  - durable stores, repositories, migrations
- `src/infrastructure/queue`
  - queue providers, workers, leases, dedupe, dead-letter
- `src/infrastructure/connectors`
  - connector contracts, adapters, health checks, error normalization
- `src/application/use-cases`
  - orchestration de casos de uso do sistema
- `src/interfaces/http`
  - rotas HTTP/adapters
- `src/interfaces/ui`
  - superfícies de controle e visualizacao

## Multi-tenancy Model

Modelo atual:

- `companySlug` e `companyId` estao presentes na maioria dos agregados
- workspaces sao montados por tenant
- scheduler e runtime ja operam por empresa

Modelo alvo:

- todo repository explicitamente recebe tenant scope
- toda decisao, signal, job, audit event e outcome carrega tenant id
- nenhum secret de connector fica misturado ao agregado de negocio
- learnings cross-tenant, quando existirem, devem ser anonimizados e derivados

## Risk Model

O sistema ja pratica autonomia graduada, mas o modelo alvo precisa elevar o que hoje esta implicito:

- low risk
  - reversivel, conector saudavel, evidencias suficientes, baixo blast radius
- medium risk
  - acao operacional relevante, mas ainda supervisionavel por approval
- high risk
  - mexe em spend, reputacao, compliance, publicacao sensivel ou forte dependencia externa

Policy futura deve avaliar explicitamente:

- tenant
- canal
- acao
- reversibilidade
- blast radius
- reputational risk
- compliance risk
- financial risk
- confidence floor
- connector health
- historical success

## Tradeoffs

- O projeto preservou compatibilidade e acumulou valor rapido, o que foi positivo para velocidade.
- O custo dessa estrategia e que `src/lib` virou um namespace muito amplo.
- A proxima evolucao nao deve reescrever tudo; deve extrair o core gradualmente, mantendo o produto funcional.
- O caminho certo e mover a inteligencia para `core` e empurrar Next/UI para `interfaces`, sem quebra abrupta.
- A convergencia melhorou no ciclo autonomo: `decision`, `diagnostic`, `CMO strategy`, `job planning`, `run lifecycle` e `execution helpers` ja nascem no core; o maior peso residual ficou em hidratacao de memoria, dispatch real de executores e storage legado.

## Acceptance Gate For Next Phase

A Fase 2 deve comecar apenas com estes criterios satisfeitos:

- build, lint e testes saudaveis
- mapa arquitetural aprovado
- pontos de maior risco mapeados
- fronteiras iniciais do core definidas
- prioridade clara para extrair decisao, policy, audit e runtime antes de cosmetica
