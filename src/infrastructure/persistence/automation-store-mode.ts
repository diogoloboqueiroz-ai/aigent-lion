export type AutomationStoreMode = "managed" | "local";

export function getAutomationStoreMode(): AutomationStoreMode {
  const explicitMode = (process.env.AGENT_AUTOMATION_STORE_MODE ?? "").trim().toLowerCase();

  if (explicitMode === "managed" || explicitMode === "local") {
    return explicitMode;
  }

  return hasManagedAutomationStoreConnection() ? "managed" : "local";
}

export function hasManagedAutomationStoreConnection() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function isManagedAutomationStoreConfigured() {
  return getAutomationStoreMode() === "managed" && hasManagedAutomationStoreConnection();
}

export function isLegacyLocalAutomationStoreAllowedInProduction() {
  return (process.env.AGENT_ALLOW_LEGACY_LOCAL_STORE ?? "").trim().toLowerCase() === "true";
}

export function isAutomationStoreProductionReady() {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return isManagedAutomationStoreConfigured();
}

export function getAutomationStoreDisplayName() {
  if (isManagedAutomationStoreConfigured()) {
    return "postgres-managed";
  }

  if (getAutomationStoreMode() === "local") {
    if (process.env.NODE_ENV === "production") {
      return "misconfigured";
    }

    return "local-json";
  }

  return "misconfigured";
}

export function getAutomationStoreConfigurationError() {
  if (isAutomationStoreProductionReady()) {
    return null;
  }

  return "Producao exige DATABASE_URL e AGENT_AUTOMATION_STORE_MODE=managed para o automation store gerenciado.";
}

export function isAutomationStoreMutationAllowed() {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return isAutomationStoreProductionReady();
}

export function assertAutomationStoreMutationAllowed(action = "mutar o automation store") {
  if (isAutomationStoreMutationAllowed()) {
    return;
  }

  const configurationError = getAutomationStoreConfigurationError();
  throw new Error(
    `${configurationError ?? "Automation store nao esta pronto para producao."} Acao bloqueada: ${action}.`
  );
}
