# Source Sync pre-deployment runbook

الحالة: بوابة تسليم فقط. لم تُنشأ موارد Cloudflare، ولم تُطبق migration، ولم يُرفع
Worker أو تطبيق أو companion أثناء إعداد هذه الوثيقة.

## 1. المدخلات التي يوفرها المشغل

- حساب/منطقة Cloudflare المستهدفة، واسم وID قاعدة D1، واسم R2 bucket، وorigin HTTPS النهائي.
- OIDC issuer وaudience وJWKS URL وallowlist خوارزميات (`RS256` و/أو `ES256`).
- سران مستقلان مولدان عشوائيًا: `SOURCE_UPLOAD_SIGNING_KEY` و`BUILD_SERVICE_TOKEN_CURRENT`؛ و`BUILD_SERVICE_TOKEN_PREVIOUS` اختياري فقط أثناء تدوير محدود.
- قيم موجبة معتمدة لكل `SYNC_MAX_*`, `SYNC_RATE_WINDOW_SECONDS`, `SYNC_MAINTENANCE_BATCH_SIZE`, `SYNC_STAGING_GRACE_SECONDS` وحدود `DOCX_*` وسياسات boolean الثلاث.
- PDF service HTTPS يدعم `OPTIONS` والتحويل الفعلي، وملف إعداد Node بمصدر user token ومصدر service token منفصلين من env/file؛ لا تضع token في JSON أو command line.

توقف إذا غاب أي مدخل أو كان origin/PDF غير HTTPS في staging/production.

## 2. بوابة المستودع قبل أي اتصال خارجي

من جذر المستودع:

```powershell
pnpm install --frozen-lockfile
pnpm -F @library/source-sync test
pnpm -F @library/source-sync-server test
pnpm -F @library/source-sync-cloudflare test
pnpm -F @library/source-sync-node test
pnpm -F @library/source-sync-node verify:installability
pnpm -F @library/app exec vitest run app/src/source_sync_ui.test.ts
pnpm -F @library/source-sync build
pnpm -F @library/source-sync-server build
pnpm -F @library/source-sync-cloudflare build
pnpm -F @library/source-sync-node build
pnpm -F @library/app build
```

النجاح: كل أمر exit 0، واختبار `migration-integrity.test.ts` يثبت وجود 0001–0011
بالترتيب وبالبصمات المسجلة في readiness. الفشل: أي test/type/build failure، ملف SQL
إضافي أو ناقص، أو checksum مختلف؛ لا تعالج الاختلاف بتغيير checksum قبل مراجعة SQL.

## 3. تجهيز ملف Wrangler خارج القيم السرية

انسخ `packages/source-sync-cloudflare/wrangler.example.toml` إلى ملف البيئة المعتمد،
واستبدل `REPLACE_AFTER_PROVISIONING`. أضف القيم غير السرية المطلوبة صراحة في
`[vars]`، وأضف cron للصيانة. لا تضف أيًا من الأسرار إلى الملف أو Git.

إن لم تكن الموارد موجودة، هذه أوامر provisioning التي ينفذها المشغل بعد الموافقة:

```powershell
pnpm exec wrangler d1 create library-source-sync
pnpm exec wrangler r2 bucket create library-source-objects
```

ثم أدخل الأسرار تفاعليًا (لا تلصقها كوسائط):

```powershell
pnpm exec wrangler secret put SOURCE_UPLOAD_SIGNING_KEY --config <environment-wrangler.toml>
pnpm exec wrangler secret put BUILD_SERVICE_TOKEN_CURRENT --config <environment-wrangler.toml>
```

معيار النجاح: IDs تخص البيئة الصحيحة، ولا يظهر secret في terminal history أو config.

## 4. migrations — forward-only

قبل لمس أي D1 بعيدة شغّل البروفة المحلية المعزولة:

```powershell
pnpm --filter @library/source-sync-cloudflare staging:local
```

يجب أن تمر مرتين على قاعدتين مؤقتتين وتثبت readiness/health وbackfill وCAS
والـsmoke ذي الجهازين. التفاصيل في
`docs/source-sync-local-staging-gate-2026-08-08.md`. نجاحها لا يمنح إذن نشر ولا
يستبدل backup/clone أو فحص البيئة البعيدة.

### بوابة سلامة daemon المحلية

قبل أي تشغيل companion، يجب أن تنجح اختبارات `source-sync-daemon` وJSON persistence
وfull composition بصورة متكررة. تحقق الانحدارات أن tick البدء و`drainOnce()` لا يشغلان
العامل نفسه بالتوازي، وأن `stop()` ينتظر lease الجاري، وأن كل كائنات persistence التي
تشترك في state path تدخل تسلسل معاملات واحدًا. دليل الجولة الحالية: عشر إعادات متوالية،
كل منها 16/16، مع 40 ساعة محقونة و8 drains متزامنة لكل دورة، بلا `Lost outbox lease`.
أي عودة لهذا الخطأ هي **no-go** وليست flaky مسموحًا بتجاوزها بإعادة الاختبار.

