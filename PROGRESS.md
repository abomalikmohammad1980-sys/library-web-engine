# سجل تنفيذ الأسبوع الأول

> يُحدَّث هذا الملف **قبل** بدء كل مهمة (In progress) **وبعد** إنهائها (done).
> المرجع: `docs/playbook.md` §7 — الأسبوع 1.

| # | المهمة | الحالة | ملاحظات |
|---|---|---|---|
| 1 | إنشاء الريبو + الهيكل + قالب PR + ‏.gitignore/.gitattributes | **done** ✅ | حماية `main` تتم على GitHub بعد الربط بـ remote (خطوة يدوية للمالك)؛ LFS مفعّل |
| 2 | نسخ `reference/` (محرك Dart + AGENTS.md + مراجع OOXML) والوثائق | **done** ✅ | ‏10MB؛ استُثني PDF المواصفة الضخم (يبقى في المستودع الأصلي) |
| 3 | كتابة PRD ‏(`docs/prd.md`) | **done** ✅ | قرار منتج معلق مُعلَم: تبديل الخطوط في الإطلاق الأول |
| 4 | كتابة `AGENTS.md` الجذري (دستور الوكلاء) | **done** ✅ | |
| 5 | سقالة pnpm/TS/Vitest + ‏CI workflow — أول اختبار أخضر محليًا | **done** ✅ | ‏5 اختبارات خضراء + typecheck + build؛ حزمة `layout` بدأت بوحدات twips/EMU الحقيقية |
| 6 | تدوين ADRs الخمسة الأولى | **done** ✅ | 0001 امتلاك التخطيط، 0002 التشغيل المزدوج، 0003 XPS أولًا، 0004 شبكة twips، 0005 الكشيدة الغليفية |
| 7 | نقل أداة census إلى `tools/census` وتشغيلها | **done** ✅ | شُغِّلت بوضعَي docx والكاش على العينة المتاحة (كتابان)؛ أنتجت أول جرد خطوط (27 خطًا) وخريطة رايات `w:compat` — انظر «نتائج أولية» أدناه |

## نتائج أولية من census (عينة كتابين — ليست المكتبة التراثية)

- **جرد الخطوط (مدخل قرار الترخيص):** 27 خطًا؛ أبرز المرشحين لمراجعة الترخيص: ‏Traditional Arabic، ‏PT Bold Heading، ‏GE SS Two، ‏DecoType Naskh، ‏Simplified Arabic، ‏(AH) Manal. ومقابلها حرة: ‏KFGQPC HAFS، ‏Aref Ruqaa، ‏adwa-assalaf.
- **رايات `w:compat` المرصودة:** `compatibilityMode=15`، ‏`doNotFlipMirrorIndents`، ‏`enableOpenTypeFeatures`، ‏`overrideTableStyleFontSizeAndJustification`، ‏`differentiateMultirowTableHeaders`، ‏`useWord2013TrackBottomHyphenation=0` — تدخل نموذج المستند من اليوم الأول.
- ⚠️ **محدودية معلنة:** العينة وثيقتان حديثتان لا كتب تراثية؛ **إعادة التشغيل على المكتبة الحقيقية بند أول في بوابة المرحلة 0.**

## خطوات يدوية متبقية على المالك

1. إنشاء remote على GitHub + ‏`git push` + تفعيل حماية `main` (تتطلب حسابك).
2. توفير مسار المكتبة التراثية الحقيقية (docx أو كاش) لإعادة تشغيل census عليها.

## سجل زمني

- 2026-07-12: تنفيذ المهام 1–7 كاملة — 8 commits على `main`، اختبارات خضراء (5/5)، typecheck وbuild ناجحان، census يعمل بوضعيه.
