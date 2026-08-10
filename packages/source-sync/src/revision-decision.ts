import type { BookSourceRevision, SourceFingerprint } from "./contracts.js";
import { normalizeSha256Hex } from "./fingerprint.js";

export interface RevisionDecisionInput {
  bookId: string;
  operationId: string;
  baseRevisionId: string | null;
  activeRevisionId: string | null;
  fingerprint: SourceFingerprint;
  existingByOperation?: BookSourceRevision;
  existingByFingerprint?: BookSourceRevision;
}

export type RevisionDecision =
  | { kind: "replay-operation"; revisionId: string }
  | { kind: "unchanged"; revisionId: string }
  | { kind: "reuse-content"; revisionId: string }
  | { kind: "create-revision" }
  | { kind: "create-conflicted-revision"; activeRevisionId: string };

/**
 * Pure decision only. The caller performs indexed lookups and the eventual
 * transaction; this function never persists or invents backend state.
 */
export function decideSourceRevision(input: RevisionDecisionInput): RevisionDecision {
  assertIdentifier(input.bookId, "bookId");
  assertIdentifier(input.operationId, "operationId");
  validateFingerprint(input.fingerprint);

  if (input.existingByOperation !== undefined) {
    assertRevisionBelongsToInput(input.existingByOperation, input);
    return { kind: "replay-operation", revisionId: input.existingByOperation.revisionId };
  }

  if (input.existingByFingerprint !== undefined) {
    assertRevisionBook(input.existingByFingerprint, input.bookId);
    assertSameFingerprint(input.existingByFingerprint.fingerprint, input.fingerprint);
    if (input.existingByFingerprint.revisionId === input.activeRevisionId) {
      return { kind: "unchanged", revisionId: input.existingByFingerprint.revisionId };
    }
  }

  if (input.activeRevisionId !== input.baseRevisionId) {
    if (input.activeRevisionId === null) {
      throw new Error("baseRevisionId cannot target a revision when the book has no active revision");
    }
    return { kind: "create-conflicted-revision", activeRevisionId: input.activeRevisionId };
  }

  if (input.existingByFingerprint !== undefined) {
    return { kind: "reuse-content", revisionId: input.existingByFingerprint.revisionId };
  }
  return { kind: "create-revision" };
}

function validateFingerprint(fingerprint: SourceFingerprint): void {
  if (fingerprint.algorithm !== "sha256") throw new Error("Only SHA-256 fingerprints are supported");
  normalizeSha256Hex(fingerprint.hex);
  if (!Number.isSafeInteger(fingerprint.byteLength) || fingerprint.byteLength < 0) {
    throw new Error("fingerprint byteLength must be a non-negative safe integer");
  }
}

function assertRevisionBelongsToInput(
  revision: BookSourceRevision,
  input: RevisionDecisionInput,
): void {
  assertRevisionBook(revision, input.bookId);
  if (revision.operationId !== input.operationId) {
    throw new Error("Operation lookup returned a revision for another operation");
  }
  if (revision.baseRevisionId !== input.baseRevisionId) {
    throw new Error("An operationId cannot be replayed with another base revision");
  }
  assertSameFingerprint(revision.fingerprint, input.fingerprint);
}

function assertRevisionBook(revision: BookSourceRevision, bookId: string): void {
  if (revision.bookId !== bookId) throw new Error("Revision belongs to another book");
}

function assertSameFingerprint(a: SourceFingerprint, b: SourceFingerprint): void {
  if (normalizeSha256Hex(a.hex) !== normalizeSha256Hex(b.hex)
    || a.byteLength !== b.byteLength) {
    throw new Error("Fingerprint lookup returned a revision with different content");
  }
}

function assertIdentifier(value: string, name: string): void {
  if (value.trim() === "") throw new Error(`${name} cannot be empty`);
}
