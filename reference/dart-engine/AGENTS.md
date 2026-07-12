# Golden Shamela Agent Guide

هذا المشروع Flutter/Windows يعرض كتب Word/XML داخل واجهة قراءة عربية، والهدف ليس "عرضًا قريبًا من Word"، بل مطابقة Word قدر الإمكان. أي حل بصري ترقيعي غير مقبول إذا لم يكن مبنيًا على فهم XML نفسه، لأن التطبيق سيعرض عشرات آلاف الكتب، وما يصلح لكتاب قد يكسر غيره.

## قبل أي تعديل

استعن بالمراجع المحلية:
- `WordXmlDoumentation/key_sections.txt`
- `WordXmlDoumentation/extracted_reference.txt`

## قواعد تنفيذ حاسمة

- لا تستخدم `dart analyze`
- لا تستخدم `dart format`
- استخدم `apply_patch` فقط للتعديلات اليدوية
- أي تعديل يجب أن يكون محافظًا جدًا ومبنيًا على XML الفعلي ومرجع OOXML، لا على التخمين البصري
- إذا احتجت الاستعانة بالإنترنت، فليكن البحث موجّهًا إلى Microsoft Learn أو OOXML / ECMA-376 أو مصادر أولية فقط

## الملفات الأساسية في مسار التحويل

- `lib/wordToHTML/Paragraph.dart`
- `lib/wordToHTML/PPr.dart`
- `lib/wordToHTML/runT.dart`
- `lib/wordToHTML/RPr.dart`
- `lib/wordToHTML/SectPr.dart`
- `lib/wordToHTML/ParagraphTable.dart`
- `lib/wordToHTML/abstractNum.dart`
- `lib/Models/WordPage.dart`

## مناطق حساسة يجب عدم كسرها

### 1) الترقيم الآلي
- صار أقرب لطريقة Word
- تم تصحيح التعامل مع `hanging indent`
- تم تحسين تمثيل `marker` و `suff/tab`

### 2) المسافة بين الفقرات
- تُحسب بين فقرتين كـ `max(before, after)` بدل جمع القيمتين

### 3) فوترات `framePr`
- هناك مسار خاص يعالج الفقرات المتجاورة ذات `framePr` المتطابق كإطار واحد
- الملف الأهم هنا: `lib/wordToHTML/FooterFrameLayout.dart`
- لا تفترض أن كل footer frame حالة واحدة
- يجب فهم `framePr` ومرجع Word XML جيدًا قبل تعديل هذا المسار

### 4) ارتفاع السطر
- هذه الجزئية حساسة جدًا
- المستخدم جرّبها على عدة كتب وقال إنها ممتازة حتى الآن
- لا تعبث بها إلا إذا كانت المهمة مرتبطة بها مباشرة
- الملفات المرتبطة:
  - `lib/wordToHTML/ParagraphStrutResolver.dart`
  - `lib/wordToHTML/PPr.dart`
  - `lib/wordToHTML/PPr.g.dart`
  - `lib/wordToHTML/Paragraph.dart`
- في حالات `default/auto` تتم محاولة استخدام `LineMetrics` الفعلية للخط
- يوجد fallback محافظ للمعامل العام السابق

### 5) الأقواس والـ BiDi
- المشكلة السابقة لم تكن فقط "شكل القوس"، بل الفرق بين:
  - run ذو اتجاه صريح في XML (`w:rtl` أو `w:ltr`)
  - run محايد فقط ورث الاتجاه من الفقرة
- تم تعديل:
  - `lib/wordToHTML/BidiTextNormalizer.dart`
  - `lib/wordToHTML/runT.dart`
  - `lib/wordToHTML/runT.g.dart`
- التغيير الحالي:
  - لم نعد نقلب كل الأقواس يدويًا
  - صار التطبيع يميّز بين run ذي اتجاه صريح وrun محايد موروث
- هذه المنطقة ما زالت حساسة، فلا تعدّلها إلا إذا كانت المشكلة الجديدة مرتبطة مباشرة بها

### 6) الرموز من `w:sym`
- بعض الرموز مثل `ﷺ` ونحوها لا تأتي كنص داخل `w:t`، بل كعنصر `w:sym`.
- في هذه الحالة لا يجوز تفسير `w:char` مباشرة كحرف Unicode عادي.
- الحالة المؤكدة في المشروع: `w:sym w:font="AGA Arabesque" w:char="0065"` كانت تُعرض خطأ كحرف `e` قبل إصلاحها.
- مسار المعالجة الحالي لهذه الرموز معزول في:
  - `lib/wordToHTML/WordSymbolResolver.dart`
  - `lib/wordToHTML/runT.dart`
- إذا ظهرت مشكلة مشابهة، ابدأ من XML نفسه وتحقق أولًا:
  - هل العنصر `w:sym`؟
  - ما قيمة `w:font`؟
  - ما قيمة `w:char`؟
  - وهل الخط المقابل محمّل في التطبيق باسم العائلة الصحيح؟
- حالة مهمة موثقة: قد يكون تحليل `w:sym` صحيحًا، ومع ذلك يفشل العرض بعد فتح الكتاب من الكاش إذا لم يُعِد التطبيق تحميل الخط المضمّن المذكور في `w:font`.
- الحالة المؤكدة هنا كانت مع `KFGQPC Arabic Symbols 01` حيث كانت الـ runs تحفظ اسم الخط والرمز صحيحين، لكن `metadata.json` لم يكن يحفظ `extractedFontPaths`، فكان فتح الكتاب من الكاش يفقد مسار الخط المضمّن وتظهر المربعات بدل الغليف.
- وحالة مؤكدة إضافية: قد يكون `extractedFontPaths` محفوظًا ومُعاد تحميله فعلًا، ومع ذلك يظهر الرمز مربعًا لأن ملف الخط المضمّن نفسه يستخدم `legacy symbol cmap` بدل Unicode cmap الذي يتوقعه Flutter.
- في هذه الحالة لا تكون المشكلة في `WordSymbolResolver` ولا في قيمة `w:char`، بل في **تهيئة bytes الخط قبل تسجيله**.
- الإصلاح الصحيح الحالي هنا في مسار تحميل الخطوط:
  - `loadExtractedFonts(...)` في `lib/FontsLoaderController.dart`
  - يمرر bytes الخط عبر `SystemFontMetadataResolver.prepareFontBytesForFlutter(...)`
  - هذه المعالجة **عامة بنيوية** لملف الخط، وليست hardcode لخط `KFGQPC Arabic Symbols 01` أو للرمز `F072`
- الإصلاح الصحيح في هذه الحالة يكون في مسار الكاش/تحميل الخطوط:
  - حفظ `extractedFontPaths` داخل metadata عند بناء الكاش
  - وعند قراءة كاش قديم لا يحتويها، محاولة استعادتها من `_shared_fonts` ثم إعادة كتابة metadata
- لا تبدأ في هذه الحالة بـ:
  - hardcode لمعاني `w:char`
  - alias بين عائلات خطوط مختلفة
  - افتراض أن المشكلة من `WordSymbolResolver` قبل التأكد أن الخط المضمّن أُعيد تحميله فعلاً في مسار فتح الكتاب من الكاش
  - افتراض أن أي مربع ظاهر مع `w:sym` سببه فقدان مسار الخط فقط؛ قد يكون المسار صحيحًا لكن الـ cmap legacy

### 6.1) تقطيع الحروف العربية مع `bold` قد يكون مشكلة تحميل وجوه الخط لا مشكلة XML
- **الحالة المؤكدة**: بعض النصوص العربية بخط مثل `Traditional Arabic` كانت تظهر حروفها مقطعة أو غير متصلة عندما يكون `w:b`/`w:bCs` موجودًا، رغم أن الـ XML نفسه لا يحتوي `w:spacing` يبرر ذلك.
- **الجذر الحقيقي المحتمل هنا** ليس:
  - `BiDi`
  - `BidiTextNormalizer`
  - `w:spacing` على مستوى الـ run
  - ولا line-height
- **الجذر الحقيقي الحالي** كان في مسار تحميل الخطوط على ويندوز:
  - العائلة مثل `Traditional Arabic` قد يكون لها أكثر من face فعلي (`regular`, `bold`, ...)
  - إذا حُمّل وجه واحد فقط ثم طلب Flutter `fontWeight.bold`، قد يصنع وزنًا صناعيًا أو يختار fallback غير مناسب، فتظهر الحروف العربية وكأنها متقطعة
- **الإصلاح الصحيح الحالي**:
  - في `lib/FontsLoaderController.dart`
  - `loadKnownSystemFontsForDocument(...)` يجب أن يحمّل **كل الوجوه المكتشفة للعائلة نفسها** تحت نفس `FontLoader(family)`
  - ثم يترك Flutter يختار الـ face الصحيح حسب `fontWeight`
