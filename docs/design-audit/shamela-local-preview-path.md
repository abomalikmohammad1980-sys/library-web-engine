# مسار معاينة كتب الشاملة محليًا: من المصدر إلى الموقع

> جرد قراءة فقط بتاريخ 2026-08-10. يصف ما يعمل في المستودع الآن، ويفصل بوضوح الحلقة المفقودة. لا يفترض أن قاعدة SQLite الرسمية هي ملف BOK، ولا يقترح تغيير امتدادها.

## النتيجة المختصرة

يوجد حاليًا مساران منفصلان غير موصولين:

1. **المسار الرسمي الجديد** يكتسب قواعد SQLite انتقائيًا من إصدار الشاملة `1448.2`، ويتحقق من ZIP64 وHTTP Range وCRC والحجم وSHA-256 وترويسة SQLite، ويحفظها داخل جذر المشروع. ينتهي هذا المسار عند ملفات `database/*.db` وmanifest اكتساب.
2. **مسار الموقع العامل** ينشر ويقرأ ملفات الشاملة القديمة من نوع **Microsoft Jet BOK** (`.bok`). ينسخها إلى `app/public/library/published/assets`، يعلنها في `manifest.json`، ثم يحللها المتصفح بـ`mdb-reader` ويخزن الكتاب المشتق في IndexedDB.

**لا توجد في `app` أو `tools` أو حزم source-sync أداة تحول قواعد SQLite الرسمية إلى حزم موقع.** لذلك لا يوجد اليوم أمر صادق متصل من `database/book/<bucket>/<bookId>.db` إلى ظهور الكتاب في الموقع. أداة `finalize-published-bok.mjs` ليست ذلك المحول: تقبل `.bok` بتوقيع Jet فقط، وترفض SQLite.

## الخريطة الفعلية الحالية

```text
الأرشيف الرسمي 1448.2 (ZIP64، 13.3 GB)
  │ HTTP Range: الدليل المركزي + القواعد المطلوبة فقط
  ▼
tools/acquire-shamela-databases.mjs
  ▼
packages/source-sync-node/src/shamela-database-acquirer.ts
  ▼
بيانات-المشروع/shamela/1448.2/selective/
  ├─ manifest.json
  ├─ database/master.db
  ├─ database/services.db وغيرها
  └─ database/book/<bucket>/<bookId>.db
  │
  ╳  الحلقة المفقودة: فحص schema → تحويل metadata/pages/toc → حزم موقع وفهرس
  │
  ▼
app/public/library/published/
  ├─ manifest.json
  └─ assets/<content-hash>.<portable-format>
  ▼
app/src/published_library_seed.ts
  ▼
IndexedDB عبر app/src/engine/library_store.ts
  ▼
#/library → #/book/<id> → #/reader/<id>
```

أما المسار العامل للكتب الخمسة المنشورة حاليًا بصيغة BOK فهو:

```text
ملف Jet .bok
  → tools/inspect-bok-jet.mjs
  → tools/finalize-published-bok.mjs
  → app/public/library/published/{manifest.json,assets/*.bok}
  → ensurePublishedLibrarySeeded()
  → dynamic import('./bok_import')
  → parseBok(): Main + b<BkId> + t<BkId>
  → StoredBook { extractedText, bokPages, bokToc }
  → screens/reader.ts
```

## 1. الاكتساب الرسمي الانتقائي

### الملفات المسؤولة

- `tools/acquire-shamela-databases.mjs`: مدخل التشغيل؛ يشتق جذر المشروع من موضع الأداة، ويمنع أي output خارج المشروع.
- `packages/source-sync/src/shamela-official-release.ts`: يثبت URL والحجم وETag وLast-Modified وعقد Range للإصدار `1448.2`.
- `packages/source-sync/src/shamela-sparse-zip.ts`: قراءة دليل ZIP64 واختيار قواعد البيانات دون فهارس Lucene.
- `packages/source-sync-node/src/shamela-database-acquirer.ts`: تنزيل كل entry، التحقق، الاستئناف، استعادة السابق، والـmanifest الذري.
- الاختبارات: `packages/source-sync/src/shamela-sparse-zip.test.ts` و`packages/source-sync-node/src/shamela-database-acquirer.test.ts` و`packages/source-sync/src/shamela-official-release.test.ts`.

### أمر محمول

يُشغل من **جذر المشروع الحالي**، ولا يحتوي مسار قرص ثابتًا:

```powershell
$ProjectRoot = (Resolve-Path .).Path
$EngineRoot = Join-Path $ProjectRoot 'source_code\تعديلات على المكتبة'
$AcquireRoot = Join-Path $ProjectRoot 'بيانات-المشروع\shamela\1448.2\selective'

Set-Location -LiteralPath $EngineRoot
pnpm --filter @library/source-sync build
pnpm --filter @library/source-sync-node build
node .\tools\acquire-shamela-databases.mjs $AcquireRoot
```

هذا الأمر يستأنف الاكتساب الموثق؛ لا ينزل الأرشيف الكامل ولا فهارس Lucene. لكنه في صورته الحالية يختار جميع قواعد البداية المقبولة، لا قائمة book IDs يمررها المشغل من CLI.

### تحقق الاكتساب

```powershell
$ManifestPath = Join-Path $AcquireRoot 'manifest.json'
$Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$Manifest | Select-Object schemaVersion, selectedEntryCount, completed, fingerprint
$Manifest.files | Select-Object -First 10 path, byteLength, sha256, zipCrc32
```

شروط النجاح:

- `schemaVersion = 1` و`completed = true`.
- `files.Count = selectedEntryCount`.
- كل ملف معلن موجود تحت `$AcquireRoot` فقط.
- أول 16 بايتًا لكل `.db` هي `SQLite format 3`؛ الأداة نفسها تتحقق من ذلك قبل commit.
- إعادة التشغيل لا تعيد تنزيل ملف صحيح؛ تتحقق من الحجم وSHA-256 أولًا.

وقت هذا الجرد لم يكن `بيانات-المشروع/shamela/1448.2/selective/manifest.json` موجودًا، لذلك لا يصح الادعاء بأن الاكتساب الرسمي اكتمل محليًا بعد.

## 2. الحلقة المفقودة: SQLite إلى حزمة موقع

لا توجد أداة تقرأ schema لـ`master.db` أو قواعد الكتب الرسمية، ولا استعلامات تحول الجداول إلى:

- بطاقة الكتاب والمؤلف والتصنيف والطبعة.
- صفحات بهوية `(bookId, part, page, source row)` ثابتة.
- فهرس الكتاب الهرمي ومراسيه.
- حزمة نص قابلة للتنزيل الجزئي بدل تحميل آلاف الكتب عند الإقلاع.
- shards فهرس البحث وعقد Worker.
- سجل provenance وبصمات للمدخلات والمخرجات.
- إدخالات `PublishedWork` ذرية في manifest.

والدليل السلبي المهم: البحث في `tools`, `packages/source-sync*`, و`app/src` لا يجد قارئًا لقاعدة الشاملة SQLite أو استعلامات لجدول صفحاتها؛ استخدام `node:sqlite` الموجود يخص بوابة staging لخدمة المزامنة، لا محتوى الشاملة.

### العقد الذي تحتاجه الأداة المفقودة

ينبغي أن تكون أداة build-time فقط، ومدخلها `$AcquireRoot` ومخرجها داخل المشروع. أقل مخرجات لازمة لكل كتاب:

1. `workId` مستقر مشتق من معرف الشاملة، لا من اسم الملف.
2. metadata من `master.db` مع provenance وبصمة المصدر.
3. صفحات وفهرس من قاعدة الكتاب، بأرقام الجزء/الصفحة الأصلية دون إعادة ترقيم.
4. artifact محتوى immutable باسم بصمة، مع byte length وSHA-256.
5. shards بحث منفصلة وmanifest لها؛ لا Lucene في المتصفح.
6. إدخال manifest بحالة `ready` لا يُنشر إلا بعد تحقق schema وعدد الصفحات والفهرس.
7. كتابة ذرية ومخرجات قابلة للاستئناف، وعدم تحميل corpus كله في الذاكرة.

حتى بناء هذه الحلقة، لا يجوز إدراج `.db` في manifest كـ`shamela-bok`، ولا إعادة تسميته `.bok`: `parseBok` يشترط توقيع `Standard Jet DB` عند البايتات 4–18، بينما المكتسب الرسمي SQLite.

## 3. مسار BOK القديم العامل الآن

### الفحص البنيوي

`tools/inspect-bok-jet.mjs` يفتح كل `.bok` في مجلد، ويتحقق من:

- توقيع/قدرة `mdb-reader` على القراءة.
- جدول `Main`.
- `BkId` وجدول الجسم `b<BkId>`.
- جدول الفهرس الاختياري `t<BkId>`.
- الجداول غير المتوقعة، بعلامة `review` بدل السماح الصامت.

أمر محمول لعينة داخل المشروع:

```powershell
$BokInput = Join-Path $ProjectRoot 'كتب للاختبار'
$Inspection = Join-Path $ProjectRoot 'بيانات-المشروع\shamela\bok-inspection.json'
node .\tools\inspect-bok-jet.mjs $BokInput $Inspection
```

