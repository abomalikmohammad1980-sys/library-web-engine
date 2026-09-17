import type { SourceFileSnapshot, StableSourceCandidate } from "./contracts.js";
import type { NormalizedSourceEvent } from "./events.js";
import { normalizeLogicalPath } from "./events.js";

export interface StableCandidatePolicy {
  debounceMs: number;
  stableIntervalMs: number;
  requiredStableSamples: number;
}

export type StableObservation =
  | { status: "unknown-path" | "waiting-for-debounce" | "sampled" }
  | { status: "stable"; candidate: StableSourceCandidate };

interface CandidateState {
  logicalPath: string;
  generation: number;
  lastEventAtMs: number;
  lastSnapshot: SourceFileSnapshot | null;
  lastSampleAtMs: number | null;
  stableSamples: number;
  emitted: boolean;
}

const DEFAULT_POLICY: StableCandidatePolicy = {
  debounceMs: 500,
  stableIntervalMs: 250,
  requiredStableSamples: 2,
};

/**
 * Deterministic state machine only. It never starts a timer or reads a file;
 * adapters inject events, snapshots, and a monotonic timestamp.
 */
export class StableCandidateDetector {
  readonly policy: StableCandidatePolicy;
  #states = new Map<string, CandidateState>();
  #nextGeneration = 1;

  constructor(policy: Partial<StableCandidatePolicy> = {}) {
    this.policy = validatePolicy({ ...DEFAULT_POLICY, ...policy });
  }

  ingest(event: NormalizedSourceEvent): void {
    if (event.kind === "remove") {
      this.#states.delete(event.logicalPath);
      return;
    }
    if (event.kind === "move") {
      this.#states.delete(event.previousLogicalPath);
    }
    this.#states.set(event.logicalPath, {
      logicalPath: event.logicalPath,
      generation: this.#nextGeneration++,
      lastEventAtMs: event.observedAtMs,
      lastSnapshot: null,
      lastSampleAtMs: null,
      stableSamples: 0,
      emitted: false,
    });
  }

  observe(snapshot: SourceFileSnapshot, observedAtMs: number): StableObservation {
    assertSnapshot(snapshot);
    assertFiniteTime(observedAtMs);
    const logicalPath = normalizeLogicalPath(snapshot.logicalPath);
    const state = this.#states.get(logicalPath);
    if (!state) return { status: "unknown-path" };
    if (observedAtMs < state.lastEventAtMs + this.policy.debounceMs) {
      state.lastSnapshot = null;
      state.lastSampleAtMs = null;
      state.stableSamples = 0;
      return { status: "waiting-for-debounce" };
    }

    const normalizedSnapshot = cloneSnapshot(snapshot, logicalPath);
    const sameAsLast = state.lastSnapshot !== null
      && sameSnapshot(state.lastSnapshot, normalizedSnapshot);
    const enoughSpacing = state.lastSampleAtMs !== null
      && observedAtMs - state.lastSampleAtMs >= this.policy.stableIntervalMs;
    if (sameAsLast && enoughSpacing) {
      state.stableSamples += 1;
      state.lastSampleAtMs = observedAtMs;
    } else if (!sameAsLast) {
      state.stableSamples = 1;
      state.lastSampleAtMs = observedAtMs;
    }
    state.lastSnapshot = normalizedSnapshot;

    if (!state.emitted && state.stableSamples >= this.policy.requiredStableSamples) {
      state.emitted = true;
      return {
        status: "stable",
        candidate: {
          logicalPath,
          generation: state.generation,
          snapshot: normalizedSnapshot,
        },
      };
    }
    return { status: "sampled" };
  }

  hasPending(logicalPath: string): boolean {
    const state = this.#states.get(normalizeLogicalPath(logicalPath));
    return state !== undefined && !state.emitted;
  }
}

function sameSnapshot(a: SourceFileSnapshot, b: SourceFileSnapshot): boolean {
  return a.sizeBytes === b.sizeBytes
    && a.modifiedAtMs === b.modifiedAtMs
    && a.fileIdentity === b.fileIdentity;
}

function cloneSnapshot(snapshot: SourceFileSnapshot, logicalPath: string): SourceFileSnapshot {
  const base = {
    logicalPath,
    sizeBytes: snapshot.sizeBytes,
    modifiedAtMs: snapshot.modifiedAtMs,
  };
  return snapshot.fileIdentity === undefined
    ? base
    : { ...base, fileIdentity: snapshot.fileIdentity };
}

function validatePolicy(policy: StableCandidatePolicy): StableCandidatePolicy {
  if (!Number.isFinite(policy.debounceMs) || policy.debounceMs < 0) {
    throw new Error("debounceMs must be non-negative");
  }
  if (!Number.isFinite(policy.stableIntervalMs) || policy.stableIntervalMs < 0) {
    throw new Error("stableIntervalMs must be non-negative");
  }
  if (!Number.isInteger(policy.requiredStableSamples) || policy.requiredStableSamples < 2) {
    throw new Error("requiredStableSamples must be an integer of at least 2");
  }
  return policy;
}

function assertSnapshot(snapshot: SourceFileSnapshot): void {
  if (!Number.isSafeInteger(snapshot.sizeBytes) || snapshot.sizeBytes < 0) {
    throw new Error("sizeBytes must be a non-negative safe integer");
  }
  assertFiniteTime(snapshot.modifiedAtMs);
}

function assertFiniteTime(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("timestamp must be a non-negative finite number");
  }
}
