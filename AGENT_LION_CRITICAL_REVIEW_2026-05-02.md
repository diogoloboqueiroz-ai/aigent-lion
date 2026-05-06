# Agent Lion Critical Review - 2026-05-02

## Veredito executivo

O Agent Lion ja tem um cerebro operacional real. O sistema nao esta mais na fase de "dashboard com IA": ele possui core de decisao, policy engine, runtime com worker, persistencia gerenciada, observabilidade exportavel, learning loop e governanca por risco.

O ponto critico agora nao e adicionar mais telas ou conectores. O ponto critico e transformar essa base em uma operacao de producao disciplinada, com Postgres obrigatorio nos ambientes reais, worker monitorado, repositorios por agregado, policy matrix por tenant e learning mais estatistico.

## Estado atual

| Dimensao | Avaliacao | Nota |
| --- | --- | --- |
| Visao de produto | Excelente | O produto esta corretamente orientado a crescimento autonomo, nao chatbot |
| Core de decisao | Forte | Diagnostico, CMO strategy e action planning ja vivem em `src/core/decision` |
| Policy/risk | Forte | Spend cap, consentimento, claims, data sources e compliance note ja entram no core |
| Runtime | Forte | Queue, retry, dead-letter, worker, heartbeat, intents e circuit breakers existem |
| Persistencia | Boa | Postgres gerenciado existe; falta gate obrigatorio de deploy em ambiente real |
| Observabilidade | Boa | Metrics export, collector, forwarding e health de canal existem |
| Learning | Bom | Versionamento e cross-tenant safe learning existem; falta rigor estatistico maior |
| Multi-tenancy | Bom | Tenant scope existe; isolamento operacional ainda precisa de repositorios por agregado |
| Seguranca | Boa | Secrets, redaction e session hardening evoluiram bastante |
| Prontidao de producao | Boa, nao final | Falta SLO, policy persistida por tenant, deploy real do worker e repositorios dedicados |

## Evidencias tecnicas

- Validacao verde: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- Suite atual: 68 testes passando.
- Core explicito em `src/core/decision`, `src/core/policy`, `src/core/learning`, `src/core/runtime`, `src/core/observability` e `src/core/audit`.
- Infra dedicada em `src/infrastructure/persistence`, `src/infrastructure/connectors` e `src/infrastructure/secrets`.
- Runtime critico com worker externo em `src/scripts/agent-worker.ts`.
- Store gerenciada com schema check em `src/scripts/check-managed-automation-store.ts`.
- Fallback local oficial em JSON, sem depender de `node:sqlite` no caminho padrao.

## Principais riscos remanescentes

### 1. `company-vault.ts` ainda concentra colecoes demais

Mesmo drenado, `src/lib/company-vault.ts` ainda exporta estado de profiles, social, reports, learning, execution, approvals, CRM/conversion, payments, creative assets, technical requests e audit.

Impacto:

- risco de acoplamento
- dificuldade de migrar para banco real por agregado
- isolamento tenant ainda parcialmente por convencao
- manutencao mais cara

Proximo movimento:

- `company-approvals-storage.ts` extraido
- `company-reports-storage.ts` extraido
- depois `company-social-storage.ts`

### 2. Store gerenciada ainda precisa virar gate operacional real

O codigo ja tem `npm run agent:store:check`, mas isso precisa ser exigido no deploy real.

Impacto:

- producao pode subir sem schema esperado se o pipeline nao chamar o check
- worker pode operar em ambiente mal configurado

Proximo movimento:

- colocar `agent:store:check` no pipeline de staging/producao
- documentar fail-closed como requisito
- adicionar smoke operacional com `DATABASE_URL` real

### 3. Worker existe, mas precisa de disciplina de processo

O worker tem heartbeat e aparece no control tower, mas ainda depende do ambiente executar o processo corretamente.

Impacto:

- fila pode acumular sem worker vivo
- operacao autonoma vira enfileiramento sem execucao

Proximo movimento:

- rodar `npm run agent:worker` como processo separado
- adicionar restart policy
- alertar quando `controlTower.workerHealth.status !== "healthy"`

### 4. Observabilidade exportavel existe, mas falta destino real

O collector e forwarding estao prontos, mas precisam apontar para um collector/alerting real.

