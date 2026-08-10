# Khizana Print Aligner

أداة مستقلة لمحاذاة تفريغ DOCX مع صفحات أصل مطبوع PDF. تعمل محليًا افتراضيًا ولا
ترسل الكتب إلى شبكة أو API مدفوع. تستعمل طبقة نص PDF، ثم تترك الصفحات المصورة
معلّمة لـOCR محلي اختياري أو للمراجعة البشرية.

## التدقيق المعماري

- `@engine/ooxml-model` هو قارئ الفقرات الدلالي المعاد استعماله، وPoppler يستخرج
  طبقة PDF النصية (مع fallback محلي إلى Python/pdfplumber)؛ لا يوجد اعتماد على `app/`.
- يمكن تمرير خريطة WordPageMap الحالية كمرساة اختيارية بـ`--word-page-map`.
- خط الأنابيب: fingerprint → استخراج PDF/DOCX → تطبيع عربي → محاذاة رتيبة → تقرير
  وواجهة مراجعة → اعتماد صريح → نسخة DOCX جديدة.
- لا يعاد بناء DOCX. عند التطبيق يتغير `word/document.xml` فقط، وبأصغر إضافة
  `w:pageBreakBefore`; بقية أجزاء OOXML تمر دون تفسير أو تعديل.

## التشغيل

```powershell
pnpm --filter @library/print-aligner build
node packages/print-aligner/dist/cli.js analyze --pdf original.pdf --docx transcript.docx --out review-output
```

افتح `review-output/review.html`، راجع الحالات البرتقالية جنبًا إلى جنب، ثم نزّل
`approvals.json`. لإنشاء نسخة جديدة:

```powershell
node packages/print-aligner/dist/cli.js apply --docx transcript.docx --report review-output/alignment-report.json --approvals approvals.json --output aligned-copy.docx
```

لا يسمح أمر التطبيق ببقاء حالة غامضة بلا قرار، ويتحقق من fingerprint التقرير وDOCX.

## OCR والكلفة

المسار الأساسي مجاني ومحلي. OCR ليس ضروريًا للصفحات ذات الطبقة النصية. للصفحات
المصورة يوصى بـTesseract محلي مع `ara` و`eng` وعلى الصفحات المحتاجة فقط؛ وهذا يقلل
وقت المعالجة والكلفة إلى كلفة الجهاز. OCR العربي يخطئ خصوصًا في التشكيل، الهوامش،
الأختام، الخطوط القديمة، والصفحات المائلة، لذلك لا يرفع تلقائيًا إلى حالة اعتماد.

## الحدود والقياس

- الكتب ذات عمودين أو هوامش تعليق قد تعيد طبقة PDF بترتيب قراءة غير صحيح.
- رؤوس الصفحات وأرقامها قد تخفض التشابه؛ المحاذاة تستعمل بداية الصفحة ونهاية السابقة.
- الجداول والصور والحواشي محفوظة بنيويًا، لكن بداية صفحة داخل صف جدول ليست هدفًا آمنًا
  في MVP وتحتاج قرارًا بشريًا.
- التقرير يعرض `measuredCoverage` و`meanConfidence`. لا تدّعي الأداة تطابقًا كاملًا؛
  يلزم corpus أكبر وقياس precision/recall على حدود صفحات معتمدة يدويًا.

## Corpus الآمن

الاختبارات المضمّنة نصوص صناعية قصيرة فقط، بلا كتب أو بيانات شخصية. ويمكن تشغيل
عينة محلية خارج الحزمة دون نسخها إلى المستودع.
