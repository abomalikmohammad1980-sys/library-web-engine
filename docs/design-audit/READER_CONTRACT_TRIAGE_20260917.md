# Reader source-contract regression triage

The five assigned suites originally produced six failing assertions. Inspection of the frozen `.artifacts/batch33` source confirms each mismatch predates this patch:

- `router.ts:49` already decodes the route into `decoded` before canonicalization, rather than nesting both calls.
- `reader_return_bar.ts:72,80` already builds an anchor inside a dismissible wrapper, with translated accessible destination binding `5ba22c8c112e844a`.
- `screens/reader.ts:1487` already names the selected-text quote action `حفظ النص المحدد اقتباسًا`, not the superseded note label.
- `screens/reader.ts:1119` already uses physical Word sheet labels with current/total fallbacks; this caused two obsolete direct-call assertions.
- `styles/components.css:2473,2665` already distinguishes companion tablet columns and a later narrow-phone stacking rule with relative positioning. This is documentation of existing behavior, not approval of a new design or visual mobile acceptance.

Only the five assigned test files changed. No reader runtime or CSS changed. Assertions still require an accessible keyboard link, named dismiss button, untranslated authored snippets, physical printed-page hint, explicit unknown-total handling, bounded DOM lifecycle, tablet companion columns and non-overlapping phone positioning.

Verification: `npx vitest run app/src/reader_return_bar_contract.test.ts app/src/reader_action_accessibility_contract.test.ts app/src/reader_chrome_bindings.test.ts app/src/reader_virtualization_contract.test.ts app/src/responsive_contract.test.ts --reporter=dot` — **32 tests passed across 5 files**. This is unit/source-contract evidence, not browser accessibility or mobile visual certification.
