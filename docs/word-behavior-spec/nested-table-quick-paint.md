# Nested tables in quick Word paint

## Corpus

The regression corpus is the official Open XML SDK sample
`OpenXmlSdk-HyperlinkInTable/hyperlink-in-table.docx`. Its outer table owns an
inner table in row 0, column 0. The inner table contains the external ECMA
hyperlink; a second external hyperlink remains in the outer table.

No Word COM evidence is required: `word/document.xml` declares the nested
`w:tbl`, and `document.xml.rels` declares both hyperlink targets.

## Contract

- Quick paint groups paragraphs by `tableId`, not merely by adjacent row and
  column numbers.
- `parentTableId`, `parentRow`, and `parentCol` place an inner table in its
  owning physical cell.
- `parentBlockIndex` and paragraph `cellBlockIndex` preserve the direct OOXML
  order of paragraphs and child tables inside that cell.
- Corpus traversal order is not ownership order: an inner table may be
  encountered before its outer table. Roots are therefore selected by absent
  `parentTableId`, never by array position.
- Hyperlink runs remain ordinary paragraph content inside the nested table.

This is a general renderer rule. It contains no file-name, title, or corpus
special case.

## Regression layers

- model: nested ownership and the inner hyperlink target;
- scene: one top-level table and one nested child in the owning cell;
- DOM: one root table and two table nodes in the descendant tree;
- paint: the ownership map consumed by the recursive quick renderer.

