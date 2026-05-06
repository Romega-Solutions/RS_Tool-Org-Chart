import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");
const serverPath = path.join(standaloneDir, "server.js");

if (!existsSync(serverPath)) {
  console.error("Missing .next/standalone/server.js. Run pnpm build before Playwright.");
  process.exit(1);
}

for (const [source, destination] of [
  [path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static")],
  [path.join(root, "public"), path.join(standaloneDir, "public")],
]) {
  if (existsSync(source)) {
    cpSync(source, destination, { recursive: true, force: true });
  }
}

const child = spawn(process.execPath, [serverPath], {
  cwd: standaloneDir,
  env: process.env,
  stdio: "inherit",
});

function shutdown(signal) {
  child.kill(signal);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
