import { describe, expect, it } from "vitest";
import type { ManagedSourceMapping, ObservedManagedSource } from "./mapping.js";
import { reconcileManagedSources } from "./mapping.js";
import type { SourceSyncOperation } from "./outbox.js";
import {
  claimOutboxOperations,
  completeOutboxOperation,
  conflictOutboxOperation,
  decideOutboxEnqueue,
  deterministicRetryDelayMs,
  retryOutboxOperation,
} from "./outbox.js";
import { StableCandidateDetector } from "./stability.js";

function mapping(overrides: Partial<ManagedSourceMapping> = {}): ManagedSourceMapping {
  return {
    mappingId: "mapping-1",
    bookId: "book-1",
    logicalPath: "books/book.docx",
    fileIdentity: "file-1",
    lastPublishedRevisionId: "rev-1",
    lastFingerprint: { algorithm: "sha256", hex: "a".repeat(64), byteLength: 100 },
    lastObservedSnapshot: {
      logicalPath: "books/book.docx",
      sizeBytes: 100,
      modifiedAtMs: 10,
      fileIdentity: "file-1",
    },
    state: "linked",
    recordVersion: 2,
    ...overrides,
  };
}

function observed(
  logicalPath = "books/book.docx",
  overrides: Partial<ObservedManagedSource["snapshot"]> = {},
): ObservedManagedSource {
  return {
    logicalPath,
    snapshot: {
      logicalPath,
      sizeBytes: 100,
      modifiedAtMs: 10,
      fileIdentity: "file-1",
      ...overrides,
    },
  };
}

function operation(overrides: Partial<SourceSyncOperation> = {}): SourceSyncOperation {
  return {
    operationId: "op-1",
    kind: "source-revision.upload",
    bookId: "book-1",
    payloadDigest: "digest-1",
    payload: { revisionId: "local-rev-1" },
    state: "pending",
    attempt: 0,
    createdAtMs: 10,
    nextAttemptAtMs: 10,
    leaseId: null,
    leaseUntilMs: null,
    lastErrorCode: null,
    recordVersion: 0,
    ...overrides,
  };
}

describe("managed source reconciliation", () => {
  it("keeps an unchanged mapping byte-for-byte and emits no write-worthy change", () => {
    const original = mapping();
    const result = reconcileManagedSources([original], [observed()]);
    expect(result.actions).toEqual([{
      kind: "unchanged",
      mappingId: "mapping-1",
      logicalPath: "books/book.docx",
    }]);
    expect(result.nextMappings[0]).toEqual(original);
  });

  it("requests a content verification at startup even when cheap metadata is unchanged", () => {
    const original = mapping();
    const result = reconcileManagedSources([original], [observed()], { verifyUnchanged: true });
    expect(result.actions).toEqual([{
      kind: "schedule-stability",
      mappingId: "mapping-1",
      logicalPath: "books/book.docx",
      reason: "startup-verification",
    }]);
    expect(result.nextMappings[0]).toEqual(original);
  });

  it("tracks a rename by durable identity without inventing a new book", () => {
    const result = reconcileManagedSources([mapping()], [observed("books/renamed.docx", {
      logicalPath: "books/renamed.docx",
    })]);
    expect(result.actions).toEqual([
      {
        kind: "source-moved",
        mappingId: "mapping-1",
        fromLogicalPath: "books/book.docx",
        toLogicalPath: "books/renamed.docx",
      },
    ]);
    expect(result.nextMappings[0]?.bookId).toBe("book-1");
    expect(result.nextMappings[0]?.logicalPath).toBe("books/renamed.docx");
  });

  it("schedules stability when reconciliation recovers a changed snapshot", () => {
    const result = reconcileManagedSources([mapping({ state: "missing" })], [observed("books/book.docx", {
      sizeBytes: 120,
      modifiedAtMs: 20,
    })]);
    expect(result.actions).toContainEqual({
      kind: "schedule-stability",
      mappingId: "mapping-1",
      logicalPath: "books/book.docx",
      reason: "mapping-recovered",
    });
    expect(result.nextMappings[0]?.state).toBe("linked");
  });

  it("reports missing mappings and newly discovered files independently", () => {
    const result = reconcileManagedSources([mapping()], [observed("books/new.docx", {
      logicalPath: "books/new.docx",
      fileIdentity: "file-new",
    })]);
    expect(result.actions).toContainEqual({
      kind: "source-missing",
      mappingId: "mapping-1",
      logicalPath: "books/book.docx",
    });
    expect(result.actions).toContainEqual({ kind: "source-discovered", logicalPath: "books/new.docx" });
  });

  it("does not auto-resolve duplicate platform identities", () => {
    const result = reconcileManagedSources([], [
      observed("a.docx", { logicalPath: "a.docx", fileIdentity: "duplicate" }),
      observed("b.docx", { logicalPath: "b.docx", fileIdentity: "duplicate" }),
    ]);
    expect(result.actions[0]).toEqual({
      kind: "ambiguous-identity",
      fileIdentity: "duplicate",
      logicalPaths: ["a.docx", "b.docx"],
    });
  });
});

