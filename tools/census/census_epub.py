#!/usr/bin/env python3
"""إحصاء نصي للمكتبة التراثية الحقيقية (GoldenShamela — ‏EPUB لكل كتاب).

المكتبة الحقيقية ليست docx (لا خطوط ولا w:compat فيها) — فأبعاد هذا الإحصاء
نصّية تُوجّه أولويات قواعد المحرك مباشرة:
  - كثافة التشكيل (تمس نمذجة تقدمات الحركات وحدّيات القياس)
  - التطويل اليدوي ـ U+0640 (مدخل قواعد الكشيدة)
  - رموز الصلاة/الترضي (ﷺ ﷻ ...) والأرقام بأنواعها (قواعد w:sym/الأرقام)
  - علامات الشعر/الأبيات والفواصل (أنماط أسطر خاصة)
  - أطوال الفقرات (توزيع مدخل الكاسر)

الاستخدام: python census_epub.py <books_dir> [--sample N] [--seed S]
المخرجات: تقرير Markdown + JSON في tools/census/output/
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import random
import re
import sys
import zipfile
from datetime import datetime, timezone

ARABIC_LETTER = re.compile(r"[ء-يٱ-ۓ]")
MARKS = re.compile(r"[ً-ْٰ]")
TATWEEL = "ـ"
HONORIFICS = re.compile(r"[ﷺﷻ﷽﵎-﵏ۖ-ۭ]")
DIGITS_AR = re.compile(r"[٠-٩]")
DIGITS_LAT = re.compile(r"[0-9]")
POETRY_SEP = re.compile(r"\.\.\.|…|\*\s*\*")
TAG = re.compile(r"<[^>]+>")


def book_epub(path: str) -> str | None:
    try:
        with zipfile.ZipFile(path) as z:
            parts = [n for n in z.namelist() if n.endswith((".xhtml", ".html", ".htm"))]
            texts = []
            for n in sorted(parts):
                raw = z.read(n).decode("utf-8", "ignore")
                texts.append(TAG.sub(" ", raw))
            return "\n".join(texts)
    except Exception:
        return None


def main() -> None:
    # كونسول ويندوز cp1256 يخنق ﷺ وأشباهها — الطباعة بأمان
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("books_dir")
    ap.add_argument("--sample", type=int, default=500)
    ap.add_argument("--seed", type=int, default=1)
    args = ap.parse_args()

    ids = [d for d in os.listdir(args.books_dir)
           if os.path.isdir(os.path.join(args.books_dir, d))]
    random.Random(args.seed).shuffle(ids)

    agg = collections.Counter()
    per_book = []
    scanned = 0
    for bid in ids:
        if scanned >= args.sample:
            break
        bdir = os.path.join(args.books_dir, bid)
        epubs = [f for f in os.listdir(bdir) if f.endswith(".epub")]
        if not epubs:
            continue
        text = book_epub(os.path.join(bdir, epubs[0]))
        if not text:
            continue
        letters = len(ARABIC_LETTER.findall(text))
        if letters < 1000:
            continue
        marks = len(MARKS.findall(text))
        st = {
            "id": bid,
            "name": os.path.splitext(epubs[0])[0][:60],
            "letters": letters,
            "marks": marks,
            "markDensity": round(marks / letters, 4),
            "tatweel": text.count(TATWEEL),
            "honorifics": len(HONORIFICS.findall(text)),
            "digitsArabicIndic": len(DIGITS_AR.findall(text)),
            "digitsLatin": len(DIGITS_LAT.findall(text)),
            "poetrySeps": len(POETRY_SEP.findall(text)),
        }
        per_book.append(st)
        for k in ("letters", "marks", "tatweel", "honorifics",
                  "digitsArabicIndic", "digitsLatin", "poetrySeps"):
            agg[k] += st[k]
        scanned += 1
        if scanned % 50 == 0:
            print(f"... {scanned}/{args.sample}", file=sys.stderr)

    dens = sorted(b["markDensity"] for b in per_book)
    def pct(p: float) -> float:
        return dens[min(len(dens) - 1, int(p * len(dens)))] if dens else 0.0

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    out_dir = os.path.join(os.path.dirname(__file__), "output")
    os.makedirs(out_dir, exist_ok=True)

    heavy = sorted(per_book, key=lambda b: -b["markDensity"])[:15]
    tat = sorted(per_book, key=lambda b: -b["tatweel"])[:15]
    lines = [
        f"# الإحصاء النصي للمكتبة التراثية — {stamp}Z",
        f"- المصدر: {args.books_dir}",
        f"- كتب مفحوصة: {scanned} (عينة عشوائية seed={args.seed}) من {len(ids)} مجلدًا",
        f"- أحرف عربية: {agg['letters']:,} · حركات: {agg['marks']:,} "
        f"(كثافة كلية {agg['marks']/max(agg['letters'],1):.2%})",
        f"- كثافة التشكيل: وسيط {pct(0.5):.2%} · ربيع أعلى {pct(0.75):.2%} · عشير أعلى {pct(0.9):.2%}",
        f"- تطويل يدوي (ـ): {agg['tatweel']:,} · رموز تشريف (ﷺ…): {agg['honorifics']:,}",
        f"- أرقام هندية: {agg['digitsArabicIndic']:,} · لاتينية: {agg['digitsLatin']:,}",
        f"- فواصل شعرية تقريبية: {agg['poetrySeps']:,}",
        "",
        "## الأثقل تشكيلًا (مادة حدّيات القياس المستقبلية)",
        *[f"- {b['markDensity']:.1%} — {b['name']}" for b in heavy],
        "",
        "## الأكثر تطويلًا يدويًا (مادة قواعد الكشيدة)",
        *[f"- {b['tatweel']:,} — {b['name']}" for b in tat],
    ]
    md = os.path.join(out_dir, f"census-epub-{stamp}.md")
    with open(md, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    with open(os.path.join(out_dir, f"census-epub-{stamp}.json"), "w", encoding="utf-8") as f:
        json.dump({"aggregate": dict(agg), "books": per_book}, f, ensure_ascii=False, indent=1)
    print("\n".join(lines[:12]))
    print(f"\nOK: {md}")


if __name__ == "__main__":
    main()
