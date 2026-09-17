# عقد محول SQLite الرسمي للشاملة إلى حزم الموقع

> وثيقة تصميم فقط، مبنية على عقود الاكتساب و`PublishedLibraryManifest` والتخزين والبحث الحالية. لا تفترض اسم جدول أو عمود قبل فحص العينة، ولا تعدّل `SPEC.md` المجمد. الإصدار المقترح للعقد: `shamela-sqlite-converter/1`.

## 1. الغاية وحدود المسؤولية

المحول أداة **build-time محلية** تقرأ مخرجات الاكتساب الرسمي الموثقة، تكتشف schema الفعلي، ثم تنتج:

- كتالوجًا خفيفًا للكتب والمؤلفين والتصنيفات.
- حزمة immutable مستقلة لكل كتاب تحوي النص الأصلي والصفحات والفهرس والبطاقة.
- shards بحث مشتقة من الحزم، لا من Lucene وقت التشغيل.
- manifests ذات بصمات وأعداد وprovenance قابلة للتدقيق والاستئناف.
- staging release لا يصبح مرئيًا للتطبيق إلا بعد اجتياز البوابات كاملة ثم commit ذري.

لا يملك المحول:

- تنزيل الأرشيف؛ ذلك مسؤولية `acquireShamelaDatabases`.
- تخمين schema أو معنى عمود من اسمه وحده.
- تنقيح النص أو تطبيعه أو حذف markup أثناء حفظ الأصل.
- نشر خارجي أو رفع موارد.
- تحميل آلاف الكتب قسرًا في IndexedDB عند إقلاع التطبيق.
- تشغيل فهارس Lucene الرسمية داخل المتصفح.

## 2. مبدأ «الاكتشاف قبل التفسير»

لا يبدأ استخراج كتاب قبل إنتاج **Schema Observation** من عينة ذهبية. كل قاعدة تُفحص بقراءة SQLite metadata وخصائص الجداول والأعمدة والمفاتيح والفهارس والصفوف العيّنية دون افتراض أسماء.

يمر دعم أي schema بأربع حالات:

1. `observed`: جرد بنيوي فقط؛ لا تحويل.
2. `mapped-review`: mapping مرشح موثق بأدلة العينة، لكنه غير مسموح للنشر.
3. `mapped-approved`: mapping صريح لإصدار schema fingerprint محدد، مع fixtures واختبارات.
4. `unsupported`: يفشل مغلقًا ويظهر في تقرير التغطية؛ لا يُسقط الكتاب صامتًا.

أي اختلاف في schema fingerprint عن mapping المعتمد يعيد القاعدة إلى `observed`، حتى لو تشابهت أسماء الجداول.

## 3. المدخلات

### 3.1 جذر الاكتساب

مدخل إلزامي `acquisitionRoot`، ويجب أن يكون داخل جذر المشروع. يحتوي:

- `manifest.json` من `ShamelaAcquisitionManifest` بإصدار 1.
- قواعد SQLite المشار إليها حصراً في `manifest.files`.
- `database/master.db` وقواعد خدمة إن كانت ضمن الإصدار.
- `database/book/<bucket>/<bookId>.db` أو أي مسار كتاب مقبول يعلنه manifest؛ لا يُعاد اكتشاف الملفات بتجوال غير مقيد.

بوابة المدخل:

- `completed = true` في تحويل release كامل؛ ويمكن `completed = false` فقط لوضع `--sample`, مع تسجيل ذلك ومنع إنتاج release قابل للنشر.
- fingerprint الـmanifest يعاد حسابه ويطابق.
- كل ملف: مسار نسبي آمن، ملف عادي غير symlink، الحجم وSHA-256 يطابقان، وترويسة SQLite صحيحة.
- source release (sourceId/version/URL/content length/ETag/Last-Modified) يطابق عقد الإصدار المقبول.

### 3.2 سجل mappings

