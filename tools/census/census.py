#!/usr/bin/env python3
"""أداة إحصاء المكتبة (Census) — ثلاث مهام في مسح واحد:

1. بنى OOXML: أي عناصر تظهر فعلًا وبأي نسب (يوجه أولويات المحرك).
2. جرد الخطوط: كل خط مطلوب في الكتب (مدخل قرار الترخيص — architecture §4.2).
3. رايات w:compat: أي رايات توافق تحملها الكتب (تدخل نموذج المستند — ADR/architecture §4.1).

الأوضاع:
  python census.py --docx  <dir>   يمسح ملفات .docx (كامل: بنى + خطوط + compat)
  python census.py --cache <dir>   يمسح كاش كتب التطبيق الأصلي (pages/*.json.gz + metadata.json)

المخرجات: تقرير Markdown + JSON في tools/census/output/ (خارج git).
"""
from __future__ import annotations

import argparse
import collections
import glob
import gzip
import json
import os
import re
import sys
import zipfile
from datetime import datetime, timezone

# ---------------------------------------------------------------- البنى المرصودة
PATTERNS = {
    # نص وتخطيط شائع
    "runs (w:r)": r"<w:r[ >]",
    "text (w:t)": r"<w:t[ >]",
    "numbering (w:numPr)": r"<w:numPr[ >]",
    "tabs (w:tab)": r"<w:tab[ /]",
    "positional tab (w:ptab)": r"<w:ptab[ />]",
    "hyperlink": r"<w:hyperlink[ >]",
    "table cell (w:tc)": r"<w:tc[ >]",
    "paragraph borders (w:pBdr)": r"<w:pBdr[ >]",
    "kern (w:kern)": r"<w:kern[ />]",
    "char spacing (w:spacing in rPr)": r"<w:spacing[^>]*w:val=\"-?\d+\"/>",
    # حقول ورموز وحواشٍ
    "footnote ref": r"<w:footnoteReference[ />]",
    "field char (w:fldChar)": r"<w:fldChar[ >]",
    "instrText": r"<w:instrText[ >]",
    "symbol (w:sym)": r"<w:sym[ >]",
    # صور DrawingML
    "drawing (w:drawing)": r"<w:drawing[ >]",
    "inline (wp:inline)": r"<wp:inline[ >]",
    "anchor (wp:anchor)": r"<wp:anchor[ >]",
    "pic:pic": r"<pic:pic[ >]",
    # VML قديم
    "pict (w:pict)": r"<w:pict[ >]",
    "v:shape": r"<v:shape[ >]",
    "v:group": r"<v:group[ >]",
    "v:line": r"<v:line[ >]",
    "v:rect/roundrect": r"<v:(?:round)?rect[ >]",
    "v:imagedata": r"<v:imagedata[ >]",
    "v:textbox": r"<v:textbox[ >]",
    "v:stroke dashstyle": r"<v:stroke[^>]*dashstyle",
    # DrawingML shapes حديثة
    "AlternateContent": r"<mc:AlternateContent[ >]",
    "wps:wsp": r"<wps:wsp[ >]",
    "a:prstGeom": r"<a:prstGeom[ >]",
    "a:custGeom": r"<a:custGeom[ >]",
    "txbxContent": r"<w:txbxContent[ >]",
    # صور قديمة متجهية (سقف جودة — architecture §4.7)
    "EMF/WMF image ref": r"\.(?:emf|wmf)\"",
}
COMPILED = {k: re.compile(v) for k, v in PATTERNS.items()}
HARD_SHAPE = {
    "pict (w:pict)", "v:shape", "v:group", "v:line", "v:rect/roundrect",
    "v:textbox", "AlternateContent", "wps:wsp", "a:custGeom",
}
RFONTS_RE = re.compile(r'<w:rFonts[^>]*w:(?:ascii|cs|hAnsi)="([^"]+)"')


