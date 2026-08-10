# PAGE fields in scene header/footer stories

## Confirmed cases

- `PAGE`, `NUMPAGES`, and `SECTIONPAGES` in a header/footer are dynamic fields;
  their cached run text is not the value painted on every page.
- Page-number parity for `even/default` story selection follows the logical
  page number, including `w:pgNumType@start`, rather than the zero-based
  physical page index.
- A first-section excerpt can omit `pgNumType@start` while retaining a saved
  numeric `PAGE` result (the `sample-jalsa27` corpus starts at 26).  Preserving
  that saved start matches the visible Word artifact; later sections without
  an explicit start continue the previous sequence.

## Corpus evidence

- `سيرة الشيخ أبي أنس الشامي - أبو حمزة المهاجر.docx` has `titlePg` and
  `pgNumType start=0`.  Its cover has no first story, then the default header
  must paint `1` and `2` on the next two pages rather than repeating cached
  `1`.
- `sample-jalsa27.docx` stores a `PAGE` result of `26` inside a VML textbox and
  has no explicit start.  The scene corpus gate preserves 26 for its first
  rendered page.

## Rule

After pagination is complete, compute logical page numbers and per-section
totals.  Clone each selected margin story and materialize all three page-field
results, recursively including anchored textboxes, before shaping it.  Rebuild
the preliminary footer story used for clearance so the painted story contains
the final values.  Select odd/even stories from the logical number.

## Regression

`packages/scene/src/build.test.ts` checks the Shami cover isolation plus header
sequence `1, 2`, and keeps the VML `26` assertion for `sample-jalsa27`.

