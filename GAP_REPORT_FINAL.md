# Final Gap Report

## Estado atual

O Agent Lion ja deixou de ser um painel com automacoes e entrou na fase de agente operacional serio em consolidacao.

Hoje ele ja tem:

- nucleo explicito de decisao em `src/core/decision`
- policy engine deterministica em `src/core/policy`
- autonomy scoring com governanca por risco
- runtime com execution intents, retries, dead-letter, idempotencia e circuit breakers
- worker dedicado e modo claro entre control plane e execution plane
- heartbeat do worker no control tower
- persistencia gerenciada via Postgres para runtime critico
- fallback local de desenvolvimento em JSON, sem depender do `node:sqlite` no caminho oficial
- segregacao inicial de secrets fora do business state
- redaction centralizada para logs, erros, auditoria e conectores sensiveis
- learning loop com experiment outcomes, playbooks versionados e reuse eligibility
- cross-tenant learning anonimizado e filtrado por shareability
- RBAC com escopo por tenant
- audit trail e decision provenance
- control tower tecnico com metricas exportaveis
- collector de observabilidade com forwarding para destino externo
- suite de testes nas areas mais sensiveis do nucleo

## O que foi resolvido desde o ultimo gap report

### Arquitetura

- `workspaceSeeds` saiu de `src/lib/connectors.ts` e foi para `src/infrastructure/connectors/workspace-seeds.ts`
- catalogo de conectores saiu para `src/infrastructure/connectors/connector-overview-catalog.ts`
- hidratacao do workspace saiu para `src/infrastructure/connectors/workspace-hydration.ts`
- persistencia/hidratacao de vault saiu parcialmente para `src/infrastructure/persistence/*`
- `src/lib/connectors.ts` e `src/lib/company-vault.ts` estao mais proximos de adapters do que de source of truth

### Persistencia

- store gerenciada por Postgres existe em `src/infrastructure/persistence/managed-automation-store.ts`
- schema check operacional existe via `npm run agent:store:check`
- modo do automation store e explicito em `src/infrastructure/persistence/automation-store-mode.ts`
- fallback local oficial virou `local-json` em `src/lib/durable-store-file.ts`
- writes criticos falham fechado em producao sem store gerenciada

### Runtime

- worker externo existe em `src/scripts/agent-worker.ts`
- heartbeat do worker existe em `src/infrastructure/persistence/worker-heartbeat-store.ts`
- control plane e execution plane estao mais separados
- consumo inline e bloqueado em modo externo de producao sem override
- execution intents, breakers e queue pressure entram no snapshot do runtime

### Observabilidade

- export de metricas existe em `src/core/observability/metrics-export.ts`
- webhook direto existe em `src/core/observability/metrics-sink.ts`
- collector autenticado existe em `src/app/api/agent/observability/collector/route.ts`
- forwarding do collector existe em `src/core/observability/collector-forwarding.ts`
- check de configuracao do collector existe via `npm run agent:observability:check`
- health do canal de observabilidade entra no control tower

### Seguranca

- fallback inseguro de sessao foi removido
- segredos de conectores foram separados do business state principal
- redaction transversal foi aplicada em conectores e auditoria
- policy enterprise ja cobre spend cap, claims proibidas/sensiveis, consentimento, data sources bloqueadas e compliance note por tenant

## Gaps remanescentes

### 1. Consolidar Postgres como padrao operacional unico

O caminho oficial ja suporta store gerenciada e schema check. Ainda falta transformar isso em gate obrigatorio no pipeline real de staging/producao.

### 2. Completar drenagem de `company-vault.ts`

O vault perdeu bastante responsabilidade, mas ainda guarda muitas colecoes historicas. O proximo passo e criar repositorios dedicados por agregado restante: social, CRM, reports, approvals, creative assets e profiles.

### 3. Observabilidade externa em ambiente real

O collector e o forwarding existem, mas ainda precisam ser apontados para um destino operacional real do ambiente: collector interno, Sentry, Datadog, Grafana/Prometheus gateway ou webhook de incidentes.

### 4. Policy enterprise por contrato de cliente

A policy ja esta forte, mas ainda precisa de uma matriz persistida por tenant com regras editaveis por cliente: categorias proibidas, claims permitidas, limites financeiros, aprovadores, horarios de execucao e canais autorizados.

### 5. Learning com evidencias mais fortes

O learning ja e versionado e mais disciplinado, mas ainda precisa evoluir em:

- validade por segmento/coorte
- janela estatistica minima
- confidence decay mais agressivo
- diferenca formal entre correlacao, recomendacao e playbook reutilizavel

### 6. Producao operada com SLOs

O runtime ja mostra health, mas ainda falta definir SLOs concretos:

- maximo de dead letters por tenant
- latencia maxima de decisao
- latencia maxima de execucao
- cobertura minima de outcomes
- taxa minima de sucesso por executor

## Julgamento honesto

### Forte

- cerebro estrategico
- decision/policy core
- runtime autonomo governado
- auditabilidade
- observabilidade do agente
- learning loop tenant-scoped e cross-tenant seguro

### Bom de verdade

- execucao low-risk governada
- worker externo
- persistencia gerenciada preparada
- redaction e secret boundaries
- testes do nucleo

### Ainda precisa consolidar

- Postgres como unico caminho de producao
- repositorios dedicados para os agregados restantes
- policy como configuracao persistida por tenant
- SLOs e alertas reais
- learning menos heuristico e mais estatisticamente defensavel

## Proximo passo recomendado

Se a meta for chamar o Lion de pronto para producao com menos ressalvas, a proxima ordem deve ser:

1. tornar `AGENT_AUTOMATION_STORE_MODE=managed` obrigatorio em ambientes reais
2. rodar `npm run agent:store:check` no pipeline
3. monitorar `controlTower.workerHealth`
4. extrair repositorios restantes de `company-vault.ts`
5. ligar `AGENT_OBSERVABILITY_COLLECTOR_FORWARD_URL` a um destino operacional real
6. persistir policy matrix por tenant
7. definir SLOs e alertas por tenant/executor
