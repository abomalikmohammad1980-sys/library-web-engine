#!/usr/bin/env python3
"""استخراج خطوط XPS المضمنة وربطها بالخطوط الأصلية على الجهاز.

- خطوط XPS ملفات ‎.odttf: نفس TTF لكن أول 32 بايت معتّمة بـ XOR مع بايتات
  الـ GUID (من اسم الملف) بترتيب معكوس — نفكها ونحفظ ‎.ttf.
- هذه الخطوط subsets (قد تخلو من GSUB) فلا تصلح للتشكيل — نقرأ منها اسم
  العائلة فقط، ثم نبحث عن الخط الأصلي في مجلدات الخطوط المعروفة.

الناتج: fonts/<guid>.ttf + fonts-map.json ‏{odttf: {family, subset, original}}
"""
from __future__ import annotations

import io
import json
import os
import re
import sys
import zipfile

from fontTools.ttLib import TTFont

SEARCH_DIRS = [
    r"C:\Windows\Fonts",
    os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Windows\Fonts"),
    r"C:\yamansoft\projects\ai_library\ai_library_flutter\assets\fonts",
    os.path.expandvars(r"%APPDATA%\shamela_4\fonts"),
]


def deobfuscate(name: str, data: bytes) -> bytes:
    guid_hex = re.sub(r"[^0-9A-Fa-f]", "", os.path.splitext(os.path.basename(name))[0])
    key = bytes.fromhex(guid_hex)[::-1]  # 16 بايت معكوسة
    head = bytes(b ^ key[i % 16] for i, b in enumerate(data[:32]))
    return head + data[32:]


def families_of(font: TTFont) -> set[str]:
    fams = set()
    for rec in font["name"].names:
        if rec.nameID in (1, 16):
            try:
                fams.add(rec.toUnicode().strip())
            except Exception:  # noqa: BLE001
                pass
    return fams


def index_system_fonts() -> dict[str, str]:
    idx: dict[str, str] = {}
    for d in SEARCH_DIRS:
        if not os.path.isdir(d):
            continue
        for fn in os.listdir(d):
            if not fn.lower().endswith((".ttf", ".otf", ".ttc")):
                continue
            path = os.path.join(d, fn)
            try:
                if fn.lower().endswith(".ttc"):
                    continue  # مجموعات — نتجاوزها في النموذج الأولي
                f = TTFont(path, lazy=True, fontNumber=0)
                for fam in families_of(f):
                    idx.setdefault(fam.lower(), path)
                f.close()
            except Exception:  # noqa: BLE001
                pass
    return idx


def main(xps_path: str):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    out_dir = os.path.join(os.path.dirname(xps_path), "fonts",
                           os.path.splitext(os.path.basename(xps_path))[0])
    os.makedirs(out_dir, exist_ok=True)
    sys_idx = index_system_fonts()
    print(f"فهرس خطوط الجهاز: {len(sys_idx)} عائلة")

    z = zipfile.ZipFile(xps_path)
    mapping = {}
    for name in z.namelist():
        if not name.lower().endswith(".odttf"):
            continue
        raw = deobfuscate(name, z.read(name))
        base = os.path.splitext(os.path.basename(name))[0]
        subset_path = os.path.join(out_dir, base + ".ttf")
        open(subset_path, "wb").write(raw)
        fam, original = None, None
        try:
            f = TTFont(io.BytesIO(raw), lazy=True)
            fams = families_of(f)
            fam = sorted(fams)[0] if fams else None
            has_gsub = "GSUB" in f
            f.close()
        except Exception as e:  # noqa: BLE001
            print(f"  تحذير: تعذر قراءة {base}: {e}")
            has_gsub = None
        if fam:
            original = sys_idx.get(fam.lower())
        mapping[os.path.basename(name)] = {
            "family": fam,
            "subset": subset_path.replace("\\", "/"),
            "subsetHasGSUB": has_gsub,
            "original": (original or "").replace("\\", "/") or None,
        }
        status = "✓" if original else "✗ لا أصل"
        print(f"  {base[:12]}… {fam!r:40} GSUB(subset)={has_gsub} {status}")

    map_path = os.path.join(out_dir, "fonts-map.json")
    json.dump(mapping, open(map_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    matched = sum(1 for v in mapping.values() if v["original"])
    print(f"الخريطة: {map_path} — مطابَق للأصل: {matched}/{len(mapping)}")


if __name__ == "__main__":
    main(sys.argv[1])
