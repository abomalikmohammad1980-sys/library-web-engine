import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import type { ManagedSourceMapping, SourceSyncOperation } from "@library/source-sync";
import { JsonSourceSyncPersistence } from "./json-source-sync-persistence.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

async function store(): Promise<{ file: string; persistence: JsonSourceSyncPersistence }> {
  const root = await mkdtemp(join(tmpdir(), "khizana-sync-store-"));
  roots.push(root);
  const file = join(root, "source-sync.json");
  return { file, persistence: new JsonSourceSyncPersistence(file) };
}

const mapping: ManagedSourceMapping = {
  mappingId: "mapping-1",
  bookId: "book-1",
  logicalPath: "book.docx",
  lastPublishedRevisionId: null,
  lastFingerprint: null,
  lastObservedSnapshot: null,
  state: "linked",
  recordVersion: 0,
};

const operation: SourceSyncOperation = {
  operationId: "operation-1",
  kind: "source-revision.upload",
  bookId: "book-1",
  payloadDigest: "digest-1",
  payload: { revisionId: "revision-1" },
  state: "pending",
  attempt: 0,
  createdAtMs: 10,
  nextAttemptAtMs: 10,
  leaseId: null,
  leaseUntilMs: null,
  lastErrorCode: null,
  recordVersion: 0,
};

