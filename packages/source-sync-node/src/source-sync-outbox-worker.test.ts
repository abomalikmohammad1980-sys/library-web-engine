import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SourceSyncOperation, SourceRevisionUploadPayload } from "@library/source-sync";
import { JsonSourceSyncPersistence } from "./json-source-sync-persistence.js";
import { SourceSyncApiError, type SourceRevisionRemoteApi } from "./source-sync-api-client.js";
import { SourceSyncOutboxWorker } from "./source-sync-outbox-worker.js";

const HASH = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

function operation(): SourceSyncOperation<SourceRevisionUploadPayload> {
  return {
    operationId: "operation-1", kind: "source-revision.upload", bookId: "book-1",
    payloadDigest: `book-1:none:${HASH}:3`,
    payload: {
      mappingId: "mapping-1", bookId: "book-1", logicalPath: "folder/book.docx", generation: 1,
      baseRevisionId: null, fingerprint: { algorithm: "sha256", hex: HASH, byteLength: 3 },
    },
    state: "pending", attempt: 0, createdAtMs: 10, nextAttemptAtMs: 10,
    leaseId: null, leaseUntilMs: null, lastErrorCode: null, recordVersion: 0,
  };
}

async function harness(api: SourceRevisionRemoteApi, bytes = new TextEncoder().encode("abc"), now:()=>number=()=>1_000) {
  const root = await mkdtemp(join(tmpdir(), "source-sync-worker-")); roots.push(root);
  const persistence = new JsonSourceSyncPersistence(join(root, "state.json"));
  await persistence.transaction(async (tx) => {
    expect(await tx.compareAndSwapOutbox(null, operation())).toBe(true);
  });
  const worker = new SourceSyncOutboxWorker(persistence, { readBytes: async () => bytes }, api, {
    leaseDurationMs: 5_000, batchSize: 5, retryBaseMs: 100, retryMaxMs: 5_000,
    deviceId: "device-1", now, createLeaseId: () => "lease-1",
  });
  return { persistence, worker, statePath: join(root, "state.json") };
}

