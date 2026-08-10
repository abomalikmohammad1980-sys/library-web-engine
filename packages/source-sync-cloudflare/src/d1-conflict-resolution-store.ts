import type { SourceConflictResolution } from "@library/source-sync";
import type { ConflictResolutionStore, StoredConflictResolution } from "../../source-sync-server/src/index.js";
import type { D1DatabaseBinding, D1PreparedStatementBinding } from "./bindings.js";
import { D1RevisionHistoryStore } from "./d1-revision-history-store.js";

type Row = Record<string, unknown>;
export class D1ConflictResolutionStore implements ConflictResolutionStore {
  readonly #history: D1RevisionHistoryStore;
  constructor(private readonly db: D1DatabaseBinding, private readonly ids = { book: () => crypto.randomUUID(), revision: () => crypto.randomUUID() }) {
    this.#history = new D1RevisionHistoryStore(db);
  }
  isOwner(bookId: string, userId: string) { return this.#history.isOwner(bookId, userId); }
  snapshot(bookId: string) { return this.#history.snapshot(bookId); }
  readyBuild(bookId: string, revisionId: string) { return this.#history.readyBuild(bookId, revisionId); }
  enqueue(bookId: string, revisionId: string) { return this.#history.enqueue(bookId, revisionId); }

  async findResolution(bookId: string, operationId: string): Promise<StoredConflictResolution | null> {
    const row = await this.db.prepare("SELECT * FROM source_conflict_resolutions WHERE book_id=?1 AND operation_id=?2")
      .bind(bookId, operationId).first<Row>();
    return row ? resolutionRow(row) : null;
  }

  async commit(input: Parameters<ConflictResolutionStore["commit"]>[0]): Promise<StoredConflictResolution | null> {
    if (!this.db.batch) throw new Error("D1 transactional batch is required for conflict resolution");
    const targetBookId = input.resolution === "createCopy" ? this.ids.book() : input.bookId;
    const targetRevisionId = input.resolution === "createCopy" ? this.ids.revision()
      : input.resolution === "keepRemote" ? input.activeRevisionId ?? input.conflictingRevisionId : input.conflictingRevisionId;
    const status = conflictStatus(input.resolution, input.readyBuildId);
    const nextVersion = input.expectedPublicationVersion + 1;
    const statements: D1PreparedStatementBinding[] = [this.db.prepare(
      "INSERT INTO source_conflict_resolutions (book_id,operation_id,conflicting_revision_id,resolution,requested_by_user_id,requested_by_device_id,expected_publication_version,target_book_id,target_revision_id,status,publication_record_version) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
    ).bind(input.bookId, input.operationId, input.conflictingRevisionId, input.resolution, input.userId, input.deviceId, input.expectedPublicationVersion, targetBookId, targetRevisionId, status, nextVersion)];

    if (input.resolution === "keepRemote") {
      statements.push(
        this.db.prepare("UPDATE book_source_revisions SET status='rejected' WHERE id=?1 AND book_id=?2 AND status='conflicted'").bind(input.conflictingRevisionId, input.bookId),
        publicationVersionBump(this.db, input.bookId, input.expectedPublicationVersion),
      );
    } else if (input.resolution === "keepLocal") {
      statements.push(
        this.db.prepare("UPDATE book_source_revisions SET status=?2 WHERE id=?1 AND book_id=?3 AND status='conflicted'").bind(input.conflictingRevisionId, input.readyBuildId ? "published" : "processing", input.bookId),
        input.readyBuildId
          ? this.db.prepare("UPDATE book_publications SET active_source_revision_id=?2,active_build_id=?3,desired_source_revision_id=NULL,record_version=record_version+1 WHERE book_id=?1 AND record_version=?4").bind(input.bookId, input.conflictingRevisionId, input.readyBuildId, input.expectedPublicationVersion)
          : this.db.prepare("UPDATE book_publications SET desired_source_revision_id=?2,record_version=record_version+1 WHERE book_id=?1 AND record_version=?3").bind(input.bookId, input.conflictingRevisionId, input.expectedPublicationVersion),
      );
    } else {
      const buildId = `build:${targetRevisionId}`;
      const now = new Date().toISOString();
      const manifest = JSON.stringify({ buildId, bookId: targetBookId, sourceRevisionId: targetRevisionId, status: "processing", artifacts: [], createdAt: now });
      statements.push(
        publicationVersionBump(this.db, input.bookId, input.expectedPublicationVersion),
        this.db.prepare("INSERT INTO books (id,owner_id,active_source_revision_id) SELECT ?2,owner_id,NULL FROM books WHERE id=?1").bind(input.bookId, targetBookId),
        this.db.prepare("INSERT INTO book_source_revisions (id,book_id,operation_id,base_revision_id,sha256,byte_length,source_name,created_at,created_by_device_id,status,immutable_object_key) SELECT ?2,?3,?4,NULL,sha256,byte_length,source_name,?5,?6,'processing',immutable_object_key FROM book_source_revisions WHERE id=?1 AND book_id=?7").bind(input.conflictingRevisionId, targetRevisionId, targetBookId, `copy:${input.operationId}`, now, input.deviceId, input.bookId),
        this.db.prepare("INSERT INTO book_publications (book_id,active_build_id,active_source_revision_id,record_version,desired_source_revision_id) VALUES (?1,NULL,NULL,0,?2)").bind(targetBookId, targetRevisionId),
        this.db.prepare("INSERT INTO book_builds (id,book_id,source_revision_id,status,manifest_json,created_at) VALUES (?1,?2,?3,'processing',?4,?5)").bind(buildId, targetBookId, targetRevisionId, manifest, now),
      );
      for (const kind of ["reader", "pdf", "search", "toc", "cover"]) {
        statements.push(this.db.prepare("INSERT INTO build_jobs (id,build_id,book_id,source_revision_id,kind,state,next_attempt_at_ms) VALUES (?1,?2,?3,?4,?5,'pending',0)").bind(`${buildId}:${kind}`, buildId, targetBookId, targetRevisionId, kind));
      }
    }
    statements.push(this.db.prepare("INSERT INTO audit_events (principal_sub,event_type,book_id,device_id,operation_id,outcome) VALUES (?1,'source_conflict_resolution',?2,?3,?4,?5)").bind(input.userId, input.bookId, input.deviceId, input.operationId, input.resolution));
    const results = await this.db.batch(statements);
    if ((results[0]?.meta?.changes ?? 0) !== 1) return null;
    return { operationId: input.operationId, resolution: input.resolution, sourceBookId: input.bookId, targetBookId, targetRevisionId, status, recordVersion: nextVersion, conflictingRevisionId: input.conflictingRevisionId };
  }
}

function publicationVersionBump(db: D1DatabaseBinding, bookId: string, expected: number) {
  return db.prepare("UPDATE book_publications SET record_version=record_version+1 WHERE book_id=?1 AND record_version=?2").bind(bookId, expected);
}
function conflictStatus(resolution: SourceConflictResolution, readyBuildId: string | null): "archived" | "queued" | "published" {
  return resolution === "keepRemote" ? "archived" : resolution === "keepLocal" && readyBuildId ? "published" : "queued";
}
function resolutionRow(row: Row): StoredConflictResolution {
  return { operationId: String(row.operation_id), resolution: String(row.resolution) as SourceConflictResolution, sourceBookId: String(row.book_id), targetBookId: String(row.target_book_id), targetRevisionId: String(row.target_revision_id), status: String(row.status) as StoredConflictResolution["status"], recordVersion: Number(row.publication_record_version), conflictingRevisionId: String(row.conflicting_revision_id) };
}
