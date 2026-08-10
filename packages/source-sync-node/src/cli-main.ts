#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { createNodeSourceSyncRuntime, validateNodeRuntimeConfig, type NodeRuntimeConfig } from "./node-runtime-factory.js";
import { runSourceSyncCli, type SourceSyncCliCommand, type SourceSyncCliConfig } from "./source-sync-cli.js";
import { createServiceInstallPlan,type ServiceDescriptorOptions,type ServicePlatform } from "./service-descriptors.js";import { applyServicePlan } from "./service-install-engine.js";import { NodeSafeServiceFilePort } from "./node-service-file-port.js";
import { runUserCommand,type UserCommand } from "./user-commands.js";
import { QuarantineAdminClient } from "./quarantine-client.js";

interface ExecutableConfig extends NodeRuntimeConfig { lockFile: string; healthFile: string; service?:ServiceDescriptorOptions&{descriptorPath:string;platform:ServicePlatform} }
type ExecutableCommand = SourceSyncCliCommand | UserCommand | "quarantine-list"|"quarantine-resolve" | "remote-check" | "provision-check"|"service-render"|"service-install"|"service-uninstall";
const commands = new Set<ExecutableCommand>(["run", "once", "health", "config-check", "remote-check", "provision-check","service-render","service-install","service-uninstall","revisions","devices","usage","rollback","device-revoke","quarantine-list","quarantine-resolve"]);

