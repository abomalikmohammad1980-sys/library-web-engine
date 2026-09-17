# شبكة أسطر Word (`docGrid`)

## القياس المرجعي

قيسَت عينة صريحة بواسطة Microsoft Word COM ثم صُدّرت من Word إلى PDF وفُحصت
صور الصفحات بصريًا. الشبكة `type=lines linePitch=360tw`، خط Arial ‏10pt:

| الحالة | فرق موضع السطر في Word |
|---|---:|
| `snapToGrid=1`, ‏`auto=240` | 18pt |
| `snapToGrid=1`, ‏`atLeast=15pt` | 18pt |
| `snapToGrid=1`, ‏`exact=15pt` | 15pt |
| `snapToGrid=0`, ‏`auto=240` | 11.25–12pt طبيعي |
| `snapToGrid=1`, ‏`auto`, خط 30pt | 36pt (مضاعفان للشبكة) |

إذًا Word يقرب الارتفاع الطبيعي/الأدنى إلى أعلى مضاعف من `linePitch` عند
`auto` و`atLeast`، ولا يمس `exact`. أما وجود `linePitch` بلا
`type=lines|linesAndChars` فلا يفعّل شبكة الأسطر؛ «توحيد الحاكمية» مثال corpus
له `linePitch=360` ونوع غائب، فلا يُفرض عليه ارتفاع 18pt.

## عقد التنفيذ

- `snapToGrid` يورث من الفقرة ثم سلسلة نمط الفقرة ثم `docDefaults`، والافتراضي
  true عند غياب تصريح كل الطبقات.
- الشبكة فعالة فقط لنوعي `lines` و`linesAndChars` ومع pitch موجب.
- `exact` يبقى كما هو.
- `auto`: الأساس هو ارتفاع الخط الطبيعي المقدر من أكبر em مضروبًا في 1.2 ثم
  معامل `line/240`، ويقرب لأعلى مضاعف pitch.
- `atLeast`: الأساس هو الأكبر بين الطبيعي والقيمة الدنيا، ثم يقرب لأعلى مضاعف.
- `snapToGrid=0` أو نوع شبكة غائب يبقي سلوك CSS الطبيعي/spacing الحالي.

## بوابة الانحدار

- synthetic يثبت وراثة تعطيل الشبكة وإعادة تفعيلها مباشرة.
- synthetic DOM يثبت 10pt→18pt، و30pt→36pt، وatLeast15→18pt، وexact15→15pt.
- corpus «توحيد الحاكمية» يثبت أن pitch بلا نوع لا يُفعّل الشبكة.

تعذر رندر DOCX عبر LibreOffice لأنه غير مثبت، لكن مرجع القياس نفسه كان Word
COM وPDF صادرًا مباشرة من Microsoft Word، وفُحصت صفحات PDF الأربع بصريًا.
