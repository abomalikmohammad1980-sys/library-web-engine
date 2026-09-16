# Heading search concurrency repair — 2026-09-16

Production baseline: batch26, 036ced36-8bb4-4120-9349-c3eedbd899d8.

Live Chrome reproduction of `/search?q=التوحيد&fields=heading&mode=exact` recorded `library_search_failed heading_search_busy` at 11:29:34 UTC. Results appeared later; this was not proof of acceptable cold performance.

Two scoped fixes:

- Serialize complete composite heading queries. On one provider failing, cancel and drain the sibling before admitting the next query. Previously Promise.all could reject while a sibling still owned its one-flight guard.
- Abort the active search when its route resource scope is disposed. Previously only the preparation task was cancelled.

New regression tests cover delayed sibling cancellation/drain and cancelled queued consumers. Typecheck passed. Focused integration run: 14 passed, two skipped, including real heading matches for all 41 supplemental books (8594 catalogue IDs). Engine run: 31 passed, two skipped, one pre-existing normalizer-source hash failure identical to the documented batch24 failure; not suppressed.

Frozen candidate `.artifacts/batch27` overlays exactly these two source files on verified batch26. Functions fingerprint remains 9f111e69bd7fb318e74a80c4ff6c2d5a409d277b560cc39c9598849d0ce494a9. No database or data changes. Rollback batch26 is retained.

Preview: https://adbb2ff9.khezana.pages.dev . SEO/redirect/sitemap HTTP suite passed (`.artifacts/batch27/preview-http.json`). Browser changed query during loading, navigated to Quran and back, and subsequently rendered 22 heading matches for باب النسخ without a new heading_search_busy error. Generic timeouted console entries and substantial initial delay remain; they are not classified as fixed. Cold sub-second acceptance remains open.

Production publication/verification must be recorded separately; preview success alone is not a production receipt.
