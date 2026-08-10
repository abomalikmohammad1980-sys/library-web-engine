import { describe, expect, it } from "vitest";
import type { BookSourceRevision, SourceFingerprint } from "./contracts.js";
import { normalizeLogicalPath, normalizeSourceEvent } from "./events.js";
import { sha256Fingerprint } from "./fingerprint.js";
import { decideSourceRevision } from "./revision-decision.js";
import { StableCandidateDetector } from "./stability.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function fingerprint(hex = HASH_A, byteLength = 10): SourceFingerprint {
  return { algorithm: "sha256", hex, byteLength };
}

function revision(overrides: Partial<BookSourceRevision> = {}): BookSourceRevision {
  return {
    revisionId: "rev-1",
    bookId: "book-1",
    operationId: "op-1",
    baseRevisionId: null,
    fingerprint: fingerprint(),
    sourceName: "الكتاب.docx",
    createdAt: "2026-08-08T00:00:00.000Z",
    createdByDeviceId: "device-1",
    status: "published",
    ...overrides,
  };
}

describe("source fingerprint", () => {
  it("computes the standard SHA-256 digest over caller-provided bytes", async () => {
    const result = await sha256Fingerprint(new TextEncoder().encode("abc"));
    expect(result).toEqual({
      algorithm: "sha256",
      hex: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      byteLength: 3,
    });
  });

  it("respects a Uint8Array view instead of hashing its entire backing buffer", async () => {
    const backing = new TextEncoder().encode("xabcx");
    const result = await sha256Fingerprint(backing.subarray(1, 4));
    expect(result.hex).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(result.byteLength).toBe(3);
  });
});

describe("watch event normalization", () => {
  it("normalizes separators and Unicode while retaining root-relative identity", () => {
    expect(normalizeLogicalPath("كتب\\قسم\\الكتاب.docx")).toBe("كتب/قسم/الكتاب.docx");
  });

  it("rejects absolute and escaping paths", () => {
    expect(() => normalizeLogicalPath("C:\\books\\x.docx")).toThrow(/relative/);
    expect(() => normalizeLogicalPath("../x.docx")).toThrow(/escape/);
  });

  it("ignores Word lock files but preserves a temp-to-final atomic rename", () => {
    expect(normalizeSourceEvent({ kind: "modified", path: "~$book.docx", observedAtMs: 1 })).toBeNull();
    expect(normalizeSourceEvent({
      kind: "renamed",
      previousPath: "book.tmp",
      path: "book.docx",
      observedAtMs: 2,
    })).toEqual({
      kind: "move",
      previousLogicalPath: "book.tmp",
      logicalPath: "book.docx",
      observedAtMs: 2,
    });
  });

  it("normalizes explicit atomic replacement independently of OS APIs", () => {
    expect(normalizeSourceEvent({ kind: "replaced", path: "book.docx", observedAtMs: 9 })).toEqual({
      kind: "replace",
      logicalPath: "book.docx",
      observedAtMs: 9,
    });
  });
});

