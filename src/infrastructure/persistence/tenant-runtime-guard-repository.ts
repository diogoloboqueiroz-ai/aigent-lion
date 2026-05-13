import { toTenantId, type TenantId } from "@/core/domain/tenant";
import {
  isManagedAutomationStoreConfigured,
  upsertManagedConnectorCircuitBreaker,
  upsertManagedExecutionIntent
} from "@/infrastructure/persistence/managed-automation-store";
import { assertAutomationStoreMutationAllowed } from "@/infrastructure/persistence/automation-store-mode";
import {
  getDurableConnectorCircuitBreakers,
  getDurableExecutionIntents,
  upsertDurableConnectorCircuitBreaker,
  upsertDurableExecutionIntent
} from "@/lib/durable-store";
import type {
  CompanyConnectorCircuitBreaker,
  CompanyExecutionIntent
} from "@/lib/domain";

export type TenantRuntimeGuardRepository = {
  listExecutionIntents(tenantId: TenantId): CompanyExecutionIntent[];
  upsertExecutionIntent(intent: CompanyExecutionIntent): void;
  listConnectorCircuitBreakers(tenantId: TenantId): CompanyConnectorCircuitBreaker[];
  upsertConnectorCircuitBreaker(breaker: CompanyConnectorCircuitBreaker): void;
};

export function createTenantRuntimeGuardRepository(): TenantRuntimeGuardRepository {
  return {
    listExecutionIntents(tenantId) {
      return getDurableExecutionIntents(String(tenantId));
    },
    upsertExecutionIntent(intent) {
      assertAutomationStoreMutationAllowed("persistir execution intent do runtime");
      upsertDurableExecutionIntent(intent);
      if (isManagedAutomationStoreConfigured()) {
        void upsertManagedExecutionIntent(intent);
      }
    },
    listConnectorCircuitBreakers(tenantId) {
      return getDurableConnectorCircuitBreakers(String(tenantId));
    },
    upsertConnectorCircuitBreaker(breaker) {
      assertAutomationStoreMutationAllowed("persistir circuit breaker do runtime");
      upsertDurableConnectorCircuitBreaker(breaker);
      if (isManagedAutomationStoreConfigured()) {
        void upsertManagedConnectorCircuitBreaker(breaker);
      }
    }
  };
}

export function resolveRuntimeTenantId(companySlug: string) {
  return toTenantId(companySlug);
}
