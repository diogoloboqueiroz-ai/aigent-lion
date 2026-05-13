# Security Review

## Escopo desta rodada

Esta revisao cobre o endurecimento atual do Agent Lion apos a consolidacao de producao, observabilidade externa e drenagem parcial do vault para infraestrutura dedicada.

## Melhorias implementadas

### 1. Session secret

- removido o fallback hardcoded inseguro de sessao
- em producao, `AUTH_SESSION_SECRET` ausente agora falha de forma segura na emissao de sessao
- em leitura, ausencia do segredo em producao invalida a sessao em vez de assumir comportamento inseguro

Arquivo:

- `src/lib/session.ts`

### 2. Tenant isolation no RBAC

- perfis profissionais agora podem restringir escopo por tenant
- `requireCompanyPermission` considera permissao funcional e acesso ao tenant
- bloqueios por escopo incorreto sao auditados

Arquivos:

- `src/lib/rbac.ts`
- `src/lib/domain.ts`
- `src/lib/user-profiles.ts`

### 3. Segregacao de segredos

- credenciais operacionais saem do vault principal
- tokens e secrets ficam em `src/infrastructure/secrets/tenant-secrets-store.ts`
- business state e secret state deixam de dividir a mesma trilha principal

### 4. Redaction transversal

- conectores sensiveis usam helpers de redaction antes de registrar erros ou payloads
- auditoria passa por sanitizacao antes de persistir texto livre
- responses de conectores reduzem risco de vazamento de bearer token, query string sensivel e corpo bruto

Arquivos:

- `src/core/observability/redaction.ts`
- `src/lib/governance.ts`
- `src/lib/google-auth.ts`
- `src/lib/google-runtime.ts`
- `src/lib/social-auth.ts`
- `src/lib/crm.ts`
- `src/lib/site-cms.ts`

### 5. Observabilidade autenticada

- collector interno exige bearer token e/ou assinatura quando configurado
- forwarding externo pode usar bearer token e assinatura dedicada
- entregas de observabilidade sao registradas para diagnostico operacional

Arquivos:

- `src/core/observability/collector-auth.ts`
- `src/core/observability/collector-forwarding.ts`
- `src/infrastructure/persistence/observability-delivery-store.ts`
- `src/app/api/agent/observability/collector/route.ts`

## Riscos ainda abertos

### 1. Runtime store

O runtime oficial ja suporta Postgres gerenciado e fallback local JSON. O risco remanescente e operacional: ambientes reais precisam exigir `DATABASE_URL` e `AGENT_AUTOMATION_STORE_MODE=managed` no pipeline, nao apenas por convencao.

### 2. Worker separado

O worker dedicado existe e o modo externo bloqueia consumo inline em producao sem override. O risco remanescente e garantir deploy separado, monitorado e com restart policy.

### 3. Granularidade de authz

O RBAC ja bloqueia por permissao e tenant scope, mas ainda falta uma matriz mais granular por acao, categoria de risco e empresa.

### 4. Sensitive logging

A redaction transversal existe. O risco remanescente e cobertura: novos conectores precisam passar por teste de redaction antes de entrar em producao.

### 5. Policy por contrato comercial

A policy ja cobre spend cap, consentimento, claims proibidas/sensiveis e data sources bloqueadas. Ainda falta persistir uma matriz por tenant com regras editaveis e versionadas por contrato.

## Controles recomendados para producao

- `AUTH_SESSION_SECRET` explicito e rotacionavel
- `VAULT_ENCRYPTION_KEY` explicito
- `SECRETS_ENCRYPTION_KEY` dedicado
- `DATABASE_URL` obrigatorio em producao
- `AGENT_AUTOMATION_STORE_MODE=managed` em producao
- `AGENT_EXECUTION_PLANE_MODE=external` em producao
- `npm run agent:store:check` como gate de deploy
- `npm run agent:observability:check` como gate de deploy
- `controlTower.workerHealth.status` monitorado
- rotacao de segredos por ambiente
- segregacao entre ambientes local, staging e producao
- monitoracao de dead-letter, breaker state e `controlTower.observabilityChannel`
- teste de redaction para cada conector novo

## Conclusao

O Agent Lion saiu de um estado com fallback inseguro de sessao, baixa segregacao de segredos e pouca nocao de tenant authz para uma base muito mais defensavel.

Ele ainda precisa de policy persistida por tenant, SLOs operacionais e disciplina de deploy para worker/store, mas a superficie critica ja esta em um patamar bem mais serio.
