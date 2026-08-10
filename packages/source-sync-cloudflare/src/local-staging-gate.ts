import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";
import type { D1DatabaseBinding, D1PreparedStatementBinding, D1Result, SourceSyncCloudflareEnv } from "./bindings.js";
import { EXPECTED_MIGRATIONS, handleHealthRequest } from "./readiness.js";

export interface LocalStagingGateResult {
  migrations: number;
  ready: boolean;
  health: boolean;
  legacyRevisions: number;
  backfilledEditions: number;
  activeDevices: number;
  conflict: "archived";
  rollback: "published";
  quarantine: "allowed";
  cache: "delivered";
  triggers: readonly ["source_conflict_resolution_cas", "source_edition_attachment_cas"];
}

class LocalStatement implements D1PreparedStatementBinding {
  private values: SQLInputValue[] = [];
  constructor(private readonly statement: StatementSync) {}
  bind(...values: unknown[]) { this.values = values.map(sqlValue); return this; }
  async first<T>() { return (this.statement.get(...this.values) as T | undefined) ?? null; }
  async all<T>(): Promise<D1Result<T>> { return { success: true, results: this.statement.all(...this.values) as T[] }; }
  async run<T>(): Promise<D1Result<T>> { const result = this.statement.run(...this.values); return { success: true, meta: { changes: Number(result.changes) } }; }
}
function sqlValue(value: unknown): SQLInputValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "bigint" || value instanceof Uint8Array) return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  throw new TypeError("unsupported_local_sql_value");
}
class LocalD1 implements D1DatabaseBinding {
  constructor(readonly database: DatabaseSync) {}
  prepare(sql: string) { return new LocalStatement(this.database.prepare(sql)); }
}

const one = (db: DatabaseSync, sql: string) => Number((db.prepare(sql).get() as { value: number }).value);
const value = (db: DatabaseSync, sql: string) => String((db.prepare(sql).get() as { value: string }).value);
function mustThrow(db: DatabaseSync, sql: string, code: string) {
  try { db.exec(sql); } catch (error) { if (error instanceof Error && error.message.includes(code)) return; throw error; }
  throw new Error(`${code}_not_enforced`);
}

function localEnv(db: DatabaseSync): SourceSyncCloudflareEnv {
  const bucket = { head: async () => null, get: async () => null, put: async () => null, delete: async () => undefined };
  return { DB: new LocalD1(db), SOURCE_OBJECTS: bucket, SOURCE_UPLOAD_SIGNING_KEY: "local-only", SOURCE_SYNC_PUBLIC_BASE_URL: "https://local.invalid", BUILD_SERVICE_TOKEN_CURRENT: "local-only", OIDC_ISSUER: "https://local.invalid", OIDC_AUDIENCE: "local", OIDC_JWKS_URL: "https://local.invalid/jwks", OIDC_ALLOWED_ALGORITHMS: "RS256", SYNC_MAX_SOURCE_BYTES: "1000000", SYNC_MAX_BOOK_REVISIONS: "20", SYNC_MAX_ACCOUNT_STORAGE_BYTES: "10000000", SYNC_MAX_REQUESTS_PER_WINDOW: "100", SYNC_RATE_WINDOW_SECONDS: "60", SYNC_MAINTENANCE_BATCH_SIZE: "25", SYNC_STAGING_GRACE_SECONDS: "3600", DOCX_MAX_BYTES: "1000000", DOCX_MAX_ENTRIES: "100", DOCX_MAX_UNCOMPRESSED_BYTES: "5000000", DOCX_MAX_COMPRESSION_RATIO: "100", DOCX_ALLOW_EMBEDDINGS: "false", DOCX_ALLOW_EXTERNAL_RELATIONSHIPS: "false", DOCX_ALLOW_SIGNATURES: "false" };
}

