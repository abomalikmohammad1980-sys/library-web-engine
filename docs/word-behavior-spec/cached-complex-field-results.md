# نتائج الحقول المركبة المخزنة

## الحالة المثبتة

تخزن Word نتيجة الحقل المركب المرئية بين:

`fldChar begin` → `instrText` → `fldChar separate` → **result runs** →
`fldChar end`.

تعليمة الحقل metadata ولا تظهر، أما result runs فهي نص الوثيقة المرئي حتى إن
كان اسم الحقل غير مدعوم ديناميكيًا في المحرك.

## الدليل

عينة Open XML SDK الرسمية
`tmp/Word external QA/OpenXmlSdk-GreetingLine/greeting-line.docx` تحتوي حقل
`GREETINGLINE` ونتيجته المخزنة `«GreetingLine»`. كان المحلل يجمع النص صحيحًا
ثم يبقي الفقرة `excluded="field"`، فتسقط من scene وDOM وpaint.

## القاعدة

1. لا تدخل `instrText` في نص العرض.
2. تحفظ الرنات الواقعة في منطقة النتيجة كما هي، بما فيها تنسيقها.
3. إذا نتج عن الفقرة نص مرئي، يلغى إقصاء `field` سواء كان نوع الحقل معروفًا أم
   مجهولًا؛ المعروف مثل PAGE قد يُعاد materialize، والمجهول يعرض cached result.
4. إذا غابت نتيجة مرئية تبقى فقرة التعليمة وحدها غير معروضة.

## الانحدار

- model يثبت النص و`excluded=false`.
- scene يثبت وصول `GreetingLine` إلى كلمات المشهد.
- DOM يثبت ظهور النتيجة في المستند.
- paint quick HTML يثبت قبول الفقرة المرئية.

