# Learning Loop

## Objetivo

O learning loop do Agent Lion existe para fechar o ciclo:

trigger -> decisao -> execucao -> outcome -> memoria -> proxima decisao

Sem isso, o sistema seria apenas um planner sofisticado.

## Componentes

- `src/core/learning/learning-engine.ts`
- `src/lib/learning.ts`
- `src/lib/execution.ts`
- `src/lib/agents/orchestrator.ts`
- `src/lib/agents/memory-engine.ts`

## Objetos persistidos

- `CompanyExperimentOutcome`
- `CompanyLearningPlaybook`
- `CompanyAgentLearning`

Esses agregados ficam hidratados no workspace por tenant.

## Como funciona hoje

1. o run autonomo termina com outcomes e scorecards
2. o learning engine deriva `ExperimentResult`
3. `src/lib/learning.ts` consolida esses resultados em `CompanyExperimentOutcome`
4. outcomes vencedores ou perdedores viram `CompanyLearningPlaybook`
5. playbooks e outcomes alimentam scorecards futuros em `src/lib/execution.ts`
6. o proximo ciclo decide melhor entre `scale`, `hold`, `fix` e `pause`

## O que um experimento carrega

- hypothesis
- channel
- primary metric
- baseline metric value
- success criteria
- observation window
- variants
- confidence
- optional winning variant

## O que um outcome carrega

- target metric
- baseline
- observed value
- status
- confidence delta
- evidence
- reuse recommendation
- failure note

## Reuso seguro

- learnings sao persistidos por tenant
- vies cross-tenant nao sao aplicados automaticamente
- reaproveitamento generico ainda deve ser anonimizado e promovido por policy futura

## Tipos de memoria produzidos

- `playbook`
- `risk`
- `warning`
- `opportunity`

## Regras atuais de formacao de playbook

- vitoria repetida tende a promover playbook para `active`
- perda recorrente ou inconclusive repetido empurra para `retired`
- sinais recentes sem validacao suficiente ficam como `candidate`

## Confianca estatistica

O learning loop agora calcula `LearningStatisticalSummary` para outcomes e playbooks:

- `sampleSize`
- `wins`
- `losses`
- `winRate`
- `lossRate`
- `posteriorMean`
- `credibleInterval`
- `evidenceStrength`
- `minimumSampleSize`

A confianca deixa de depender apenas de deltas fixos. Playbooks combinam score operacional com posterior bayesiano simples, e reuso seguro considera forca de evidencia antes de aplicar um padrao. Dois tenants independentes com wins e zero perdas podem virar playbook cross-tenant ativo, mas entram como evidencia `directional` quando a amostra ainda e pequena.

## Limites atuais

- ainda nao existe experiment allocation formal por budget bucket
- confidence update ja usa estatistica bayesiana leve, mas ainda nao e causal
- cross-tenant learning seguro existe, mas ainda precisa de segmentacao/coorte antes de virar recomendacao universal
