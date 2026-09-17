import { describe, expect, it, vi } from "vitest";
import type { BookSourceRevision, SourceConflictResolutionRequest } from "@library/source-sync";
import { ConflictResolutionAuthority, ConflictResolutionHttpRouter, type ConflictResolutionStore } from "./conflict-resolution.js";

const revision: BookSourceRevision = { revisionId: "conflict", bookId: "book", operationId: "upload", baseRevisionId: "base", fingerprint: { algorithm: "sha256", hex: "a".repeat(64), byteLength: 10 }, sourceName: "book.docx", createdAt: "now", createdByDeviceId: "device", status: "conflicted" };
const input: SourceConflictResolutionRequest = { operationId: "resolve", deviceId: "device", conflictingRevisionId: "conflict", expectedPublicationVersion: 4, resolution: "keepLocal" };

describe("conflict resolution authority", () => {
  it("keeps a local conflicting revision through the ready-build publication path", async () => {
    const commit = vi.fn(async (value: any) => result(value.resolution, "published", value.bookId, value.conflictingRevisionId));
    const enqueue = vi.fn(async () => undefined); const authority = new ConflictResolutionAuthority(store({ readyBuild: async () => "build", commit, enqueue }), devices(true));
    await expect(authority.resolve({ userId: "owner" }, "book", input)).resolves.toMatchObject({ resolution: "keepLocal", status: "published", targetRevisionId: "conflict", recordVersion: 5 });
    expect(enqueue).not.toHaveBeenCalled(); expect(commit).toHaveBeenCalledWith(expect.objectContaining({ readyBuildId: "build", userId: "owner" }));
  });

  it("queues missing derivatives, archives remote choice, and creates an independent copy", async () => {
    const enqueue = vi.fn(async () => undefined); const commit = vi.fn(async (value: any) => value.resolution === "keepRemote"
      ? result(value.resolution, "archived", "book", "conflict") : result(value.resolution, "queued", "copy-book", "copy-revision"));
    const authority = new ConflictResolutionAuthority(store({ readyBuild: async () => null, enqueue, commit }), devices(true));
    await expect(authority.resolve({ userId: "owner" }, "book", input)).resolves.toMatchObject({ status: "queued" });
    expect(enqueue).toHaveBeenCalledWith("book", "conflict");
    await expect(authority.resolve({ userId: "owner" }, "book", { ...input, operationId: "remote", resolution: "keepRemote" })).resolves.toMatchObject({ status: "archived", targetBookId: "book" });
    await expect(authority.resolve({ userId: "owner" }, "book", { ...input, operationId: "copy", resolution: "createCopy" })).resolves.toMatchObject({ status: "queued", targetBookId: "copy-book" });
  });

  it("replays the same intent and rejects operation-id meaning changes", async () => {
    const prior = { ...result("keepRemote", "archived", "book", "conflict"), operationId: "resolve", conflictingRevisionId: "conflict" };
    const commit = vi.fn(); const authority = new ConflictResolutionAuthority(store({ findResolution: async () => prior, commit }), devices(true));
    await expect(authority.resolve({ userId: "owner" }, "book", { ...input, resolution: "keepRemote" })).resolves.toEqual(prior);
    await expect(authority.resolve({ userId: "owner" }, "book", input)).rejects.toMatchObject({ code: "operation_reused", status: 409 });
    expect(commit).not.toHaveBeenCalled();
  });

  it("enforces ownership, active device, conflicted status, and publication CAS", async () => {
    await expect(new ConflictResolutionAuthority(store({ isOwner: async () => false })).resolve({ userId: "x" }, "book", input)).rejects.toMatchObject({ status: 404 });
    await expect(new ConflictResolutionAuthority(store(), devices(false)).resolve({ userId: "owner" }, "book", input)).rejects.toMatchObject({ code: "device_not_active" });
    await expect(new ConflictResolutionAuthority(store({ snapshot: async () => ({ ...snapshot(), revisions: [{ ...revision, status: "published" }] }) }), devices(true)).resolve({ userId: "owner" }, "book", input)).rejects.toMatchObject({ code: "revision_not_conflicted" });
    await expect(new ConflictResolutionAuthority(store({ snapshot: async () => ({ ...snapshot(), recordVersion: 5 }) }), devices(true)).resolve({ userId: "owner" }, "book", input)).rejects.toMatchObject({ code: "publication_conflict" });
  });

  it("exposes a strict authenticated HTTP endpoint", async () => {
    const authority = new ConflictResolutionAuthority(store({ commit: async (value) => ({ ...result(value.resolution, "archived", value.bookId, value.conflictingRevisionId), conflictingRevisionId: value.conflictingRevisionId }) }), devices(true));
    const router = new ConflictResolutionHttpRouter(authority, { authenticate: async () => ({ userId: "owner" }) });
    const response = await router.handle(new Request("https://sync/books/book/source-revisions/resolve-conflict", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...input, resolution: "keepRemote" }) }));
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ resolution: "keepRemote", status: "archived" });
    expect((await router.handle(new Request("https://sync/books/book/source-revisions/resolve-conflict", { method: "POST", body: "{}" }))).status).toBe(400);
  });
});

function snapshot() { return { bookId: "book", currentRevisionId: "active", currentBuildId: "build", desiredRevisionId: null, recordVersion: 4, revisions: [revision] }; }
function result(resolution: "keepLocal" | "keepRemote" | "createCopy", status: "archived" | "queued" | "published", targetBookId: string, targetRevisionId: string) { return { operationId: resolution === "keepLocal" ? "resolve" : resolution === "keepRemote" ? "remote" : "copy", resolution, sourceBookId: "book", targetBookId, targetRevisionId, status, recordVersion: 5, conflictingRevisionId: "conflict" }; }
function devices(active: boolean) { return { isActiveDevice: async () => active }; }
function store(overrides: Partial<ConflictResolutionStore> = {}): ConflictResolutionStore { return { isOwner: async (_book, user) => user === "owner", snapshot: async () => snapshot(), findResolution: async () => null, readyBuild: async () => null, enqueue: async () => undefined, commit: async (value) => ({ ...result(value.resolution, value.resolution === "keepRemote" ? "archived" : "queued", value.bookId, value.conflictingRevisionId), operationId: value.operationId }), ...overrides }; }