/** Creates and destroys its own temporary SQLite database. It never accepts a real database path. */
export async function runLocalStagingGate(): Promise<LocalStagingGateResult> {
  const directory = mkdtempSync(join(tmpdir(), "alkhizana-source-sync-staging-"));
  const db = new DatabaseSync(join(directory, "staging.sqlite"));
  try {
    db.exec("PRAGMA foreign_keys=ON; CREATE TABLE _local_migrations(version INTEGER PRIMARY KEY,file TEXT NOT NULL,sha256 TEXT NOT NULL);");
    for (const migration of EXPECTED_MIGRATIONS.slice(0, 10)) apply(db, migration);
    seedLegacy(db);
    apply(db, EXPECTED_MIGRATIONS[10]);

    const env = localEnv(db);
    const readyResponse = await handleHealthRequest(new Request("https://local.invalid/ready"), env);
    const healthResponse = await handleHealthRequest(new Request("https://local.invalid/health"), env);
    const ready = readyResponse?.status === 200 && Boolean((await readyResponse.json() as { ready?: boolean }).ready);
    const health = healthResponse?.status === 200 && Boolean((await healthResponse.json() as { ok?: boolean }).ok);
    if (!ready || !health) throw new Error("local_readiness_failed");

    verifyBackfillAndTriggers(db);
    smokeTwoDevices(db);
    return { migrations: one(db, "SELECT count(*) value FROM _local_migrations"), ready, health, legacyRevisions: one(db, "SELECT count(*) value FROM book_source_revisions"), backfilledEditions: one(db, "SELECT count(*) value FROM source_editions WHERE work_id='book'"), activeDevices: one(db, "SELECT count(*) value FROM devices WHERE principal_sub='owner' AND revoked_at IS NULL"), conflict: value(db, "SELECT status value FROM source_conflict_resolutions WHERE operation_id='resolve-device-2'") as "archived", rollback: value(db, "SELECT status value FROM source_revision_rollbacks WHERE operation_id='rollback-device-1'") as "published", quarantine: value(db, "SELECT status value FROM source_quarantines WHERE id='quarantine-1'") as "allowed", cache: value(db, "SELECT state value FROM cache_invalidation_outbox WHERE operation_id='cache-next'") as "delivered", triggers: ["source_conflict_resolution_cas", "source_edition_attachment_cas"] };
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
}

function apply(db: DatabaseSync, migration: (typeof EXPECTED_MIGRATIONS)[number]) {
  const url = new URL(`../migrations/${migration.file}`, import.meta.url), bytes = readFileSync(url), digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== migration.sha256) throw new Error(`migration_checksum_mismatch:${migration.file}`);
  db.exec(bytes.toString("utf8"));
  db.prepare("INSERT INTO _local_migrations(version,file,sha256) VALUES (?,?,?)").run(migration.version, migration.file, digest);
}

function seedLegacy(db: DatabaseSync) {
  const a = "a".repeat(64), b = "b".repeat(64), c = "c".repeat(64);
  db.exec(`
    INSERT INTO books(id,owner_id,active_source_revision_id) VALUES('book','owner','revision-active');
    INSERT INTO accounts(principal_sub) VALUES('owner');
    INSERT INTO devices(principal_sub,device_id,label,platform) VALUES('owner','device-1','جهاز 1','local'),('owner','device-2','جهاز 2','local');
    INSERT INTO book_source_revisions(id,book_id,operation_id,base_revision_id,sha256,byte_length,source_name,created_at,created_by_device_id,status,immutable_object_key) VALUES
      ('revision-active','book','upload-active',NULL,'${a}',10,'active.docx','2026-08-08T00:00:00Z','device-1','published','sources/${a}'),
      ('revision-conflict','book','upload-conflict','revision-active','${b}',11,'conflict.docx','2026-08-08T00:01:00Z','device-2','conflicted','sources/${b}'),
      ('revision-next','book','upload-next','revision-active','${c}',12,'next.docx','2026-08-08T00:02:00Z','device-1','ready','sources/${c}');
    INSERT INTO book_builds(id,book_id,source_revision_id,status,manifest_json,created_at) VALUES
      ('build-active','book','revision-active','published','{}','2026-08-08T00:00:00Z'),
      ('build-next','book','revision-next','ready','{}','2026-08-08T00:02:00Z');
    INSERT INTO book_publications(book_id,active_build_id,active_source_revision_id,record_version,desired_source_revision_id,active_manifest_etag,cache_version) VALUES('book','build-active','revision-active',4,NULL,'etag-active',1);
    INSERT INTO source_quarantines(id,upload_id,owner_id,book_id,operation_id,device_id,reason_code,status) VALUES('quarantine-1','upload-q','owner','book','q-op','device-2','active_content','pending');
  `);
}

