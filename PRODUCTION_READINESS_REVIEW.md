# Production Readiness Review

## Resumo executivo

O Agent Lion esta em um estado forte de consolidacao: o core ja governa decisao, policy, runtime semantics, learning e observabilidade; `src/lib/*` esta cada vez mais como adapter/facade; e a operacao critica ja tem caminho gerenciado, worker dedicado, redaction, collector e health exportavel.

Ainda nao e "producao sem ressalvas" porque faltam tres camadas finais: obrigatoriedade operacional do backend gerenciado, repositorios dedicados para os agregados restantes e SLOs/alertas reais do cerebro.

## Estado atual por dimensao

| Dimensao | Estado | Nota |
| --- | --- | --- |
| Core de decisao | Forte | `src/core/decision` concentra diagnostico, tese CMO e action planning |
| Policy | Forte | spend cap, consentimento, claims, data sources e compliance note ja entram na decisao |
| Runtime | Forte | worker, queue, intents, retries, dead-letter e breakers existem |
| Persistencia | Boa | Postgres gerenciado existe; `local-json` e fallback dev |
| Observabilidade | Boa | metrics export, webhook, collector, forwarding e channel health existem |
| Learning | Bom | playbooks versionados e cross-tenant safe learning existem |
| Tenancy | Boa | tenant scope e repositorios criticos estao mais explicitos |
| Seguranca | Boa | secrets segregados, redaction e session hardening existem |
| Operacao real | Em consolidacao | falta SLO, deploy policy e destino externo real configurado |

## Gaps de ultima milha

### P0: Store gerenciada como regra de producao

Problema: o caminho gerenciado existe, mas precisa virar requisito do ambiente.

Acao:

- exigir `DATABASE_URL` em staging/producao
- exigir `AGENT_AUTOMATION_STORE_MODE=managed`
- bloquear deploy sem schema/migration check

Resultado esperado:

- runtime critico sem dependencia de fallback local
- concorrencia e durabilidade mais confiaveis

### P0: Worker como processo operacional separado

Problema: o worker existe, mas a prontidao depende do deploy real.

Acao:

- subir `npm run agent:worker` como processo separado
- configurar restart policy
- monitorar heartbeat, dead letters, queue pressure e breakers

Resultado esperado:

- web app vira control plane
- worker vira execution plane previsivel

### P1: Repositorios dedicados para agregados restantes

Problema: `src/lib/company-vault.ts` ainda guarda colecoes historicas demais.

Acao:

- extrair repositorios para social ops
- extrair repositorios para CRM/conversion state
- extrair repositorios para reports
- extrair repositorios para approvals
- extrair repositorios para creative assets
- extrair repositorios para profiles

Resultado esperado:

- `company-vault.ts` vira compatibility facade
- `src/infrastructure/persistence` passa a dominar business state

### P1: Observabilidade ligada a destino real

Problema: collector e forwarding existem, mas precisam de destino operacional.

Acao:

- configurar `AGENT_OBSERVABILITY_COLLECTOR_FORWARD_URL`
- usar `json` para webhook/incident system ou `prometheus` para collector de metricas
- validar `controlTower.observabilityChannel.health`

Resultado esperado:

- falhas do cerebro aparecem fora do app
- runtime pode ser operado com alertas reais

### P1: Policy matrix persistida por tenant

Problema: policy enterprise esta forte, mas ainda e majoritariamente codificada.

Acao:

- criar policy matrix versionada por tenant
- persistir spend envelopes por canal
- persistir approver routing por categoria
- persistir claims proibidas e permitidas
- persistir horarios/canais autorizados

Resultado esperado:

- governanca por contrato de cliente
- autonomia ajustavel sem deploy

### P2: Learning mais estatistico

Problema: learning e disciplinado, mas ainda heuristico.

Acao:

- exigir janela minima de observacao por tipo de experimento
- registrar contexto de validade por segmento/coorte
- aplicar confidence decay automatico
- separar `observed correlation`, `tenant recommendation` e `reusable playbook`

Resultado esperado:

- menos falso aprendizado
- reuso mais confiavel entre ciclos e tenants

## Proxima sequencia recomendada

1. Rodar `npm run agent:store:check` no pipeline de staging/producao.
2. Subir `npm run agent:worker` como processo separado com restart policy.
3. Monitorar `controlTower.workerHealth` e `controlTower.observabilityChannel`.
4. Extrair primeiro repositorio restante de `company-vault.ts`, comecando por approvals ou reports.
5. Configurar e testar `AGENT_OBSERVABILITY_COLLECTOR_FORWARD_URL` em ambiente real.
6. Criar policy matrix tenant-scoped.
7. Adicionar confidence decay e janela minima ao learning.