- **حالة مؤكدة إضافية**:
  - إذا كان الخط مطلوبًا من XML باسم مثل `PT Bold Heading`، فلا تعتمد على تشابه اسم ملف الخط فقط
  - في ويندوز كانت ملفات `PTBLD*.TTF` متقاربة جدًا، لكن name table يبيّن أن:
    - `PTBLDARC.TTF` = `PT Bold Arch`
    - `PTBLDHAD.TTF` = `PT Bold Heading`
  - لذلك يجب أن تطابق إدخالات `lib/Services/KnownSystemFontsRegistry.dart` الاسم الداخلي للعائلة لا التخمين من اسم الملف
  - أعراض اختيار face خاطئ قد تظهر كتفاف كلمة واحدة داخل textbox رغم أن أبعاد الصندوق في XML صحيحة
- **لماذا هذا ليس ترقيعًا**:
  - لأنه مبني على بنية family/face للخط نفسه
  - لا يخص `Traditional Arabic` وحده
  - ولا يعبث بالنص أو الـ XML أو التطبيع
- **ما يجب عدم فعله**:
  - لا تعالج التقطيع بحذف `bold` من `RPr`
  - لا تستبدل الخط يدويًا بخط آخر لمجرد أن المشكلة ظهرت في كتاب واحد
  - لا تغيّر `letterSpacing` أو `BidiTextNormalizer` قبل التأكد من تحميل وجوه الخط
  - لا تخلط بين هذه المشكلة وبين مشكلة `w:sym`; قد تتجاوران لكن جذر كل واحدة مختلف
- **خطوات التشخيص الصحيحة**:
  1. افحص الـ XML: هل يوجد فعلًا `w:b`/`w:bCs`؟ وهل يوجد `w:spacing` أم لا؟
  2. افحص العائلة المطلوبة في `w:rFonts`
  3. تحقق هل العائلة على ويندوز لها أكثر من face/ملف
  4. تحقق هل التطبيق حمّل وجهًا واحدًا فقط أم كل الوجوه تحت family واحدة
  5. إذا كان التقطيع يظهر فقط مع `bold` ويختفي بدونه، فابدأ من تحميل الـ faces قبل أي مسار نصي

### 7) نسخ النص مع حفظ فواصل الفقرات
- Flutter's `SelectableRegion` يدمج كل الفقرات المحددة في نص واحد متصل بدون فواصل `\n`
- الحل: `ClipboardPostProcessor` يعالج الحافظة بعد النسخ ويعيد فواصل الفقرات
- الملفات المرتبطة:
  - `lib/UI/clipboard_post_processor.dart` — مسؤولية واحدة: معالجة الحافظة بعد النسخ
  - `lib/UI/custom_context_menu.dart` — يفوّض النسخ لـ `ClipboardPostProcessor`
  - `lib/UI/DocViewer.dart` — يعترض Ctrl+C ويفوّض لـ `ClipboardPostProcessor`
- الخوارزمية:
  1. يقرأ نص الحافظة الذي وضعه Flutter
  2. يجلب النص المعروض لكل فقرة مرئية من `WordPage.getVisibleRenderedTexts()`
  3. يُطبّع كلا النصين (يطبّع = يزيل الاختلافات) ثم يبحث عن المطابقة
  4. يُقسّم نص الحافظة الأصلي عند حدود الفقرات مع إدراج `\n`
- التطبيع (`_normalizeForMatch`) يعالج الاختلافات بين نص الحافظة ونصنا المعروض:
  - Private Use Area (U+E000–F8FF): رموز `w:sym` تظهر في نصنا لكن Flutter يستبدلها بـ WidgetSpan
  - `\t` (U+0009): لاحقة الترقيم (numbering suffix)
  - `\uFFFC`: عنصر استبدال WidgetSpan
  - `\u00A0` → مسافة عادية: مسافة غير منقسمة
- `Paragraph.renderedPlainText` يستخرج النص من شجرة الـ InlineSpan المعروضة فعليًا
  - يُخزّن مؤقتًا في `_cachedRenderedPlainText` وقت بناء الـ widget في `toWidget()`
  - هذا يضمن مطابقة النص المعروض فعليًا وليس ناتج إعادة استدعاء `getPSpans()`
- لا تعدّل هذا المسار إلا إذا كانت المشكلة مرتبطة مباشرة بالنسخ

### 8) تحديد النص عبر الفقرات المرقّمة
- **المشكلة**: `SelectableRegion` يتوقف عند الفقرات المرقّمة آليًا ولا يمكن تحديد الصفحة كاملة
- **السبب**: `WidgetSpan` بعناصر غير قابلة للتحديد (`SizedBox`، `Row`) يقطع تدفق التحديد — Flutter لا يستطيع مد التحديد عبرها
- **الحل**: استبدال كل `WidgetSpan` ذي عنصر غير قابل للتحديد بـ `TextSpan` مع `letterSpacing` لتحقيق نفس العرض البصري مع إمكانية التحديد
- **الملفات المعدّلة**:
  - `lib/wordToHTML/PPr.dart` — فاصل الترقيم (tab suffix): `WidgetSpan(child: SizedBox(width: spacerWidth))` → `TextSpan(text: ' ', style: effectiveMarkerStyle.copyWith(letterSpacing: extraSpacing))`
  - `lib/wordToHTML/Paragraph.dart` — مسافة أول سطر (firstLineIndent): `WidgetSpan(child: SizedBox(width: indentPx))` → `_firstLineIndentSpan()` باستخدام `TextSpan` مع `letterSpacing`
  - `lib/wordToHTML/runT.dart` — علامات التبويب (tabs): `getTabWidget()` → `getTabSpan()` يُرجع `InlineSpan?` بدل `Widget?`، والفرع في `toWidget()` صار `TextSpan(children: [..., tabSpan])` بدل `WidgetSpan(Row(...))`
- **القياس**: يستخدم `TextPainter` مع `TextStyle` الفعلي (خط الفقرة) لقياس عرض المسافة وحساب `letterSpacing` المطلوب بدقة
- **آثار جانبية**:
  - مسافة إضافية في الحافظة عند النسخ (أقرب لسلوك Word الفعلي)
  - عرض بصري تقريبي (فرق ≤1px ممكن بسبب sub-pixel rounding)
  - أثر إيجابي على RTL: تقليل عدد `WidgetSpan` يقلل احتمال مشاكل `fixRtlWidgetSpan`
- لا تعدّل هذا المسار إلا إذا كانت المشكلة مرتبطة مباشرة بالتحديد أو بالمسافات الفاصلة

### 9) النسخ مع التنسيق (Rich Clipboard)
- **الميزة**: عند نسخ نص من التطبيق، يوضع على الحافظة نص عادي + HTML مع تنسيقات CSS داخلية، بحيث عند اللصق في Word أو محررات أخرى يُحافظ على التنسيق (bold, italic, color, font, underline, size, background)
- **التنفيذ**:
  - حزمة `super_clipboard` تضع `Formats.htmlText` + `Formats.plainText` على حافظة ويندوز في عملية واحدة
  - `RichClipboardBuilder` يحوّل شجرة `InlineSpan` (من `getPSpans()`) إلى HTML مع CSS داخلي
  - `ClipboardPostProcessor.postProcessClipboardRich()` يحدد الفقرات المحددة ويولّد HTML + نص عادي
- **الملفات المعدّلة/المضافة**:
  - `lib/wordToHTML/RichClipboardBuilder.dart` — جديد: تحويل InlineSpan → HTML
  - `lib/UI/clipboard_post_processor.dart` — إضافة `postProcessClipboardRich()`
  - `lib/UI/custom_context_menu.dart` — `_handleCopy` يستخدم النسخ الغني
  - `lib/UI/DocViewer.dart` — Ctrl+C يستخدم النسخ الغني
  - `lib/Models/WordPage.dart` — إضافة `getVisibleParagraphs()` لإرجاع كائنات Paragraph
  - `pubspec.yaml` — إضافة `super_clipboard: ^0.9.1`
- **التنسيقات المدعومة**: bold, italic, underline, line-through, color, font-family, font-size, letter-spacing, background-color, text-align, direction (RTL)
- **خارج النطاق**: صور، جداول، أرقام حواشي مرتبطة
- **Fallback**: إذا فشل `super_clipboard`، يُستخدم النص العادي فقط
- **"نسخ مع المرجع"**: يبقى نصًا عاديًا (التنسيق غير مناسب للمرجع)
- لا تعدّل هذا المسار إلا إذا كانت المشكلة مرتبطة مباشرة بالنسخ مع التنسيق

