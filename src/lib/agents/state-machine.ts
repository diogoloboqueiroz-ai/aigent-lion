import type { AgentState } from "@/lib/agents/types";

export const AGENT_STATE_SEQUENCE: AgentState[] = [
  "ingest_context",
  "analyze",
  "diagnose",
  "prioritize",
  "propose",
  "approve_if_needed",
  "execute",
  "observe",
  "evaluate",
  "learn",
  "schedule_next_cycle"
];

export function getInitialAgentState(): AgentState {
  return AGENT_STATE_SEQUENCE[0];
}

export function getFinalAgentState(): AgentState {
  return AGENT_STATE_SEQUENCE[AGENT_STATE_SEQUENCE.length - 1];
}

export function getNextAgentState(current: AgentState): AgentState | null {
  const currentIndex = AGENT_STATE_SEQUENCE.indexOf(current);

  if (currentIndex === -1 || currentIndex === AGENT_STATE_SEQUENCE.length - 1) {
    return null;
  }

  return AGENT_STATE_SEQUENCE[currentIndex + 1];
}

export function isValidAgentTransition(from: AgentState, to: AgentState) {
  const next = getNextAgentState(from);
  return next === to || from === to;
}

export function assertAgentTransition(from: AgentState, to: AgentState) {
  if (!isValidAgentTransition(from, to)) {
    throw new Error(`Transicao invalida do ciclo autonomo: ${from} -> ${to}.`);
  }
}
