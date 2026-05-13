# Operations

## Objetivo

Este documento resume como operar o Agent Lion com seguranca local, previsibilidade de build/test/runtime e separacao clara entre control plane e execution plane.

## Scripts principais

- `npm run dev`
- `npm run lint`
- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm run check`
- `npm run agent:store:check`
- `npm run agent:auth:check`
- `npm run agent:observability:check`

## Variaveis de ambiente criticas

### Obrigatorias para producao

- `AUTH_SESSION_SECRET`
- `VAULT_ENCRYPTION_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `DATABASE_URL`
- `AGENT_AUTOMATION_STORE_MODE=managed`
- `AGENT_EXECUTION_PLANE_MODE=external`

### Fortemente recomendadas

- `SECRETS_ENCRYPTION_KEY`
- `DATABASE_SSL_MODE=require`
- `AGENT_OBSERVABILITY_COLLECTOR_TOKEN`
- `AGENT_OBSERVABILITY_COLLECTOR_SIGNING_SECRET`
- `AGENT_OBSERVABILITY_COLLECTOR_FORWARD_URL`
- `AGENT_WORKER_ID`

### Local/dev

- `AGENT_DATA_DIR` permite mover os artefatos locais legados (`vault` e store local JSON) para um diretorio explicitamente controlado.
- `AGENT_ALLOW_LEGACY_LOCAL_STORE` nao e aceito como override de producao para writes criticos.
- O fallback local padrao do automation store e `local-json`, nao `node:sqlite`.

## Observabilidade externa

- `AGENT_OBSERVABILITY_WEBHOOK_URL` envia metricas diretamente para um webhook operacional.
- `AGENT_OBSERVABILITY_WEBHOOK_FORMAT=json|prometheus` define o formato do envio direto.
- `AGENT_OBSERVABILITY_WEBHOOK_BEARER_TOKEN` autentica o envio direto quando o destino exigir.
- `AGENT_OBSERVABILITY_WEBHOOK_SIGNING_SECRET` assina o payload enviado.
- `AGENT_OBSERVABILITY_COLLECTOR_TOKEN` protege o collector HTTP interno.
- `AGENT_OBSERVABILITY_COLLECTOR_SIGNING_SECRET` valida assinatura de entrada no collector.
- `AGENT_OBSERVABILITY_COLLECTOR_FORWARD_URL` encaminha o que o collector recebeu para um destino externo real.
- `AGENT_OBSERVABILITY_COLLECTOR_FORWARD_FORMAT=json|prometheus` define o formato do forwarding.
- `AGENT_OBSERVABILITY_COLLECTOR_FORWARD_BEARER_TOKEN` autentica o forwarding.
- `AGENT_OBSERVABILITY_COLLECTOR_FORWARD_SIGNING_SECRET` assina o payload encaminhado.

## Runtime do agente

O runtime autonomo depende de:

- queue de automation runs
- retry queue
- dead-letter
- execution intents
- connector circuit breakers
- execution plane mode (`inline` ou `external`)

Superficies principais:

- `src/lib/agents/runtime.ts`
- `src/lib/agents/worker.ts`
- `src/lib/agents/queue-processor.ts`
- `src/lib/agents/reliability.ts`
- `src/lib/agents/execution-plane.ts`
- `src/scripts/agent-worker.ts`
- `src/infrastructure/persistence/managed-automation-store.ts`
- `src/infrastructure/persistence/automation-store-mode.ts`
- `src/infrastructure/persistence/worker-heartbeat-store.ts`

## Control tower tecnico

O runtime do Agent Lion expoe um snapshot tecnico para inspecao do cerebro em:

- `GET /api/companies/[companyId]/agent-runtime`

Consultas uteis:

- `?view=summary` para saude, rates, latencias e sinais agregados
- `?view=queue&limit=20` para inspecionar fila oficial e pressao operacional
- `?view=dead_letters&limit=20` para ver falhas recentes e replay hints
- `?view=intents&limit=20` para execution intents, correlation ids e timeouts
- `?view=breakers&limit=20` para circuit breakers por conector
- `?view=runs&limit=20` para runs recentes, decision latency e execution latency
- `?view=metrics&format=prometheus` para export de metricas do cerebro
- `?view=all&limit=20` para snapshot completo de operacao

O payload inclui:

- `automationRuntimeHealth`
- `controlTower`
- `controlTower.observabilityChannel`
- `controlTower.workerHealth`
- `observability`
- slices de `automationQueue`, `automationDeadLetters`, `executionIntents` e `connectorCircuitBreakers`

## Evolution Center

O Aigent Evolution Center expõe a autoavaliacao operacional do proprio agente em:

- `GET /api/companies/[companyId]/aigent-lion/evolution`
- `POST /api/companies/[companyId]/aigent-lion/evolution`
- `/empresas/[companyId]/evolution-center`

Esse fluxo roda:

- Self-Improvement Engine
- Codex Task Generator
- Release Risk Analyzer
- production gates em modo alvo de producao

Regras operacionais:

- tarefas Codex de risco alto ou critico exigem aprovacao
- mudancas de policy, secrets, runtime externo ou persistencia nao devem ser aplicadas sem review
- cada tarefa gerada precisa conter objetivo, evidencia, arquivos, criterios de aceite e prompt acionavel
- o painel deve consumir a API real, nao apenas dados renderizados no server component

## Collector externo

Fluxo recomendado:

