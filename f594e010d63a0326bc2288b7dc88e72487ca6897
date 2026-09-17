# DrawingML reflection and glow in scene paint

## الدليل المحلي والبصري

- `sample-masjid.docx` يحوي صورتين بـ`a:reflection`: مسافة
  `0.524934px` وبداية alpha ‏38%/30% إلى صفر.
- قياس Word COM وضع الصورة الأولى في الصفحة 13. صُدر PDF من Word ورُندرت
  الصفحة عبر Poppler؛ المرجع يظهر انعكاس الجدول واضحًا أسفل الصورة ومتلاشيًا
  تدريجيًا. الصورة الثانية مرتبطة بالفقرة 479/الصفحة 38.
- `sample-tadris.docx` يحوي أربعة أشكال wave بتوهج نصف قطره `14.6667px`
  وألوان `ED7D31` أو `4472C4` وalpha ‏40%.

كان model يحفظ القيم، لكن scene ينقل shadow/border فقط، فيسقط الانعكاس
والتوهج كاملين في Canvas وHTML.

## السلوك

- ينقل SceneAnchor `imageReflection` و`imageGlow` بالقيم المحلولة نفسها.
- Canvas يرسم التوهج كظل صفري الإزاحة، ويرسم الانعكاس على canvas وسيط مقلوب
  مع mask خطي من startOpacity إلى endOpacity؛ فلا يؤثر تركيب alpha في الصفحة.
- HTML يستخدم drop-shadow شفافًا، وصورة مقلوبة بـCSS mask متدرج. تنطبق
  الخصائص على الصور والأشكال بحسب مصدرها.

## الانحدار

اختبار corpus يثبت القيم الفعلية من masjid/tadris بعد وصولها إلى scene.
بوابة scene/paint المركزة 83/83، ومصفوفة Word الكاملة 336/336.