مدخل versioned داخل الكود، لا ملفًا حرًا يولده المشغل. لكل schema fingerprint:

- دور القاعدة: catalog/book/service.
- تعريف استعلامات القراءة المسموحة ومعاني الحقول.
- مفاتيح ترتيب ثابتة ومفاتيح هوية الصفوف.
- تحويل الأنواع فقط؛ لا قواعد تنظيف تفقد الأصل.
- شروط null/duplicate/orphan المسموح بها أو المانعة.
- مرجع تقرير العينة التي أثبتت mapping وتوقيعه/مراجعه.

إذا لم يوجد mapping مطابق، يخرج المحول تقرير اكتشاف فقط ويتوقف قبل استخراج المحتوى.

### 3.3 خيارات التشغيل

```ts
interface ShamelaSqliteConvertOptionsV1 {
  projectRoot: string
  acquisitionRoot: string
  stagingRoot: string
  releaseId: string
  mode: 'sample' | 'full'
  selectedBookIds?: string[]
  maxConcurrentBooks: number
  maxRowsPerTransaction: number
  resume: boolean
}
```

- كل الجذور تُحل وتُثبت داخل `projectRoot`.
- `selectedBookIds` لا يغير هوية المخرجات؛ هو قيد تشغيل فقط.
- الحدود أعداد موجبة ومحدودة، ولا يوجد truncation صامت إذا تجاوز كتاب حدًا؛ يفشل الكتاب بسبب صريح.

## 4. Schema Observation بلا افتراض أسماء

لكل قاعدة ينتج ملف observation immutable يشمل:

```ts
interface SqliteSchemaObservationV1 {
  schemaVersion: 1
  sourcePath: string
  sourceSha256: string
  sqliteUserVersion: number
  sqliteApplicationId: number
  integrityCheck: 'ok'
  objects: Array<{
    type: 'table' | 'view' | 'index' | 'trigger'
    name: string
    sqlSha256: string
  }>
  tables: Array<{
    name: string
    columns: Array<{ ordinal: number; name: string; declaredType: string; notNull: boolean; primaryKeyOrdinal: number; defaultSql: string | null }>
    foreignKeys: Array<Record<string, string | number | null>>
    indexSignatures: string[]
    rowCount: number
    sampleDigest: string
  }>
  schemaFingerprint: string
}
```

قواعد observation:

- أسماء objects تسجل كما هي، لكن لا تمنح دلالة.
- `sampleDigest` مبني على عينة حتمية محدودة؛ لا يضع نصوص الكتب الحساسة كاملة في logs.
- `schemaFingerprint` يحسب من البنية canonical لا من ترتيب الإرجاع العارض، ويستبعد قيم الصفوف.
- يشغل `PRAGMA integrity_check` أو مكافئ قراءة كامل؛ أي نتيجة غير `ok` تمنع التحويل.
- views/triggers غير المتوقعة لا تُنفذ؛ الاستعلامات تأتي من mapping المعتمد فقط.

## 5. نموذج المخرجات

### 5.1 تنسيق المصدر الجديد

لا يُعاد استخدام اسم `shamela-bok`. يقترح format إضافي صريح:

```ts
type PublishedSourceFormat =
  | ExistingPublishedSourceFormat
  | 'shamela-sqlite-pack'
```

يتطلب إدخاله لاحقًا تعديلًا متوافقًا في `PublishedSource`, `BookFormat`, و`materializePublishedWork`; هذه الوثيقة لا تجري ذلك التعديل.

### 5.2 حزمة الكتاب

اسم الملف content-addressed، مثل `assets/<sha256-prefix>.shamela.json.gz`، والمحتوى بعد فك الضغط:

```ts
interface ShamelaBookPackV1 {
  schemaVersion: 1
  packageFormat: 'shamela-sqlite-pack'
  workId: string
  sourceBookId: string
  metadata: {
    title: string
    authors: Array<{ id?: string; name: string }>
    categoryId?: string
    publisher?: string
    edition?: string
    investigator?: string
    publicationYearHijri?: number
    deathYearHijri?: number
    volumeCount?: number
    description?: string
    rawSourceMetadata?: string
  }
  pages: Array<{
    sourceRowId: string
    sequence: number
    part: number | null
    page: number | null
    text: string
    textSha256: string
  }>
  toc: Array<{
    sourceRowId: string
    sequence: number
    title: string
    level: number
    parentSourceRowId: string | null
    targetPageSourceRowId: string | null
  }>
  provenance: ShamelaArtifactProvenanceV1
  integrity: ShamelaBookIntegrityV1
}
```

قواعد الهوية والترتيب:

- `workId` مشتق حتميًا من `(sourceId, sourceBookId)` ولا يتغير بتغير العنوان.
- `sourceRowId` تمثيل string lossless للمفتاح المعتمد؛ لا يعتمد على index المصفوفة.
- `sequence` ينتج من ORDER BY موثق في mapping. لا يُقبل ترتيب SQLite الافتراضي.
- الجزء/الصفحة `null` عند الغياب؛ لا يُخترع `1` أو sequence كرقم مطبوع.
- عنوان الفهرس وهدفه يحفظان كما يثبت المصدر؛ لا تصحيح انزياح تخميني وقت التحويل.

### 5.3 كتالوج الموقع

`catalog/catalog-v1.json.gz` يحوي بطاقة خفيفة لكل work قابل للاكتشاف دون تحميل النص. يجب أن تكون هويات metadata متطابقة مع حزم الكتب. لا يعني وجود بطاقة أن الكتاب نُزل إلى جهاز المستخدم.

### 5.4 حزم البحث

- تبنى من `pages[].text` الأصلي بعد قبول حزمة الكتاب، لا مباشرة من SQLite عبر مسار ثانٍ.
- التطبيع العربي lookup-only، والنص الأصلي يبقى مصدر snippet والتحقق النهائي.
- كل shard مستقل وله id محمول وSHA-256 وحجم وعدد documents/postings.
- لا مسار مطلق في index أو manifest.
- النتائج تشير إلى `(workId, sourceRowId, character offsets in original text)`.

### 5.5 manifest الإصدار

يوجد manifest خاص ببناء الشاملة، ثم يشتق منه `app/public/library/published/manifest.json` بعد commit:

```ts
interface ShamelaSiteReleaseManifestV1 {
  schemaVersion: 1
  contract: 'shamela-sqlite-converter/1'
  releaseId: string
  state: 'staging' | 'verified' | 'committed'
  sourceAcquisitionFingerprint: string
  converter: { version: string; gitCommit?: string; mappingRegistrySha256: string }
  counts: ShamelaReleaseCountsV1
  catalog: ArtifactRef
  books: Array<{ workId: string; sourceBookId: string; source: ArtifactRef; searchShardIds: string[]; integrity: ShamelaBookIntegrityV1 }>
  searchShards: Array<ArtifactRef & { shardId: string; documentCount: number }>
  observations: ArtifactRef
  failures: Array<{ sourceBookId?: string; sourcePath: string; code: string; schemaFingerprint?: string }>
  fingerprint: string
}
```

في `full` لا يجوز `verified` مع failures أو coverage أقل من المدخل. في `sample` يبقى state `staging` ولا يدمج في public manifest.

## 6. Provenance

```ts
interface ShamelaArtifactProvenanceV1 {
  source: {
    sourceId: 'shamela-official-database'
    releaseVersion: string
    archiveUrl: string
    archiveContentLength: number
    archiveEtag: string
    archiveLastModified: string
    acquisitionFingerprint: string
  }
  inputs: Array<{
    logicalPath: string
    byteLength: number
    sha256: string
    zipCrc32: number
    schemaFingerprint: string
  }>
  mapping: {
    registryVersion: string
    mappingId: string
    mappingSha256: string
  }
  conversion: {
    converterVersion: string
    convertedAt: string
    packageSha256: string
    uncompressedContentSha256: string
  }
}
```

