# Public upload indexing: durable lifecycle foundation (not enabled)

## Scope and verified gap

The current review handler changes publication state and audit history only. The
browser background index covers local bytes only. The older public Word tool is
explicitly a local prototype, not an ingestion service. Thus automatic public
Word/BOK/text/PDF-outline ingestion remains **unfinished**.

This change adds a tested internal lifecycle, not a cosmetic pending notification
and not a claim that a worker currently processes books. No migration applied,
no endpoint exposed, no scheduler deployed, no source/production data changed.

## Added implementation

- Migration `0033_public_book_index_jobs.sql` creates user-upload revision/job
  tables and an eligible-public view. It does not touch the packaged Shamela
  corpus or existing immutable release pipeline.
- Transactional triggers invalidate receipts and schedule a new generation on
  relevant publication, source, title/author/category, volume, Word-map and TOC
  changes. Review notes/timestamps, cover assets, companion PDFs and unrelated
  metadata description edits do not churn a generation.
- Privacy changes, central hides and deletion fence workers immediately. Restore
  requires fresh readiness; old receipts do not reactivate silently.
- `_public-book-index-jobs.js` has atomic bounded claims, expiring leases,
  monotone checkpoints, bounded retries/backoff, permanent failure, and explicit
  retry-exhaustion state. Active reads recheck current public eligibility and
  generation with a safe field projection.
- Activation requires a complete receipt, matching checkpoint and unexpired
  current lease. PDF receipts must declare `pdf-bookmarks-only`, not page-body
  text/OCR. This mode check is not a substitute for extractor validation.

## Local evidence

`node --test alpha-publish/tests/public-book-index-jobs.test.mjs`: 13 passed.
Tests execute the actual additive migration/helper on isolated SQLite, with
production prerequisite tables. They cover existing-book backfill, new private
book exclusion, concurrent claims, lease takeover, checkpoint fencing, retry,
source replacement, withdrawal, central hide/restore, relevant/irrelevant edits,
PDF mode, safe projection, malformed/partial receipts and hard deletion.
Cloud D1 compatibility and full migration-order acceptance remain to be tested.

## Required executor contract / next work (release gates)

1. Implement a bounded extractor runner using existing source parsers and verified
   Word-map bundles. Validate hostile archives/resource bounds; bind source bytes
   and every volume to SHA-256 plus generation. Existing R2 source object keys
   must be immutable; if replacement ever overwrites a key in place, add an
   explicit source-version identity before enabling this lifecycle.
2. Resume only checkpoints bound to the same generation/source manifest. Refresh
   leases via safe bounded work units or restart with takeover; this helper does
   not promise arbitrary-length extraction within one request.
3. PDF extracts outline/bookmarks only, including a verified empty-outline result;
   do not treat missing parser support as an empty successful index. DOCX/BOK,
   Markdown/EPUB/plain text need their existing parser/TOC semantics and all
   volumes, not a generic text-only stand-in.
4. Store immutable content-addressed artifacts in existing R2, hash/read-verify
   them, recheck generation, then activate. The lifecycle helper trusts the
   internal executor's verified receipt; it does not fetch or verify R2 itself.
   Never give uploads access to activation or accept arbitrary client receipts.
5. Connect a durable automatic scheduler/executor (none exists today). Existing
   D1/R2 can hold jobs/artifacts; do not claim Pages request `waitUntil` alone is
   durable scheduling. Provisioning/configuration needs separate verification;
   no new paid infrastructure was created by this change.
6. Connect public search/TOC/SEO consumers to ready receipts. Every public artifact
   read must recheck visibility/revision (including hidden books), not expose R2
   objects through an unguarded public address. Merge results/pagination without
   inventing completeness while pending/failed jobs exist.
7. Test isolated full-format publication, edit, replacement, withdrawal/deletion,
   crash retry, source race and multi-volume workflows, then cloud acceptance and
   scheduler recovery before applying migration/enabling production consumption.

Full deployment intentionally remains gated; this is a foundation only.

