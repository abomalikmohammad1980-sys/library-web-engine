# أشكال WordprocessingShape السطرية

## العينة الرسمية والأمان

- المصدر: مستودع Microsoft OfficeDev الرسمي
  `OfficeDev/Office-Add-in-samples`، الملف
  `Samples/word-import-template/resources/template example.docx`.
- حُفظت نسخة QA في `tmp/Word external QA/OfficeDev-ImportTemplate` فقط، وليست
  جزءًا من corpus المنشور.
- SHA-256:
  `7BC632FF3AAFDE2A00A3C2B6DBBC5E1D758B643BA918B628E403A9B8A2F7FBBE`.
- الفحص: 32 مدخل ZIP صالحًا، بلا VBA أو ActiveX أو OLE/embeddings أو علاقات
  خارجية أو ملفات تنفيذية.

## الدليل والفجوة

أظهر Word COM ورقة واحدة وشكلين: مجموعة التصميم الخلفية، و`Rectangle 78`
السطرية بقياس 210.1×32.3pt ونص `LOGO`. وأكد PDF المرجعي الإطار البنفسجي
والنص في أعلى يسار الورقة. يحمل OOXML الثاني داخل `wp:inline` عقدة `wps:wsp`
بـ`wp:extent` و`wps:spPr` و`wps:txbx`، بلا `a:blip` أو علاقة صورة.

كان المستخرج يحجز ارتفاع `wp:inline`، لكنه لا ينشئ مرساة إلا للصورة ذات rId
أو chart أو SmartArt؛ لذلك يختفي الشكل ونصه رغم بقاء فراغه.

## السلوك

- عند وجود `wps:wsp` داخل `wp:inline` ينشئ النموذج مرساة `inlineFlow` بمقاس
  `wp:extent` وهندسة `a:prstGeom` والحشو والخط من الخصائص المباشرة أو style.
- يحفظ `wps:txbx` ومحاذاة `wps:bodyPr@anchor` والحشوات الافتراضية/الصريحة.
- يظل مسار الصور وchart وSmartArt مستقلًا؛ لا يُقرأ VML fallback بالتوازي ولا
  يُكرر العنصر.
- scene يرصف نص الصندوق داخل المرساة، ثم يرسم Canvas/HTML الشكل والنص بالعقد
  القائمة نفسها.

## الانحدار

- اختبار model الرسمي يثبت `Rectangle 78` بقياس 4202×647twip، حد 40twip،
  `anchor=b` ونص `LOGO`.
- اختبار scene الرسمي يثبت وصول الشكل والنص المرصوف إلى المرساة المرئية.
- اختبار corpus لـ`sample-tadris` يفصل عمدًا عائماته القديمة عن أشكال WPS
  السطرية الجديدة كي يمنع الخلط أو تكرار الملكية.

