# تدقيق أعطال شبكة مزامنة مصدر Word — 2026-08-08

هذا تدقيق محلي حتمي، ولا يثبت نشر Cloudflare أو تشغيل خدمة PDF خارجية. الهدف هو
إثبات أن انقطاع الشبكة لا يحول عملية ناقصة إلى نجاح، ولا يستبدل النسخة المنشورة
ببناء جزئي، وأن إعادة المحاولة مملوكة للـoutbox/build job لا لطلب HTTP خفي.

## مصفوفة القرار

| العطل | قرار رفع المصدر | قرار البناء | الثابت المثبت |
|---|---|---|---|
| 408 | retryable | retryable | لا نجاح زائف ولا finalize بعد PUT فاشل |
| 409 | blocked/permanent | permanent | لا تحويل للتعارض إلى نجاح |
| 429 + Retry-After | retryable بتأخير محدود | retryable بتأخير محدود | التأخير لا يتجاوز `retryMaxMs` |
| 500/503 | retryable | retryable | النسخة النشطة القديمة تبقى كما هي |
| timeout | transport retryable | retryable | `AbortSignal.timeout` يلغي الطلب المعلق |
| connection drop | transport retryable | retryable | لا تسريب نص الخطأ/العنوان إلى الحالة |
| partial PUT | retryable | retryable | لا يستدعى finalize ولا publish |
| ضياع رد finalize بعد التزامه | prepare التالي يعيد `complete` | — | لا يعاد رفع bytes الناجحة ولا finalize ثانية |
| ETag 304 | — | fresh cache | لا يستبدل manifest المخزن ولا يقرأ body وهميًا |
| مشتق واحد ناقص/دائم | — | retry/failed | لا يبدل active publication قبل الخمسة |

## إصلاحات مثبتة

- أصبح `DurableBuildWorker` يحترم عقد الخطأ البنيوي `code/retryable/retryAfterMs`.
  قبل الإصلاح كان `PdfServiceBuildError(retryable=false)` يعاد تلقائيًا ما لم يكن
  من صنف `PermanentBuildError` نفسه.
- أضيف `Retry-After` لخدمة PDF وعميل build، مع قبول seconds أو HTTP-date وسقف
  `maxRetryMs` في العامل.
- صار `RemoteBuildPorts` يعيد `RemoteBuildError` مصنفًا بدل `Error` عام، ولا ينفذ
  أي retry داخلي للطلبات المتغيرة.
- صار `provision-check/remote-check` bounded بمهلة الإعداد، ويعيد exit 5 عند timeout
  أو drop، ولا يكرر الطلب ولا يطبع exception غير موثوق.
- صار اختبار سلامة migrations مستقلًا عن current working directory؛ يقرأ 0001–0009
  نسبة إلى ملف الحزمة نفسه.

## الدليل الآلي

- الاختبارات المركزة: 26/26، وتشمل API/outbox/build/ETag/CLI.
- بوابة الحزم الأربع: 62 ملف اختبار، 239/239 اختبارًا ناجحًا.
- TypeScript build ناجح لـ`source-sync`, `source-sync-server`,
  `source-sync-cloudflare`, `source-sync-node`.
- لا شبكة خارجية، ولا provisioning، ولا migration remote، ولا deploy.

## نقطة الاستئناف الخارجية

بعد تجهيز staging فقط: طبق runbook، ثم أعد المصفوفة عبر proxy أعطال على endpoint
المنشور، وسجل deployment id وD1/R2 bindings وخدمة PDF. أي نشر قبل ذلك لا يستند
إلى هذا التدقيق المحلي وحده.
