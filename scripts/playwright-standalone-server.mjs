import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");
const serverPath = path.join(standaloneDir, "server.js");
const wrapperPath = path.join(standaloneDir, "tools-domain-standalone-server.mjs");

if (!existsSync(serverPath)) {
  console.error("Missing .next/standalone/server.js. Run pnpm build before Playwright.");
  process.exit(1);
}

for (const [source, destination] of [
  [path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static")],
  [path.join(root, ".next", "server"), path.join(standaloneDir, ".next", "server")],
  [path.join(root, "public"), path.join(standaloneDir, "public")],
  [path.join(root, "scripts", "tools-domain-standalone-server.mjs"), wrapperPath],
]) {
  if (existsSync(source)) {
    cpSync(source, destination, { recursive: true, force: true });
  }
}

const child = spawn(process.execPath, [wrapperPath], {
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
