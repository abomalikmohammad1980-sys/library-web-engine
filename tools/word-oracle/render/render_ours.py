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

# ألوانُ التظليل كما يسمّيها OOXML (w:highlight) — أسماءٌ ثابتةٌ لا قيمٌ حرّة
HL = {"yellow": "FFFF00", "green": "00FF00", "cyan": "00FFFF", "magenta": "FF00FF",
      "blue": "0000FF", "red": "FF0000", "darkBlue": "000080", "darkCyan": "008080",
      "darkGreen": "008000", "darkMagenta": "800080", "darkRed": "800000",
      "darkYellow": "808000", "darkGray": "808080", "lightGray": "C0C0C0",
      "black": "000000", "white": "FFFFFF"}

# زخارفُ النصّ: تظليلٌ خلف الكلمة، وتسطيرٌ/شطبٌ خطوطًا. تُرسَم قبل المحارف
# (التظليل) وبعدها (الخطوط) فلا تحجب الحرف.
hl_rects, deco_lines = [], []
for ln in pg["lines"]:
    y = ln["y"]
    for d in ln.get("decos", []):
        by = y + d.get("dy", 0)
        if d.get("highlight"):
            col = HL.get(d["highlight"], "FFFF00")
            hl_rects.append(f'<rect x="{d["x"]:.1f}" y="{by - d["asc"]:.1f}" '
                            f'width="{d["w"]:.1f}" height="{d["asc"] + d["desc"]:.1f}" fill="#{col}"/>')
        stroke = "#" + (d.get("ucolor") or d.get("color") or "000000")
        lw = max(6.0, d["em"] * 0.05)          # سُمكُ الخطّ ٥٪ من الحجم (تقريبُ Word)
        if d.get("underline"):
            uy = by + d["desc"] * 0.45          # أسفلَ الأساس بقليل
            deco_lines.append(f'<line x1="{d["x"]:.1f}" y1="{uy:.1f}" x2="{d["x"] + d["w"]:.1f}" '
                              f'y2="{uy:.1f}" stroke="{stroke}" stroke-width="{lw:.1f}"/>')
            if d["underline"] in ("double", "dotDotDash", "wavyDouble"):
                deco_lines.append(f'<line x1="{d["x"]:.1f}" y1="{uy + lw * 2:.1f}" x2="{d["x"] + d["w"]:.1f}" '
                                  f'y2="{uy + lw * 2:.1f}" stroke="{stroke}" stroke-width="{lw:.1f}"/>')
        if d.get("strike") or d.get("dstrike"):
            sy = by - d["asc"] * 0.32           # نحو منتصف ارتفاع الحرف
            off = lw if d.get("dstrike") else 0
            for k in ((-1, 1) if d.get("dstrike") else (0,)):
                deco_lines.append(f'<line x1="{d["x"]:.1f}" y1="{sy + k * off:.1f}" x2="{d["x"] + d["w"]:.1f}" '
                                  f'y2="{sy + k * off:.1f}" stroke="{stroke}" stroke-width="{lw:.1f}"/>')

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
            # لونُ المحرف (w:color/themeColor) — الافتراضيّ يرثه من المجموعة
            fill = f' fill="#{g["fill"]}"' if g.get("fill") else ""
            paths.append(f'<path d="{d}"{fill} transform="translate({g["x"]:.2f} {gy:.2f}) scale({gsc:.5f} {-gsc:.5f})"/>')
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
       f'viewBox="0 0 {W} {H}" width="{W/20:.0f}" height="{H/20:.0f}">'
       f'<rect width="{W}" height="{H}" fill="white"/>{"".join(imgs)}{"".join(cells)}'
       f'{"".join(hl_rects)}<g fill="black">{"".join(paths)}</g>{"".join(deco_lines)}</svg>')
open(out, "w", encoding="utf-8").write(svg)
print(f"our-engine page {pi}: {len(paths)} glyphs, {len(imgs)} images, {len(cells)} cells, "
      f"{len(hl_rects)} highlights, {len(deco_lines)} decorations -> {out}")
