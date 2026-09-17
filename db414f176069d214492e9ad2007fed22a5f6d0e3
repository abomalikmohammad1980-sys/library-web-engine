# حد النص `w14:textOutline`

## الحالة المؤكدة

`w14:textOutline` يرسم حدًا حول الغليفات بعرض EMU وحشو لون صريح أو theme.
`w14:noFill` أو العرض صفر يعنيان عدم وجود حد مرئي.

## الدليل

- corpus يحوي 44 عقدة: 19 حدًا مرئيًا بلون bg1/accent4/FFFFFF، و17 noFill،
  وثماني حالات بعرض صفر.
- كل الأنماط الفعلية `prstDash=solid`، لذلك لا يلزم تقريب خط متقطع.
- كان المحلل يتجاهل الامتداد كاملًا.

## القاعدة

1. يحول العرض من EMU إلى twips بالقسمة على 635.
2. يحل srgb/theme وتحويلات tint/shade/satMod/lumMod/lumOff.
3. يخرج DOM `-webkit-text-stroke` و`paint-order:stroke fill` حول النص نفسه.
4. لا يخرج حدًا لـnoFill أو العرض صفر.

## الاختبار

اختبار النموذج يثبت 9525EMU = 15twip وحل shade، واختبار DOM يثبت حد 1px؛
وإحصاء corpus يميز الحالات المرئية من noFill/zero-width.
