# SEO batch37 — local candidate, not deployed

Baseline is published batch34 (`214d9565-f244-41d5-af51-e86309c463ce`).
Previous source commit1348c208e9281a3c608ae556ba195871a7f2dc5a successfully pushed
after retrying the failed network connection.

## This continuation

- Real category SPA routes/screens reuse bounded server-public listings, never
  personal library data; safe links/text only, navigation cancellation and timeout.
- Category HTML,40 category sitemap entries and categories landing page.
- Fixed client metadata which had been stripping allowed pagination canonicals.
- Integrated versioned Cache API for packaged book/author pages. Every cache hit
  rechecks authoritative metadata and related-list visibility. Cache miss renders
  the exact snapshot, then rechecks before storage. No public-upload cache yet.
- Real runtime tests prove the warm request avoids shell rendering, a changed
  title appears immediately, and withdrawn main-book cache returns404/noindex.
- Outward private/no-store remains intentional to prevent stale public CDN or
  browser copies following withdrawal; internal edge copy TTL86400. This differs
  from requested public/SWR headers; Cache API does not implement SWR itself.
- Independent515object upload/freshverification tool, defaultdryrun. Only immutable
  approved SEO keys in existing khzanah-library; never replaces differing objects.
- ThirtyURL reproducible preview measurement tool; reports clientobserved first
  and repeated TTFB, explicitly NOT guaranteed coldcache. No speed result yet.

## Validation

36 focused Node tests,24 client Vitest tests, app typecheck passed. Frozen build
passed. Finalized candidate has19999Pages assets, within existing filebudget.
No claim that all historical project tests are green.

Candidate `.artifacts/batch37/deploy`:
- payload113bf873a6d40c2424fce482a744393253d09d2f8faa82d0b16950cb618a9f05
- deploy5cc0239020bbd8a88e3f948053c60b2892a0a62d0efa3c0a4db31dba7726e387
- functions99e127319145af0fcefc665b62a1d27562923b3f0a7a3d5d23387b84709a369b

Configuration is preview-only: isolated9133fe99-c4e1-4a1e-84f3-127735883279 D1,
existingpublic R2, no Access audience,AI or ingestionactivation. No migrations.
R2 transfer runs in session50970, max1800seconds. Resume only after it exits;
same Windows user required. State under `.artifacts/seo-data-transfer-` plus
descriptor3c6c99ea80fb2f3b723a5c32a5b0eafdb8cbb4c930fcf8172e96c4c27f827d4c.

## Remaining acceptance

Full fresh readback515objects, preview deployment, HTTPand browser checks,
30URL measurements and actual coldcache proof. Dynamic newlyuploaded listmerging,
updated related-link labels and StageB indexing remain open. Production unchanged.
