import { evaluateAgentProductionGates } from "@/core/runtime/production-gates";

const gates = evaluateAgentProductionGates();
const failed = gates.filter((gate) => gate.status === "fail");

console.log(
  JSON.stringify(
    {
      ok: failed.length === 0,
      checkedAt: new Date().toISOString(),
      gates
    },
    null,
    2
  )
);

if (failed.length > 0) {
  process.exitCode = 1;
}
