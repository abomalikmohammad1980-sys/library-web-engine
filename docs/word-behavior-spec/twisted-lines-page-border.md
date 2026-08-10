# `twistedLines1` artistic page border

## الدليل

`corpus/books/sample-tadris.docx` يصرح على الجهات الأربع:

- `w:val="twistedLines1"`
- `w:sz="14"` = 35twips
- `w:space="15"` = 300twips
- `w:color="auto"`, و`offsetFrom="page"`

كان model/scene يحفظ الاسم والقياس، لكن Canvas يقبل قائمة حدود خطية فقط وHTML
يعيد `none`، بينما DOM يقرب كل فن إلى solid. صُدر PDF من Word ورُندرت الصفحات
1-3 عبر Poppler. الصفحتان 1 و3 تثبتان شريطًا كحليًا سميكًا بين خطين أسودين
رفيعين، مع عقدة مربعة متداخلة عند كل زاوية، وعلى بعد 15pt من حافة الورقة.
Word COM أكد تطبيق الحد على first وother pages؛ يطبق المحرك دلالة OOXML/COM.

## الدعم المحدود

- يكتشف العارض النوع فقط عندما تكون الجهات الأربع `twistedLines1`؛ لا يحول
  بقية أسماء ST_Border الفنية إلى الشكل نفسه.
- Canvas يرسم خطي الإطار الخارجي والداخلي، الشريط الكحلي، وأربع عقد زاوية.
- scene HTML وDOM ينشئان طبقة مستقلة بالنمط نفسه وعقدًا أربعًا؛ تبقى
  `offsetFrom/space/zOrder/display` من منطق الصفحة الحالي ولا تحجز المتن.
- الأنواع الفنية الأخرى تبقى معلّمة باسمها ولا تدعي مطابقة هذا الرسم.

## التحقق

انحدار corpus يثبت `data-word-art-border=twistedLines1` والعقد الأربع بدل solid.
مصفوفة الرسم المركزة 202/202، ومصفوفة Word الكاملة 337/337.