### 10) `header/footer` literal dot leaders
- **المشكلة**: ليست كل الحالات في الهيدر/الفوتر تستخدم `w:tab` مع `leader` حقيقي كما في OOXML المثالي. بعض الملفات تأتي فيها النقاط كنص فعلي داخل `w:t`/runs، ومعها نص قبل النقاط أو بعدها، فيبدو السطر في Word كأنه `space-between` بينما هو في XML مجرد runs عادية تحوي نقاطًا.
- **التمييز المهم**:
  - إذا كانت الفقرة تستخدم `w:tab` فعليًا، فهذه يجب أن تبقى على مسار tabs الطبيعي، ولا يجوز تحويلها إلى fallback خاص بالنقاط.
  - إذا كانت الفقرة في `header/footer` وتحتوي نقاطًا حرفية طويلة داخل runs، فهناك الآن fallback محافظ مخصص لهذه الحالة فقط.
- **الملف المسؤول**:
  - `lib/wordToHTML/HeaderFooterDotLeader.dart` — مسؤولية واحدة: اكتشاف وبناء حالة `literal dot leader` في الهيدر/الفوتر
  - `lib/wordToHTML/Paragraph.dart` — يستدعي الـ resolver فقط، ويحافظ على padding/decoration ومسار الالتفاف العام
- **شروط التفعيل الحالية**:
  - الفقرة يجب أن تكون داخل `header/footer`
  - لا تعمل إذا وُجد `framePr`
  - لا تعمل إذا وُجد `w:br` صريح
  - لا تعمل إذا كانت الفقرة تستخدم `w:tab`
- **منطق العرض الحالي**:
  - لا نعتمد على `Row/Flexible` وحده ليملأ الفراغ، لأن هذا أدى إلى نتائج مضللة في بعض المحاولات
  - يتم قياس عرض النص في الطرفين أولًا
  - ثم تُرسم النقاط فقط داخل الفجوة المتبقية بين الطرفين
  - هذا أقرب لفكرة Word في هذه الحالة من مجرد تكرار نقاط كنص عادي
- **قاعدة الجهتين مهمة جدًا**:
  - في fallback الحالي، `run` الذي يأتي **قبل** النقاط يُعامل كطرف يمين
  - و`run` الذي يأتي **بعد** النقاط يُعامل كطرف يسار
  - هذا مهم خصوصًا في RTL، لأن بعض الفوترات كانت في XML على شكل: `dots` ثم `text`، واعتبار النص دائمًا في اليمين كان يقلب النتيجة مقارنةً بـ Word
- **إصلاح إضافي مرتبط بالهيدر/الفوتر**:
  - في `Paragraph.dart` يوجد منطق محافظ يمنع التفاف فقرات الهيدر/الفوتر العادية إلى سطر ثانٍ إذا لم يكن هناك `w:br` صريح ولم تكن الحالة `framePr`
  - لا توسّع هذا المنع بشكل أعمى، لأن بعض الهيدرز/الفوترات قد تكون متعددة الأسطر فعلًا
- **محاولات فاشلة تم التراجع عنها ويجب عدم إعادتها إلا بدليل XML واضح**:
  - توسيع عرض الهيدر/الفوتر من طبقة الشاشة مثل `WordPageScreen.dart`
  - فرض `stretch` عام في `SectPr.dart`
  - اعتبار المشكلة مجرد عدد نقاط أو `letterSpacing`
  - رسم النقاط أو توزيعها دون التأكد أولًا أن الفقرة صُنّفت أصلًا كحالة `literal dot leader`
- ابدأ دائمًا من XML الفعلي: هل الحالة `tab leader` حقيقي، أم `literal dots`, أم `PAGE field`, أم `framePr`, ثم اختر المسار المناسب بأقل نطاق ممكن

### 10.1) `w:ptab` في الهيدر/الفوتر ليس هو `w:tab`
- **الحالة المؤكدة**: بعض الهيدرز تحتوي داخل الفقرة نفسها على `w:ptab` مثل:
  - `w:ptab w:alignment="center" w:relativeTo="margin"`
  - ثم `w:ptab w:alignment="right" w:relativeTo="margin"`
  - ثم نص لاحق يجب أن يتموضع وفق هذه المناطق كما في Word
- **المرجع الصحيح**:
  - `17.3.3.23 ptab (Absolute Position Tab Character)`
  - هذا العنصر **يتجاهل** custom tab stops العادية من `w:tabs`
  - ويتموضع بالنسبة لما يحدده `alignment` و`relativeTo`
- **الجذر الحقيقي للمشكلة السابقة**:
  - التطبيق كان يدعم `w:tab` فقط
  - وكان يهمل `w:ptab` تمامًا، فيندمج النص كله داخل فقرة واحدة ويضيع معنى التموضع
  - ثم اتضح أيضًا أن تتابع `ptab center` ثم `ptab right` قبل النص التالي يعني أن **آخر `ptab` قبل النص** هو الذي يحدد موضع هذا النص
- **الإصلاح الحالي الصحيح**:
  - في `lib/wordToHTML/runT.dart`:
    - حفظ معلومات `w:ptab` في:
      - `hasPositionalTab`
      - `positionalTabAlignment`
      - `positionalTabRelativeTo`
  - في `lib/wordToHTML/PositionalTabLayout.dart`:
    - ملف مستقل لمسؤولية واحدة: تفسير وعرض segments الناتجة عن `w:ptab`
  - في `lib/wordToHTML/Paragraph.dart`:
    - يكتشف فقط أن الفقرة تحتوي `w:ptab`
    - ويقسم الـ runs إلى segments عند `ptab`
    - ويفوض العرض إلى `PositionalTabLayout`
- **قاعدة مهمة ثبتت من الحالة المؤكدة**:
  - في نمط header/footer الكلاسيكي `left / center / right`
  - النص **قبل أول `ptab`** يبقى في منطقة اليسار
  - والنص الذي يأتي بعد عدة `ptab` متتالية يتبع **آخر `ptab` قبله**
- **هل هذا ترقيع؟**
  - ليس hack بصريًا ولا تعديل بكسلات عشوائي
  - الجذر مبني على XML نفسه وعلى مرجع `ptab`
  - لكن التنفيذ الحالي **محدود النطاق عمدًا** للحالة المؤكدة:
    - `relativeTo="margin"`
    - محاذاة `left/center/right`
    - سياق الهيدر/الفوتر
  - لذلك لا تفترض أنه محرك كامل لكل أشكال `w:ptab` في WordprocessingML
- **ما يجب عدم فعله**:
  - لا تعالج هذه الحالة بإعادة استخدام مسار `w:tab` العادي
  - لا تحولها إلى `Spacer()` أو `Row(spaceBetween)` عام
  - لا تفترض أن اسم الـ style مثل `header` أو `a5` يكفي لتشخيصها؛ العبرة بوجود `w:ptab` فعليًا
  - لا تُسقط `ptab` الثاني لمجرد أنه متتالٍ؛ إذا كان آخر `ptab` قبل النص فهو مؤثر
- **خطوات التشخيص الصحيحة**:
  1. افحص هل العنصر في XML هو `w:ptab` أم `w:tab`
  2. افحص `alignment`
  3. افحص `relativeTo`
  4. افحص هل توجد عدة `ptab` متتالية قبل النص
  5. افحص موضع النص قبل أول `ptab` وموضع النص بعد آخر `ptab` بمقارنة Word

### 11) `VML textbox` overflow داخل الهيدر/الفوتر
- **الحالة المؤكدة**: بعض الهيدرز تأتي كأشكال VML مثل `v:roundrect` بارتفاع ثابت، وداخلها `v:textbox > w:txbxContent`.
- **الجذر الحقيقي للمشكلة**:
  - الخطأ الظاهر كان `RenderFlex overflowed by 2.5 pixels on the bottom`
  - سجل Flutter بيّن أن `Column ← RichTextBoxWidget` كان يستلم ارتفاعًا داخليًا أصغر من المتوقع
  - السبب لم يكن line-height العام، بل أن `BoxDecoration.border` في `VmlRendererWidget` كان يستهلك من مساحة الطفل، فتصغر مساحة `txbxContent`
- **الحل الصحيح الحالي**:
  - في `lib/WordToWidget/VmlRendererWidget.dart`
  - فصل تعبئة الشكل عن حدوده
  - الخلفية تبقى في `decoration`
  - والحد يرسم في `foregroundDecoration`
  - مع الإبقاء على `clipBehavior` للشكل عندما توجد تعبئة أو حدود، حتى لا نفقد قصّ `roundrect`
  - النتيجة: يبقى الحد مرسومًا بصريًا، لكن لا يعود يقلّص مساحة النص الداخلية
