# -*- coding: utf-8 -*-
"""جدولُ بدائل الخطوط — **مقيسٌ من Word لا مُخمَّن**.

المشكلة (حصاد ٢٨): مقطعٌ يشير إلى خطٍّ لا نملك مقاييسَه يسقط عندنا إلى مقاييس
**خطّ المتن**، بينما Word يستبدله ويأخذ مقاييسَ **بديله**. والفرقُ ضخم:
صفوفُ فهرس masjid ٧٢٥tw عندنا مقابل ٤٨٧ عند Word.

والاحتياطيُّ الواحد لا يصلح: «(AH) Manal Bold» بديلُه بمقاييس ١٫١٤٧٥ بينما
«mohammad bold art 1» بديلُه ≈١٫٢٩٥.

الحلُّ هنا: **لا نخمّن البديل — نسأل Word عنه.** حقيقةُ XPS تسمّي، لكلّ مقطعٍ،
ملفَّ الخطّ الذي رسمه Word فعلًا. فنصل مقاطعَ النموذج بمقاطع الحقيقة **بنصّها**،
فنعرف: العائلةُ المفقودة X ⟵ رسمها Word بالملفّ Y ⟵ ومقاييسُ Y معلومة.

الاستخدام:  python build_font_substitutions.py [كتاب ...]
الناتج:     tools/word-oracle/render/font-substitutions.json
"""
import json, os, re, sys, glob, collections

from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RENDER = os.path.join(ROOT, "tools", "word-oracle", "render")
OUT_PATH = os.path.join(RENDER, "font-substitutions.json")
# أدنى عددِ شواهدَ لقبول قيدٍ: دونه يكون الوصلُ بالنصّ ظنًّا لا قياسًا (مقيس)
MIN_WITNESSES = 20


def norm(s: str) -> str:
    """تطبيعٌ للوصل: عربيّةٌ وأرقامٌ فقط (يُسقِط التشكيلَ والفراغَ وعلاماتِ الترقيم)."""
    return re.sub(r"[^ء-ي0-9]", "", s or "")


def metrics_of(path: str) -> dict | None:
    """نفسُ صيغة font-metrics.json: النِّسَبُ من OS/2 مقسومةً على upem."""
    try:
        f = TTFont(path, fontNumber=0, lazy=True)
        upem = f["head"].unitsPerEm
        os2 = f["OS/2"]
        hhea = f["hhea"]
        return {
            "upem": upem,
            "a": round(os2.usWinAscent / upem, 6),
            "d": round(os2.usWinDescent / upem, 6),
            "g": round(max(0, hhea.lineGap) / upem, 6),
            "wd": round(os2.usWinDescent / upem, 6),
            "wa": round(os2.usWinAscent / upem, 6),
        }
    except Exception:
        return None


def model_runs(book: str) -> list[tuple[str, str]]:
    """(نصٌّ مُطبَّع، عائلةُ الخطّ) لكلّ مقطعٍ مرئيّ — عبر مُستخرِج النموذج."""
    import subprocess
    js = r"""
    import('./packages/ooxml-model/dist/index.js').then(({extractFromDocx})=>{
      const {readFileSync}=require('node:fs');
      const m=extractFromDocx(readFileSync(process.argv[1]));
      const out=[];
      const walk=(ps)=>{ for(const p of ps){ for(const r of p.runs){
        if(!r.hidden && r.text && r.family) out.push([r.text, r.family]); }
        for(const a of p.anchors??[]) if(a.textBox) walk(a.textBox); } };
      walk(m.paragraphs);
      for(const [,ps] of m.headerFooters) walk(ps);
      for(const [,ps] of m.footnotes) walk(ps);
      process.stdout.write(JSON.stringify(out));
    });"""
    r = subprocess.run(["node", "-e", js, os.path.join(ROOT, "corpus", "books", book + ".docx")],
                       capture_output=True, cwd=ROOT)
    if r.returncode != 0:
        return []
    return [(norm(t), f) for t, f in json.loads(r.stdout.decode("utf-8"))]


