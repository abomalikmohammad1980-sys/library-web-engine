import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rename, rm, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sha256Fingerprint, type ManagedSourceMapping, type ManagedSourcePlatformAdapter, type SourceSyncOperation } from "@library/source-sync";
import { JsonSourceSyncPersistence } from "./json-source-sync-persistence.js";
import { NodeManagedSourceAdapter, type NodeManagedSourceIo } from "./node-managed-source-adapter.js";
import { SourceSyncScheduler, type SchedulerNotice } from "./source-sync-scheduler.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

async function fixture(): Promise<{
  root: string;
  file: string;
  adapter: NodeManagedSourceAdapter;
  persistence: JsonSourceSyncPersistence;
}> {
  const root = await mkdtemp(join(tmpdir(), "khizana-sync-e2e-"));
  roots.push(root);
  await writeFile(join(root, "book.docx"), testDocx("document source"));
  const adapter = new NodeManagedSourceAdapter(root);
  const file = join(root, ".state", "source-sync.json");
  const persistence = new JsonSourceSyncPersistence(file);
  const snapshot = (await adapter.sample("book.docx"))!;
  const mapping: ManagedSourceMapping = {
    mappingId: "mapping-1",
    bookId: "book-1",
    logicalPath: "book.docx",
    ...(snapshot.fileIdentity === undefined ? {} : { fileIdentity: snapshot.fileIdentity }),
    lastPublishedRevisionId: null,
    lastFingerprint: null,
    lastObservedSnapshot: null,
    state: "linked",
    recordVersion: 0,
  };
  await persistence.transaction(async (tx) => { await tx.compareAndSwapMapping(null, mapping); });
  return { root, file, adapter, persistence };
}

