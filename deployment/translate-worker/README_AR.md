# نسخة الترجمة المطابقة لـCloudflare

المرجع هو العامل المنشور **khezana-translate-router، الإصدار 34** بتاريخ 2026-10-03. جُلب ملفه الأصلي من Cloudflare في 2026-10-16 الساعة 11:27 UTC وحُفظ في src/index.js دون تغيير بايت واحد. هذه خطوة مزامنة من Cloudflare إلى GitHub والجهاز.

- التقدم والترجمات موجودة في Cloudflare: نفس Durable Object وR2 وKV وAnalytics. لم تُنقل بيانات المستخدمين أو تُمسح أو تُعاد ترجمتها.
- تم التحقق من المتغيرات العادية الـ33 والربط الحالي وجدولة كل خمس دقائق. أسماء الأسرار فقط موثقة؛ قيمها غير موجودة في المستودع.
- ملف wrangler.toml يحتفظ بالموارد الحالية ويستخدم no_bundle لحفظ الملف المسترجع كما هو. سجل routes الكامل غير متاح للصلاحية الحالية؛ بقيت مسارات النطاق الموجودة، والخدمة العامة سبق التحقق منها.
- إضافات Hy-MT2 باقية على فرع task/hymt2-local-agent وفي طلب المراجعة #9؛ ليست جزءًا من هذه النسخة المطابقة. لا تشغّل الحزمة المحلية على هذه النسخة قبل دمج التفعيل المعتمد.

## التحقق المحلي

من جذر المشروع، باستخدام Node.js 24:

```powershell
node deployment/translate-worker/verify-baseline.mjs
node --check deployment/translate-worker/src/index.js
node --experimental-vm-modules --test deployment/translate-worker/test/worker.test.mjs
npx --yes wrangler@4.151.0 deploy --dry-run --config deployment/translate-worker/wrangler.toml --outdir "$env:TEMP/khzanah-baseline-build"
```

نجح 40 اختبارًا وتجهيز Wrangler محليًا. فحص البصمة يمنع إدخال تغيير غير موثق على المصدر أو إعداداته. عند تطوير العامل لاحقًا، حدّث توثيق المرجع صراحة بدل وصف نسخة معدلة بأنها مطابقة للإنتاج.

## حالة بقية المشروع

جُلبت ملفات التشغيل المنشورة للخدمات العشر وسُجلت بصماتها في deployment/cloudflare-baseline-inventory.json. هذا جرد لاستكمال المقارنة، وليس إثباتًا أن كود الموقع وبقية مصادره تطابق Cloudflare. قراءة مشروع Pages مرفوضة بالصلاحية الحالية (HTTP 403)، لذلك لم يُثبت بعد إصدار الموقع أو commit الذي بُني منه.

لم يُنفّذ نشر أو تعديل موارد أو أسرار. التوثيق القديم محفوظ في README.previous-v18.md للتاريخ فقط.
