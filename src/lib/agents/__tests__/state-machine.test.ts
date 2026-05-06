import test from "node:test";
import assert from "node:assert/strict";
import {
  AGENT_STATE_SEQUENCE,
  assertAgentTransition,
  getFinalAgentState,
  getInitialAgentState,
  getNextAgentState,
  isValidAgentTransition
} from "../state-machine";

test("state machine follows the canonical sequence", () => {
  assert.equal(getInitialAgentState(), "ingest_context");
  assert.equal(getFinalAgentState(), "schedule_next_cycle");

  for (let index = 0; index < AGENT_STATE_SEQUENCE.length - 1; index += 1) {
    const current = AGENT_STATE_SEQUENCE[index];
    const next = AGENT_STATE_SEQUENCE[index + 1];

    assert.equal(getNextAgentState(current), next);
    assert.equal(isValidAgentTransition(current, next), true);
    assert.doesNotThrow(() => assertAgentTransition(current, next));
  }

  assert.equal(getNextAgentState("schedule_next_cycle"), null);
});

test("state machine rejects jumps outside the canonical flow", () => {
  assert.equal(isValidAgentTransition("ingest_context", "diagnose"), false);
  assert.throws(() => assertAgentTransition("ingest_context", "diagnose"));
});
