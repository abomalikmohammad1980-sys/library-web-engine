# تركيب WordPageMap في مسار البناء — 2026-08-08

## ما أُغلق

- backend build-service يعيد DOCX بعد `revision:read` service auth، ومعه
  `editionId/format/sha256` من `source_editions` أو fallback legacy مطابق.
- عميل Node داخلي يرسل DOCX إلى `/v1/word-page-map` بـBearer service token،
  ويفرض timeout وحد الاستجابة ويتحقق من schema/engine وبصمة الجزء والخريطة.
- runtime يطلب `wordPageMapEndpoint` و`maxWordPageMapBytes` صراحة؛ لا endpoint أو
  token افتراضي. `remote-check` يفحص HEAD مصادقًا إضافة إلى PDF/build readiness.
- builder يرفض اختلاف بايتات DOCX عن SHA نسخة المصدر، ويضع الخريطة الموثقة داخل
  reader JSON. ويحمل reader artifact في الـmanifest هوية source edition وبصمتها
  وengine/fingerprint/totalPages للخريطة.
- النشر يبقى ذريًا: فشل خدمة الخريطة يجعل reader job retryable ولا يكتمل manifest؛
  active build السابق لا يتبدل. عند عودة الخدمة تنجح الإعادة وينشر البناء الكامل.

## دليل التكامل

`word-page-map-pipeline.integration.test.ts` يشغل خدمة HTTP حقيقية على loopback
ومجلدات مؤقتة: HEAD ناجح، المحاولة الأولى تفشل 502، فيبقى `prior` منشورًا، والثانية
تنتج خريطة صفحتين وتربط edition DOCX وتكتب reader immutable ثم تنشر `build`.
ويثبت خلو مجلد الخدمة المؤقت بعد المحاولتين.

اختبار build-service يثبت أن user bearer لا يكفي وأن service secret وحده يعيد
البايتات مع provenance headers. اختبار CLI يثبت HEAD المصادق في `remote-check`.

## الحدود الخارجية

لا deploy ولا سر حقيقي ولا Microsoft Word COM في البوابة الجامعة. اختبار corpus
COM يبقى opt-in على Windows/Word؛ نتيجة الجولة 296 اختبارًا ناجحًا وواحد اختياري
متجاوز، في 78 ملفًا ناجحًا، وبناء الحزم الأربع أخضر.
