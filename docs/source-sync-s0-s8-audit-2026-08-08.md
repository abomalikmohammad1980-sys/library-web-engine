# تدقيق إغلاق S0–S8 لمزامنة مصدر Word — 2026-08-08

## منهج الحكم

هذا تدقيق قبول لا جرد أسماء. `internal complete` يعني أن المتطلب داخل المستودع
له تنفيذ واختبار آلي. `external-bound` يعني أن التنفيذ الداخلي مكتمل لكن الحكم
النهائي يحتاج موارد أو أسرارًا أو منصة خارج المستودع. لا توجد حالة `partial`
مخفية، ولا يثبت التقرير أن Worker أو D1/R2/PDF/OIDC نُشرت فعليًا.

## حكم المراحل

| المرحلة | الحكم | دليل التنفيذ | دليل القبول والمتبقي الخارجي |
|---|---|---|---|
| S0 العقود والحالات | internal complete | `packages/source-sync/src/contracts.ts`, `revision-state.ts`, `publication.ts` | اختبارات revision/publication/workflow تمنع حالة طرفية أو مشتقًا بلا revision/build. |
| S1 المجلد والمراقبة | external-bound | `node-managed-source-adapter.ts`, `source-sync-scheduler.ts`, `mapping.ts` | save/rename/delete/replace/startup/runtime scrub مختبرة؛ بقي Word/companion فعلي على Windows/macOS وتثبيت الخدمة. |
| S2 الاستقرار وoutbox | internal complete | `stability.ts`, `preparation.ts`, `json-source-sync-persistence.ts`, `source-sync-outbox-worker.ts` | guarded read/hash، crash/restart، leases، dedupe، fairness وbackpressure مختبرة. |
| S3 staging/API/R2 | external-bound | server authority/router، D1 authority، R2 store، staging grants، Worker | IDOR/hash/idempotency/quota/quarantine/immutable promotion مختبرة؛ بقي apply/bindings/secrets وR2 staging حي. |
| S4 revisions/conflict/rollback | internal complete | revision history + conflict authority/store، migrations 0003 و0010 | rollback والخيارات الثلاثة وreplay/device/ownership/publication CAS مختبرة. |
| S5 pipeline | external-bound | build jobs، D1 store، Node builders، PDF service builder | الخمسة من revision واحدة وفشل PDF بلا نشر خليط مختبران؛ بقي PDF service/corpus حي. |
| S6 النشر والكاش | external-bound | publication، D1 atomic completion، cache invalidation، migration 0009 | pointer/manifest/job/invalidation ذرية واختبارات race/retry/304؛ بقي CDN/Worker staging. |
| S7 UX والأدوار | external-bound | session/action/http contracts وfeature-gated app UI بلا محرر | الحالات ومنع الضيف والتعارض وETag/SWR مختبرة؛ بقي OIDC provider وتسجيل دخول حي. |
| S8 القدرات والفallback | external-bound | Node companion/CLI/service descriptors، manual replacement وoffline policy | العقود والفallback مختبرة؛ بقي تثبيت companion وFile System Access/SAF وQA المنصات. |

## مصفوفة المتطلبات والأدلة

| المتطلب | ملفات التنفيذ | اختبارات القبول | الحكم |
|---|---|---|---|
| Revision/Build/Manifest immutable وهوية واحدة | `contracts.ts`, `publication.ts` | `revision-state.test.ts`, `publication.test.ts` | internal complete |
| لا نشر لبناء ناقص أو خليط مراجعات | `build-jobs.ts`, `d1-build-job-store.ts` | build jobs + derived pipeline | internal complete |
| managed root آمن بلا escape/symlink | `node-managed-source-adapter.ts` | adapter tests | internal complete؛ المنصات external-bound |
| save/rename/delete/replace/restart | scheduler + mapping | scheduler + long-outage integration | internal complete |
| rewrite يحافظ size/mtime/inode أثناء التشغيل | bounded content scrub | runtime scrub integration | internal complete |
| stable read قبل/بعد + SHA-256 + DOCX safety | preparation + DOCX inspector | preparation/docx/zip safety | internal complete |
| outbox دائم، idempotent، fair ومحدود | JSON persistence + outbox worker | persistence/outbox/backpressure | internal complete |
| ملكية وIDOR وجهاز نشط | authorities + device registry | authority/devices/router/security | internal complete |
| staging محدود وR2 immutable | grants + R2 source store | staging/R2/immutable robustness | internal complete؛ R2 حي external-bound |
| حصص/rate/audit metadata-only | quota/audit D1 | quota/audit/log-redaction | internal complete |
| حجر DOCX وحسم إداري CAS | quarantine server/D1/routes | quarantine/security sequences | internal complete |
| revisions وrollback ذري | history server/D1 + 0003 | history/Worker tests | internal complete |
| keepLocal/keepRemote/createCopy | conflict server/D1/Worker + 0010 | conflict authority/store/route tests | internal complete |
| خمسة مشتقات من revision واحدة | Node builders + PDF adapter | pipeline/full daemon/PDF | internal complete؛ PDF حي external-bound |
| pointer/ETag/cacheVersion/invalidation | publication/D1/cache + 0009 | publication/build/cache fault tests | internal complete؛ CDN حي external-bound |
| صيانة bounded بلا حذف immutable | `maintenance.ts` | maintenance tests | internal complete؛ cron حي external-bound |
| OIDC/JWKS وفصل user/service token | identity/service auth | OIDC/service-auth tests | internal complete؛ provider حي external-bound |
| حالات UX والضيف بلا upload ولا محرر | session/policy/feature UI | session/policy/UI tests | internal complete؛ login حي external-bound |
| companion/CLI/fallback صادق | CLI/descriptors/offline/manual replace | CLI/service/fallback tests | internal complete؛ تثبيت/منصات external-bound |
| migrations/readiness بلا drift | migrations 0001–0011 + readiness | migration-integrity/readiness | internal complete؛ apply remote external-bound |

