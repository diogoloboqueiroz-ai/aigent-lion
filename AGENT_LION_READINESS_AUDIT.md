# Aigent Lion readiness audit

## Escopo

Auditoria executada sobre uma worktree limpa do Aigent Lion no commit `3cbc88f` (`Harden company API route authorization`), isolada das alteracoes locais da ORTHO.IA. Nenhuma alteracao da ORTHO.IA deve ser incluida em commits, PRs ou deploys do Aigent Lion.

## Resultado executivo

O Aigent Lion esta em um estagio avancado: possui nucleo de decisao, policy engine, learning rigoroso, runtime autonomo, observabilidade, Mission Control, chat operacional, Campaign OS, creative engine, self-improvement, production gates e testes cobrindo areas criticas.

O produto esta pronto para continuar como preview/validacao tecnica, mas ainda nao deve ser promovido como producao real sem configurar ambiente gerenciado, worker externo, observabilidade externa e secrets produtivos na Vercel.

## Validacoes executadas

| Validacao | Resultado | Observacao |
| --- | --- | --- |
| `npm ci` em worktree limpa | Passou | Instalacao limpa concluiu com 377 pacotes. |
| `npm run check` | Passou | Inclui lint, 126 testes e typecheck. |
| `npm run build` | Passou | Build Next.js 16.2.3 com Turbopack concluiu. |
| `npm run agent:production:check` | Passou em modo local | Sem `NODE_ENV=production`, gates reportam readiness contextual. |
| `NODE_ENV=production npm run agent:production:check` | Falhou corretamente | Faltam envs produtivas: `DATABASE_URL`, `AGENT_AUTOMATION_STORE_MODE=managed`, `AUTH_SESSION_SECRET`. |
| `npm run agent:store:check` | Falhou corretamente | `DATABASE_URL` ausente para schema gerenciado. |
| `npm run agent:observability:check` | Passou | Collector/check local sem erro de configuracao. |
| `npm audit --audit-level=moderate` | Falhou | 2 vulnerabilidades moderadas via `next/postcss`; `npm audit fix --force` sugere downgrade perigoso para `next@9.3.3`. |

## O que ja esta forte

- Supreme Brain, Agent Router e Response Composer existem e estao conectados ao chat operacional.
- Mission Control e Evolution Center existem como superficies centrais do operador.
- Campaign OS e Multimodal Creative Engine geram estrategia, ativos, prompts, roteiros e QA.
- Policy engine possui regras deterministicas, matriz por tenant, avaliacao de risco, bloqueios e approvals.
- Learning engine ja trata evidencia, decaimento, reuso, playbooks e protecao contra falsos positivos.
- Runtime tem queue, retry, dead-letter, intents, idempotencia, circuit breakers e worker dedicado.
- Observabilidade do cerebro tem control tower, metricas, collector e health de canal.
- Production gates existem e falham fechado quando rodados com `NODE_ENV=production`.
- Rotas sensiveis por empresa foram endurecidas com sessao, RBAC e `Cache-Control: no-store`.

## Bloqueadores antes de producao real

| Severidade | Area | Problema | Acao necessaria |
| --- | --- | --- | --- |
| P0 | Vercel/env | Nao ha projeto Vercel linkado para o Aigent Lion na worktree limpa. A conta lista projetos ORTHO/Dr Diogo, mas nao Aigent Lion. | Criar/linkar projeto Vercel dedicado `aigent-lion`, nunca reaproveitar ORTHO.IA. |
| P0 | Secrets | `NODE_ENV=production npm run agent:production:check` falha sem `AUTH_SESSION_SECRET`. | Configurar secret forte em Vercel antes de qualquer deploy de producao. |
| P0 | Persistencia | `DATABASE_URL` ausente e `agent:store:check` falha sem schema gerenciado. | Configurar Postgres gerenciado, rodar schema check e validar indices/tabelas. |
| P0 | Store mode | `AGENT_AUTOMATION_STORE_MODE=managed` ausente em modo producao. | Definir modo managed em Vercel e impedir fallback local produtivo. |
| P1 | Worker | Worker externo ainda precisa ser validado como processo separado/restart policy no ambiente alvo. | Rodar `npm run agent:worker:supervised` ou worker externo equivalente com health no Mission Control. |
| P1 | Observabilidade | Collector local passa, mas destino externo real ainda precisa ser confirmado. | Configurar webhook/collector externo e validar `controlTower.observabilityChannel.health`. |
| P1 | Dependencias | `npm audit` aponta 2 moderadas via `next/postcss`. | Aguardar patch compatavel de Next/PostCSS ou atualizar sem `--force`; nao aceitar downgrade automatico. |
| P1 | Execucao real | Ainda existem adaptadores simulados/fallbacks seguros em execucao low-risk. | Conectar mutacoes reais por conector gradualmente, sempre via policy e audit trail. |
| P2 | Legacy facade | `src/lib/company-vault.ts` esta em 1079 linhas e ainda e usado por rotas/modulos legados. | Continuar drenagem segura de callers legados para storages dedicados. |