describe("JSON source-sync persistence", () => {
  it("survives restart and applies compare-and-swap", async () => {
    const { file, persistence } = await store();
    await persistence.transaction(async (tx) => {
      expect(await tx.compareAndSwapMapping(null, mapping)).toBe(true);
      expect(await tx.compareAndSwapOutbox(null, operation)).toBe(true);
    });
    const reopened = new JsonSourceSyncPersistence(file);
    await reopened.transaction(async (tx) => {
      expect(await tx.getMapping("mapping-1")).toEqual(mapping);
      expect(await tx.listRunnableOutbox(10, 10)).toEqual([operation]);
      expect(await tx.compareAndSwapMapping(null, mapping)).toBe(false);
      expect(await tx.compareAndSwapMapping(0, { ...mapping, recordVersion: 1 })).toBe(true);
    });
  });

  it("does not commit a failed transaction", async () => {
    const { file, persistence } = await store();
    await expect(persistence.transaction(async (tx) => {
      await tx.compareAndSwapMapping(null, mapping);
      throw new Error("abort");
    })).rejects.toThrow("abort");
    const reopened = new JsonSourceSyncPersistence(file);
    await reopened.transaction(async (tx) => expect(await tx.listMappings()).toEqual([]));
  });

  it("serializes concurrent transactions across instances sharing one state path", async () => {
    const { file, persistence } = await store();
    const secondInstance = new JsonSourceSyncPersistence(file);
    await Promise.all([
      persistence.transaction(async (tx) => { await tx.compareAndSwapMapping(null, mapping); }),
      secondInstance.transaction(async (tx) => {
        await tx.compareAndSwapMapping(null, { ...mapping, mappingId: "mapping-2", logicalPath: "two.docx" });
      }),
    ]);
    await persistence.transaction(async (tx) => expect(await tx.listMappings()).toHaveLength(2));
  });

  it("ignores an orphan temporary write and recovers a stale process lock", async () => {
    const { file, persistence } = await store();
    await persistence.transaction(async (tx) => { await tx.compareAndSwapMapping(null, mapping); });
    const committed = await readFile(file, "utf8");
    await writeFile(`${file}.tmp-crashed`, "{partial");
    await writeFile(`${file}.lock`, JSON.stringify({ pid: 999_999_999, createdAtMs: 1 }));
    const restarted = new JsonSourceSyncPersistence(file, { pidIsAlive: () => false });
    await restarted.transaction(async (tx) => expect(await tx.getMapping(mapping.mappingId)).toEqual(mapping));
    expect(await readFile(file, "utf8")).toBe(committed);
  });

  it("fails closed on partial state and corrupt or live locks", async () => {
    const { file } = await store();
    await writeFile(file, "{partial");
    await expect(new JsonSourceSyncPersistence(file).transaction(async () => undefined)).rejects.toBeInstanceOf(SyntaxError);
    await writeFile(file, JSON.stringify({ schemaVersion: 1, mappings: {}, outbox: {}, builds: {}, activeBuildByBook: {} }));
    await writeFile(`${file}.lock`, "not-json");
    let corruptClock = 0;
    await expect(new JsonSourceSyncPersistence(file, { lockTimeoutMs: 2, lockRetryMs: 1, now: () => corruptClock++ }).transaction(async () => undefined)).rejects.toThrow("Corrupt source-sync state lock");
    await writeFile(`${file}.lock`, JSON.stringify({ pid: process.pid, createdAtMs: 1 }));
    let clock = 0;
    await expect(new JsonSourceSyncPersistence(file, { lockTimeoutMs: 2, lockRetryMs: 1, now: () => clock++, pidIsAlive: () => true }).transaction(async () => undefined)).rejects.toThrow("Timed out waiting");
  });

  it("serializes two operating-system processes on one state path without lost records", async () => {
    const { file } = await store();
    const source = await readFile(new URL("./json-source-sync-persistence.ts", import.meta.url), "utf8");
    const modulePath = join(dirname(file), "persistence-under-test.mjs");
    await writeFile(modulePath, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
    const moduleUrl = pathToFileURL(modulePath).href;
    const run = (id: string) => new Promise<void>((resolveChild, rejectChild) => {
      const script = `import {JsonSourceSyncPersistence as P} from ${JSON.stringify(moduleUrl)};const p=new P(${JSON.stringify(file)});await p.transaction(async tx=>{await new Promise(r=>setTimeout(r,50));if(!await tx.compareAndSwapMapping(null,{mappingId:${JSON.stringify(id)},bookId:${JSON.stringify(id)},logicalPath:${JSON.stringify(`${id}.docx`)},lastPublishedRevisionId:null,lastFingerprint:null,lastObservedSnapshot:null,state:"linked",recordVersion:0}))throw Error("CAS");});`;
      const child = spawn(process.execPath, ["--input-type=module", "--eval", script], { stdio: "pipe" });
      let stderr = ""; child.stderr.on("data", chunk => { stderr += String(chunk); });
      child.once("error", rejectChild); child.once("exit", code => code === 0 ? resolveChild() : rejectChild(new Error(stderr || `child exited ${code}`)));
    });
    await Promise.all([run("process-a"), run("process-b")]);
    const restarted = new JsonSourceSyncPersistence(file);
    await restarted.transaction(async tx => expect((await tx.listMappings()).map(item => item.mappingId).sort()).toEqual(["process-a", "process-b"]));
  });

  it("selects a bounded runnable batch fairly before a hot book can hide cold books", async () => {
    const { persistence } = await store();
    await persistence.transaction(async tx => {
      for (let index = 0; index < 1_000; index += 1) {
        await tx.compareAndSwapOutbox(null, {
          ...operation,
          operationId: `hot:${index}`,
          bookId: "hot",
          payloadDigest: `hot:${index}`,
          createdAtMs: index,
        });
      }
      for (const [index, bookId] of ["cold-a", "cold-b", "cold-c"].entries()) {
        await tx.compareAndSwapOutbox(null, {
          ...operation,
          operationId: `${bookId}:0`,
          bookId,
          payloadDigest: bookId,
          createdAtMs: 10_000 + index,
        });
      }
    });
    const batch = await persistence.transaction(tx => tx.listRunnableOutbox(20_000, 4));
    expect(batch.map(item => item.bookId)).toEqual(["hot", "cold-a", "cold-b", "cold-c"]);
    expect(batch[0]?.operationId).toBe("hot:0");
  });
});
