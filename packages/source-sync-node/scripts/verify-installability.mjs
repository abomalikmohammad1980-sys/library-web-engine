import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");
const temp = await mkdtemp(join(tmpdir(), "khizana-source-sync-install-"));
let server;
try {
  await run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["--filter", "@library/source-sync-node", "build"], repoRoot);
  const packDir = join(temp, "pack"); await mkdir(packDir);
  await run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["pack", "--pack-destination", packDir], packageRoot);
  const tarball = join(packDir, (await readdir(packDir)).find(name => name.endsWith(".tgz")) ?? fail("tarball missing"));
  const installed = join(temp, "installed"); await mkdir(installed);
  await writeFile(join(installed, "package.json"), JSON.stringify({ private: true }));
  await run(process.platform === "win32" ? "npm.cmd" : "npm", ["install", tarball, "--ignore-scripts", "--no-audit", "--no-fund"], installed);

  let ready = true;
  server = createServer((request, response) => {
    if (request.url === "/ready") return json(response, { ready, bindings: [], missingTables: [] });
    if (request.url === "/build-service/check") return json(response, { ok: true });
    if (request.url === "/convert" && request.method === "OPTIONS") { response.writeHead(204); return response.end(); }
    response.writeHead(404); response.end();
  });
  await new Promise((accept, reject) => server.listen(0, "127.0.0.1", error => error ? reject(error) : accept()));
  const address = server.address(); if (typeof address !== "object" || address === null) fail("server address missing");
  const origin = `http://127.0.0.1:${address.port}/`;
  const configPath = join(temp, "config.json");
  await writeFile(configPath, JSON.stringify({
    managedDir: join(temp, "books"), stateFile: join(temp, "state.json"), lockFile: join(temp, "sync.lock"), healthFile: join(temp, "health.json"),
    apiBase: origin, buildApiBase: `${origin}build-service/`, pdfEndpoint: `${origin}convert`, deviceId: "cold-device", engineVersion: "cold",
    tokenSource: { kind: "env", name: "COLD_USER_TOKEN" }, serviceTokenSource: { kind: "env", name: "COLD_SERVICE_TOKEN" },
    reconcileIntervalMs: 1000, outboxIntervalMs: 1000, buildIntervalMs: 1000,
    maxSourceBytes: 1_000_000, maxPdfBytes: 1_000_000, requestTimeoutMs: 1000,
  }));
  const cli = join(installed, "node_modules", "@library", "source-sync-node", "dist", "cli-main.js");
  const env = { ...process.env, COLD_SERVICE_TOKEN: "installability-secret" };
  const outputs = [];
  for (const command of ["config-check", "provision-check", "remote-check"]) {
    outputs.push(await run(process.execPath, [cli, command, "--config", configPath], installed, env));
  }
  ready = false;
  const rejected = await runResult(process.execPath, [cli, "provision-check", "--config", configPath], installed, env);
  if (rejected.code !== 5) fail(`false readiness must exit 5, got ${rejected.code}`);
  const combined = [...outputs, rejected].map(item => `${item.stdout}\n${item.stderr}`).join("\n");
  if (combined.includes("installability-secret") || combined.includes(configPath)) fail("cold-start output leaked secret or config path");
  process.stdout.write(JSON.stringify({ event: "package-installability-ok", commands: 4 }) + "\n");
} finally {
  if (server) await new Promise(resolveClose => server.close(() => resolveClose()));
  await rm(temp, { recursive: true, force: true });
}

function json(response, value) { response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify(value)); }
function fail(message) { throw new Error(message); }
function run(file, args, cwd, env = process.env) { return runResult(file, args, cwd, env).then(result => { if (result.code !== 0) throw new Error(`${file} exited ${result.code}: ${result.stderr}`); return result; }); }
function runResult(file, args, cwd, env = process.env) {
  const isCmd = process.platform === "win32" && file.toLowerCase().endsWith(".cmd");
  const executable = isCmd ? (process.env.ComSpec ?? "cmd.exe") : file;
  const executableArgs = isCmd ? ["/d", "/s", "/c", [file, ...args].map(quoteCmd).join(" ")] : args;
  return new Promise((accept, reject) => execFile(executable, executableArgs, { cwd, env, windowsHide: true }, (error, stdout, stderr) => { if (error && typeof error.code !== "number") return reject(error); accept({ code: typeof error?.code === "number" ? error.code : 0, stdout, stderr }); }));
}
function quoteCmd(value) { return /[\s&|<>^()]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value; }
