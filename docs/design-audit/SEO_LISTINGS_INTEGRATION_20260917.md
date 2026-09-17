# Stage A bounded data integration — local acceptance

This is not a deployment receipt. Production remains batch34 and the earlier
seo-indexing-preview deployment remains c4ed0cb1. Stage A is not complete.

## Implemented

- Exact batch34 shard checksums and counts feed a separate staging artifact.
  No mutable working catalog is substituted. Preparation neither uploads nor
  activates data, and refuses to overwrite an existing candidate.
- One descriptor binds immutable identity packs and 512 bounded listing objects.
  Full catalog: 8594 books, 3174 authors, 40 categories, 3490 listing pages.
  Identity reads max7282+3480 bytes; listing object max39277 bytes.
- Middleware consumes the release only when SEO_DATA_RELEASE_SHA256 is supplied.
  A corrupt/missing enabled release fails closed, never falls back to old shards.
  Search/private SPA routes do not depend on the release.
- Authors/browse/new-books and author-book lists paginate100rows, canonical
  page1 omits query; later pages retain page. Missing/invalid pages return404.
- Related books: up to12 same-author and12 same-category, excluding currentbook.
- Fresh visibility filtering prevents withdrawn aliases appearing as links.
  Lists may therefore show fewer than100visible rows; no completeness claim for
  dynamically added uploads (their merge remains open).
- Supplied stale uploaded metadata cannot bypass authoritative approval,
  visibility and deletion checks. Numeric public-upload IDs explicitly use the
  upload identity path; D1 supports fresh first-primary sessions.

## Evidence

Prepared `.artifacts/seo-data-stage-a-20260917-v1` from batch34 deployment:
descriptor SHA256
`3c6c99ea80fb2f3b723a5c32a5b0eafdb8cbb4c930fcf8172e96c4c27f827d4c`.
514 R2 objects, one additional Pages descriptor. Uploaded=false, activated=false.

Real HTMLRewriter+R2 acceptance enumerates all251 fixturebooks across3pages,
excludes one freshlywithdrawnbook, checks250 unique links, selfcanonical,
404 bounds,24relatedlinks,previewnoindex and missingpack503. Existing SSR
acceptance and fresh upload/cache regressions also pass. Client metadata9tests
and app typecheck pass. This is focused acceptance, not whole-project green.

## Remaining before next preview

- Categories SPA routes, server pages and category sitemap.
- Versioned edge HTML cache orchestration with fresh complete dependencies.
- Upload/verify staged immutable objects; frozen batch34-based candidate build.
- New preview,30URL cold/warm p95; no measured performance success yet.
- Dynamic uploaded-list merging and all attachment Stage B acceptance.

No production migration, flag activation or production deployment in this step.
