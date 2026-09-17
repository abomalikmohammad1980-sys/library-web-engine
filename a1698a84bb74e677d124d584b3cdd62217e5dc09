import { readFile } from "node:fs/promises";
import type { BuildJobStore } from "../../source-sync-server/src/index.js";
import { DurableBuildWorker } from "../../source-sync-server/src/index.js";
import { NodeManagedSourceAdapter } from "./node-managed-source-adapter.js";
import { JsonSourceSyncPersistence } from "./json-source-sync-persistence.js";
import { SourceSyncScheduler } from "./source-sync-scheduler.js";
import { HttpSourceRevisionApi } from "./source-sync-api-client.js";
import { SourceSyncOutboxWorker } from "./source-sync-outbox-worker.js";
import { createNodeDocumentBuilders, requireCompleteArtifactBuilders, type DerivedArtifactSink, type ImmutableRevisionSource } from "./node-derived-builders.js";
import { createPdfServiceBuilder } from "./pdf-service-builder.js";
import { SourceSyncDaemon, type DaemonEvent } from "./source-sync-daemon.js";
import { redactSchedulerNotice } from "./log-redaction.js";
import { RemoteBuildPorts } from "./remote-build-ports.js";
import { WordPageMapClient } from "./word-page-map-client.js";

export type TokenSource = { kind: "env"; name: string } | { kind: "file"; path: string } | { kind: "callback" };
export interface NodeRuntimeConfig {
  managedDir: string; stateFile: string; apiBase: string; buildApiBase: string; pdfEndpoint: string; wordPageMapEndpoint: string;
  deviceId: string; engineVersion: string; tokenSource: TokenSource; serviceTokenSource: TokenSource;
  reconcileIntervalMs: number; outboxIntervalMs: number; buildIntervalMs: number;
  maxSourceBytes: number; maxPdfBytes: number; maxWordPageMapBytes: number; requestTimeoutMs: number; shutdownTimeoutMs?: number;
  /** Guarded DOCX reads/hashes active at once. Pending watcher events still coalesce per path. */
  maxConcurrentPaths?: number;
  /** Durable queue work claimed per pass. These limits bound memory and remote pressure, not durability. */
  outboxBatchSize?: number; buildBatchSize?: number;
  /** Periodic bounded content verification catches rewrites preserving all cheap metadata. */
  contentScrubEveryReconciliations?: number; contentScrubBatchSize?: number;
}
export interface NodeRuntimeRemotePorts {
  buildJobs?: BuildJobStore; revisionSource?: ImmutableRevisionSource; artifactSink?: DerivedArtifactSink;
  tokenCallback?: () => Promise<string>; serviceTokenCallback?: () => Promise<string>;
  fetchImpl?: typeof fetch; emit?: (event: DaemonEvent) => void;
}
export interface NodeRuntimeBackpressureLimits {
  maxConcurrentPaths: number;
  outboxBatchSize: number;
  buildBatchSize: number;
  shutdownTimeoutMs: number;
  contentScrubEveryReconciliations: number;
  contentScrubBatchSize: number;
}

/**
 * Resolve the finite runtime limits once, at the composition boundary.  Keeping
 * this decision explicit prevents CLI/service starts from silently diverging
 * from the values validated below.
 */
