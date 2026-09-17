# Public upload search consumer — 2026-09-17

Implemented (not production-enabled):

- Migration `0035_public_book_search.sql`: derived FTS5, generation/SHA receipts, resumable staging cursor, and visibility epoch.
- Verified ingestion calls `preparePublicBookSearch` after artifact readback. It stages at most 1,000 rows / 8 MB per invocation using bounded JSON bulk statements, validates the current lease on every write, and returns `pending` until every row is present. Extraction-ready alone does not imply searchable.
- Endpoint `/api/search/public-books` joins the current eligible generation, ready extraction receipt, matching FTS receipt, and manifest SHA. Private, rejected, deleted, overridden-hidden, stale, corrupt-bound, and unfinished books cannot appear.
- A visibility/generation change during a query or between pages yields 409 and invalidates the snapshot. HTTP caching is disabled.
- Text uses body and headings; PDFs use bookmarks only. Title and author are separate card rows. Body + heading searches avoid duplicate PDF bookmark rows.
- Queries return IDs, reader anchors, metadata, and bounded query-centered snippets retaining original diacritics. Sparse character offsets are internal and removed from responses. Full paragraphs and storage keys are not returned.
- Client/store/UI integration exists behind `globalThis.__PUBLIC_BOOK_SEARCH_ENABLED__ === true`. The server requires `PUBLIC_BOOK_SEARCH_ENABLED=true`. Both remain disabled unless explicitly configured after acceptance.
- Mixed old-index/public-upload pagination retains all 2,600 fixture paragraphs, with visible page size still controlled by the existing 100-row UI. Public cached aliases are excluded when the authoritative server consumer is enabled; private account copies are not excluded.

Verification:

- 14 server tests exercise actual SQLite migrations, 1,300 rows across 13 pages, staging continuation, privacy/generation fences, hidden aliases, mid-query withdrawal, PDF-only coverage, query-centered Arabic snippets, and D1 trigger-inflated `meta.changes`.
- FTS writes use `RETURNING row_id` to count owned writes; D1's trigger-inclusive mutation metadata must not be used as the row count.
- Five client adapter tests and five field/mixed-store integration tests passed. Application typecheck passed.

Limits and activation gates:

- Exact token phrase search is implemented; unsupported server modes are rejected rather than silently approximated.
- A single encoded derived row above 900 KB fails explicitly; it is never truncated and marked complete.
- Public artifact extraction does not yet establish body-versus-footnote structural coverage. Those scoped requests remain incomplete rather than including an unsplit public upload.
- Author death filters cannot be inferred from missing upload metadata; these are not claimed complete.
- Cloud acceptance and release configuration are parent-owned. This document is not evidence of production activation or deployment.
