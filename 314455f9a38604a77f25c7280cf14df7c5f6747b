# مطابقة أوجه الخطوط المضمنة

## الحالة المؤكدة

عقد `embedRegular/embedBold/embedItalic/embedBoldItalic` لا تشير إلى نسخ متبادلة؛
كل ملف وجه مستقل ويجب تسجيله في `FontFace` بالـstyle والـweight المطابقين.

## الدليل

- الخطوط المضمنة الـ58 في corpus تتوزع إلى 40 Regular و16 Bold وItalic واحد
  وBoldItalic واحد.
- كان المسجل يضع الأوجه كلها `style=normal, weight=normal`، فيستبدل الوجه الغامق
  العادي أو يجعل المتصفح يصنع bold/italic اصطناعيين رغم وجود الملف الصحيح.

## القاعدة

يحفظ `openDocx` مع كل ملف البيانات المفكوكة ووجهه: Bold يساوي weight 700، وItalic
يساوي style italic، وBoldItalic يجمعهما. يستخدم `registerEmbeddedFonts` الوصف نفسه.

## الاختبار

انحدار كتاب «زهر الخمائل» يثبت استخراج 38 وجهًا ووجود weight 700 وitalic؛ ومجموعة
Word المشتركة تثبت استمرار الترصيف بعد تغيير عقد embeddedFonts.
