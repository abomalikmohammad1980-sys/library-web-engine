# تنسيق رقم الصفحة `thaiNumbers`

## العينات الرسمية والأمان

استُخدمت عينتان من مستودع `dotnet/Open-XML-SDK` الرسمي، في tmp فقط:

- `Normalize/header&footer.docx`: SHA-256
  `D9D1E8D3C7C74885AE5AC6261DB67F5B36E0EFA0052D717A205C153C673C6F31`.
  فحص 15 مدخل ZIP نظيف. أكد Word COM/PDF رأس `Header` وتذييل `Footer` في
  ورقة واحدة، وطابقهما model؛ لذلك سُجلت العينة **no-gap** بلا تعديل.
- `pgNumType-Page Numbering Settings-fmt-thaiNumbers.docx`: SHA-256
  `9C8A0D6EEF7B7B272CE8DEBD6BB83203548DD13E18DDF714FC8D94C1A16C737E`.
  فحص 16 مدخل ZIP نظيف. لا VBA/OLE/ActiveX/embeddings أو علاقات خارجية في
  أي منهما.

## الدليل والفجوة

تحمل العينة الثانية `w:pgNumType w:fmt="thaiNumbers"` وتذييل PAGE. أكد Word
COM النمط 54، ورقتين، والقيمة `๑` في الأولى. وأظهر PDF المرجعي `๑` ثم `๒`.
كان model يحفظ `thaiNumbers` والنتيجة المخبأة، لكن DOM وscene يعيدان صياغة
الحقول الديناميكية بأرقام ASCII عند كل صفحة.

## السلوك

تستبدل صيغة `thaiNumbers` الأرقام العشرية بخريطة Unicode التايلندية:
`๐๑๒๓๔๕๖๗๘๙`. يطبق ذلك على PAGE وNUMPAGES وSECTIONPAGES في DOM وscene، وكذلك
أي مسار داخلي يعيد استخدام formatter نفسه. لا تُدّعى صيغ تايلندية أخرى لم
تثبتها العينة.

عدد صفحات Word الرسمي للعينة اثنتان؛ قد ينتج scene التقديري بخط fallback
ثلاثًا. يبقى هذا فرق تصفيح معلنًا، بينما يثبت الانحدار أن كل رقم ينتجه scene
يستعمل الصيغة الصحيحة ولا يسقط إلى ASCII.