- **حالة مؤكدة إضافية**:
  - إذا اختفى محتوى textbox داخل VML/WPS مع أخطاء Flutter من نوع `RenderConstrainedOverflowBox object was given an infinite size` أو `Offset argument contained a NaN value`، فابدأ من قيود التخطيط لا من `PAGE field`.
  - في `lib/WordToWidget/VmlRendererWidget.dart` يجب ألا يستخدم `OverflowBox` داخل شكل VML قيمة `maxHeight: double.infinity`؛ Word يعرض textbox داخل صفحة محدودة، لذلك الحد البنيوي المحافظ هو ارتفاع الصفحة، مع fallback إلى ارتفاع الشكل.
- **لماذا هذا محافظ**:
  - التعديل محصور في أشكال VML التي تُرسم عبر `Container`
  - لا يغيّر `ParagraphStrutResolver`
  - لا يغيّر line-height العام للفقرات
  - لا يغيّر `RichTextBoxWidget` نفسه
  - لا يمس `VmlDiamondShapeWidget` ولا مسار `line` المرسوم بـ `CustomPaint`
- عند ظهور overflow صغير وثابت داخل `VML textbox`، افحص أولًا: هل مساحة الطفل انكمشت بسبب `border/padding` أو `inset` قبل العبث بمقاييس النص

### 12) خطوط VML المتقطعة (`dashstyle`) ونوع نهاية الخط (`endcap`)
- **المشكلة**: خطوط VML في الهيدر/الفوتر كانت تظهر كخط متصل صلب بدلًا من خط منقط كما في Word
- **الجذور الحقيقية**:
  1. `VmlShapeTypeResolver` لم يكن يتعرف على `o:spt="32"` (خط مستقيم) و`o:spt="20"` (وصلة مستقيمة)، فكان يسقط إلى `'shape'` ويدخل فرع `default` الذي يرسم Container عادي بدون CustomPaint
  2. `dashstyle` من `<v:stroke dashstyle="1 1">` لم يكن يُقرأ أصلًا من XML
  3. `StrokeCap.round` كان ثابتًا دائمًا، بينما الافتراضي في VML هو `flat` (= `StrokeCap.butt`)، والغطاء الدائري يمد كل قطعة بـ `strokeWidth/2` من كل جهة فيصغر الفراغ البصري
- **الملفات المسؤولة** (كل ذو مسؤولية واحدة):
  - `lib/Utils/VmlShapeTypeResolver.dart` — تحليل نوع شكل VML من `o:spt` أو اسم العنصر؛ يدعم الآن `spt=20,32` → `'line'`
  - `lib/Models/VmlShapeData.dart` — تخزين `strokeDashStyle` و`strokeEndCap` مع serialization
  - `lib/Utils/ImageParser.dart` — قراءة `dashstyle` و`endcap` من `<v:stroke>` الفرعي
  - `lib/WordToWidget/VmlDashPatternResolver.dart` — تحويل `dashstyle` الخام إلى أرقام `[dash, gap, …]` مع تعويض امتداد الغطاء (`_compensateForCap`)
  - `lib/WordToWidget/VmlStrokeCapResolver` (داخل `VmlDashPatternResolver.dart`) — تحويل `endcap` VML → `StrokeCap` Flutter (الافتراضي `butt`)
  - `lib/WordToWidget/VmlLinePainter.dart` — `CustomPainter` لرسم خطوط VML (متصل أو متقطع)
  - `lib/WordToWidget/VmlTextBoxInsetResolver.dart` — تحويل `inset` الخام إلى `EdgeInsets` (كان مُكدّسًا داخل `VmlRendererWidget`)
  - `lib/WordToWidget/VmlRendererWidget.dart` — تجميع الشكل فقط، يفوّض الرسم والتحليل للملفات أعلاه
- **الأنماط المدعومة**:
  - رقمية مثل `"1 1"` أو `"4 2 1 2"` (الوحدة = `strokeWidth`)
  - مسماة: `dash`/`shortdash`, `dot`/`shortdot`, `dashdot`
- **تعويض الغطاء**: عندما `endcap=round` أو `square`، يُقصّر طول القطعة ويُوسّع الفراغ ليعوّض امتداد الغطاء خارج حدود القطعة
- لا تعدّل هذا المسار إلا إذا كانت المشكلة مرتبطة مباشرة برسم خطوط VML

### 13) زخارف `header` الـ VML يجب ألا تعيد تعريف بداية متن الصفحة
- **المشكلة**: بعض الصفحات ذات الهيدر الزخرفي كانت تظهر فيها بداية المتن منخفضة أكثر من Word، فيبدو وكأن الهيدر "ارتفع" أو أخذ مساحة إضافية
- **الجذر الحقيقي**:
  - كان `WordPageScreen.getSectionMargins()` يستخدم `max(headerHeight, topMargin)` ثم يضيف أحيانًا `framePadding`
  - هذا يجعل زخارف الهيدر المبنية من `w:pict`/`VML` تؤثر في `top` الخاص بالمتن
  - بينما في Word بداية متن الصفحة يحددها `w:pgMar/@w:top`، أما الهيدر فهو story مستقل ولا يجوز أن يرفع متن الصفحة لمجرد أن زخارفه أطول أو ذات إزاحات سالبة
- **الحل الصحيح الحالي**:
  - في `lib/UI/WordPageScreen.dart`
  - إذا كان الهيدر من النوع الزخرفي المعتمد على `VML` (`hasVmlFrameInHeader(...) == true`) فالهامش العلوي الفعال للمتن يبقى `topMargin` فقط
  - ولا يطبّق في هذه الحالة لا `headerHeight` ولا heuristic `framePadding` الخاص بالصور الخلفية الكبيرة
- **لماذا هذا محافظ**:
  - التعديل لا يغيّر رسم الهيدر نفسه
  - لا يغيّر مواضع عناصر `VML`
  - لا يعبث بحسابات الصفحات العادية
  - يقتصر فقط على منع خلط story الهيدر بمساحة متن الصفحة
- **قاعدة مهمة**:
  - لا تستخدم قياس ارتفاع الهيدر لتحديد بداية المتن في الصفحات ذات الهيدر الزخرفي
  - ابدأ أولًا من XML: هل الحالة `header` زخرفي مستقل، أم صورة/عنصر داخل متن الصفحة نفسه؟
- **محاولة مضللة يجب الحذر منها**:
  - إذا ظهر فرق عمودي قرب أعلى الصفحة، فلا تفترض مباشرة أن `headerMargin` أو `getHeaderHeight()` يجب زيادتهما
  - قد يكون العكس هو الصحيح: نحن نضيف تأثير الهيدر إلى المتن بينما Word لا يفعل ذلك في هذه الحالة

### 14) `VML picture` قد يُخطئ تحليله كـ `shape` رغم أن XML يحدد `o:spt="75"`
- **الحالة المؤكدة**: غلاف كتاب كامل الصفحة داخل `w:pict > v:shape > v:imagedata` ظهر مع شريط أبيض علوي/سفلي رغم أن الصورة الأصلية نفسها سليمة.
- **الجذر الحقيقي**:
  - العنصر في XML كان `v:shape type="#_x0000_t75"` و`v:shapetype ... o:spt="75"`
  - هذا يعني في VML أنه `picture`
  - لكن `VmlShapeTypeResolver` كان يعتمد على `getAttribute('spt', namespace: office)` فقط
  - في هذه الحالة فشل lookup المقيّد بالـ namespace، فعاد النوع إلى `'shape'`
  - بعد هذا الخطأ تبدأ آثار مضللة لاحقة: قد يدخل الرسم مسارًا عامًا لا يفهم أنها صورة VML، أو يُطبَّق عليها `contain` بدل السلوك المتوقع، فتظهر فراغات بيضاء توهم بأن المشكلة في التموضع أو الهوامش
- **الحل الصحيح الحالي**:
  - في `lib/Utils/VmlShapeTypeResolver.dart`
  - قراءة `spt` بالاسم المحلي `attribute.name.local == 'spt'` بدل الاعتماد على namespace lookup فقط
  - مع fallback محافظ: إذا تعذر حل `shapetype` لكن الشكل نفسه يحتوي `v:imagedata` فالتصنيف يكون `picture` لا `shape`
  - وفي `lib/WordToWidget/VmlRendererWidget.dart`: إذا كان `shapeType == 'picture'` فترسم الصورة بـ `BoxFit.fill` داخل مستطيل الشكل، لأن هذا الشكل في Word يمثل مستطيلاً صوريًا لا حاوية تحتفظ بنسبة أبعاد الـ bitmap
