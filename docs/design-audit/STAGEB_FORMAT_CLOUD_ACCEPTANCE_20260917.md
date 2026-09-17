# Isolated format acceptance — 2026-09-17

## Scope and safety

- Pages: `khizana-bok-acceptance-20260917.pages.dev`.
- D1: `9133fe99-c4e1-4a1e-84f3-127735883279`.
- R2: `khizana-ingestion-acceptance-20260917` only.
- Four initial IDs and object keys were read-checked absent before upload. Word ID, bundle and both keys were separately checked absent.
- Fixtures are synthetic; PDF pages contain synthetic non-text graphics, not real OCR benchmarks. No production records, files, credentials or paid services were changed by these tests.
- No manual workflow dispatch, runner invocation, wake, or forged index receipt was used by the fixture operator. The initial four jobs were picked up by the normal service wake during the parent's separate authenticated publication test; this is **not evidence of Cron execution**.

## Initial cloud results

| Fixture | GitHub run | Verified result |
|---|---|---|
| Markdown | 35231039216 | Job/Queue ready, but semantic body query failed; acceptance initially failed |
| EPUB | 35231047627 | Body=1, native heading=1, native TOC present in server HTML |
| PDF with bookmark | 35231054594 | Body=0, native bookmark heading=1, server TOC present |
| PDF without bookmarks | 35231061987 | Body=0, heading=0, no fabricated TOC |

All four Actions runs completed successfully on `28ecc26e6c5d2288aff3459e330ba5545c45bf69`. All four Queue receipts reached `ready`, attempts=0. This is transport/execution evidence, not by itself semantic acceptance.

Both PDFs have `jobs.state=ready`, `coverage_mode=pdf-bookmarks-only`, `pdf_kind=scanned`, `ocr_pending=1`, projected status `ocr_pending`, and `ocr=0`. D1 FTS rows contain no PDF `body` field. Both are in the ready-only public sitemap with actual activation timestamps.

All four metadata pages returned HTTP 200, one H1, real unique titles, no R2 object-key leakage; all four appeared in `/sitemap-public.xml?page=1` after activation. These checks were made after the parent repaired missing isolated legacy schema columns.

## Markdown regression and repair

The actual synthetic D1 body was `stagebmarkdownheadingstagebmarkdownbody ...`: DOM `textContent` merged adjacent heading and paragraph blocks. The FTS exact body token therefore correctly returned zero.

Added a failing-before actual-parser regression requiring whitespace token boundaries. The repair derives search text with newline boundaries for semantic blocks/BR, preserving inline word identity and Arabic characters without changing source bytes. Focused tests: 6/6; executor + EPUB tests: 20/20. Additional runtime smoke: 5/6 initially (PDF 30-second extraction timeout), exact timed-out case passed unchanged on a standalone rerun in 15.06 seconds. No timeout limit was weakened.

Repair commit reported by parent: `77e58c7`. The isolated Markdown title was changed through a guarded ordinary `user_books` update to `قبول صيغة Markdown المصححة`; normal triggers generated content version 2/index generation 2. No job/receipt was directly made ready. During reindex, the old heading result and old sitemap entry were correctly absent.

## Subsequent Word and corrected Markdown cloud acceptance

Read-only follow-up after the parent's authenticated publication event automatically woke the existing outbox:

| Fixture | Actions run | Current version / generation | Semantic result |
|---|---|---|---|
| Word | 35236531752 | 2 / 2 | Body=1, native heading=1 |
| Corrected Markdown | 35236539750 | 2 / 2 | Body=1, native heading=1; original concatenation regression resolved |

Both current jobs and Queue receipts are `ready`, without errors; Queue attempts=0. `event_state.index_generation` matches job generation 2, and facts show native TOC. Actual `indexed_at`: Word 1789656809; Markdown 1789656815. Parent verified successful Actions completion; the fixture audit independently verified D1 run IDs, current generation and ready receipts.

Both public metadata responses are HTTP 200 with the expected title, exactly one H1, verified native TOC, and no storage-key leakage. Both current URLs appear in the ready-only sitemap. Body/heading requests each return exactly one hit belonging to the requested book and field. The corrected Markdown title used for this follow-up was `قبول صيغة Markdown المصححة`; source bytes were not changed.

This closes the bounded Word and Markdown semantic cloud acceptance for these synthetic fixtures. Word's single-page source-bound map is not proof of arbitrary Word pagination. **The event-service wake is not Cron proof.**

## Remaining scope

- Cron acceptance remains separate: service-wake success does not prove minute scheduling. Parent owns trigger/tail diagnosis. No manual wake was performed by this fixture audit.
- BOK cloud ingestion was not included in these synthetic format fixtures; real local corpus parser tests are not cloud proof. Editorial reviewed-BOK publication remains a separate gated workflow.

Read-only observer: `tools/observe-stageb-format-fixtures.mjs`; isolated SQL receipts: `.artifacts/stageb-format-fixtures/observe.sql` (use Wrangler `--command` to obtain result rows; `--file` returns import summaries).
