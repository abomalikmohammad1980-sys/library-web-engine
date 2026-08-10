# Word run17 - Microsoft OfficeDev SampleDoc QA

- المصدر الرسمي: Microsoft Learn sample `word-get-set-edit-ooxml`، والمستودع
  `OfficeDev/Office-Add-in-samples`, المسار
  `Samples/word-add-in-get-set-edit-openxml/C#/WD_OpenXML_js/SampleDoc.docx`.
- رابط Learn: https://learn.microsoft.com/en-us/samples/officedev/office-add-in-samples/word-get-set-edit-ooxml/
- SHA-256: `34D32914A785A18C84F244F3F7117DC5DD9BFA39DB335B37AE16B8D16F4F5607`.
- الحفظ: `tmp/Word external QA/OfficeDev-SampleDoc/` فقط؛ لا يدخل corpus النشر.

## فحص الأمان read-only

37 ZIP entry، الحجم المفكوك 1,222,190 بايت، بلا traversal، بلا macro، وبلا
ملف تنفيذي. تحوي الحزمة Excel embedding رسميًا يستخدمه chart.

## المصفوفة

Word COM صدّر PDF من صفحتين. الفحص المرئي أكد formatted/styled text، صورة
بيضاوية، WordArt textbox، teardrop shape، content control، جدولين، SmartArt،
وchart. النموذج استخرج 28 فقرة، 18 فقرة خلية، 4 مراسٍ، صورتين، مربعَي نص،
SmartArt واحدًا وfootnotes اثنتين.

الفجوة المغلقة: الصورة السطرية كانت تحفظ `rId7` وأبعاد 3630x4380twips لكن
تسقط `pic:spPr/a:prstGeom=ellipse`، فتظهر مستطيلة. صار النموذج يحفظ هندسة
الصورة، وCanvas يقص الصورة بمسار الشكل، وHTML يطبق القص البيضاوي. بعد الإصلاح
أعادت العينة الرسمية `{rId:rId7, shape:ellipse}`.

الـchart ما زال خارج نموذج scene (embedded workbook/chart XML) ولم يُرقع؛
يتطلب مسارًا مستقلًا لا تخمين صورة.

## متابعة run18

لا يحمل chart في `document.xml` fallback أو preview: `rId14` يشير مباشرة إلى
`charts/chart1.xml`، والبيانات في workbook مضمّن. لذلك لم يُنشأ renderer جزئي.
أما صورة `rId7` فتحمل `imageEffects.shadow` و`border` موثقين وكان scene يسقطهما؛
نُقلا إلى Canvas/HTML مع احترام القص البيضاوي.

## متابعة run19

ثبت أن SmartArt ليس جزءًا مجهولًا: النموذج يستخرج `diagrams/drawing1.xml`
إلى أشكال جاهزة في `anchor.diagram`، لكن scene كان يسقطها. صار يحولها إلى
أطفال مرساة ويرسم الشكل والحشو والنص وحجمه في Canvas/HTML. يشترك المسار مع
مجموعات DrawingML/VML، مع إبقاء الطفل الصوري صورة. بقي chart وحده خارج
النطاق لعدم وجود fallback. اجتاز اختبار scene المركز 59/59 وبناء scene/paint.

## متابعة run20

فحص WordArt/textbox/shape أثبت أن مربع النص يصل إلى scene، لكن الشكل الرسمي
`Teardrop 1` كان يفقد التدرج وسماكة الحد والظل، وتُرسم هندسته مستطيلًا.
نُقلت خصائص DrawingML المحلولة إلى SceneAnchor، وأضيف مسار teardrop متجهي
في Canvas وتمثيله المتدرج في HTML. يثبت الانحدار القيم الرسمية نفسها، ومرت
بوابة scene/paint المركزة 79/79 وبناء الحزمتين.
ثم اجتازت مصفوفة Word الكاملة 331/331 وبناء model/layout/scene/paint/DOM.

## متابعة run21

أُغلق blocker chart للنوع المثبت في العينة: clustered column. صار parser
يقرأ cache الرسم وعلاقته وفئاته وسلاسله وقيمه وألوانه وlegend والمحاور، ثم
ينقله scene ويرسمه Canvas وHTML/SVG. المقارنة البصرية مع PDF الرسمي أكدت
الأعمدة والقيم والفئات والlegend؛ العنوان placeholder غير محفوظ فلم يُختلق.
الأنواع الأخرى تظهر `unsupported` صراحة. بوابة model/scene/paint المركزة
153/153 وبناء الحزم الثلاث ناجح.
ثم اجتازت مصفوفة Word الكاملة 334/334 وبناء model/layout/scene/paint/DOM.
