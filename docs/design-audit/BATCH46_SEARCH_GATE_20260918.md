# Batch46 search acceptance — not promoted

- Preview: https://e4d4dc7b.khezana.pages.dev
- Source commit: 0b11a55902d225e80aaa112196b9b83622dc2ff5 (verified on origin/main).
- Payload: f4d6525e8545d861679bc6a3bc8f4439ec0bd9aac739e07603ddc74793663c5a.
- Build and TypeScript passed; 21 focused tests passed.
- All 126 application assets matched local SHA and length. SEO HTTP tests passed.

## Confirmed defect and repair

The read-only live probe isolated `shamela_search_snippet_rows_missing_or_duplicate` to `segments/batch-0003-s0001/snippets/0373.json`, missing document `333:28465`, with zero duplicates. This is not merely a timeout.

Published the previously source-verified recovery bundle to a new immutable namespace `library/snippet-recovery/81735c749b853a08f1bb2c6eb750062ee42dcdc8f3db93d7c5d2b10868907f3e/`: 944 files, 5768551 bytes, all reread and SHA verified through storage. Manifest was uploaded last. Public HTTP manifest and book 333 SHA verified; recovered document is present. Production configuration has NOT been changed to use it.

Batch46 enables the pinned bundle in preview only. Field separation remains inactive. No original book data was overwritten.

## Remaining failed gate

The actual in-app browser query `ألا إن سلعة الله` still logged `search_ui_timeout` at 2026-09-18T10:22:26.374Z. No successful results table was observed. Do not manufacture a browser acceptance receipt or promote this candidate.

Read-only term measurements: سلعة 725688 bytes; الا 126521681 bytes; الله 254206372 bytes; ان 283440813 bytes. The selective path avoids the enormous postings but fans out over candidate snippets. A separate diagnostic using recovery was stopped after exceeding the UI acceptance window, to free the connection for the browser check; it did not yield a success result. Further bounded candidate retrieval work is required, not relaxing coverage or hiding absent rows.

Production remains batch41 (151af741-5955-4c77-aafb-43189c8d51b0). No new live deployment in this attempt.
