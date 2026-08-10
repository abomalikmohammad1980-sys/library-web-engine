import type { SourceFileSnapshot, StableSourceCandidate } from "./contracts.js";
import type { ManagedSourceMapping } from "./mapping.js";
import type { SourceSyncOperation } from "./outbox.js";
import { sha256Fingerprint } from "./fingerprint.js";

export interface StableSourceReader {
  sample(logicalPath: string): Promise<SourceFileSnapshot | null>;
  readBytes(logicalPath: string): Promise<Uint8Array>;
}

export interface SourceRevisionUploadPayload {
  mappingId: string;
  bookId: string;
  logicalPath: string;
  generation: number;
  baseRevisionId: string | null;
  fingerprint: {
    algorithm: "sha256";
    hex: string;
    byteLength: number;
  };
}

export type StableCandidatePreparation =
  | { kind: "queue"; operation: SourceSyncOperation<SourceRevisionUploadPayload> }
  | { kind: "unchanged"; fingerprintHex: string }
  | { kind: "quarantined"; reason: string }
  | {
      kind: "stale";
      reason: "source-missing" | "snapshot-changed-before-read" | "snapshot-changed-during-read" | "byte-length-mismatch";
    };

/**
 * Reads a candidate through a platform adapter while guarding both sides of the
 * byte read. A replacement/save during hashing is reported as stale and must be
 * observed again; half-written bytes never enter the outbox.
 */
export async function prepareStableCandidateUpload(input: {
  candidate: StableSourceCandidate;
  mapping: ManagedSourceMapping;
  reader: StableSourceReader;
  operationId: string;
  createdAtMs: number;
  inspectBytes?: (bytes: Uint8Array) => { kind: "accepted" } | { kind: "quarantined"; reason: string };
}): Promise<StableCandidatePreparation> {
  if (input.mapping.logicalPath !== input.candidate.logicalPath) {
    return { kind: "stale", reason: "snapshot-changed-before-read" };
  }
  const before = await input.reader.sample(input.candidate.logicalPath);
  if (before === null) return { kind: "stale", reason: "source-missing" };
  if (!sameSnapshot(before, input.candidate.snapshot)) {
    return { kind: "stale", reason: "snapshot-changed-before-read" };
  }

  const bytes = await input.reader.readBytes(input.candidate.logicalPath);
  const after = await input.reader.sample(input.candidate.logicalPath);
  if (after === null) return { kind: "stale", reason: "source-missing" };
  if (!sameSnapshot(before, after)) {
    return { kind: "stale", reason: "snapshot-changed-during-read" };
  }
  if (bytes.byteLength !== after.sizeBytes) {
    return { kind: "stale", reason: "byte-length-mismatch" };
  }
  const inspection = input.inspectBytes?.(bytes);
  if (inspection?.kind === "quarantined") return inspection;

  const fingerprint = await sha256Fingerprint(bytes);
  if (input.mapping.lastFingerprint?.hex === fingerprint.hex
    && input.mapping.lastFingerprint.byteLength === fingerprint.byteLength) {
    return { kind: "unchanged", fingerprintHex: fingerprint.hex };
  }
  const payload: SourceRevisionUploadPayload = {
    mappingId: input.mapping.mappingId,
    bookId: input.mapping.bookId,
    logicalPath: input.candidate.logicalPath,
    generation: input.candidate.generation,
    baseRevisionId: input.mapping.lastPublishedRevisionId,
    fingerprint,
  };
  return {
    kind: "queue",
    operation: {
      operationId: requireNonEmpty(input.operationId, "operationId"),
      kind: "source-revision.upload",
      bookId: input.mapping.bookId,
      payloadDigest: [
        input.mapping.bookId,
        input.mapping.lastPublishedRevisionId ?? "none",
        fingerprint.hex,
        String(fingerprint.byteLength),
      ].join(":"),
      payload,
      state: "pending",
      attempt: 0,
      createdAtMs: input.createdAtMs,
      nextAttemptAtMs: input.createdAtMs,
      leaseId: null,
      leaseUntilMs: null,
      lastErrorCode: null,
      recordVersion: 0,
    },
  };
}

function sameSnapshot(a: SourceFileSnapshot, b: SourceFileSnapshot): boolean {
  return a.logicalPath === b.logicalPath
    && a.sizeBytes === b.sizeBytes
    && a.modifiedAtMs === b.modifiedAtMs
    && a.fileIdentity === b.fileIdentity;
}

function requireNonEmpty(value: string, name: string): string {
  if (value.trim() === "") throw new Error(`${name} cannot be empty`);
  return value;
}