- **لماذا هذا ليس ترقيعًا**:
  - التعديل يقع في طبقة التحليل الدلالي للـ XML نفسها، لا في طبقة الرسم
  - والجزء الخاص بـ `BoxFit.fill` ليس heuristic منفصلًا، بل نتيجة مباشرة لأن shape حُلِّل صحيحًا على أنه `picture`
  - لا يغير الهوامش، ولا يضيف heuristics بصرية، ولا يخص هذا الكتاب وحده
  - `v:imagedata` في VML هو الدليل البنيوي على أننا أمام شكل صوري، لا textbox ولا line
- **ما يجب عدم فعله في هذه الحالة**:
  - لا تبدأ بتعديل `WordPageScreen` أو هوامش الصفحة
  - لا تفرض `BoxFit.fill` عامًا على كل VML
  - لكن لا تُبقِ `VML picture` على `contain` بعد تصنيفه الصحيح، لأن ذلك يعيد الفراغات البيضاء المصطنعة
  - لا تضف استثناءات رسم في `ImageToWidget` لمجرد إصلاح غلاف واحد
  - لا تعتمد على cache migration كحل أساسي إذا كان parser نفسه ما زال يخطئ على XML الجديد
- **خطوات التشخيص الصحيحة**:
  1. افحص `v:shape/@type` و`v:shapetype/@o:spt`
  2. تحقق هل يوجد `v:imagedata`
  3. تأكد ما الذي خزنه التطبيق في `shapeType`
  4. إذا كان المخزن `'shape'` مع وجود `o:spt="75"` أو `v:imagedata`، فالمشكلة في resolver لا في layout

### 15) صور `VML` قد ترث `filled/stroked` من `v:shapetype` لا من `v:shape`
- **الحالة المؤكدة**: زخارف/صور صغيرة في `footer` ظهرت حولها حدود رمادية أو ملوّنة، مع أن ملف الصورة نفسه نظيف ولا يحتوي أي إطار.
- **الجذر الحقيقي**:
  - في XML كانت الصور على شكل `v:shape type="#_x0000_t75"` مع `v:imagedata`
  - عنصر `v:shapetype` المرجعي كان يحمل `filled="f"` و`stroked="f"`
  - لكن `v:shape` نفسه لم يكرر هاتين الخاصيتين
  - وفي بعض الملفات لا يكون `v:shapetype` داخل `w:pict` نفسه، بل في `w:pict` سابق داخل الـ story نفسه (`header/footer/body`)
  - إذا اكتفى parser بقراءة `filled/stroked` من `v:shape` فقط، فستبقى القيم الافتراضية في `VmlShapeData` (`isFilled=true`, `isStroked=true`)
  - وعندها يرسم `VmlRendererWidget` حدودًا/تعبئة غير موجودة في Word
- **الحل الصحيح الحالي**:
  - في `lib/Utils/ImageParser.dart`
  - عند تحليل `v:shape`، إذا غابت `filled` أو `stroked` على العنصر نفسه، نحاول توريثهما من `v:shapetype` المشار إليه عبر `type="#..."`
  - إذا كانت القيمة الموروثة `f/false`، نضبط `isFilled` أو `isStroked` وفقًا لذلك قبل الوصول إلى طبقة الرسم
- **لماذا هذا ليس ترقيعًا**:
  - لأن المشكلة ليست في `Container` ولا في `Border.all`
  - بل في أن التطبيق كان يخترع دلالة بصرية لم يطلبها XML أصلًا
  - الإصلاح يبقى في طبقة التحليل الدلالي لـ VML قبل الرسم
- **ما يجب عدم فعله**:
  - لا تعالج هذه الحالة بإخفاء border في `VmlRendererWidget` بشكل عام
  - لا تفترض أن الإطار جزء من الـ bitmap قبل فحص `word/media/*`
  - لا تغيّر القيم الافتراضية العامة أو منطق كل الأشكال بسبب حالة footer واحدة
- **خطوات التشخيص الصحيحة**:
  1. افحص `v:shape` والصورة المشار إليها في `v:imagedata`
  2. افحص `v:shapetype` المرجعي نفسه، خصوصًا `filled` و`stroked`
  3. لا تفترض أن `v:shapetype` سيكون sibling مباشرًا؛ قد يلزم البحث داخل الـ story الحالي كله
  4. إذا كان `v:shapetype` يقول `stroked="f"` لكن التطبيق يرسم إطارًا، فالمشكلة في توريث خصائص VML لا في ملف الصورة

### 16) أشكال `wsp` في الهيدر/الفوتر قد ترسم حدودًا وهمية إذا فُصل فرع DrawingML عن fallback الـ `VML`
- **الحالة المؤكدة**: في هيدر يحوي صندوقًا نصيًا وصندوقًا/زخرفة حول عبارة مثل `الأعمال الكاملة` ظهرت حدود رمادية/سوداء في التطبيق، بينما Word لا يرسم أي حدود حول هذه العناصر.
- **الجذر الحقيقي**:
  - الـ XML كان يستخدم `mc:AlternateContent`
  - الفرع الحديث (`mc:Choice`) يحوي `wps:wsp`
  - والفرع البديل (`mc:Fallback`) يحوي `w:pict`/`VML` لنفس الشكل
  - في الحالات المؤكدة كان `wps:spPr` يصرّح:
    - `a:noFill`
    - وأحيانًا `a:ln > a:noFill`
  - كما أن fallback الـ `VML` كان يصرّح أيضًا `filled="f"` و`stroked="f"`
  - المشكلة كانت من مسارين:
    - مسار `prstGeom` كان يقرأ `wsp` فقط، وإذا غاب `a:ln` لم يكن يستفيد من fallback المقابل
    - ومسار `custGeom` كان قد يختلق `stroke` أسود افتراضيًا عند غياب اللون، حتى لو كان الـ XML يصرّح بنيويًا بأنه `noFill/noLine`
- **الحل الصحيح الحالي**:
  - ملف جديد: `lib/Utils/WpsShapeStyleResolver.dart`
  - مسؤوليته الوحيدة: استخراج دلالة الشكل البصرية من `wps:spPr` أولًا، ثم الاستعانة بـ fallback الـ `VML` الموافق داخل `mc:AlternateContent` فقط عند الحاجة
  - تم توصيله بـ:
    - `lib/Utils/WpsPresetShapeParser.dart` لمسار `a:prstGeom`
    - `lib/Utils/ImageParser.dart` لمسار `a:custGeom`
  - القواعد الحالية:
    - `a:noFill` تعني لا تعبئة
    - `a:ln > a:noFill` تعني لا حد
    - إذا لم يكرّر فرع `wsp` راية `filled/stroked` لكن fallback المقابل يصرّح `f/false`، نأخذ هذه الدلالة لأنها تخص **نفس الشكل** داخل `AlternateContent`
    - لا نولّد `stroke` أسود افتراضيًا إلا إذا غاب كل تصريح بنيوي عن `noFill/noLine` في فرع `wsp` وfallback معًا
- **المرجع الذي بُني عليه الحل**:
  - `wsp` داخل WordprocessingML يأتي في `AlternateContent/Choice` و`w:pict` كـ `Fallback` لنفس الشكل:
    - Microsoft Learn: `DrawingML Shapes in WordprocessingML`
  - `a:noFill` هو عنصر DrawingML صريح يمثل `NoFill`
  - وفي VML فإن `stroked` و`filled` يحددان هل يُرسم الحد أو التعبئة أصلًا
- **لماذا هذا ليس ترقيعًا**:
  - لم نخفِ الحدود من طبقة Flutter ولا من `WordPageScreen`
  - ولم نضع استثناء باسم شكل أو كتاب
  - بل أصلحنا تفسير البنية الدلالية للشكل نفسه عبر فرعي `AlternateContent`
  - الربط بين `wsp` وfallback الـ `VML` هنا ليس تخمينًا بصريًا، بل مبني على طبيعة `mc:AlternateContent` نفسها
- **ما يجب عدم فعله**:
  - لا تضف `Border.none` أو `strokeColor = null` في طبقة العرض العامة لمجرد أن شكلاً واحدًا يبدو مزعجًا
  - لا تعتبر غياب `a:ln` في `wsp` دليلاً كافيًا وحده على وجود حد افتراضي إذا كان fallback المقابل يقول `stroked="f"`
  - لا تُعِد fallback `vectorStrokeColor = black` بشكل أعمى في `custGeom`
  - لا تتجاهل فرع `mc:Fallback` عند تشخيص مشاكل `wsp` في Word headers/footers
