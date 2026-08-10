# SPEC — ربط القشرة `app/` بمحرك `scene`+`paint` (المرحلة 2)

**الحالة:** عقد المرحلة 2 (2026-08-05). عقد المرحلة 1 مجمّد في
`docs/specs/app-engine-bridge.md` ويبقى مرجعًا لـ `bridge.ts`/`loadBook`/`splitPages`.
أي تغيير على هذا العقد يتطلب ADR يعتمده المنفّذ.

## الغرض

نقل ترسيم صفحات القارئ من DOM المتصفح إلى محركنا: docx حقيقي ← `buildScene` ←
`renderPageToCanvas` (صفحات Canvas)، مع تصدير PDF عبر `renderDocumentToPdf`.
يُسلّم هذا البند المدرج سابقًا كـ «خارج النطاق (للمرحلة 2)» في عقد المرحلة 1.

## ربط الحزم (قيد بيئي)

- لا `workspace:*` في `app/package.json` — `pnpm install` يفشل بـ `ERR_PNPM_EISDIR`
  (غياب صلاحيات symlink على هذا الجهاز).
- الربط عبر مسارين متزامنين لكل حزمة:
  - `app/tsconfig.json`: `compilerOptions.paths["@engine/scene"]`, `["@engine/paint"]`,
    `["@engine/font-system"]`
  - `app/vite.config.ts`: `resolve.alias` المقابلة عبر `resolve(__dirname, ...)`

## واجهة القارئ (المستهلك)

- `app/src/engine/bridge.ts` — مرحلـة 1 كما هي (نقي DOM، لا `h()`):
  - `loadBook(url): Promise<LoadedBook>` — جلب docx ← `extractFromDocx` ← `splitPages`.
  - `LoadedBook.pages` هي مدخل `buildBookScene` في المرحلة 2.
- `app/src/engine/scene.ts` — جسر المشهد الجديد (نقي، لا `h()`):
  - `SERVED_FONTS` + `servedFontFile(family)` — خريطة العائلات المحلولة من
    `corpus/book-fonts/*.ttf` → ملفات `app/public/fonts/` (ترتيب familyCandidates).
  - `fontServerProvider` — مزوّد خطوط بـ `FontProvider` (كاش لكل ملف) يحل الوجوه
    المطلوبة من XML إلى bytes الملف المخدوم؛ fallback على Al-Jazeera-Regular.
  - `browserFontServer` — التحميل في المتصفح عبر `fetch('/fonts/<file>.ttf')`.
  - `buildBookScene(book): Promise<SceneDocument>` — `buildScene` من
    `packages/scene` مع `fontServerProvider`.
- `app/src/screens/reader.ts` — قارئ المرحلة 2:
  - `readerScreen(id)` → `renderBook` (حالة `ReaderState` + pager).
  - `renderPageToCanvas` مخصص يحفظ `canvas.className = 'reading__canvas'`.
  - زر PDF → `exportPdf` ← `renderDocumentToPdf({ scale: 2 })` من `packages/paint`.
  - سمة `ReadingTheme`/`THEMES` والتذييل والـ TOC الجانبي كما في المرحلة 1.

## مصدر المحرك

- `buildScene(model, opts)` من `packages/scene/src/build.ts` — شجرة صفحات/فقرات/أسطر.
- `renderPageToCanvas(canvas, page, doc, ...)` من `packages/paint/src/canvas.ts`.
- `renderDocumentToPdf(doc, opts)` من `packages/paint/src/pdf.ts`.
- الخطوط: `fontServerProvider` يغذّي `packages/shaper` بـ bytes الخط؛ مطلوب
  هبوط HarfBuzz-WASM في المتصفح (wasm مُضمَّن عبر `new URL(..., import.meta.url)`).

## ملاحظة تشغيلية: تحميل `harfbuzz.wasm` في تطوير Vite

`harfbuzzjs` (إخراج Emscripten) يحمّل `harfbuzz.wasm` بنفسه عبر
`new URL("harfbuzz.wasm", import.meta.url)` داخل حزمة pre-bundled الخاصة بـ Vite.
في وضع التطوير كان المسار الناتج `/node_modules/.vite/deps/harfbuzz.wasm` يُجاب
بـ `index.html` (SPA fallback) فتفشل الترجمة بـ «expected magic word» وتتوقف
الصفحات عن الظهور (تبقى حالة loading/error).

الإصلاح في `app/vite.config.ts` حصرًا (dev-only، لا يمس shaper ولا المسار البنائي):
- `optimizeDeps.exclude: ['harfbuzzjs']` — يُبقي الوحدة تُخدم من مصدرها
  `dist/harfbuzz.js` فيصبح `import.meta.url` يشير إلى `dist/` الحقيقي.
- middleware `serveHarfbuzzWasm()` يخدم `/node_modules/harfbuzzjs/dist/*.wasm`
  بترويسة `Content-Type: application/wasm` قبل أن تلتقطه SPA fallback.
- في الإنتاج (build) لا حاجة لإصلاح: Vite يضمّن الـ wasm كأصل وrewrite المسار.

التحقق الآلي: `pnpm dev` ثم `vite preview` على `dist/` يعطيان
`<canvas class="reading__canvas" aria-label="صفحة ١ من ١٨">` بلا أخطاء console.

## خطوط المكوّنات

`corpus/book-fonts/*.ttf` → `app/public/fonts/` (6 وجوه). توزيع المسؤولية:
- `servedFontFile` يقرر اسم الملف لكل عائلة مطلوبة (بنية family/face لا تخمين بكسلات).
- `scene.test.ts` يثبت الخريطة: Al-Jazeera + «Traditional Arabic bold» → `tradbdo.ttf`
  مع fallback.

## معايير القبول

1. `pnpm test` من الجذر أخضر — يشمل `app/src/engine/scene.test.ts` على docx حقيقي
   (`sample-ahadith.docx`): 18 صفحة، هندسة صفحة > 0، غليفات مُشكَّلة، كاش خطوط
   bytes>0، وعدم فقدان نص (تعدد محارف كلمات sceneText == نص المستند).
2. `pnpm build` من الجذر أخضر — يشمل app (`tsc --noEmit` + `vite build` مع wasm مُضمَّن).
3. `#/reader/:id` لكتاب يحمل `docx` يعرض صفحات Canvas فعلية بخطوطها + زر PDF يحمّل ملفًا.

## خارج النطاق (للمرحلة 3)

- تحديد/نسخ، بحث، وصولية، تفاعل («interact`/`a11y`/`search`).
- اكتمال ميزات `paint` (صور/جداول/أشكال VML في Canvas).
- مسار `app/src/engine/render.ts` (DOM) أصبح متجاوزًا بالترسيم Canvas ويبقى كمرجع فقط.
