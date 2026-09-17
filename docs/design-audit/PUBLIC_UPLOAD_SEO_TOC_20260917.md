# Public-upload SEO TOC consumer — 2026-09-17

Implemented, locally verified, not yet deployed by this task.

The existing public-upload route `/books/public/<id>` now reads the current verified public-book-index artifact when `PUBLIC_BOOK_INGESTION_ENABLED=true`. The shared ingestion reader checks current eligible/ready generation, fixed hash-derived object key, bounded bytes, SHA-256 and a post-read generation fence. Missing, pending, stale or corrupt artifacts produce no TOC, never a guessed or complete-coverage assertion. Public book metadata remains independently available; private/unapproved/hidden records remain absent/noindex.

Only heading labels are projected. Body rows and source object identities are not included. Text headings link through the reader's actual `para` or `pageIndex` parameters (optional `volumeIndex`); headings without a real position remain plain text. PDF artifacts supply bookmarks only, using page positions and never treating paragraph offsets as PDF pages. HTML escapes labels and links. At most 200 headings are rendered per TOC page, with previous/next links. Existing sitemap generation/count behavior is unchanged.

Public-upload metadata overrides now recognize raw, `central-submission:` and `account-book:` identities, preventing an alias-hidden book from being revived by the SEO metadata lookup. Numeric Shamela identities retain the previous mapping.

Evidence:

- `node --test tools/seo-public-upload-toc.test.mjs tools/seo-live-record.test.mjs tools/seo-public-sitemap.test.mjs`: 11 passed (ready anchors, no source body, pending zero R2 reads, post-read eligibility change, corrupt hash, PDF-only semantics, hidden aliases and sitemap behavior).
- `node --test --test-name-pattern='projects verified' tools/seo-server.test.mjs`: 1 passed using actual local Workerd HTMLRewriter and R2 binding. Checks real HTML headings, 200-item pagination, sanitization, pending omission and private 404/noindex.
- Generation SQL eligibility/lifecycle is additionally exercised by the ingestion owner's real SQLite/gateway tests; projection tests do not claim cloud activation.

Operational gate: ingestion migration, trusted runner and production enablement belong to the combined release. This consumer does not create a runner, enable flags, publish artifacts or guarantee Google crawl timing.
