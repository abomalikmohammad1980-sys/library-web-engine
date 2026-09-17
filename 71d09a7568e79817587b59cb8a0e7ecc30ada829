# EMF/WMF payloads in scene paint

## الدليل المحلي

يحوي `corpus/books/sample-masjid.docx` أربعة وسائط EMF فعلية
(`image5/7/9/10.emf`)، كل منها 4,438,968 بايت. ويحوي كتاب «أُسس قوام
الشخصية الفاعلة.. شرح سورة الشرح» وسيط EMF آخر. كان DOM يحول metafile إلى
SVG/PNG/BMP، لكن scene paint ينشئ Blob من بايت EMF الخام بلا MIME قابل للعرض؛
فتظهر الصورة تالفة في Canvas وHTML رغم سلامة استخراج المرساة.

## السلوك

- يمر كل وسيط scene، بما في ذلك أطفال المجموعات، عبر `rasterPayload` الموثق
  نفسه قبل إنشاء Blob.
- PNG/JPEG/GIF/WebP/BMP/SVG تبقى بصيغتها، وEMF/WMF يتحول إلى payload متصفح
  وفق سجلاته الفعلية؛ النوع غير المدعوم يعاد `null` ولا يُرسل كصورة تالفة.
- يشترك Canvas وHTML في `paintImagePayload` كي لا يتباعد المساران.

## التحقق

انحدار corpus يثبت العلاقات الأربع في sample-masjid، وتحويل كل ملف فعلي إلى
PNG صحيح التوقيع. اختبارات DOM الاصطناعية تغطي EMF/WMF المتجه، DIB، التدرج
والنص المتقدم. صُدّر مرجع Word PDF مؤقت للعينة (10 صفحات) لتأكيد أن الوسائط
جزء من الرسم المرئي، دون تعديل DOCX أو corpus.
