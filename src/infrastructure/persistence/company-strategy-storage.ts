import type {
  CompanyExecutionPlan,
  CompanyKeywordStrategy,
  CompanyOperationalAlert,
  CompanyStrategicPlan,
  TechnicalRequest
} from "@/lib/domain";
import {
  readCompanyVaultPayload,
  writeCompanyVaultPayload
} from "@/infrastructure/persistence/company-vault-payload-store";

export function listStoredCompanyStrategies(strategies: CompanyStrategicPlan[]) {
  return strategies;
}

export function getPersistedCompanyStrategies() {
  return listStoredCompanyStrategies(readCompanyVaultPayload().companyStrategies);
}

export function getStoredCompanyStrategyFromCollection(
  strategies: CompanyStrategicPlan[],
  companySlug: string
) {
  return strategies.find((strategy) => strategy.companySlug === companySlug);
}

export function getPersistedCompanyStrategy(companySlug: string) {
  return getStoredCompanyStrategyFromCollection(
    readCompanyVaultPayload().companyStrategies,
    companySlug
  );
}

export function upsertStoredCompanyStrategyInCollection(
  strategies: CompanyStrategicPlan[],
  strategy: CompanyStrategicPlan
) {
  return upsertByCompanySlug(strategies, strategy);
}

export function upsertPersistedCompanyStrategy(strategy: CompanyStrategicPlan) {
  const payload = readCompanyVaultPayload();
  writeCompanyVaultPayload({
    ...payload,
    companyStrategies: upsertStoredCompanyStrategyInCollection(
      payload.companyStrategies,
      strategy
    )
  });
}

export function listStoredCompanyExecutionPlans(
  plans: CompanyExecutionPlan[],
  companySlug?: string
) {
  return filterByCompany(plans, companySlug);
}

export function getPersistedCompanyExecutionPlans(companySlug?: string) {
  return listStoredCompanyExecutionPlans(
    readCompanyVaultPayload().companyExecutionPlans,
    companySlug
  );
}

export function appendStoredCompanyExecutionPlanToCollection(
  plans: CompanyExecutionPlan[],
  plan: CompanyExecutionPlan
) {
  return [plan, ...plans].slice(0, 120);
}

export function appendPersistedCompanyExecutionPlan(plan: CompanyExecutionPlan) {
  const payload = readCompanyVaultPayload();
  writeCompanyVaultPayload({
    ...payload,
    companyExecutionPlans: appendStoredCompanyExecutionPlanToCollection(
      payload.companyExecutionPlans,
      plan
    )
  });
}

export function listStoredCompanyOperationalAlerts(
  alerts: CompanyOperationalAlert[],
  companySlug?: string
) {
  return filterByCompany(alerts, companySlug);
}

export function getPersistedCompanyOperationalAlerts(companySlug?: string) {
  return listStoredCompanyOperationalAlerts(
    readCompanyVaultPayload().companyOperationalAlerts,
    companySlug
  );
}

export function upsertStoredCompanyOperationalAlertInCollection(
  alerts: CompanyOperationalAlert[],
  alert: CompanyOperationalAlert
) {
  return upsertById(alerts, alert);
}

export function upsertPersistedCompanyOperationalAlert(alert: CompanyOperationalAlert) {
  const payload = readCompanyVaultPayload();
  writeCompanyVaultPayload({
    ...payload,
    companyOperationalAlerts: upsertStoredCompanyOperationalAlertInCollection(
      payload.companyOperationalAlerts,
      alert
    )
  });
}

export function replaceStoredCompanyOperationalAlertsInCollection(input: {
  existing: CompanyOperationalAlert[];
  companySlug: string;
  alerts: CompanyOperationalAlert[];
}) {
  return [
    ...input.alerts,
    ...input.existing.filter((entry) => entry.companySlug !== input.companySlug)
  ].slice(0, 240);
}

export function replacePersistedCompanyOperationalAlerts(
  companySlug: string,
  alerts: CompanyOperationalAlert[]
) {
  const payload = readCompanyVaultPayload();
  writeCompanyVaultPayload({
    ...payload,
    companyOperationalAlerts: replaceStoredCompanyOperationalAlertsInCollection({
      existing: payload.companyOperationalAlerts,
      companySlug,
      alerts
    })
  });
}

export function listStoredCompanyKeywordStrategies(
  strategies: CompanyKeywordStrategy[]
) {
  return strategies;
}

export function getPersistedCompanyKeywordStrategies() {
  return listStoredCompanyKeywordStrategies(readCompanyVaultPayload().companyKeywordStrategies);
}

export function getStoredCompanyKeywordStrategyFromCollection(
  strategies: CompanyKeywordStrategy[],
  companySlug: string
) {
  return strategies.find((strategy) => strategy.companySlug === companySlug);
}

export function getPersistedCompanyKeywordStrategy(companySlug: string) {
  return getStoredCompanyKeywordStrategyFromCollection(
    readCompanyVaultPayload().companyKeywordStrategies,
    companySlug
  );
}

export function upsertStoredCompanyKeywordStrategyInCollection(
  strategies: CompanyKeywordStrategy[],
  strategy: CompanyKeywordStrategy
) {
  return upsertByCompanySlug(strategies, strategy);
}

export function upsertPersistedCompanyKeywordStrategy(strategy: CompanyKeywordStrategy) {
  const payload = readCompanyVaultPayload();
  writeCompanyVaultPayload({
    ...payload,
    companyKeywordStrategies: upsertStoredCompanyKeywordStrategyInCollection(
      payload.companyKeywordStrategies,
      strategy
    )
  });
}

export function listStoredTechnicalRequests(
  requests: TechnicalRequest[],
  companySlug?: string
) {
  return filterByCompany(requests, companySlug);
}

export function getPersistedTechnicalRequests(companySlug?: string) {
  return listStoredTechnicalRequests(readCompanyVaultPayload().technicalRequests, companySlug);
}

export function upsertStoredTechnicalRequestInCollection(
  requests: TechnicalRequest[],
  request: TechnicalRequest
) {
  return upsertById(requests, request);
}

export function upsertPersistedTechnicalRequest(request: TechnicalRequest) {
  const payload = readCompanyVaultPayload();
  writeCompanyVaultPayload({
    ...payload,
    technicalRequests: upsertStoredTechnicalRequestInCollection(
      payload.technicalRequests,
      request
    )
  });
}

function filterByCompany<T extends { companySlug: string }>(
  items: T[],
  companySlug?: string
) {
  return companySlug ? items.filter((item) => item.companySlug === companySlug) : items;
}

function upsertByCompanySlug<T extends { companySlug: string }>(items: T[], item: T) {
  return [...items.filter((entry) => entry.companySlug !== item.companySlug), item];
}

function upsertById<T extends { id: string }>(items: T[], item: T) {
  return [...items.filter((entry) => entry.id !== item.id), item];
}