- provenance إداري؛ لا يحقن عبارة «مستورد من الشاملة» في نص الكتاب.
- timestamp لا يدخل في هوية artifact أو fingerprint المحتوى.
- لا تُسجل مسارات Windows المطلقة؛ `logicalPath` نسبي إلى acquisition root.
- كل artifact يمكن ربطه عكسيًا ببايتات قواعد المصدر وmapping الذي فسّرها.

## 7. منع فقد النص

هذه بوابة مانعة، وليست metric إرشادية.

### 7.1 قواعد الاستخراج

- قيمة TEXT تحفظ code-point-for-code-point كما أعادها SQLite driver.
- ممنوع `trim`, `NFKC`, إزالة التشكيل/التطويل، دمج المسافات، تحويل newline، أو إصلاح encoding في حقل `text` الأصلي.
- `null` يظل null في تقرير المصدر؛ لا يتحول إلى string فارغ دون عد مستقل.
- BLOB لا يُفك بالتخمين. mapping يحدد encoding مثبتًا أو يصنف الصف unsupported.
- أي نسخة normalized تحفظ كحقل مشتق منفصل أو في shard البحث فقط.

### 7.2 بصمة corpus لكل كتاب

قبل serialization وبعد فك artifact يحسب digest واحد من سجل canonical مرتب:

```text
for each page in approved source order:
  length(sourceRowId UTF-8) || sourceRowId UTF-8
  length(text UTF-8)        || text UTF-8
```

يجب تطابق:

- عدد صفوف النص في الاستعلام المصدر.
- عدد الصفوف ذات النص null.
- عدد الصفوف ذات النص غير null.
- مجموع UTF-8 bytes للنصوص غير null.
- مجموع Unicode scalar values.
- عدد CR وLF وNUL وreplacement character كل على حدة.
- `sourceTextCorpusSha256` قبل الحزم و`roundTripTextCorpusSha256` بعد فكها.

أي اختلاف يمنع الكتاب والإصدار. لا يسمح بتقرير «99.9% محفوظ».

### 7.3 سلامة serialization

- gzip مجرد ضغط نقل؛ SHA-256 يسجل للملف المضغوط وللمحتوى canonical غير المضغوط.
- JSON serializer/parser round-trip جزء إلزامي من build gate.
- offsets الخاصة بالبحث تقاس على النص الأصلي وفق وحدة معلنة واحدة، ويفضل UTF-16 code units لمطابقة JavaScript، مع اختبار surrogate/combining marks.

## 8. أعداد وبوابات المطابقة

```ts
interface ShamelaReleaseCountsV1 {
  acquiredDatabaseFiles: number
  discoveredBookDatabases: number
  mappedBookDatabases: number
  emittedBookPackages: number
  catalogWorks: number
  uniqueWorkIds: number
  sourceTextRows: number
  emittedPages: number
  sourceTocRows: number
  emittedTocEntries: number
  sourceAuthors: number
  catalogAuthors: number
  sourceCategories: number
  catalogCategories: number
  indexedPages: number
}
```

بوابات full release:

1. `discoveredBookDatabases = mappedBookDatabases = emittedBookPackages`.
2. `emittedBookPackages = catalogWorks = uniqueWorkIds`، إلا إذا أثبت mapping علاقة multi-database work صريحة؛ عندها يسجل count مستقل ويُختبر.
3. مجموع `sourceTextRows = emittedPages` وفق سياسة null المعلنة؛ إذا استبعدت صفوف null من pages فيجب `sourceTextRows = emittedPages + nullTextRows` بلا صف مجهول.
4. `sourceTocRows = emittedTocEntries`؛ كل orphan/duplicate حالة معلنة، لا إسقاط.
5. كل work في catalog له package واحد موجود، وكل package له work واحد في catalog.
6. كل page قابلة للبحث إما indexed أو لها سبب استثناء ثابت؛ الافتراضي `indexedPages = nonNullTextPages`.
7. لا duplicate workId/sourceBookId/artifact path.
8. كل `ArtifactRef.byteLength` وSHA-256 يطابق الملف الفعلي.
9. مجموع ملفات source في provenance subset مطابق تمامًا لملفات acquisition المستخدمة، ولا ملف غير معلن.
10. إعادة build بنفس المدخل/mapping تنتج البايتات نفسها لكل artifact content-addressed، باستثناء manifest تشغيلي منفصل لا يدخل publication fingerprint.

## 9. الذرية

### 9.1 مجلدات البناء

```text
<stagingRoot>/
  runs/<runId>/
    work/
    artifacts/
    observations/
    checkpoints/
    release-manifest.staging.json
  releases/<releaseFingerprint>/
  CURRENT
```

- كل ملف يكتب إلى اسم مؤقت فريد داخل filesystem نفسه، يغلق، يعاد قراءته والتحقق من بصمته، ثم `rename` إلى اسمه content-addressed.
- artifacts immutable؛ إذا وجد الاسم نفسه يجب تطابق الحجم والبصمة وإلا collision/failure.
- لا يُعدل `app/public/library/published/manifest.json` أثناء استخراج الكتب.
- بعد نجاح جميع البوابات، ينقل/يثبت release المكتمل ثم يستبدل `CURRENT` أو manifest publication بعملية rename واحدة.
- يبقى الإصدار السابق صالحًا بالكامل حتى commit؛ الفشل لا يترك manifest يشير إلى asset ناقص.
- materialization إلى `app/public` خطوة مستقلة بعد verified، وتستخدم staging sibling ثم rename/مبادلة محدودة؛ لا تحذف الإصدار السابق تلقائيًا.

### 9.2 manifest published

إضافة أعمال الشاملة إلى `PublishedLibraryManifest` يجب أن تكون مشتقة بالكامل من release verified. `readyCount`, `workCount`, و`sourceFileCount` تحسب من المصفوفة النهائية، لا تعدل incremental. لا تستخدم `datasetVersion` ثابتًا في الأداة.

## 10. الاستئناف والتعافي

Checkpoint لكل كتاب:

```ts
interface ShamelaBookCheckpointV1 {
  schemaVersion: 1
  workId: string
  sourceBookId: string
  inputFingerprints: string[]
  mappingSha256: string
  phase: 'observed' | 'extracted' | 'validated' | 'packed' | 'indexed'
  artifacts: ArtifactRef[]
  counts: Record<string, number>
  textCorpusSha256?: string
  checkpointFingerprint: string
}
```

- checkpoint يكتب ذريًا وله `.previous` قابل للاستعادة، على نمط الاكتساب الحالي.
- يستأنف الكتاب فقط إذا تطابقت بصمات كل المدخلات وmapping وإصدار العقد، وكل artifact معلن يعاد التحقق منه.
- mismatch يعيد بناء ذلك الكتاب فقط؛ لا يقبل checkpoint جزئيًا.
- phases monotonic، لكن وجود phase متقدم لا يغني عن فحص الملفات.
- الكتاب الفاشل يسجل سببًا ويترك الإصدار السابق؛ لا يمنع استئناف الكتب الأخرى في run، لكنه يمنع full release من verified.
- cancel/انقطاع الكهرباء لا يحذف checkpoints أو artifacts مكتملة، وتنظف ملفات `.tmp` غير المشار إليها في بداية run بعد التحقق أنها داخل run root.

## 11. الأمان والموارد

