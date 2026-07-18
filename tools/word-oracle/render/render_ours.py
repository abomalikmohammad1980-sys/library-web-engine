# -*- coding: utf-8 -*-
"""يرسم صفحةً من مخرجات محرّكنا (layout_ours.mjs): كلّ محرفٍ عند x,y المطلقين،
بخطّ سطره (تعدّد الخطوط). الاستخدام: python render_ours.py <ours.json> <pageIndex> <out.svg>"""
import sys, json, base64, re, zipfile
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

data = json.load(open(sys.argv[1], encoding="utf-8"))
pi = int(sys.argv[2]); out = sys.argv[3]
pg = data["pages"][pi]; W, H = pg["w"], pg["h"]

# خريطة rId → بايت صورة من word/media (لرسم الصور العائمة، حصاد «الشاملة الذهبية»)
_img = {}
docx = data.get("docx")
if docx:
    try:
        z = zipfile.ZipFile(docx)
        rels = z.read("word/_rels/document.xml.rels").decode("utf-8")
        r2t = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
        for rid, tgt in r2t.items():
            name = "word/" + tgt.lstrip("/").replace("../", "")
            if name in z.namelist():
                ext = name.rsplit(".", 1)[-1].lower()
                mime = {"png": "png", "jpeg": "jpeg", "jpg": "jpeg", "gif": "gif", "bmp": "bmp"}.get(ext)
                if mime:
                    _img[rid] = f"data:image/{mime};base64," + base64.b64encode(z.read(name)).decode()
    except Exception:
        pass
# مستطيلات خلايا الجداول (تظليل + حدود من نمط الجدول) — تُرسَم قبل النصّ
cells = []
for c in pg.get("cells", []):
    fill = f'#{c["fill"]}' if c.get("fill") else "none"
    bw = c.get("bw", 0) or 0
    stroke = f'#{c.get("bc", "000000")}' if bw else "none"
    if fill == "none" and not bw:
        continue
    cells.append(f'<rect x="{c["x"]:.1f}" y="{c["y"]:.1f}" width="{c["w"]:.1f}" '
                 f'height="{c["h"]:.1f}" fill="{fill}" stroke="{stroke}" stroke-width="{bw}"/>')
# عناصر الصور العائمة (طبقةٌ خلفيّة: تُرسَم قبل النصّ ليعلوها)
imgs = []
for a in pg.get("anchors", []):
    href = _img.get(a.get("rId"))
    if not href:
        continue
    imgs.append(f'<image x="{a["x"]:.1f}" y="{a["y"]:.1f}" width="{a["w"]:.1f}" height="{a["h"]:.1f}" href="{href}" preserveAspectRatio="none"/>')

_cache = {}
def load(path):
    if path not in _cache:
        f = TTFont(path or data["mainFont"])
        _cache[path] = (f.getGlyphSet(), f.getGlyphOrder(), f["head"].unitsPerEm)
    return _cache[path]

paths = []
for ln in pg["lines"]:
    gs, order, upem = load(ln.get("font") or data["mainFont"])
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
            # حجمٌ ورفعٌ خاصّان بالمحرف (علامة حاشية مرفوعة: em أصغر و dy سالب)
            gsc = (g["em"] / upem) if "em" in g else scale
            gy = y + g.get("dy", 0)
            paths.append(f'<path d="{d}" transform="translate({g["x"]:.2f} {gy:.2f}) scale({gsc:.5f} {-gsc:.5f})"/>')
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
       f'viewBox="0 0 {W} {H}" width="{W/20:.0f}" height="{H/20:.0f}">'
       f'<rect width="{W}" height="{H}" fill="white"/>{"".join(imgs)}{"".join(cells)}'
       f'<g fill="black">{"".join(paths)}</g></svg>')
open(out, "w", encoding="utf-8").write(svg)
print(f"our-engine page {pi}: {len(paths)} glyphs, {len(imgs)} images, {len(cells)} cells -> {out}")