class BookStats:
    def __init__(self, name: str):
        self.name = name
        self.paragraphs = 0
        self.pages = 0
        self.elem_paras = collections.Counter()
        self.elem_occ = collections.Counter()
        self.hard_paras = 0
        self.fonts = collections.Counter()          # اسم الخط ← مرات الطلب في rFonts
        self.font_table = []                        # أسماء fontTable.xml (وضع docx)
        self.compat_flags = {}                      # راية ← قيمة (وضع docx)

    def scan_paragraph_xml(self, xml: str):
        self.paragraphs += 1
        hard = False
        for key, rx in COMPILED.items():
            hits = rx.findall(xml)
            if hits:
                self.elem_paras[key] += 1
                self.elem_occ[key] += len(hits)
                if key in HARD_SHAPE:
                    hard = True
        if hard:
            self.hard_paras += 1
        for fam in RFONTS_RE.findall(xml):
            self.fonts[fam] += 1


# ---------------------------------------------------------------- وضع docx
def scan_docx(path: str) -> BookStats:
    st = BookStats(os.path.splitext(os.path.basename(path))[0])
    with zipfile.ZipFile(path) as z:
        names = set(z.namelist())

        doc = z.read("word/document.xml").decode("utf-8", "replace")
        # فقرة = <w:p ...>…</w:p> على مستوى تقريبي يكفي للإحصاء
        for para in re.findall(r"<w:p[ >].*?</w:p>", doc, flags=re.S):
            st.scan_paragraph_xml(para)
        # الهيدر/الفوتر/الحواشي أيضًا بنى معروضة
        for part in names:
            if re.match(r"word/(header|footer|footnotes|endnotes)\d*\.xml$", part):
                content = z.read(part).decode("utf-8", "replace")
                for para in re.findall(r"<w:p[ >].*?</w:p>", content, flags=re.S):
                    st.scan_paragraph_xml(para)

        if "word/fontTable.xml" in names:
            ft = z.read("word/fontTable.xml").decode("utf-8", "replace")
            st.font_table = re.findall(r'<w:font w:name="([^"]+)"', ft)

        if "word/settings.xml" in names:
            settings = z.read("word/settings.xml").decode("utf-8", "replace")
            m = re.search(r"<w:compat>(.*?)</w:compat>", settings, flags=re.S)
            if m:
                block = m.group(1)
                for tag, attrs in re.findall(r"<w:(\w+)((?:\s+[^>]*?)?)/>", block):
                    if tag == "compatSetting":
                        nm = re.search(r'w:name="([^"]+)"', attrs)
                        vl = re.search(r'w:val="([^"]+)"', attrs)
                        st.compat_flags[f"compatSetting:{nm.group(1) if nm else '?'}"] = (
                            vl.group(1) if vl else "?"
                        )
                    else:
                        vl = re.search(r'w:val="([^"]+)"', attrs)
                        st.compat_flags[tag] = vl.group(1) if vl else "true"
    st.pages = -1  # غير معروف بلا تخطيط
    return st


# ---------------------------------------------------------------- وضع الكاش
def scan_cache_book(book_dir: str) -> BookStats:
    st = BookStats(os.path.basename(book_dir.rstrip("/\\")))
    meta_path = os.path.join(book_dir, "metadata.json")
    if os.path.exists(meta_path):
        try:
            meta = json.load(open(meta_path, encoding="utf-8"))
            for f in meta.get("fontsList") or []:
                name = f.get("name") if isinstance(f, dict) else str(f)
                if name:
                    st.font_table.append(name)
        except Exception as e:  # noqa: BLE001
            print(f"  تحذير: تعذر قراءة metadata.json: {e}", file=sys.stderr)

    pages = sorted(glob.glob(os.path.join(book_dir, "pages", "*.json.gz")))
    st.pages = len(pages)
    for pf in pages:
        data = json.loads(gzip.open(pf).read().decode("utf-8"))
        for p in data.get("ps", []):
            xml = p.get("xmlString") or ""
            if xml:
                st.scan_paragraph_xml(xml)
    return st


