# Search startup retry — 2026-09-18

Preview batch45 (`https://7b6c9a48.khezana.pages.dev`) did not pass browser acceptance: the exact query `ألا إن سلعة الله` ended with `search_ui_timeout`. Console also reported `shamela_search_manifest_unavailable`. Do not promote batch45.

Independent HTTP retrieval of its packed manifest succeeded (200, 688886 bytes, 3.69 seconds). This does not prove all search requests succeed.

Fixed a separate reproducible retry defect: a failed V2 startup manifest promise remained cached forever. Failure now releases the manifest promises and their logical cache entries, so the same client can recover when connectivity returns. No integrity checks were removed.

Regression plus environment and progress-download tests: 14 passed. The new regression fails the first startup, restores the network fixture, and verifies successful search initialization on the same client.

This fix has not yet been deployed or verified in the live browser. Production remains batch41. Field source upload and independent overlay verification were paused for isolated browser testing and still require completion; field overlay is not enabled in production.
