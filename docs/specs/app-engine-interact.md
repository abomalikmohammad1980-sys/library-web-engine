# SPEC — تفاعل القارئ فوق Canvas (المرحلة 3)

**الحالة:** عقد المرحلة 3 (2026-08-05).

هذه المرحلة تُضيف التحديد والنسخ النصي فوق صفحات Canvas الناتجة من
`scene`/`paint`، بدون الرجوع لمسار DOM القديم.

## الغرض

- تحويل الصفحة المرسومة إلى سطح قابل للإصابة (hit-test) على مستوى الكلمات.
- دعم تحديد بالسحب بالماوس على صفحة Canvas الحالية.
- نسخ النص المحدد (Ctrl+C + زر «نسخ المحدد»).

## طبقة `interact`

حزمة جديدة: `packages/interact`.

- `buildSelectionMap(page)`
  - يبني خريطة كلمات/أسطر من `ScenePage` باستخدام نفس هندسة `paint`
    (`lineWordGeometry`) لضمان اتساق القياس.
- `hitTestWord(map, xPx, yPx)`
  - يعيد أقرب كلمة عبر مطابقة عمودية للسطر ثم أفقية للكلمة.
- `normalizeSelectionRange(a, b)`
  - يوحّد اتجاه التحديد (start <= end).
- `selectionBoxes(map, range)`
  - صناديق التحديد للرسم كطبقة overlay.
- `selectionPlainText(map, range)`
  - نص النسخ (مسافة بين كلمات السطر، `\n` بين الأسطر).
- `clientPointToPagePx(map, rect, clientX, clientY)`
  - تحويل إحداثيات المؤشر من CSS px إلى إحداثيات الصفحة المنطقية.

## ربط القشرة

- `app/src/screens/reader.ts`
  - `attachPageSelection(...)` يركّب طبقة تحديد فوق `reading__canvas`.
  - يدعم السحب بالـ Pointer Events.
  - نسخ التحديد عبر:
    - Ctrl/Cmd + C عندما تكون صفحة القراءة في focus.
    - زر pager: `نسخ المحدد`.
  - fallback للحافظة: `navigator.clipboard.writeText` ثم `execCommand('copy')`.

- `app/src/styles/components.css`
  - `.reading__selection-layer` و`.reading__sel-box` لعرض التحديد.
  - `.pager-btn--copy` لزر نسخ التحديد.

## القبول الآلي

1. `packages/interact/src/selection.test.ts` أخضر (hit-test + range + text + boxes).
2. `pnpm test` من الجذر أخضر.
3. `pnpm build` من الجذر أخضر.

## خارج النطاق في هذه المرحلة

- نسخ غني HTML فوق Canvas.
- التحديد متعدد الصفحات في واجهة واحدة.
- الربط مع `a11y`/`search`.