# ---------------------------------------------------------------- التقرير
def report(stats: list[BookStats], mode: str, out_dir: str):
    os.makedirs(out_dir, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")

    all_fonts = collections.Counter()
    all_compat = collections.Counter()
    lines = [f"# تقرير الإحصاء — وضع {mode} — {stamp}Z", ""]
    for st in stats:
        pct = lambda n: f"{100 * n / max(st.paragraphs, 1):.2f}%"  # noqa: E731
        lines += [
            f"## {st.name}",
            f"- فقرات: {st.paragraphs}" + (f" · صفحات كاش: {st.pages}" if st.pages >= 0 else ""),
            f"- فقرات بأشكال «صعبة» (VML/wsp/group/custGeom): {st.hard_paras} ({pct(st.hard_paras)})",
            "",
            "| البنية | فقرات | % | تكرارات |",
            "|---|---|---|---|",
        ]
        for key in PATTERNS:
            if st.elem_paras[key]:
                lines.append(
                    f"| {key} | {st.elem_paras[key]} | {pct(st.elem_paras[key])} | {st.elem_occ[key]} |"
                )
        fonts = collections.Counter(st.font_table) + st.fonts
        all_fonts.update(fonts)
        if fonts:
            lines += ["", "**الخطوط المطلوبة:** " + "، ".join(sorted(fonts))]
        if st.compat_flags:
            all_compat.update(st.compat_flags.keys())
            lines += ["", "**رايات w:compat:**"]
            lines += [f"- `{k}` = {v}" for k, v in sorted(st.compat_flags.items())]
        lines.append("")

    lines += ["---", "## الخلاصة العرضية (كل الكتب)", ""]
    lines += ["**كل الخطوط (لقرار الترخيص):**", ""]
    lines += [f"- {name} × {cnt}" for name, cnt in all_fonts.most_common()]
    if all_compat:
        lines += ["", "**كل رايات compat المرصودة:**", ""]
        lines += [f"- `{k}` في {v} كتاب" for k, v in all_compat.most_common()]

    md_path = os.path.join(out_dir, f"census-{mode}-{stamp}.md")
    open(md_path, "w", encoding="utf-8").write("\n".join(lines))
    json_path = os.path.join(out_dir, f"census-{mode}-{stamp}.json")
    json.dump(
        {
            st.name: {
                "paragraphs": st.paragraphs,
                "pages": st.pages,
                "hard_paras": st.hard_paras,
                "elements": dict(st.elem_paras),
                "occurrences": dict(st.elem_occ),
                "fonts": dict(collections.Counter(st.font_table) + st.fonts),
                "compat": st.compat_flags,
            }
            for st in stats
        },
        open(json_path, "w", encoding="utf-8"),
        ensure_ascii=False,
        indent=1,
    )
    print(f"التقرير: {md_path}")
    return md_path


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--docx", help="مجلد يحوي ملفات .docx (بحث تكراري)")
    g.add_argument("--cache", help="مجلد كاش كتب التطبيق الأصلي (كل كتاب: metadata.json + pages/)")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "output"))
    args = ap.parse_args()

    stats: list[BookStats] = []
    if args.docx:
        files = glob.glob(os.path.join(args.docx, "**", "*.docx"), recursive=True)
        if not files:
            sys.exit("لا ملفات .docx في المسار المعطى")
        for f in files:
            print(f"مسح docx: {os.path.basename(f)}")
            stats.append(scan_docx(f))
        report(stats, "docx", args.out)
    else:
        books = [
            d for d in glob.glob(os.path.join(args.cache, "*"))
            if os.path.isdir(os.path.join(d, "pages"))
        ]
        if not books:
            sys.exit("لا كتب كاش (مجلدات فيها pages/) في المسار المعطى")
        for b in books:
            print(f"مسح كاش: {os.path.basename(b)}")
            stats.append(scan_cache_book(b))
        report(stats, "cache", args.out)


if __name__ == "__main__":
    main()
