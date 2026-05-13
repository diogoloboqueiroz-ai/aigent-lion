import test from "node:test";
import assert from "node:assert/strict";
import {
  assertAgentExecutionContextAllowed,
  canInlineAgentWorkerExecution,
  getAgentExecutionPlaneMode
} from "@/lib/agents/execution-plane";

const mutableEnv = process.env as Record<string, string | undefined>;

test("execution plane defaults to inline outside production", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousMode = process.env.AGENT_EXECUTION_PLANE_MODE;

  mutableEnv.NODE_ENV = "development";
  delete mutableEnv.AGENT_EXECUTION_PLANE_MODE;

  assert.equal(getAgentExecutionPlaneMode(), "inline");
  assert.equal(canInlineAgentWorkerExecution(), true);

  mutableEnv.NODE_ENV = previousNodeEnv;
  if (previousMode === undefined) {
    delete mutableEnv.AGENT_EXECUTION_PLANE_MODE;
  } else {
    mutableEnv.AGENT_EXECUTION_PLANE_MODE = previousMode;
  }
});

test("execution plane defaults to external in production", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousMode = process.env.AGENT_EXECUTION_PLANE_MODE;
  const previousInline = process.env.AGENT_ALLOW_INLINE_EXECUTION;

  mutableEnv.NODE_ENV = "production";
  delete mutableEnv.AGENT_EXECUTION_PLANE_MODE;
  delete mutableEnv.AGENT_ALLOW_INLINE_EXECUTION;

  assert.equal(getAgentExecutionPlaneMode(), "external");
  assert.equal(canInlineAgentWorkerExecution(), false);

  mutableEnv.AGENT_ALLOW_INLINE_EXECUTION = "true";
  assert.equal(canInlineAgentWorkerExecution(), true);

  mutableEnv.NODE_ENV = previousNodeEnv;
  if (previousMode === undefined) {
    delete mutableEnv.AGENT_EXECUTION_PLANE_MODE;
  } else {
    mutableEnv.AGENT_EXECUTION_PLANE_MODE = previousMode;
  }
  if (previousInline === undefined) {
    delete mutableEnv.AGENT_ALLOW_INLINE_EXECUTION;
  } else {
    mutableEnv.AGENT_ALLOW_INLINE_EXECUTION = previousInline;
  }
});

test("inline control plane execution is blocked in production external mode without override", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousMode = process.env.AGENT_EXECUTION_PLANE_MODE;
  const previousInline = process.env.AGENT_ALLOW_INLINE_EXECUTION;

  mutableEnv.NODE_ENV = "production";
  delete mutableEnv.AGENT_EXECUTION_PLANE_MODE;
  delete mutableEnv.AGENT_ALLOW_INLINE_EXECUTION;

  assert.throws(
    () => assertAgentExecutionContextAllowed("inline_control_plane"),
    /execution plane externo/i
  );
  assert.doesNotThrow(() => assertAgentExecutionContextAllowed("worker"));

  mutableEnv.AGENT_ALLOW_INLINE_EXECUTION = "true";
  assert.doesNotThrow(() => assertAgentExecutionContextAllowed("inline_control_plane"));

  mutableEnv.NODE_ENV = previousNodeEnv;
  if (previousMode === undefined) {
    delete mutableEnv.AGENT_EXECUTION_PLANE_MODE;
  } else {
    mutableEnv.AGENT_EXECUTION_PLANE_MODE = previousMode;
  }
  if (previousInline === undefined) {
    delete mutableEnv.AGENT_ALLOW_INLINE_EXECUTION;
  } else {
    mutableEnv.AGENT_ALLOW_INLINE_EXECUTION = previousInline;
  }
});
