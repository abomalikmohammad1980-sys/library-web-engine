import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  sha256Fingerprint,
  type ManagedSourceMapping,
  type ManagedSourcePlatformAdapter,
  type ObservedManagedSource,
  type SourceFileSnapshot,
} from "@library/source-sync";
import { JsonSourceSyncPersistence } from "./json-source-sync-persistence.js";
import { SourceSyncScheduler, type SchedulerNotice } from "./source-sync-scheduler.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("startup reconciliation after a long observation gap", () => {
  it("recovers rename chains, replacements, and clock-skew rewrites without loss or duplicate outbox work", async () => {
    const root = await mkdtemp(join(tmpdir(), "source-sync-outage-"));
    roots.push(root);
    const stateFile = join(root, "state.json");
    const initial: ManagedSourceMapping[] = [];
    const files = new Map<string, { snapshot: SourceFileSnapshot; bytes: Uint8Array }>();

    for (let index = 0; index < 12; index += 1) {
      const oldBytes = testDocx(`old-${index.toString().padStart(2, "0")}`);
      const nextBytes = testDocx(`new-${index.toString().padStart(2, "0")}`);
      expect(nextBytes.byteLength).toBe(oldBytes.byteLength);
      const originalPath = index < 4 ? `before/book-${index}.docx` : `book-${index}.docx`;
      const finalPath = index < 4 ? `after/deep/book-${index}.docx` : originalPath;
      const oldIdentity = `identity-${index}`;
      const finalIdentity = index >= 4 && index < 8 ? `replacement-${index}` : oldIdentity;
      const oldSnapshot = snapshot(originalPath, oldBytes, oldIdentity, 50);
      const finalSnapshot = snapshot(finalPath, nextBytes, finalIdentity, 50);
      initial.push({
        mappingId: `mapping-${index}`,
        bookId: `book-${index}`,
        logicalPath: originalPath,
        fileIdentity: oldIdentity,
        lastPublishedRevisionId: `revision-${index}`,
        lastFingerprint: await sha256Fingerprint(oldBytes),
        lastObservedSnapshot: oldSnapshot,
        state: "linked",
        recordVersion: 0,
      });
      files.set(finalPath, { snapshot: finalSnapshot, bytes: nextBytes });
    }

    const unchangedBytes = testDocx("unchanged");
    const unchangedSnapshot = snapshot("unchanged.docx", unchangedBytes, "identity-unchanged", 50);
    initial.push(await mapping("unchanged", unchangedSnapshot, unchangedBytes));
    files.set("unchanged.docx", { snapshot: unchangedSnapshot, bytes: unchangedBytes });

    const missingBytes = testDocx("missing");
    initial.push(await mapping("missing", snapshot("gone.docx", missingBytes, "identity-gone", 50), missingBytes));

    const duplicateBytes = testDocx("duplicate");
    const duplicateSnapshot = snapshot("dup-one.docx", duplicateBytes, "shared-inode", 50);
    initial.push(await mapping("duplicate", duplicateSnapshot, duplicateBytes));
    files.set("dup-one.docx", { snapshot: duplicateSnapshot, bytes: duplicateBytes });
    files.set("dup-two.docx", {
      snapshot: snapshot("dup-two.docx", duplicateBytes, "shared-inode", 50),
      bytes: duplicateBytes,
    });

    const persistence = new JsonSourceSyncPersistence(stateFile);
    await persistence.transaction(async (tx) => {
      for (const item of initial) expect(await tx.compareAndSwapMapping(null, item)).toBe(true);
    });
    const adapter = memoryAdapter(files);

    const firstNotices: SchedulerNotice[] = [];
    const first = scheduler(adapter, stateFile, firstNotices);
    await first.start();
    await first.idle();
    first.stop();

    const afterFirst = new JsonSourceSyncPersistence(stateFile);
    const operations = await afterFirst.transaction((tx) => tx.listRunnableOutbox(100, 100));
    expect(operations).toHaveLength(12);
    expect(new Set(operations.map((operation) => operation.bookId))).toEqual(
      new Set(Array.from({ length: 12 }, (_, index) => `book-${index}`)),
    );
    expect(firstNotices.filter((notice) => notice.kind === "queued")).toHaveLength(12);
    expect(firstNotices.filter((notice) => notice.kind === "source-moved")).toHaveLength(4);
    expect(firstNotices).toContainEqual({
      kind: "ambiguous-identity",
      fileIdentity: "shared-inode",
      logicalPaths: ["dup-one.docx", "dup-two.docx"],
    });
    expect(firstNotices).toContainEqual({ kind: "unmapped", logicalPath: "dup-two.docx" });
    expect(firstNotices).toContainEqual({ kind: "source-missing", mappingId: "mapping-missing", logicalPath: "gone.docx" });

    for (let index = 0; index < 4; index += 1) {
      expect(await afterFirst.transaction((tx) => tx.getMapping(`mapping-${index}`)))
        .toMatchObject({ logicalPath: `after/deep/book-${index}.docx`, state: "linked" });
    }
    for (let index = 4; index < 8; index += 1) {
      expect(await afterFirst.transaction((tx) => tx.getMapping(`mapping-${index}`)))
        .toMatchObject({ logicalPath: `book-${index}.docx`, fileIdentity: `replacement-${index}`, state: "linked" });
    }
    expect(await afterFirst.transaction((tx) => tx.getMapping("mapping-missing"))).toMatchObject({ state: "missing" });

    const secondNotices: SchedulerNotice[] = [];
    const second = scheduler(adapter, stateFile, secondNotices);
    await second.start();
    await second.idle();
    second.stop();
    const afterRestart = await new JsonSourceSyncPersistence(stateFile)
      .transaction((tx) => tx.listRunnableOutbox(100, 100));
    expect(afterRestart.map((operation) => operation.operationId).sort())
      .toEqual(operations.map((operation) => operation.operationId).sort());
    expect(secondNotices.filter((notice) => notice.kind === "replayed")).toHaveLength(12);
  });
});