function verifyBackfillAndTriggers(db: DatabaseSync) {
  if (one(db, "SELECT count(*) value FROM logical_works WHERE id='book' AND owner_id='owner' AND authority_kind='word-live' AND authority_edition_id='revision-active' AND authority_format='docx'") !== 1) throw new Error("logical_work_backfill_failed");
  if (one(db, "SELECT count(*) value FROM source_editions WHERE work_id='book'") !== 3) throw new Error("source_edition_backfill_failed");
  if (one(db, "SELECT count(*) value FROM sqlite_master WHERE type='trigger' AND name IN ('source_conflict_resolution_cas','source_edition_attachment_cas')") !== 2) throw new Error("cas_trigger_missing");
  mustThrow(db, "INSERT INTO source_conflict_resolutions(book_id,operation_id,conflicting_revision_id,resolution,requested_by_user_id,requested_by_device_id,expected_publication_version,target_book_id,target_revision_id,status,publication_record_version) VALUES('book','stale','revision-conflict','keepRemote','owner','device-2',99,'book','revision-active','archived',100)", "conflict_resolution_cas");
  db.exec("INSERT INTO source_editions(id,operation_id,work_id,format,role,object_key,sha256,byte_length,media_type,source_name,created_at,created_by_device_id) VALUES('edition-epub','epub-upload','book','epub','alternate','sources/epub','dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',20,'application/epub+zip','book.epub','2026-08-08T00:03:00Z','device-2')");
  mustThrow(db, "INSERT INTO source_edition_operations(work_id,operation_id,edition_id,intent,requested_by_user_id,requested_by_device_id,expected_work_version,result_work_version) VALUES('book','stale-edition','edition-epub','attach-alternate','owner','device-2',99,99)", "source_edition_attachment_cas");
  db.exec("INSERT INTO source_edition_operations(work_id,operation_id,edition_id,intent,requested_by_user_id,requested_by_device_id,expected_work_version,result_work_version,result_authority_kind,result_authority_edition_id,result_authority_format) VALUES('book','attach-epub','edition-epub','attach-alternate','owner','device-2',0,0,'word-live','revision-active','docx')");
}

function smokeTwoDevices(db: DatabaseSync) {
  db.exec(`
    BEGIN;
    INSERT INTO source_conflict_resolutions(book_id,operation_id,conflicting_revision_id,resolution,requested_by_user_id,requested_by_device_id,expected_publication_version,target_book_id,target_revision_id,status,publication_record_version) VALUES('book','resolve-device-2','revision-conflict','keepRemote','owner','device-2',4,'book','revision-active','archived',5);
    UPDATE book_source_revisions SET status='rejected' WHERE id='revision-conflict';
    UPDATE book_publications SET record_version=5 WHERE book_id='book' AND record_version=4;
    INSERT INTO source_revision_rollbacks(book_id,operation_id,target_revision_id,requested_by_user_id,requested_by_device_id,status,publication_record_version) VALUES('book','rollback-device-1','revision-active','owner','device-1','published',6);
    UPDATE book_publications SET record_version=6 WHERE book_id='book' AND record_version=5;
    UPDATE source_quarantines SET resolution_lease_id='lease-local',resolution_lease_until_ms=9999999999999,record_version=record_version+1 WHERE id='quarantine-1' AND status='pending';
    UPDATE source_quarantines SET status='allowed',resolution_reason='local-review',resolved_by='local-admin',resolved_at=CURRENT_TIMESTAMP,resolution_operation_id='resolve-q',resolution_lease_id=NULL,resolution_lease_until_ms=NULL,record_version=record_version+1 WHERE id='quarantine-1' AND status='pending' AND resolution_lease_id='lease-local';
    UPDATE book_publications SET active_build_id='build-next',active_source_revision_id='revision-next',active_manifest_etag='etag-next',cache_version=cache_version+1,record_version=record_version+1 WHERE book_id='book' AND record_version=6;
    INSERT INTO cache_invalidation_outbox(operation_id,book_id,build_id,manifest_etag,state,delivered_at) VALUES('cache-next','book','build-next','etag-next','delivered',CURRENT_TIMESTAMP);
    COMMIT;
  `);
  for (const [sql, expected] of [
    ["SELECT count(*) value FROM devices WHERE principal_sub='owner' AND revoked_at IS NULL", 2],
    ["SELECT count(*) value FROM source_conflict_resolutions WHERE operation_id='resolve-device-2' AND requested_by_device_id='device-2' AND status='archived'", 1],
    ["SELECT count(*) value FROM source_revision_rollbacks WHERE operation_id='rollback-device-1' AND requested_by_device_id='device-1' AND status='published'", 1],
    ["SELECT count(*) value FROM source_quarantines WHERE id='quarantine-1' AND status='allowed' AND resolution_lease_id IS NULL", 1],
    ["SELECT count(*) value FROM book_publications WHERE book_id='book' AND active_build_id='build-next' AND cache_version=2 AND active_manifest_etag='etag-next'", 1],
    ["SELECT count(*) value FROM cache_invalidation_outbox WHERE operation_id='cache-next' AND state='delivered'", 1],
  ] as const) if (one(db, sql) !== expected) throw new Error("local_smoke_assertion_failed");
}