describe("durable outbox decisions", () => {
  it("enqueues a new operation and replays the same operation idempotently", () => {
    const candidate = operation();
    expect(decideOutboxEnqueue(candidate, undefined)).toEqual({ kind: "enqueue" });
    expect(decideOutboxEnqueue(candidate, candidate)).toEqual({ kind: "replay", operation: candidate });
  });

  it("rejects operationId reuse with a different payload", () => {
    expect(() => decideOutboxEnqueue(operation(), operation({ payloadDigest: "other" })))
      .toThrow(/cannot be reused/);
  });

  it("claims only due work, increments attempts, and supplies CAS versions", () => {
    const due = operation();
    const future = operation({ operationId: "op-2", nextAttemptAtMs: 500 });
    const batch = claimOutboxOperations([future, due], {
      nowMs: 100,
      leaseId: "worker-lease",
      leaseDurationMs: 1_000,
      limit: 10,
    });
    expect(batch.claimed).toHaveLength(1);
    expect(batch.claimed[0]).toMatchObject({
      operationId: "op-1",
      state: "in-flight",
      attempt: 1,
      leaseId: "worker-lease",
      recordVersion: 1,
    });
    expect(batch.unchanged).toEqual([future]);
  });

  it("reclaims an expired lease after an offline/crashed worker", () => {
    const expired = operation({
      state: "in-flight",
      attempt: 1,
      leaseId: "dead-worker",
      leaseUntilMs: 99,
      recordVersion: 1,
    });
    const batch = claimOutboxOperations([expired], {
      nowMs: 100,
      leaseId: "new-worker",
      leaseDurationMs: 1_000,
      limit: 1,
    });
    expect(batch.claimed[0]).toMatchObject({ attempt: 2, leaseId: "new-worker", recordVersion: 2 });
  });

  it("retries transient failures and later completes with the owning lease", () => {
    const claimed = claimOutboxOperations([operation()], {
      nowMs: 100,
      leaseId: "lease-1",
      leaseDurationMs: 1_000,
      limit: 1,
    }).claimed[0]!;
    const retried = retryOutboxOperation(claimed, "lease-1", 101, "offline", 500);
    expect(retried).toMatchObject({
      state: "retryable",
      nextAttemptAtMs: 601,
      leaseId: null,
      lastErrorCode: "offline",
      recordVersion: 2,
    });
    const reclaimed = claimOutboxOperations([retried], {
      nowMs: 601,
      leaseId: "lease-2",
      leaseDurationMs: 1_000,
      limit: 1,
    }).claimed[0]!;
    expect(completeOutboxOperation(reclaimed, "lease-2").state).toBe("succeeded");
  });

  it("records revision conflicts as terminal review state instead of retry overwrite", () => {
    const claimed = claimOutboxOperations([operation()], {
      nowMs: 100,
      leaseId: "lease-1",
      leaseDurationMs: 1_000,
      limit: 1,
    }).claimed[0]!;
    expect(conflictOutboxOperation(claimed, "lease-1")).toMatchObject({
      state: "conflicted",
      lastErrorCode: "source_revision_conflict",
      leaseId: null,
    });
  });

  it("rejects a completion from a stale or foreign lease", () => {
    const claimed = claimOutboxOperations([operation()], {
      nowMs: 100,
      leaseId: "lease-1",
      leaseDurationMs: 1_000,
      limit: 1,
    }).claimed[0]!;
    expect(() => completeOutboxOperation(claimed, "lease-other")).toThrow(/active lease/);
  });

  it("uses deterministic capped retry delays", () => {
    expect(deterministicRetryDelayMs(1, { baseMs: 100, maxMs: 1_000 })).toBe(100);
    expect(deterministicRetryDelayMs(4, { baseMs: 100, maxMs: 1_000 })).toBe(800);
    expect(deterministicRetryDelayMs(9, { baseMs: 100, maxMs: 1_000 })).toBe(1_000);
  });
});

describe("atomic replace flow", () => {
  it("invalidates a stable generation and emits a new candidate only after replacement stabilizes", () => {
    const detector = new StableCandidateDetector({ debounceMs: 0, stableIntervalMs: 10 });
    const oldSnapshot = { logicalPath: "book.docx", sizeBytes: 100, modifiedAtMs: 1 };
    detector.ingest({ kind: "upsert", logicalPath: "book.docx", observedAtMs: 0 });
    detector.observe(oldSnapshot, 0);
    const oldReady = detector.observe(oldSnapshot, 10);
    expect(oldReady.status).toBe("stable");

    detector.ingest({ kind: "replace", logicalPath: "book.docx", observedAtMs: 20 });
    const newSnapshot = { logicalPath: "book.docx", sizeBytes: 140, modifiedAtMs: 2 };
    expect(detector.observe(newSnapshot, 20).status).toBe("sampled");
    const newReady = detector.observe(newSnapshot, 30);
    expect(newReady.status).toBe("stable");
    if (oldReady.status === "stable" && newReady.status === "stable") {
      expect(newReady.candidate.generation).toBeGreaterThan(oldReady.candidate.generation);
      expect(newReady.candidate.snapshot.sizeBytes).toBe(140);
    }
  });
});
