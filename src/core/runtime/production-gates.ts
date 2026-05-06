export type ProductionGateStatus = "pass" | "warn" | "fail";

export type ProductionGate = {
  id: string;
  status: ProductionGateStatus;
  summary: string;
  remediation: string;
};

export function evaluateAgentProductionGates(env: NodeJS.ProcessEnv = process.env): ProductionGate[] {
  const isProduction = env.NODE_ENV === "production";
  const storeMode = (env.AGENT_AUTOMATION_STORE_MODE ?? "").trim().toLowerCase();
  const executionPlane = (env.AGENT_EXECUTION_PLANE_MODE ?? "").trim().toLowerCase();

  return [
    {
      id: "database-url",
      status: !isProduction || Boolean(env.DATABASE_URL?.trim()) ? "pass" : "fail",
      summary: "DATABASE_URL must be configured in production.",
      remediation: "Set DATABASE_URL to the managed Postgres connection string before deploying."
    },
    {
      id: "managed-store",
      status: !isProduction || storeMode === "managed" ? "pass" : "fail",
      summary: "Production must use AGENT_AUTOMATION_STORE_MODE=managed.",
      remediation: "Set AGENT_AUTOMATION_STORE_MODE=managed and run npm run agent:store:check."
    },
    {
      id: "external-worker",
      status: !isProduction || executionPlane === "external" ? "pass" : "warn",
      summary: "Production should run the worker as a separate execution plane.",
      remediation: "Set AGENT_EXECUTION_PLANE_MODE=external and run npm run agent:worker:supervised under a restart policy."
    },
    {
      id: "session-secret",
      status: !isProduction || Boolean(env.AUTH_SESSION_SECRET?.trim()) ? "pass" : "fail",
      summary: "AUTH_SESSION_SECRET must be explicit in production.",
      remediation: "Set a strong AUTH_SESSION_SECRET and rotate if it was ever committed or shared."
    },
    {
      id: "observability-sink",
      status:
        !isProduction || Boolean(env.AGENT_OBSERVABILITY_WEBHOOK_URL?.trim()) ? "pass" : "warn",
      summary: "Production should export brain metrics to an external observability sink.",
      remediation: "Set AGENT_OBSERVABILITY_WEBHOOK_URL and run npm run agent:observability:check."
    }
  ];
}

export function assertAgentProductionGates(env: NodeJS.ProcessEnv = process.env) {
  const gates = evaluateAgentProductionGates(env);
  const failures = gates.filter((gate) => gate.status === "fail");

  if (failures.length > 0) {
    throw new Error(
      failures.map((gate) => `${gate.id}: ${gate.summary} ${gate.remediation}`).join(" | ")
    );
  }

  return gates;
}
