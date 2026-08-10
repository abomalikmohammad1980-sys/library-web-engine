# تدقيق دورة حياة موارد التطبيق — المرحلة 7.107

## النطاق

دُققت الموارد التي قد تعيش بعد مغادرة الشاشة أو إعادة فتح الكتاب: Object URLs، مستمعات window، Mutation/Intersection/Resize observers، المؤقتات وrequestAnimationFrame، FontFace، والـbackground artifact refresh.

## العيوب المثبتة والمغلقة

- كان `fitPageToWidth` ينشئ `ResizeObserver` لكل صفحة مركبة ولا يفصله عند مغادرة القارئ، كما كان يترك إطارَي رسم مؤجلين. صار تسجيل التنظيف جزءًا من `ResourceScope`: يفصل المراقب ويلغي كل rAF ويمنع callbacks المتأخرة.
- كان `registerDomFonts` يحمل ويضيف الوجوه المخدومة نفسها إلى `document.fonts` عند كل فتح. صار لكل مفتاح family/file/weight/style/base وعد واحد مشترك، ويحذف الإدخال فقط عند فشل التحميل كي تبقى إعادة المحاولة ممكنة.
- كانت مستمعات `library-changed` ومراقب المؤلفين ومستمعا online/offline وبعض اشتراكات install/connectivity تعتمد على hashchange أو لا تُنظف. صارت مملوكة لنطاق route واحد وتنتهي قبل تركيب التالي.
- حُميت نتائج `listBooks/listAuthorRecords` المتأخرة من تعديل DOM بعد dispose.

## موارد ثبتت سلامتها

- روابط الأغلفة Blob لها cache محدود 128 مع revoke عند الاستبدال/الإخلاء/pagehide، وروابط التنزيل تُسحب بعد بدء التنزيل.
- قارئ PDF ومراقبا صفحات القارئ ونافذة البحث كانت لها cleanups قائمة.
- إعادة بناء artifact الخلفية deduplicated بحسب book id وتزيل active job في finally؛ الخروج لا يحدّث DOM بعد dispose.
- مستمعات bootstrap الدائمة للموجّه وinstall/connectivity مفردة على مستوى التطبيق وليست موارد شاشة متكررة.

## التحقق ونقطة الاستئناف

- مركز: 16/16 في `phase7_resource_lifecycle.test.ts` و`engine/dom_render.test.ts`.
- التطبيق: 210/210 في 83 ملفًا. بناء الإنتاج ناجح، 163 وحدة.
- لا يبقى تسريب ثابت مثبت. الاختبار الخارجي التالي: heap profile في متصفح حقيقي عبر 20 دورة reader→library→reader ومقارنة observers/font faces/object URLs؛ لا يُدّعى قياس heap من Node.