تغطي البوابة أيضًا crash consistency للتخزين المحلي: الكتابة إلى ملف مؤقت فريد مع
`fsync` قبل atomic rename، وقفل `wx` ملازم لمسار state بين العمليات. القفل ذو PID
ميت يُنقل أولًا باسم stale فريد ثم يزال لتجنب سباق الحذف؛ lock تالف أو PID حي يتجاوز
المهلة يفشلان مغلقًا. state JSON جزئي/تالف لا يُستبدل بحالة فارغة، وtemp المتروك لا
يُقرأ ولا يمس DOCX. اختُبرت عمليتا Node مستقلتان على state واحد عشر مرات؛ restart
وجد السجلين في كل مرة بلا فقد أو ازدواج. أي corrupt state/lock أو lock timeout هو
**no-go** يحتاج حفظ الملف للتحقيق، لا حذفه أو إعادة تهيئته آليًا.

### بوابة خصوصية السجلات

الأحداث التشغيلية وhealth وCLI تعرض أنواع الأحداث، reason codes المحدودة، العدادات
والتوقيت فقط. يحظر ظهور bearer/service token، signed URL، SHA-256، bytes أو نص DOCX،
اسم/مسار المصدر، أو managed/state/lock absolute paths. أخطاء HTTP غير الموثوقة لا
تُمرر كنص؛ تقبل error codes المقيدة فقط وإلا تتحول إلى code عام. audit في D1 يبقى
metadata-only بلا الحقول المحظورة. تستخدم الاختبارات corpus أسرار ثابتًا يضم token
وsigned URL ومسار Windows وhash ونصًا عربيًا. أي تطابق في smoke logs هو **no-go**.

### بوابة أعطال الشبكة

تُحقن محليًا حالات 408/409/429/5xx وtimeout وconnection drop وpartial staging PUT،
إضافة إلى duplicate finalize وETag 304. ‏408/429/5xx والنقل تعيد outbox إلى retryable؛
409 HTTP الدائم لا يتحول إلى نجاح. `Retry-After` يُحترم داخل سقف `retryMaxMs`،
والمهلة تلغي fetch عبر AbortSignal. لا يعيد العميل mutating request داخليًا؛ CAS/outbox
أو build job هو مالك الإعادة. partial PUT لا يصل إلى finalize، وreplay المكتمل لا يرفع
bytes ثانية، و304 يحافظ على manifest المخبأ، ونقص artifact يبقي النشر القديم. مخالفة
أي ثابت من هذه الثوابت هي **no-go**.

الدليل التنفيذي المفصل في
`docs/source-sync-network-fault-audit-2026-08-08.md`. بوابة الجولة الحالية:
296 اختبارًا ناجحًا في 78 ملفًا (واختبار corpus COM اختياري متجاوز) عبر الحزم
الأربع وبناء TypeScript كامل، إضافة إلى تثبيت
tarball وبدء بارد ناجح. يشمل ذلك إصلاح تصنيف الأخطاء
الدائمة لخدمة PDF، واحترام `Retry-After` في outbox وbuild، وإنهاء preflight
المعلق بمهلة وإرجاع exit 5. هذه أرقام محلية فقط ولا تستبدل fault proxy في staging.

اعرض أولًا ثم طبق على staging:

```powershell
pnpm exec wrangler d1 migrations list library-source-sync --remote --config <environment-wrangler.toml>
pnpm exec wrangler d1 migrations apply library-source-sync --remote --config <environment-wrangler.toml>
```

النجاح: تطبق 0001→0011 مرة واحدة، ثم لا تبقى migration معلقة. بعد 0009 يجب وجود
`cache_invalidation_outbox` وحقلي `active_manifest_etag/cache_version`، وبعد 0010
يجب وجود `source_conflict_resolutions` وtrigger حارس CAS. وبعد 0011 يجب وجود
`logical_works/source_editions/source_edition_operations` وbackfill Word مطابق. الفشل:
ترتيب مختلف، checksum drift، SQL error، أو قاعدة غير البيئة المقصودة. لا تحذف جدولًا
ولا تعكس migration؛ استعد من backup/clone وحقق السبب.

## 5. النشر (غير منفذ هنا)

بعد نجاح staging فقط:

```powershell
pnpm -F @library/source-sync-cloudflare build
pnpm exec wrangler deploy --config <environment-wrangler.toml>
```