- **خطوات التشخيص الصحيحة**:
  1. افحص هل العنصر داخل `mc:AlternateContent`
  2. افحص `wps:spPr`:
     - هل يوجد `a:noFill`؟
     - هل يوجد `a:ln`؟ وهل داخله `a:noFill`؟
  3. افحص fallback المقابل:
     - هل الشكل `v:shape` أو `v:rect` يحمل `filled="f"` أو `stroked="f"`؟
  4. إذا كان Word لا يرسم حدًا والتطبيق يرسمه، فابدأ من resolver الخاص بـ `wsp/VML` قبل أي تعديل في layout أو paint

### 17) تبديل أرقام `PAGE field` يجب أن يبقى محصورًا في النص المعروض لا في أكواد الرموز
- **الحالة المؤكدة**: ميزة التبديل بين الأرقام العربية والإنجليزية كانت تعمل في أغلب الكتب، لكن سقطت في بعض حالات أرقام الصفحات داخل TextBox/field-result، مع وجود خطر كبير إذا امتد التبديل إلى أكواد رموز مثل `F072` الخاصة بـ `w:sym`.
- **القاعدة الصحيحة**:
  - لا يجوز تبديل الأرقام داخل XML الخام
  - ولا داخل `w:char` أو أسماء glyph/fonts
  - بل فقط داخل **نتيجة `PAGE field` بعد أن تصبح نصًا معروضًا**
- **الحل الصحيح الحالي**:
  - ملف مستقل: `lib/wordToHTML/PageFieldDisplayNumeralResolver.dart`
  - مسؤوليته الوحيدة: تقرير ما إذا كان النص الحالي هو نتيجة `PAGE field` قابلة لتبديل الأرقام، مع حماية الحالات التي يكون فيها النص جزءًا من ترميز glyph/symbol
  - تم توصيله بالمسارات التي كانت تعرض PAGE fallback كنص مسطح:
    - `lib/wordToHTML/Paragraph.dart`
    - `lib/WordToWidget/ImageToWidget.dart`
- **لماذا هذا ليس ترقيعًا**:
  - لأنه لا يعتمد على اسم كتاب أو قيمة رقم بعينها
  - ولا يبدّل كل ما يشبه الأرقام عشوائيًا
  - بل يميّز بين **field-result display text** وبين **بيانات ترميز الخط/الرمز**
- **ما يجب عدم فعله**:
  - لا تطبّق تحويل الأرقام على `w:sym`
  - لا تطبّقه على `w:char="F072"` أو ما شابهه
  - لا تفترض أن أي أرقام داخل textbox هي رقم صفحة؛ ابدأ من XML/field context

### 18) فوترات `wp:anchor` قد تختفي إذا فُسِّر `relativeFrom="margin"` كأنه `page`
- **الحالة المؤكدة**: بعض أرقام الصفحات في الفوتر لم تكن تظهر أصلًا، رغم أن Word يعرضها أسفل الصفحة، لأن العنصر كان عائمًا (`wp:anchor`) داخل story الفوتر.
- **الجذر الحقيقي**:
  - `wp:positionV/@relativeFrom` لم يكن دائمًا `page`
  - الحالة المؤكدة كانت `relativeFrom="margin"`
  - التطبيق كان يعامل `posOffset` وكأنه محسوب من حافة الصفحة دائمًا، فيسقط العنصر خارج حاوية الفوتر
- **المرجع الصحيح**:
  - قيم `VerticalRelativePositionValues`
  - وشرح `VerticalPosition.RelativeFrom`
  - `margin` تعني Page Margin لا Page Edge
- **الحل الصحيح الحالي**:
  - ملف مستقل: `lib/wordToHTML/FooterFloatingPositionResolver.dart`
  - مسؤوليته الوحيدة: تحويل الإحداثي الرأسي للعناصر العائمة في الفوتر من فضاء الصفحة/الهوامش إلى إحداثي محلي داخل حاوية الفوتر
  - يستخدم الآن من `lib/wordToHTML/Paragraph.dart` بدل إبقاء هذه الحسابات داخله
- **حدود التعديل**:
  - محصور في عناصر **الفوتر العائمة** فقط
  - لا يغيّر الهوامش العامة
  - لا يغيّر `header` ولا العناصر inline
- **ما يجب عدم فعله**:
  - لا تبدأ بتعديل `footerStoryYOffset` أو هوامش الصفحة إذا كانت المشكلة في عنصر عائم واحد
  - افحص أولًا `relativeFromV` ومرجعه الحقيقي في XML

### 19) صناديق نص `wps:wsp` في الفوتر قد تحتاج `wps:bodyPr` و`a:noAutofit` و`w:pBdr` معًا
- **الحالة المؤكدة**: بعد ظهور رقم الصفحة في الفوتر بقي:
  - `RenderFlex overflow` صغير داخل textbox
  - ثم اتضح أيضًا أن هناك خطًا صغيرًا فوق رقم الصفحة في Word لكنه غائب في التطبيق
- **الجذور الحقيقية كانت متعددة**:
  1. التطبيق كان يقرأ textbox وكأنه VML-only، بينما المصدر الفعلي `wps:wsp`
  2. Insets الصحيحة للنص ليست دائمًا من `v:textbox inset`، بل قد تكون من `wps:bodyPr lIns/tIns/rIns/bIns`
  3. بعض الحالات تصرّح `a:noAutofit`، أي إن Word لا يحشر النص داخل الصندوق بتصغيره
  4. الخط الصغير فوق رقم الصفحة لم يكن حد الشكل، بل `w:txbxContent > w:p > w:pPr > w:pBdr > w:top`
- **الحل الصحيح الحالي**:
  - `lib/Utils/WpsBodyPropertiesParser.dart`
    - مسؤولية واحدة: قراءة `wps:bodyPr` واستخراج insets من EMU إلى logical px
    - ويكشف أيضًا `a:noAutofit`
  - `lib/WordToWidget/ShapeTextBoxInsetResolver.dart`
    - يفضّل قيم DrawingML (`wps:bodyPr`) ثم يعود فقط عند الحاجة إلى `v:textbox inset`
  - `lib/WordToWidget/VmlTextBoxInsetResolver.dart`
    - يحلل inset الخام محافظًا حتى مع قيم فيها خانات فارغة مثل `,0,,0`
  - `lib/WordToWidget/VmlRendererWidget.dart`
    - إذا كانت الحالة `textNoAutofit=true` يعرض المحتوى عبر `OverflowBox` محاذى للأعلى بدل forcing flex ضيق يخالف معنى `noAutofit`
  - `lib/WordToWidget/RichTextBoxWidget.dart`
    - لم يعد يكبت `w:pBdr` الخاص بفقرات `txbxContent` لأن هذا الحد قد يكون جزءًا من المحتوى الفعلي مثل الخط فوق رقم الصفحة
  - `lib/Models/VmlShapeData.dart`
    - يخزّن الآن:
      - `textBoxInsetPx`
      - `textNoAutofit`
- **لماذا هذا ليس ترقيعًا**:
  - لم نخفِ overflow بتصغير الخط أو line-height العام
  - ولم نرسم الخط فوق الرقم يدويًا
  - بل أعدنا للتطبيق قراءة دلالات XML الصحيحة من:
    - `wps:bodyPr`
    - `a:noAutofit`
    - `w:pBdr`
- **قاعدة مهمة**:
  - إذا كان textbox من نوع `wps:wsp` فلا تجعل `v:textbox inset` هو المصدر الأول للحقيقة
  - وإذا كان Word يرسم خطًا صغيرًا داخل textbox، فتحقق أولًا هل هو `w:pBdr` قبل أن تظنه stroke للشكل
- **ما يجب عدم فعله**:
  - لا تبدأ بتقليص line-height العام للفقرات
  - لا تكبت حدود فقرات `txbxContent` بشكل أعمى
  - لا تعالج overflow المتبقي بإزاحة بصرية ثابتة قبل فحص `bodyPr/noAutofit`

### 20) فهرس `w:fldChar` يجب أن يُعامل مثل فهرس `w:sdt` لتقسيم الصفحات
- **الحالة المؤكدة**: كتاب "روضة الناظر" فهرسه يظهر في صفحة واحدة في التطبيق بينما Word يعرضه على عدة صفحات
- **الجذر الحقيقي**:
  - Word يمكنه تمثيل الفهرس بطريقتين:
    1. `w:sdt` (Structured Document Tag) — يُعالجه `XmlParagraphExtractor.getIndexParagrphXmls()` ويضبط `isSdtRow="True"` على كل فقرة
    2. `w:fldChar` — حقل يبدأ بـ `fldCharType="begin"` مع `instrText` يحتوي "TOC"، وينتهي بـ `fldCharType="end"` على المستوى الأعمق
  - هذا الكتاب استخدم الطريقة الثانية، فلم تُضبط `isSdtRow` على فقرات الفهرس
  - وبالتالي `TocPageInjector` لم يعالجها ولم تُحقن علامات `{{PG:X}}` عند `w:lastRenderedPageBreak`
