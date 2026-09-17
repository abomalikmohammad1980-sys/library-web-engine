# خطوط theme في `w:rFonts`

## الحالة المؤكدة

سمات `asciiTheme/hAnsiTheme/eastAsiaTheme/cstheme` تشير إلى `a:fontScheme` لا إلى
اسم خط حرفي. يجب حل major/minor لكل شريحة قبل أن يصل الرن إلى القياس والرسم.

## الدليل

- corpus يحوي 31,763 زوجًا من `asciiTheme=minorBidi` و`hAnsiTheme=minorBidi`،
  و263 `eastAsiaTheme=minorEastAsia`، و114 من كل من minorHAnsi و`cstheme=minorBidi`.
- كانت الأسماء الصريحة وحدها مقروءة؛ أي رن يعتمد على theme كان يسقط إلى خط البيئة.
- `fitText` و`snapToGrid` صفر في الكتب العشرة، لذلك لم ينفذ لهما سلوك مفترض.

## القاعدة

1. يستخرج theme خطوط latin/eastAsia/cs من majorFont وminorFont.
2. يحل رموز major/minor Ascii/HAnsi/EastAsia/Bidi إلى الاسم الفعلي.
3. تبقى الأسماء الصريحة أعلى أولوية من theme، وcs أعلى في قارئ corpus العربي.

## الاختبار

اختبار theme يثبت majorBidi وminorHAnsi، وانحدار النموذج يثبت اختيار خط cs theme
من docDefaults عندما لا يوجد اسم صريح.
