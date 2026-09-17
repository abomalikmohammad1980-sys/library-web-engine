# Regression triage: routing/admin/book metadata

Starting report: `.artifacts/regression-20260917.json` (122 failing tests). This
checkpoint closes only the scoped subset below, not the broad suite.

## Actual defect repaired

`render()` awaits category/author metadata before entering `renderReader()`.
If navigation changed during that await, the old reader still recorded a book
opening and replaced the newer screen with its loading paper; its generation
check ran only after the reader module import. The new early generation fence
precedes both effects.

The deferred-metadata regression failed before the change with
`opened=['local-book']` instead of `[]`. After the fix it verifies zero stale
activity, no extra reader import beyond the legitimate initial preload and an
unchanged current author screen. Existing pending-module navigation race checks
remain active.

## Stale test harness/contracts repaired without changing those features

- Router fixture had stripped imports but omitted `validRouteShape` and the
  History-path helpers, causing ReferenceError. It now supplies actual pure
  helpers and models old-link conversion before pathname-based rendering.
- Unknown route expectation is the approved not-found behavior, not the obsolete
  home fallback. Tests still verify retry and no reader prewarming on author pages.
- Administration uses the canonical central record ID for version lookup,
  50-account pages, duplicate-filtered submission rows and role-gated oversight.
- Published book controls were extracted into their own module. Tests now follow
  the extraction and assert the permission/session gate instead of requiring an
  obsolete direct call in the profile screen.
- Counts use extracted edition metadata consistently in reader/profile. Tests
  preserve the greater-than-one volume and missing-page-count requirements.

Runtime baseline comparison against published commit `c12e565` for admin_books,
book profile, published_book_controls and router shows only the new three-line
router guard; the admin/metadata behavior above already existed in batch33.

## Verification

Seven scoped Vitest suites, **20 passed**:
reader_idle_router_integration.review, admin_accounts_compact,
admin_books_ordering_links_contract, admin_book_context, admin_review_compact,
account_ui_contract and book_metadata_counts_contract. No skips or disabled
assertions were added. Full project acceptance remains open.