## Subsequent bounded executor implementation

`tools/public-book-index-executor.mjs` and its isolated worker now implement a
real, inactive Node execution path, using the actual text decoder/paragraph
splitter and actual DOCX parser + Word structural upload gate. DOCX additionally
requires its existing digest-bound Word map, matching source text and positions;
unsupported/excluded structures fail rather than silently omit text. Source size,
output size, parser memory and elapsed time are bounded. Source bytes are read
again before activation to detect same-key replacements.

The runner uploads a content-addressed artifact to its injected R2 binding, reads
it back and verifies SHA-256, fences revisions before/after extraction and output,
and activates only with the current lease. R2 failure/corruption and process
timeouts retain explicit retry/failure states. No credentials, scheduler, cloud
binding or active endpoint is added.

Nine executor tests pass, including all 33 current migrations (with the separate
BOK 0032), real DOCX/source-map/TOC extraction, real worker timeout, text artifact
verification, source replacement, corruption, withdrawal, and unsupported format
failures. Combined with lifecycle tests this is 22 local tests, not cloud proof.

Remaining format gates are explicit: no PDF outline asset is currently stored in
the account schema, so metadata tags must not be fabricated into bookmarks;
Markdown's actual reader uses a DOM-sanitized pagination/TOC renderer and requires
an equivalent adapter; raw BOK and multi-volume uploads also require adapters.
These currently fail with named unsupported/required errors and never become
ready. The Node runner is not yet a deployed durable scheduler, and search/SEO
consumer integration remains open.

## PDF/BOK continuation (supersedes unsupported wording above)

PDF now uses the installed PDF.js legacy parser in the bounded worker. It reads
only outlines/named destinations/page indices with the same acceptance semantics
as `pdfHeadingIndex`; it never requests page text, fonts for rendering, or OCR.
Verified empty outlines are allowed; unreadable PDFs fail. Outline count/depth
and page count are bounded. BOK now invokes the existing `parseBok` unchanged and
preserves source page IDs, display page/part labels and the actual parser TOC
anchor mapping. The real supplied BOK fixture passes every page/TOC comparison.

MIME normalization includes the server's actual text upload charset suffix.
Source size is checked before worker cloning. Word zip structure/XML rejection,
parser worker heap and time bounds remain enforced; this is structural isolation
and not an antivirus claim. The 20 MiB source adapter bound is lower than some
upload allowances; larger books currently fail explicitly and need streaming or
a separately resource-sized executor, not a silent completeness claim.

Markdown remains gated because the actual sanitized DOM renderer requires a DOM
implementation: linkedom/jsdom/happy-dom were all unavailable locally. No new
package was installed and no competing regex/parser TOC was substituted. EPUB,
multipart and unsupported Word structures remain gated. Scheduler/public
consumer integration and remote acceptance are still unfinished.

## Markdown and scheduler audit continuation

Markdown now calls the actual `renderMarkdownPages` inside a jsdom document
without script execution or external resource loading. It preserves DOMPurify,
the exact heading IDs and reader pagination; it does not duplicate parsing with
regex. Acceptance verifies repeated Arabic heading IDs, fenced pseudo-headings,
script exclusion and page indices. jsdom 26.1.0 was installed with scripts
disabled in `.artifacts/ingestion-runtime` only; root dependencies/lockfile were
not changed. A deployable executor still needs this dependency pinned in its
reviewed runtime. Initial cold dependency loading exceeded the worker time bound;
the bound was not relaxed, and the warm test passed. Existing retry semantics
handle timeout explicitly, not as ready.

