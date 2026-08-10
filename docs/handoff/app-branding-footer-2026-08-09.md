# تسليم جاهزية هوية الخِزانة والتذييل

## الحالة

- الشعار الملون هو الأصل الافتراضي، والأسود للطباعة وforced-colors.
- المواضع المغطاة: header، welcome/splash، install، about، الأغلفة المولدة ومعايناتها، QuoteCard، print، favicon، Apple touch، PWA any/maskable، وoffline shell.
- التذييل موجود في `appFrame` فقط؛ القارئ بجميع صيغه لا يركبه.
- لا يوجد نشر خارجي في هذه الدفعة.

## بوابة التسليم

- اختبارات الهوية والتذييل وPWA والمشاركة: 5 ملفات ناجحة.
- بوابة التطبيق الكاملة الأحدث: 122 ملفًا بلا فشل.
- بناء Vite: ناجح.

## تحسين التحميل العام

- القارئ محمل كسولًا؛ الحزمة الأولية 396,027 بايتًا بدل 491,191.
- route race محمي، وحالة التحميل/الفشل قابلة للوصول.

## أصول النشر

- `app/public/brand-logo-color.png`
- `app/public/brand-logo-mono.png`
- `app/public/favicon-64.png`
- `app/public/icons/apple-touch-icon.png`
- `app/public/icons/icon-{192,512}.png`
- `app/public/icons/icon-maskable-{192,512}.png`

## حالة Alpha المحلية

- تمت مزامنة `app/dist` الأخضر إلى `alpha-publish/public/khizana` بمسار النسخ الرسمي.
- الحزمة نظيفة: 247 ملفًا، بلا كتب أو صيغ مصادر، وبلا مجلد `books`؛ تضم فقط كتالوجي المؤلفين العامين.
- أصول favicon وPWA والشعار الرسمي موجودة في ناتج Alpha.
- لم يحدث push أو إنشاء version أو deploy، تنفيذًا لأمر إيقاف النشر الخارجي.
- تعذّر تشغيل أمر Vinext النهائي بسبب عطل مشغّل العمليات في Windows (`CreateProcessAsUserW 1920`)؛ لا يُدعى بناء Alpha الخادمي الأخضر حتى ينجح الأمر أدناه.

نقطة الاستئناف الدقيقة: شغّل `npm test` داخل `alpha-publish` بعد عودة مشغّل العمليات، ثم افحص 360px وforced-colors؛ وأبقِ النشر متوقفًا حتى يرد تفويض صريح جديد.