export function resolveNodeRuntimeBackpressure(config: NodeRuntimeConfig): NodeRuntimeBackpressureLimits {
  validateNodeRuntimeConfig(config);
  return {
    maxConcurrentPaths: config.maxConcurrentPaths ?? 4,
    outboxBatchSize: config.outboxBatchSize ?? 5,
    buildBatchSize: config.buildBatchSize ?? 5,
    shutdownTimeoutMs: config.shutdownTimeoutMs ?? 10_000,
    contentScrubEveryReconciliations: config.contentScrubEveryReconciliations ?? 60,
    contentScrubBatchSize: config.contentScrubBatchSize ?? 4,
  };
}
function validateTokenSource(source: TokenSource, label: string) {
  if (source.kind === "env" && !source.name.trim()) throw Error(`${label} env name required`);
  if (source.kind === "file" && !source.path.trim()) throw Error(`${label} file path required`);
}
export function validateNodeRuntimeConfig(c: NodeRuntimeConfig) {
  for (const [k, v] of Object.entries({ managedDir: c.managedDir, stateFile: c.stateFile, apiBase: c.apiBase, buildApiBase: c.buildApiBase, pdfEndpoint: c.pdfEndpoint, wordPageMapEndpoint:c.wordPageMapEndpoint, deviceId: c.deviceId, engineVersion: c.engineVersion }))
    if (typeof v !== "string" || !v.trim()) throw Error(`${k} is required`);
  new URL(c.apiBase); new URL(c.buildApiBase); new URL(c.pdfEndpoint); new URL(c.wordPageMapEndpoint);
  if(!Number.isSafeInteger(c.maxWordPageMapBytes)||c.maxWordPageMapBytes<1)throw Error("maxWordPageMapBytes must be a positive integer");
  validateTokenSource(c.tokenSource, "token"); validateTokenSource(c.serviceTokenSource, "service token");
  if (c.shutdownTimeoutMs !== undefined
    && (!Number.isSafeInteger(c.shutdownTimeoutMs) || c.shutdownTimeoutMs < 1 || c.shutdownTimeoutMs > 120_000)) {
    throw Error("shutdownTimeoutMs must be an integer from 1 to 120000ms");
  }
  validateOptionalInteger(c.maxConcurrentPaths, "maxConcurrentPaths", 1, 64);
  validateOptionalInteger(c.outboxBatchSize, "outboxBatchSize", 1, 1_000);
  validateOptionalInteger(c.buildBatchSize, "buildBatchSize", 1, 1_000);
  validateOptionalInteger(c.contentScrubEveryReconciliations, "contentScrubEveryReconciliations", 1, 1_000_000);
  validateOptionalInteger(c.contentScrubBatchSize, "contentScrubBatchSize", 1, 1_000);
  return c;
}
function validateOptionalInteger(value: number | undefined, name: string, minimum: number, maximum: number) {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < minimum || value > maximum)) {
    throw Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
}
async function resolveToken(source: TokenSource, callback: (() => Promise<string>) | undefined, label: string) {
  let value = "";
  if (source.kind === "env") value = process.env[source.name] ?? "";
  else if (source.kind === "file") value = await readFile(source.path, "utf8");
  else value = await callback?.() ?? "";
  value = value.trim(); if (!value) throw Error(`${label} unavailable`); return value;
}
export async function createNodeSourceSyncRuntime(config: NodeRuntimeConfig, ports: NodeRuntimeRemotePorts = {}) {
  validateNodeRuntimeConfig(config);
  const limits = resolveNodeRuntimeBackpressure(config);
  const supplied = [ports.buildJobs, ports.revisionSource, ports.artifactSink].filter(Boolean).length;
  if (supplied !== 0 && supplied !== 3) throw Error("buildJobs, revisionSource, and artifactSink must be supplied together");
  const accessToken = () => resolveToken(config.tokenSource, ports.tokenCallback, "Access token");
  const serviceToken = () => resolveToken(config.serviceTokenSource, ports.serviceTokenCallback, "Service token");
  const remote = supplied === 3 ? null : new RemoteBuildPorts(config.buildApiBase, serviceToken, ports.fetchImpl, config.requestTimeoutMs);
  const buildJobs = ports.buildJobs ?? remote!;
  const revisionSource = ports.revisionSource ?? remote!;
  const artifactSink = ports.artifactSink ?? remote!;
  const wordMap = new WordPageMapClient({endpoint:config.wordPageMapEndpoint,serviceToken,timeoutMs:config.requestTimeoutMs,maxResponseBytes:config.maxWordPageMapBytes,...(ports.fetchImpl?{fetchImpl:ports.fetchImpl}:{})});
  const adapter = new NodeManagedSourceAdapter(config.managedDir);
  const persistence = new JsonSourceSyncPersistence(config.stateFile);
  const scheduler = new SourceSyncScheduler(adapter, persistence, {
    onNotice: n => ports.emit?.({ kind: "scheduler", atMs: Date.now(), detail: redactSchedulerNotice(n) }),
    maxConcurrentPaths: limits.maxConcurrentPaths,
    contentScrubEveryReconciliations: limits.contentScrubEveryReconciliations,
    contentScrubBatchSize: limits.contentScrubBatchSize,
  });
  const api = new HttpSourceRevisionApi(config.apiBase, accessToken, ports.fetchImpl, config.requestTimeoutMs);
  const outbox = new SourceSyncOutboxWorker(persistence, adapter, api, { leaseDurationMs: 30_000, batchSize: limits.outboxBatchSize, retryBaseMs: 1_000, retryMaxMs: 300_000, deviceId: config.deviceId });
  const builders = requireCompleteArtifactBuilders({
    ...createNodeDocumentBuilders(revisionSource, artifactSink, config.engineVersion,wordMap),
    pdf: createPdfServiceBuilder(revisionSource, artifactSink, { endpoint: config.pdfEndpoint, accessToken, ...(ports.fetchImpl ? { fetchImpl: ports.fetchImpl } : {}), timeoutMs: config.requestTimeoutMs, maxSourceBytes: config.maxSourceBytes, maxPdfBytes: config.maxPdfBytes, engineVersion: config.engineVersion })
  });
  const build = new DurableBuildWorker(buildJobs, builders, { leaseMs: 30_000, limit: limits.buildBatchSize, baseRetryMs: 1_000, maxRetryMs: 300_000 });
  return new SourceSyncDaemon({ managedRoot: config.managedDir, stateFile: config.stateFile, reconcileIntervalMs: config.reconcileIntervalMs, outboxIntervalMs: config.outboxIntervalMs, buildIntervalMs: config.buildIntervalMs, shutdownTimeoutMs: limits.shutdownTimeoutMs }, outbox, { runOnce: () => build.runOnce(Date.now(), crypto.randomUUID()) }, ports.emit, scheduler);
}
