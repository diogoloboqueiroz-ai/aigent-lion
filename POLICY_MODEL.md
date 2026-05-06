# Policy Model

## Objetivo

A policy engine existe para impedir que o Agent Lion execute acao sensivel sem governanca suficiente.

Ela e deterministica, testavel e vem antes de qualquer execucao automatizada.

## Resultados possiveis

- `AUTO_EXECUTE`
- `REQUIRE_APPROVAL`
- `REQUIRE_POLICY_REVIEW`
- `BLOCK`

No runtime legado os equivalentes sao:

- `auto_execute`
- `requires_approval`
- `policy_review`
- `blocked`

## Fatores avaliados

- tipo de acao
- tenant
- permission set do ator
- tenant scope do perfil profissional
- connector health
- historical success
- confidence score
- reversibility
- blast radius
- reputational risk
- compliance risk
- financial risk
- clareza do playbook

## Autonomy scoring

O autonomy score composto considera pelo menos:

- reversibilidade
- clareza de policy
- historico do playbook
- connector health
- confianca do decision engine
- blast radius

Esse score nao substitui regras duras. Ele informa a confianca operacional da acao.

## Regras atuais

- low risk com connector saudavel e evidencias suficientes pode ir para autoexecucao
- medium risk vai para approval
- budget shift, pause agressiva ou acao financeira sensivel vao para policy review
- falta de evidencia, falta de permissao ou tenant fora do escopo resultam em bloqueio

## Provenance minimo da policy

Cada avaliacao relevante deve carregar:

- status
- reason codes
- risk score
- rationale
- approval mode requerido quando existir
- metadados de escalacao

## Isolamento por tenant

Na Fase 6, o RBAC passou a validar:

- permissao funcional
- escopo permitido de tenants no perfil

Arquivo principal:

- `src/lib/rbac.ts`

## Policy matrix por tenant

A governanca por empresa agora pode ser persistida como `CompanyPolicyMatrix`.

Arquivos principais:

- `src/infrastructure/persistence/company-policy-matrix-storage.ts`
- `src/lib/company-vault.ts`
- `src/core/policy/policy-engine.ts`

Cada matriz permite configurar por tenant:

- override de decisao por tipo de acao: `auto_execute`, `requires_approval`, `policy_review`, `blocked`
- floors de confianca por action type
- thresholds de budget para approval ou policy review
- approvers por action type e categoria
- allowlist/blocklist de fontes comerciais
- claims proibidas ou sensiveis por empresa

Em producao, a matriz e tratada como camada acima do registry global. O registry continua sendo a base segura; a matriz do tenant so pode aumentar governanca, bloquear acao ou ajustar o caminho de aprovacao de forma auditavel.

## Limites atuais

- ainda falta granularidade por company/action category em toda a superficie
- required approvers ainda nao sao derivados por matriz completa de org/risk
- compliance ainda esta mais forte em guardrails do que em workflow regulatorio formal
