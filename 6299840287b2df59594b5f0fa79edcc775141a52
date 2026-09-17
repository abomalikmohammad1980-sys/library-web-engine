# حشو أشكال DrawingML من `fillRef` والتدرج الصريح

## الحالة المؤكدة

أشكال الرأس/التذييل ومربعات النص لا تحمل دائمًا `a:solidFill`. قد يأخذ الشكل
الحشو من `wps:style/a:fillRef@idx`، حيث يشير `idx` إلى `a:fillStyleLst` في
`word/theme/theme1.xml`. وقد يكون المدخل `a:gradFill`. كما قد يحمل الشكل
`a:gradFill` مباشرًا داخل `wps:spPr`.

اختزال الحالتين إلى لون `schemeClr` فقط يحذف تدرج Word، وإن أبقى لونًا قريبًا.

## الدليل

- الملف الحقيقي: `إن في ذلك لذكرى.docx`.
- الجزء: `word/header1.xml`، مربع حقل PAGE.
- المرجع: `fillRef idx=3` بلون placeholder أسود؛ المدخل الثالث في
  `fillStyleLst` تدرج بثلاث نقاط، ومعه `effectRef idx=2` لظل خارجي.
- النموذج بعد الإصلاح: شكل `rect`، حشو/حد `000000`، تدرج ثلاثي بزاوية CSS 0°،
  وظل opacity=0.35 وblur≈4.199px.

## القاعدة

1. يحفظ `parseTheme` قالب كل `gradFill` حسب ترتيب `fillStyleLst`.
2. عند `fillRef` يستبدل `phClr` بلون المرجع، ثم يطبق `tint`, `shade`,
   `satMod`, `lumMod`, `lumOff` على كل نقطة.
3. `a:gradFill` المباشر أعلى أولوية من قالب النسق، و`a:noFill` الصريح يمنع
   الاثنين ما لم يوجد حشو مباشر آخر.
4. تتحول زاوية DrawingML إلى CSS بإضافة 90°، لأن صفر DrawingML يسار→يمين
   بينما 90° CSS يسار→يمين.
5. يرسم DOM التدرج بـ`linear-gradient`، ويبقى اللون الأول fallback في النموذج.

## الاختبارات

- `packages/ooxml-model/src/index.test.ts`: حفظ قالب النسق، حل `fillRef`،
  والتدرج المباشر وتحويلات اللون.
- `packages/ooxml-dom/src/render.test.ts`: إخراج CSS للتدرج بدل لون واحد.
- فحص النموذج المبني على الملف الحقيقي المذكور أعلاه.

## صورة حشو مربع النص (`a:blipFill`)

وجود `a:blip` داخل `wps:spPr/a:blipFill` لا يعني أن المرساة صورة مستقلة.
إذا كان الشكل يحمل `wps:txbx` فالصورة **حشو خلف النص**. لذلك:

1. يبقى `anchor.rId=null` حتى لا يسبق مسار الصورة مسار مربع النص ويحذفه.
2. تحفظ علاقة الصورة في `shapeFill` مع `stretch/tile` و`srcRect`.
3. يرسم DOM طبقة خلفية مطلقة، ثم طبقة نص فوقها؛ القص يستعمل النسب نفسها لمسار
   الصور العادية، والتكرار يستعمل background-repeat.
4. اختبار النموذج يثبت بقاء النص وعلاقة الحشو، واختبار DOM يثبت وجود طبقتي
   `flt-textbox-fill` و`flt-textbox-content` معًا.
