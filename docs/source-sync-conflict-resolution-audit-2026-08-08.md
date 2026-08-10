# تدقيق حسم تعارض مصدر Word — 2026-08-08

## النطاق

أُغلقت الفجوة التي كانت تترك `keepLocal|keepRemote|createCopy` كـintents بلا مسار
تنفيذ. لم ينفذ هذا العمل نشرًا أو migrations بعيدة، ولم يمس التطبيق أو OOXML.

## العقد والمسار

- يرسل `SourceSyncHttpClient.resolveConflict` طلبًا إلى
  `POST /books/:bookId/source-revisions/resolve-conflict`.
- تستخرج السلطة المالك من principal، تخفي كتب الحسابات الأخرى، وتفرض جهازًا
  مسجلًا نشطًا ومراجعة بحالة `conflicted` ونسخة publication متوقعة.
- العملية idempotent بـ`operationId`؛ إعادة العملية بالمعنى نفسه تعيد النتيجة،
  وإعادة المعرّف بقرار/مراجعة/نسخة مختلفة ترفض.

## الذرية والقرارات

- migration `0010_conflict_resolutions.sql` تضيف سجل القرارات وtrigger سابقًا
  للإدخال يتحقق من الملكية ونسخة publication وحالة المراجعة؛ فشل التحقق يلغي
  D1 batch كلها.
- `keepLocal`: يعتمد build الجاهز أو يضع المراجعة هدفًا ويصف build والمشتقات.
- `keepRemote`: يؤرشف المراجعة المتعارضة ويبقي المنشور النشط.
- `createCopy`: ينشئ كتابًا ومراجعة ومؤشر نشر وبناءً مستقلًا، مع مشاركة object
  immutable للمصدر بدل تكرار البايتات.
- يحفظ التدقيق معرفات تشغيلية ونتيجة فقط، بلا token أو رابط موقّع أو محتوى.

## readiness والقبول

- ترتيب migrations وبصماتها يغطي 0001–0010، والجدول الجديد ضمن required tables.
- الاختبارات المركزة تغطي العميل والسلطة والخيارات الثلاثة وreplay/IDOR/device/CAS
  وD1 batch والفشل المغلق ومسار Worker وmigration-integrity/readiness.
- البوابة الشاملة: core ‏77/77، server ‏41/41، Cloudflare ‏48/48، Node ‏100/100؛
  المجموع 266/266 في 67 ملفًا. بناء الحزم الأربع ناجح.

## المتبقي الخارجي

تطبيق migration 0010 على بيئة Cloudflare حقيقية، وربط الأسرار/bindings، ثم smoke
بهوية وجهازين حقيقيين. هذه بوابة provisioning/staging خارجية وليست فجوة كود داخلي.