describe("source-sync scheduler", () => {
  it("queues a real directory revision durably and replays idempotently after restart", async () => {
    const { file, adapter, persistence } = await fixture();
    const notices: SchedulerNotice[] = [];
    const scheduler = new SourceSyncScheduler(adapter, persistence, {
      stability: { debounceMs: 0, stableIntervalMs: 0, requiredStableSamples: 2 },
      sleep: async () => undefined,
      now: () => 100,
      onNotice: (notice) => notices.push(notice),
    });
    await scheduler.syncPathNow("book.docx");
    const reopened = new JsonSourceSyncPersistence(file);
    const first = await reopened.transaction((tx) => tx.listRunnableOutbox(100, 10));
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ kind: "source-revision.upload", state: "pending", bookId: "book-1" });

    const restarted = new SourceSyncScheduler(adapter, reopened, {
      stability: { debounceMs: 0, stableIntervalMs: 0, requiredStableSamples: 2 },
      sleep: async () => undefined,
      now: () => 100,
      onNotice: (notice) => notices.push(notice),
    });
    await restarted.syncPathNow("book.docx");
    expect(await reopened.transaction((tx) => tx.listRunnableOutbox(100, 10))).toHaveLength(1);
    expect(notices.map((notice) => notice.kind)).toEqual(["queued", "replayed"]);
  });

  it("reconciles a save missed while stopped and queues it on startup", async () => {
    const { adapter, persistence, root } = await fixture();
    await writeFile(join(root, "book.docx"), testDocx("document source changed"));
    const notices: SchedulerNotice[] = [];
    const scheduler = new SourceSyncScheduler(adapter, persistence, {
      stability: { debounceMs: 0, stableIntervalMs: 0, requiredStableSamples: 2 },
      sleep: async () => undefined,
      now: () => 200,
      onNotice: (notice) => notices.push(notice),
    });
    await scheduler.start();
    await scheduler.idle();
    scheduler.stop();
    const queued = await persistence.transaction((tx) => tx.listRunnableOutbox(200, 10));
    expect(queued).toHaveLength(1);
    expect(queued[0]?.payload).toMatchObject({ logicalPath: "book.docx" });
    expect(notices.some((notice) => notice.kind === "queued")).toBe(true);
  });

  it("reconciles a rename missed while stopped without losing the book mapping", async () => {
    const { adapter, persistence, root } = await fixture();
    await rename(join(root, "book.docx"), join(root, "renamed.docx"));
    const notices: SchedulerNotice[] = [];
    const scheduler = new SourceSyncScheduler(adapter, persistence, {
      stability: { debounceMs: 0, stableIntervalMs: 0, requiredStableSamples: 2 },
      sleep: async () => undefined,
      now: () => 300,
      onNotice: (notice) => notices.push(notice),
    });
    await scheduler.start();
    await scheduler.idle();
    scheduler.stop();
    const mapping = await persistence.transaction((tx) => tx.getMapping("mapping-1"));
    expect(mapping).toMatchObject({ bookId: "book-1", logicalPath: "renamed.docx", state: "linked" });
    expect(notices).toContainEqual({
      kind: "source-moved",
      mappingId: "mapping-1",
      fromLogicalPath: "book.docx",
      toLogicalPath: "renamed.docx",
    });
    expect((await persistence.transaction((tx) => tx.listRunnableOutbox(300, 10)))).toHaveLength(1);
  });

  it("quarantines an operation-id conflict instead of overwriting durable work", async () => {
    const { adapter, persistence } = await fixture();
    const fingerprint = await sha256Fingerprint(testDocx("document source"));
    const operationId = ["source", "mapping-1", "none", fingerprint.hex].join(":");
    const conflict: SourceSyncOperation = {
      operationId,
      kind: "source-revision.upload",
      bookId: "book-1",
      payloadDigest: "different-content",
      payload: {},
      state: "pending",
      attempt: 0,
      createdAtMs: 1,
      nextAttemptAtMs: 1,
      leaseId: null,
      leaseUntilMs: null,
      lastErrorCode: null,
      recordVersion: 0,
    };
    await persistence.transaction(async (tx) => { await tx.compareAndSwapOutbox(null, conflict); });
    const notices: SchedulerNotice[] = [];
    const scheduler = new SourceSyncScheduler(adapter, persistence, {
      stability: { debounceMs: 0, stableIntervalMs: 0, requiredStableSamples: 2 },
      sleep: async () => undefined,
      now: () => 100,
      onNotice: (notice) => notices.push(notice),
    });
    await scheduler.syncPathNow("book.docx");
    expect(notices.at(-1)).toMatchObject({ kind: "quarantined", mappingId: "mapping-1" });
    expect((await persistence.transaction((tx) => tx.getMapping("mapping-1")))?.state).toBe("needs-review");
    expect((await persistence.transaction((tx) => tx.getOutboxOperation(operationId)))?.payloadDigest)
      .toBe("different-content");
  });

  it("does not collapse different bytes when an atomic replacement preserves file metadata", async () => {
    const { root, persistence } = await fixture();
    let contents = testDocx("first-version!!");
    const io: NodeManagedSourceIo = {
      async listRelativeFiles() { return ["book.docx"]; },
      async stat() {
        return { sizeBytes: contents.byteLength, modifiedAtMs: 50, fileIdentity: "stable-id", isFile: true };
      },
      async read() { return contents; },
      watchRecursive() { return () => undefined; },
    };
    const scheduler = new SourceSyncScheduler(new NodeManagedSourceAdapter(root, { io }), persistence, {
      stability: { debounceMs: 0, stableIntervalMs: 0, requiredStableSamples: 2 },
      sleep: async () => undefined,
      now: () => 100,
    });
    await scheduler.syncPathNow("book.docx");
    contents = testDocx("second-version!");
    await scheduler.syncPathNow("book.docx", "replace");
    expect(await persistence.transaction((tx) => tx.listRunnableOutbox(100, 10))).toHaveLength(2);
  });

  it("marks a mapped source for review when it disappears before preparation", async () => {
    const { root, persistence } = await fixture();
    const io: NodeManagedSourceIo = {
      async listRelativeFiles() { return []; },
      async stat() { return null; },
      async read() { throw new Error("must not read a missing source"); },
      watchRecursive() { return () => undefined; },
    };
    const notices: SchedulerNotice[] = [];
    const scheduler = new SourceSyncScheduler(new NodeManagedSourceAdapter(root, { io }), persistence, {
      stability: { debounceMs: 0, stableIntervalMs: 0, requiredStableSamples: 2 },
      sleep: async () => undefined,
      onNotice: (notice) => notices.push(notice),
    });
    await scheduler.syncPathNow("book.docx");
    expect((await persistence.transaction((tx) => tx.getMapping("mapping-1")))?.state).toBe("needs-review");
    expect(notices.at(-1)).toMatchObject({ kind: "quarantined", reason: "source-missing" });
  });

  it("persists a watcher deletion as missing without deleting the book or queuing work", async () => {
    const { root, persistence, adapter } = await fixture();
    const notices: SchedulerNotice[] = [];
    const scheduler = new SourceSyncScheduler(adapter, persistence, {
      stability: { debounceMs: 0, stableIntervalMs: 0, requiredStableSamples: 2 },
      sleep: async () => undefined,
      onNotice: (notice) => notices.push(notice),
    });
    await unlink(join(root, "book.docx"));
    await scheduler.handleRawEvent({ kind: "deleted", path: "book.docx", observedAtMs: 100 });
    expect(await persistence.transaction((tx) => tx.getMapping("mapping-1"))).toMatchObject({
      bookId: "book-1",
      logicalPath: "book.docx",
      state: "missing",
      recordVersion: 1,
    });
    expect(notices).toEqual([{
      kind: "source-missing",
      mappingId: "mapping-1",
      logicalPath: "book.docx",
    }]);
    expect(await persistence.transaction((tx) => tx.listRunnableOutbox(100, 10))).toEqual([]);
  });

  it("quarantines a file that changes during preparation and does not queue it", async () => {
    const { root, persistence } = await fixture();
    let sampleCount = 0;
    const io: NodeManagedSourceIo = {
      async listRelativeFiles() { return ["book.docx"]; },
      async stat() {
        sampleCount += 1;
        return { sizeBytes: sampleCount > 2 ? 16 : 15, modifiedAtMs: sampleCount, fileIdentity: "id", isFile: true };
      },
      async read() { return new TextEncoder().encode("document source"); },
      watchRecursive() { return () => undefined; },
    };
    const adapter = new NodeManagedSourceAdapter(root, { io });
    const notices: SchedulerNotice[] = [];
    const scheduler = new SourceSyncScheduler(adapter, persistence, {
      stability: { debounceMs: 0, stableIntervalMs: 0, requiredStableSamples: 2 },
      sleep: async () => undefined,
      now: () => 100,
      onNotice: (notice) => notices.push(notice),
    });
    await scheduler.syncPathNow("book.docx");
    expect(notices.at(-1)?.kind).toBe("quarantined");
    expect(await persistence.transaction((tx) => tx.listRunnableOutbox(100, 10))).toEqual([]);
  });

  it("coalesces ten thousand save notifications to bounded work for the latest path",async()=>{
    const {adapter,persistence}=await fixture();const notices:SchedulerNotice[]=[];
    const scheduler=new SourceSyncScheduler(adapter,persistence,{stability:{debounceMs:0,stableIntervalMs:0,requiredStableSamples:2},sleep:async()=>undefined,now:()=>100,onNotice:n=>notices.push(n),maxConcurrentPaths:2});
    await Promise.all(Array.from({length:10_000},(_,i)=>scheduler.handleRawEvent({kind:"modified",path:"book.docx",observedAtMs:i})));
    await scheduler.idle();const pressure=scheduler.backpressureSnapshot();
    expect(pressure).toMatchObject({pendingPaths:0,activePaths:0,peakActivePaths:1,peakPendingPaths:1});
    expect(pressure.coalescedEvents).toBeGreaterThanOrEqual(9_998);
    expect(notices.filter(n=>n.kind==="queued"||n.kind==="replayed").length).toBeLessThanOrEqual(2);
    expect(await persistence.transaction(tx=>tx.listRunnableOutbox(100,10))).toHaveLength(1);
  });

  it("bounds concurrent guarded reads and gives every queued book a turn",async()=>{
    const {root,persistence}=await fixture();const paths=Array.from({length:12},(_,i)=>`book-${i}.docx`);
    for(let i=0;i<paths.length;i++){const path=paths[i]!;await writeFile(join(root,path),testDocx(`book ${i}`));await persistence.transaction(tx=>tx.compareAndSwapMapping(null,{mappingId:`stress-mapping-${i}`,bookId:`stress-book-${i}`,logicalPath:path,lastPublishedRevisionId:null,lastFingerprint:null,lastObservedSnapshot:null,state:"linked",recordVersion:0}))}
    let entered=0,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve});let allSlots!:()=>void;const slots=new Promise<void>(resolve=>{allSlots=resolve});
    const notices:SchedulerNotice[]=[];const scheduler=new SourceSyncScheduler(new NodeManagedSourceAdapter(root),persistence,{stability:{debounceMs:0,stableIntervalMs:0,requiredStableSamples:2},sleep:async()=>{entered++;if(entered===3)allSlots();await gate},now:()=>100,maxConcurrentPaths:3,onNotice:n=>notices.push(n)});
    await Promise.all(paths.map((path,i)=>scheduler.handleRawEvent({kind:"modified",path,observedAtMs:i})));
    await allSlots;expect(scheduler.backpressureSnapshot()).toMatchObject({activePaths:3,peakActivePaths:3,peakPendingPaths:9});
    release();await scheduler.idle();expect(scheduler.backpressureSnapshot()).toMatchObject({activePaths:0,pendingPaths:0,peakActivePaths:3});
    expect(notices.filter(n=>n.kind==="queued").map(n=>n.logicalPath).sort()).toEqual([...paths].sort());
    expect(await persistence.transaction(tx=>tx.listRunnableOutbox(100,100))).toHaveLength(12);
  });

  it("closes a watcher whose subscription finishes after stop",async()=>{
    const {persistence}=await fixture();let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve});let subscribed!:()=>void;const entered=new Promise<void>(resolve=>{subscribed=resolve});const close=vi.fn();
    const adapter={enumerate:async()=>[],sample:async()=>null,readBytes:async()=>new Uint8Array(),subscribe:async()=>{subscribed();await gate;return close}} as ManagedSourcePlatformAdapter;
    const scheduler=new SourceSyncScheduler(adapter,persistence);const starting=scheduler.start();await entered;scheduler.stop();release();await starting;expect(close).toHaveBeenCalledOnce();expect(scheduler.backpressureSnapshot()).toMatchObject({pendingPaths:0,activePaths:0});
  });
});

function testDocx(document: string): Uint8Array {
  const entries: Array<[string, string]> = [["[Content_Types].xml", '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'], ["word/document.xml", document]];
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let localOffset = 0;
  for (const [nameText, contentText] of entries) {
    const name = encoder.encode(nameText);
    const content = encoder.encode(contentText);
    const local = new Uint8Array(30 + name.length + content.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint32(18, content.length, true);
    lv.setUint32(22, content.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30); local.set(content, 30 + name.length); locals.push(local);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint32(20, content.length, true); cv.setUint32(24, content.length, true);
    cv.setUint16(28, name.length, true); cv.setUint32(42, localOffset, true);
    central.set(name, 46); centrals.push(central); localOffset += local.length;
  }
  const centralSize = centrals.reduce((sum, value) => sum + value.length, 0);
  const result = new Uint8Array(localOffset + centralSize + 22);
  let offset = 0;
  for (const part of [...locals, ...centrals]) { result.set(part, offset); offset += part.length; }
  const end = new DataView(result.buffer, offset, 22);
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true); end.setUint32(12, centralSize, true); end.setUint32(16, localOffset, true);
  return result;
}