describe("stable source candidates", () => {
  it("waits for debounce and two stable, spaced size/mtime samples", () => {
    const detector = new StableCandidateDetector({ debounceMs: 100, stableIntervalMs: 50 });
    detector.ingest({ kind: "upsert", logicalPath: "book.docx", observedAtMs: 1 });
    const snapshot = { logicalPath: "book.docx", sizeBytes: 100, modifiedAtMs: 7 };
    expect(detector.observe(snapshot, 50).status).toBe("waiting-for-debounce");
    expect(detector.observe(snapshot, 101).status).toBe("sampled");
    const ready = detector.observe(snapshot, 151);
    expect(ready.status).toBe("stable");
    if (ready.status === "stable") {
      expect(ready.candidate.snapshot.sizeBytes).toBe(100);
      expect(ready.candidate.generation).toBe(1);
    }
  });

  it("resets stability when size changes and emits once per generation", () => {
    const detector = new StableCandidateDetector({ debounceMs: 0, stableIntervalMs: 10 });
    detector.ingest({ kind: "replace", logicalPath: "book.docx", observedAtMs: 0 });
    expect(detector.observe({ logicalPath: "book.docx", sizeBytes: 10, modifiedAtMs: 1 }, 0).status).toBe("sampled");
    expect(detector.observe({ logicalPath: "book.docx", sizeBytes: 20, modifiedAtMs: 2 }, 10).status).toBe("sampled");
    expect(detector.observe({ logicalPath: "book.docx", sizeBytes: 20, modifiedAtMs: 2 }, 20).status).toBe("stable");
    expect(detector.observe({ logicalPath: "book.docx", sizeBytes: 20, modifiedAtMs: 2 }, 30).status).toBe("sampled");
  });

  it("does not let frequent polling postpone the stable interval", () => {
    const detector = new StableCandidateDetector({ debounceMs: 0, stableIntervalMs: 10 });
    detector.ingest({ kind: "upsert", logicalPath: "book.docx", observedAtMs: 0 });
    const snapshot = { logicalPath: "book.docx", sizeBytes: 20, modifiedAtMs: 2 };
    expect(detector.observe(snapshot, 0).status).toBe("sampled");
    expect(detector.observe(snapshot, 5).status).toBe("sampled");
    expect(detector.observe(snapshot, 10).status).toBe("stable");
  });

  it("moves candidate identity and removes old paths", () => {
    const detector = new StableCandidateDetector({ debounceMs: 0, stableIntervalMs: 1 });
    detector.ingest({
      kind: "move",
      previousLogicalPath: "old.docx",
      logicalPath: "new.docx",
      observedAtMs: 0,
    });
    expect(detector.observe({ logicalPath: "old.docx", sizeBytes: 1, modifiedAtMs: 1 }, 0).status).toBe("unknown-path");
    expect(detector.hasPending("new.docx")).toBe(true);
  });

  it("is timer-free and accepts injected timestamps deterministically", () => {
    const detector = new StableCandidateDetector({ debounceMs: 1_000, stableIntervalMs: 500 });
    detector.ingest({ kind: "upsert", logicalPath: "book.docx", observedAtMs: 10_000 });
    expect(detector.observe({ logicalPath: "book.docx", sizeBytes: 1, modifiedAtMs: 1 }, 10_999).status)
      .toBe("waiting-for-debounce");
  });
});

describe("idempotent optimistic revision decisions", () => {
  const base = {
    bookId: "book-1",
    operationId: "op-2",
    baseRevisionId: "rev-1",
    activeRevisionId: "rev-1",
    fingerprint: fingerprint(HASH_B),
  };

  it("replays an already applied operation", () => {
    expect(decideSourceRevision({
      ...base,
      operationId: "op-1",
      existingByOperation: revision({baseRevisionId:"rev-1",fingerprint:fingerprint(HASH_B)}),
    })).toEqual({ kind: "replay-operation", revisionId: "rev-1" });
  });

  it("rejects replaying an operation id with different revision meaning",()=>{expect(()=>decideSourceRevision({...base,operationId:"op-1",existingByOperation:revision()})).toThrow(/base revision|Fingerprint/)});

  it("does not create a revision for the active fingerprint", () => {
    const current = revision({ fingerprint: fingerprint(HASH_B) });
    expect(decideSourceRevision({ ...base, existingByFingerprint: current }))
      .toEqual({ kind: "unchanged", revisionId: "rev-1" });
  });

  it("creates a new revision when base is current and content is new", () => {
    expect(decideSourceRevision(base)).toEqual({ kind: "create-revision" });
  });

  it("reuses immutable content from an older revision without duplicating bytes", () => {
    const older = revision({ revisionId: "rev-old", fingerprint: fingerprint(HASH_B) });
    expect(decideSourceRevision({ ...base, existingByFingerprint: older }))
      .toEqual({ kind: "reuse-content", revisionId: "rev-old" });
  });

  it("preserves a competing edit as a conflicted revision instead of overwriting", () => {
    expect(decideSourceRevision({ ...base, activeRevisionId: "rev-other" }))
      .toEqual({ kind: "create-conflicted-revision", activeRevisionId: "rev-other" });
  });

  it("rejects cross-book operation lookup results", () => {
    expect(() => decideSourceRevision({
      ...base,
      operationId: "op-1",
      existingByOperation: revision({ bookId: "another-book" }),
    })).toThrow(/another book/);
  });
});