1. configurar `AGENT_OBSERVABILITY_COLLECTOR_TOKEN`
2. configurar `AGENT_OBSERVABILITY_COLLECTOR_SIGNING_SECRET`
3. configurar `AGENT_OBSERVABILITY_COLLECTOR_FORWARD_URL`
4. configurar `AGENT_OBSERVABILITY_COLLECTOR_FORWARD_BEARER_TOKEN` ou `AGENT_OBSERVABILITY_COLLECTOR_FORWARD_SIGNING_SECRET`
5. apontar o destino para o collector, gateway de metricas ou webhook operacional do ambiente
6. rodar `npm run agent:observability:check`
7. verificar `controlTower.observabilityChannel.health`

Estados esperados:

- `healthy`: entregas recentes foram recebidas ou encaminhadas com sucesso
- `warning`: canal desabilitado ou configurado sem sucesso recente
- `critical`: houve falha mais recente que o ultimo sucesso

## Worker dedicado

Scripts:

- `npm run agent:worker`
- `npm run agent:worker:once`
- `npm run agent:worker:supervised`
- `npm run agent:store:check`
- `npm run agent:auth:check`
- `npm run agent:observability:check`
- `npm run agent:production:check`

Modo recomendado em producao:

- `DATABASE_URL` configurado
- `AGENT_AUTOMATION_STORE_MODE=managed`
- `AGENT_EXECUTION_PLANE_MODE=external`
- web/scheduler apenas enfileiram
- worker dedicado consome a fila oficial
- supervisor local/VM pode usar `npm run agent:worker:supervised -- --restart-delay-ms=5000`
- `agent:store:check` passa antes do deploy
- `agent:auth:check` passa antes do deploy
- `agent:observability:check` passa antes do deploy
- `agent:production:check` passa antes do deploy
- `controlTower.workerHealth.status` em `healthy`

## Production gates do agente

Use `npm run agent:production:check` em CI/deploy para validar os requisitos minimos do cerebro em producao.

O comando falha fechado quando `NODE_ENV=production` e algum gate critico estiver ausente:

- `DATABASE_URL`
- `AGENT_AUTOMATION_STORE_MODE=managed`
- `AUTH_SESSION_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

O comando tambem emite warnings quando configuracoes operacionais importantes nao estao prontas:

- `AGENT_EXECUTION_PLANE_MODE=external`
- `AGENT_OBSERVABILITY_COLLECTOR_FORWARD_URL` ou `AGENT_OBSERVABILITY_WEBHOOK_URL`

`npm run agent:auth:check` valida a presenca das credenciais Google OAuth e, quando `NEXT_PUBLIC_APP_URL` estiver definido, imprime os redirect URIs que precisam estar cadastrados no Google Cloud:

- `[NEXT_PUBLIC_APP_URL]/api/auth/google/callback`
- `[NEXT_PUBLIC_APP_URL]/api/auth/google/connect/callback`

Esses gates nao substituem o deploy checklist, mas impedem que o agente seja promovido com persistencia, sessao ou runtime em modo inseguro.

## Schema check da store gerenciada

Use `npm run agent:store:check` em CI/deploy quando `DATABASE_URL` estiver configurado.

O comando:

- cria o schema esperado quando permitido
- verifica tabelas e indices obrigatorios
- falha com exit code nao-zero se `DATABASE_URL` estiver ausente ou o schema estiver incompleto

## Saude operacional minima

Antes de considerar o ambiente apto, confirmar:

- `npm run check` verde
- `npm run agent:production:check` verde no ambiente alvo
- `npm run agent:auth:check` verde no ambiente alvo
- queue sem acumulacao anormal
- dead-letter controlado
- circuit breakers sem open state persistente sem motivo conhecido
- secrets store configurada
- session secret explicito em producao
- `controlTower.observabilityChannel.health` em `healthy`
- `controlTower.workerHealth.status` em `healthy`

## Avisos atuais conhecidos

- `node:sqlite` ainda existe no repositorio como provider legado, mas nao e o caminho padrao do runtime
- em producao, sem `DATABASE_URL` e `AGENT_AUTOMATION_STORE_MODE=managed`, writes criticos do automation store falham fechado
- a store gerenciada ainda precisa de migrations/schema checks formais em pipeline

## Runbook rapido

### Se o agent runtime travar

1. verificar `automationRuntimeHealth`
2. inspecionar queue e dead-letter
3. verificar connector breakers abertos
4. reexecutar apenas depois de entender o motivo da falha

### Se approvals pararem o ciclo

1. revisar `policy result`
2. confirmar permissao do perfil
3. confirmar tenant scope do ator
4. liberar approval ou reduzir risco da acao

### Se learnings parecerem errados

1. revisar experiment outcomes persistidos
2. revisar scorecards de origem
3. confirmar baseline e metrica observada
4. checar se o tenant correto foi usado no run

### Se a observabilidade externa falhar

1. revisar `controlTower.observabilityChannel`
2. inspecionar entregas recentes em `observabilityDeliveries`
3. validar token e signing secret do collector
4. validar reachability do `AGENT_OBSERVABILITY_COLLECTOR_FORWARD_URL`
5. confirmar formato `json` ou `prometheus`

### Se o worker sumir do control tower

1. verificar `controlTower.workerHealth`
2. confirmar processo `npm run agent:worker`
3. verificar `AGENT_WORKER_ID`, `AGENT_EXECUTION_PLANE_MODE` e `DATABASE_URL`
4. rodar `npm run agent:store:check`
5. inspecionar restart policy do processo
