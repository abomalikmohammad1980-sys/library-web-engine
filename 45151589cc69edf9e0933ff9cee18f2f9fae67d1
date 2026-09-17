# DrawingML — `sizeRelH/V` الصفري لا يلغي `wp:extent`

## الحالة المؤكدة

في غلاف «نقاط على حروف» تحمل المرساة امتدادًا مطلقًا صالحًا، ومعه:

```xml
<wp14:sizeRelH relativeFrom="margin"><wp14:pctWidth>0</wp14:pctWidth></wp14:sizeRelH>
<wp14:sizeRelV relativeFrom="margin"><wp14:pctHeight>0</wp14:pctHeight></wp14:sizeRelV>
```

Microsoft Word يرسم الصورة بالامتداد المطلق `wp:extent` (غلاف صفحة كاملة)، ولا
يحوّلها إلى حجم صفري.

## القاعدة

- لا يُنشأ `relWidth` أو `relHeight` إذا كانت النسبة غير رقمية أو ≤ صفر.
- يبقى `wp:extent` هو مصدر العرض/الارتفاع في هذه الحالة.
- النسبة الموجبة وحدها تستبدل الامتداد في طبقة الرسم.

## الاختبار

`packages/ooxml-model/src/index.test.ts` يثبت أن الصفر يعيد `undefined` وأن
`50000` تعني 50٪.
