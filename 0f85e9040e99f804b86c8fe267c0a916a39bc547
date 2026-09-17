# Internal-list bulk actions — 2026-09-16

Production remains batch 28. Speed optimization is paused by user direction.

Compared `published_grid_selection.ts` with the frozen batch-28 source before editing; the baseline was identical.

## Fixed locally

- Capture confirmed target books before awaiting central versions. Changing a filter during this wait no longer silently changes the confirmed operation's targets.
- Remove a displayed card only after the server confirms deletion. Remove its selection control as well, preventing Select displayed from reselecting a deleted card while catalog refresh is pending.
- Retain failed cards and their current selection; keep the completion message visible when the last cards are deleted.
- Preserve permission checks, account-switch cancellation, version conflicts and central mutation notifications. No production books were deleted for testing.

## Verification

10 tests passed across published_grid_selection, account_book_delete_ui_contract and central_book_deleted_fallback. Six behavioral selection tests cover filter changes, displayed-only selection, pending confirmation, partial failure, empty-list feedback and account changes. App TypeScript check passed.

Not yet published or accepted in a real browser. This is a focused fix, not proof that all old deletion/selection reports are closed. Remaining: live admin/list acceptance, asynchronous catalog refresh ordering, and the other audit items. Any next deployment must overlay this file on the verified batch-28 snapshot, not replace the published source with the older working-tree files.
