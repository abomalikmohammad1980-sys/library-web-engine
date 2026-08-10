# Q15 — بوابة انجراف حزمة Cloudflare Pages

أضيف أمر `npm run release:verify` داخل `alpha-publish`. يشغل بعد كل `pages:prepare` و`release:candidate` وقبل أي preview أو production deploy، ولا ينشر شيئًا.

يتحقق الأمر من:

- كل path/size/SHA-256 في manifest المرشح، مع استثناء manifest المضمن كما ينص عقد الإنشاء.
- `current.json` مقابل payload والشجرة النهائية، و`previous.json` مقابل النسخة immutable وmanifest الخاص بها.
- حد 20,000 ملف و25 MiB للأصل الواحد.
- غياب symlink/special/path escape والمفاتيح الخاصة والتوكنات والمسارات المحلية في الملفات النصية.
- وجود SPA redirect ورؤوس الأمان/cache الأساسية وإصدار Service Worker، وعدم إدخال كتالوج المؤلفين الكبير في shell الإلزامي.
- تطابق جميع مصادر `library/published/manifest.json` بالحجم والبصمة، وأن كل مصدر Word له WordPageMap موجود.

الاختبار يثبت النجاح على candidate/previous متطابقين والفشل المغلق عند تغيير ملف واحد بعد توليد manifest.

نتيجة التشغيل الحي بعد دوران بناء آخر أثناء التدقيق:

- 294 ملفًا نهائيًا.
- candidate الحالي `bf3529ee437ddf469cbfc280b6d20ecde8d87ac7e0d2e6241bc820aa49e80d24`.
- previous الحالي `ed164bd952aa8c886145e51702dfdcbc344fcd4bbc14a31fb371786873710395`.
- 23 عملاً جاهزًا و6/6 خرائط Word.
- اختبارات البوابة: 2/2 ناجحة.
- بعد تدقيق المتطلبات أضيفت حماية pointer traversal ومطابقة current artifact/manifest؛ أصبحت اختبارات البوابة 3/3.
- بعد بروفة clean staging أزيل timestamp غير الحتمي من manifest (إلا مع `SOURCE_DATE_EPOCH`)؛ اختبارات Q15 المجمعة 5/5.

تسلسل CI/التشغيل المقترح:

1. بناء التطبيق الأخضر.
2. `npm run pages:prepare`.
3. `npm run release:snapshot-previous` قبل استبدال candidate الحالي عند الحاجة.
4. `npm run release:candidate`.
5. `npm run release:verify`.
6. توقيع Q13 والتحقق العام ثم Q14 CAS.
7. عند التفويض فقط: preview deploy وفحص حي.