def main(books: list[str]) -> None:
    have = {}
    for p in [os.path.join(RENDER, "font-metrics.json")]:
        have.update(json.load(open(p, encoding="utf-8")))

    # **لكلّ كتابٍ جدولُه**: نفسُ اسم العائلة قد يحمل مقاييسَ مختلفةً بين كتابَين
    # (نسختان من الخطّ). جدولٌ واحدٌ عابرٌ للكتب يُفسِد بعضَها ببعض.
    table: dict[str, dict] = {}

    for book in books:
        truth_path = os.path.join(ROOT, "corpus", "ground-truth", book + ".truth.json")
        if not os.path.exists(truth_path):
            print("  تخطٍّ (لا حقيقة):", book)
            continue
        sub_path = os.path.join(RENDER, "subset-metrics-%s.json" % book)
        subset = json.load(open(sub_path, encoding="utf-8")) if os.path.exists(sub_path) else {}
        known = dict(have); known.update(subset)

        truth = json.load(open(truth_path, encoding="utf-8"))
        # نصٌّ مُطبَّع ⟵ ملفُّ الخطّ الذي رسمه Word
        by_text: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
        for page in truth["pages"]:
            for line in page["lines"]:
                for run in line.get("runs", []):
                    k = norm(run.get("text", ""))
                    if len(k) >= 3 and run.get("font"):
                        by_text[k][run["font"]] += 1

        fonts_dir = os.path.join(ROOT, "corpus", "ground-truth", "fonts", book)
        missing: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
        # نمرّ على **كلّ** العائلات لا المفقودةَ وحدَها: قد نملك مقاييسَ اسمٍ
        # ما بينما رسم Word بخطٍّ آخرَ مقاييسُه مختلفة (نسخةٌ أخرى من الخطّ).
        for text, family in model_runs(book):
            if len(text) < 3:
                continue
            for f, n in by_text.get(text, {}).items():
                missing[family][f] += n

        for family, counter in missing.items():
            if not counter:
                continue
            odttf, votes = counter.most_common(1)[0]
            stem = os.path.splitext(os.path.basename(odttf))[0]
            cand = os.path.join(fonts_dir, stem + ".ttf")
            met = metrics_of(cand) if os.path.exists(cand) else None
            if not met:
                continue
            total = sum(counter.values())
            met["_source"] = "%s:%s" % (book, stem[:8])
            met["_confidence"] = round(votes / total, 3)
            ours = known.get(family)
            sum_word = met["a"] + met["d"] + met["g"]
            sum_ours = (ours["a"] + ours["d"] + ours.get("g", 0)) if ours else None
            # عائلةٌ نملك مقاييسَها ويوافقها Word: لا حاجة لتسجيلها
            if sum_ours is not None and abs(sum_word - sum_ours) < 0.002:
                continue
            # حدُّ الشواهد يسري على **كلّ** قيد، لا على المُبدَّل وحدَه. القياس:
            # قيودُ muqtarah الأربعة كلُّها بشاهدٍ إلى خمسة، وأنزلت اتّفاقَ حدّ
            # صفحتها ٩٦٪ ⟶ ٩٢٪. الوصلُ بالنصّ يُخطئ حين يقلّ الشاهد.
            # حارسان مختلفان:
            # (أ) حدُّ الشواهد يسري على **كلّ** قيد — دونه الوصلُ بالنصّ ظنٌّ لا قياس.
            #     (قيودُ muqtarah الأربعة بشاهدٍ إلى خمسة أنزلت اتّفاقَ صفحتها ٩٦⟶٩٢٪.)
            # (ب) حدُّ الثقة يسري على **المُبدَّل** وحدَه: خطٌّ مفقودٌ لا بديلَ لنا عنه،
            #     فثقةٌ متوسّطةٌ خيرٌ من السقوط إلى خطّ المتن. (‏Khalid Art bold ثقتُه
            #     ٦٦٪ لكنّ شواهدَه ٥٦١١، وإسقاطُه أعاد masjid من ٥٠٪ إلى ٠٪.)
            if total < MIN_WITNESSES:
                continue
            if sum_ours is not None and met["_confidence"] < 0.75:
                continue
            table.setdefault(book, {})[family] = met
            tag = "مفقود" if ours is None else ("مختلف %.4f⟶%.4f" % (sum_ours, sum_word))
            print("  %-30s ⟵ %s  (a+d+g=%.4f، ثقة %.0f%%، %d شاهدًا) [%s]"
                  % (family, stem[:8], sum_word, 100 * met["_confidence"], total, tag))

    merged: dict[str, dict] = {}
    if os.path.exists(OUT_PATH):
        merged = json.load(open(OUT_PATH, encoding="utf-8"))
    merged.update(table)
    json.dump(merged, open(OUT_PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("كُتِب %s — %d كتابًا، %d قيدًا"
          % (OUT_PATH, len(merged), sum(len(v) for v in merged.values())))


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        args = [os.path.splitext(os.path.basename(p))[0]
                for p in sorted(glob.glob(os.path.join(ROOT, "corpus", "books", "sample-*.docx")))]
    main(args)
