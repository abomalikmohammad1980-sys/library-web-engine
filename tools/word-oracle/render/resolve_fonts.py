# -*- coding: utf-8 -*-
"""محلِّل خطوط generic: يبني family→{file,metrics} من خطوط الكتب + خطوط النظام.
يمسح C:/Windows/Fonts بأسماء العائلة (name table) ويستخرج المقاييس."""
import json, os, glob
from fontTools.ttLib import TTFont, TTCollection

NEEDED = json.load(open("tools/word-oracle/render/fams.json", encoding="utf-8"))
BOOK_FONTS = {
    "adwa-assalaf": "corpus/book-fonts/adwa-assalaf.ttf",
    "Al-Jazeera-Arabic-Regular": "corpus/book-fonts/Al-Jazeera-Arabic-Regular.ttf",
    "Al-Jazeera-Arabic-Light": "corpus/book-fonts/Al-Jazeera-Arabic-Light.ttf",
    "Traditional Arabic": "corpus/book-fonts/trado.ttf",
}

def fam_names(f):
    names = set()
    try:
        for rec in f["name"].names:
            if rec.nameID in (1, 16):
                try: names.add(rec.toUnicode())
                except Exception: pass
    except Exception: pass
    return names

def metrics_of(f):
    u = f["head"].unitsPerEm; h = f["hhea"]; o = f["OS/2"]
    return {"upem": u, "a": round(h.ascent/u, 6), "d": round(-h.descent/u, 6),
            "g": round(h.lineGap/u, 6), "wd": round(o.usWinDescent/u, 6), "wa": round(o.usWinAscent/u, 6)}

# فهرس خطوط النظام: family (منخفض) → مسار
sys_index = {}
for path in glob.glob("C:/Windows/Fonts/*.ttf") + glob.glob("C:/Windows/Fonts/*.ttc"):
    try:
        fonts = TTCollection(path).fonts if path.lower().endswith(".ttc") else [TTFont(path, fontNumber=0)]
        for f in fonts:
            for nm in fam_names(f):
                sys_index.setdefault(nm.lower().strip(), path)
    except Exception:
        continue

out = {}; unresolved = []
for fam in NEEDED:
    if fam in BOOK_FONTS and os.path.exists(BOOK_FONTS[fam]):
        f = TTFont(BOOK_FONTS[fam]); m = metrics_of(f); m["file"] = BOOK_FONTS[fam]; out[fam] = m; continue
    p = sys_index.get(fam.lower().strip())
    if p:
        try:
            f = TTCollection(p).fonts[0] if p.lower().endswith(".ttc") else TTFont(p)
            m = metrics_of(f); m["file"] = p.replace("\\", "/"); out[fam] = m; continue
        except Exception: pass
    unresolved.append(fam)

json.dump(out, open("tools/word-oracle/render/font-metrics.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("resolved:", len(out), "/", len(NEEDED))
print("unresolved (fallback to book font):", unresolved)
