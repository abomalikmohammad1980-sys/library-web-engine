# خلفية صفحة المستند (`w:background`)

## العينات الرسمية والأمان

استُخدمت عينتان من مستودع `dotnet/Open-XML-SDK` الرسمي في tmp فقط:

- `fldSimple-Field Definitions-GreetingLine.docx`، SHA-256
  `087C3705402124D197829509B11C3D9D2B2159AAE7132AB7C760B22585C51A18`.
  12 مدخل ZIP نظيفًا. أكد COM حقل GREETINGLINE ونتيجته
  `«GreetingLine»`، وحفظها model/scene؛ لذلك سُجلت **no-gap**.
- `document - HexColor - RGB - Document Background.docx`، SHA-256
  `BED13205F92EAE1BFC849CEC42FE75670E611AA33A99F0583A3A344CB067264F`.
  12 مدخل ZIP نظيفًا. لا VBA/OLE/ActiveX/embeddings أو علاقات خارجية.

## الدليل والفجوة

تصرح العينة الثانية بـ`w:background w:color="548DD4"` وإطار صفحة أمامي داكن.
أكد Word COM أن الخلفية مرئية، وأظهر PDF مع خيار طباعة الخلفيات ورقة زرقاء
كاملة وإطارها. كان المستخرج يحفظ الإطار فقط ويسقط لون الخلفية العالمي.

## السلوك

- يحفظ `DocumentModelV0.pageBackground` قيمة RGB الصريحة ذات ست خانات فقط.
- تنقل scene اللون إلى كل `ScenePage`.
- Canvas يستعمله خلفية افتراضية؛ يبقى `RenderOptions.background` الصريح أعلى
  أولوية، و`null` يبقي canvas شفافًا.
- scene HTML وDOM يضعان اللون على حاوية الورقة قبل الحدود والمحتوى، فلا يغير
  مساحة المتن أو ترتيب إطار `front/back`.
- لا تُستنتج ألوان theme عند غياب RGB الصريح؛ العينة تثبت اللون الصريح فقط.

## الانحدار

اختبار العينة الرسمية يثبت `548DD4` في model ثم scene، واختبار DOM يثبت وصول
اللون إلى style حاوية الصفحة مع بقاء اختبارات paint كاملة خضراء.

