# Mobile reader and instant book suggestions — 2026-09-21

Scope reopened by the user: large-book opening on phones, header book suggestions on phones, and immediate title/author/category matching in the home subject gateway. Previous backlog remains paused; heartbeat automation remains deleted.

## Implemented locally, not published

- Transfer sources over 8 MiB to a module worker for verified JSON materialization, preserving source bytes, page identities and title counts. Terminate on success/error/timeout; transfer source buffers instead of cloning them.
- Remove redundant BOK full-text paragraph splitting and duplicated page text in DOM attributes. Use a page-ID lookup for TOC entries rather than repeated whole-book scans.
- Bound multipart download memory and propagate cancellation into part downloads/body reads. Preserve per-part and reassembled SHA checks.
- Match header compact breakpoint to CSS (1100px); remove the backdrop-filter containing block while the mobile search overlay is open. Keep suggestions inside the viewport.
- Add inline book/author/category suggestions to the subject gateway. Keep withdrawal visibility checks; show loading/retry errors instead of silently hiding the list.

## Evidence

- Forty focused tests passed across search, mobile contracts, materialization, transport, release integrity, seeding and text flow.
- App TypeScript check passed after fixing optional AbortSignal construction.
- Vite client build completed (worker emitted). Subsequent small cancellation/worker-send cleanup changes require a final release rebuild.
- Actual immutable Fath al-Bari source: book1673, 67,814,591 bytes, SHA7e2113b6a2504d5788317a663f74a170bede648acafb75d242563e4eb6d790cd. Real-source test passed:7996 pages,5110 titles, unique page IDs, original bytes preserved. Materialization668ms on this workstation, NOT a phone or network measurement. Test takes KHIZANA_REAL_BOOK_CHECK=1 and KHIZANA_REAL_BOOK_PATH; no large source is copied into git.
- In-app browser at390×844: header overlay opens, input accepts the title, loading and failure/retry message occupy the viewport correctly. Local suggestion success was NOT accepted: local server has no functioning visibility API.
- Read-only production probe: /api/library/central-overrides returned HTTP500 and provider1101. /api/account/readiness explicitly returned database_quota_exhausted. This blocks real visibility-backed suggestion acceptance. Do not bypass withdrawal checks or claim the quota explains all reader slowness.
- Added abort-discovery regression passed (release tests now5; focused total41 plus real-source test1).
- Actual local reader opened book1673: source-ready1989ms, BOK DOM shells33ms, first paint1138ms after text preparation began. Screenshot showed its cover/title, not a loading spinner. This is workstation/local transport evidence, not physical-mobile speed. After setting390×844 and attempting page50, the UI moved to the account sign-in gate (readiness unavailable). Navigation beyond that gate was NOT accepted and was not bypassed. Temporary viewport was reset.

## Still required

1. Successful visibility-backed header/subject suggestions for title, author and category, including selection navigation.
2. Browser end-to-end book1673 first open, usable reader navigation and repeat open. The real-source CPU test is not browser acceptance.
3. Final build, frozen preview, regression checks and only then production publication/receipt if authorized. Production remains batch80; these edits have NOT been published.

No paid upgrade, production fixtures, source-text changes, library-wide field activation, destructive cleanup or automatic-monitor restart was performed.
