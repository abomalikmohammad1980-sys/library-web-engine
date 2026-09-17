# ظل وحد الصورة في scene

يحفظ نموذج OOXML تأثيرات الصورة من `a:effectLst` و`a:ln`، لكن تحويله إلى
`SceneAnchor` كان يسقط `imageEffects`؛ لذلك اختفى الظل الأبيض/الأسود والحد
الظاهر في Word.

القاعدة:

- ينقل scene `shadow(x,y,blur,color,opacity)` و`border(width,color)` دون تحويل
  تخميني للقيم.
- Canvas يضبط shadow قبل رسم الصورة، مع احترام مسار قص `shapePrst`، ثم يرسم
  الحد على المسار نفسه.
- HTML يستخدم `drop-shadow` للصورة وborder، ويحافظ على border-radius للقص.

المثبت: صورة Eiffel البيضاوية في Microsoft OfficeDev SampleDoc؛ تحمل ظلًا
وحدًا بعرض/blur 6.6667px. الاختبار الاصطناعي يثبت بقاء الحقول في SceneAnchor.

