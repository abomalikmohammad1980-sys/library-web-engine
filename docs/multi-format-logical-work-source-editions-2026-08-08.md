# عقد العمل المنطقي ونسخ المصدر متعددة الصيغ — 2026-08-08

## القرار الحاكم

تفصل المنظومة بين **العمل المنطقي** (الكتاب بوصفه هوية وفهرسة وبيانات) وبين
**نسخة المصدر** immutable. الصيغ الأولى: DOCX وPDF وBOK وEPUB والنص الصريح.
لا تعني إضافة الصيغ تحويل PDF أو EPUB إلى Word، ولا تجعل المشتق مصدرًا تلقائيًا.

- إذا كان للعمل مصدر Word حي، يبقى `word-live` سلطة المحتوى والتنسيق؛ كل حفظ
  ينشئ edition/revision DOCX جديدة ولا يجوز لرفع PDF/BOK/EPUB/text تبديل السلطة.
- يمكن لعمل لم يملك Word أصلًا أن يبدأ بسلطة `immutable-edition` من صيغة أخرى.
  تبديل صيغة السلطة لاحقًا يحتاج workflow ترحيل صريحًا، لا last-write-wins.
- alternate/derived editions لا تغير authority. كل object key يتضمن SHA-256،
  ولا overwrite أو حذف بسبب إرفاق نسخة أخرى.
- PDF المصدر وPDF المشتق كيانان مختلفان: الأول edition محفوظة، والثاني artifact
  قابل لإعادة البناء من السلطة الحالية.

العقد المنفذ في `packages/source-sync/src/source-editions.ts`: `LogicalWork`,
`ImmutableSourceEdition`, `WorkSourceAuthority`, capability matrix وCAS attachment.

## القدرات وحدود الأمان

كل الصيغ غير موثوقة، وحد الحجم إلزامي للجميع، ولا يسمح active content أو external
references في intake الافتراضي.

| الصيغة | القدرة | الحدود الإلزامية قبل parser الإنتاجي |
|---|---|---|
| DOCX | مصدر Word حي، نص/بنية/تنسيق | حدود ZIP entries/expanded bytes/ratio؛ OPC/content-types؛ رفض traversal/XXE/macros/ActiveX/OLE والسياسة الصريحة للعلاقات والتوقيع. |
| PDF | مصدر immutable؛ النص قد يكون غائبًا/صورة | حد bytes/pages/objects/stream expansion؛ رفض JavaScript/Launch/embedded files/external actions؛ parser sandbox ووقت/ذاكرة/OCR budget منفصل. |
| BOK | مصدر immutable من قاعدة/حاوية الشاملة | فحص signature قبل اختيار adapter؛ لا تنفيذ SQL/extension/macro؛ حدود tables/rows/text/image/blob؛ parser sandbox وترميز عربي صريح. لا يفترض العقد SQLite. |
| EPUB | مصدر immutable ببنية قابلة للاستخراج | ZIP limits وmimetype/container/OPF؛ منع traversal وscripts/forms/remote URLs؛ sanitize XHTML/SVG/CSS وحد DOM/resources. |
| text | مصدر immutable بسيط | UTF-8/UTF-16 BOM policy، حد code points/line length، رفض NUL/encoding invalid؛ حفظ Unicode/bidi كما هو والعرض الآمن بلا HTML interpretation. |

`SourceFormatSecurityLimits` يفرض الحدود المشتركة وحدود archive/text. ونُفذت الآن
بوابة intake مستقلة في core للصيغ PDF وBOK وEPUB وtext: تتحقق من signature والحجم،
وتفحص ZIP central directory قبل فك EPUB/BOK (عدد الملفات، الحجم الموسع، نسبة الضغط،
التشفير، والمسارات المطلقة/الصاعدة)، ثم تعيد قرارًا ثابتًا `allow` أو `quarantine`
أو `reject`. المحتوى النشط والمراجع الخارجية يُحجران؛ فساد البنية أو تجاوز الحدود
يُرفضان. لا تُعد هذه البوابة parser للصيغة، ولا تفسر محتواها أو تنشره.

حدود parser التفصيلية تضاف في adapter كل صيغة قبل تمكين ingestion؛ capability
matrix لا توحي بوجود parser إنتاجي لم ينفذ.

## migration 0011 من نموذج Word الحالي

نُفذت schema/backfill محليًا ولم تُطبق على بيئة بعيدة. المسار forward-only:

1. تضيف 0011 `logical_works` و`source_editions` و`source_edition_operations`
   وtrigger CAS، دون حذف جداول revision الحالية.
2. backfill لكل كتاب حالي work بنفس معرف الكتاب، ولكل `book_source_revision`
   edition بصيغة DOCX تشير إلى object immutable نفسه؛ لا نسخ bytes ولا تغيير URL.
3. authority للكتاب ذي active revision تصبح `word-live` وتشير إلى edition المقابلة؛
   conflicted/archived revisions تبقى editions غير نشطة وسجل القرار محفوظ.
4. نفذ dual-read validation: counts، owner، active pointer، SHA-256/byte length،
   rollback targets، builds/artifacts. أي mismatch هو no-go.
5. فعّل القراءة من النموذج الجديد feature-gated مع بقاء الكتابة Word على المسار
   الحالي، ثم ابدأ dual-write idempotent بعد اختبار replay/CAS.
6. أضف ingestion لكل صيغة في migration/adapter مستقل بعد اكتمال validator الخاص
   بها؛ لا تستخدم validator عام يقبل `application/octet-stream` وحده.
7. rollback تشغيلي يعيد feature flag والقراءة القديمة؛ schema/objects لا تعكس ولا
   تحذف. إزالة الأعمدة القديمة معلم لاحق بعد backup ومدة استقرار.

## بوابة القبول الحالية وما لم يُنفذ

اختبارات core تثبت الصيغ الخمس، عدم اعتبار PDF نصًا منظمًا، حماية Word authority،
authority غير Word لعمل جديد، alternates بلا تبديل، CAS، content-addressed keys،
media-type matching وحدود archive/text والأمان المشترك. كما تثبت بوابة intake:
PDF سليم/نشط/مقطوع، BOK قاعدة أو أرشيفًا مع حجز النشاط، EPUB أدنى صالح مع حجز
scripts/remote URLs ورفض zip-bomb/path traversal، والنص UTF-8/UTF-16 مع رفض
الترميز الفاسد وNUL وتجاوز طول النص أو السطر.

نُفذت migration/persistence authority داخليًا واختُبر backfill على SQLite in-memory؛
لم تنفذ parsers أو upload HTTP endpoints للصيغ الجديدة، ولم يمس app أو OOXML ولم
يحدث deploy. تلك مراحل لاحقة لا يجوز للواجهة ادعاؤها.

## أثر مشتق مشترك: وسم الآيات

أضيف `quran-annotations` كأثر اختياري صالح لكل نسخ المصدر، مربوط بالمراجعة
وبـ`corpusVersion/corpusChecksum` وثقة `exact` فقط. يحمل نطاقات المصدر ومراجع
السور والآيات ولا يضم corpus. تغير المصدر أو corpus يبطل replay ويطلب إعادة
البناء. وإذا فهرسه أثر search وجب أن يعتمد artifact نفسه داخل manifest الذري.
التفصيل في `docs/source-sync-quran-annotations-contract-2026-08-08.md`.
