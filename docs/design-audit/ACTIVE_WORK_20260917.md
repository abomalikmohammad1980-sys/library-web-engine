# Active completion work — 17 September 2026

This is a work ledger, not a completion or deployment receipt.

## Latest priority: attached SEO specification

User asked to publish first (done batch34), then start the attachment at
`C:/Users/Windows_OS/.codex/attachments/683466eb-d09c-4bf4-acac-057a1b28f4b5/pasted-text.txt`.
Stage A2/A3/A4/A6 source changes now integrated into middleware with19 unit
tests,2 HTMLRewriter suites and app typecheck passing. Partial local build36
session6673 uses publishedbatch34; no new live publication authorized/attempted.
A1 edge cache and A5 bounded listing helpers have12 additional passing tests,
but are NOT integrated or deployed. Read SEO_STAGE_A_PROGRESS_20260917.md,
SEO_EDGE_CACHE_A1_20260917.md and SEO_LISTING_PAGINATION_PROPOSAL_20260917.md.
Continue helper integration, fresh uploaded-record visibility before cache,
categories routes/sitemap/listing data, then fullstageA preview and30URL p95.
Do not confuse local helpers with completed stageA or stageB. New attachment's
OCR requirement is not implemented by old PDF-bookmarks-only adapter.

## Production and source control

- Production is now batch34, deployment `214d9565-f244-41d5-af51-e86309c463ce`.
  User explicitly requested publish first without waiting for indexing, then
  follow the newly attached SEO file. Exact preview-tested batch34 published;
  live payload and book/author/search HTTP verified. See BATCH34_LIVE_20260917.md.
  Older not-live claims below are historical; batch35 remains NOT live.
  Any next candidate must rebase on published batch34, not batch33.
- New origin only: `abomalikmohammad1980-sys/library-web-engine`, main.
- `80c3b10`: edition shard fix, not yet live.
- `3f826e7`: resolved reader metadata offline, pushed, not yet live.
- `5246b46`: redirected offline shell reload fix, pushed, not yet live.
- `252f936`: stale reader-navigation generation guard and focused regressions, pushed, not yet live.
- `5b0876a`: gated ingestion/FTS/SEO server and disabled Actions workflow, pushed,
  not live. Dedicated runner secret configured; both repository gates false.
- No blanket staging: working tree contains unrelated and historical edits.
- `044c81d`: Word map validation and secret-free clean Actions runtime proof, pushed.
- `a08f983`: reader regression contract triage, pushed; production unchanged.
- `225277d`: curated field/public-upload consumers, BOK gates and isolated
  preview helpers pushed. `b371f925` adds reviewed biography metadata binding.
- Root `deployment/cloudflare/` mirrors the nested `alpha-publish/` source.

## Parallel tracks

1. `search_complete`: complete 860-segment field proof, legacy 1–83 source
   reproof, full-overlay acceptance and explicitly gated UI integration. Original
   jobs stopped on segment846; replacement continuation session83139 and
   finalizer93770 resume verified receipts. Large book148870 required bounded
   1000-page derivation chunks. Exact normalizer/source checks preserved; 846
   subsequently passed all512 posting files. Primary0–859 and legacy1–83 completed.
   Full artifact `.artifacts/field-overlay-full-proof-1789638689620` has8594 books,
   7626594 documents,1589552709 positions; all-book consumer SHA/load tests passed.
   Remote immutable upload first500 objects verified. Resume session80877 owns
   transfer; do not launch a duplicate. State is `.artifacts/field-overlay-transfer-`
   plus manifest SHA a81347caaabbdb907b29fe2b4f8309be801c47d41cd051cc99c438e043eb1613.
   All execute invocations use the same escalated Windows user for atomic journal
   updates. Fresh full remote verification is still required before activation.
   Do not start duplicate processes. Also owns verified
   public-upload search consumption, coordinated with the ingestion gateway.
2. `bok_cloud_complete`: isolated real-session cloud acceptance, atomic release
   descriptor, reader/search pinning, then production-gated editor capability and
   reviewed publication jobs. Production has zero BOK drafts/history at inspection;
   no real correction was invented. Actual publication pipeline remains gated.
3. `release_audit`: durable public upload ingestion, bounded real format adapters,
   and broad regression triage. Ingestion migration0033 is NOT applied remotely.
   Supported adapters tested: text, verified-map DOCX, PDF bookmarks-only, BOK,
   Markdown using the actual renderer. EPUB/multipart/large unsupported cases and
   production activation and unsupported formats remain open. Isolated actual
   text ingestion+FTS passed deploymenta958f496,1ready/2searchhits. Runtime CI
   and full cloud-format acceptance are separate from that fixture.
