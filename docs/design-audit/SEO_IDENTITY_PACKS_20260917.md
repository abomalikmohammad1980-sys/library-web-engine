# A1 bounded packaged-public identities

Status: helper and local tests complete; not integrated, uploaded, or deployed.

`buildSeoIdentities({books, authors, generatedAt})` takes reviewed public metadata rows from the frozen batch34 catalog. It returns one descriptor asset and two immutable R2 binary objects (object keys include each pack SHA-256). It does not mutate source text or write files. Callers must upload and verify both objects before publishing the descriptor. Explicit private flags are rejected; this is not a database eligibility resolver for user uploads.

`readSeoIdentity(bucket, descriptor, kind, id)` reads a bounded index slice and then a bounded identity slice, verifies SHA-256 and ID, and returns metadata plus per-record `contentVersion`. Unknown IDs return null. Missing or corrupt packs throw and must not be rendered as successful empty metadata. The descriptor must come from the reviewed server asset, never request input. Use the public catalog R2 binding. Each read is strictly below 200,000 bytes; ignored ranges are cancelled rather than consumed fully.

Author records intentionally exclude book arrays. A5 author pagination supplies those links separately. Cache keys must also include template/listing release identity when related links change; the identity hash alone only tracks the entity metadata. Public-upload eligibility and withdrawal checks remain on their separate database path and must precede any public cache response.

Integration remaining: parent-owned build-seo-index writes descriptor, uploads immutable objects with verified receipts, middleware calls reader instead of large shards, and A5 adds author/related-book links. No runtime latency claim is made from local in-memory tests; preview cold/warm 30-URL p95 measurements are still required.

Validation: `node --test tools/seo-identities.test.mjs` passed 4/4, no skips. Full frozen `.artifacts/batch34/deploy/pages-dist/data/seo` round-trip covered 8,594 books and 3,174 authors. Descriptor: 27,959 bytes; maximum index read: 7,282 bytes; maximum identity read: 3,480 bytes; two R2 objects total: 10,880,755 bytes; Pages assets added: one. Tests also cover corruption, ignored ranges, missing packs, oversized entities, private flags, deterministic bytes, and author-list separation.
