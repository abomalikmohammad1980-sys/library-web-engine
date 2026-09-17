# تدقيق أمان إدخال الصيغ المتعددة — 2026-08-08

## النطاق

بوابة core قبل أي parser أو تخزين للصيغ PDF وBOK وEPUB والنص. لا تشمل DOCX،
الذي يملك بوابته القائمة، ولا تشمل الرفع HTTP أو الواجهة أو النشر.

## القرارات

- `allow`: التوقيع والبنية الأولية والحدود سليمة، ولم تكتشف مؤشرات نشاط.
- `quarantine`: البنية مقبولة لكن توجد JavaScript/actions/embedded files في PDF،
  أو مؤشرات macro/extension/SQL attachment في BOK، أو script/form/remote reference
  في EPUB. لا يُنشر الملف قبل قرار مراجعة.
- `reject`: توقيع أو EOF أو ZIP فاسد، حد حجم/objects/streams/entries/expanded bytes
  أو compression ratio متجاوز، ZIP مشفر، path traversal/absolute path، EPUB ناقص،
  BOK بلا payload معروف، أو نص بترميز/NUL/حدود غير مقبولة.

## دفاع ZIP قبل الفك

تُقرأ central directory أولًا وبحدود مضبوطة، ويُحسب مجموع الأحجام الموسعة ونسبة
الضغط لكل entry، وتُرفض المسارات الصاعدة والمطلقة وأحرف backslash وdrive letters.
لا يُستدعى فك الضغط إلا بعد اجتياز هذه البوابة. هذه حماية intake bounded وليست
إثباتًا أن محتوى EPUB/BOK آمن للعرض؛ sanitization وparser sandbox معلمان لاحقان.

## الأدلة

- التنفيذ: `packages/source-sync/src/multi-format-intake.ts`.
- الاختبارات: `packages/source-sync/src/multi-format-intake.test.ts`، وتشمل
  allow/quarantine/reject للصيغ الأربع وzip-bomb/path traversal.
- أضيف fuzz حتمي ثابت البذرة لـPDF signatures/EOF، UTF BOM والترميز الفاسد،
  وEPUB/BOK EOCD/truncation/traversal/compression ratio عبر مئات الحالات المولدة.
- البوابة الكاملة: core 88/88، server 44/44، Cloudflare 50/50، Node 102/102؛
  المجموع 284/284 في 74 ملف اختبار.

## ما لم يُنفذ

لا parser وهمي، ولا extraction/f indexing، ولا upload endpoint، ولا deploy، ولا
تغيير app أو OOXML. السماح هنا يعني اجتياز preflight فقط.