## Dependencia residual do company-vault

O core novo e boa parte da infraestrutura ja usam storages dedicados, mas ainda existem imports em `src/app/*` e em modulos legados `src/lib/*`. Isso confirma que o `company-vault.ts` esta mais perto de facade de compatibilidade, mas ainda nao e uma facade minima.

Residuo principal:

- Rotas antigas em `src/app/api/companies/[companyId]/*` ainda importam exports de compatibilidade.
- Paginas antigas em `src/app/empresas/[companyId]/*` ainda leem algumas colecoes via facade.
- Modulos legados em `src/lib/*` como `connectors.ts`, `execution.ts`, `learning.ts`, `crm.ts`, `creative-tools.ts`, `scheduler.ts`, `reports.ts` e social runtime ainda usam a facade.
- `src/infrastructure/persistence/*` usa corretamente `company-vault-payload-store`, `company-vault-schema` e `company-vault-storage`, nao a facade publica.

## Seguranca e isolamento

- O patch recente de autorizacao reduziu um risco critico: rotas por empresa agora usam sessao/RBAC de forma consistente.
- A rota `conversion/capture` segue como excecao intencional para eventos externos e precisa manter protecao por chave/origem.
- Segredos estao mais separados do business state, mas Vercel precisa receber secrets reais antes de producao.
- Nao ha autorizacao para misturar ORTHO.IA e Aigent Lion. A auditoria e a publicacao devem manter repos, projetos e envs separados.

## Vercel readiness

Estado atual:

- Vercel CLI instalado e autenticado o suficiente para listar projetos.
- Projetos encontrados na conta: `ortho-ia`, `ortho-ai`, `dr-diogo-landing`, `dr-diogo-landing-avmc`.
- Nenhum projeto Vercel dedicado ao Aigent Lion foi encontrado.
- Deploy de producao nao deve ser feito em projeto ORTHO.IA ou Dr Diogo.

Variaveis minimas antes de deploy produtivo:

- `AUTH_SESSION_SECRET`
- `VAULT_ENCRYPTION_KEY`
- `SECRETS_ENCRYPTION_KEY`
- `DATABASE_URL`
- `DATABASE_SSL_MODE=require`
- `AGENT_AUTOMATION_STORE_MODE=managed`
- `AGENT_EXECUTION_PLANE_MODE=external`
- `AGENT_OBSERVABILITY_WEBHOOK_URL` ou variaveis do collector externo

Checklist recomendado antes de `vercel deploy --prod`:

1. Criar/linkar projeto Vercel dedicado `aigent-lion`.
2. Configurar variaveis de producao.
3. Rodar `vercel pull --yes --environment=production`.
4. Rodar `NODE_ENV=production npm run agent:production:check`.
5. Rodar `npm run agent:store:check` com `DATABASE_URL` real.
6. Rodar `npm run agent:observability:check` apontando para sink real.
7. Rodar `vercel build --prod`.
8. Rodar `vercel deploy --prebuilt --prod`.
9. Subir worker separado e verificar Mission Control.

## Conclusao

O Aigent Lion tem base tecnica forte e passou nos checks locais principais. O proximo salto nao e mais criar novas telas ou engines: e fechar o ambiente produtivo real com Vercel dedicado, Postgres gerenciado, secrets, worker externo e observabilidade externa.

Deploy de producao agora, sem essas configuracoes, seria prematuro. Deploy seguro exige primeiro criar/linkar um projeto Vercel exclusivo do Aigent Lion e configurar os gates produtivos.
