# Q1 — حزمة Quranpedia الكاملة المحلية — 2026-08-09

## النتيجة

- المصدر: Quranpedia API v1، المصحف رقم 2، 114 endpoint سورة، بلا scraping HTML.
- 6236/6236 آية بهويات فريدة `surah:ayah`، والنص ومعرف السجل مطابقان لاستجابة
  كل سورة المحفوظة في checkpoint.
- corpus SHA-256:
  `153aec6dd05dac6616a23da55c02780eb6ed86dbc041a60c016edc614cdfa906`.
- search SHA-256:
  `8f5be71f7edafed1ea02d896b1b7faa92f6c3b086ffeea696b07629aa657a57d`.

## المسارات المحلية

- source pack القابل للاستئناف:
  `B:\المكتبة\الخزانة\generated\quranpedia-hafs-uthmani-v1`.
- التثبيت النشط:
  `B:\المكتبة\الخزانة\generated\installed-quran-packs\quranpedia-hafs-uthmani-full-1.0.0-153aec6dd05d`.
- مؤشر النسخة النشطة:
  `B:\المكتبة\الخزانة\generated\installed-quran-packs\quranpedia-hafs-uthmani-full.active.json`.

البيانات الكبيرة خارج Git. الأدوات والكود والاختبارات فقط داخل المستودع.

## الجلب والتحقق

- `tools/fetch-quranpedia-full-pack.mjs`: retry/backoff وحد 512 KiB للاستجابة،
  checkpoint ذري لكل سورة، واستئناف السور الصالحة، ثم final files ذرية.
- يفشل إن لم يكن العدد 6236 أو تكررت هوية أو اختل ترتيب سورة/آية أو غاب النص.
- `tools/verify-quranpedia-full-pack.mjs`: يعيد حساب بصمتي corpus/search، ويطابق
  كل سجل مع الاستجابة الخام للسورة، ويشغل smoke search لـ«الحمد لله» → `1:2`.

## البحث

`quran-search-pack` يطبع العربية بإزالة التشكيل والتطويل افتراضيًا، وتوحيد
الألفات والياء والهمزة، ويرتب exact ثم prefix ثم all-terms ثم broad ordered.
الخيار `diacriticSensitive=true` صريح ويوقف broad غير الحساس.

## التثبيت والتحديث والحذف

`QuranCorpusPackManager` يتحقق من manifest والحجم والبصمتين، يرفض symlink
والاسم/المسار غير الآمن، ينسخ إلى مجلد immutable، ثم يبدل المؤشر. إعادة تثبيت
الحزمة نفسها idempotent؛ التحديث يبدل المؤشر ثم يزيل النسخة السابقة؛ الحذف
صريح ويزيل النسخة والمؤشر، وعدم وجودها يعيد false.

## النسبة والإذن

تظهر نسبة Quranpedia وURL ووقت الجلب في manifest. يسجل
`USER-ATTESTED-WAQF-REUSE` وفق إقرار صاحب المشروع بتاريخ 2026-08-09، مع نص
`permissionBasis`، ولا يدعي معرف SPDX غير صادر من المصدر.