function scheduler(adapter: ManagedSourcePlatformAdapter, stateFile: string, notices: SchedulerNotice[]) {
  return new SourceSyncScheduler(adapter, new JsonSourceSyncPersistence(stateFile), {
    stability: { debounceMs: 0, stableIntervalMs: 0, requiredStableSamples: 2 },
    sleep: async () => undefined,
    now: () => 100,
    maxConcurrentPaths: 3,
    onNotice: (notice) => notices.push(notice),
  });
}

function memoryAdapter(files: ReadonlyMap<string, { snapshot: SourceFileSnapshot; bytes: Uint8Array }>): ManagedSourcePlatformAdapter {
  return {
    capabilities: { recursiveEnumeration: true, nativeWatch: false, durableFileIdentity: true, backgroundExecution: true },
    enumerate: async (): Promise<ObservedManagedSource[]> => [...files.values()]
      .map((entry) => ({ logicalPath: entry.snapshot.logicalPath, snapshot: structuredClone(entry.snapshot) }))
      .sort((a, b) => a.logicalPath.localeCompare(b.logicalPath)),
    sample: async (logicalPath) => structuredClone(files.get(logicalPath)?.snapshot ?? null),
    readBytes: async (logicalPath) => {
      const bytes = files.get(logicalPath)?.bytes;
      if (bytes === undefined) throw new Error("source-missing");
      return bytes.slice();
    },
    subscribe: async () => () => undefined,
  };
}

async function mapping(name: string, observed: SourceFileSnapshot, bytes: Uint8Array): Promise<ManagedSourceMapping> {
  return {
    mappingId: `mapping-${name}`,
    bookId: `book-${name}`,
    logicalPath: observed.logicalPath,
    ...(observed.fileIdentity === undefined ? {} : { fileIdentity: observed.fileIdentity }),
    lastPublishedRevisionId: `revision-${name}`,
    lastFingerprint: await sha256Fingerprint(bytes),
    lastObservedSnapshot: observed,
    state: "linked",
    recordVersion: 0,
  };
}

function snapshot(path: string, bytes: Uint8Array, fileIdentity: string, modifiedAtMs: number): SourceFileSnapshot {
  return { logicalPath: path, sizeBytes: bytes.byteLength, modifiedAtMs, fileIdentity };
}

function testDocx(document: string): Uint8Array {
  const entries: Array<[string, string]> = [
    ["[Content_Types].xml", '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ["word/document.xml", document],
  ];
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let localOffset = 0;
  for (const [nameText, contentText] of entries) {
    const name = encoder.encode(nameText); const content = encoder.encode(contentText);
    const local = new Uint8Array(30 + name.length + content.length); const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint32(18, content.length, true); lv.setUint32(22, content.length, true); lv.setUint16(26, name.length, true);
    local.set(name, 30); local.set(content, 30 + name.length); locals.push(local);
    const central = new Uint8Array(46 + name.length); const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint32(20, content.length, true); cv.setUint32(24, content.length, true); cv.setUint16(28, name.length, true); cv.setUint32(42, localOffset, true);
    central.set(name, 46); centrals.push(central); localOffset += local.length;
  }
  const centralSize = centrals.reduce((sum, value) => sum + value.length, 0);
  const result = new Uint8Array(localOffset + centralSize + 22); let offset = 0;
  for (const part of [...locals, ...centrals]) { result.set(part, offset); offset += part.length; }
  const end = new DataView(result.buffer, offset, 22); end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true); end.setUint32(12, centralSize, true); end.setUint32(16, localOffset, true);
  return result;
}
