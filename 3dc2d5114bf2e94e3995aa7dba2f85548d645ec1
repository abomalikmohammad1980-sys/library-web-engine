import type { SourceSyncCloudflareEnv } from "./bindings.js";

export const EXPECTED_MIGRATIONS = [
  { version: 1, file: "0001_source_revisions.sql", sha256: "e0ea84ef8818f450e54acbe165d9b8dba87d506572be7c83a0dc915b22391f8f" },
  { version: 2, file: "0002_build_jobs.sql", sha256: "45f4d8b6292628859382255a7a00d4a4ff88f9fcbd992420fddb038a0f6561b9" },
  { version: 3, file: "0003_revision_history.sql", sha256: "f3f8040baae63d831c0cc26ab3830b7a86c4a4d246228e01fb6bca1907195e56" },
  { version: 4, file: "0004_accounts_devices.sql", sha256: "6860316a138939ce3e8ae099fd3a9d51afbde2e108f4b8f3d286d8a0e2aab5d9" },
  { version: 5, file: "0005_quota_audit.sql", sha256: "46a7bf61730ea93431f3d2613d48bbb921d789d9016db88868ee7ba77e5e5d19" },
  { version: 6, file: "0006_maintenance.sql", sha256: "e08bb4d3ecb48f02b325afc104b1ce625b2639950104c44b22e2ae3e3875dd52" },
  { version: 7, file: "0007_docx_quarantine.sql", sha256: "9c0b2b1ec9ba6060508733c2b3dca21b9e289e7892b3d59e028a7e9a47325177" },
  { version: 8, file: "0008_quarantine_operations.sql", sha256: "27d93de52ee51565b336cb124379a5cb930c27c7ba4348670e7b392fdece9c87" },
  { version: 9, file: "0009_publication_cache_invalidation.sql", sha256: "a9471bcdde5379f9759f527132c84124449630ad8dede13cf28e0e58d05385e4" },
  { version: 10, file: "0010_conflict_resolutions.sql", sha256: "ef663e819e17907e055f02657f88feed73e9a25c3033fcf748ad347532d76145" },
  { version: 11, file: "0011_logical_works_source_editions.sql", sha256: "aa8e5aad85901ee1b157dd57901a6020bae8744e213d6174fbd21a864849dfb1" },
] as const;
const REQUIRED_TABLES = ["books", "source_uploads", "book_source_revisions", "book_builds", "build_jobs", "book_publications", "source_revision_rollbacks", "source_conflict_resolutions", "logical_works", "source_editions", "source_edition_operations", "accounts", "devices", "account_quotas", "account_usage", "usage_reservations", "audit_events", "maintenance_checkpoints", "maintenance_runs", "source_quarantines", "cache_invalidation_outbox"];
export function validateBindings(env: SourceSyncCloudflareEnv) {
  const missing: string[] = [];
  if (!env.DB?.prepare) missing.push("DB"); if (!env.SOURCE_OBJECTS?.head) missing.push("SOURCE_OBJECTS");
  for (const key of ["SOURCE_UPLOAD_SIGNING_KEY", "SOURCE_SYNC_PUBLIC_BASE_URL", "BUILD_SERVICE_TOKEN_CURRENT", "OIDC_ISSUER", "OIDC_AUDIENCE", "OIDC_JWKS_URL", "OIDC_ALLOWED_ALGORITHMS", "SYNC_MAX_SOURCE_BYTES", "SYNC_MAX_BOOK_REVISIONS", "SYNC_MAX_ACCOUNT_STORAGE_BYTES", "SYNC_MAX_REQUESTS_PER_WINDOW", "SYNC_RATE_WINDOW_SECONDS", "SYNC_MAINTENANCE_BATCH_SIZE", "SYNC_STAGING_GRACE_SECONDS", "DOCX_MAX_BYTES", "DOCX_MAX_ENTRIES", "DOCX_MAX_UNCOMPRESSED_BYTES", "DOCX_MAX_COMPRESSION_RATIO", "DOCX_ALLOW_EMBEDDINGS", "DOCX_ALLOW_EXTERNAL_RELATIONSHIPS", "DOCX_ALLOW_SIGNATURES"] as const) if (!env[key]?.trim()) missing.push(key);
  try { new URL(env.SOURCE_SYNC_PUBLIC_BASE_URL); } catch { missing.push("SOURCE_SYNC_PUBLIC_BASE_URL(valid URL)"); }
  return missing;
}
export async function readiness(env: SourceSyncCloudflareEnv) {
  const bindings = validateBindings(env); if (bindings.length) return { ready: false, bindings, migrations: EXPECTED_MIGRATIONS };
  try {
    const result = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('books','source_uploads','book_source_revisions','book_builds','build_jobs','book_publications','source_revision_rollbacks','source_conflict_resolutions','logical_works','source_editions','source_edition_operations','accounts','devices','account_quotas','account_usage','usage_reservations','audit_events','maintenance_checkpoints','maintenance_runs','source_quarantines','cache_invalidation_outbox')").all<{ name: string }>();
    const present = new Set((result.results ?? []).map(row => row.name)); const missingTables = REQUIRED_TABLES.filter(name => !present.has(name));
    return { ready: result.success && missingTables.length === 0, bindings: [], missingTables, migrations: EXPECTED_MIGRATIONS };
  } catch (error) { return { ready: false, bindings: [], database: error instanceof Error ? error.message : "database-check-failed", migrations: EXPECTED_MIGRATIONS }; }
}
export async function handleHealthRequest(request: Request, env: SourceSyncCloudflareEnv) {
  const path = new URL(request.url).pathname;
  if (path.endsWith("/health")){const maintenance=await env.DB.prepare("SELECT finished_at,released_reservations,deleted_staging,requeued_build_jobs,errors FROM maintenance_runs ORDER BY id DESC LIMIT 1").first().catch(()=>null);return Response.json({ok:true,service:"source-sync-cloudflare",maintenance})}
  if (path.endsWith("/ready")) { const status = await readiness(env); return Response.json(status, { status: status.ready ? 200 : 503 }); }
  return null;
}
