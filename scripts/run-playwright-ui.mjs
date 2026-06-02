import { spawn } from "node:child_process";

const port = 5178;
const baseUrl = `http://127.0.0.1:${port}`;

function spawnNode(args, options = {}) {
  return spawn(process.execPath, args, {
    cwd: process.cwd(),
    shell: false,
    stdio: options.stdio ?? "inherit",
    windowsHide: true,
  });
}

async function waitForServer(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry until Vite finishes binding the port.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function runPlaywright(args) {
  return await new Promise((resolve) => {
    const child = spawnNode(["node_modules/@playwright/test/cli.js", "test", ...args]);
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

function stopServer(server) {
  if (server.killed) return;
  server.kill();
}

const vite = spawnNode(
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port)],
  { stdio: "pipe" },
);

vite.stdout?.on("data", (chunk) => process.stdout.write(chunk));
vite.stderr?.on("data", (chunk) => process.stderr.write(chunk));

let exitCode = 1;
try {
  await waitForServer(baseUrl);
  exitCode = await runPlaywright(process.argv.slice(2));
} finally {
  stopServer(vite);
}

process.exit(exitCode);