Existing infrastructure inspected: `.github/workflows/ci.yml` has only push/PR
CI on GitHub-hosted Ubuntu; there is no scheduled/self-hosted ingestion runner.
The Windows Word companion is explicitly interactive/local, must stay open and
does not upload independently. It is not an authorized always-on backend.
This Node worker-thread implementation cannot be directly deployed into Pages
Functions. Actual continuous operation therefore needs an authorized always-on
Node host, or a scheduled GitHub Actions runtime with narrowly scoped D1/R2
credentials and isolated acceptance. No production OAuth/access credentials were
copied, new secrets granted, workflows enabled or paid infrastructure created.
Scheduling alone would also not satisfy immediate ingestion latency without a
publication trigger/wakeup design. The durable job creation is immediate;
processing is not yet wired to a deployed consumer.

## Authorized dedicated-token runner (later continuation)

The user approved a narrowly scoped GitHub Actions runtime. The initial proposal
for account-level D1/R2 credentials was rejected during security review and is
NOT used. `tools/public-book-index-runner.mjs` now contacts only the fixed
`https://khzanah.com/api/internal/public-book-index` gateway. It receives only
`PUBLIC_BOOK_INDEX_RUNNER_TOKEN`; it cannot execute SQL, choose R2 keys, read
private uploads, delete objects, or change publication state. Extraction workers
receive an empty environment, not the runner secret.

The gateway binds existing VISITORS_DB/LIBRARY_R2 server-side. Its operations are
claim, source, Word map, complete, fail. Every source/map/complete operation checks
the current public generation and unexpired opaque lease. Hash verification and
a second source read precede activation. Unknown operations fail closed. PDFs
reject any body rows. Artifact keys are server-derived SHA256 paths. Responses
are no-store. Canonical, central-submission and account-book hidden aliases all
invalidate eligibility/revision, including hide-then-restore.

The scheduled workflow is pinned to verified official action commits, has
contents:read only, no persisted checkout credential, repository concurrency,
30-minute schedule plus manual dispatch, 12-minute total timeout and at most five
jobs per run. Both PUBLIC_BOOK_INGESTION_ENABLED and
PUBLIC_BOOK_INGESTION_ACCEPTED must be true. No environment requiring a paid plan
is introduced. jsdom 26.1.0 now has its own checked-in runtime manifest/lockfile;
root node_modules and lockfile are not reinstalled. Cold jsdom initialization
exceeded 10 seconds in one run, so the explicit extraction limit is now 30 seconds
(also the validation maximum), with 256 MiB old-generation memory limit and
20 MiB input / 16 MiB output limits. This is not unlimited parsing.

Current separate verified local results: 15 lifecycle tests, 13 actual extractor
tests (no skips), 7 gateway/runner/consumer tests. One earlier combined process
aborted during PDF testing; standalone rerun completed all extractor tests. Do
not represent that earlier combined invocation as green.

Shared `readVerifiedPublicBookIndex(env, rawUserBookId)` verifies artifact SHA,
contract, generation and PDF mode, and rechecks eligibility after storage I/O.
SEO/search consumer integration is being handled in separate scoped work. No
remote migration, secret configuration, workflow enablement or production run
has been performed by this agent. Actual cloud end-to-end acceptance, indexed
search consumption and unsupported format/multipart handling remain necessary;
a ready artifact or a scheduled workflow alone is not completion.

Operational throughput is deliberately conservative: five jobs per half-hour
schedule (at most ten/hour before failures), not instant processing or a 100,000
book backlog catch-up promise. Manual dispatch uses the same bounds. Every run
with one or more failed/skipped jobs exits with status 2 so Actions reports an
actionable failure while durable job retries remain queued. Source revisions
enqueue immediately, but scheduling may be delayed by GitHub and backlog.
The active edited BOK release is excluded from original-source ingestion; its
existing pinned publication/search path remains authoritative. A regression test
proves no old-text resurrection or unrelated-book revision churn.

Search staging now resumes in bounded 1,000-row calls, using bulk JSON SQL
statements and a persisted generation/manifest cursor. The gateway renews only
the still-current lease on pending progress; the runner resends the same already
extracted payload, without parsing the source again. A 1,300-row end-to-end test
requires two stages and one extraction. Search staging failure prevents both
artifact activation and a public receipt. The dedicated safe reader is consumed
by the SEO TOC projection; search consumption uses the same activated digest.

