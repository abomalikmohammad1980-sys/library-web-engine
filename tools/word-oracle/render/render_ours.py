# -*- coding: utf-8 -*-
"""يرسم صفحةً من مخرجات محرّكنا (layout_ours.mjs): كلّ محرفٍ عند x,y المطلقين،
بخطّ سطره (تعدّد الخطوط). الاستخدام: python render_ours.py <ours.json> <pageIndex> <out.svg>"""
import sys, json, base64, re, zipfile
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

data = json.load(open(sys.argv[1], encoding="utf-8"))
pi = int(sys.argv[2]); out = sys.argv[3]
pg = data["pages"][pi]; W, H = pg["w"], pg["h"]

# امتداداتُ الصور التي يعرفها Word (‏ImageParser.dart:1516-1530). كنّا نعرف
# خمسةً فقط، فتسقط webp وtiff وwmf وemf صامتةً — وفي مدوّنتنا ٤ ملفّاتِ emf.
_IMG_EXT = {"png": "png", "jpeg": "jpeg", "jpg": "jpeg", "gif": "gif", "bmp": "bmp",
            "webp": "webp", "tif": "tiff", "tiff": "tiff", "wmf": None, "emf": None}


def _extract_from_emf(data):
    """يستخرج PNG/JPEG مضمَّنًا داخل EMF. ‏Word يغلّف كثيرًا من الصور بـEMF،
    و‏SVG لا يرسم EMF — لكنّ الحمولة الداخليّة صورةٌ عاديّةٌ نرسمها.
    (‏ParagraphFloatingImages.dart:313-323)"""
    for sig, mime in ((b"\x89PNG\r\n\x1a\n", "png"), (b"\xff\xd8\xff", "jpeg")):
        i = data.find(sig)
        if i >= 0:
            return "data:image/%s;base64," % mime + base64.b64encode(data[i:]).decode()
    return None


def _resolve_target(z, tgt):
    """سلسلةُ حلّ بايتات الصورة (‏ImageParser.dart:1582-1661): تسويةُ المسار،
    ثمّ **الاسمُ المجرَّد إلى media/**، ثمّ حسمُ النوع **بالبايتات السحريّة**
    لا بالامتداد (ملفّاتٌ كثيرةٌ في مستندات Word مسمّاةٌ خطأً)."""
    tgt = tgt.lstrip("/").replace("../", "")
    names = set(z.namelist())
    cands = ["word/" + tgt, tgt]
    if "/" not in tgt:
        cands.append("word/media/" + tgt)
    name = next((c for c in cands if c in names), None)
    if not name:
        return None
    ext = name.rsplit(".", 1)[-1].lower()
    if ext not in _IMG_EXT:
        return None
    data = z.read(name)
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        mime = "png"
    elif data[:3] == b"\xff\xd8\xff":
        mime = "jpeg"
    elif data[:4] == b"GIF8":
        mime = "gif"
    elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        mime = "webp"
    elif data[:2] == b"BM":
        mime = "bmp"
    elif data[:4] == b"\x01\x00\x00\x00":        # EMF: ارسمِ المضمَّنَ داخله
        return _extract_from_emf(data)
    else:
        mime = _IMG_EXT.get(ext)
        if not mime:
            return None
    return "data:image/%s;base64," % mime + base64.b64encode(data).decode()


