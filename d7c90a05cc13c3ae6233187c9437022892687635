# Page-boundary multiplicity and source text

## Contract

- Page boundaries are ordered events, not a boolean paragraph property. Repeated
  boundaries must therefore preserve intervening blank pages.
- An explicit `w:br w:type="page"` followed by
  `w:lastRenderedPageBreak` with only hidden metadata between them describes one
  visual boundary and is deduplicated.
- Hidden runs do not make a paragraph visibly non-empty and do not split the
  explicit/rendered-break pairing.
- Multiple `TheLibraryPage_*` bookmarks on one paragraph preserve their implied
  empty pages.
- Physical page count and displayed Word page number are separate concepts.
  Section numbering can make the highest displayed number differ from the number
  of physical pages.
- A run may carry `sourceText` for comparison with Word's source-text page map
  while retaining its display glyph in `text`. In particular, AGA Arabesque
  `U+F072` remains visible as `U+F072`, while its Word source-text value is `(`.

## Corpus evidence

For `الطريق إلى القرآن.docx`, Word reports 713 paragraphs and 72 physical pages;
the last displayed page number is 73. Bookmark targets resolve as follows:

| Bookmark | Physical page | Displayed page |
| --- | ---: | ---: |
| `_Toc181021125` | 7 | 8 |
| `_Toc181021127` | 18 | 19 |
| `_Toc181021134` | 47 | 48 |

The shared Word layer owns bookmark-to-page resolution as a zero-based page-slot
index: the three targets above are slots `6/17/46`. Their Word labels are
independently `8/19/48`. A UI may add one only when presenting the physical sheet
number (`7/18/47`); adding one to the navigation target, or deriving the Word
label from the slot, changes the contract and creates an off-by-one error.

The document contains 69 rendered page-break markers and 9 explicit page breaks.
The explicit breaks are paired with rendered markers around hidden `{{PG:n}}`
metadata; treating both as independent boundaries incorrectly creates 80 groups.
The ordered/deduplicated model creates 72 physical groups and retains the correct
bookmark ownership.

## Regression coverage

- Synthetic tests cover paired explicit/rendered breaks and genuine repeated
  explicit boundaries.
- DOM grouping covers the empty page produced by two boundaries.
- The guarded corpus regression checks 72 physical groups, displayed total 73,
  bookmark slots 6/17/46 with labels 8/19/48, exact 703/703 non-empty source-paragraph alignment,
  and preservation of the visible `U+F072` glyph.