- افتح قواعد SQLite read-only ويفضل immutable؛ ممنوع extensions وATTACH من محتوى المصدر.
- لا تنفذ triggers/views غير موثقة؛ الاستعلامات ثابتة في mapping registry.
- حدود للصفوف، حجم النص، حجم artifact، زمن الاستعلام، والذاكرة؛ التجاوز fail-closed لا truncation.
- stream الصفحات على دفعات، ولا تجمع corpus كله في RAM.
- كل path يمر بدالة containment، ولا symlink، ولا absolute path في المخرجات.
- logs تحمل ids/counts/digests فقط، لا مقاطع نص عشوائية ولا بيانات سرية.
- النص يعامل بيانات غير موثوقة عند العرض؛ rendering لا يستخدم `innerHTML` غير منقى.

## 12. الاندماج مع التطبيق الحالي

التنفيذ اللاحق يحتاج تغييرات محدودة وواضحة:

1. إضافة `shamela-sqlite-pack` إلى عقد الصيغ المدعومة، دون تغيير معنى `shamela-bok`.
2. parser lazy جديد يفك الحزمة ويتحقق من schema/integrity قبل إنشاء `StoredBook`.
3. mapping إلى `StoredBook`: `extractedText` للاستخدام العام، وصفحات وفهرس منظمين في حقول جديدة أو نموذج عام؛ لا تسمية حقول SQLite بـ`bokPages` إن لم تكن BOK.
4. `ensurePublishedLibrarySeeded` يجب ألا يغرس آلاف النصوص تلقائيًا. يغرس الكتالوج الخفيف، وي materialize حزمة الكتاب عند طلب تنزيل/فتح صريح.
5. `reader.ts` يعرض page/part الأصليين ويستخدم targets الثابتة للفهرس.
6. search Worker يحمّل shards حسب الحاجة، ويعيد موضعًا يفتح الحزمة/الصفحة الصحيحة.

يتطلب أي تغيير لعقود `SPEC.md` المجمدة ADR وموافقة منفصلة؛ لا يمرر المحول عبر حزمة لا تملك conversion بحسب حدودها الحالية.

## 13. رموز الفشل الدنيا

- `acquisition_manifest_invalid`
- `acquisition_file_mismatch`
- `sqlite_integrity_failed`
- `sqlite_schema_unmapped`
- `sqlite_schema_mapping_mismatch`
- `source_identity_duplicate`
- `source_order_undefined`
- `source_text_encoding_unsupported`
- `source_text_limit_exceeded`
- `text_row_count_mismatch`
- `text_byte_count_mismatch`
- `text_corpus_digest_mismatch`
- `toc_count_mismatch`
- `catalog_package_bijection_failed`
- `search_coverage_mismatch`
- `artifact_roundtrip_failed`
- `artifact_hash_mismatch`
- `checkpoint_mismatch`
- `output_path_escape`
- `release_not_complete`

الخطأ يذكر logical source path وsourceBookId/schema fingerprint إن توفرا، ولا يطبع نص الصفحة.

## 14. خطة الاختبارات

### المستوى A — وحدات خالصة

- canonical schema fingerprint مستقل عن ترتيب نتائج SQLite metadata.
- canonical length-prefixed text digest مع العربية والتشكيل والتطويل وCRLF وNUL وemoji وcombining marks.
- workId ثابت ولا يتأثر بالعنوان.
- path containment على Windows، ورفض absolute/traversal/symlink.
- حساب manifest fingerprint والأعداد ورفض duplicate ids/paths.
- checkpoint fingerprint واستئناف مطابق ورفض mapping/input drift.

### المستوى B — قواعد SQLite مصغرة مولدة

يولد الاختبار schemas بأسماء عشوائية عمدًا لإثبات عدم وجود hardcode قبل mapping:

- schema غير معروف ينتج observation ويتوقف.
- mapping fixture معتمد يستخرج metadata/pages/toc بترتيب ثابت.
- تغيير نوع/ترتيب/PK عمود يغير schema fingerprint ويمنع reuse.
- null text، duplicate key، orphan toc، invalid UTF/BLOB، قاعدة تالفة، و`integrity_check` فاشل.
- view/trigger خبيث وextension token لا يُنفذ.

