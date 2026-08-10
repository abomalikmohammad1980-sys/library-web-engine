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
afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));

describe("bounded runtime content scrub", () => {
  it("finds a same-metadata rewrite once, does not churn unchanged mappings, and rotates fairly", async () => {
    const root = await mkdtemp(join(tmpdir(), "source-sync-scrub-"));
    roots.push(root);
    const persistence = new JsonSourceSyncPersistence(join(root, "state.json"));
    const files = new Map<string, { snapshot: SourceFileSnapshot; bytes: Uint8Array }>();
    const initialMappings: ManagedSourceMapping[] = [];
    for (let index = 0; index < 7; index += 1) {
      const path = `book-${index}.docx`;
      const bytes = testDocx(`old-${index}`);
      const observed = snapshot(path, bytes, `inode-${index}`);
      files.set(path, { snapshot: observed, bytes });
      initialMappings.push({
        mappingId: `mapping-${index}`, bookId: `book-${index}`, logicalPath: path,
        fileIdentity: `inode-${index}`, lastPublishedRevisionId: `revision-${index}`,
        lastFingerprint: await sha256Fingerprint(bytes), lastObservedSnapshot: observed,
        state: "linked", recordVersion: 0,
      });
    }
    await persistence.transaction(async tx => {
      for (const mapping of initialMappings) expect(await tx.compareAndSwapMapping(null, mapping)).toBe(true);
    });

    const reads: string[] = [];
    const adapter = memoryAdapter(files, reads);
    const notices: SchedulerNotice[] = [];
    const scheduler = new SourceSyncScheduler(adapter, persistence, {
      stability: { debounceMs: 0, stableIntervalMs: 0, requiredStableSamples: 2 },
      sleep: async () => undefined, now: () => 100, maxConcurrentPaths: 2,
      contentScrubEveryReconciliations: 1, contentScrubBatchSize: 2,
      onNotice: notice => notices.push(notice),
    });
    await scheduler.start();
    await scheduler.idle();
    reads.length = 0;
    notices.length = 0;

    const changed = testDocx("new-0");
    expect(changed.byteLength).toBe(files.get("book-0.docx")!.bytes.byteLength);
    files.get("book-0.docx")!.bytes = changed; // snapshot metadata deliberately remains identical.

    for (let pass = 0; pass < 4; pass += 1) {
      await scheduler.reconcileNow();
      await scheduler.idle();
    }
    scheduler.stop();

    const queued = await persistence.transaction(tx => tx.listRunnableOutbox(100, 100));
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ bookId: "book-0", state: "pending" });
    expect(notices.filter(notice => notice.kind === "queued")).toHaveLength(1);
    expect(new Set(reads)).toEqual(new Set(Array.from({ length: 7 }, (_, index) => `book-${index}.docx`)));
    expect(scheduler.backpressureSnapshot()).toMatchObject({
      pendingPaths: 0, activePaths: 0, peakActivePaths: 2,
      reconciliationPasses: 4, scrubSelections: 8,
    });
    for (let index = 1; index < 7; index += 1) {
      expect(await persistence.transaction(tx => tx.getMapping(`mapping-${index}`)))
        .toMatchObject({ recordVersion: 0, state: "linked" });
    }
  });
});

function memoryAdapter(
  files: ReadonlyMap<string, { snapshot: SourceFileSnapshot; bytes: Uint8Array }>,
  reads: string[],
): ManagedSourcePlatformAdapter {
  return {
    capabilities: { recursiveEnumeration: true, nativeWatch: false, durableFileIdentity: true, backgroundExecution: true },
    enumerate: async (): Promise<ObservedManagedSource[]> => [...files.values()]
      .map(entry => ({ logicalPath: entry.snapshot.logicalPath, snapshot: structuredClone(entry.snapshot) })),
    sample: async logicalPath => structuredClone(files.get(logicalPath)?.snapshot ?? null),
    readBytes: async logicalPath => {
      reads.push(logicalPath);
      const bytes = files.get(logicalPath)?.bytes;
      if (bytes === undefined) throw new Error("source-missing");
      return bytes.slice();
    },
    subscribe: async () => () => undefined,
  };
}

function snapshot(path: string, bytes: Uint8Array, fileIdentity: string): SourceFileSnapshot {
  return { logicalPath: path, sizeBytes: bytes.byteLength, modifiedAtMs: 50, fileIdentity };
}

function testDocx(document: string): Uint8Array {
  const entries: Array<[string, string]> = [
    ["[Content_Types].xml", '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ["word/document.xml", document],
  ];
  const encoder = new TextEncoder(); const locals: Uint8Array[] = []; const centrals: Uint8Array[] = [];
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
  for (const value of [...locals, ...centrals]) { result.set(value, offset); offset += value.length; }
  const end = new DataView(result.buffer, offset); end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true); end.setUint32(12, centralSize, true); end.setUint32(16, localOffset, true);
  return result;
}
