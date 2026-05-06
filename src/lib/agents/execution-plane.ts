export type AgentExecutionPlaneMode = "inline" | "external";
export type AgentExecutionContext = "worker" | "inline_control_plane";

export function getAgentExecutionPlaneMode(): AgentExecutionPlaneMode {
  const explicitMode = (process.env.AGENT_EXECUTION_PLANE_MODE ?? "").trim().toLowerCase();

  if (explicitMode === "inline" || explicitMode === "external") {
    return explicitMode;
  }

  return process.env.NODE_ENV === "production" ? "external" : "inline";
}

export function isExternalAgentExecutionPlane() {
  return getAgentExecutionPlaneMode() === "external";
}

export function canInlineAgentWorkerExecution() {
  if (!isExternalAgentExecutionPlane()) {
    return true;
  }

  return (process.env.AGENT_ALLOW_INLINE_EXECUTION ?? "").trim().toLowerCase() === "true";
}

export function assertAgentExecutionContextAllowed(context: AgentExecutionContext) {
  if (context === "worker") {
    return;
  }

  if (!canInlineAgentWorkerExecution()) {
    throw new Error(
      "O Agent Lion esta em execution plane externo. O control plane nao pode consumir a fila inline sem override explicito."
    );
  }
}