### التثبيت في published

`tools/finalize-published-bok.mjs`:

- لا ينشئ عملًا جديدًا؛ يبحث عن عمل موجود في manifest يطابق **العنوان والمؤلف المستخرجين من اسم الملف** بالشكل `العنوان - المؤلف.bok`.
- يتحقق من توقيع Jet.
- ينسخ الملف إلى `assets/<sha256-prefix>.bok`.
- يضبط المصدر `shamela-bok` والحالة `ready` والحكم الأمني.
- يعيد حساب `readyCount`، لكنه يضع `datasetVersion` ثابتًا قديمًا؛ لذلك لا يُعد pipeline عامًا صالحًا لقواعد 1448.2.

صيغة الأمر:

```powershell
$PublishedRoot = Join-Path $EngineRoot 'app\public\library\published'
node .\tools\finalize-published-bok.mjs $BokInput $PublishedRoot 'عنوان الكتاب - المؤلف.bok'
```

هذا الأمر موثق لفهم المسار فقط؛ تشغيله يغيّر الأصول المنشورة وmanifest، ولا ينبغي استعماله على SQLite الرسمية أو دون مراجعة work المستهدف.

### الكتب BOK المنشورة الموجودة

manifest الحالي يعلن خمسة كتب BOK، كلها لأبي الحسن الندوي: `الإسلام والحكم`، `الأمة الإسلامية، وحدتها ووسطيتها وآفاق المستقبل`، `السيرة النبوية`، `ردة ولا أبا بكر لها`، و`ماذا خسر العالم بانحطاط المسلمين`.

## 4. كيف تظهر الحزمة في التطبيق

### الإقلاع والغرس

- `app/src/main.ts` يستدعي `ensurePublishedLibrarySeeded()` بلا انتظار بعد أول render.
- `app/src/published_library_seed.ts` يجلب `./library/published/manifest.json` مع `no-cache`.
- لا يقبل إلا عملًا `ready` وحكمه `allow` وبنية مصادر مدعومة.
- يجلب البايتات من نفس الأصل، ويتحقق من الحجم وSHA-256.
- لمسار `shamela-bok` يستورد `bok_import.ts` ديناميكيًا، يحلل الكتاب، ثم يستدعي `restoreArchivedBook()` لحفظه ككتاب `managedSource='published'` في IndexedDB.
- عند تغير البصمة أو نقص البايتات/metadata يعيد الغرس؛ وعند النجاح يطلق `library-changed`.

### التحليل والعرض

- `app/src/bok_import.ts`: يقرأ `Main`, `b<BkId>`, `t<BkId>`؛ يفك windows-1256 عند الحاجة؛ يستخرج Betaka والصفحات والفهرس والنص.
- `app/src/engine/library_store.ts`: يحفظ الأصل والحقول المشتقة و`bokTextVersion`.
- `app/src/screens/library.ts`: يعرض بطاقة الكتاب من IndexedDB.
- `app/src/screens/book.ts`: يعرض صفحة الكتاب ويوجه للقارئ.
- `app/src/screens/reader.ts`: يبني صفحة DOM لكل صفحة BOK، يحفظ الجزء/الصفحة، يفصل الحواشي، ويربط الفهرس بمراسي العناوين.
- `app/src/router.ts`: المسارات المحلية `#/library`, `#/book/<id>`, `#/reader/<id>`.

## 5. أمر المعاينة المحلية العامل الآن

هذا يعرض **الحزم الموجودة أصلًا في `app/public/library/published`**؛ لا يحول SQLite:

```powershell
$ProjectRoot = (Resolve-Path .).Path
$EngineRoot = Join-Path $ProjectRoot 'source_code\تعديلات على المكتبة'
Set-Location -LiteralPath $EngineRoot

pnpm --filter @library/app build
pnpm --filter @library/app dev -- --host 127.0.0.1
```

ثم افتح محليًا:

- `http://127.0.0.1:5173/#/library`
- أو مباشرة كتاب BOK معروف: `http://127.0.0.1:5173/#/book/alpha-78eec595075a0585`
- القارئ: `http://127.0.0.1:5173/#/reader/alpha-78eec595075a0585`

إذا كان المنفذ 5173 مشغولًا، يطبع Vite المنفذ الفعلي؛ استخدم العنوان الذي يطبعه بدل افتراض المنفذ.

## 6. تحقق المعاينة

### تحقق الملفات قبل التشغيل

لكل `PublishedSource` مطلوب:

- `path` نسبي وآمن وتحت `app/public`.
- الملف موجود وحجمه يساوي `bytes`.
- SHA-256 يساوي `sha256`.
- BOK يحمل توقيع Jet وامتداد `.bok`.
- `work.status = ready` و`security.verdict = allow`.

توجد أداة `tools/verify-published-library-release.mjs` لهذا الغرض، لكن **بوابتها الحالية قديمة**: تتوقع 23 عملًا ثابتًا بينما manifest الحالي يعلن 27. لا تعتمد نتيجتها حتى تحديث العقد المتصل بعدد manifest بدل الرقم الثابت. يمكن تشغيل اختبارات BOK المركزة دون تغيير البيانات:

```powershell
pnpm --filter @library/app exec vitest run --root .. app/src/bok_import.test.ts app/src/bok_reader_end_to_end_contract.test.ts app/src/published_library_seed.test.ts app/src/reader_toc_filter.test.ts
```

### تحقق الواجهة

1. حمّل `#/library` وانتظر حدث الغرس؛ يجب أن تظهر بطاقة الكتاب المنشور دون اختيار ملف يدوي.
2. افتح `#/book/<id>` وتحقق من العنوان والمؤلف والناشر/الطبعة إن وجدا.
3. افتح `#/reader/<id>`؛ يجب أن تظهر الصفحات بأرقام الجزء/الصفحة لا بتقسيم 18 فقرة العام.
4. افتح الفهرس وانقر عنوانًا؛ يجب أن يصل إلى مرساة العنوان داخل الصفحة.
5. تحقق من صفحة بها حاشية ومن عرض 390px.
6. أعد التحميل: يجب أن يستخدم الكتاب المخزن في IndexedDB، وألا يتضاعف السجل.
7. غيّر بصمة source تجريبيًا فقط في fixture اختبار، لا manifest الحقيقي؛ يجب أن يثبت `publishedBookNeedsRefresh` إعادة الغرس.

### مؤشرات فشل واضحة

- بطاقة موجودة بلا صفحات: غالبًا انقطع الغرس أو فشل parser؛ `publishedBookNeedsRefresh` يفحص طول الأصل لكنه لا يثبت وحده سلامة كل الصفحات.
- `published_work_not_installable`: الحالة/الحكم/تركيب المصادر غير مقبول.
- `published_source_size_mismatch` أو `published_source_checksum_mismatch`: asset لا يطابق manifest.
- رسالة «الملف ليس قاعدة BOK من Microsoft Jet»: تم تمرير SQLite أو ملف غير BOK للمحلل القديم.
- غياب الكتاب بعد الإقلاع: راجع Network لطلب manifest وasset، ثم IndexedDB؛ أخطاء الغرس تُحصى في `failed` لكن bootstrap الحالي لا يعرضها في الواجهة.

## 7. أقصر طريق لإغلاق الفجوة

1. افحص schemas لعينة ذهبية من `master.db` وخمس إلى عشر قواعد كتب متنوعة بأداة قراءة فقط.
2. ثبّت mapping موثقًا للبطاقة والمؤلف والتصنيف والصفحات والفهرس، مع حالات null وتغير schema.
3. أنشئ محول build-time SQLite → artifact محمول جديد؛ لا توسع اسم `shamela-bok` ليعني SQLite.
4. أضف format صريحًا إلى `PublishedSource` وقارئًا lazy في `materializePublishedWork`، أو حوّل وقت البناء إلى صيغة نص/حزمة معرفة بعقد ثابت.
5. ولّد manifest تجريبيًا في staging داخل المشروع، وتحقق من البصمات وعدد الصفحات والفهرس.
6. اربط shards البحث بعقد Worker، ثم جرّب كتابًا واحدًا عبر `#/library` و`#/reader/<id>`.
7. بعد نجاح العينة، وسّع التحويل باستئناف وكتابة ذرية؛ لا تغرس 8,593 كتابًا كاملًا عند إقلاع التطبيق، بل كتالوجًا خفيفًا وحزمًا عند الطلب.

## الحكم النهائي

- **الاكتساب الرسمي إلى SQLite:** منفذ وقابل للتشغيل، ولم يكن قد اكتمل محليًا وقت الجرد.
- **SQLite إلى حزم الموقع:** غير منفذ؛ هذه هي الفجوة المانعة.
- **BOK/Jet إلى published ثم العرض المحلي:** منفذ ويعمل على corpus حقيقي.
- **المعاينة المحلية للحزم الموجودة:** متاحة بأمر Vite أعلاه.
- **معاينة كتاب من SQLite الرسمية اليوم:** غير ممكنة بأدوات المستودع الحالية دون بناء المحول المفقود.
