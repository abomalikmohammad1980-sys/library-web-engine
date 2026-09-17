# RTL brace source preservation

## Regression evidence

The reported Word reader screenshot shows curly braces facing away from the
Quran quotation. `runT.ts` previously replaced every `{` with `}` and every `}`
with `{` whenever the run direction was RTL. This changed DOM text content,
including copied text, although the original model remained unchanged.
The old unit test explicitly required the incorrect transformed code points.

## Rendering contract

Preserve OOXML logical text and field results verbatim in DOM text nodes.
Leave bidi glyph mirroring to the browser under the existing paragraph/run
direction. Do not swap punctuation, isolate each brace, or introduce directional
control characters into the source. The decorative text-reflection layer must
also receive the same unmodified text. This applies to braces split over several
runs as well as complete quotations; it is not a book-specific exception.

## Verification and acceptance boundary

`packages/ooxml-dom/src/render.test.ts` covers RTL, LTR, inherited direction,
split runs and field results, including unaffected square/round/Quran brackets.
These are source-integrity regression tests, not a Word visual-oracle claim.
The original DOCX behind the user's screenshot has not been identified for this
fix. Pixel-level Word parity for that document remains unverified until its
original file and corresponding Word reference are available. No model/layout
contract or imported document text is changed by this fix.