Repeated Windows test-process aborts during native PDF.js dependency teardown
were not dismissed as green. PDF-only extraction now runs in a separate hidden
child process (empty environment, 256 MiB JS heap, same 30-second deadline) so a
native crash cannot terminate the runner or other jobs. Text/Word/BOK/Markdown
retain bounded worker threads. PDF child stdout/stderr are not forwarded, and
no body text/OCR is requested.

## Real D1 acceptance correction

The first isolated cloud run claimed the fixture but did not activate it. Four
FTS rows existed while the staging cursor remained zero. D1's `meta.changes`
included trigger side effects, unlike the initial SQLite adapter's direct-row
count. Success guards now use exact `INSERT ... RETURNING row_id` results for
FTS and `UPDATE ... RETURNING book_id` for lifecycle activation/checkpoint/failure
and lease renewal. They do not relax to a loose positive-change check. The local
gateway fixture now emulates D1 using SQLite `total_changes()` deltas, and tests
cover inflated counts plus stale/withdrawn lease rejection. The cloud rerun is
still required; the first failure must not be reported as successful acceptance.

Client diagnostics are bounded to 2 KiB and expose only operation, HTTP status
and a fixed allowlist of error codes. Optional isolated-server diagnostics add a
static stage label, never exception messages, SQL, object keys or credentials.

## Isolated cloud rerun: synthetic text accepted

Root reported the real rerun succeeded on deployment `a958f496` of
`khizana-bok-acceptance-20260917.pages.dev`: `claimed:1`, `ready:1`, `failed:0`,
`searchHits:2`. This verifies the synthetic 48-byte text fixture through actual
Pages gateway authentication, isolated R2 source/artifact storage, D1 generation
guards, FTS staging, activation and the public search endpoint. It is not cloud
acceptance of every format, multipart uploads, large books, or all original
library data. Local format tests remain separate evidence. Production activation
and GitHub Actions gates remain disabled until root's reviewed deployment plan.

## Reviewed ingestion commit file manifest

New files owned by this ingestion task (stage these exact files, not broad dirs):

- `.github/workflows/public-book-ingestion.yml`
- `deployment/cloudflare/functions/api/_public-book-index-jobs.js`
- `deployment/cloudflare/functions/api/_public-book-index-read.js`
- `deployment/cloudflare/functions/api/internal/public-book-index.js`
- `deployment/cloudflare/migrations/0033_public_book_index_jobs.sql`
- `deployment/cloudflare/tests/public-book-index-jobs.test.mjs`
- `tools/public-book-index-executor.mjs`
- `tools/public-book-index-extract-worker.mjs`
- `tools/public-book-index-executor.test.mjs`
- `tools/public-book-index-runner.mjs`
- `tools/public-book-index-gateway.test.mjs`
- `tools/public-book-index-cloud-acceptance.mjs`
- `tools/public-book-index-runtime/package.json`
- `tools/public-book-index-runtime/package-lock.json`
- `docs/design-audit/PUBLIC_BOOK_INGESTION_LIFECYCLE_20260917.md`

Required companion changes owned by other agents: migration0032 BOK release
pointer, migration0035 public search, `_public-book-search.js`, public search
endpoint/client, and SEO consumer helpers/middleware. Include their reviewed
manifests in the combined commit. `_word-upload-safety.js` is already tracked at
`deployment/cloudflare/functions/api/_word-upload-safety.js`; Actions copies it
and the lifecycle helper into the ignored `alpha-publish` runtime location.
Existing tracked `app/src/text_import.ts`, `bok_import.ts`, `markdown_render.ts`,
Word model sources, app package dependencies and root frozen pnpm lockfile are
runtime dependencies, not new copies. The workflow builds the Word model and
installs only the isolated pinned jsdom manifest separately.

Never commit `.artifacts/ingestion-acceptance` fixture/secrets/session files,
node_modules, build dist, or the nested alpha-publish repository. No secret value
is present in the listed source files.
