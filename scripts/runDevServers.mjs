import { spawn } from "node:child_process";

const children = [
  spawn(process.execPath, ["--watch", "server/index.mjs"], {
    stdio: "inherit"
  }),
  spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--configLoader", "native"],
    { stdio: "inherit" }
  )
];

let stopping = false;

function stop(signal) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill(signal);
}
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
for (const child of children) {
  child.on("exit", (code, signal) => {
    if (stopping) return;
    stop("SIGTERM");
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}
