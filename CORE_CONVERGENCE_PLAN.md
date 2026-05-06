# Core Convergence Plan

## Objective

Encerrar a dualidade entre `src/core/*` e `src/lib/agents/*` sem reescrever o produto do zero. A regra daqui em diante e simples:

- `src/core/*` deve concentrar contratos, raciocinio deterministico, policy, learning e runtime semantics
- `src/lib/agents/*` deve virar camada de adaptacao/orquestracao de produto
- tudo o que continuar pesado no legado precisa ter destino e prazo

## Ownership Matrix

| Module | Current owner | Status | Decision |
| --- | --- | --- | --- |
| `src/core/decision/decision-engine.ts` | Core | Active | `keep` |
| `src/core/decision/action-planner.ts` | Core | Active | `keep` |
| `src/lib/agents/decision-engine.ts` | Adapter | Reduced wrapper | `wrap` |
| `src/core/decision/diagnostic-engine.ts` | Core | Active | `keep` |
| `src/lib/agents/diagnostic-engine.ts` | Adapter | Thin wrapper | `wrap` |
| `src/core/decision/cmo-strategy.ts` | Core | Active | `keep` |
| `src/lib/agents/cmo-agent.ts` | Adapter | Thin wrapper | `wrap` |
| `src/core/policy/policy-engine.ts` | Core | Active | `keep` |
| `src/lib/agents/policy-engine.ts` | Adapter | Thin wrapper | `wrap` |
| `src/core/policy/policy-registry.ts` | Core | Active | `keep` |
| `src/lib/agents/policy-registry.ts` | Adapter | Summary/export only | `wrap` |
| `src/core/learning/learning-engine.ts` | Core | Active | `keep` |
| `src/core/learning/cross-tenant-learning.ts` | Core | Active | `keep` |
| `src/lib/agents/execution-engine.ts#runFeedbackEngine` | Core-backed | Thin wrapper | `wrap` |
| `src/core/runtime/job-planner.ts` | Core | Active | `keep` |
| `src/core/runtime/automation-run.ts` | Core | Active | `keep` |
| `src/core/runtime/execution-helpers.ts` | Core | Active | `keep` |
| `src/lib/learning.ts` | Legacy specialist | Still heavy | `migrate incrementally` |
| `src/core/runtime/execution-runtime.ts` | Core | Active | `keep` |
| `src/lib/agents/runtime-guards.ts` | Adapter | Thin bridge | `wrap` |
| `src/lib/agents/runtime.ts` | Product control plane | Active | `keep as facade` |
| `src/lib/agents/orchestrator.ts` | Product orchestration | Thinner control plane | `migrate incrementally` |
| `src/lib/agents/execution-engine.ts` | Adapter | Runtime loop + outcome bridge | `wrap` |
| `src/lib/agents/execution-dispatch.ts` | Adapter | Real executor dispatch bridge | `migrate incrementally` |
| `src/lib/agents/diagnostic-engine.ts` | Adapter | Thin wrapper | `wrap` |
| `src/lib/agents/cmo-agent.ts` | Adapter | Thin wrapper | `wrap` |
| `src/lib/agents/worker.ts` | Execution plane facade | Active | `keep as facade` |
| `src/infrastructure/connectors/workspace-seeds.ts` | Infrastructure | Active | `keep` |
| `src/infrastructure/connectors/workspace-hydration.ts` | Infrastructure | Active | `keep` |
| `src/infrastructure/persistence/company-connection-storage.ts` | Infrastructure | Active | `keep` |
| `src/infrastructure/persistence/company-automation-storage.ts` | Infrastructure | Active | `keep` |
| `src/infrastructure/persistence/company-approvals-storage.ts` | Infrastructure | Active | `keep` |
| `src/infrastructure/persistence/company-reports-storage.ts` | Infrastructure | Active | `keep` |
| `src/lib/connectors.ts` | Adapter | Workspace composition facade | `wrap` |
| `src/lib/company-vault.ts` | Legacy persistence facade | Still broad but drained | `migrate incrementally` |

## Immediate Migration Sequence

### Wave 1

- `decision`: move opportunity/action synthesis into `src/core/decision`
- `policy`: keep `src/lib/agents/policy-engine.ts` only as compatibility wrapper
- `learning`: keep feedback generation in core and continue draining playbook synthesis from `src/lib/learning.ts`

### Wave 2

- `diagnostic`: extracted to `src/core/decision/diagnostic-engine.ts`
- `cmo-agent`: extracted to `src/core/decision/cmo-strategy.ts`
- `orchestrator`: next target, reducing to control-plane orchestration + audit hooks

### Wave 3

- `execution-engine`: split intent/job planning into core runtime contracts and keep only connector dispatch in `src/lib`
- `execution-engine`: reduce runtime loop to core helpers + adapter dispatch bridge
- `orchestrator`: run lifecycle extracted to `src/core/runtime/automation-run.ts`
- `memory-engine`: keep as hydration facade, but move reusable memory transforms into `src/core/learning`

### Wave 4

- `workspaceSeeds`: moved to `src/infrastructure/connectors/workspace-seeds.ts`
- connector overview catalog moved to `src/infrastructure/connectors/connector-overview-catalog.ts`
- workspace hydration moved to `src/infrastructure/connectors/workspace-hydration.ts`
- connection hydration/persistence moved to `src/infrastructure/persistence/company-connection-storage.ts`
- automation mirror/storage helpers moved to `src/infrastructure/persistence/company-automation-storage.ts`
- payment and publishing approval collection logic moved to `src/infrastructure/persistence/company-approvals-storage.ts`
- reports and metric snapshot collection logic moved to `src/infrastructure/persistence/company-reports-storage.ts`
- observability collector forwarding and delivery tracking added under `src/core/observability` and `src/infrastructure/persistence`

### Remaining convergence work

- continue extracting dedicated repositories for social ops, CRM state, creative assets and profile aggregates
- keep `src/lib/company-vault.ts` as compatibility facade until those repositories own their collections
- keep `src/lib/connectors.ts` as workspace composition facade, with new hydration logic landing in `src/infrastructure/connectors`

## Deprecation Rules

- no new business heuristics should land directly in `src/lib/agents/decision-engine.ts`
- no new policy rule should land outside `src/core/policy/*`
- no new learning classification should land outside `src/core/learning/*` unless it is purely a product integration concern

## Exit Criteria

Convergence can be considered healthy when:

1. `src/lib/agents/decision-engine.ts` only adapts core outputs
2. `src/lib/agents/policy-engine.ts` only adapts core policy outputs
3. `src/lib/agents/execution-engine.ts` stops carrying structural runtime semantics and only coordinates adapter dispatch
4. `src/lib/agents/diagnostic-engine.ts` and `src/lib/agents/cmo-agent.ts` have explicit migration targets in core
5. new decision logic defaults to `src/core/*`
6. new persistence and hydration logic defaults to `src/infrastructure/*`
7. `src/lib/company-vault.ts` only exposes compatibility functions over dedicated repositories
