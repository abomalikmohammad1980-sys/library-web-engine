# Legacy smart-tag inline content

`w:smartTag` annotates existing visible text; it does not remove its child runs.
Traverse nested smart tags transparently in source order, retaining inherited
hyperlink and field context and each run's formatting. Ignore `w:smartTagPr`
metadata, and do not synthesize, rewrite or remove text.

Reference: Microsoft's [WordprocessingML primer](https://download.microsoft.com/download/e/1/4/e14fb96f-83b8-4a2a-84db-7fa8acbe061a/Office%20Open%20XML%20Part%203%20-%20Primer.pdf)
describes smart-tag annotations around runs, including nested annotations.

Evidence (2026-09-17): the user-selected DOCX was read without modification and
converted using an independently owned hidden Microsoft Word instance. Before
the fix, model and COM each contained 233 paragraphs (140 nonempty), but six
paragraphs lost runs nested in smart tags. Authoritative page alignment failed.
After transparent traversal, the same source and generated 37-page map pass
alignment and requireWordPageGroups; auditWordPageMap reports zero mismatches.
Map validation and page boundaries are unchanged.
Private source and generated map remain local artifacts, not repository fixtures.

Tests: `packages/ooxml-model/src/smart_tag.test.ts` verifies nested content,
formatting, metadata exclusion, hyperlink and field inheritance with synthetic
text. `app/src/word_exact_import_diagnostic.test.ts` is opt-in via explicit
source/map environment variables and logs only structural diagnostics, not text.
