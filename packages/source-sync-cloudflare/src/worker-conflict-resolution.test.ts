import { describe, expect, it } from "vitest";
import { createBoundSourceSyncWorker } from "./worker.js";
import type { D1DatabaseBinding, D1PreparedStatementBinding, SourceSyncCloudflareEnv } from "./bindings.js";

describe("bound worker conflict resolution route", () => {
  it("routes an authenticated user intent through device, revision, and D1 CAS authority", async () => {
    const env = fixture();
    const worker = createBoundSourceSyncWorker({ identity: { verifyBearer: async (token) => ({ kind: "account", userId: token }) }, inspection: { inspect: async () => ({ kind: "accepted" }) }, ids: { uploadId: () => "upload", revisionId: () => "revision" } });
    const response = await worker.fetch(new Request("https://sync/books/book/source-revisions/resolve-conflict", { method: "POST", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify({ operationId: "resolve", deviceId: "device", conflictingRevisionId: "conflict", expectedPublicationVersion: 4, resolution: "keepRemote" }) }), env);
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ resolution: "keepRemote", status: "archived", targetRevisionId: "active" });
    expect(env.statements.join(" ")).toContain("source_conflict_resolutions");
  });
});

function fixture(): SourceSyncCloudflareEnv & { statements: string[] } {
  const statements: string[] = [];
  const db: D1DatabaseBinding = { prepare(sql) { statements.push(sql); let values: unknown[] = []; const statement: D1PreparedStatementBinding = { bind(...next) { values = next; return statement; }, first: async () => { if (sql.includes("FROM devices")) return { active: 1 }; if (sql.includes("SELECT 1 AS owned") || sql.includes("SELECT 1 FROM books")) return values[1] === "owner" ? { owned: 1 } : null; if (sql.includes("FROM source_conflict_resolutions")) return null; if (sql.includes("FROM book_publications")) return { active_source_revision_id: "active", active_build_id: "build", desired_source_revision_id: null, record_version: 4 }; return null; }, all: async () => ({ success: true, results: sql.includes("FROM book_source_revisions") ? [{ id: "conflict", book_id: "book", operation_id: "upload", base_revision_id: "base", sha256: "a".repeat(64), byte_length: 1, source_name: "book.docx", created_at: "now", created_by_device_id: "device", status: "conflicted" }] : [] }), run: async () => ({ success: true, meta: { changes: 1 } }) }; return statement; }, batch: async (batch) => Promise.all(batch.map((statement) => statement.run())) };
  const bucket = { head: async () => null, get: async () => null, put: async () => null, delete: async () => undefined };
  return { DB: db, SOURCE_OBJECTS: bucket, SOURCE_UPLOAD_SIGNING_KEY: "secret", SOURCE_SYNC_PUBLIC_BASE_URL: "https://sync.example", BUILD_SERVICE_TOKEN_CURRENT: "service", statements };
}
