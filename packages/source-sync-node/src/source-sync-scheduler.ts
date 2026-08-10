import type {
  ManagedSourceMapping,
  ManagedSourcePlatformAdapter,
  NormalizedSourceEvent,
  RawSourceWatchEvent,
  SourceSyncOperation,
  SourceSyncPersistence,
  StableCandidatePolicy,
} from "@library/source-sync";
import {
  decideOutboxEnqueue,
  decideSourceRevision,
  normalizeSourceEvent,
  prepareStableCandidateUpload,
  reconcileManagedSources,
  StableCandidateDetector,
} from "@library/source-sync";
import { inspectDocxContainer } from "./docx-safety.js";

export type SchedulerNotice =
  | { kind: "queued" | "replayed" | "unchanged"; mappingId: string; logicalPath: string }
  | { kind: "quarantined"; mappingId: string; logicalPath: string; reason: string }
  | { kind: "source-missing"; mappingId: string; logicalPath: string }
  | { kind: "source-moved"; mappingId: string; fromLogicalPath: string; toLogicalPath: string }
  | { kind: "ambiguous-identity"; fileIdentity: string; logicalPaths: string[] }
  | { kind: "unmapped"; logicalPath: string };

export interface SourceSyncSchedulerOptions {
  stability?: Partial<StableCandidatePolicy>;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  onNotice?: (notice: SchedulerNotice) => void;
  /** Bounds simultaneous guarded reads/hashes. Further events are coalesced by path. */
  maxConcurrentPaths?: number;
  /** Run a bounded hash scrub every N cheap reconciliations (never every poll by default). */
  contentScrubEveryReconciliations?: number;
  /** Maximum unchanged books selected per scrub pass; selection rotates fairly. */
  contentScrubBatchSize?: number;
}

type ProcessEvent = Extract<NormalizedSourceEvent, { kind: "upsert" | "replace" }> | {
  kind: "move"; logicalPath: string; observedAtMs: number;
};

/** Local orchestration only. Upload/revision creation remains an API concern. */
export class SourceSyncScheduler {
  readonly #adapter: ManagedSourcePlatformAdapter;
  readonly #persistence: SourceSyncPersistence;
  readonly #policy: StableCandidatePolicy;
  readonly #now: () => number;
  readonly #sleep: (milliseconds: number) => Promise<void>;
  readonly #onNotice: (notice: SchedulerNotice) => void;
  #close: (() => void) | null = null;
  readonly #maxConcurrentPaths: number;
  #pending = new Map<string, ProcessEvent>();
  #activePaths = new Set<string>();
  #runs = new Set<Promise<void>>();
  #coalescedEvents = 0;
  #peakActivePaths = 0;
  #peakPendingPaths = 0;
  #stopping = false;
  readonly #contentScrubEveryReconciliations: number;
  readonly #contentScrubBatchSize: number;
  #reconciliationPasses = 0;
  #lastScrubMappingId: string | null = null;
  #scrubSelections = 0;

