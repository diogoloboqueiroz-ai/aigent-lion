type EnvVarState = {
  name: string;
  configured: boolean;
};

export function getEnvState(names: string[]): EnvVarState[] {
  return names.map((name) => ({
    name,
    configured: Boolean(process.env[name]?.trim())
  }));
}

export function pickConfiguredEnv(names: string[]) {
  return getEnvState(names)
    .filter((entry) => entry.configured)
    .map((entry) => entry.name);
}

export function areAllEnvConfigured(names: string[]) {
  return getEnvState(names).every((entry) => entry.configured);
}
