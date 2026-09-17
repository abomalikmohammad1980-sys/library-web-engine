# Reader loading and Word braces — 2026-09-17

## Verified changes

- Removed RTL `{`/`}` code-point swapping in `runT.ts`; the browser retains responsibility for bidi glyph mirroring. Source text, copying and reflection preserve original characters. See `docs/word-behavior-spec/rtl-brace-source-preservation.md`.
- Both lazy reader-route loading and reader source loading now use a themed, accessible status and skeleton instead of an empty white paper. Slow-load explanation appears only after six seconds. No fictional percentages. Scope disposal and surface replacement cancel pending work.
- Local cached-book lookup runs concurrently with publication visibility lookup; no book is returned before visibility checks. Hidden/deleted and offline cases remain covered.

## Evidence

- Word suite: 138 passed, 22 skipped; six targeted preservation tests and package typecheck passed (agent run).
- Reader loading/lazy-route/offline suites: 12 passed. Earlier pack/fast-route/offline run: 22 passed.
- Chrome isolated browser local fixture at port 5196 used the actual loading helper and application CSS: immediate status, delayed explanation visible, no horizontal overflow; screenshot inspected. This is component acceptance, not a measured slow-network full-book acceptance.
- Production `/books/151179` eventually displayed the actual title and contents (1,350 TOC entries). A warm resource observation does not establish cold-load latency. No sub-second claim.
- Frozen combined candidate `batch33` built successfully with 19,996 files. Deploy fingerprint: `885d409c1ffca23258ba90ae5c5e6edfabb641ca73c8dbb9a921b75591828157`; functions: `9c34bbf263598353a5d5689b4be33cd4189555274f0abc9729713cb6fa14284f`.

## Not yet accepted / published

- Full-book cold/slow-network combined preview acceptance; skeleton is feedback, not proof of faster source retrieval.
- Original screenshot DOCX unavailable for exact Word visual comparison.
- Field-separated search corpus verification and activation are unfinished; new consumer work is not included in batch33.
- BOK cloud activation and isolated migrated edition workflow are still release gates. Local SQLite tests do not establish cloud acceptance.
- No production deployment or GitHub push for this candidate. Production receipt remains batch29. Do not mark `productionReady` true merely because build passed.
