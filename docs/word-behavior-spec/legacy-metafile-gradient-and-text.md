# تدرجات EMF ونصوص WMF الممتدة

## الحالة المؤكدة

قد تحفظ ملفات Word الزخارف والأغلفة القديمة كوسائط `EMF/WMF` لا كصورة نقطية.
يسجل EMF التدرج المستطيلي في `EMR_GRADIENTFILL` (نوع 118)، مع مصفوفة
`TRIVERTEX` ثم أزواج `GRADIENT_RECT`. ويسجل WMF النص المتقدم في
`META_EXTTEXTOUT` (الدالة `0x0A32`)، وقد يلحق النص بمصفوفة `dx` تحدد تقدم كل
محرف؛ إسقاطها يغير عرض العبارة ومحاذاتها داخل الرسم.

## الدليل

أضيف مثبتان ثنائيان مصغران إلى `packages/ooxml-dom/src/render.test.ts`:

1. سجل EMF يحوي رأسين أحمر/أزرق ومستطيلًا أفقيًا؛ الناتج المحكم تدرج أفقي.
2. سجل WMF يحوي `ABC` وتقدمات `8,9,10`؛ الناتج يثبت x عند `12,20,29`.

## القاعدة

1. يحول العارض `GRADIENT_RECT_H/V` إلى تدرج SVG داخل حدود رأسي المستطيل.
2. قنوات `TRIVERTEX` ذات 16 بت تتحول إلى RGB ذي 8 بت بالقسمة على 257؛ حقل
   `Alpha` محجوز في هذه العملية ولا يعامل كشفافية.
3. يقرأ `META_EXTTEXTOUT` المستطيل الاختياري عند `ETO_OPAQUE/ETO_CLIPPED` فقط.
4. عند وجود `dx` يرسم كل محرف في `tspan` بموضع x تراكمي، مع تهريب XML.

## الاختبار

- `pnpm exec vitest run packages/ooxml-dom/src/render.test.ts --maxWorkers=1`
- `pnpm -F @engine/ooxml-dom build`
- `pnpm build`

لا يدعي المثبت دعم `GRADIENT_FILL_TRIANGLE`؛ يحتاج مزجًا ثنائي الأبعاد مستقلًا.
