# Heading scope timeout repair — batch 29

Baseline: production batch 28, `c106b186-a84c-42dd-92bb-f42d6f20469b`.

## Cause and scope

The heading engine disables its single-token posting-count shortcut whenever bookIds are supplied. The UI supplies bookIds not only for explicit filters but also when the visible catalog differs from central coverage (for example, withdrawals). It therefore authenticates and downloads every candidate row before returning the first page. Body search uses a different path. The visible user browser query additionally included heading/tag/category/card for `الحج عرفة`; the screenshot alone does not identify which phase consumed its 120-second UI deadline.

## Repair

Build-time ownership ranges are derived from every authenticated row shard of the primary and supplemental manifests. They cover 3,921,796 + 144,055 heading rows in a 176,247-byte source JSON. Books with no headings correctly have no range. Runtime checks bind the ranges to the exact manifest SHA, validate contiguous coverage, and filter posting IDs before fetching rows. Single-token scoped queries retain exact counts and pagination while fetching only requested rows. Phrase matching still authenticates candidate text; no fake counts, hidden-book inclusion or timeout increase.

The frozen batch includes the previous published-grid selection/deletion repair. Earlier batch-28 repairs and all published data/functions remain inherited unchanged. The build regenerates ranges and keeps a rollback snapshot. No server migrations or book deletions.

Additional mixed-field fix: author chronology was resolved for every book even when none of its requested structural fields matched. Resolution now occurs only after a matching field is found. A behavioral test with 1000 nonmatching cards confirms zero biography lookups; metadata/chronology/federation tests passed (8). `finalize-search-batch29.mjs` overlays this additional source on the unpublished frozen candidate and rebuilds/re-fingerprints it; do not deploy the preliminary stage fingerprint.

Browser baseline in an independent session also recorded repeated `search_state_changed / Search superseded`. `prepareLocalBookSearchIndex` invalidates the derived body index upon completion; heading queries previously used that same generation guard. Structural queries now track actual library changes separately. Account changes and explicit cancellation still invalidate all searches. Regression tests prove that concurrent body preparation no longer cancels headings and real library/account changes still do (5 federation/invalidation tests passed). Text search/metadata regression tests also passed (11). Final candidate is produced by `complete-search-batch29.mjs`, which runs app typecheck before rebuilding and re-fingerprinting. Earlier candidate fingerprints are superseded; nothing has been deployed until a receipt says otherwise.

## Verification so far

- Unit case: 100 row fetches reduced to 3, same exact scoped total (98) and first-page hits, final page and unknown-book scope verified.
- 41 heading engine/concurrency/range tests passed; 3 skipped (including the documented pre-existing normalizer-source hash mismatch, not changed).
- Bootstrap/federation/supplement selection: 8 passed, including all 41 supplemental books with exact anchors; 89 fixture requests.
- Ownership and bulk selection: 9 tests passed. App typecheck passed. Frozen Vite build passed; deployment staging/verification pending.
- Live primary-index HTTP test, `التوحيد`, all but one book: old path timed out at the test's 20-second deadline after 202 requests/115 row requests; repaired path completed in 6399 ms with 55 requests/24 row requests, 3616 exact total, 40 hits, all in scope.
- Live primary-index HTTP test, `الحج عرفة`, same scope: repaired path 13094 ms, 173 requests/87 row requests, 21 exact results in scope.

These are engine tests against live assets, not proof of full browser latency or closure of the user's specific session failure. Production receipt and browser acceptance must be recorded separately. The cold subsecond objective remains unachieved.