4. Root: combined release, slow/mobile/offline reader checks, metadata and worker
   reload repairs; review and preserve all agents' scoped work.

## Test evidence

- Broad run `.artifacts/regression-20260917.json`: 4657 tests,4453 passed,
  122 failed,82 pending. This is not green. Later focused repairs must be merged
  and rerun; historical failures are not automatically dismissed.
- Word large-corpus isolated rerun:4 passed,2 missing-sample skips, without code
  changes; broad-run time-budget failure did not reproduce in that rerun.
- Initial homepage title test updated to the user's approved brand, not old title.
- Reader metadata7 tests and worker19 tests passed.
- Routing race proved failing before generation guard and passing after; see
  `ROUTING_ADMIN_REGRESSION_20260917.md`.
- Field and BOK detailed evidence resides in their dedicated reports.

## Isolated cloud authorization and constraints

User approved creation of an isolated project/database with no paid upgrade:
`khizana-bok-acceptance-20260917`, D1
`9133fe99-c4e1-4a1e-84f3-127735883279`. No production bindings/data.
Synthetic access session was revoked after acceptance. NEVER commit private
session JSON or seed SQL from its artifact directory.

The user explicitly approved GitHub Actions as the permanent ingestion runner
with narrowly scoped credentials and no paid upgrade. Implement a dedicated
job gateway token only; no broad D1/R2/OAuth credentials in Actions. Runtime
activation remains gated on isolated end-to-end acceptance. The Word helper is local interactive, not a
permanent server. The pinned jsdom26.1.0 acceptance runtime is artifact-local;
root dependency/lock installation has not been changed.

Isolated R2 `khizana-ingestion-acceptance-20260917` created; missing0027,0033,
0035 applied ONLY to isolated D1. Real D1 exposed trigger-inflated change counts;
repaired using RETURNING with strict fenced row identity, then cloud passed.
See `INGESTION_CLOUD_RUN_20260917.md`. Workflow ID360391956 in newrepo had clean
Ubuntu run35207886663 succeed: four text/Markdown/DOCX/PDF-bookmark runtime
fixtures passed without secrets or Cloudflare calls. Ingest job was skipped;
do not enable gates until combined production deployment acceptance.

## Publication gate

Do not activate partial field coverage or claim BOK local tests establish full
library production readiness. Assemble a new frozen candidate from the actual
batch33 source with reviewed deltas, same preview/production bytes, and rollback.
`tools/build-fixes-batch32.mjs` now supports an explicit published baseline via
`KHIZANA_FIXES_BASELINE`, validating its live receipt, and stamps an overlaid SW.
Batch34 built successfully from batch33 plus reviewed reader/SW/router/edition
deltas; preview uploaded to `https://bc2ce6e4.khezana.pages.dev`, production unchanged.
HTTP200, preview noindex, deployed SW repair and actual book151179 reader/TOC
verified. See ignored batch34/preview-check.json; offline installation not closed.
It is a focused acceptance candidate, not the final combined repair release.
Combined batch35 first build passed at exactly20000 assets but lacked newly
identified biography integrity repair. It is preserved (not deleted) at
`.artifacts/batch35-before-biography-fix`; NEVER deploy this superseded candidate.
Rebuild with the two-file biography repair is session85434, output `.artifacts/batch35`.
Read final stage.json before further work. Then prepare isolated preview via
`tools/prepare-batch35-preview.mjs` only after full field remote verification.
Preview uses separate D1/R2 for uploads and optional read-only PUBLIC_LIBRARY_R2
on both /library and /r2 gateways for immutable public corpus. Heading experiment
and BOK flags remain off. Public search/ingestion flags paired in candidate only.
Production schema0032-35 and GitHub gates still unchanged; do not enable blindly.
Uploader session80877 remains active, last1935/8595 verified. After transfer,
run the field uploader with --fresh-verify true and full budget as same Windows
user, then HTTP gateway SHA/sample checks. No duplicate uploader processes.
Main project had19996 files: field overlay
assets cannot simply be copied into it; use the existing approved data store.

Dorar access/export and exact original Word visual oracle remain user-dependent.
No report may describe these or unsupported ingestion formats as complete.
