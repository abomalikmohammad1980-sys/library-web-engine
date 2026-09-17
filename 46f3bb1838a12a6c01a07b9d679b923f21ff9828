# حدود الصفحة في scene/paint

## الدليل

وجد corpus مقطعين ذوي `w:pgBorders`: `sample-jalsa27` بحد `single` مع
`display=notFirstPage` و`offsetFrom=page`، و`sample-tadris` بحد Word فني
`twistedLines1`. كان model وDOM يحفظان العقد، لكن scene/paint يسقطانها.

## القاعدة

يحل scene ظهور الإطار حسب ترتيب الصفحة داخل المقطع (`allPages/firstPage/
notFirstPage`) ويحفظ الأضلاع و`offsetFrom` و`zOrder` في `ScenePage`. لا يغير
الإطار مساحة المتن. عند `offsetFrom=text` تضاف هوامش النص إلى `w:space` لكل ضلع؛
وعند `page` تقاس المسافة من حافة الصفحة. يرسم HTML وCanvas الأنواع القابلة
للتمثيل المباشر `single/thick/dashed/dotted` أمام النص أو خلفه حسب zOrder.

حدود Word الفنية مثل `twistedLines1` تحتاج زخرفة/بلاطة خاصة غير موجودة في OOXML
كصورة قابلة للاستخراج. يحفظها scene دلاليًا لكنه لا يقربها إلى خط solid؛ لذلك
يبقى رسم حالة `sample-tadris` الفنية فجوة معلنة، بينما حالة `sample-jalsa27`
البسيطة مغلقة.

## الاختبار

يثبت synthetic أن `firstPage` يظهر في الأولى فقط، وأن offsetFrom/zOrder والأضلاع
تصل إلى المشهد دون تغيير عرض الفقرة. ويثبت corpus وجود مقطع واحد ذي حدود في كل
من `sample-jalsa27` و`sample-tadris` وبقاء بياناتهما.