### المستوى C — منع فقد النص property/fuzz

- آلاف strings عربية عشوائية مع علامات وتباين newline وRTL controls.
- serialize → gzip → read → parse يعيد text corpus digest نفسه.
- mutate حرفًا واحدًا أو ترتيب صفحتين أو حذف صف null فتفشل البوابة.
- offsets البحثية تعيد substring الأصلي نفسه بعد normalization lookup.

### المستوى D — عينة ذهبية حقيقية

بعد فحص schema، تحفظ fixtures أو تقارير مصغرة غير حساسة من عينة متنوعة:

- كتاب صغير/ضخم، متعدد الأجزاء، بلا فهرس، فهرس عميق، حواشٍ، نص مشكول، metadata ناقصة، وأكثر من schema fingerprint إن وجد.
- لكل كتاب أعداد وبصمات متوقعة مثبتة يدويًا من SQLite، لا من output المحول نفسه.
- مقارنة صفحات مختارة أولى/وسطى/أخيرة حرفيًا، وعناوين TOC وأهدافها.

### المستوى E — الذرية والاستئناف

- قتل العملية بعد كل phase وكل rename ثم الاستئناف.
- corrupt checkpoint/current artifact ونجاح الرجوع إلى `.previous` أو إعادة الكتاب.
- run متوازيان على release نفسه: lock واضح أو رفض، بلا manifest مختلط.
- مساحة ممتلئة/permission denied؛ الإصدار السابق يبقى قابلًا للقراءة.
- تغيير كتاب واحد يعيد artifact/shard المتأثرين فقط، مع release fingerprint جديد.

### المستوى F — تكامل published/app

- release تجريبي بكتاب واحد يشتق `PublishedWork` آمنًا، وتتحقق البصمة والحجم.
- catalog يظهر بطاقة دون تنزيل النص.
- فتح الكتاب ينزل حزمته مرة واحدة، يخزنها، ويعرض الجزء/الصفحة والفهرس.
- إعادة التحميل offline تقرأ الحزمة المخزنة.
- بحث Worker يعيد نتيجة ويفتح الصفحة/الموضع الصحيح.
- source update يعيد الحزمة دون حذف ملاحظات المستخدم المرتبطة بهوية مستقرة.
- corrupted asset لا يستبدل النسخة المحلية/الإصدار السابق.

### المستوى G — بوابة release الكاملة

- مطابقة جميع counts في القسم 8.
- تحقق كل artifact hashes وround trips.
- صفر `unsupported`/failures في full؛ وإلا لا commit.
- زمن/ذاكرة مسجلان على corpus كامل، مع concurrency محدودة.
- أول نتائج البحث أقل من ثانية وpagination حتى 10 آلاف نتيجة على الحزم المبنية.
- لا ملف Lucene في web assets ولا طلب شبكة له وقت التشغيل.

## 15. معايير قبول أول implementation

1. observation كامل لعينة ذهبية دون افتراض أسماء.
2. mapping واحد على الأقل معتمد ببصمة schema ودليل يدوي مستقل.
3. تحويل كتاب حقيقي إلى artifact deterministic ينجح round-trip بلا اختلاف نص واحد.
4. catalog/package bijection وكل بوابات العد والبصمات خضراء.
5. انقطاع متعمد ثم استئناف دون إعادة الأعمال السليمة.
6. release staging بكتاب واحد يظهر محليًا عند الطلب، لا عند bootstrap الجماعي.
7. البحث في الحزمة عبر Worker وفتح الموضع الصحيح.
8. أي corruption أو schema drift يفشل مغلقًا ويبقي الإصدار السابق.

لا يُعلن دعم إصدار `1448.2` كاملًا حتى تنجح بوابة full على كل قواعد الكتب المكتسبة، لا العينة وحدها.
