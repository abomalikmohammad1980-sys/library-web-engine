import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { reconcileManagedSources, type ManagedSourceMapping, type RawSourceWatchEvent } from "@library/source-sync";
import {
  diffObserved,
  NodeManagedSourceAdapter,
  type NodeManagedSourceIo,
} from "./node-managed-source-adapter.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "khizana-source-sync-"));
  roots.push(root);
  return root;
}

describe("Node managed source adapter — real directory", () => {
  it("enumerates nested DOCX only and reads/samples real bytes", async () => {
    const root = await tempRoot();
    await mkdir(join(root, "nested"));
    await writeFile(join(root, "nested", "book.docx"), "docx bytes");
    await writeFile(join(root, "ignored.txt"), "ignored");
    const adapter = new NodeManagedSourceAdapter(root);

    const entries = await adapter.enumerate();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.logicalPath).toBe("nested/book.docx");
    expect(entries[0]?.snapshot.sizeBytes).toBe(10);
    expect(entries[0]?.snapshot.fileIdentity).toMatch(/^\d+:\d+$/);
    expect(new TextDecoder().decode(await adapter.readBytes("nested/book.docx"))).toBe("docx bytes");
    expect(await adapter.sample("missing.docx")).toBeNull();
  });

  it("startup reconciliation recovers a rename by the real file identity", async () => {
    const root = await tempRoot();
    await writeFile(join(root, "book.docx"), "docx bytes");
    const adapter = new NodeManagedSourceAdapter(root);
    const before = (await adapter.enumerate())[0]!;
    const mapping: ManagedSourceMapping = {
      mappingId: "mapping-1",
      bookId: "book-1",
      logicalPath: before.logicalPath,
      ...(before.snapshot.fileIdentity === undefined ? {} : { fileIdentity: before.snapshot.fileIdentity }),
      lastPublishedRevisionId: null,
      lastFingerprint: null,
      lastObservedSnapshot: before.snapshot,
      state: "linked",
      recordVersion: 0,
    };
    await rename(join(root, "book.docx"), join(root, "renamed.docx"));
    const result = reconcileManagedSources([mapping], await adapter.enumerate());
    expect(result.actions).toContainEqual({
      kind: "source-moved",
      mappingId: "mapping-1",
      fromLogicalPath: "book.docx",
      toLogicalPath: "renamed.docx",
    });
  });

  it("normalizes a real temp-file replacement into one replaced event", async () => {
    const root = await tempRoot();
    await writeFile(join(root, "book.docx"), "old bytes");
    const adapter = new NodeManagedSourceAdapter(root, {
      debounceMs: 10,
      pollIntervalMs: 20,
      now: () => 123,
    });
    const events: RawSourceWatchEvent[] = [];
    const close = await adapter.subscribe((event) => events.push(event));
    try {
      await writeFile(join(root, "book.tmp"), "new source bytes");
      await rename(join(root, "book.docx"), join(root, "book.bak"));
      await rename(join(root, "book.tmp"), join(root, "book.docx"));
      await waitFor(() => events.some((event) => event.kind === "replaced"), 3_000);
      expect(events.filter((event) => event.path === "book.docx")).toEqual([
        expect.objectContaining({ kind: "replaced", path: "book.docx", observedAtMs: 123 }),
      ]);
      expect(new TextDecoder().decode(await adapter.readBytes("book.docx"))).toBe("new source bytes");
    } finally {
      close();
    }
  });
});

describe("Node managed source adapter — injected I/O boundary", () => {
  it("uses the injected low-level I/O without requiring a backend", async () => {
    const io: NodeManagedSourceIo = {
      async listRelativeFiles() { return ["book.docx"]; },
      async stat() { return { sizeBytes: 3, modifiedAtMs: 7, fileIdentity: "dev:ino", isFile: true }; },
      async read() { return new Uint8Array([1, 2, 3]); },
      watchRecursive() { return () => undefined; },
    };
    const adapter = new NodeManagedSourceAdapter("managed-root", { io });
    expect(await adapter.enumerate()).toEqual([{
      logicalPath: "book.docx",
      snapshot: {
        logicalPath: "book.docx",
        sizeBytes: 3,
        modifiedAtMs: 7,
        fileIdentity: "dev:ino",
      },
    }]);
    expect(await adapter.readBytes("book.docx")).toEqual(new Uint8Array([1, 2, 3]));
  });
});

describe("diffObserved", () => {
  it("distinguishes in-place modification, rename, and same-path replacement", () => {
    const entry = (path: string, identity: string, size: number) => ({
      logicalPath: path,
      snapshot: { logicalPath: path, sizeBytes: size, modifiedAtMs: size, fileIdentity: identity },
    });
    const previous = new Map([
      ["modify.docx", entry("modify.docx", "id-1", 1)],
      ["old.docx", entry("old.docx", "id-2", 1)],
      ["replace.docx", entry("replace.docx", "id-old", 1)],
    ]);
    const current = new Map([
      ["modify.docx", entry("modify.docx", "id-1", 2)],
      ["new.docx", entry("new.docx", "id-2", 1)],
      ["replace.docx", entry("replace.docx", "id-new", 2)],
    ]);
    expect(diffObserved(previous, current, 50)).toEqual([
      { kind: "modified", path: "modify.docx", observedAtMs: 50, fileIdentity: "id-1" },
      { kind: "renamed", previousPath: "old.docx", path: "new.docx", observedAtMs: 50, fileIdentity: "id-2" },
      { kind: "replaced", path: "replace.docx", observedAtMs: 50, fileIdentity: "id-new" },
    ]);
  });
});

async function waitFor(condition: () => boolean, timeoutMs: number): Promise<void> {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeoutMs) throw new Error("Timed out waiting for filesystem event");
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }
}
