# خارطة قسم القرآن — الحالة المنفذة

- Q0: عقود corpus/search/resource/audio manifests، provenance/checksum/version والسياسات الوقفية منجزة.
- Q1: عميل Quranpedia محدود وقابل للاستئناف، عينة الفاتحة 7/7، وحزمة القرآن الكاملة المحلية مع manifest وفهرس بحث عربي؛ التنزيل الكامل أمر صريح خارج build ولا توضع الكتلة الضخمة في Git.
- Q2: حزم metadata للتفسير/الإعراب/التلاوات، وAudioCore عامة للقرآن والكتب الصوتية والمحاضرات، مع attribution ومراجع المصادر.
- Q3: delta/update/rollback وربط الموارد وإبطال المشتقات عند تغير corpus version.
- Q4: استعادة crash-safe لمؤشرات active/previous والتحقق من corpus/search الفعلي.
- Q5: قفل تثبيت/تراجع/إزالة عبر العمليات، timeout واستعادة القفل القديم.
- Q6: quota/free-space/LRU؛ active وprevious مثبتان، والخطة dry-run وموافقتها صريحة.
- Q7: إعادة قراءة المؤشرات تحت القفل قبل eviction والفشل المغلق عند فسادها.
- Q8: تنظيف crash-trash بخطة محدودة العمر والبصمة وإعادة التحقق.
- Q9: استئناف HTTP محكوم بـETag وRange/If-Range وContent-Range.
- Q10: التنزيل الجديد يقبل 200 فقط ويرفض 206 غير المطلوب.
- Q11: فشل ZIP/length/SHA يمسح الملف الجزئي ولا يعيد تدويره.
- Q12: فشل append الجزئي يمسح temp ويمنع تركيب bytes مختلطة.
- Q13: manifest حتمي لكل ملف، secret/path/symlink scan وحدود Cloudflare.
- Q14: ترويج وتراجع CAS لا يقبل مرشحًا غير موقع ويعيد التحقق من السابق.
- Q15: بوابة انجراف بعد كل بناء تربط candidate/current/previous وخرائط الكتب وإعداد Pages.

المتبقي الخارجي فقط: تشغيل تنزيل corpus الكبير المصرح به عند الحاجة، اختبار الشبكة/التخزين على الأجهزة الحقيقية، وحساب Cloudflare Preview/Production. لا يوجد ادعاء بنشر أو تنزيل جماعي داخل build.

