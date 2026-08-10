# موضع مراسي الرأس وحفظ مربعات نص VML المجمّعة

## الحالة المؤكدة

قد يضع Word عنوان الرأس ورقم الصفحة في مربعي نص عائمين داخل قصة الرأس، ويجعل
`wp:positionV@relativeFrom="topMargin"`. كما قد يحفظ رقم PAGE في صيغة VML
قديمة داخل `v:group/v:shape/v:textbox`.

## الدليل

- «من لابن زايد؟.docx» و«تهنئة ومؤازرة.docx»: عنوان الرأس له
  `relativeFrom="topMargin"` و`posOffset=332057EMU` (=523twips)، ورقم PAGE له
  محاذاة `center` في `topMargin`. هامش الصفحة العلوي 1440twips.
- عنوان «من لابن زايد؟» داخل `wps:txbx` يطلب `Aljazeera` بحجم 36 half-points
  (18pt)، لا خط المتن الافتراضي.
- `corpus/books/sample-jalsa27.docx`: تذييل واقعي يحوي `v:group + v:textbox`؛
  النموذج المستخرج يحفظ مربع PAGE بنص `26` وهندسة 525×720twips وإزاحة
  (802،15499) وحشو (144،72،144،72).

## القاعدة

1. مرجع `topMargin` هو مستطيل منطقة الهامش من حافة الورقة حتى بداية المتن؛
   لا تُضاف `marTop` إلى إزاحته. والمحاذاة center/top/bottom تحسب داخل هذه المنطقة.
   القاعدة نفسها تناظر `bottomMargin/leftMargin/rightMargin`.
2. خطوط قصص مربعات النص تُجمع وتُحمّل مثل خطوط المتن، بما فيها textBox المتداخل
   في رأس أو رسم. أسماء العائلات الفعلية مثل `Aljazeera` لا تُستبدل لمجرد اختلاف الشرطة.
3. ابن VML المجمّع الذي يحمل `w:txbxContent` يحتفظ بفقراته والحشو والمحاذاة
   والحشو اللوني والحد وسماكته، مع وراثة خصائص `v:shapetype` عند غيابها من الشكل.
4. عند غياب `a:solidFill/a:ln` المباشرين، يحل Word مظهر الشكل من
   `wps:style/a:fillRef,a:lnRef` عبر `theme1.xml/clrScheme`. أمّا `a:noFill`
   الصريح فيبقى أعلى أولوية. هذا هو الفرق بين عنوان الرأس الشفاف ومربع PAGE الأسود.

## الاختبار

- `packages/ooxml-dom/src/render.test.ts`: يثبت أن 523twips تنتج ≈34.87px من
  أعلى الورقة وأن الموضع قبل 96px (بداية متن 1440twips).
- `app/src/engine/dom_render.test.ts` و`scene.test.ts`: يثبتان جمع `Aljazeera`
  من textBox وربطه بملف الخط الحقيقي.
- `packages/ooxml-model/src/index.test.ts`: اختبار صناعي لخصائص VML المجمّع،
  واختبار corpus على `sample-jalsa27.docx` لقيم PAGE الفعلية، واختبار قراءة
  `clrScheme` وحل `fillRef/lnRef`.
