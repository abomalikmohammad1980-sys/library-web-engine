# DrawingML shape gradient, stroke and shadow in scene

## الدليل الرسمي

يحمل الشكل `Teardrop 1` في Microsoft OfficeDev `SampleDoc.docx` هندسة
`teardrop`، وتدرجًا بثلاث وقفات، وحدًا أزرق بعرض 15twips، وظلًا سفليًا.
كان `ooxml-model` يحفظ هذه القيم، لكن scene ينقل لون الحشو والحد فقط؛ ثم يرسم
Canvas الشكل مستطيلًا بلون مصمت وحد ثابت، ولا يطبق HTML التدرج أو الظل.

## السلوك

- ينقل SceneAnchor `strokeW` و`gradient` و`adj` مع هندسة الشكل.
- يرسم Canvas مسار teardrop متجهيًا، وتدرج DrawingML الخطي، وعرض الحد والظل.
- يرسم HTML التدرج وعرض الحد والظل، ويستخدم هيئة teardrop قابلة للتحجيم.
- الخصائص نفسها متاحة لأطفال مجموعات الرسم؛ ولا يتغير مسار الصور أو chart.

## الانحدار

انحدار العينة الرسمية يثبت القيم الفعلية: الحد `5B9BD5/15twips`، والضبط
`1.30918`، والظل، والوقفات `FAFEFF → 559BDB → 3D78AE`. تمر كذلك مصفوفة
scene/paint وcorpus المحلية لضمان عدم تغيير الجداول ومربعات النص وVML.
