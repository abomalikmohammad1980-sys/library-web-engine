import { describe, expect, it } from "vitest";
import type { BookSourceRevision } from "./contracts.js";
import { decideRevisionStatusTransition } from "./revision-state.js";

function revision(status: BookSourceRevision["status"]): BookSourceRevision {
  return {
    revisionId: "revision-1",
    bookId: "book-1",
    operationId: "operation-1",
    baseRevisionId: null,
    fingerprint: { algorithm: "sha256", hex: "a".repeat(64), byteLength: 10 },
    sourceName: "book.docx",
    createdAt: "2026-08-08T00:00:00Z",
    createdByDeviceId: "device-1",
    status,
  };
}

describe("source revision lifecycle", () => {
  it("moves a verified upload into quarantine before processing", () => {
    expect(decideRevisionStatusTransition({
      revision: revision("uploaded"),
      expectedStatus: "uploaded",
      nextStatus: "quarantined",
    })).toMatchObject({ kind: "transition", revision: { status: "quarantined" } });
  });

  it("releases a quarantined revision only through processing", () => {
    expect(decideRevisionStatusTransition({
      revision: revision("quarantined"),
      expectedStatus: "quarantined",
      nextStatus: "processing",
    })).toMatchObject({ kind: "transition", revision: { status: "processing" } });
    expect(() => decideRevisionStatusTransition({
      revision: revision("quarantined"),
      expectedStatus: "quarantined",
      nextStatus: "published",
    })).toThrow(/Invalid/);
  });

  it("does not publish a processing revision before it is ready", () => {
    expect(() => decideRevisionStatusTransition({
      revision: revision("processing"),
      expectedStatus: "processing",
      nextStatus: "published",
    })).toThrow(/Invalid/);
  });

  it("is idempotent when the target status was already committed", () => {
    expect(decideRevisionStatusTransition({
      revision: revision("published"),
      expectedStatus: "ready",
      nextStatus: "published",
    }).kind).toBe("already-applied");
  });

  it("returns an optimistic conflict instead of applying from a stale status", () => {
    expect(decideRevisionStatusTransition({
      revision: revision("quarantined"),
      expectedStatus: "uploaded",
      nextStatus: "processing",
    })).toEqual({ kind: "status-conflict", currentStatus: "quarantined" });
  });

  it("keeps published and rejected revisions terminal", () => {
    expect(() => decideRevisionStatusTransition({
      revision: revision("published"),
      expectedStatus: "published",
      nextStatus: "processing",
    })).toThrow(/Invalid/);
    expect(() => decideRevisionStatusTransition({
      revision: revision("rejected"),
      expectedStatus: "rejected",
      nextStatus: "queued",
    })).toThrow(/Invalid/);
  });
});
