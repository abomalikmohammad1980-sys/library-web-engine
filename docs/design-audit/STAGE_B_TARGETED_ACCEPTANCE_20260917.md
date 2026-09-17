# Targeted indexing cloud acceptance — 2026-09-17

## Scope and isolation

All fixtures belong to `khizana-bok-acceptance-20260917`, D1 `9133fe99-c4e1-4a1e-84f3-127735883279`, bucket `khizana-ingestion-acceptance-20260917`. No production book was changed. IndexNow stays disabled in this environment. OCR is explicitly deferred; PDFs contribute native bookmarks only.

## Repaired cloud failures

- Workers rejected `redirect: error` before GitHub network delivery. Both coordinator requests now use `manual`, reject redirects, and have a real workerd regression with network disabled.
- The preview gateway rejected the prior credential. A new random credential was installed without printing/reading its value; GitHub uses a dedicated `PUBLIC_BOOK_INDEX_PREVIEW_RUNNER_TOKEN`. The legacy/production credential was not copied.
- The acceptance database lacked `review_version`, then `central_authors.hidden_at` and oversight guards. Verified missing schema was installed in isolation only. The adapted 0020 migration omits exactly the already-existing `author_overrides.disabled` column; 0030 follows unchanged. Restore bookmarks are retained in the isolated artifact directory. The authentication harness now preflights these prerequisites.
- Markdown rendered `textContent` concatenated headings and paragraphs. Search-only extraction now preserves semantic block separators while retaining inline word identity and Arabic text. The actual cloud fixture caught this defect; a new revision is being checked.

## Proven full lifecycle

`tools/stage-b-authenticated-cloud-acceptance.mjs --run-isolated-fixture` completed successfully with real short-lived authentication and normal admin/owner endpoints:

- Public fixture `00000000-codex-ingestion-acceptance`, content version **7**.
- Automatic targeted GitHub run **35231410214**.
- Matching generation and manifest digest across job and search receipt, Queue ready, non-null actual indexed timestamp.
- Body search returned two expected documents; public HTML returned 200 with the updated title and exactly one H1; sitemap contained the public URL.
- Withdrawal returned 410 immediately, search count zero, and sitemap absence.
- Private owner edit succeeded and remained unavailable publicly.
- Test sessions/devices were revoked in `finally`; source object was not deleted.

Earlier manual diagnostic run 35229810138 proved extraction only and is **not** the automatic-lifecycle proof above.

## Format evidence so far

- EPUB: automatic run 35231047627, native headings and searchable body verified.
- PDF with bookmarks: run 35231054594, zero body rows and one native bookmark heading.
- PDF without bookmarks: run 35231061987, zero body rows and zero invented headings.
- Both PDFs: verified ingestion job ready, administrative projection `ocr_pending`, OCR false, not failed and not retried as a parser failure.
- Markdown: first run 35231039216 exposed the block-boundary bug; version 2 pending verification after its fix.
- Word: synthetic source plus source-digest-bound page map uploaded; automatic run still pending.
- BOK: real parser tested locally; no synthetic licensed cloud BOK fixture prepared. Do not claim cloud acceptance.

## Release boundaries

- Current live website remains batch34; these results do not mean production indexing is enabled.
- Separate production coordinator was created **disabled**, version `11284fd1-a9c9-461c-b7c3-75d21e8dbc79`, without a public route. Its limited Actions credential still requires user installation.
- Production Queue/config/workflow are prepared with separate disabled gates. No production D1 migration or production indexing activation has been performed.
- Minute/six-hour triggers were explicitly applied to the preview worker. Actual scheduled delivery must still be observed independently of normal publication service wakes.
- Word size limit was raised from the extra 1 MiB ceiling to the shared 20 MiB source ceiling, retaining ZIP/XML/resource bounds. Unsupported structures and larger/multipart sources remain explicit limitations, not successful empty indexes.
- SEO timing targets remain unproven; batch40 measurements were above the requested thresholds. Speed work remains paused as requested.
