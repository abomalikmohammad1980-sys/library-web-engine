import { describe, expect, it, vi } from "vitest";
import type { D1DatabaseBinding, D1PreparedStatementBinding, D1Result } from "./bindings.js";
import { D1ConflictResolutionStore } from "./d1-conflict-resolution-store.js";

describe("D1 conflict resolution store", () => {
  it("commits keepRemote through the migration CAS gate and metadata-only audit", async () => {
    const harness = db(); const store = new D1ConflictResolutionStore(harness.binding);
    await expect(store.commit(input("keepRemote"))).resolves.toMatchObject({ status: "archived", targetBookId: "book", recordVersion: 5 });
    const sql = harness.sql.join(" "); expect(sql).toContain("INSERT INTO source_conflict_resolutions"); expect(sql).toContain("status='rejected'"); expect(sql).toContain("record_version=record_version+1");
    expect(sql).toContain("source_conflict_resolution"); expect(sql).not.toMatch(/sha256|immutable_object_key|source_name/);
  });

  it("publishes or queues keepLocal according to derivative readiness", async () => {
    const ready = db(); const readyStore = new D1ConflictResolutionStore(ready.binding);
    await expect(readyStore.commit({ ...input("keepLocal"), readyBuildId: "ready-build" })).resolves.toMatchObject({ status: "published" });
    expect(ready.sql.join(" ")).toContain("active_source_revision_id=?2");
    const queued = db(); const queuedStore = new D1ConflictResolutionStore(queued.binding);
    await expect(queuedStore.commit(input("keepLocal"))).resolves.toMatchObject({ status: "queued" });
    expect(queued.sql.join(" ")).toContain("desired_source_revision_id=?2");
  });

  it("creates an isolated book/revision/publication and five build jobs for createCopy", async () => {
    const harness = db(); const store = new D1ConflictResolutionStore(harness.binding, { book: () => "copy-book", revision: () => "copy-revision" });
    await expect(store.commit(input("createCopy"))).resolves.toMatchObject({ status: "queued", targetBookId: "copy-book", targetRevisionId: "copy-revision" });
    const batch = harness.batches[0] ?? []; const sql = batch.map((statement) => harness.sqlByStatement.get(statement)).join(" ");
    expect(sql).toContain("INSERT INTO books"); expect(sql).toContain("INSERT INTO book_source_revisions"); expect(sql).toContain("INSERT INTO book_publications");
    expect((sql.match(/INSERT INTO build_jobs/g) ?? [])).toHaveLength(5); expect(sql).toContain("immutable_object_key FROM book_source_revisions");
  });

  it("fails closed without a transactional D1 batch", async () => {
    const harness = db(); delete (harness.binding as { batch?: unknown }).batch;
    await expect(new D1ConflictResolutionStore(harness.binding).commit(input("keepRemote"))).rejects.toThrow(/transactional batch/);
  });
});

function input(resolution: "keepLocal" | "keepRemote" | "createCopy") { return { operationId: "resolve", deviceId: "device", conflictingRevisionId: "conflict", expectedPublicationVersion: 4, resolution, bookId: "book", userId: "owner", readyBuildId: null, activeRevisionId: "active" }; }
function db() {
  const sql: string[] = []; const sqlByStatement = new Map<D1PreparedStatementBinding, string>(); const batches: D1PreparedStatementBinding[][] = [];
  const binding: D1DatabaseBinding = { prepare(text) { sql.push(text); const statement: D1PreparedStatementBinding = { bind() { return statement; }, first: async () => null, all: async () => ({ success: true, results: [] }), run: async () => ({ success: true, meta: { changes: 1 } }) }; sqlByStatement.set(statement, text); return statement; }, batch: vi.fn(async (statements) => { batches.push([...statements]); return statements.map(() => ({ success: true, meta: { changes: 1 } }) as D1Result); }) };
  return { binding, sql, sqlByStatement, batches };
}