def _recover_rels(z):
    """استردادُ العلاقات المكسورة (‏DocxImageRelationshipRecovery.dart:11-124).
    ‏Word أحيانًا يُصدِر مستندًا معرّفاتُ `a:blip@r:embed` فيه مزاحةٌ عن معرّفات
    ملفّ العلاقات بمقدارٍ ثابت، فتُشير كلُّ صورةٍ إلى هدفٍ ليس صورةً. الشروطُ
    مشدَّدةٌ عمدًا حتّى لا نُفسد مستندًا سليمًا:
      · تساوي طولَي القائمتين  · وجودُ مرجعٍ مكسورٍ فعلًا
      · تطابقُ كلّ الفروق  · وأن يكون الفرقُ غيرَ صفريّ.
    وتقتصر على المتن دون الترويسات."""
    try:
        doc = z.read("word/document.xml").decode("utf-8", "ignore")
        rels = z.read("word/_rels/document.xml.rels").decode("utf-8")
    except Exception:
        return {}
    seen, embeds = set(), []
    for rid in re.findall(r'r:embed="(rId\d+)"', doc):
        if rid not in seen:
            seen.add(rid); embeds.append(rid)          # بترتيب المستند بلا تكرار
    pairs = re.findall(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', rels)
    tmap = dict(pairs)
    img_ids = sorted((i for i, t in pairs if _looks_image(t)),
                     key=lambda r: int(r[3:]))          # ترتيبٌ **عدديٌّ** لا نصّيّ
    if not embeds or not img_ids or len(embeds) != len(img_ids):
        return {}
    if not any(not _looks_image(tmap.get(e, "")) for e in embeds):
        return {}                                      # لا كسرَ ⟵ لا استرداد
    deltas = {int(img_ids[i][3:]) - int(embeds[i][3:]) for i in range(len(embeds))}
    if len(deltas) != 1 or 0 in deltas:
        return {}                                      # الفرقُ غيرُ ثابتٍ أو صفر
    return {embeds[i]: img_ids[i] for i in range(len(embeds))}


def _looks_image(tgt):
    """هدفٌ يُعَدّ صورةً: يبدأ بـmedia/ أو ينتهي بامتدادٍ معروف."""
    t = (tgt or "").lower().lstrip("/")
    return t.startswith("media/") or t.rsplit(".", 1)[-1] in _IMG_EXT


# خريطة rId → بايت صورة من word/media (لرسم الصور العائمة، حصاد «الشاملة الذهبية»)
_img = {}
_recovered = {}
docx = data.get("docx")
if docx:
    try:
        z = zipfile.ZipFile(docx)
        _recovered = _recover_rels(z)
        # ‏rId محلّيٌّ لجزئه: نبني خريطةً لكلّ جزءٍ على حدة. (‏rId1 في ترويسة
        # ‏masjid صورةٌ، وفي المستند عنصرُ customXml — فالخريطةُ الواحدة تُخطئ.)
        for rels_name in z.namelist():
            m = re.match(r"word/_rels/(.+)\.rels$", rels_name)
            if not m:
                continue
            part = m.group(1)
            rels = z.read(rels_name).decode("utf-8")
            for rid, tgt in re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels):
                blob = _resolve_target(z, tgt)
                if blob:
                    _img.setdefault(part, {})[rid] = blob
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

# ترتيبُ الطبقات (‏ParagraphFloatingImages.dart:100-116): ما خلف النصّ أوّلًا،
# ثمّ تصاعديًّا بـz؛ وعند التعادل تسبق أشكالُ الخطّ غيرَها؛ ثمّ استقرارٌ بترتيب
# المصدر. كانت كلُّها تُرسَم بترتيب ورودها فتتراكب خطأً.
def _layer_key(item):
    i, a = item
    return (0 if a.get("behind") else 1, a.get("z", 0) or 0,
            0 if (a.get("shape") or {}).get("prst") == "line" else 1, i)


for _, a in sorted(enumerate(pg.get("anchors", [])), key=_layer_key):
    if a.get("shape") and not a.get("rId"):
        el = shape_svg(a)
        if a.get("rot"):
            cx, cy = a["x"] + a["w"] / 2, a["y"] + a["h"] / 2
            el = f'<g transform="rotate({a["rot"]:.3f} {cx:.1f} {cy:.1f})">{el}</g>'
        imgs.append(el)
        continue
    # الجزءُ المالك أوّلًا، ثمّ المستندُ احتياطًا (استرجاعُ العلاقات المكسورة)
    part = a.get("part") or "document.xml"
    rid = a.get("rId")
    # خريطةُ الاسترداد تُطبَّق على المتن وحده (لا على الترويسات)
    if part == "document.xml" and rid in _recovered:
        rid = _recovered[rid]
    href = (_img.get(part, {}).get(rid)
            or _img.get("document.xml", {}).get(rid))
    if not href:
        continue
    x, y, w, h = a["x"], a["y"], a["w"], a["h"]
    # ‏a:stretch ⟵ تُمَدّ لتملأ الامتداد؛ وغيابُه ⟵ **تُحتوى** بنسبتها الأصليّة.
    # كنّا نمدّ دائمًا فنشوّه كلَّ صورةٍ نسبتُها تخالف wp:extent.
    par = "none" if a.get("stretch") else "xMidYMid meet"
    el = f'<image x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" href="{href}" preserveAspectRatio="{par}"/>'
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
              f'preserveAspectRatio="{par}" clip-path="url(#{cid})"/>')
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
# تظليلُ الفقرة (w:pPr/w:shd) — شريطٌ خلف السطر بعرض العمود
for ln in pg["lines"]:
    if ln.get("shd"):
        y = ln["y"]
        hl_rects.append(f'<rect x="{ln["shdX"]:.1f}" y="{y - ln["shdAsc"]:.1f}" '
                        f'width="{ln["shdW"]:.1f}" height="{ln["shdAsc"] + ln["shdDesc"]:.1f}" '
                        f'fill="#{ln["shd"]}"/>')
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
