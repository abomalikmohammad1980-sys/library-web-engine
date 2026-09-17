# Batch35 bounded release audit

No deployment, production mutation or blanket test rewrite was performed by this audit.

## Relevant combined tests

Command from repository root:

```powershell
node --test --test-concurrency=1 alpha-publish/tests/public-book-index-jobs.test.mjs alpha-publish/tests/public-book-search.test.mjs tools/public-book-index-executor.test.mjs tools/public-book-index-gateway.test.mjs tools/public-book-index-runtime-smoke.test.mjs tools/seo-public-upload-toc.test.mjs tools/seo-live-record.test.mjs tools/seo-public-sitemap.test.mjs tools/seo-server.test.mjs tools/seo-toc.test.mjs tools/build-seo-toc.test.mjs
```

Result: **77 passed, 0 failed, 0 skipped**, 27.8 seconds. This includes actual
HTMLRewriter, source/manifest verification, privacy withdrawal, D1-trigger change
semantics, resumable FTS staging, real format parsers and generated runtime smoke.
The parent reports clean GitHub/Linux runtime run `35207886663` passed. Static
workflow review confirms pinned action commits, contents:read only, no PR event,
no persisted Git checkout credential, no secret in the manual runtime job, one
dedicated secret in the gated ingestion step, 12-minute timeout and repository
concurrency with cancel-in-progress:false. Both ingestion gates remain false.

## Fresh bounded comparison with broad regression

The available broad report `.artifacts/regression-20260917.json` is historical:
4,657 total / 4,453 passed / 122 failed / 82 pending. It is not a current claim.
The following targeted rerun was performed without rewriting its expectations:

```powershell
node node_modules/vitest/vitest.mjs run packages/source-sync/src/quran-resource-registry.test.ts packages/source-sync/src/quran-tafsir-manifest.test.ts app/src/local_normalized_upgrade_failure.review.test.ts app/src/private_library_snapshot_scope.test.ts app/src/shamela_biography.test.ts app/src/shamela_biography_preload.test.ts app/src/home_library_read_dedupe.test.ts app/src/people_stored_author_lookup.test.ts app/src/translation_target.test.ts app/src/quran_istiab_selector.test.ts app/src/quran_ruh_reviewed_links.test.ts app/src/quran_zamanen_reviewed_links.test.ts app/src/reader_return_bar_contract.test.ts --maxWorkers=1 --minWorkers=1 --reporter=json --outputFile=.artifacts/batch35-audit-regression-subset-after-biography.json
```

After the scoped biography fix below: **35 total / 19 passed / 16 failed**.
Remaining failures are not collectively declared runtime regressions:

- Five author lookup failures come from an eval harness omitting the actual
  imported `currentAuthorName` dependency; runtime imports it explicitly.
- Two old Word-cache fixtures use a raw source hash whereas the actual cache
  fingerprint includes `word-text/20260910-numeric-soft-hyphen`; reuse of that
  obsolete cache is intentionally invalidated.
- Home panel count, private snapshot return-shape, translation source string,
  tafsir selector/count assertions refer to old implementation/data contracts.
  They still need scoped acceptance updates, not blind assertion replacement.
- Two Quran-resource validator failures are real validator/schema incompatibility:
  quran-gharib mapping has wordPath/meaningPath, but the validator calls
  contentPath.trim(). Search finds this validator only in its module/tests, not
  the running app. Do not call the whole suite green; this remains tooling work.
- Tafsir manifest expectation lists only three old sources while data has seven.

## Verified runtime blocker and narrowly approved repair

Frozen batch33, not merely the dirty worktree, had biography metadata mismatch:

- Actual metadata SHA: `3599e8be28beb809bf8b57150d02cbef6c1ca73f4dc74819ae3a319ca854fb80`.
- Biography manifest declared: `c835c76b858a4922f48bfd217ab99ffd8e7424ea42b6a6da9928d68f3ba881c5`.
- Runtime compared them and rejected every biography/preload with integrity error.

All 2,716 frozen biography assets were independently checked for SHA, byte length,
author identity and source provenance against all 3,174 metadata identities;
zero issues. All 458 unavailable IDs remain present. Parent approved changing
only the manifest metadata binding plus its runtime checksum pin. Before editing,
both current files were byte-identical to frozen batch33. Deep JSON comparison
confirms only metadataSha256 changed; no biography text or asset changed.

New biography manifest SHA:
`e7c669fa5bb1f72ee5c13761a2cd18f57b3b750cda8c7533bfefd598bb16b2ac`.

Exact runtime overlay delta: `app/public/data/shamela-biographies.manifest.json`
and `app/src/shamela_biography.ts`. Regression invariant added in
`app/src/shamela_biography.test.ts`. Both biography suites now pass **5 tests**.
The audit did not modify the running batch35 build/frozen candidate. Root must
apply these two explicit deltas and rebuild after preserving its first candidate.

## Real acceptance boundaries / priorities

1. Include the approved biography pin repair in the combined candidate; verify
   final field-object upload receipt and candidate/source hashes before release.
2. Production migrations, consumer flags and runner gates need final combined
   release verification. A disabled workflow can be published safely but does
   not constitute running automatic ingestion.
3. Real isolated cloud ingestion proved a synthetic 48-byte text fixture and two
   search hits, not cloud Word/PDF/BOK acceptance. Linux smoke and local format
   tests are additional, different evidence.
4. Supported extraction is bounded UTF8/Markdown, BOK aliases, mapped simple DOCX,
   and PDF bookmarks only. General input cap 20 MiB; DOCX cap 1 MiB with required
   verified map; excluded Word table/drawing/field/tab/symbol structures fail
   explicitly. Multipart assets and EPUB remain unsupported. No caps were relaxed.
5. Five jobs per 30-minute schedule is not instant processing or a 100,000-book
   throughput claim. Broad regression, installed offline/PWA, slow-network and
   multi-account cloud acceptance must not be marked closed by these tests.
6. Authorized Dorar access and the exact original Word reproduction document
   remain external evidence prerequisites, separate from this release's code.