Impacto:

- falhas ainda podem ficar presas no app
- operacao fica menos SRE-like

Proximo movimento:

- configurar `AGENT_OBSERVABILITY_COLLECTOR_FORWARD_URL`
- escolher formato `json` ou `prometheus`
- validar `controlTower.observabilityChannel.health`

### 5. Policy enterprise ainda e mais codigo do que configuracao

O core de policy esta forte, mas regras por contrato de cliente ainda deveriam ser persistidas.

Impacto:

- mudar governanca exige deploy
- clientes diferentes nao conseguem ter regras ricas sem customizacao de codigo

Proximo movimento:

- criar `tenant-policy-matrix`
- persistir spend envelopes, approver routing, claims permitidas/proibidas e canais autorizados
- versionar policy por tenant

### 6. Learning ainda precisa mais rigor estatistico

O learning esta disciplinado, mas ainda pode supervalorizar sinais fracos.

Impacto:

- risco de falso aprendizado
- playbooks podem ser reaplicados fora do contexto ideal

Proximo movimento:

- janela minima por tipo de experimento
- confidence decay automatico
- validade por segmento/coorte
- separar `observed correlation`, `tenant recommendation` e `reusable playbook`

## Notas atuais

| Area | Nota |
| --- | --- |
| Produto/visao | 9.3/10 |
| Arquitetura | 8.5/10 |
| Core de decisao | 8.4/10 |
| Policy/governanca | 8.2/10 |
| Runtime/resiliencia | 8.2/10 |
| Observabilidade | 7.9/10 |
| Learning | 7.4/10 |
| Seguranca | 7.8/10 |
| Producao real | 7.6/10 |

## Plano de execucao recomendado

### Onda 1 - Producao operacional

1. Tornar `agent:store:check` obrigatorio em staging/producao.
2. Rodar worker como processo separado com restart policy.
3. Expor alerta para `workerHealth`, dead-letter, queue pressure e observability channel.
4. Configurar destino real para `AGENT_OBSERVABILITY_COLLECTOR_FORWARD_URL`.

### Onda 2 - Drenagem do legado

1. `company-approvals-storage.ts` extraido.
2. `company-reports-storage.ts` extraido.
3. Extrair `company-social-storage.ts`.
4. Extrair `company-crm-conversion-storage.ts`.
5. Reduzir `company-vault.ts` a facade de compatibilidade.

### Onda 3 - Governanca enterprise

1. Criar policy matrix tenant-scoped.
2. Persistir spend envelopes por tenant/canal.
3. Persistir approver routing por categoria.
4. Persistir claims proibidas/permitidas.
5. Versionar policy e registrar decision provenance com policy version.

### Onda 4 - Learning confiavel

1. Adicionar janela minima de observacao.
2. Aplicar confidence decay.
3. Registrar validade por segmento/coorte.
4. Classificar aprendizado como correlacao, recomendacao ou playbook reutilizavel.
5. Criar teste de falso positivo para learning.

### Onda 5 - Smoke real de operacao

1. Subir app com envs de producao.
2. Rodar `npm run agent:store:check`.
3. Rodar `npm run agent:worker`.
4. Disparar `POST /api/agent/run`.
5. Validar `GET /api/companies/[companyId]/agent-runtime?view=all`.
6. Confirmar `workerHealth=healthy`, `observabilityChannel=healthy`, queue controlada e sem dead-letter novo.

## Proximo passo imediato

O primeiro corte recomendado foi executado: approvals agora possuem logica de colecao em `src/infrastructure/persistence/company-approvals-storage.ts`.

O segundo corte recomendado foi executado: reports e metric snapshots agora possuem logica de colecao em `src/infrastructure/persistence/company-reports-storage.ts`.

O proximo passo de maior retorno e extrair `social` de `company-vault.ts` para um repositorio dedicado em `src/infrastructure/persistence/company-social-storage.ts`.

Motivo:

- social e o maior agregado operacional ainda preso ao legado
- reduz o maior bloco restante antes de CRM/conversion
- prepara execucao social para storage dedicado e governanca por canal
- diminui acoplamento entre runtime, approvals e social ops

Depois disso, o corte seguinte deve ser `CRM/conversion`, porque ele fecha a trilha de receita e feedback comercial.
