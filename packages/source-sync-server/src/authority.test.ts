import { describe, expect, it, vi } from "vitest";
import type { BookSourceRevision, SourceFingerprint } from "@library/source-sync";
import { SourceRevisionAuthority } from "./authority.js";
import { SourceRevisionAuthorityError, type SourceRevisionAuthorityTransaction, type StagedSourceUpload } from "./contracts.js";

const bytes = new TextEncoder().encode("abc");
const fingerprint: SourceFingerprint = { algorithm: "sha256", hex: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", byteLength: 3 };
const command = { operationId: "operation-1", bookId: "book-1", baseRevisionId: "revision-base", fingerprint, sourceName: "book.docx", deviceId: "device-1" };

export class TestTransaction implements SourceRevisionAuthorityTransaction {
  owner = true; active: string | null = "revision-base"; uploads = new Map<string, StagedSourceUpload>(); revisions: BookSourceRevision[] = [];
  reconciled: Array<{bookId:string;operationId:string;revisionId:string}> = [];
  quarantine: "allowed"|"rejected"|"pending"|null = null; reserved = new Set<string>(); committed = new Set<string>(); released = new Set<string>();
  async isBookOwner() { return this.owner; }
  async getRevisionByOperation(bookId: string, operationId: string) { return this.revisions.find((item) => item.bookId === bookId && item.operationId === operationId) ?? null; }
  async getRevisionByFingerprint(bookId: string, value: SourceFingerprint) { return this.revisions.find((item) => item.bookId === bookId && item.fingerprint.hex === value.hex) ?? null; }
  async getActiveRevisionId() { return this.active; }
  async getUpload(id: string) { return this.uploads.get(id) ?? null; }
  async getUploadByOperation(bookId: string, operationId: string) { return [...this.uploads.values()].find(item => item.bookId === bookId && item.operationId === operationId) ?? null; }
  async createUpload(upload: StagedSourceUpload) { if ([...this.uploads.values()].some((item) => item.operationId === upload.operationId)) return false; this.uploads.set(upload.uploadId, upload); return true; }
  async createRevision(revision: BookSourceRevision) { if (await this.getRevisionByOperation(revision.bookId, revision.operationId)) return false; this.revisions.push(revision); return true; }
  async markUploadFinalized() { return true; }
  async reconcileCompletedUpload(bookId:string,operationId:string,revisionId:string){this.reconciled.push({bookId,operationId,revisionId})}
  async reserveUsage(input:{uploadId:string}) { this.reserved.add(input.uploadId); return "reserved" as const; }
  async releaseUsage(uploadId:string) { this.reserved.delete(uploadId); this.released.add(uploadId); }
  async commitUsage(uploadId:string) { if (this.reserved.delete(uploadId)) this.committed.add(uploadId); }
  async recordQuarantine() { this.quarantine = "pending"; }
  async quarantineDecision() { return this.quarantine; }
}

export function harness(now: () => Date = () => new Date("2026-08-08T00:00:00Z"),deviceActive=true, inspect:()=>Promise<{kind:"accepted"}|{kind:"quarantined"|"rejected";reason:string}>=async()=>({kind:"accepted"})) {
  const tx = new TestTransaction();
  const objects = {
    stat: vi.fn(async () => ({ byteLength: bytes.byteLength })), read: vi.fn(async () => bytes),
    promoteIfAbsent: vi.fn(async () => "created" as const), delete: vi.fn(async () => undefined),
  };
  const grants = { issue: vi.fn(async () => ({ uploadUrl: "https://objects.example/signed" })) };
  let revision = 0;
  const authority = new SourceRevisionAuthority({ transaction: async (work) => work(tx) }, objects, grants,
    { inspect }, { uploadId: () => "upload-1", revisionId: () => `revision-${++revision}` },
    now,{isActiveDevice:async()=>deviceActive});
  return { authority, tx, objects, grants };
}

describe("SourceRevisionAuthority", () => {
  it("checks authenticated ownership before issuing a narrowly scoped staging grant", async () => {
    const { authority, tx, grants } = harness(); tx.owner = false;
    const error = await authority.prepare({ userId: "attacker" }, command).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SourceRevisionAuthorityError); expect(error).toMatchObject({ code: "book_not_found", status: 404 });
    expect(grants.issue).not.toHaveBeenCalled();
  });

  it("verifies staged size, SHA-256 and DOCX inspection before immutable promotion and revision commit", async () => {
    const { authority, tx, objects, grants } = harness();
    await expect(authority.prepare({ userId: "owner-1" }, command)).resolves.toEqual({
      kind: "upload", uploadId: "upload-1", uploadUrl: "https://objects.example/signed", expiresAt: "2026-08-08T00:15:00.000Z",
    });
    expect(grants.issue).toHaveBeenCalledWith(expect.objectContaining({ objectKey: "staging/source/upload-1", byteLength: 3 }));
    await expect(authority.finalize({ userId: "owner-1" }, "upload-1", command)).resolves.toMatchObject({ kind: "accepted", revision: { status: "uploaded" } });
    expect(objects.promoteIfAbsent).toHaveBeenCalledWith("staging/source/upload-1", `sources/book-1/sha256/${fingerprint.hex}.docx`);
    expect(tx.revisions).toHaveLength(1);
  });

  it("replays operation idempotently without a second staging grant", async () => {
    const { authority, tx, grants } = harness(); tx.revisions.push(revision("uploaded"));
    await expect(authority.prepare({ userId: "owner-1" }, command)).resolves.toMatchObject({ kind: "complete", revision: { revisionId: "revision-existing" } });
    expect(grants.issue).not.toHaveBeenCalled();
    expect(tx.reconciled).toEqual([{bookId:"book-1",operationId:"operation-1",revisionId:"revision-existing"}]);
  });

  it("reissues the same narrow grant after the first grant response fails", async () => {
    const { authority, tx, grants } = harness();
    grants.issue.mockRejectedValueOnce(new Error("synthetic signing outage"));
    await expect(authority.prepare({ userId: "owner-1" }, command)).rejects.toThrow("synthetic signing outage");
    expect(tx.uploads).toHaveLength(1);
    await expect(authority.prepare({ userId: "owner-1" }, command)).resolves.toMatchObject({
      kind: "upload", uploadId: "upload-1", uploadUrl: "https://objects.example/signed",
    });
    expect(tx.uploads).toHaveLength(1);
    expect(grants.issue).toHaveBeenCalledTimes(2);
  });

  it("does not reissue an interrupted operation grant for changed source authority", async () => {
    const { authority, objects, grants } = harness();
    grants.issue.mockRejectedValueOnce(new Error("synthetic signing outage"));
    await expect(authority.prepare({ userId: "owner-1" }, command)).rejects.toThrow();
    await expect(authority.prepare({ userId: "owner-1" }, { ...command, sourceName: "attacker.docx" }))
      .rejects.toMatchObject({ code: "operation_in_progress", status: 409 });
    expect(grants.issue).toHaveBeenCalledTimes(1);
    expect(objects.read).not.toHaveBeenCalled();
  });

  it("does not turn a stale reservation replay into an unmetered upload", async () => {
    const { authority, tx, grants } = harness();
    tx.reserveUsage = async () => "replay" as const;
    await expect(authority.prepare({ userId: "owner-1" }, command))
      .rejects.toMatchObject({ code: "operation_in_progress", status: 409 });
    expect(tx.uploads.size).toBe(0);
    expect(grants.issue).not.toHaveBeenCalled();
  });

  it("keeps quota reserved while quarantined and commits it once after an allow decision", async () => {
    const { authority, tx } = harness(() => new Date("2026-08-08T00:00:00Z"), true, async () => ({ kind: "quarantined", reason: "active_content" }));
    await authority.prepare({ userId: "owner-1" }, command);
    await expect(authority.finalize({ userId: "owner-1" }, "upload-1", command))
      .rejects.toMatchObject({ code: "docx_quarantined", status: 422 });
    expect(tx.reserved.has("upload-1")).toBe(true);
    expect(tx.released.has("upload-1")).toBe(false);
    tx.quarantine = "allowed";
    await expect(authority.finalize({ userId: "owner-1" }, "upload-1", command)).resolves.toMatchObject({ kind: "accepted" });
    expect(tx.committed).toEqual(new Set(["upload-1"]));
    expect(tx.reserved.size).toBe(0);
  });

  it("releases quarantined quota after an explicit reject decision", async () => {
    const { authority, tx } = harness(() => new Date("2026-08-08T00:00:00Z"), true, async () => ({ kind: "quarantined", reason: "active_content" }));
    await authority.prepare({ userId: "owner-1" }, command);
    await expect(authority.finalize({ userId: "owner-1" }, "upload-1", command)).rejects.toMatchObject({ code: "docx_quarantined" });
    tx.quarantine = "rejected";
    await expect(authority.finalize({ userId: "owner-1" }, "upload-1", command)).rejects.toMatchObject({ code: "docx_rejected" });
    expect(tx.reserved.size).toBe(0);
    expect(tx.released).toEqual(new Set(["upload-1"]));
    expect(tx.committed.size).toBe(0);
  });

  it("rejects a pending quarantine before reading or hashing staged bytes again", async () => {
    const { authority, tx, objects } = harness();
    await authority.prepare({ userId: "owner-1" }, command);
    tx.quarantine = "pending";
    await expect(authority.finalize({ userId: "owner-1" }, "upload-1", command))
      .rejects.toMatchObject({ code: "docx_quarantined", status: 422 });
    expect(objects.stat).not.toHaveBeenCalled();
    expect(objects.read).not.toHaveBeenCalled();
    expect(tx.reserved.has("upload-1")).toBe(true);
  });

  it("reconciles a partially finalized upload on replay without creating a duplicate revision", async () => {
    const { authority, tx, objects } = harness();
    tx.revisions.push(revision("uploaded"));
    tx.uploads.set("upload-1", { uploadId:"upload-1",operationId:command.operationId,ownerId:"owner-1",bookId:command.bookId,objectKey:"staging/source/upload-1",expectedFingerprint:fingerprint,baseRevisionId:command.baseRevisionId,sourceName:command.sourceName,deviceId:command.deviceId,expiresAt:"2026-08-08T00:15:00.000Z" });
    await expect(authority.finalize({userId:"owner-1"},"upload-1",command)).resolves.toMatchObject({kind:"accepted",revision:{revisionId:"revision-existing"}});
    expect(tx.reconciled).toEqual([{bookId:"book-1",operationId:"operation-1",revisionId:"revision-existing"}]);
    expect(tx.revisions).toHaveLength(1);
    expect(objects.promoteIfAbsent).not.toHaveBeenCalled();
  });

  it("stores a competing base as an immutable conflicted revision instead of overwriting active", async () => {
    const { authority, tx } = harness(); tx.active = "revision-other";
    await authority.prepare({ userId: "owner-1" }, command);
    await expect(authority.finalize({ userId: "owner-1" }, "upload-1", command)).resolves.toMatchObject({
      kind: "conflicted", activeRevisionId: "revision-other", revision: { status: "conflicted", baseRevisionId: "revision-base" },
    });
    expect(tx.active).toBe("revision-other");
  });

  it("rejects mismatched staged bytes before promotion", async () => {
    const { authority, objects } = harness(); await authority.prepare({ userId: "owner-1" }, command);
    objects.read.mockResolvedValue(new TextEncoder().encode("abd"));
    await expect(authority.finalize({ userId: "owner-1" }, "upload-1", command)).rejects.toMatchObject({ code: "staging_fingerprint_mismatch", status: 422 });
    expect(objects.promoteIfAbsent).not.toHaveBeenCalled();
  });

  it("binds base revision and source metadata at prepare so finalize cannot mutate request meaning", async () => {
    const { authority, objects } = harness(); await authority.prepare({ userId: "owner-1" }, command);
    await expect(authority.finalize({ userId: "owner-1" }, "upload-1", { ...command, baseRevisionId: "revision-attacker" }))
      .rejects.toMatchObject({ code: "upload_request_mismatch", status: 409 });
    expect(objects.read).not.toHaveBeenCalled();
  });

  it("rejects an expired grant before reading staged bytes", async () => {
    let current = new Date("2026-08-08T00:00:00Z");
    const { authority, objects } = harness(() => current);
    await authority.prepare({ userId: "owner-1" }, command);
    current = new Date("2026-08-08T00:16:00Z");
    await expect(authority.finalize({ userId: "owner-1" }, "upload-1", command))
      .rejects.toMatchObject({ code: "upload_expired", status: 410 });
    expect(objects.read).not.toHaveBeenCalled();
  });
  it("rejects an unregistered or revoked device before issuing a grant",async()=>{const{authority,grants}=harness(()=>new Date("2026-08-08T00:00:00Z"),false);await expect(authority.prepare({userId:"owner-1"},command)).rejects.toMatchObject({code:"device_not_active",status:409});expect(grants.issue).not.toHaveBeenCalled()});
});

function revision(status: BookSourceRevision["status"]): BookSourceRevision {
  return { revisionId: "revision-existing", bookId: "book-1", operationId: "operation-1", baseRevisionId: "revision-base",
    fingerprint, sourceName: "book.docx", createdAt: "2026-08-08T00:00:00Z", createdByDeviceId: "device-1", status };
}
