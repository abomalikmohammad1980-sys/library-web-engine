import { describe, expect, it } from "vitest";
import { D1SourceRevisionAuthorityStore } from "./d1-authority-store.js";
import type { D1DatabaseBinding } from "./bindings.js";

describe("D1 authority CAS statements", () => {
  it("uses ownership-scoped reads and INSERT OR IGNORE uniqueness gates", async () => {
    const sql: string[] = [];
    const db: D1DatabaseBinding = { prepare(statement) { sql.push(statement); return {
      bind() { return this; }, first: async () => ({ owned: 1 }), all: async () => ({ success: true, results: [] }), run: async () => ({ success: true, meta: { changes: 1 } }),
    }; } };
    const store = new D1SourceRevisionAuthorityStore(db);
    await store.transaction(async (tx) => {
      expect(await tx.isBookOwner("book", "user")).toBe(true);
      expect(await tx.createUpload({ uploadId:"u",operationId:"o",ownerId:"user",bookId:"book",objectKey:"staging/source/u",expectedFingerprint:{algorithm:"sha256",hex:"a".repeat(64),byteLength:3},baseRevisionId:null,sourceName:"b.docx",deviceId:"d",expiresAt:"2030-01-01T00:00:00Z" })).toBe(true);
    });
    expect(sql[0]).toContain("owner_id = ?2");
    expect(sql[1]).toContain("INSERT OR IGNORE");
  });

  it("repairs finalized upload and reserved usage idempotently after a dropped response", async () => {
    const sql: string[] = [];
    let reservation = "reserved";
    let finalized: string | null = null;
    let committedBytes = 0;
    let auditEvents = 0;
    let buildRows = 0;
    const revisionRow = {id:"revision-1",book_id:"book",operation_id:"operation",base_revision_id:null,sha256:"a".repeat(64),byte_length:7,source_name:"book.docx",created_at:"2026-08-09T00:00:00Z",created_by_device_id:"device",status:"uploaded"};
    const db: D1DatabaseBinding = { prepare(statement) { sql.push(statement); return {
      bind(...values: unknown[]) { (this as {values?:unknown[]}).values=values; return this; },
      first: async () => {
        if (statement.startsWith("SELECT id FROM source_uploads")) return {id:"upload-1"};
        if (statement.startsWith("SELECT * FROM book_source_revisions")) return revisionRow;
        if (statement.startsWith("UPDATE usage_reservations") && reservation === "reserved") { reservation="committed"; return {principal_sub:"owner",byte_length:7}; }
        return null;
      },
      all: async () => ({success:true,results:[]}),
      run: async () => {
        if (statement.startsWith("UPDATE source_uploads")) finalized="revision-1";
        if (statement.startsWith("UPDATE account_usage")) committedBytes=7;
        if (statement.startsWith("INSERT INTO audit_events")) auditEvents++;
        if (statement.startsWith("INSERT OR IGNORE INTO book_builds")) buildRows++;
        return {success:true,meta:{changes:1}};
      },
    }; } };
    const store = new D1SourceRevisionAuthorityStore(db);
    await store.transaction(tx => tx.reconcileCompletedUpload!("book","operation","revision-1"));
    await store.transaction(tx => tx.reconcileCompletedUpload!("book","operation","revision-1"));
    expect({finalized,reservation,committedBytes}).toEqual({finalized:"revision-1",reservation:"committed",committedBytes:7});
    expect(sql.filter(statement => statement.startsWith("UPDATE account_usage"))).toHaveLength(1);
    expect(auditEvents).toBe(1);
    expect(buildRows).toBe(2);
    expect(sql.filter(statement => statement.startsWith("INSERT OR IGNORE INTO build_jobs"))).toHaveLength(10);
    expect(sql.find(statement => statement.startsWith("SELECT * FROM book_source_revisions"))).toContain("id=?1 AND book_id=?2 AND operation_id=?3");
    expect(sql.some(statement => statement.includes("COALESCE(finalized_revision_id"))).toBe(true);
  });
});
