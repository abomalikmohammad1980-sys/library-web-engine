import { SOURCE_FORMATS, SOURCE_FORMAT_CAPABILITIES, type ImmutableSourceEdition, type LogicalWork, type SourceFormat } from "@library/source-sync";
import { describe, expect, it } from "vitest";
import { SourceEditionAuthority, type SourceEditionPersistence, type StoredEditionAttachment } from "./source-editions.js";

const fingerprint = "c".repeat(64);
function edition(format: SourceFormat, suffix = "1", operationId = `op-${format}`): ImmutableSourceEdition {
  return { editionId: `edition-${format}-${suffix}`, operationId, workId: `work-${format}`, format, role: "authoritative", objectKey: `sources/${fingerprint}/${format}-${suffix}`, fingerprint: { algorithm: "sha256", hex: fingerprint, byteLength: 12 }, mediaType: SOURCE_FORMAT_CAPABILITIES[format].mediaTypes[0]!, sourceName: `book.${format}`, createdAt: "2026-08-08T00:00:00Z", createdByDeviceId: "device" };
}

class MemoryStore implements SourceEditionPersistence {
  work: LogicalWork;
  operations = new Map<string, StoredEditionAttachment>();
  constructor(format: SourceFormat) { this.work = { workId: `work-${format}`, title: "كتاب", authority: null, recordVersion: 0 }; }
  async isOwner() { return true; }
  async isActiveDevice() { return true; }
  async getWork() { return this.work; }
  async findAttachment(workId: string, operationId: string) { return this.operations.get(`${workId}:${operationId}`) ?? null; }
  async commit(input: Parameters<SourceEditionPersistence["commit"]>[0]) {
    if (this.work.recordVersion !== input.expectedWorkVersion) return false;
    this.work = input.nextWork;
    this.operations.set(`${input.edition.workId}:${input.edition.operationId}`, { operationId: input.edition.operationId, workId: input.edition.workId, editionId: input.edition.editionId, intent: input.intent, expectedWorkVersion: input.expectedWorkVersion, result: structuredClone(input.nextWork) });
    return true;
  }
}

describe("source edition replay and CAS properties across formats", () => {
  it("replays the original result and rejects operation reuse or stale CAS for every format", async () => {
    for (const format of SOURCE_FORMATS) {
      const store = new MemoryStore(format), authority = new SourceEditionAuthority(store), first = edition(format);
      const attached = await authority.attach({ userId: "user" }, { deviceId: "device", edition: first, intent: "establish-authority", expectedWorkVersion: 0 });
      expect(attached.recordVersion).toBe(1);
      store.work = { ...store.work, title: "عنوان لاحق" };
      await expect(authority.attach({ userId: "user" }, { deviceId: "device", edition: first, intent: "establish-authority", expectedWorkVersion: 0 })).resolves.toEqual(attached);
      await expect(authority.attach({ userId: "user" }, { deviceId: "device", edition: edition(format, "changed", first.operationId), intent: "establish-authority", expectedWorkVersion: 0 })).rejects.toMatchObject({ status: 409, code: "operation_reuse_conflict" });
      await expect(authority.attach({ userId: "user" }, { deviceId: "device", edition: edition(format, "2", `op-${format}-2`), intent: "advance-authority", expectedWorkVersion: 0 })).rejects.toMatchObject({ status: 409, code: "work_version_conflict" });
    }
  });
});
