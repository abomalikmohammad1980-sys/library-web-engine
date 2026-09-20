# Quran follow-up — 2026-09-20

User requests faster subsidiary screens, especially Quran mode switching, and reading as default. Implemented:

- Missing/invalid/inaccessible mode preference defaults to reading; explicit saved choices remain respected.
- Mode switches paint only the page, not verse navigation, tafsir panel or audio player. Same-mode clicks do nothing. Revision fences prevent an older pending SVG from replacing the latest selection.
- The reviewed source-book link map (4,540,345-byte JSON plus related maps) is now dynamically imported only when source-edition commentary needs it. Commentary text renders first; detached/obsolete toolbars cannot be updated. Link verification/notes/shared ranges are preserved.

Measured build: pass7 Quran module5,787.18kB/gzip1,179.72kB; pass8 Quran758.95kB/gzip190.78kB, with source link map in separate5,029.67kB/gzip988.54kB chunk. This proves an84% reduction in initial compressed Quran code, not a user-latency benchmark.

Typecheck passed.21 Quran preference/session/navigation/source-link tests and2 theme bootstrap tests pass. Batch64 assets20,000 verified with16 fonts. One physically duplicated morphology gzip is replaced by an explicit301 to identical verified bytes to remain inside the free Pages file cap; both public request paths remain supported. Preview/live verification pending at this entry. No claim that Sunnah or all mobile performance is complete.

Preview64 https://d412928f.khezana.pages.dev passed in-app browser: new origin starts reading; reading→uthmani→imlai→reading retained3:152, printed SVG restored, no errors. Source-edition Kashshaf loads commentary and verified link /books/23627?pageIndex=428. Morphology alias301→200 application/gzip verified.64 remains preview only;65 incorporates optional Sunnah chronology enrichment after first cards and handlers, guarded against detached UI and restarting an active text search.8 additional Sunnah/chronology tests passed; build pass9 is the candidate input. Overall mobile CSS/first-catalog and D1 quota recovery remain open.

Batch65 preview https://d2f44208.khezana.pages.dev passed 20,000 local files and 144 remote asset hashes. In-app browser verified default reading and all three modes retaining3:152; Sunnah displayed40 initial cards and category selection علوم الحديث updated the cards. Source273dee87b9e60830135f0dc59afe8f82c46782c3 is verified on origin/main. Exact frozen payload63dfe0de436b205aad9f05fce59c1979089f48b7651820c459c8b7d4b513fe01 is approved for production. Publication/live evidence is recorded separately in ops/current-production.json and .artifacts/batch65/deployment.json; this paragraph alone is not proof of live deployment.
