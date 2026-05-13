# Migration Guide

## Objetivo

Este guia resume as mudancas operacionais relevantes ate a Fase 6.

## 1. Sessao

### Antes

- `src/lib/session.ts` aceitava fallback hardcoded

### Agora

- producao exige `AUTH_SESSION_SECRET`
- leitura sem segredo em producao invalida a sessao
- emissao sem segredo em producao falha explicitamente

### Acao

Defina `AUTH_SESSION_SECRET` em todos os ambientes reais antes de publicar.

## 2. Tenant scope no perfil profissional

### Antes

- RBAC avaliava apenas permissao funcional

### Agora

- perfis podem usar:
  - `tenantScope`
  - `allowedCompanySlugs`

### Compatibilidade

- perfis antigos sao hidratados como `tenantScope: "all"`
- nenhuma migracao manual e obrigatoria para continuar funcionando

## 3. Secrets management

### Antes

- credenciais operacionais apareciam misturadas ao business state

### Agora

- segredos vivem em `src/infrastructure/secrets/tenant-secrets-store.ts`
- o vault principal preserva metadata e hidrata os secrets quando necessario

### Acao

Em producao, prefira configurar:

- `VAULT_ENCRYPTION_KEY`
- `SECRETS_ENCRYPTION_KEY`

## 4. Scripts

Novos scripts disponiveis:

- `npm run typecheck`
- `npm run check`

## 5. Learning loop

### Antes

- a memoria era mais proxima de sintese operacional

### Agora

- experimentos geram outcomes persistidos
- outcomes geram playbooks
- playbooks realimentam scorecards e decisoes futuras

## 6. Proximo passo recomendado

Para ambientes reais multiempresa, a proxima migracao importante e:

1. trocar o backend local experimental do durable store por backend gerenciado
2. separar worker do processo web
3. completar granularidade enterprise de policy e authz
