# سياسة WordPageMap للنشر — 2026-08-09

## الافتراضي الآمن

- كل build مصدره DOCX يحتاج reader artifact يحمل `sourceEdition.sha256` وخريطة
  `authoritative=true` من `microsoft-word-com`، وبصمة الخريطة تساوي بصمة نسخة
  DOCX نفسها.
- غياب الخريطة ينتج `authoritative_word_page_map_missing`، واختلاف المصدر ينتج
  `authoritative_word_page_map_source_mismatch`. كلاهما يمنع ready/publish؛ لا
  يهبط النظام صامتًا إلى تقدير المتصفح.
- حتى بعد اكتمال الخريطة، النشر العام fail-closed ما لم يوفر adapter الخادم
  موافقة مستقلة صريحة مرتبطة بالكتاب والمراجعة وبصمتي المصدر والخريطة.

## موافقة المعاينة التقديرية

`EstimatedPaginationConsentIntent` تخص `private-estimated-preview` فقط، وتحمل
principal/device/book/revision/source fingerprint ووقت الموافقة وintent/operation
id وexpected consent version. القرار CAS، يعيد replay للعملية نفسها، ويرفض إعادة
استعمال operation بمحتوى آخر، وتبديل المستخدم/الجهاز، والبصمة القديمة.

هذه الموافقة لا تحمل `authoritative` ولا `ready-for-fidelity`، ولا تسمح بالنشر
العام، ولا تولد تنبيهات متكررة داخل القارئ.

## موافقة النشر العام

`PublicDocxPublicationApproval` عقد منفصل بنطاق `public-publish`. يلزم تطابق
principal/book/revision/source fingerprint وWordPageMap fingerprint ووقت صالح.
المخططان JSON يرفضان الخصائص الزائدة. التخزين الفعلي يجب أن يجعل operation id
فريدًا ويطبق CAS؛ منفذ الخادم المفقود أو الموافقة المرفوضة يعني policy deny.

## أدلة الاختبار

- source-sync: missing/mismatch/matching authoritative map، stale fingerprint،
  CAS conflict، idempotent replay، operation reuse، principal substitution،
  وفصل public approval.
- source-sync-server: يمنع النشر الآلي مع منفذ موافقة مفقود، ويسمح فقط عندما
  يقر المنفذ تطابق المصدر الموثق.