describe("SourceSyncOutboxWorker", () => {
  it("uploads through a server-issued staging grant then finalizes and durably succeeds", async () => {
    const api: SourceRevisionRemoteApi = {
      prepareUpload: vi.fn(async () => ({ kind: "upload", uploadId: "upload-1", uploadUrl: "https://objects.invalid/grant", expiresAt: "2030-01-01T00:00:00Z" })),
      uploadBytes: vi.fn(async () => undefined),
      finalizeUpload: vi.fn(async () => ({ kind: "accepted", revision: revision("published") })),
    };
    const { worker, statePath } = await harness(api);
    await expect(worker.runOnce()).resolves.toEqual({ claimed: 1, succeeded: 1, conflicted: 0, retried: 0, blocked: 0 });
    expect(api.prepareUpload).toHaveBeenCalledWith(expect.objectContaining({ operationId: "operation-1", sourceName: "book.docx", deviceId: "device-1" }));
    expect(api.uploadBytes).toHaveBeenCalledOnce();
    expect(api.finalizeUpload).toHaveBeenCalledOnce();
    expect(JSON.parse(await readFile(statePath, "utf8")).outbox["operation-1"]).toMatchObject({ state: "succeeded", attempt: 1, leaseId: null, recordVersion: 2 });
  });

  it("replays an already completed immutable revision without uploading bytes", async () => {
    const api: SourceRevisionRemoteApi = {
      prepareUpload: vi.fn(async () => ({ kind: "complete", revision: revision("uploaded") })),
      uploadBytes: vi.fn(async () => undefined),
      finalizeUpload: vi.fn(),
    };
    const { worker } = await harness(api);
    await expect(worker.runOnce()).resolves.toMatchObject({ succeeded: 1 });
    expect(api.uploadBytes).not.toHaveBeenCalled();
    expect(api.finalizeUpload).not.toHaveBeenCalled();
  });

  it("preserves an optimistic conflict as a terminal outbox result", async () => {
    const api: SourceRevisionRemoteApi = {
      prepareUpload: async () => ({ kind: "upload", uploadId: "upload-1", uploadUrl: "https://objects.invalid/grant", expiresAt: "2030-01-01T00:00:00Z" }),
      uploadBytes: async () => undefined,
      finalizeUpload: async () => ({ kind: "conflicted", revision: revision("conflicted"), activeRevisionId: "revision-other" }),
    };
    const { worker, persistence } = await harness(api);
    await expect(worker.runOnce()).resolves.toMatchObject({ conflicted: 1 });
    await expect(persistence.transaction((tx) => tx.getOutboxOperation("operation-1")))
      .resolves.toMatchObject({ state: "conflicted", lastErrorCode: "source_revision_conflict" });
  });

  it("does not upload changed local bytes and schedules a durable retry", async () => {
    const api: SourceRevisionRemoteApi = { prepareUpload: vi.fn(), uploadBytes: vi.fn(), finalizeUpload: vi.fn() };
    const { worker, persistence } = await harness(api, new TextEncoder().encode("changed"));
    await expect(worker.runOnce()).resolves.toMatchObject({ retried: 1 });
    expect(api.prepareUpload).not.toHaveBeenCalled();
    await expect(persistence.transaction((tx) => tx.getOutboxOperation("operation-1")))
      .resolves.toMatchObject({ state: "retryable", nextAttemptAtMs: 1_100, lastErrorCode: "source_changed" });
  });

  it("blocks permanent authorization failures but retries server outages", async () => {
    for (const [error, state] of [
      [new SourceSyncApiError("forbidden", "forbidden", false, 403), "blocked"],
      [new SourceSyncApiError("unavailable", "unavailable", true, 503), "retryable"],
    ] as const) {
      const api: SourceRevisionRemoteApi = { prepareUpload: async () => { throw error; }, uploadBytes: vi.fn(), finalizeUpload: vi.fn() };
      const { worker, persistence } = await harness(api);
      await worker.runOnce();
      await expect(persistence.transaction((tx) => tx.getOutboxOperation("operation-1")))
        .resolves.toMatchObject({ state, lastErrorCode: error.code });
    }
  });

  it("applies the HTTP fault matrix and bounds Retry-After without false completion", async () => {
    for (const [status, retryable] of [[408,true],[409,false],[429,true],[500,true],[503,true]] as const) {
      const error = new SourceSyncApiError(`http_${status}`,`http_${status}`,retryable,status,status===429?60_000:null);
      const api:SourceRevisionRemoteApi={prepareUpload:async()=>{throw error},uploadBytes:vi.fn(),finalizeUpload:vi.fn()};
      const {worker,persistence}=await harness(api);await worker.runOnce();
      await expect(persistence.transaction(tx=>tx.getOutboxOperation("operation-1"))).resolves.toMatchObject(retryable
        ?{state:"retryable",nextAttemptAtMs:status===429?6_000:1_100}:{state:"blocked"});
      expect(api.uploadBytes).not.toHaveBeenCalled();expect(api.finalizeUpload).not.toHaveBeenCalled();
    }
  });

  it("treats a dropped partial staging PUT as retryable and never finalizes it",async()=>{
    const api:SourceRevisionRemoteApi={prepareUpload:vi.fn(async()=>({kind:"upload",uploadId:"u",uploadUrl:"https://objects.invalid/signed",expiresAt:"2030-01-01"})),uploadBytes:vi.fn(async()=>{throw new SourceSyncApiError("drop","connection_drop",true,null)}),finalizeUpload:vi.fn()};
    const {worker,persistence}=await harness(api);await expect(worker.runOnce()).resolves.toMatchObject({retried:1,succeeded:0});expect(api.finalizeUpload).not.toHaveBeenCalled();await expect(persistence.transaction(tx=>tx.getOutboxOperation("operation-1"))).resolves.toMatchObject({state:"retryable",lastErrorCode:"connection_drop"});
  });

  it("recovers from a lost duplicate-finalize response without uploading successful bytes twice",async()=>{
    let clock=1_000,prepareCalls=0;
    const api:SourceRevisionRemoteApi={
      prepareUpload:vi.fn(async()=>++prepareCalls===1?{kind:"upload",uploadId:"u",uploadUrl:"https://objects.invalid/signed",expiresAt:"2030-01-01"}:{kind:"complete",revision:revision("uploaded")}),
      uploadBytes:vi.fn(async()=>undefined),
      finalizeUpload:vi.fn(async()=>{throw new SourceSyncApiError("response dropped","transport_drop",true,null)}),
    };
    const {worker,persistence}=await harness(api,new TextEncoder().encode("abc"),()=>clock);
    await expect(worker.runOnce()).resolves.toMatchObject({retried:1,succeeded:0});
    clock=1_100;
    await expect(worker.runOnce()).resolves.toMatchObject({succeeded:1,retried:0});
    expect(api.uploadBytes).toHaveBeenCalledOnce();
    expect(api.finalizeUpload).toHaveBeenCalledOnce();
    await expect(worker.runOnce()).resolves.toMatchObject({claimed:0});
    await expect(persistence.transaction(tx=>tx.getOutboxOperation("operation-1"))).resolves.toMatchObject({state:"succeeded",attempt:2});
  });
});

function revision(status: "uploaded" | "published" | "conflicted") {
  return {
    revisionId: "revision-1", bookId: "book-1", operationId: "operation-1", baseRevisionId: null,
    fingerprint: { algorithm: "sha256" as const, hex: HASH, byteLength: 3 }, sourceName: "book.docx",
    createdAt: "2026-08-08T00:00:00Z", createdByDeviceId: "device-1", status,
  };
}
