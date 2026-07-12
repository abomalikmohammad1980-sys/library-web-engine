#!/usr/bin/env python3
"""مستخرج الحقيقة: XPS ← JSON مواضع (ADR-0003).

XPS = أرشيف ZIP يحوي لكل صفحة FixedPage XML، وكل نص فيه عنصر:
  <Glyphs UnicodeString="..." Indices="..." OriginX=".." OriginY=".."
          FontRenderingEmSize=".." FontUri="/Resources/..odttf" ...>

- ‏OriginX/Y بوحدة XPS ‏(1/96 بوصة = بكسل CSS). نحولها إلى **twips** ‏(ADR-0004: ‏×15).
- ‏Indices تحمل لكل غليف: معرفه و«تقدّمه» (advance) بوحدة 1/100 من em —
  نحوّل التقدمات إلى twips عبر حجم الخط.
- التجميع في «أسطر» يتم على OriginY المتقارب داخل الصفحة.

الاستخدام: python extract_truth.py book.xps [--pages 10] ← book.truth.json
"""
from __future__ import annotations

import argparse
import json
import re
import zipfile
from collections import defaultdict

GLYPHS_RE = re.compile(r"<Glyphs\b[^>]*?/?>", re.S)
ATTR_RE = re.compile(r'(\w[\w.]*)="([^"]*)"')
PAGE_SIZE_RE = re.compile(r'<FixedPage[^>]*Width="([\d.]+)"[^>]*Height="([\d.]+)"')

XPS_UNIT_TO_TWIPS = 15.0  # 1/96in ← 1/1440in


def parse_indices(indices: str, em_size_xps: float):
    """‏Indices: عناصر مفصولة بـ ';' — الشكل الشائع: [GlyphID][,Advance][,uOffset][,vOffset]
    مع أشكال عنقدة مثل '(2:1)5'. نستخرج advance بوحدة twips (الافتراضي: عرض الغليف من الخط —
    غير متاح هنا فنسجل None ليُحسب من فرق المواضع لاحقًا إن لزم)."""
    out = []
    for part in indices.split(";"):
        part = part.strip()
        if not part:
            out.append({"gid": None, "adv": None})
            continue
        part = re.sub(r"^\(\d+:\d+\)", "", part)  # cluster map prefix
        fields = part.split(",")
        gid = int(fields[0]) if fields[0] else None
        adv = None
        if len(fields) > 1 and fields[1]:
            # advance بوحدة 1/100 من em ← twips
            adv = float(fields[1]) / 100.0 * em_size_xps * XPS_UNIT_TO_TWIPS
        out.append({"gid": gid, "adv": adv})
    return out


