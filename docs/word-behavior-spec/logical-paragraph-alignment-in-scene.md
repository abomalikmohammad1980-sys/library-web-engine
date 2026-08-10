# Logical paragraph alignment in the scene renderer

## Confirmed case

`w:jc` has both physical values (`left`, `right`) and logical values (`start`,
`end`).  Paragraph direction does not change the meaning of the physical
values, but it does resolve the logical pair:

| paragraph direction | `start` | `end` |
| --- | --- | --- |
| LTR | physical left | physical right |
| RTL | physical right | physical left |

The DOM renderer already delegates `start` and `end` to CSS direction.  The
scene renderer formerly treated every value except physical `left`/`right` as
the flow start, so `end` was wrong in both directions.

## Evidence

- ECMA-376 paragraph justification distinguishes `start`/`end` from the
  physical `left`/`right` values.
- The controlled scene regression exercises all four direction/edge pairs in
  twips and asserts the resulting physical line edge.
- The real corpus file `سرور.. بل أحزان.docx` remains in the same gate and
  additionally proves that its compact `line=192 lineRule=auto` paragraphs do
  not regress into overlapping Arabic line boxes.

## Rule

Compute the free inline width once.  Move a line by that free width only when
it is aligned to the flow end: logical `end`, physical `left` under RTL, or
physical `right` under LTR.  Logical `start` and the opposite physical edge use
zero offset; `center` uses half the free width.

## Regression

`packages/scene/src/build.test.ts` contains:

- a four-way logical alignment matrix (`LTR/RTL × start/end`), and
- a read-only corpus assertion over `سرور.. بل أحزان.docx` ensuring adjacent
  Arabic line boxes remain disjoint.
