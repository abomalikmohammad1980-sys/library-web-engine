# Odd/even header and footer parity across sections

When `w:evenAndOddHeaders` is enabled, `even` and `default` stories are selected
from the actual Word page number.  The parity does not restart merely because a
new section begins.  `w:titlePg` still takes precedence for the first page of a
section.

The renderer therefore passes the running numeric page number into header and
footer story selection.  If a section has `w:pgNumType w:start`, that restarted
number controls parity.  Without an explicit value (for isolated API calls),
selection falls back to the section's start plus its local page index.

Regression: if a section begins on document page 6, its local page index 0 uses
the `even` story (unless it is a `titlePg` first page), and local index 1/page 7
uses `default`.

## Scene pagination and body clearance

Scene must make the same selection while it paginates, not only after pagination
when it paints the final header/footer.  The chosen footer participates in body
clearance, so selecting it from the zero-based physical index can reserve space
for one story and later paint the other.  The paginator therefore maintains the
running logical Word page number, including an explicit `pgNumStart`, and uses
that number for `even/default` selection.

The synthetic regression starts the first physical page at Word page 2 and
proves that the even header is selected.  The corpus regression uses
`sample-tadris.docx`: its title page has no footer story, PDF page 2 shows the
number box at the left edge, and PDF page 3 shows it at the right edge.  Its
`footer1.xml` (even) and `footer2.xml` (default) anchors are verified in those
same scene pages.
