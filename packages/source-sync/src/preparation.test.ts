import { describe, expect, it } from "vitest";
import type { SourceFileSnapshot, StableSourceCandidate } from "./contracts.js";
import type { ManagedSourceMapping } from "./mapping.js";
import { prepareStableCandidateUpload, type StableSourceReader } from "./preparation.js";

const bytes = new TextEncoder().encode("source bytes");
const knownHash = "4d4823794cbed3c4ee0bbc684c8f66e1dfd5afa6f078d494ce254ec5a4671753";

function snapshot(overrides: Partial<SourceFileSnapshot> = {}): SourceFileSnapshot {
  return {
    logicalPath: "books/book.docx",
    sizeBytes: bytes.byteLength,
    modifiedAtMs: 10,
    fileIdentity: "file-1",
    ...overrides,
  };
}

function candidate(overrides: Partial<StableSourceCandidate> = {}): StableSourceCandidate {
  return {
    logicalPath: "books/book.docx",
    generation: 2,
    snapshot: snapshot(),
    ...overrides,
  };
}

function mapping(overrides: Partial<ManagedSourceMapping> = {}): ManagedSourceMapping {
  return {
    mappingId: "mapping-1",
    bookId: "book-1",
    logicalPath: "books/book.docx",
    fileIdentity: "file-1",
    lastPublishedRevisionId: "revision-1",
    lastFingerprint: null,
    lastObservedSnapshot: snapshot(),
    state: "linked",
    recordVersion: 1,
    ...overrides,
  };
}

function reader(samples: Array<SourceFileSnapshot | null>, content = bytes): StableSourceReader {
  let index = 0;
  return {
    async sample() {
      return samples[Math.min(index++, samples.length - 1)] ?? null;
    },
    async readBytes() {
      return content;
    },
  };
}

describe("stable candidate upload preparation", () => {
  it("queues one deterministic, offline-ready outbox operation after guarded hashing", async () => {
    const result = await prepareStableCandidateUpload({
      candidate: candidate(),
      mapping: mapping(),
      reader: reader([snapshot(), snapshot()]),
      operationId: "operation-1",
      createdAtMs: 100,
    });
    expect(result.kind).toBe("queue");
    if (result.kind === "queue") {
      expect(result.operation).toMatchObject({
        operationId: "operation-1",
        bookId: "book-1",
        state: "pending",
        nextAttemptAtMs: 100,
        payload: {
          mappingId: "mapping-1",
          generation: 2,
          baseRevisionId: "revision-1",
          fingerprint: { algorithm: "sha256", hex: knownHash, byteLength: bytes.byteLength },
        },
      });
    }
  });

  it("does not enqueue content already published by fingerprint", async () => {
    const result = await prepareStableCandidateUpload({
      candidate: candidate(),
      mapping: mapping({
        lastFingerprint: { algorithm: "sha256", hex: knownHash, byteLength: bytes.byteLength },
      }),
      reader: reader([snapshot(), snapshot()]),
      operationId: "operation-1",
      createdAtMs: 100,
    });
    expect(result).toEqual({ kind: "unchanged", fingerprintHex: knownHash });
  });

  it("rejects an atomic replacement that lands during the byte read", async () => {
    const replacement = snapshot({ sizeBytes: bytes.byteLength + 1, modifiedAtMs: 11, fileIdentity: "file-2" });
    const result = await prepareStableCandidateUpload({
      candidate: candidate(),
      mapping: mapping(),
      reader: reader([snapshot(), replacement]),
      operationId: "operation-1",
      createdAtMs: 100,
    });
    expect(result).toEqual({ kind: "stale", reason: "snapshot-changed-during-read" });
  });

  it("rejects byte length inconsistent with the stable snapshot", async () => {
    const result = await prepareStableCandidateUpload({
      candidate: candidate(),
      mapping: mapping(),
      reader: reader([snapshot(), snapshot()], bytes.subarray(0, 2)),
      operationId: "operation-1",
      createdAtMs: 100,
    });
    expect(result).toEqual({ kind: "stale", reason: "byte-length-mismatch" });
  });

  it("does not read bytes when the pre-read snapshot has already changed", async () => {
    let reads = 0;
    const changed = snapshot({ modifiedAtMs: 12 });
    const sourceReader: StableSourceReader = {
      async sample() { return changed; },
      async readBytes() { reads += 1; return bytes; },
    };
    const result = await prepareStableCandidateUpload({
      candidate: candidate(),
      mapping: mapping(),
      reader: sourceReader,
      operationId: "operation-1",
      createdAtMs: 100,
    });
    expect(result).toEqual({ kind: "stale", reason: "snapshot-changed-before-read" });
    expect(reads).toBe(0);
  });
});
