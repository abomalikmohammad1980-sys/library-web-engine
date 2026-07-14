# -*- coding: utf-8 -*-
"""يرسم صفحةً من مخرجات محرّكنا (layout_ours.mjs): كلّ محرفٍ عند x,y المطلقين.
الاستخدام: python render_ours.py <ours.json> <pageIndex> <out.svg>"""
import sys, json
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

data = json.load(open(sys.argv[1], encoding="utf-8"))
pi = int(sys.argv[2]); out = sys.argv[3]
pg = data["pages"][pi]; W, H = pg["w"], pg["h"]
f = TTFont(data["font"]); gs = f.getGlyphSet(); order = f.getGlyphOrder(); upem = data["upem"]
paths = []
for ln in pg["lines"]:
    scale = ln["em"] / upem; y = ln["y"]
    for g in ln["glyphs"]:
        gid = g["gid"]
        if gid is None or gid >= len(order):
            continue
        pen = SVGPathPen(gs)
        try: gs[order[gid]].draw(pen)
        except Exception: pass
        d = pen.getCommands()
        if d:
            paths.append(f'<path d="{d}" transform="translate({g["x"]:.2f} {y:.2f}) scale({scale:.5f} {-scale:.5f})"/>')
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W/20:.0f}" height="{H/20:.0f}">'
       f'<rect width="{W}" height="{H}" fill="white"/><g fill="black">{"".join(paths)}</g></svg>')
open(out, "w", encoding="utf-8").write(svg)
print(f"our-engine page {pi}: {len(paths)} glyphs -> {out}")