## بوابات المتانة المجمعة

- backpressure: 10,000 إشعار تُدمج حسب المسار، و12 كتابًا تنال دورها؛ حدود
  التزامن/الدُفعات/shutdown مضبوطة ومتصلة من runtime config.
- الانقطاع الطويل: rename chains وdelete+recreate وclock-skew وduplicate inode؛
  startup يتحقق بالبصمة ثم restart بلا فقد أو ازدواج.
- أثناء التشغيل: content scrub افتراضيًا 4 كتب كل 60 مصالحة، بالتناوب العادل
  وتحت `maxConcurrentPaths`؛ unchanged لا يولد outbox أو mapping churn.
- الشبكة: 408/409/429/5xx/timeout/drop/partial PUT/replay/ETag 304 وRetry-After
  مغطاة؛ لا mutating retry خفي ولا نشر ناقص.
- الأمن: sequences ثابتة البذرة للأجهزة والحجر، ZIP traversal/bomb، immutable
  promotion، quota CAS، وفحص log redaction بلا token/URL/hash/content/path.
- حسم التعارض: operation replay ثابت، تغير المعنى مرفوض، وtrigger 0010 يحرس
  owner/revision/publication version داخل D1 batch.

المراجع التفصيلية:

- `docs/source-sync-backpressure-audit-2026-08-08.md`
- `docs/source-sync-long-outage-reconciliation-audit-2026-08-08.md`
- `docs/source-sync-runtime-content-scrub-audit-2026-08-08.md`
- `docs/source-sync-network-fault-audit-2026-08-08.md`
- `docs/source-sync-conflict-resolution-audit-2026-08-08.md`

## نتيجة البحث عن فجوة داخلية

لم تظهر فجوة داخلية غير مثبتة بعد migrations 0010/0011 وcontent scrub. عقود
`retryPending/cancelPending` امتداد مستقبلي مقفل بقيود server-derived؛ لا تعرض
الواجهة mutation ولا تدعي endpoint له، وليس من بوابة S0–S8 الحالية. لا ينبغي
اختراع endpoint قبل تحديد نوع العملية المعلقة وسلطة الإلغاء لكل outbox/build/upload.

بوابة القبول الحالية: core ‏88/88، server ‏44/44، Cloudflare ‏52/52، Node
‏112/112؛ الإجمالي 296 اختبارًا ناجحًا في 78 ملفًا، مع corpus COM اختياري
متجاوز، وبناء الحزم الأربع ناجح. تشمل زيادة core
بوابة intake للصيغ PDF/BOK/EPUB/text بقرارات allow/quarantine/reject وحدود ZIP.
وتثبت زيادة server replay/CAS عبر الصيغ الخمس. وتضاف إليها
بوابة tarball/تثبيت/بدء بارد مستقلة ناجحة.

تركيب WordPageMap صار داخليًا مكتملًا من source edition DOCX إلى reader manifest
خلف service auth، مع health check وفشل retryable يحفظ النشر السابق.

تمر أيضًا بوابة staging محلية مرتين على قواعد مؤقتة وتثبت migrations/backfill/
triggers/readiness/health وsmoke لجهازين دون اتصال أو أسرار. وهي لا تغير بقاء
التطبيق البعيد والنشر وQA المنصات أعمالًا خارجية.

## نقطة الاستئناف الخارجية الدقيقة

لا توجد ميزة كود صغيرة تسبقها. الخطوة التالية، بعد تفويض صريح، هي تنفيذ القسم
7.1 من `docs/source-sync-pre-deployment-runbook.md`: تجهيز staging وbackup/clone،
تطبيق migrations 0001–0011 والتحقق من backfill، حقن bindings/secrets وOIDC/PDF، نشر Worker والتحقق من
`/ready`، ثم smoke بجهازين يغطي upload/build/rollback/conflict/quarantine/cache/
content scrub، وبعده QA companion وWord وfallback على المنصات.
