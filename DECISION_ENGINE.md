# Decision Engine

## Objetivo

O decision engine do Agent Lion escolhe a proxima melhor acao por tenant com base em sinais, contexto, gargalos, tese estrategica, risco e memoria operacional.

Ele nao e um gerador de texto. Ele e a camada que transforma contexto em decisao explicavel.

## Entradas

- `CompanyContext` montado em `src/lib/agents/memory-engine.ts`
- sinais e findings gerados em `src/lib/agents/diagnostic-engine.ts`
- tese dominante do CMO Agent em `src/lib/agents/cmo-agent.ts`
- scorecards de performance e memoria persistida em `src/lib/execution.ts` e `src/lib/learning.ts`
- brief acionavel em `src/core/marketing/campaign-intelligence.ts`, que transforma a decisao em funil, canais, copy angles, prompts visuais, analytics e experimentos

## Fluxo

1. montar snapshot contextual por tenant
2. diagnosticar gargalos dominantes
3. gerar oportunidades e hipoteses
4. produzir candidate actions com impacto, urgencia, esforco e confianca
5. anexar rationale, evidence e target metric
6. encaminhar cada acao para policy evaluation

## Estruturas centrais

- `Signal`
- `ContextSnapshot`
- `Diagnosis`
- `Hypothesis`
- `CandidateAction`
- `DecisionReason`
- `Decision`

Os contratos principais vivem em:

- `src/core/domain/agent-core.ts`
- `src/core/decision/decision-engine.ts`
- `src/lib/agents/types.ts`

## Explicabilidade

Cada decisao importante precisa registrar:

- tenant
- trigger
- sinais usados
- findings dominantes
- hipoteses consideradas
- candidate actions comparadas
- score composto
- rationale final
- policy result

Esse rastro e consolidado em `src/core/audit/decision-provenance.ts`.

## Campaign intelligence

O decision engine agora tambem alimenta uma camada de campanha:

- entrada: `CompanyWorkspace` + `CompanyCmoStrategicDecision`
- saida: `CampaignIntelligenceBrief`
- uso principal: `/empresas/[companyId]/campanhas` e `/api/companies/[companyId]/campaign-intelligence`

Essa camada nao executa conectores nem publica criativos. Ela prepara o plano multicanal com riscos, QA e metricas para que especialistas e policy decidam o proximo passo com mais contexto.

Quando o operador materializa um brief, ele vira memoria operacional versionada por tenant. Quando escolhe preparar drafts, `src/core/marketing/campaign-activation.ts` cria posts e ads em estado `pending_approval`, sem publicar nada e sem disparar spend.

Os drafts carregam `sourceCampaignBriefId` e `sourceCampaignBriefVersion`. Depois da aprovacao, o Approval Center pode enviar posts e ads para o Social Runtime, mantendo a trilha:

decision -> campaign brief -> draft -> approval -> runtime task -> execution log.

## Regras atuais

- canais com sinais persistidos de winner aumentam probabilidade de `scale`
- canais com falha de runtime, dispatch ou experiment losses aumentam probabilidade de `fix` ou `pause`
- gaps de connector e tracking puxam decisoes para estabilizacao antes de escala
- a tese semanal do CMO Agent reorganiza a prioridade entre acquisition, conversion, content, operations e tracking

## Limites atuais

- a decisao ainda depende de parte dos especialistas em `src/lib`
- ainda nao existe modelagem causal forte entre criativo, oferta, pagina e receita
- budget decisions continuam conservadoras e dependentes de policy

## Criterio de maturidade

O decision engine so e considerado saudavel quando:

- a decisao e reproduzivel
- a decisao e explicavel
- a decisao nao ignora risco
- a decisao aprende com outcome persistido
- a decisao respeita isolamento por tenant