- **الحل الصحيح الحالي**:
  - ملف مستقل: `lib/Utils/FldCharTocMarker.dart`
  - مسؤوليته الوحيدة: كشف فقرات الفهرس المعرفة بـ `w:fldChar` ووضع `isSdtRow="True"` و`isLastPageLine="true"` عليها
  - يتتبع عمق الحقول المتداخلة (`fieldDepth`) لأن كل مدخل TOC يحتوي PAGEREF داخلي (له begin/end خاص)، فلا نخرج من الفهرس إلا عندما يعود العمق لـ 0
  - يُستدعى من `XmlParagraphExtractor.getAllXmlParagraphs()` بعد بناء `allPs`
  - يتخطى الفقرات المعلمة مسبقًا من مسار `w:sdt` (لا تعديل مزدوج)
- **لماذا هذا ليس ترقيعًا**:
  - لأنه مبني على بنية حقل TOC في OOXML نفسه
  - ولا يخص كتابًا واحدًا، بل كل كتب `w:fldChar`-based TOC
  - ولا يعبث بالـ XML أو بالنص أو بالتطبيع
  - ويعيد استخدام نفس آلية `TocPageInjector` و`_groupParagraphsByPage` بدون تعديلها
- **ما يجب عدم فعله**:
  - لا تعالج المشكلة بفرض عدد صفحات ثابت للفهرس
  - لا تضف `isSdtRow` على كل فقرة تحوي `w:hyperlink`؛ العبرة بوجود حقل TOC فعلي
  - لا تتجاهل تداخل الحقول؛ PAGEREF داخل TOC له begin/end خاص
  - لا تعدّل `TocPageInjector` أو `WordUtils` لهذه المشكلة؛ التعديل في طبقة الاستخراج فقط
- **خطوات التشخيص الصحيحة**:
  1. افحص هل الفهرس داخل `w:sdt` أم `w:fldChar`
  2. إذا كان `w:fldChar`، تحقق هل `isSdtRow` مضبوط على فقرات الفهرس
  3. تحقق هل `w:lastRenderedPageBreak` موجود في XML عند حدود الصفحات
  4. إذا كانت العلامات مضبوطة والـ pageBreaks موجودة، فالمشكلة في مسار آخر غير الاستخراج

### 21) الصفحة التي تبدأ بصورة قد لا تحمل `w:lastRenderedPageBreak`
- **الحالة المؤكدة**: في كتاب `15xشذرات2` كان Word يعرض صفحة نصية ثم صفحة جديدة تبدأ بصورة وتعليق، بينما التطبيق دمج الصفحتين لأن XML المعالج لم يحتوِ marker مثل `{{PG:14}}` عند بداية فقرة الصورة.
- **الجذر الحقيقي**:
  - التقسيم العام كان صحيحًا، وكانت مراسي الصفحات اللاحقة مثل `TheLibraryPage_15` موجودة.
  - الفقرة التي بدأت الصفحة المفقودة كانت تحتوي `w:pict`/`w:drawing`.
  - لم يظهر `w:lastRenderedPageBreak` نصي قبل الصورة، لذلك لم تُحقن علامة الصفحة بين `TheLibraryPage_13` و`TheLibraryPage_15`.
- **الحل الصحيح الحالي**:
  - في `scripts/pageRender.py` توجد معالجة محافظة عند انتقال مرساة الصفحة من رقم إلى رقم أعلى مع وجود صفحة مفقودة بينهما.
  - لا تُحقن علامة `{{PG:X}}` إلا إذا وُجدت فقرة body سابقة تحتوي `w:pict` أو `w:drawing`، ولا تحمل أصلًا علامة صفحة، ولم نصطدم بمرساة صفحة أخرى قبلها.
  - في `lib/Utils/WordUtils.dart` يوجد fallback ضيق للكاش/ XML المعالج سابقًا: عند وجود مرساة صفحة صافية تقفز صفحة واحدة فقط، يُنقل الذيل الذي يبدأ بفقرة صورة إلى الصفحة المفقودة.
- **لماذا هذا ليس ترقيعًا بصريًا**:
  - القرار لا يعتمد على إحداثيات الشاشة أو حجم الصورة أو رقم كتاب ثابت.
  - يعتمد على مراسي الصفحات التي أنتجها Word فعلًا (`TheLibraryPage_X`) وعلى بنية XML التي تقول إن بداية المحتوى فقرة صورة.
  - لا يغيّر تقسيم الصفحات الطبيعي عندما تكون علامات `{{PG:X}}` موجودة أو عندما لا توجد فجوة صريحة في مراسي الصفحات.
- **ما يجب عدم فعله**:
  - لا تضف فاصل صفحة قبل كل صورة.
  - لا تعتمد على كون أول فقرة في الصفحة التالية صورة وحده دون وجود فجوة في مراسي Word.
  - لا تعالجها بإزاحة بصرية أو بتغيير ارتفاع الصفحة/الهامش.
  - لا توسّع fallback ليعمل داخل الجداول أو عناصر `sdt` قبل وجود حالة XML مؤكدة؛ المسار الحالي مقصود به فقرات body المباشرة فقط.
- **خطوات التشخيص الصحيحة**:
  1. افحص هل هناك قفزة مثل `TheLibraryPage_13` ثم `TheLibraryPage_15` دون `{{PG:14}}`.
  2. افحص الفقرات السابقة للمرساة اللاحقة: هل أقرب بداية محتوى تحتوي `w:pict` أو `w:drawing`؟
  3. إذا لم توجد فجوة صريحة في مراسي Word، فلا تستخدم هذا المسار.
  4. بعد إصلاح التقسيم، عالج ظهور الصورة وتموضعها كمسألة مستقلة في VML/OOXML لا كجزء من pagination.

### 22) `v:group` داخل `w:pict` حاوية لا شكل واحد
- **الحالة المؤكدة**: في كتاب `15xشذرات2` كانت صفحة تبدأ بصورة داخل `w:pict > v:group`، وداخل المجموعة:
  - `v:shape type="#_x0000_t75"` مع `v:imagedata r:id="rId14"` = صورة VML.
  - `v:shape type="#_x0000_t202"` مع `v:textbox > w:txbxContent` = مربع نص VML.
- **الجذر الحقيقي**:
  - كان التطبيق يقرأ `w:txbxContent` من داخل أحد أطفال المجموعة ثم يضعه على المجموعة الأم.
  - بعد ذلك تُرسم المجموعة كـ textbox واحد، فتختفي الصورة الشقيقة ويختل موضع الصندوق.
- **الحل الصحيح الحالي**:
  - `lib/Utils/ImageParser.dart` يترك `v:group` كحاوية ويحوّل كل `v:shape` طفل إلى `ImageData` مستقل داخل `groupImages`.
  - `lib/Utils/VmlShapeDataParser.dart` مسؤولية واحدة: بناء `VmlShapeData` من XML الخاص بشكل VML واحد، بما في ذلك `shapetype`, stroke/fill/shadow/arc defaults.
  - `lib/WordToWidget/ImageToWidget.dart` يعطي `isGroup` أولوية قبل `vmlShapeData` حتى لا تُرسم المجموعة كأنها شكل مفرد.
  - إذا كانت `v:group` نفسها لا تحتوي `position:absolute`، تُعلّم بـ `isInlineVmlGroup` لأنها حاوية سطرية/مرتبطة بالـ line/char، بينما تبقى إحداثيات الأطفال داخل `coordsize`.
  - `lib/wordToHTML/Paragraph.dart` لا يطبق `firstLineIndent` ومحاذاة RTL على فقرة لا تحتوي إلا `inline VML group`، حتى لا تتحرك الحاوية أفقياً كأنها نص عربي.
- **ملاحظة عن `VML textbox overflow`**:
  - بعض صناديق VML ثابتة الارتفاع وقد يقص Word آخر سطر قليلًا.
  - في `VmlRendererWidget` نترك `txbxContent` يأخذ ارتفاعه الطبيعي عبر `OverflowBox` في مسار VML textbox فقط، لكن مع حد أقصى finite مأخوذ من ارتفاع الصفحة؛ هذا مقصود حتى لا نخسر نصًا بسبب اختلاف بسيط في مقاييس الخط بين Word وFlutter، وفي الوقت نفسه لا نعطي Flutter قيد `double.infinity` داخل شكل متموضع.
  - لا توسع هذا السلوك إلى كل الفقرات أو كل textboxes قبل وجود دليل XML واضح.
