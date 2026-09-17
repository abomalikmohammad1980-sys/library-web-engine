# Stage B isolated cloud plan — 2026-09-17

Preparation only. No migrations, deployment, secret reads, or queue activation performed by this audit.

## Verified remote baseline

Read-only queries against account `db956e5187111b69e796e4a8e4c3fe36`, D1 `9133fe99-c4e1-4a1e-84f3-127735883279`, returned zero changes/rows written:

- Existing 0033 jobs/revisions/eligible view, 0035 FTS/staging/receipts/epoch.
- No Stage B state/outbox/queue receipts/IndexNow/PDF facts/Actions dispatch objects. No `d1_migrations` ledger.
- No obsolete PDF-native receipt migration was applied. Current 0039 is **classification only**, not PDF body/OCR.
- Synthetic `00000000-codex-ingestion-acceptance` is already ready at generation 1/checkpoint 1.
- Eligible public books count is **2**, selected fixture count is 1: `00000000-codex-ingestion-acceptance` and `edition-public-parent`, both `text/plain`. Minute reconciliation can process the other isolated fixture too; do not assume all queue messages refer to this test. Do not withdraw another fixture without reviewing its ownership/purpose.

The CLI must use the explicit isolated config and binding name, not an unconfigured UUID positional name. Wrangler 4.92.0 was checked.

## Prepared local artifacts

Run from repository root:

```powershell
node tools/prepare-stage-b-cloud-acceptance.mjs
```

Output: `.artifacts/stage-b-cloud-acceptance-20260917/` (old acceptance preserved).

- Bundled Pages `_worker.js` mounts the real gateway, public search, SEO book/sitemap, authenticated admin indexing, authenticated owner PATCH/DELETE handlers.
- No test authentication bypass or public queue-wake endpoint.
- `ctx.waitUntil` is forwarded so successful real mutations can wake the queue service.
- Fixed isolated D1/R2; `BOOK_INDEX_WAKE` points to `khizana-book-index-jobs-preview`.
- Ingestion/search/events/targeted-only enabled for this isolated Pages harness. IndexNow explicitly disabled; no PDF body/OCR flag.
- Reviewed 0036–0041 are copied only after byte-equality checks against both migration trees.
- `requeue-synthetic.sql` advances a guarded existing synthetic fixture by its normal title-update trigger. It is **not executed** by preparation.

## Exact migration order (operator-only, not executed)

First keep both Queue and Actions coordinator gates false. Use a fresh schema check if any other process has modified the DB; these migrations are not blindly repeatable, especially 0039 ALTER TABLE.

From `alpha-publish`:

```powershell
$env:CLOUDFLARE_ACCOUNT_ID='db956e5187111b69e796e4a8e4c3fe36'
$env:WRANGLER_LOG_PATH='D:/alkhizana/.wrangler-logs'
$isolatedConfig='../.artifacts/stage-b-cloud-acceptance-20260917/wrangler.jsonc'
# Isolated backup may contain session hashes. Keep ignored; never print its contents.
node node_modules/wrangler/bin/wrangler.js d1 export VISITORS_DB --config $isolatedConfig --remote --output ../.artifacts/stage-b-cloud-acceptance-20260917/pre-stage-b-backup.sql
if($LASTEXITCODE -ne 0){throw 'Backup failed; do not migrate'}
$orderedMigrations=@(
 '0036_public_book_event_outbox.sql',
 '0037_public_book_queue_receipts.sql',
 '0038_public_book_indexnow.sql',
 '0039_public_pdf_classification.sql',
 '0040_public_book_metadata_aliases.sql',
 '0041_public_book_actions_dispatch.sql'
)
foreach($migration in $orderedMigrations){
 node node_modules/wrangler/bin/wrangler.js d1 execute VISITORS_DB --config $isolatedConfig --remote --file "../.artifacts/stage-b-cloud-acceptance-20260917/$migration"
 if($LASTEXITCODE -ne 0){throw "Stopped at $migration; inspect schema before retrying"}
}
```

Do **not** reapply 0033/0035 or use bulk `migrations apply` with a missing historical migration ledger. Stop on error; inspect actual committed schema before continuing. Do not replace current 0039 with the abandoned native-body schema.

## Activation sequence and proof

1. Commit/push reviewed targeted workflow and runtime dependencies to the fixed new repository/main. Confirm workflow exists; do not dispatch stale code.
2. Apply the six isolated migrations after schema review. Deploy Queue worker with gate false, so Pages service binding resolves but no dispatch occurs.
3. Deploy prepared Pages harness to **khizana-bok-acceptance-20260917 only**. Root ensures its dedicated `PUBLIC_BOOK_INDEX_RUNNER_TOKEN` equals the existing narrowly scoped Actions gateway secret, without reading/printing values. Do not substitute broad OAuth.
4. Gate workflow with `BOOK_INDEX_TARGETED_ACTIONS_ENABLED=true` and `PUBLIC_BOOK_INGESTION_ACCEPTED=true` only for the approved isolated run. The legacy global runner must remain disabled by the targeted gate.
5. Enable coordinator `BOOK_INDEX_ACTIONS_ENABLED` and Queue `BOOK_INDEX_QUEUE_ENABLED` only after all preceding checks. IndexNow remains false at every service.
6. Apply `requeue-synthetic.sql` **once** and capture returned exact `content_version`. Verify a matching outbox row. The minute dispatcher is enough to deliver it; this proves cron/outbox, not post-commit wake. To prove immediate wake separately, perform the real owner/admin mutation with an existing authorized isolated session; never create a bypass endpoint.
7. Follow exact book/version through outbox delivered, Actions dispatch run ID, successful targeted workflow, queue receipt ready, jobs ready, matching search receipt manifest SHA, and materialized state ready/indexed_at. Actions success alone is not acceptance.
8. Read-only consumer probe from root:

```powershell
$env:PUBLIC_BOOK_INDEX_GATEWAY_ORIGIN='https://khizana-bok-acceptance-20260917.pages.dev'
node tools/verify-stage-b-cloud-acceptance.mjs
```

This verifies 2 expected body matches for the existing plain-text fixture, one server H1, canonical book URL, no source-key leak, and ready public sitemap inclusion. It does not itself prove automatic dispatch or mutate data. The old `public-book-index-cloud-acceptance.mjs` is untargeted and must not be used unchanged against targeted-only mode.

Example exact receipt check (replace the version with the observed synthetic version; no credentials/keys are selected):

```sql
SELECT s.book_id,s.content_version,s.visibility,j.generation,j.state,j.attempts,
       q.state AS queue_state,a.state AS actions_state,a.run_id,
       p.status,p.indexed_at,
       CASE WHEN r.manifest_sha256=j.manifest_sha256 AND r.generation=j.generation THEN 1 ELSE 0 END AS search_receipt_matches
FROM public_book_event_state s
JOIN public_book_index_jobs j ON j.book_id=s.book_id
LEFT JOIN public_book_queue_receipts q ON q.book_id=s.book_id AND q.content_version=s.content_version
LEFT JOIN public_book_actions_dispatches a ON a.book_id=s.book_id AND a.content_version=s.content_version
LEFT JOIN books_index_state p ON p.book_id=s.book_id
LEFT JOIN public_book_search_receipts r ON r.book_id=s.book_id
WHERE s.book_id='00000000-codex-ingestion-acceptance';
```

## Remaining acceptance gaps

- Cloud migrations/Pages/Queue activation and targeted Actions round trip not yet executed in this audit.
- Existing cloud receipt proves only synthetic plain text, not Markdown/Word/BOK/EPUB/PDF coverage.
- PDF requires actual bookmark-only cloud proof and scanned classification `ocr_pending`, **no body/OCR**. This status must not cause retries; basic SEO/TOC may be ready.
- Test current-version edits and withdrawal after ready: stale search/SEO must disappear immediately; stale queue events must not republish. Hard-delete/recreate and retry fencing have local tests, not new cloud evidence here.
- Authenticated post-commit wake, admin retry, duplicate delivery, and isolated DLQ proof remain distinct checks.

Local check: 21 focused outbox/Queue/coordinator tests passed, including all-migration SQLite application, metadata aliases, stale/removal guards and durable cursor recovery. Preparation bundle and verifier syntax passed. No new cloud success claimed.

## Operator follow-up: authenticated lifecycle test

Parent subsequently applied 0036–0041 to the isolated database. D1 export rejected its FTS table; parent instead recorded the pre-migration Time Travel bookmark in ignored `pre-migration-restore.json`. Do not retry migration application from the earlier preparation instructions.

The prepared harness now also mounts the real `/api/admin/book-submissions/:id` PATCH handler. Redeploy the freshly rebuilt harness before the following test; earlier Pages deployment `fb21a78e` lacked this route.

```powershell
$env:PUBLIC_BOOK_INDEX_GATEWAY_ORIGIN='https://khizana-bok-acceptance-20260917.pages.dev'
node tools/stage-b-authenticated-cloud-acceptance.mjs --run-isolated-fixture
```

This **operator-run mutation test** targets only `00000000-codex-ingestion-acceptance`. It requires the existing synthetic owner to be a super-admin; does not create privileges or enable account test mode. It generates a 30-minute random access session/device in memory, inserts only hashes, uses standard cookies and registered-device authentication, and revokes its session/device in `finally`. Cookies never appear in command lines, files or logs. Do not interrupt the process unnecessarily; if interrupted, the session expires after 30 minutes, and its labelled synthetic test device should be cleaned up separately.

Sequence: public metadata update via admin review → exact version Queue/Actions/search activation proof (bounded 12 minutes) → public consumers → admin withdrawal → immediate 410, no search hits, absent sitemap → private owner metadata update. Owner PATCH deliberately rejects public edits/withdrawals; therefore the admin review path is necessary. Final fixture remains **private**, source remains intact. It does not republish or delete the fixture.

The script proves the successful mutation path invokes the installed wake hook, but receipt arrival alone cannot distinguish service wake from minute-cron fallback. That latency distinction requires observation separately. Missing `indexed_at` on an old ready record is now reconciled by a real new revision, never a fabricated activation time; 10 Queue-worker tests pass including this recovery.

### Authenticated-route prerequisite found during first operator attempt

The first operator run stopped at its initial SELECT, before creating a session or mutating the fixture: isolated `user_books.review_version` was absent. A subsequent read-only PRAGMA audit confirmed **both** review-version columns absent and zero duplicate review-event book groups. Existing `0005_review_decision_versions.sql` is the correct additive prerequisite (two columns plus unique index); do not change handler field aliases. Authentication table columns were verified compatible. The script now checks required schema before initial fixture/session work.

The isolated DB has no `oversight_*` triggers. This test therefore proves real handler authentication, CAS, Queue and visibility, but does not establish production-equivalent oversight-trigger acceptance. Do not blindly apply 0020/0030 without their complete prerequisite audit; all-migration local tests separately cover their trigger effects.