export async function loadExecutableConfig(path: string): Promise<ExecutableConfig> {
  const config = JSON.parse(await readFile(resolve(path), "utf8")) as ExecutableConfig;
  validateNodeRuntimeConfig(config);
  if (!config.lockFile?.trim() || !config.healthFile?.trim()) throw Error("lockFile and healthFile are required");
  return { ...config, managedDir: resolve(config.managedDir), stateFile: resolve(config.stateFile), lockFile: resolve(config.lockFile), healthFile: resolve(config.healthFile) };
}
export async function main(args = process.argv.slice(2), env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const command = args[0] as ExecutableCommand;
  if (!commands.has(command)) { process.stderr.write(JSON.stringify({ level: "error", event: "usage", commands: [...commands] }) + "\n"); return 2; }
  const flag = args.indexOf("--config"), configPath = flag >= 0 ? args[flag + 1] : env.KHIZANA_SOURCE_SYNC_CONFIG;
  if (!configPath) { process.stderr.write(JSON.stringify({ level: "error", event: "config-required" }) + "\n"); return 2; }
  try {
    const runtime = await loadExecutableConfig(configPath);
    if(["revisions","devices","usage","rollback","device-revoke"].includes(command))return runUserCommand(command as UserCommand,runtime,args);
    if(command==="quarantine-list"||command==="quarantine-resolve")return quarantineCommand(command,runtime,args);
    if(command.startsWith("service-"))return serviceCommand(command,runtime,args.includes("--confirm"));
    if (command === "remote-check" || command === "provision-check") return await checkRemote(runtime, command === "remote-check");
    const cli: SourceSyncCliConfig = { managedRoot: runtime.managedDir, stateFile: runtime.stateFile, lockFile: runtime.lockFile, healthFile: runtime.healthFile, reconcileIntervalMs: runtime.reconcileIntervalMs, outboxIntervalMs: runtime.outboxIntervalMs, buildIntervalMs: runtime.buildIntervalMs, ...(runtime.shutdownTimeoutMs === undefined ? {} : { shutdownTimeoutMs: runtime.shutdownTimeoutMs }) };
    return await runSourceSyncCli(command as SourceSyncCliCommand, cli, { createDaemon: (_c, emit) => createNodeSourceSyncRuntime(runtime, { emit }) });
  } catch (error) {
    process.stderr.write(JSON.stringify({ level: "error", event: "configuration-error", code: "invalid_configuration" }) + "\n");
    return 2;
  }
}
async function quarantineCommand(command:"quarantine-list"|"quarantine-resolve",c:ExecutableConfig,args:string[]){
  const client=new QuarantineAdminClient(c.buildApiBase,()=>token(c.serviceTokenSource));
  if(command==="quarantine-list"){
    const limit=Number(value(args,"--limit")??50);
    const records=await client.list(limit);
    process.stdout.write(JSON.stringify(records,null,args.includes("--json")?0:2)+"\n");
    return 0;
  }
  const input={quarantineId:requiredArg(args,"--id"),leaseId:requiredArg(args,"--lease"),resolutionId:requiredArg(args,"--operation"),decision:requiredArg(args,"--decision") as "allow"|"reject",reason:requiredArg(args,"--reason"),expectedRecordVersion:Number(requiredArg(args,"--expected-version"))};
  if(!["allow","reject"].includes(input.decision)||!Number.isSafeInteger(input.expectedRecordVersion))throw Error("invalid quarantine resolution arguments");
  if(!args.includes("--confirm")){process.stdout.write(JSON.stringify({level:"info",event:"quarantine-resolve-dry-run",quarantineId:input.quarantineId,decision:input.decision})+"\n");return 0}
  const leased=await client.lease(input.quarantineId,{leaseId:input.leaseId,leaseMs:Number(value(args,"--lease-ms")??30_000),expectedRecordVersion:input.expectedRecordVersion});
  const result=await client.resolve({...input,expectedRecordVersion:leased.recordVersion});
  process.stdout.write(JSON.stringify(result)+"\n");return 0;
}
function value(args:string[],flag:string){const i=args.indexOf(flag);return i<0?undefined:args[i+1]}
function requiredArg(args:string[],flag:string){const x=value(args,flag)?.trim();if(!x)throw Error(`${flag} is required`);return x}
async function serviceCommand(command:ExecutableCommand,c:ExecutableConfig,confirm:boolean){if(!c.service)throw Error("service configuration is required");const {descriptorPath,platform,...options}=c.service,op=command==="service-uninstall"?"uninstall":"install",plan=createServiceInstallPlan(platform,op,options);if(command==="service-render"){process.stdout.write((plan.descriptor??"")+"\n");return 0}const commandPort={run:(file:string,args:readonly string[])=>new Promise<void>((ok,fail)=>execFile(file,[...args],e=>e?fail(e):ok()))};await applyServicePlan({plan,descriptorPath,confirm,dryRun:!confirm,actualPlatform:process.platform},new NodeSafeServiceFilePort(),commandPort);process.stdout.write(JSON.stringify({level:"info",event:confirm?`service-${op}ed`:`service-${op}-dry-run`})+"\n");return 0}
async function token(source: ExecutableConfig["serviceTokenSource"]) { if (source.kind === "env") return (process.env[source.name] ?? "").trim(); if (source.kind === "file") return (await readFile(source.path, "utf8")).trim(); throw Error("callback token source is unavailable from executable CLI"); }
async function checkRemote(config: ExecutableConfig, includePdf: boolean) {
  try {
    const signal=AbortSignal.timeout(config.requestTimeoutMs);
    const ready = await fetch(new URL("ready", config.apiBase),{signal}); if (!ready.ok) return 5;
    const readiness = await ready.json().catch(() => null) as { ready?: unknown; bindings?: unknown; missingTables?: unknown } | null;
    if (readiness?.ready !== true
      || !Array.isArray(readiness.bindings) || readiness.bindings.length !== 0
      || !Array.isArray(readiness.missingTables) || readiness.missingTables.length !== 0) return 5;
    const serviceToken = await token(config.serviceTokenSource); if (!serviceToken) return 5;
    const build = await fetch(new URL("check", config.buildApiBase), { signal,headers: { authorization: `Bearer ${serviceToken}`, "x-service-scopes": "build:claim build:write revision:read artifact:write publish:write" } }); if (!build.ok) return 5;
    if (includePdf) { const pdf = await fetch(config.pdfEndpoint, { method: "OPTIONS",signal }); if (!pdf.ok&&pdf.status!==405) return 5; const wordMap=await fetch(config.wordPageMapEndpoint,{method:"HEAD",signal,headers:{authorization:`Bearer ${serviceToken}`}});if(wordMap.status!==204)return 5; }
    process.stdout.write(JSON.stringify({ level: "info", event: includePdf ? "remote-ready" : "provision-ready" }) + "\n"); return 0;
  }catch{return 5}
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().then(code => { process.exitCode = code; });