def extract(xps_path: str, max_pages: int | None):
    z = zipfile.ZipFile(xps_path)
    page_parts = sorted(
        (n for n in z.namelist() if re.search(r"Pages/\d+\.fpage$", n)),
        key=lambda n: int(re.search(r"(\d+)\.fpage$", n).group(1)),
    )
    if max_pages:
        page_parts = page_parts[:max_pages]

    pages = []
    for part in page_parts:
        raw = z.read(part)
        # ‏Word يكتب fpage بترميز UTF-16-LE مع BOM؛ نكشف الترميز من الـ BOM
        if raw.startswith(b"\xff\xfe"):
            xml = raw.decode("utf-16-le")
        elif raw.startswith(b"\xfe\xff"):
            xml = raw.decode("utf-16-be")
        else:
            xml = raw.decode("utf-8", "replace")
        m = PAGE_SIZE_RE.search(xml)
        width_tw = round(float(m.group(1)) * XPS_UNIT_TO_TWIPS) if m else None
        height_tw = round(float(m.group(2)) * XPS_UNIT_TO_TWIPS) if m else None

        # ‏Word يلف محتوى الصفحة بـ Canvas RenderTransform ‏(scale 4/3: نقاط ← 1/96")
        # ‏(قاعدة مكتشفة — انظر word-behavior-spec). نتتبع مكدس التحويلات ونطبقه
        # على المواضع والأحجام. ندعم scale+translate ونرصد أي دوران كتحذير.
        runs = []
        stack = [(1.0, 0.0, 0.0)]  # (scale, tx, ty) تراكمية
        in_rt = False
        TAG_RE = re.compile(
            r"<(/?)(Canvas\.RenderTransform|Canvas|MatrixTransform|Glyphs)\b([^>]*?)(/?)>", re.S)
        for tm in TAG_RE.finditer(xml):
            closing, tag, body, selfclose = tm.group(1) == "/", tm.group(2), tm.group(3), tm.group(4) == "/"
            if tag == "Canvas.RenderTransform":
                in_rt = not closing
            elif tag == "Canvas":
                if closing:
                    if len(stack) > 1:
                        stack.pop()
                elif not selfclose:
                    stack.append(stack[-1])
            elif tag == "MatrixTransform" and in_rt:
                a_ = dict(ATTR_RE.findall(body))
                m6 = [float(v) for v in a_.get("Matrix", "1,0,0,1,0,0").split(",")]
                if abs(m6[1]) > 1e-9 or abs(m6[2]) > 1e-9 or abs(m6[0] - m6[3]) > 1e-6:
                    print(f"تحذير: تحويل غير متجانس في {part}: {m6}")
                s, tx, ty = stack[-1]
                stack[-1] = (s * m6[0], s * m6[4] + tx, s * m6[5] + ty)
            elif tag == "Glyphs" and not closing:
                attrs = dict(ATTR_RE.findall(body))
                if "UnicodeString" not in attrs:
                    continue
                s, tx, ty = stack[-1]
                em = float(attrs.get("FontRenderingEmSize", "0")) * s
                glyphs = parse_indices(attrs.get("Indices", ""), em)
                adv_known = [g["adv"] for g in glyphs if g["adv"] is not None]
                runs.append({
                    "text": attrs["UnicodeString"],
                    "x": round((float(attrs.get("OriginX", "0")) * s + tx) * XPS_UNIT_TO_TWIPS),
                    "y": round((float(attrs.get("OriginY", "0")) * s + ty) * XPS_UNIT_TO_TWIPS),
                    "emTwips": round(em * XPS_UNIT_TO_TWIPS),
                    "font": attrs.get("FontUri", "").split("/")[-1],
                    "bidiLevel": int(attrs.get("BidiLevel", "0")),
                    "glyphCount": len(glyphs),
                    "advSumTwips": round(sum(adv_known)) if adv_known else None,
                    "glyphAdvTwips": [round(a) if a is not None else None for a in
                                       (g["adv"] for g in glyphs)],
                    "glyphIds": [g["gid"] for g in glyphs],
                })

        # تجميع الأسطر: نفس OriginY ضمن سماحية ±2 twips
        lines_map = defaultdict(list)
        for r in runs:
            key = round(r["y"] / 2) * 2
            lines_map[key].append(r)
        lines = []
        for y in sorted(lines_map):
            rs = sorted(lines_map[y], key=lambda r: r["x"])
            # في المقاطع RTL ‏(BidiLevel فردي) يمتد المقطع يسارًا من OriginX،
            # وفي LTR يمتد يمينًا — حدود السطر تُحسب وفق الاتجاه (XPS spec).
            starts, ends = [], []
            for r in rs:
                adv = r["advSumTwips"] or 0
                if r["bidiLevel"] % 2 == 1:
                    starts.append(r["x"] - adv); ends.append(r["x"])
                else:
                    starts.append(r["x"]); ends.append(r["x"] + adv)
            lines.append({
                "baselineTwips": y,
                "xMin": min(starts),
                "xMax": max(ends),
                "text": " ".join(r["text"] for r in rs),
                "runs": rs,
            })
        pages.append({
            "widthTwips": width_tw, "heightTwips": height_tw,
            "lineCount": len(lines), "lines": lines,
        })

    return {"source": xps_path.replace("\\", "/").split("/")[-1],
            "unit": "twips", "pageCount": len(pages), "pages": pages}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("xps")
    ap.add_argument("--pages", type=int, default=None)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    data = extract(a.xps, a.pages)
    out = a.out or re.sub(r"\.xps$", "", a.xps) + ".truth.json"
    json.dump(data, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    total_lines = sum(p["lineCount"] for p in data["pages"])
    print(f"OK: {out} — صفحات: {data['pageCount']}، أسطر: {total_lines}")
