# Reader 2146 interaction acceptance — 2026-09-21

Scope: slow internal reader and information card, requested at `/books/2146` (84-page BOK); compact information-card layout. Not a claim that every cold network load or every site performance issue is solved.

## Changes

- Native-flow BOK/EPUB/text pages bypass fixed Word geometry, surface growth, and ResizeObservers. Word pages retain their existing layout contract. CSS lays out text slots naturally and follows reader zoom.
- Text zoom preserves the current page and does not mount all distant pages.
- Public Shamela route metadata loads concurrently with visibility/local lookup; book hydration remains after the visibility fence. Offline path preserved.
- Independent verified Word/map/companion-PDF requests run concurrently; integrity checks unchanged.
- Card actions immediately under the cover, 46px targets/24px symbols; four compact metadata labels use named, focusable tooltip icons; count includes “صفحة”.
- Previously tested scalar SEO override lookup included; avoids json_each virtual-table enumeration without caching away withdrawal checks. D1 live row-read reduction is NOT yet measured.

## Evidence

- TypeScript noEmit passed.
- 57 focused tests passed before the final zoom-anchor addition; final flow+navigation14 tests passed (including new anchor contract). SEO/listing12 Node tests passed.
- batch78 preview `https://270cfde0.khezana.pages.dev`: original card click364ms; close295ms; jump42 228ms; jump84 253ms. These are automation round-trip times, not laboratory INP.
- Screenshot confirmed larger actions below cover and compact facts. It also revealed post-zoom drift84→82, so78 was NOT promoted.
- Final batch79 preview `https://d5ff74ed.khezana.pages.dev`: real book loaded; jump84; zoom110%; status84/84 immediately and on the next independent check; card353ms and visible; close and first-page return1/84 worked. Browser: Codex in-app only. No test users or cloud writes.
- Final local manifest20,000 verified; remote preview145 fingerprints verified.
- Payload SHA256 `048330cc137b328cfe6572b1a8c2aa17059e575a359c74c800d930acc3bfa436`; functions `466bfcd31f1442022fcebc651c17fb0cb4371dc1f106fe2e8aa395224d237d25`.
- Direct HTTP samples on78: book226,688bytes4.929s; public author metadata1,844,148bytes5.853s. Cold loading still depends on network; these measurements do not prove total first-paint latency.

## Publication

Published79: `https://b5b7195f.khezana.pages.dev`, source `e62e217b99f87fd5611f760b95a085106415f8f7` verified on origin/main. Live145 assets matched at06:29UTC. However, production reader tabs became unresponsive/crashed while preview interaction passed. Thus reader acceptance remains OPEN. Live HTML served the same main bundle as preview; no proof that stale service-worker code caused this.

Next candidate80 guards automatic background search indexing BEFORE reading all local book bytes. Previously the unconditional three-second timer called IndexedDB getAll even on reader routes; this can be expensive with an existing local library, unlike an empty preview origin. This is a verified code-path flaw, not yet proof of the sole crash cause. Reader/hidden-tab pause and library return/resume are covered by four new tests; all23 background/flow/navigation tests and TypeScript pass. No local storage was cleared and no user book was deleted.

Rollback79 is production77 (`1df777d7-7a7b-4d0d-827d-ecab9e747e2b`), not78 (preview only). Field activation and full-library BOK release remain disabled.

## Closed: scoped reader interaction / batch80

- Production80: `https://96477f82.khezana.pages.dev`, ID `96477f82-327d-479a-8e6b-5a27b981dccf`. Source `556a6d8052c723caa1bda6be03fc36c868db4554` independently verified on origin/main. Rollback80→79, directory `.artifacts/batch79/deploy/pages-dist`.
- Preview `73fe5bf1.khezana.pages.dev` passed 75% zoom/card, last page84, reset100% retained84; no console errors. Frozen20,000 files; preview145 and live145 fingerprints passed. Live check08:32:10UTC. Payload `3230a11a971c4d7de2e5f63e9ee24723ece46da040888c9e9ea1379330c58aa5`.
- Live **khzanah.com/books/2146** loaded real text with saved75% preference, remained responsive across calls (unlike79). Card opened in603ms automation roundtrip; screenshot shows actions directly beneath cover and four compact facts including84 pages. Jump42→84 and zoom retained84; independent later observation still84; return1 worked. Browser error log empty.
- Close the reported interaction freeze/layout issue for the verified book and tested controls. Do NOT generalize this to all devices/books or claim a measured cold-load/INP score. Background scan was a verified expensive path; the observation supports the fix but does not isolate all possible crash causes. User storage and cloud books were not altered.
