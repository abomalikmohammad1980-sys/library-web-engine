import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { SourceRevisionUploadPayload, SourceSyncOperation } from "@library/source-sync";
import { HttpSourceRevisionApi } from "../../source-sync-node/src/source-sync-api-client.js";
import { JsonSourceSyncPersistence } from "../../source-sync-node/src/json-source-sync-persistence.js";
import { SourceSyncOutboxWorker } from "../../source-sync-node/src/source-sync-outbox-worker.js";
import { SourceRevisionHttpRouter } from "./router.js";
import { harness } from "./authority.test.js";

const HASH = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("client → worker → router → authority contract", () => {
  it("uploads, records conflict, and replays without another object upload", async () => {
    const server = harness(); server.tx.active = "revision-other";
    const router = new SourceRevisionHttpRouter(server.authority, {
      authenticate: async (request) => ({ userId: request.headers.get("authorization") === "Bearer owner-token" ? "owner-1" : "attacker" }),
    });
    let objectPuts = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.startsWith("https://objects.example/")) { objectPuts += 1; return new Response(null, { status: 200 }); }
      return router.handle(new Request(url, init));
    };
    const api = new HttpSourceRevisionApi("https://api.example/v1/", async () => "owner-token", fetchImpl);
    const root = await mkdtemp(join(tmpdir(), "source-sync-contract-")); roots.push(root);
    const persistence = new JsonSourceSyncPersistence(join(root, "state.json"));
    await persistence.transaction(async (tx) => { await tx.compareAndSwapOutbox(null, operation()); });
    const worker = new SourceSyncOutboxWorker(persistence, { readBytes: async () => new TextEncoder().encode("abc") }, api, {
      leaseDurationMs: 5_000, batchSize: 1, retryBaseMs: 100, retryMaxMs: 1_000, deviceId: "device-1",
      now: () => 1_000, createLeaseId: () => "lease-1",
    });
    await expect(worker.runOnce()).resolves.toMatchObject({ claimed: 1, conflicted: 1 });
    expect(objectPuts).toBe(1);
    const replay = await api.prepareUpload(request());
    expect(replay).toMatchObject({ kind: "complete", revision: { status: "conflicted" } });
    expect(objectPuts).toBe(1);
  });

  it("rejects IDOR through the HTTP contract without issuing a grant", async () => {
    const server = harness(); server.tx.owner = false;
    const router = new SourceRevisionHttpRouter(server.authority, { authenticate: async () => ({ userId: "attacker" }) });
    const response = await router.handle(new Request("https://api.example/v1/source-revisions/uploads", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request()),
    }));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: { code: "book_not_found" } });
    expect(server.grants.issue).not.toHaveBeenCalled();
  });
});

function request() { return { operationId: "operation-1", bookId: "book-1", baseRevisionId: "revision-base",
  fingerprint: { algorithm: "sha256" as const, hex: HASH, byteLength: 3 }, sourceName: "book.docx", deviceId: "device-1" }; }
function operation(): SourceSyncOperation<SourceRevisionUploadPayload> { return {
  operationId: "operation-1", kind: "source-revision.upload", bookId: "book-1", payloadDigest: `book-1:revision-base:${HASH}:3`,
  payload: { mappingId: "mapping-1", bookId: "book-1", logicalPath: "book.docx", generation: 1,
    baseRevisionId: "revision-base", fingerprint: { algorithm: "sha256", hex: HASH, byteLength: 3 } },
  state: "pending", attempt: 0, createdAtMs: 0, nextAttemptAtMs: 0, leaseId: null, leaseUntilMs: null, lastErrorCode: null, recordVersion: 0,
}; }