- **لماذا هذا ليس ترقيعًا بصريًا**:
  - القرار مبني على بنية XML: `v:group` حاوية، و`v:shape` أطفال مستقلون، و`coordsize` نظام إحداثيات داخلي.
  - لا يعتمد على رقم صفحة أو مقدار إزاحة ثابت أو قياس لقطة الشاشة.
  - لا يمس الهوامش العامة ولا line-height ولا تقسيم الصفحات.
- **ما يجب عدم فعله**:
  - لا تضع `txbxContent` الخاص بطفل على المجموعة الأم.
  - لا تفترض أن كل `w:pict` صورة واحدة؛ قد يكون مجموعة، textbox، line، أو picture shape.
  - لا تضف `position:absolute` للمجموعة إذا لم يصرّح XML بذلك.
  - لا تعالج فرق الموضع بتعديل بكسلات ثابتة؛ ابدأ من `style`, `coordsize`, `coordorigin`, و`wrap/anchorx/anchory`.
- **خطوات التشخيص الصحيحة**:
  1. افحص هل العنصر `v:group` أم `v:shape` مفرد.
  2. إن كان مجموعة، افحص كل طفل: هل هو `picture` عبر `o:spt=75` أو `v:imagedata`، أم `textbox` عبر `o:spt=202` و`w:txbxContent`.
  3. افحص هل المجموعة نفسها `position:absolute` أم inline/line-relative.
  4. حوّل إحداثيات الأطفال من `coordsize/coordorigin` إلى أبعاد المجموعة، ولا تخلطها مع إحداثيات الصفحة.

### 23) صور `wp:anchor` الكبيرة بالنسبة إلى `margin`
- **الحالة المؤكدة**: في كتاب `ex10_50p` ظهرت صورة غلاف DrawingML داخل `w:drawing > wp:anchor` أعلى من Word، مع XML مثل:
  - `wp:positionV relativeFrom="margin"` ومعه `wp:posOffset` سالب.
  - `wp:extent` يجعل الصورة أطول من مستطيل الهوامش الطباعية، لكنها ما زالت أصغر من الصفحة نفسها.
  - `wp:wrapSquare` يعني أنها صورة عائمة تؤثر في التفاف النص، وليست inline.
- **المرجع**:
  - `wp:positionV` يحدد قاعدة التموضع عبر `relativeFrom`.
  - `wp:posOffset` يقاس بالنسبة إلى الحافة العلوية اليسرى لقاعدة التموضع.
  - لذلك لا يجوز علاجها بتحريك بصري ثابت داخل الشاشة.
- **الحل الصحيح الحالي**:
  - `lib/WordToWidget/DrawingAnchorPositionResolver.dart` مسؤولية واحدة: تحويل معلومات `wp:anchor` العمودية إلى إحداثي صفحة.
  - `ImageToWidget.dart` يستخدم هذا resolver عند رسم الصور العائمة.
  - `WordPage.computeFlowClearance()` يستخدم resolver نفسه حتى يكون فراغ التفاف النص متسقًا مع موضع الصورة المرئي.
- **ملاحظة Word مهمة**:
  - عندما تكون الصورة `margin`-relative وأطول من منطقة الهوامش لكنها ما زالت تناسب الصفحة، لا تُترك لتُقص أعلى الصفحة بسبب `posOffset` السالب؛ يحافظ Word عليها داخل حدود الصفحة. عالجنا هذا كحالة بنيوية محددة لا كإزاحة ثابتة.
- **ما يجب عدم فعله**:
  - لا تعدل `topMargin` العام أو `WordPageScreen.getSectionMargins()` لهذه الحالة.
  - لا تضف إزاحة بكسلات ثابتة للصورة.
  - لا تطبق هذا السلوك على الصور التي تتجاوز ارتفاع الصفحة، ولا على الصور `inline`، ولا على `wrapNone` بلا دليل XML.
  - إذا ظهرت مشكلة مشابهة، ابدأ من `wp:positionV`, `relativeFrom`, `posOffset`, `wp:extent`, و`wrap*`.

## كيف يعمل التطبيق باختصار

1. يقرأ XML الخاص بالمستند
2. يُقسَّم إلى صفحات وفقرات وruns
  3. كل `Paragraph` تحلل:
   - `pPr`
   - `rPr`
   - runs
   - numbering
   - footnotes
   - hyperlinks
   - images
4. ثم يتحول ذلك إلى `InlineSpan`/`Widget` داخل Flutter
5. كثير من المشاكل تظهر بسبب الفروقات بين منطق WordprocessingML وطريقة Flutter في layout/BiDi/strut/widgets

## منهجية العمل

- لا تبدأ بالـ CSS أو بالمظهر أو بتقليل/زيادة بكسلات
- ابدأ من XML الفعلي للمشكلة
- افحص هل السلوك قادم من:
  - `paragraph properties`
  - `run properties`
  - `style inheritance`
  - `section settings`
  - `field code`
  - `numbering`
  - `footnotes`
  - `frame/layout behavior`
- عدّل بأقل نطاق ممكن
- إذا كان هناك منطق جديد كبير، انقله إلى ملف مستقل بدل تكديسه داخل `Paragraph.dart`
- لا تكثر من التعديلات الواسعة في الملفات المركزية إلا عند الضرورة
- اجعل أي تجربة جديدة قابلة للتراجع بسهولة
- ابدأ دائمًا بمراجعة الملفات ذات الصلة بالمشكلة الجديدة فقط، مع إبقاء ما سبق إصلاحه مستقرًا

## ملاحظة مهمة من إصلاح سابق

- إذا ظهرت مشكلة في `header/footer` أو `sectPr` وكان Word يعرض العنصر بينما التطبيق لا يعرضه، فلا تفترض مباشرة أن الخلل في `SectPr.dart` أو في منطق العرض.
- تحقق أولًا من اتساق ملفات OOXML بعد مرحلة المعالجة، خصوصًا التوافق بين:
  - `word/document.xml`
  - `word/_rels/document.xml.rels`
- السبب الذي انكشف سابقًا كان أن `document.xml` صار يحمل `rId` جديدة داخل `headerReference/footerReference` بينما بقي `document.xml.rels` بالقيم القديمة، فصار التطبيق يقرأ `sectPr` صحيحًا لكن يحلّ المراجع إلى targets خاطئة.
- هذا النوع من الأعطال قد يبدو ظاهريًا كأنه:
  - `No footer found`
  - أو `No header found`
  - أو paths غير منطقية مثل ربط footer بـ `header.xml` أو ربط header بصورة
- قبل تعديل منطق الأقسام أو `pageInSection` أو even/odd selection، افحص هل المشكلة أصلها عدم تزامن بين XML الأساسي وملف العلاقات.
- في مثل هذه الحالات، أصلح مرحلة المعالجة أولًا، لا طبقة العرض.

## ملفات XML تجريبية مفيدة

- `D:\ImportantProjects\golden_shamela\test_page_xml.xml`
- `D:\ImportantProjects\golden_shamela\test_header_xml.xml`
- `D:\ImportantProjects\golden_shamela\test_footer_xml.xml`

## Paragraph.dart Split Map

- `lib/wordToHTML/Paragraph.dart` remains the orchestration layer for parsing a paragraph and building its visible widgets/spans.
- `lib/wordToHTML/ParagraphMembers.dart` is the internal state contract for the extracted mixins. Do not put behavior there; it exists only to avoid a Dart mixin cycle where mixins depend on `Paragraph` while `Paragraph` is composed from them.
- `lib/wordToHTML/ParagraphBorderSpec.dart` contains only the immutable paragraph-border data model used by `w:pBdr` grouping.
- `lib/wordToHTML/ParagraphDebugPrinter.dart` contains debug dump/file IO only; keep diagnostic output there instead of growing `Paragraph.dart`.
- `lib/wordToHTML/ParagraphTocNavigator.dart` contains TOC tap/bookmark navigation only; it must not change TOC layout or Word XML interpretation.
- `lib/wordToHTML/ParagraphXmlParsing.dart` contains the main `fromXml` flow; `ParagraphXmlParsingHelpers.dart` contains SDT/section/run grouping helpers.
- `lib/wordToHTML/ParagraphLayoutFlags.dart` contains tiny shared layout predicates used by multiple mixins.
- `lib/wordToHTML/ParagraphRendering.dart`, `ParagraphDecoration.dart`, `ParagraphTocRendering.dart`, `ParagraphFloatingImages.dart`, and `ParagraphInlineSpans.dart` split rendering, borders/shading, TOC row rendering, floating images, and text-span/line measurement.
- Prefer this pattern for future cleanup: extract a clearly bounded responsibility first, keep behavior unchanged, and avoid moving layout-sensitive XML math until there is visual evidence and a precise Word/OOXML reason.
