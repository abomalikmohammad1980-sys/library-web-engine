# OOXML chart cache: clustered column charts

## النطاق المثبت

عينة Microsoft OfficeDev الرسمية تحمل `charts/chart1.xml` من نوع
`c:barChart` مع `barDir=col` و`grouping=clustered`. مصدر الرسم هو cache
OOXML نفسه، لا workbook المضمّن: فئتان، سلسلتان، أربع قيم، ألوان، وسيلة
إيضاح علوية، labels للقيم، ومحور فئات ظاهر ومحور قيم محذوف.

المقارنة البصرية مع PDF الرسمي في
`tmp/Word external QA/OfficeDev-SampleDoc/word-page-2.png` أكدت الأعمدة
المتجمعة الخضراء/الزرقاء، القيم فوقها، الفئتين ووسيلة الإيضاح. عنصر العنوان
موجود بلا نص محفوظ؛ Word يعرض placeholder محليًا («عنوان المخطط»). لا يختلق
المحرك هذا النص ويترك `title=null`.

## العقد

- `openDocx` يجمع أجزاء `word/charts/chartN.xml`، وتحل المرساة `c:chart@r:id`
  من علاقات الجزء المالك.
- parser يدعم النوع المثبت فقط: clustered bar/column من caches، مع
  categories/series/values/title/legend/colors/axis visibility/showVal.
- يحل ألوان `srgbClr` و`schemeClr + lumMod` من theme.
- النوع الآخر يعاد كـ`kind=unsupported` و`unsupportedType`؛ Canvas وSVG
  يظهران صندوق حالة صريحًا بدل سقوط صامت أو رسم مختلق.
- Canvas وHTML/SVG يرسمان الأعمدة والمحاور والlabels والفئات والlegend من
  القيم المحفوظة فقط.

## الانحدار

synthetic يثبت parsing ولون theme وحالة pie غير المدعومة. والانحدار الرسمي
يثبت `Category 1/2` و`Series 1/2` والقيم `4.3/2.5` و`2.4/4.4` واللونين
`385724` و`2E47B1`. يثبت scene بقاء chart داخل المرساة حتى paint.
