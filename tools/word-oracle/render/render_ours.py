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
def shape_svg(a):
    """شكلٌ متّجه (a:prstGeom) ⟵ SVG. أسماءُ prst ثابتةٌ في OOXML، فالتحويلُ
    قاموسيٌّ لا تخمينيّ. ما لا نعرفه يُرسَم مستطيلًا (أقربُ تقريبٍ آمن)."""
    sh = a["shape"]
    x, y, w, h = a["x"], a["y"], a["w"], a["h"]
    fill = f'#{sh["fill"]}' if sh.get("fill") else "none"
    stroke = f'#{sh["stroke"]}' if sh.get("stroke") else "none"
    sw = sh.get("strokeW", 0) or 0
    prst = sh.get("prst", "rect")
    at = f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"'
    if prst in ("ellipse", "oval"):
        return f'<ellipse cx="{x + w / 2:.1f}" cy="{y + h / 2:.1f}" rx="{w / 2:.1f}" ry="{h / 2:.1f}" {at}/>'
    if prst in ("roundRect", "round1Rect", "round2DiagRect", "round2SameRect", "snip2SameRect"):
        r = min(w, h) * (sh.get("adj") or 0.16)
        return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{r:.1f}" ry="{r:.1f}" {at}/>'
    if prst == "diamond":
        pts = f"{x + w / 2:.1f},{y:.1f} {x + w:.1f},{y + h / 2:.1f} {x + w / 2:.1f},{y + h:.1f} {x:.1f},{y + h / 2:.1f}"
        return f'<polygon points="{pts}" {at}/>'
    if prst == "triangle":
        pts = f"{x + w / 2:.1f},{y:.1f} {x + w:.1f},{y + h:.1f} {x:.1f},{y + h:.1f}"
        return f'<polygon points="{pts}" {at}/>'
    if prst == "line" or prst == "straightConnector1":
        return f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{x + w:.1f}" y2="{y + h:.1f}" stroke="{stroke}" stroke-width="{max(sw, 10)}"/>'
    if prst == "wave":
        # موجةٌ جيبيّة بمنحنيَين مكعّبَين — تقريبُ شكل Word
        amp, mid = h * 0.25, y + h / 2
        d = (f"M {x:.1f} {mid:.1f} C {x + w * 0.25:.1f} {mid - amp:.1f} {x + w * 0.25:.1f} {mid + amp:.1f} {x + w * 0.5:.1f} {mid:.1f} "
             f"C {x + w * 0.75:.1f} {mid - amp:.1f} {x + w * 0.75:.1f} {mid + amp:.1f} {x + w:.1f} {mid:.1f}")
        return f'<path d="{d}" fill="none" stroke="{stroke if stroke != "none" else "#000000"}" stroke-width="{max(sw, 10)}"/>'
    if prst == "leftRightArrow":
        hy, ah = h * 0.3, w * 0.2
        pts = (f"{x:.1f},{y + h / 2:.1f} {x + ah:.1f},{y:.1f} {x + ah:.1f},{y + h / 2 - hy:.1f} "
               f"{x + w - ah:.1f},{y + h / 2 - hy:.1f} {x + w - ah:.1f},{y:.1f} {x + w:.1f},{y + h / 2:.1f} "
               f"{x + w - ah:.1f},{y + h:.1f} {x + w - ah:.1f},{y + h / 2 + hy:.1f} "
               f"{x + ah:.1f},{y + h / 2 + hy:.1f} {x + ah:.1f},{y + h:.1f}")
        return f'<polygon points="{pts}" {at}/>'
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" {at}/>'

for a in pg.get("anchors", []):
    if a.get("shape") and not a.get("rId"):
        el = shape_svg(a)
        if a.get("rot"):
            cx, cy = a["x"] + a["w"] / 2, a["y"] + a["h"] / 2
            el = f'<g transform="rotate({a["rot"]:.3f} {cx:.1f} {cy:.1f})">{el}</g>'
        imgs.append(el)
        continue
    href = _img.get(a.get("rId"))
    if not href:
        continue
    x, y, w, h = a["x"], a["y"], a["w"], a["h"]
    el = f'<image x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" href="{href}" preserveAspectRatio="none"/>'
    # القصُّ (a:srcRect): الجزءُ الباقي من الصورة يُمَدَّد ليملأ الامتداد. نرسم الصورةَ
    # كاملةً مكبَّرةً ونقصّها بـclipPath على المستطيل المطلوب — يكافئ ما يفعله Word.
    sr = a.get("srcRect")
    if sr:
        keep_w = max(1e-6, 1.0 - sr["l"] - sr["r"])
        keep_h = max(1e-6, 1.0 - sr["t"] - sr["b"])
        fw, fh = w / keep_w, h / keep_h            # مقاسُ الصورة كاملةً
        fx, fy = x - fw * sr["l"], y - fh * sr["t"]
        cid = f"clip{len(imgs)}"
        el = (f'<clipPath id="{cid}"><rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}"/></clipPath>'
              f'<image x="{fx:.1f}" y="{fy:.1f}" width="{fw:.1f}" height="{fh:.1f}" href="{href}" '
              f'preserveAspectRatio="none" clip-path="url(#{cid})"/>')
    # الدورانُ والانعكاس حول مركز الصورة (a:xfrm@rot/@flipH/@flipV)
    tf = []
    if a.get("rot"):
        tf.append(f'rotate({a["rot"]:.3f} {x + w / 2:.1f} {y + h / 2:.1f})')
    if a.get("flipH") or a.get("flipV"):
        sx, sy = (-1 if a.get("flipH") else 1), (-1 if a.get("flipV") else 1)
        cx, cy = x + w / 2, y + h / 2
        tf.append(f'translate({cx:.1f} {cy:.1f}) scale({sx} {sy}) translate({-cx:.1f} {-cy:.1f})')
    if tf:
        el = f'<g transform="{" ".join(tf)}">{el}</g>'
    imgs.append(el)

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