  constructor(
    adapter: ManagedSourcePlatformAdapter,
    persistence: SourceSyncPersistence,
    options: SourceSyncSchedulerOptions = {},
  ) {
    this.#adapter = adapter;
    this.#persistence = persistence;
    const detector = new StableCandidateDetector(options.stability);
    this.#policy = detector.policy;
    this.#now = options.now ?? Date.now;
    this.#sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.#onNotice = options.onNotice ?? (() => undefined);
    this.#maxConcurrentPaths = options.maxConcurrentPaths ?? 4;
    if (!Number.isSafeInteger(this.#maxConcurrentPaths) || this.#maxConcurrentPaths < 1 || this.#maxConcurrentPaths > 64) {
      throw new Error("maxConcurrentPaths must be an integer from 1 to 64");
    }
    this.#contentScrubEveryReconciliations = options.contentScrubEveryReconciliations ?? 60;
    this.#contentScrubBatchSize = options.contentScrubBatchSize ?? 4;
    if (!Number.isSafeInteger(this.#contentScrubEveryReconciliations)
      || this.#contentScrubEveryReconciliations < 1 || this.#contentScrubEveryReconciliations > 1_000_000) {
      throw new Error("contentScrubEveryReconciliations must be an integer from 1 to 1000000");
    }
    if (!Number.isSafeInteger(this.#contentScrubBatchSize)
      || this.#contentScrubBatchSize < 1 || this.#contentScrubBatchSize > 1_000) {
      throw new Error("contentScrubBatchSize must be an integer from 1 to 1000");
    }
  }

  async start(): Promise<void> {
    if (this.#close !== null) return;
    this.#stopping = false;
    // Arm observation before reconciliation. Otherwise a save made between the
    // startup scan and watcher subscription can be invisible until a later
    // periodic scan (or forever for an event-only adapter).
    const close = this.#adapter.subscribe === undefined
      ? () => undefined
      : await this.#adapter.subscribe((event) => { void this.handleRawEvent(event); });
    // stop() may win while a native watcher is still opening.  Never publish a
    // late subscription after that boundary; close it immediately instead.
    if (this.#stopping) {
      close();
      return;
    }
    this.#close = close;
    // Reconciliation, rather than watcher history, is the source of truth on
    // restart. It recovers saves, atomic replacements, moves, and missed events.
    // A long observation gap can hide an in-place rewrite that preserved
    // size/mtime/file identity (clock skew or restored timestamps). Startup
    // therefore verifies content; periodic reconciliation keeps the cheap
    // metadata fast path.
    await this.reconcileNow({ verifyUnchanged: true });
  }

  async reconcileNow(options: { verifyUnchanged?: boolean } = {}): Promise<void> {
    const [mappings, observed] = await Promise.all([
      this.#persistence.transaction((tx) => tx.listMappings()),
      this.#adapter.enumerate(),
    ]);
    const verifyMappingIds = options.verifyUnchanged === true ? [] : this.#selectContentScrubMappings(mappings);
    const result = reconcileManagedSources(mappings, observed, {
      ...options,
      ...(verifyMappingIds.length === 0 ? {} : { verifyMappingIds }),
    });
    await this.#persistence.transaction(async (tx) => {
      for (const next of result.nextMappings) {
        const previous = mappings.find((mapping) => mapping.mappingId === next.mappingId);
        if (previous === undefined || previous.recordVersion === next.recordVersion) continue;
        if (!await tx.compareAndSwapMapping(previous.recordVersion, next)) {
          throw new Error(`mapping-cas-conflict:${next.mappingId}`);
        }
      }
    });
    const observedAtMs = this.#now();
    for (const action of result.actions) {
      if (action.kind === "schedule-stability") {
        this.#enqueue(action.logicalPath, "upsert", observedAtMs);
      } else if (action.kind === "source-missing") {
        this.#onNotice(action);
      } else if (action.kind === "source-moved") {
        this.#onNotice(action);
      } else if (action.kind === "source-discovered") {
        this.#onNotice({ kind: "unmapped", logicalPath: action.logicalPath });
      } else if (action.kind === "ambiguous-identity") {
        this.#onNotice(action);
      }
    }
  }

  stop(): void {
    this.#stopping = true;
    this.#close?.();
    this.#close = null;
    // Watch notifications are hints, not the durable source of truth. Dropping
    // the in-memory tail makes shutdown independent of burst size; startup
    // reconciliation deterministically recovers the newest on-disk snapshot.
    this.#pending.clear();
  }

  async idle(): Promise<void> {
    while (this.#pending.size > 0 || this.#runs.size > 0) {
      this.#pump();
      if (this.#runs.size > 0) await Promise.all([...this.#runs]);
    }
  }

  backpressureSnapshot() {
    return { pendingPaths: this.#pending.size, activePaths: this.#activePaths.size,
      coalescedEvents: this.#coalescedEvents, peakActivePaths: this.#peakActivePaths,
      peakPendingPaths: this.#peakPendingPaths, reconciliationPasses: this.#reconciliationPasses,
      scrubSelections: this.#scrubSelections };
  }

  #selectContentScrubMappings(mappings: readonly ManagedSourceMapping[]): string[] {
    this.#reconciliationPasses += 1;
    if (this.#reconciliationPasses % this.#contentScrubEveryReconciliations !== 0) return [];
    const ids = mappings.filter(mapping => mapping.state === "linked")
      .map(mapping => mapping.mappingId).sort();
    if (ids.length === 0) return [];
    let start = this.#lastScrubMappingId === null
      ? 0 : ids.findIndex(id => id > this.#lastScrubMappingId!);
    if (start < 0) start = 0;
    const selected = Array.from({ length: Math.min(this.#contentScrubBatchSize, ids.length) },
      (_, offset) => ids[(start + offset) % ids.length]!);
    this.#lastScrubMappingId = selected.at(-1)!;
    this.#scrubSelections += selected.length;
    return selected;
  }

  async handleRawEvent(raw: RawSourceWatchEvent): Promise<void> {
    const event = normalizeSourceEvent(raw);
    if (event === null) return;
    if (event.kind === "remove") {
      await this.#markSourceMissing(event.logicalPath);
      return;
    }
    if (event.kind === "move") await this.#moveMapping(event);
    this.#enqueue(event.logicalPath, event.kind, event.observedAtMs);
  }

  async syncPathNow(logicalPath: string, kind: "upsert" | "replace" = "upsert"): Promise<void> {
    await this.#process({ kind, logicalPath, observedAtMs: this.#now() });
  }

  #enqueue(logicalPath: string, kind: "upsert" | "replace" | "move", observedAtMs: number): void {
    if (this.#stopping) return;
    if (this.#pending.has(logicalPath)) this.#coalescedEvents += 1;
    this.#pending.set(logicalPath, { kind, logicalPath, observedAtMs });
    this.#peakPendingPaths = Math.max(this.#peakPendingPaths, this.#pending.size);
    this.#pump();
  }


  #pump(): void {
    if (this.#stopping) return;
    while (this.#activePaths.size < this.#maxConcurrentPaths) {
      const entry = [...this.#pending].find(([path]) => !this.#activePaths.has(path));
      if (entry === undefined) return;
      const [path, event] = entry;
      this.#pending.delete(path);
      this.#activePaths.add(path);
      this.#peakActivePaths = Math.max(this.#peakActivePaths, this.#activePaths.size);
      const run = this.#process(event).catch(() => undefined).finally(() => {
        this.#activePaths.delete(path); this.#runs.delete(run); this.#pump();
      });
      this.#runs.add(run);
    }
  }

  async #process(event: ProcessEvent): Promise<void> {
    const mapping = await this.#persistence.transaction((tx) => tx.getMappingByLogicalPath(event.logicalPath));
    if (mapping === null) {
      this.#onNotice({ kind: "unmapped", logicalPath: event.logicalPath });
      return;
    }
    const detector = new StableCandidateDetector(this.#policy);
    detector.ingest({ ...event, kind: event.kind === "move" ? "upsert" : event.kind });
    await this.#sleep(this.#policy.debounceMs);
    let candidate = null;
    for (let index = 0; index < this.#policy.requiredStableSamples; index += 1) {
      const snapshot = await this.#adapter.sample(event.logicalPath);
      if (snapshot === null) return this.#quarantine(mapping, "source-missing");
      const observation = detector.observe(snapshot, event.observedAtMs + this.#policy.debounceMs
        + index * this.#policy.stableIntervalMs);
      if (observation.status === "stable") candidate = observation.candidate;
      if (candidate === null && index + 1 < this.#policy.requiredStableSamples) {
        await this.#sleep(this.#policy.stableIntervalMs);
      }
    }
    if (candidate === null) return this.#quarantine(mapping, "source-did-not-stabilize");
    try {
      const prepared = await prepareStableCandidateUpload({
        candidate,
        mapping,
        reader: this.#adapter,
        // Preparation owns the guarded read and hash. The durable id is
        // replaced below with one derived from that hash; snapshot metadata
        // alone is not unique (an atomic replacement can preserve size/mtime).
        operationId: "pending-fingerprint",
        createdAtMs: this.#now(),
        inspectBytes: inspectDocxContainer,
      });
      if (prepared.kind === "stale") return this.#quarantine(mapping, prepared.reason);
      if (prepared.kind === "quarantined") return this.#quarantine(mapping, prepared.reason);
      if (prepared.kind === "unchanged") {
        await this.#persistMappingObservation(mapping, candidate.snapshot, false);
        this.#onNotice({ kind: "unchanged", mappingId: mapping.mappingId, logicalPath: mapping.logicalPath });
        return;
      }
      const operation = {
        ...prepared.operation,
        operationId: operationIdFor(mapping, prepared.operation.payload.fingerprint.hex),
      };
      // This local prediction exercises the revision contract while leaving
      // conflict authority to the server, which will compare its active head.
      decideSourceRevision({
        bookId: mapping.bookId,
        operationId: operation.operationId,
        baseRevisionId: mapping.lastPublishedRevisionId,
        activeRevisionId: mapping.lastPublishedRevisionId,
        fingerprint: operation.payload.fingerprint,
      });
      const result = await this.#persistQueue(mapping, candidate.snapshot, operation);
      this.#onNotice({ kind: result, mappingId: mapping.mappingId, logicalPath: mapping.logicalPath });
    } catch (error) {
      await this.#quarantine(mapping, error instanceof Error ? error.message : String(error));
    }
  }

  async #persistQueue(
    mapping: ManagedSourceMapping,
    snapshot: import("@library/source-sync").SourceFileSnapshot,
    operation: SourceSyncOperation,
  ): Promise<"queued" | "replayed"> {
    return this.#persistence.transaction(async (tx) => {
      const existing = await tx.getOutboxOperation(operation.operationId);
      const decision = decideOutboxEnqueue(operation, existing ?? undefined);
      if (decision.kind === "enqueue" && !await tx.compareAndSwapOutbox(null, operation)) {
        throw new Error("outbox-cas-conflict");
      }
      const current = await tx.getMapping(mapping.mappingId);
      if (current !== null) {
        if (!await tx.compareAndSwapMapping(current.recordVersion, {
          ...current,
          lastObservedSnapshot: snapshot,
          state: "linked",
          recordVersion: current.recordVersion + 1,
        })) throw new Error(`mapping-cas-conflict:${current.mappingId}`);
      }
      return decision.kind === "enqueue" ? "queued" : "replayed";
    });
  }

  async #persistMappingObservation(
    mapping: ManagedSourceMapping,
    snapshot: import("@library/source-sync").SourceFileSnapshot | null,
    needsReview: boolean,
  ): Promise<void> {
    await this.#persistence.transaction(async (tx) => {
      const current = await tx.getMapping(mapping.mappingId);
      if (current === null) return;
      if (!needsReview && current.state === "linked" && snapshot !== null
        && sameSourceSnapshot(current.lastObservedSnapshot, snapshot)) return;
      if (!await tx.compareAndSwapMapping(current.recordVersion, {
        ...current,
        ...(snapshot === null ? {} : { lastObservedSnapshot: snapshot }),
        state: needsReview ? "needs-review" : "linked",
        recordVersion: current.recordVersion + 1,
      })) throw new Error(`mapping-cas-conflict:${current.mappingId}`);
    });
  }

  async #quarantine(mapping: ManagedSourceMapping, reason: string): Promise<void> {
    const snapshot = await this.#adapter.sample(mapping.logicalPath).catch(() => null);
    await this.#persistMappingObservation(mapping, snapshot, true);
    this.#onNotice({ kind: "quarantined", mappingId: mapping.mappingId, logicalPath: mapping.logicalPath, reason });
  }

  async #moveMapping(event: Extract<NormalizedSourceEvent, { kind: "move" }>): Promise<void> {
    await this.#persistence.transaction(async (tx) => {
      const mapping = await tx.getMappingByLogicalPath(event.previousLogicalPath);
      if (mapping === null) return;
      if (!await tx.compareAndSwapMapping(mapping.recordVersion, {
        ...mapping,
        logicalPath: event.logicalPath,
        ...(event.fileIdentity === undefined ? {} : { fileIdentity: event.fileIdentity }),
        recordVersion: mapping.recordVersion + 1,
      })) throw new Error(`mapping-cas-conflict:${mapping.mappingId}`);
    });
  }

  async #markSourceMissing(logicalPath: string): Promise<void> {
    const notice = await this.#persistence.transaction(async (tx) => {
      const mapping = await tx.getMappingByLogicalPath(logicalPath);
      if (mapping === null) return null;
      if (mapping.state !== "missing" && !await tx.compareAndSwapMapping(mapping.recordVersion, {
        ...mapping,
        state: "missing",
        recordVersion: mapping.recordVersion + 1,
      })) throw new Error(`mapping-cas-conflict:${mapping.mappingId}`);
      return {
        kind: "source-missing" as const,
        mappingId: mapping.mappingId,
        logicalPath: mapping.logicalPath,
      };
    });
    if (notice !== null) this.#onNotice(notice);
  }
}

function sameSourceSnapshot(
  left: import("@library/source-sync").SourceFileSnapshot | null,
  right: import("@library/source-sync").SourceFileSnapshot,
): boolean {
  return left !== null && left.logicalPath === right.logicalPath
    && left.sizeBytes === right.sizeBytes && left.modifiedAtMs === right.modifiedAtMs
    && left.fileIdentity === right.fileIdentity;
}

function operationIdFor(
  mapping: ManagedSourceMapping,
  fingerprintHex: string,
): string {
  return ["source", mapping.mappingId, mapping.lastPublishedRevisionId ?? "none", fingerprintHex].join(":");
}
