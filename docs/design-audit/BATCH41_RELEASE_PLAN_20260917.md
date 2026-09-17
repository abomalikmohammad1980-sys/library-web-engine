# Batch41 release assembly plan — no publication performed

## Fixed inputs / no baseline mutation

- Live authority: `alpha-publish/ops/current-production.json` → batch34, deployment `214d9565-f244-41d5-af51-e86309c463ce`, frozen `.artifacts/batch34/deploy/`.
- Verified Stage A server/data input: `.artifacts/batch40/deploy/`, preview receipt `.artifacts/batch40/preview-verification.json` (`a357b8bb`, Stage B excluded there).
- Newly successful full app build: `.artifacts/stage-b-app-build-20260917-final/`. Use its index/hashed assets/worker/manifest as a coherent unit, not batch40 client JS mixed with the new admin UI.
- Committed reviewed server authority at audit: `ad48eaf` and parents, tracked `deployment/cloudflare/functions/`. The 33 changed server files listed below are byte-identical to their alpha-publish mirrors at inspection.
- This document creates no deploy directory, copies no corpus, modifies no frozen input and changes no Stage B runtime.

## Binding blockers to resolve BEFORE activation

| Purpose | Required binding | Rule |
|---|---|---|
| Immutable public catalog / SEO identity/listings/TOC / public library downloads | `PUBLIC_LIBRARY_R2` | Public corpus bucket verified by batch40 receipt: `khzanah-library`; GET/HEAD-only code paths, immutable checksum verification |
| Private account uploads, claimed indexing sources, generated upload artifacts | `LIBRARY_R2` | Preserve the actual production upload bucket; never replace it with the public corpus merely to make SEO load |
| Authoritative privacy/state/queue data | `VISITORS_DB` | Verified production ID `aeb2bf7d-bfc5-4ec1-9ef5-a81371efe800` |
| Post-commit wake | `BOOK_INDEX_WAKE` | Private production jobs service, not preview |

The checked-in alpha/batch34 config still names `LIBRARY_R2=khzanah-library`. That is NOT evidence that the current dashboard upload binding is safe to overwrite. Verify the effective deployment's binding metadata without fetching secrets. If uploads and public objects currently share a bucket, two binding names do not create storage-level privacy isolation; preserve authentication/prefix checks and explicitly record this fact. Do not migrate source objects/buckets as an incidental release step.

**Concrete current code gap:** `_seo-data-release.js` directly passes `env.LIBRARY_R2` to identity/listing readers, and `_middleware.js` passes it to `readSeoToc`. The public `/library/*` and `/r2/*` handlers already use `PUBLIC_LIBRARY_R2` when provided. Before a split-bucket deployment, minimally review/implement the same public selection for the immutable SEO readers only. Upload TOC/verified artifacts must continue using private `LIBRARY_R2`. Add a two-bucket test proving public catalog reads never touch private storage and upload reads never touch public storage. Do not globally replace `env.LIBRARY_R2` or mutate `env`.

R2 binding itself is not a read-only permission boundary; the read-only property here must be enforced by the handler and key allowlists. Do not publicly expose arbitrary bucket keys. No new private bucket identity is invented in this plan.

## Static payload strategy

The fresh app build **does not contain** `data/seo/release.json`. Therefore copying only its contents would silently lose the verified Stage A release. Assemble once from an explicit source manifest:

1. Use fresh app output for app-owned assets, index, PWA files and existing library data. Verify the built app metadata pins, including the approved biography `e7c669...` fix.
2. Retain verified batch40 `data/seo/` descriptors/shards and Stage A sitemap files, preserving static category sitemap and existing books/authors sitemap links. Retain batch40 `_routes.json` only after comparing required Stage B API/admin routes; APIs must remain handled by real Functions, not HTML middleware.
3. Preserve `SEO_DATA_RELEASE_SHA256=3c6c99ea80fb2f3b723a5c32a5b0eafdb8cbb4c930fcf8172e96c4c27f827d4c` only if descriptor bytes match that hash and every referenced R2 object matches the existing verified receipt. No immutable-data regeneration/upload is needed merely to publish the new application.
4. Compute a NEW HTML cache version from the final server release fingerprint. Do not retain batch40 cache version after Stage B server changes.
5. Produce one final path→source/hash inventory before materialization. Reuse existing immutable inputs; do not create successive full 20,000-file copies for preview experiments. Never edit batch34 or batch40 in place. Preserve required non-hashed assets and prior contract data; exclude unrelated dirty source/data changes.

## Exact reviewed server delta against live batch34 (33 paths)

All paths relative to `deployment/cloudflare/functions/`:

```text
_middleware.js
_seo-data-release.js
_seo-edge-cache.js
_seo-identity.js
_seo-immutable-cache.js
_seo-indexed-sitemap.js
_seo-listings.js
_seo-live-record.js
_seo-presentation.js
_seo-public-listings.js
_seo-public-sitemap.js
_seo-public-toc.js
_seo-removal.js
api/_access-profile-name.js
api/_bok-release-pointer.js
api/_public-book-event-outbox.js
api/_public-book-index-jobs.js
api/_public-book-index-read.js
api/_public-book-index-wake.js
api/_public-book-indexnow.js
api/_public-book-pdf-policy.js
api/_public-book-search.js
api/account/books.js
api/account/books/[bookId].js
api/admin/bok-publication.js
api/admin/book-indexing.js
api/admin/book-submissions/[bookId].js
api/admin/library-books/[bookId].js
api/internal/public-book-index.js
api/library/bok-release.js
api/search/public-books.js
library/[[path]].js
r2/[[path]].js
```

Eight already match frozen batch40 exactly: `_seo-data-release`, `_seo-edge-cache`, `_seo-identity`, `_seo-immutable-cache`, `_seo-listings`, `_seo-live-record`, `_seo-presentation`, `_seo-public-toc`. Thus 25 listed paths differ from/are absent in batch40. The required public-SEO binding fix above would add a new reviewed delta to the data-release helper. Recheck this inventory after that fix; do not call a dirty working-tree recursive copy the reviewed overlay.

Unchanged transitive imports still come from the frozen release (for example `_word-upload-safety.js`, account authentication, `_r2-read.js`); bundle against the final assembled closure and fail on missing dependencies. Workers, workflows and migrations are separate deliverables, not files inside the Pages static payload.

## Database / rollout dependencies

Production schema audit found 0032–0041 absent; prior prerequisites are present. Historical `d1_migrations` is incomplete, so use the exact reviewed ordered files with a saved Time Travel point, not blind bulk reapplication. Keep all production queue/coordinator/workflow gates false until approved migrations and final Pages configuration exist. No migration is applied by this plan.

Production workflow requires separate production gateway secret and gates; preview credentials are not reused. Keep IndexNow disabled until its production key route and privacy checks are accepted. PDF remains bookmarks-only; scanned `ocr_pending` is not an extraction failure. Do not enable unrelated BOK publication just because its tables/helper exist.

## Final acceptance / receipt

- Compile final Functions, verify server mirror and immutable descriptor hashes, full app build/typecheck/tests for the same source revision.
- Combined preview: existing Shamela book/author/category/pagination/legacy redirects, new upload SEO/search/admin, reader/navigation/back/PWA, and immediate withdrawal across cached HTML/search/sitemap.
- Split-bucket integration tests and effective deployment binding metadata are mandatory blockers, not optional cleanup.
- Record final commit, source manifest, static/Functions fingerprints, exact migrations, feature gates, preview checks, rollback point, then request/confirm production publication authority.
- Stage A latency target remains the explicitly documented paused limitation; no new performance work or claim is introduced here.
