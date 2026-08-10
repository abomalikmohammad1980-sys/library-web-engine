# تسليم مسار مزامنة المصدر — 2026-08-08

## الحالة

المسار الداخلي S0–S8 مغلق ومختبر، مع الترحيلات forward-only من 0001 إلى 0011،
والمزامنة العادلة/backpressure، المصالحة بعد الانقطاع، حسم التعارض idempotent/CAS،
content scrub الدوري، عقود الأعمال المنطقية ونسخ المصدر immutable، وبوابة intake
الأمنية لـPDF/BOK/EPUB/text. لم يحدث نشر أو تغيير app/OOXML ضمن هذا المسار.

## requirement → evidence

| المتطلب | الدليل التنفيذي | دليل القبول |
|---|---|---|
| حفظ DOCX ومزامنته بلا فقد أو تكرار | `packages/source-sync` و`packages/source-sync-node` | robustness/daemon/outbox/long-outage/runtime-scrub tests |
| ضغط عكسي عادل وإنهاء bounded | scheduler/outbox/runtime config | backpressure وscheduler tests |
| تعارض بجهازين وقرارات CAS قابلة للإعادة | server conflict-resolution + D1 store + migration 0010 | server/Cloudflare conflict tests |
| أعمال منطقية ونسخ مصدر immutable | core/server/D1 source-editions + migration 0011 | source-editions وmigration-integrity/readiness tests |
| PDF/BOK/EPUB/text preflight آمن | `packages/source-sync/src/multi-format-intake.ts` | allow/quarantine/reject وZIP bomb/path tests |
| عدم drift في قاعدة البيانات | readiness ordered checksums والجداول المطلوبة | migration-integrity + readiness tests |
| حزمة companion قابلة للتثبيت والبدء البارد | package files/esbuild وverify-installability | pack/install/config/provision/remote audit |
| عدم تسريب أسرار/محتوى/مسارات في السجلات | log redaction وعقود audit | redaction/security sequence tests |

البوابة النهائية: 307 اختبارات ناجحة في 79 ملفًا، واختبار corpus COM اختياري
متجاوز؛ بناء الحزم الأربع أخضر. تشمل البوابة fuzz ثابت البذرة لحدود الصيغ
والحاويات، وreplay/CAS عبر DOCX/PDF/BOK/EPUB/text.

تسبق الخطوة الخارجية الآن بروفة محلية إلزامية عبر `staging:local`: تنفذ 0001–0011
مرتين على قواعد مؤقتة وتتحقق من backfill/triggers/readiness/health وsmoke جهازين.
نجاحها مثبت، لكنه لا يعادل D1/R2 staging بعيدة.

أُغلق كذلك تركيب WordPageMap الإنتاجي داخليًا: source edition DOCX → service-auth
Word map → reader artifact/manifest، مع HEAD readiness وفشل retryable يحفظ active
publication السابقة. بقي تشغيل COM الحقيقي والنشر من الأعمال الخارجية.

أضيف أيضًا عقد `quran-annotations` المشتق، exact/versioned/immutable، بلا نقل
corpus. يربط search بالأثر وبصمة corpus ربطًا ذريًا، ويبطل replay عند تغير المصدر
أو الإصدار أو البصمة. الدليل في
`docs/source-sync-quran-annotations-contract-2026-08-08.md`؛ لا detector أو نشر
أو corpus إنتاجي ضمن هذا الإنجاز.

أُغلقت فجوة partial-finalize: replay لمراجعة حُفظت قبل انقطاع الرد يصالح سجل
الرفع والحصة idempotently بدل ترك `reserved_bytes` عالقة أو إنشاء مراجعة أخرى.
وسجل التدقيق يصدر مرة واحدة فقط مع انتقال الحجز الأول، لا مع كل replay.
الدليل: `docs/source-sync-partial-finalize-reconciliation-2026-08-09.md`.

أُغلقت فجوة انقطاع إصدار رابط الرفع بعد نجاح `prepare`: يعاد الآن إصدار رابط
لنفس سجل الرفع والحجز فقط عند تطابق سلطة المصدر كاملة، وتُرفض محاولة تبديل
المصدر أو الجهاز أو البصمة. الدليل:
`docs/source-sync-grant-reissue-recovery-2026-08-09.md`. البوابة الحالية
325/325 في 79 ملفًا، مع اختبار COM اختياري متجاوز.

أُغلق تجاوز حصة التخزين عبر الحجر: يبقى الحجز pending حتى قرار المسؤول؛ allow
يلتزمه مرة واحدة، وreject/expiry يحرره. الدليل:
`docs/source-sync-quarantine-quota-lifecycle-2026-08-09.md`.
كما يفشل replay لحجز stale بلا upload مغلقًا، فلا يتحول فشل quota سابق إلى رفع
غير محتسب.
ويُرفض قرار الحجر pending قبل قراءة كائن R2 أو حساب بصمته مجددًا.

أُغلقت فجوة build outbox بعد حفظ المراجعة: replay يضمن idempotently وجود build
والوظائف الخمس، فلا يبقى مصدر محفوظ بلا pipeline بعد انقطاع جزئي. الدليل:
`docs/source-sync-build-outbox-reconciliation-2026-08-09.md`.

## ما بقي خارجيًا

الاستئناف يكون من القسم 7.1 في `docs/source-sync-pre-deployment-runbook.md` فقط
وبتفويض صريح: جهّز staging قابلة للمسح وD1 backup/clone وR2 وOIDC/PDF secrets،
اعرض ثم طبق migrations 0001–0011، طابق backfill والجداول/triggers، انشر Worker،
ثم تحقق `/health` و`/ready` قبل smoke بجهازين. لا تُفعّل ingestion لصيغة جديدة
حتى يكتمل adapter/parser sandbox الخاص بها؛ بوابة intake الحالية preflight وليست
parser أو وعدًا ببحث/عرض الصيغة.
