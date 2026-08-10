# SPEC — حزمة `@engine/shaper` (HarfBuzz-WASM) — المرحلة 2

**الحالة:** مُجمّدة كعقد المرحلة 2 (2026-08-05). أي تغيير يتطلب ADR يعتمده المنفّذ.

## الغرض

تحويل نص + خط + اتجاه + حجم إلى **غليفات مُشكّلة** (شكل عربي/عبراني حقيقي) بقائمة
تقدّمات وإزاحات، مع خرائط عناقيد تصل كل غليف بنصه المصدر. أساس الترسيم الذاتي
(`scene`/`paint`) وبديل HarfBuzz-المرجعي في `reference/dart-engine`
(`WordSymbolResolver` لا يمس هنا؛ هذا غلافُ الأشكال لا دلالة الرموز).

## الاعتماد

- `harfbuzzjs@^1.4.0` (HarfBuzz 14.2.1). WASM يُحمَّل:
  - المتصفح: `new URL("harfbuzz.wasm", import.meta.url)` (حافلة مدمجة تُخدم كأصل ثابت).
  - Node: قراءة من القرص مباشرة (الاختبارات).
- الحزمة تُصدَّر ESM صافي (build = `tsc -b` إلى `dist/`).

## الواجهة العامة (المصدر: `src/index.ts`)

### `ShapeDirection`
`"rtl" | "ltr"` — يضبط اتجاه التدفق البصري (الترتيب البصري للغليفات).

### `ShapedGlyph`
```
{ id: number; cluster: number; xAdvance: number; yAdvance: number;
  xOffset: number; yOffset: number; flags: number }
```
- `xAdvance/xOffset/...` بوحدات التصميم (font units) مضروبة في `scale`.
- `flags`: أو بتّات (BREAK/SAFE_TO_INSERT_TATWEEL/UNSAFE_TO_CONCAT) — بوابات الكاسر/الكشيدة لاحقًا.

### `ClusterRange`
```
{ textStart: number; textEnd: number; glyphStart: number; glyphEnd: number }
```
- عنقود = غليفات تصدر من نص واحد (مقطع مغلق للتبديل). الرنات تخرج **بترتيب الغليفات (بصري)**.

### `ShapedRun`
```
{ text: string; direction: ShapeDirection; glyphs: ShapedGlyph[]; clusters: ClusterRange[];
  totalAdvance: number; upem: number; scale: number; unsupportedChars: string[] }
```

### `ShapeRequest`
```
{ text: string; fontData: Uint8Array; direction: ShapeDirection; script?: string;
  language?: string; scale?: number; features?: string[] }
```
- `scale` افتراضيًا = `upem` للخط (تقدّمات = font units ×1).
- `features`: نصوص OTL مثل `"kern"`, `"liga=0"`, `"+ss01"`.

### `Shaper`
- `shape(req): ShapedRun` — LRU (`maxCacheEntries`, افتراضي 4096).
- `hMetrics(fontData): FontHMetrics` — `{ upem, ascender, descender, lineGap }` (font units).
- `glyphPath(fontData, glyphId): string` — SVG path للغليف (لترسيم Canvas/PDF).
- `cachedRuns: number` — للاختبار.
- `close()` — تحرير الخطوط (لسياقات node فقط).

### `buildClusters(textLen, glyphs): ClusterRange[]`
- تحويل تتابع غليفات إلى عناقيد (ترقيم distinct + الجوار) — معيارية التغطية: `clustersCover(textLen, ranges, glyphCount)`.

## اتفاقات أساسية

- **الترقيم**: cluster = مؤشر أول كود-code في النص المنطقي؛ بترتيب الغليفات (بصري)، فآخر مؤشر نصي يظهر أولًا في RTL.
- **تغطية**: كل كود-code مرتكز في عنقود؛ كل غليف في عنقود (مصادق عليها في الاختبارات عبر `clustersCover`).
- **التقدم**: font units × scale. لا تحويل إلى px — وحدة التسليم remain وحدات الخط، والتحجيم للرسم في `paint` (ADR-0004).
- **الكاش**: مفتاح كامل (نص+بايتات الخط+اتجاه+سكريبت+لغة+scale+features). مثيل واحد لكل فونت (خريطة fnv1a).
- **النص الفارغ** ⇐ رن فارغ (0 غليفات/0 تقدم/0 عناقيد).
- **الميزات غير الصالحة** ⇐ `throw` (خطأ برمجي صريح، لا صمت).

## معايير القبول

1. `pnpm test` (جذر): اختبارات shaper (16) خضراء على خطوط عربية حقيقية من `corpus/book-fonts/`:
   RTL بترتيب بصري (عناقيد متناقصة)، LTR منطقي، التراكيب (لا: عنقود واحد غليفين)،
   دمج الحركات في عناقيد، تعدد الخطوط، استقلال الكاش عن النص/الخط/الاتجاه، نسبة scale، LRU محدد،
   `hMetrics` سليمة، `glyphPath` مسار SVG صالح.
2. `pnpm -r build` أخضر (تضمنت الحزمة في مراجع الجذر).
3. لا `workspace:` في `app/package.json` — أي استهلاك من القشرة عبر مسار منفصل (tsconfig.paths + vite.alias) كعقد المرحلة 1.

## خارج النطاق

- قرارات الكسر/الالتفاف وارتفاع السطر (حزمة `layout`).
- ترسيم Canvas/PDF (حزمة `paint`).
- دلالة رموز `w:sym` والخطوط المضمّنة (نموذج ooxml-model + مسار تحميل الخطوط).
- BiDi الرسمي (حزمة `bidi`) — هنا نحيل فقط `direction` فيطلبها المستهلك.
