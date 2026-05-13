import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const restartDelayArg = args.find((value) => value.startsWith("--restart-delay-ms="));
const maxRestartsArg = args.find((value) => value.startsWith("--max-restarts="));
const workerArgs = args.filter(
  (value) =>
    !value.startsWith("--restart-delay-ms=") &&
    !value.startsWith("--max-restarts=")
);

const restartDelayMs = parsePositiveNumber(restartDelayArg?.split("=")[1], 5000);
const maxRestarts = parsePositiveNumber(maxRestartsArg?.split("=")[1], Number.POSITIVE_INFINITY);
let restartCount = 0;
let shuttingDown = false;
let child: ReturnType<typeof spawn> | null = null;

function startWorker() {
  child = spawn(
    process.execPath,
    ["--import", "tsx", "src/scripts/agent-worker.ts", ...workerArgs],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        AGENT_WORKER_ID:
          process.env.AGENT_WORKER_ID ??
          `agent-worker-supervised-${process.pid}`
      },
      stdio: "inherit"
    }
  );

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    restartCount += 1;
    console.error(
      `[agent-worker-supervisor] worker saiu code=${code ?? "null"} signal=${signal ?? "null"} restart=${restartCount}`
    );

    if (restartCount > maxRestarts) {
      console.error("[agent-worker-supervisor] limite de restarts atingido");
      process.exitCode = 1;
      return;
    }

    setTimeout(startWorker, restartDelayMs);
  });
}

function shutdown(signal: NodeJS.Signals) {
  shuttingDown = true;
  console.log(`[agent-worker-supervisor] encerrando por ${signal}`);
  child?.kill(signal);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startWorker();

function parsePositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