النجاح: deployment ID مسجل، cron ظاهر، وbindings تشير إلى D1/R2 الصحيحين. الفشل:
binding/secret/route mismatch أو build warning أمني؛ أوقف الترقية ولا تشغل companion.

## 6. فحص حي read-only بعد النشر

```powershell
Invoke-RestMethod https://<origin>/health
Invoke-WebRequest https://<origin>/ready
node packages/source-sync-node/dist/cli-main.js config-check --config <node-config.json>
node packages/source-sync-node/dist/cli-main.js provision-check --config <node-config.json>
node packages/source-sync-node/dist/cli-main.js remote-check --config <node-config.json>
```

- `/health`: HTTP 200 و`ok=true`؛ لا يكفي وحده للترقية.
- `/ready`: HTTP 200 و`ready=true`, bindings فارغة، missingTables فارغة، migrations 1–11 وبصماتها المتوقعة.
- `config-check`: exit 0 ولا يقرأ أو يطبع token.
- `provision-check`: exit 0؛ يقرأ `/ready` وbuild-service scopes فقط ولا يكتب D1/R2.
- `remote-check`: exit 0 ويضيف `OPTIONS` لخدمة PDF و`HEAD` مصادقًا لخدمة
  WordPageMap. exit 5 لأي عدم جاهزية.

توقف عند 401/403/404/409/429/5xx غير متوقع، أو إذا ظهر token/URL staging خاطئ في
السجل. لا تستخدم `once` أو `run` ضمن الفحص read-only.

## 7. smoke محدود بعد موافقة مستقلة

هذه مرحلة mutating منفصلة وليست جزءًا من preflight: سجل جهاز اختبار، ارفع DOCX corpus
آمنًا، تحقق revision/build/artifacts الخمسة والنشر، ثم rollback وحالة cache ETag، وبعدها
اختبر quarantine بملف synthetic. سجّل جهازًا ثانيًا وأنشئ تعارضًا مضبوطًا، ثم اختبر
`keepLocal` و`keepRemote` و`createCopy` كل منها بعملية مستقلة مع replay وCAS قديم.
على companion، احفظ DOCX بنفس الحجم ثم أعد mtime إن أمكن وتأكد أن content scrub
يلتقطه مرة واحدة ضمن ميزانية hash. يلزم موافقة وبيئة staging قابلة للمسح؛ لا تنفذ
في production أولًا.

## 7.1 نقطة التشغيل الخارجية الدقيقة

لا يبدأ العمل الخارجي إلا بتفويض وبيئة staging قابلة للمسح. الترتيب الملزم:

1. ثبّت Cloudflare account/zone وD1 ID وR2 bucket وHTTPS origin، وأنشئ backup/clone لـD1.
2. ثبّت OIDC issuer/audience/JWKS والخوارزميات، وخدمة PDF HTTPS، والسرين المنفصلين.
3. طبق migrations 0001→0011 على D1 staging ثم افحص الجداول وtriggerي 0010/0011
   وطابق backfill count/owner/active Word edition قبل المتابعة.
4. انشر Worker وسجل deployment ID؛ تحقق `/health` ثم `/ready` قبل أي mutation.
5. نفذ `config-check`, `provision-check`, `remote-check` بملف companion بلا أسرار.
6. أنشئ principal اختباريًا وجهازين، ثم نفذ smoke الرفع/المشتقات/rollback/التعارض/
   الحجر/cache وcontent scrub، وسجل operation IDs والنتائج دون tokens أو hashes.
7. نفذ QA Word/companion على Windows وmacOS، وfallback/import على iOS/Android؛
   أي ادعاء File System Access يبقى محصورًا بالمتصفح الذي اختُبر فعليًا.
8. go/no-go يحتاج صفر missing binding/table، صفر drift، المشتقات الخمسة من revision
   واحدة، والمنشور القديم سليم عند حقن فشل PDF/network. عند الفشل استخدم التراجع
   في القسم 8 ولا تحذف migration أو immutable object.

## 8. التراجع والتصعيد

- فشل Worker بعد migration: أعد نشر نسخة Worker سابقة متوافقة مع الأعمدة الإضافية؛ لا تحذف migrations أو immutable objects.
- فشل service token: ضع القديم في `BUILD_SERVICE_TOKEN_PREVIOUS` مدة محدودة، وزع الحالي، ثم أزل السابق بعد تحقق السجلات.
- فشل PDF/build: اترك active publication القديمة؛ أصلح الخدمة وأعد jobs، ولا تبدل pointers يدويًا.
- فشل OIDC/JWKS: أوقف user mutations؛ لا تستبدل verifier بـplaceholder أو guest access.
- وثق deployment ID، D1 backup/clone، وقت الفحص، counts، وأكواد الفشل قبل قرار go/no-go.
