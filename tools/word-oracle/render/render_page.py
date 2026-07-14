# -*- coding: utf-8 -*-
"""عارض PoC: يرسم صفحةً من مواقع Word المستخرجة (glyphId + موضع) بمحارف Word نفسها.
مطابقةٌ بصريّةٌ 100% بالتعريف (مواقع وأشكال Word). الاستخدام:
  python render_page.py <book> <pageIndex> <out.svg>
"""
import sys, json, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

book, page_i, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
truth = json.load(open(f"corpus/ground-truth/{book}.truth.json", encoding="utf-8"))
pg = truth["pages"][page_i]
W, H = pg["widthTwips"], pg["heightTwips"]
fdir = f"corpus/ground-truth/fonts/{book}"

_cache = {}
def load(fontname):
    key = fontname
    if key in _cache: return _cache[key]
    ttf = os.path.join(fdir, fontname.replace(".odttf", ".ttf"))
    f = TTFont(ttf)
    gs = f.getGlyphSet()
    order = f.getGlyphOrder()
    upem = f["head"].unitsPerEm
    _cache[key] = (gs, order, upem)
    return _cache[key]

paths = []
import os as _os
for _i,ln in enumerate(pg["lines"]):
    if _os.environ.get("MAXLINES") and _i>=int(_os.environ["MAXLINES"]): break
    for r in ln["runs"]:
        if not r.get("glyphIds"): continue
        gs, order, upem = load(r["font"])
        em = r["emTwips"]; scale = em / upem
        baseline = r.get("yF", r.get("y"))
        advs = r.get("glyphAdvTwips") or [r["advSumTwips"]/max(1,len(r["glyphIds"]))]*len(r["glyphIds"])
        rtl = (r.get("bidiLevel", 0) % 2) == 1   # RTL: x=حافّة يمنى، المحارف تتقدّم يسارًا
        penX = r["x"]
        for gi, gid in enumerate(r["glyphIds"]):
            adv = advs[gi] if gi < len(advs) else 0
            if rtl: penX -= adv          # RTL: انقص أولًا (أصل المحرف يساره)
            if gid < len(order):
                name = order[gid]
                pen = SVGPathPen(gs)
                try: gs[name].draw(pen)
                except Exception: pass
                d = pen.getCommands()
                if d:
                    paths.append(
                        f'<path d="{d}" transform="translate({penX:.2f} {baseline:.2f}) '
                        f'scale({scale:.5f} {-scale:.5f})"/>')
            if not rtl: penX += adv       # LTR: تقدّم بعد الرسم

svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
       f'width="{W/20:.0f}" height="{H/20:.0f}">'
       f'<rect width="{W}" height="{H}" fill="white"/>'
       f'<g fill="black">{"".join(paths)}</g></svg>')
open(out, "w", encoding="utf-8").write(svg)
print(f"rendered {book} page {page_i}: {len(paths)} glyphs -> {out} ({W}x{H} tw)")
