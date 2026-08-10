# `STYLEREF` in headers and footers

`STYLEREF` in a header/footer is contextual: its cached text in the DOCX is not
the value for every page. The instruction names a Word style (often by its
localized `w:name`). The model resolves that name to `styleId` and stores a
`STYLEREF:<styleId>` field marker.

For each page, the renderer uses the first matching paragraph on that page. If
the page has no match, it uses the nearest matching paragraph from preceding
pages. This mirrors the normal running-heading use of Word's STYLEREF field and
prevents one cached chapter title from appearing throughout the book.
