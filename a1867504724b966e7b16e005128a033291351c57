# Q1 — إدخال Quranpedia المحلي الآمن — 2026-08-09

## المصدر والإسناد

المزوّد: **الموسوعة القرآنية Quranpedia**، API عام للقراءة بلا مصادقة، وفق
التوثيق الرسمي: `https://api.quranpedia.net/`، والأساس
`https://api.quranpedia.net/v1`. يجب أن يظهر اسم Quranpedia ورابط المصدر وإصدار
API في أي حزمة مشتقة. لا يثبت هذا العقد ترخيصًا مفقودًا؛ حقل `license` يبقى null
حتى يورده المصدر صراحةً.

## المنجز

- عميل read-only لمسارات mushafs/ayahs/surah information/tafsirs/books/topics/
  reciters/book، بلا token وبـredirect مرفوض.
- استجابات محدودة الحجم، timeout/cancel، وretry محدود لـ408/429/5xx مع
  Retry-After/backoff.
- provenance: URL وretrievedAt وETag وSHA-256 والحجم وإصدار v1.
- تنزيل حزم منشورة من مضيف Quranpedia فقط، يدعم Range resume، وحد الحجم، وعدد
  إدخالات ZIP والحجم المفكوك ونسبة الضغط والتشفير وpath traversal، ثم checksum.
- تخزين Node محلي داخل root محروس، وcommit ذري للحزمة والmanifest مع rollback عند
  فشل تثبيت manifest.
- AudioCore عام للتلاوات والكتب الصوتية والمحاضرات: work/chapter/segment، speaker/
  reciter/riwaya، توقيت الآية ومرجع النص، variants/ranges/checksum/provenance/
  license، وسياسة cache صريحة resume + LRU لغير المثبت.
- search-pack افتراضي واسع مرتب يتجاهل التشكيل، مع opt-in صريح للحساسية.

## التشغيل والتحديث والحذف

- لا تنزيل شامل في build أو test. التنزيل الكامل يجب أن يكون أمرًا صريحًا خارج
  البناء بعد مراجعة الحجم والترخيص والوجهة.
- التحديث ينشئ temp/resume ثم يتحقق ويستبدل ذريًا؛ تبقى النسخة السابقة عند الفشل.
- الحذف يزيل ملف الحزمة وmanifest المحليين فقط، ولا يرسل DELETE إلى Quranpedia.
- عينات الاختبار ZIP صغيرة مولدة محليًا؛ لا corpus ولا صوت كامل داخل Git.

## عينة Q1 حقيقية محلية

- جُلبت metadata العامة ثم سورة الفاتحة فقط من
  `https://api.quranpedia.net/v1/mushafs/2/1`؛ وصف المصحف في المصدر ينص على
  الخط العثماني، لذلك لم يُستنتج رسم إملائي غير موثق.
- الحزمة تحت `docs/qa/quran-q1-demo-staging/`: سبع هويات `1:1` إلى `1:7`، مع
  النص كما ورد بلا تعديل، واستجابة المصدر الخام، وmetadata المصحف وmanifest Q0.
- SHA-256 لبيانات الحزمة:
  `60840ea24fbd35eff147aed1ca29380de99c175b5bf8d1c9d582c36ed63a58b9`.
  SHA-256 لاستجابة المصدر الخام:
  `b79e60c69a283cf1a3e2d98337e36bb83534e779349e103ef269aefbf1bfeef0`.
- لم يرسل الخادم ETag. سُجلت القيمة null بدل اختلاقها.
- لم يظهر معرف ترخيص SPDX في الاستجابة. وبناءً على إقرار صاحب المشروع بتاريخ
  2026-08-09 بأن Quranpedia مصدر وقفي مصرح بالانتفاع والنشر في الخزانة الوقفية،
  يسجل manifest الأساس `USER-ATTESTED-WAQF-REUSE` مع نص الإقرار والنسبة؛ لا يدعي
  أن هذا معرف SPDX أو نص ترخيص صادر من API. الحزمة قابلة للتثبيت والنشر مع إبقاء
  attribution ظاهرًا.
- `tools/verify-quranpedia-q1-demo.mjs` يعيد حساب البصمتين ويتحقق من العدد
  والهويات وتطابق كل نص ومعرف مصدره.

الحزمة الكاملة القابلة للتثبيت موثقة في
`docs/quran-q1-full-pack-2026-08-09.md`، وبياناتها الكبيرة محفوظة تحت
`B:\المكتبة\الخزانة\generated` خارج Git.

## التحقق

- اختبارات Q1/AudioCore المركزة: 7/7.
- اختبارات source-sync الكاملة الحالية: 334 ناجحة، واختبار اختياري واحد متجاوز،
  في 83 ملفًا (82 ناجحة وواحد متجاوز).
- build حزم core/server/cloudflare/node ناجح.

لا scraping لـHTML، ولا تجاوز حماية، ولا deploy، ولا app/OOXML.
