# Minimum line spacing (`w:lineRule="atLeast"`)

Word's `atLeast` line rule is a lower bound, not a fixed line height. A small
value must never make the line box shorter than the text's natural font
metrics. This differs from `exact`, whose value is deliberately fixed, and
from `auto`, whose value is a multiple where 240 means one line.

The DOM renderer compares an `atLeast` value with the largest resolved run
font size in the paragraph. When the requested minimum is below the estimated
natural line height, it leaves CSS `line-height` unset so the browser uses the
font's metrics. When the requested minimum is larger, it emits that value in
pixels. This prevents glyphs from overflowing tiny line boxes and stacking
while retaining intentionally generous Word spacing.

If a paragraph has no run with resolved font metrics, the renderer likewise
leaves `line-height` unset. The inherited font still creates a natural line
box; converting a tiny minimum into a fixed CSS height would contradict
`atLeast` and collapse that box.

Regression fixture: a paragraph with a 320-twip (16pt) run and
`w:spacing w:line="18" w:lineRule="atLeast"` must not emit a 1.2px line height.
The real «زهر الخمائل» corpus contains more than 2,000 such paragraphs,
including textless/decorative paragraphs whose runs expose no usable metric.
