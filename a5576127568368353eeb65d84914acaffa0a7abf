# ALPHA RELEASE MASTER 2026-08-09

> سجل موحد يحفظ التقارير الأصلية كاملة، مرتبة باسم المصدر؛ أُنشئ أثناء تنظيف 2026-08-09.

---

## المصدر: cloudflare-pages-deployment-preflight-2026-08-09.md

# Cloudflare Pages deployment preflight — 2026-08-09

## الحكم

الحزمة **جاهزة محليًا**، لكن التنفيذ الخارجي **BLOCKED: `cloudflare_authentication_required`**. `wrangler 4.92.0 whoami` أكد أن الجهاز غير مصادق. لم يُطلب login ولم يُنشأ مشروع ولم يحدث deploy.

## إعادة البحث الآمن عن اعتماد مُدار

أعيد الفحص دون قراءة أو طباعة أي قيمة سرية:

- لا وجود لأسماء متغيرات Cloudflare المعروفة في بيئة المهمة (`CLOUDFLARE_API_TOKEN/ACCOUNT_ID` وبدائل `CF_*` وglobal key/email).
- لا توجد ملفات جلسة Wrangler في المواقع القياسية للمستخدم، ولا `.dev.vars` أو `.env/.env.local` داخل `alpha-publish`.
- Windows Credential Manager لا يحتوي target اسمه Cloudflare أو Wrangler؛ لم تُقرأ بيانات اعتماد أخرى.
- إعادة `pages:preflight` أعادت code 2 و`cloudflare_authentication_required`، بينما أعادت قبل ذلك التحقق من candidate `bf3529ee...` و294 ملفًا بنجاح.

إذن العائق مثبت كغياب هوية خارجية، لا خلل artifact. حُفظت الحزمة دون تغيير ولم تجر محاولة login أو project create أو deploy.

## العقد الثابت

- المشروع: `alkhizana-alpha`.
- المجلد: `alpha-publish/pages-dist`.
- الإعداد: `wrangler.toml` يثبت `pages_build_output_dir = "./pages-dist"` و`compatibility_date = "2026-08-09"`.
- المرشح وقت الفحص الأول كان `bf3529ee437ddf469cbfc280b6d20ecde8d87ac7e0d2e6241bc820aa49e80d24`.
- تحديث لاحق بعد إصلاح Word: المرشح authoritative أصبح `576a5f707ed67b502844d29dfe7bc3f5db6d5a1b1ef6c2dd82692579f260ca92` والسابق `e2dbd289309d7595a527a72aeb57b1920ca63eb4e2d9e783f078b8f5e2673661`؛ راجع `final-release-candidate-576a5f70-audit-2026-08-09.md`.
- تحديث PWA اللاحق: المرشح authoritative أصبح `38e2a975a278f4daf0afaf9f9255c6c253d9d5536e1f433fed6eea4d214ef942` والسابق `e53af0a10313340d569636a11e3c11196f86bca70a8a8acd1b7d887cc24d03bb`؛ راجع `offline-pwa-cache-release-audit-2026-08-09.md`.
- بعد source freeze والبناء النهائي: المرشح authoritative هو `2d31228b6b35d1fc25892ae3b2cef93fdbd5209e60657251f4b368a1fe73bf8d` والسابق `18f559aef28ce51e5b7c44fbe809c5094c7178e0195ae36d4ba58e8ad079c5e0`؛ راجع `final-frozen-source-release-2026-08-09.md`.
- 294 ملفًا، ضمن 20,000 و25 MiB؛ Q15 يثبت المصادر والرؤوس والتوجيه ونسخة التراجع.

أضيف `npm run pages:preflight`: يفحص config وrelease drift أولًا، ثم `wrangler whoami`، ولا يعتبر exit code وحده نجاحًا لأن Wrangler قد يطبع «not authenticated» مع code 0. يخرج JSON بلا بريد أو account id أو token، ويفشل code 2 عند غياب المصادقة.

## التسلسل الخارجي عند توفر تفويض وهوية

هذه أوامر محضرة وليست منفذة:

1. `npm run pages:preflight`
2. `node node_modules/wrangler/bin/wrangler.js pages project list --json`
3. إن لم يوجد المشروع: `node node_modules/wrangler/bin/wrangler.js pages project create alkhizana-alpha --production-branch main`
4. Preview فقط أولًا: `node node_modules/wrangler/bin/wrangler.js pages deploy ./pages-dist --project-name alkhizana-alpha --branch alpha-preview`
5. افحص URL الناتج والرؤوس/routes/cache/offline ثم احتفظ deployment id للتراجع. لا يصبح الإنتاج مسموحًا تلقائيًا بنجاح preview.

لـCI يستخدم `CLOUDFLARE_ACCOUNT_ID` وAPI token محدود Pages من secret manager فقط، ولا يوضعان في `.env` أو artifact أو المستودع.

## رفض TryCloudflare كعنوان دائم

`trycloudflare.com` Quick Tunnel صالح للتجربة المحلية المؤقتة فقط: النطاق عشوائي، بلا SLA، محدود حاليًا بـ200 طلب متزامن ولا يدعم SSE. وثائق Cloudflare نفسها تنص على أنه للتطوير/الاختبار وليس production؛ لذلك لا يقبل كرابط المشروع الرسمي أو بديل Pages دائم.

المراجع الرسمية:

- https://developers.cloudflare.com/pages/get-started/direct-upload/
- https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/
- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/

---

## المصدر: cloudflare-pages-handoff-2026-08-09.md

# تسليم Cloudflare Pages — جاهز محليًا بلا نشر

- المصدر: `alpha-publish/public/khizana` الناتج من بناء التطبيق الأخضر.
- أمر التحضير: `npm run pages:prepare` داخل `alpha-publish`.
- مجلد الرفع: `alpha-publish/pages-dist`.
- العقد: SPA fallback عبر `_redirects`، رؤوس أمان وcache عبر `_headers`، و`wrangler.toml` يحدد `pages_build_output_dir` فقط.
- المرشح الحالي authoritative: `2d31228b6b35d1fc25892ae3b2cef93fdbd5209e60657251f4b368a1fe73bf8d`.
- نسخة الرجوع immutable: `18f559aef28ce51e5b7c44fbe809c5094c7178e0195ae36d4ba58e8ad079c5e0`.
- القياس الحالي: 294 ملفًا، 117,191,681 بايتًا؛ أكبر ملف 25,066,154 بايتًا، ولا توجد ملفات تتجاوز 25MiB.
- فحص الأسرار: صفر مطابقات لـSites tokens/Bearer/service tokens داخل artifact.
- لا يوجد حساب/مشروع Cloudflare دائم موصول حاليًا، لذلك لم يُدّع نشر Pages ولم تُستخدم quick tunnel كبديل دائم.
- أوامر التشغيل المعتمدة: `docs/runbooks/cloudflare-pages-operator-2d31228b.md`.

---

## المصدر: final-frozen-source-release-2026-08-09.md

# Final frozen-source release audit — 2026-08-09

نفذت السلسلة بعد إشارة design green ‏383/140 build433 وWord lifecycle green ‏151 build434 وتجميد المصدر.

## البناء والميزات

- حُفظ مرشح PWA السابق immutable قبل الاستبدال: `18f559aef28ce51e5b7c44fbe809c5094c7178e0195ae36d4ba58e8ad079c5e0`.
- بوابة TypeScript workspace كاملة: PASS.
- app TypeScript: PASS؛ Vite: 434 modules PASS.
- اختبارات مركزة tatweel/Unicode + ReaderPreview LRU + virtualization + accessibility: 6 ملفات/24 اختبارًا PASS.
- البناء الناتج يحوي tatweel في chunks، `FIRST_PAGE_CACHE_LIMIT=8` وReaderPreviewCache في المصدر المبني، `aria-live/aria-labelledby/visually-hidden` في JS/CSS، و`alkhizana-shell-v7`.

تعذر تشغيل wrapper `pnpm -r build` نفسه بسبب store SQLite/sandbox ثم محاولة registry من بيئة store معزولة؛ لم يُستخدم ذلك كدليل نجاح. عوضًا عنه نجحت بوابة TypeScript workspace، وبناء app المباشر النهائي، وكانت builds الحزم من مساري Word/design خضراء قبل freeze. نُظفت مخازن pnpm المؤقتة.

## النقل وParity

- نُفذ `copy-public-app` ثم `prepare-cloudflare-pages` بعد البناء، لا قبله.
- مقارنة SHA/bytes: app payload ‏291 ملفًا مقابل Pages ‏291؛ missing=0، extra=0، changed=0. الاختلافات خارج المقارنة هي `_headers/_redirects/q13-manifest` وسياسة الاستبعاد المعلنة.

## المرشح النهائي

- payload fingerprint: `2d31228b6b35d1fc25892ae3b2cef93fdbd5209e60657251f4b368a1fe73bf8d`.
- deploy fingerprint: `a50600101e649ff6bef5493b285f48f3f382a4157b1cffb0932940b4b5820bad`.
- previous: `18f559aef28ce51e5b7c44fbe809c5094c7178e0195ae36d4ba58e8ad079c5e0`.
- Q15: 294 ملفًا، 23 عملاً، 6/6 خرائط Word؛ اختبارات Pages/PWA/release ‏11/11 PASS.

## Q13/Q14

- candidate Q13 core: 294 ملفًا، 117,191,681 بايتًا، checksum `7ea21c68f6dda157c99c6d3d252c5716a710eb62242c96d631c0a88d9b5c69e1`.
- previous Q13 core checksum: `1fc31dc87760ec69b3ef0e512f147e927c519839706e8fd441b92d6725dd4b1a`.
- Ed25519 public verify: candidate=true، previous=true؛ لا private key محفوظ.
- Q14 promote/rollback أعاد `release-18f559ae` بنجاح.
- الأدلة العامة: `tmp/release-audit-evidence/alkhizana-final-2d31228b`.

## الحكم

**هذه هي البصمة النهائية الحالية: `2d31228b...bf8d`. GO artifact / NO DEPLOY**. `pages:preflight` تحقق من 294 ملفًا ثم توقف code 2 عند `cloudflare_authentication_required`. لم يحدث deploy.

---

## المصدر: final-predeployment-audit-2026-08-09.md

# التدقيق النهائي قبل النشر — 2026-08-09

الحكم بعد معالجة 7.154: **GO محلي لأثر Pages المرشح، ولا نشر في هذه الدورة**.
أُغلقت موانع حداثة الحزمة وسياسة cache ووجود نسخة الرجوع؛ يبقى التوقيع الخارجي
والفحص الحي بعد النشر بوابتين خارجيتين عند فتح نافذة النشر.

## إعادة التحقق بعد الإصلاح — 7.154

> سجل تاريخي حل محله مرشح 7.155 الموثق في
> `final-predeployment-green-audit-2026-08-09.md`؛ لا تستخدم البصمات التالية
> للنشر الحالي.

- `pages-dist`: 293 ملفًا قبل تضمين بيان Q13، وبصمة payload
  `8953c0d73ee933c4992272a4ed44ff3f66252af0891b8500c427b997b41747db`؛
  294 ملفًا في مجلد التسليم بعد إضافة `q13-manifest.json`.
- حزمة النشر تشمل `_headers` و`_redirects`، و23 عملًا، و6 خرائط Word موثقة
  (خمس في assets وواحدة للحاسم في word-page-maps)، و6 ملفات DOCX.
- أكبر أصل `shamela-authors.json` بحجم 25,066,154 بايتًا، تحت 25 MiB؛ لم يعد
  ضمن precache. Service Worker v6 يجلبه network-first ويحفظه fallback فقط بعد
  نجاح الشبكة، وينظف caches القديمة.
- الأثر السابق محفوظ immutable في `alpha-publish/release-artifacts` ببصمة
  `9e0b361bb281a305cb2a6f03e0fb2d13dbef1f9808453bde2443d4570285f533`،
  مع `previous.json`؛ والمرشح له `current.json` منفصل.
- اختبارات التطبيق 138 ملفًا/375 اختبارًا، وبناء التطبيق أخضر؛ اختبارات Alpha
  3/3 وبناؤه أخضر. لم ينفذ deploy.

## الحزمة الموثقة

- المصدر المفحوص: `app/dist`.
- 292 ملفًا، بإجمالي 117,197,011 بايتًا.
- بصمة بيان Q13 المحسوبة من المسارات/الأحجام/SHA-256: `bda5fa3de7708d6da1165a9fbee6dc2f53839c81037d5bdbea67262215506d31`.
- أكبر ملف: `data/shamela-authors.json`، حجمه 25,066,154 بايتًا؛ أقل من حد Cloudflare البالغ 25 MiB (26,214,400 بايتًا) بمقدار 1,148,246 بايتًا.
- فحص Q13 مرّ: لا symlink أو special file أو path escape، ولا private key أو bearer/service token أو مسار مستخدم Windows مطلق داخل النصوص المفحوصة.
- البصمة السابقة الموثقة في Q13 (`1d2fd...435ea`) لم تعد تمثل البناء الحالي؛ يجب عدم استخدامها للنشر أو التراجع.

## مقارنة مجلد الرفع

`alpha-publish/pages-dist` يحتوي 289 ملفًا/115,908,277 بايتًا، وهو **قديم** مقارنة بـ`app/dist`:

- تنقصه أربع خرائط `word-page-map.json` و`books/sample-ahadith.docx`.
- يحمل حزمتَي JavaScript قديمتين بدل حزمتَي البناء الحالي.
- يختلف `library/published/manifest.json` في الحجم.
- يحوي `_headers` و`_redirects` اللازمين للنشر، بينما `app/dist` الخام لا يحويهما؛ لذلك لا يجوز رفع `app/dist` مباشرة.

## مصفوفة GO / NO-GO

| البوابة | النتيجة | الدليل/الإجراء المطلوب |
|---|---|---|
| سلامة `app/dist` وفق Q13 | GO | 292 ملفًا؛ البيان أعلاه؛ فحص المحتوى الحساس نظيف. |
| حدود أصول Cloudflare Pages | GO | 292 أقل من 20,000 للطبقة المجانية؛ أكبر ملف أقل من 25 MiB بفارق ضيق. |
| توجيه SPA | GO في حزمة الرفع | `_redirects`: `/* /index.html 200`؛ كما أن التطبيق يستخدم hash routes. |
| رؤوس الأساس | GO جزئي | `_headers` يضيف nosniff/referrer/permissions/X-Frame-Options ويجعل `/assets/*` immutable. يلزم اختبار حي للرؤوس بعد النشر التجريبي؛ `_headers` لا يغطي Pages Functions إن أضيفت. |
| سياسة cache | CONDITIONAL | الأصول ذات البصمة immutable و`/quran/*` ليوم. لكن service worker يسبق تخزين ملف المؤلفين (25 MB) ويستخدم cache-first للبيانات مع اسم cache ثابت `alkhizana-shell-v5`؛ يلزم عقد إصدار/تغيير cache version عند تغير ملفات البيانات حتى لا تبقى نسخة قديمة لدى المستخدمين. |
| حداثة artifact الواصل لـPages | **RESOLVED 7.155** | `pages-dist` أُعيد من البناء الأخضر؛ payload الحالي `bf3529ee…0d24` ويشمل `_headers/_redirects`. |
| بيان نشر ثابت | **RESOLVED 7.155** | `q13-manifest.json` و`current.json` موجودان، واختبار Alpha يعيد حساب بصمة قائمة الملفات ويربطهما. التوقيع الحقيقي يبقى من secret manager وقت النشر ولا يدخل المستودع. |
| حزمة تراجع immutable | **RESOLVED 7.155** | المرشح السابق محفوظ تحت `ed164bd9…3661` مع manifest و`previous.json`، واختبار Alpha يتحقق من الارتباط والبصمة. |
| فحص الأسرار | GO | Q13 لم يجد أسرارًا في artifact؛ أسماء الملفات المريبة خارج artifact اقتصرت على `tokens.css` (رموز تصميم، لا سر). لا يكفي ذلك بدل secret scanning في CI. |
| اختبار النطاق/HTTPS/الرؤوس حيًا | EXTERNAL | لا يمكن إثباته بلا مشروع Pages تجريبي؛ لم ينفذ هذا التدقيق أي deploy. |

## ملاحظات Cloudflare الموثقة

- الحد الحالي للأصل الواحد 25 MiB، وعدد الأصول 20,000 في الخطة المجانية و100,000 في المدفوعة وفق وثائق Cloudflare.
- Pages يضيف ETag و`X-Content-Type-Options: nosniff` و`Referrer-Policy` افتراضيًا، ويستخدم افتراضيًا `max-age=0, must-revalidate` للأصول القابلة للتخزين؛ `_headers` هو موضع تخصيص cache/security للأصول الساكنة.
- `_headers` لا يطبق على ردود Pages Functions؛ أي API/Function مستقبلي يجب أن يضع رؤوسه في الاستجابة نفسها.

المراجع الرسمية:

- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/pages/configuration/headers/
- https://developers.cloudflare.com/pages/configuration/serving-pages/

## نقطة الاستئناف الدقيقة

1. ابنِ التطبيق مرة أخيرة، ثم نفذ `pages:prepare` ليصبح `pages-dist` نسخة من البناء نفسه مع `_headers/_redirects`.
2. طبّق Q13 على `pages-dist` النهائي واحفظ manifest + SHA-256؛ لا تعيد استخدام بصمة بناء أقدم.
3. وقّع manifest بمفتاح إصدار خارج المستودع، وتحقق بالمفتاح العام فقط.
4. احفظ artifact الحالي والسابق immutable، وسجل معرفيهما وبصمتيهما في حالة Q14؛ نفذ dry-run promote/rollback وCAS.
5. قرر سياسة تحديث service worker للبيانات غير ذات الأسماء المبصومة، واختبر ترقية مستخدم يملك `alkhizana-shell-v5` قديمًا.
6. بعد ذلك فقط نفذ نشر preview خارجي، وافحص headers/routes/cache/offline ثم أعط موافقة الإنتاج.

---

## المصدر: final-predeployment-green-audit-2026-08-09.md

# التدقيق النهائي للحزمة الخضراء قبل النشر — 2026-08-09

الحكم: **GO للحزمة كي تنتقل إلى preview deployment المصرح به لاحقًا**. لا يعني ذلك أن نشرًا وقع؛ لم يتصل هذا التدقيق بـCloudflare ولم يستخدم سرًا حقيقيًا.

## Q13 — سلامة artifact

- المسار: `alpha-publish/pages-dist`.
- الشجرة النهائية: 294 ملفًا؛ أُعيد تحضيرها بعد إصلاح هوية تنزيل PDF في 7.155.
- manifest المضمن يستثني نفسه تصميميًا: 293 ملفًا، 117,140,826 بايتًا، fingerprint `bf3529ee437ddf469cbfc280b6d20ecde8d87ac7e0d2e6241bc820aa49e80d24`؛ اختبار Alpha يعيد حساب بصمة قائمة الملفات ويربط `current.json` بها.
- Q13 للشجرة النهائية بما فيها manifest: `e2dbd289309d7595a527a72aeb57b1920ca63eb4e2d9e783f078b8f5e2673661`.
- أكبر ملف 25,066,154 بايتًا، أقل من 25 MiB بمقدار 1,148,246 بايتًا؛ العدد أقل من حد الخطة المجانية 20,000.
- فحص Q13 للأسرار/private keys/tokens/path leaks وsymlink/path escape نجح.
- البيانات المنشورة: 23/23 عملاً جاهزًا؛ 6 مصادر Word ولها 6 خرائط WordPageMap موجودة. جميع ملفات المصادر تطابق الحجم وSHA-256 في `library/published/manifest.json`.

## Cloudflare Pages

- `_redirects`: SPA fallback صحيح `/* /index.html 200`.
- `_headers`: nosniff، referrer policy، permissions policy، SAMEORIGIN؛ الأصول ذات البصمة immutable، وموارد القرآن cache ليوم.
- Service Worker انتقل إلى `alkhizana-shell-v6`، وأخرج كتالوج المؤلفين الكبير من shell الإلزامي؛ أُغلقت مخاطرة v5 السابقة.
- يلزم بعد أي preview خارجي فحص الرؤوس الحية لأن `_headers` لا يطبق على Pages Functions، لكن لا توجد فجوة artifact تمنع الانتقال إلى preview.

## Q14 — الترويج والتراجع

- نسخة التراجع immutable الحالية هي مرشح 7.154 السابق تحت fingerprint `ed164bd952aa8c886145e51702dfdcbc344fcd4bbc14a31fb371786873710395`؛ manifest أعيد حسابه وتطابق.
- `current.json` يربط المرشح `bf3529ee...` وdeploy fingerprint، و`previous.json` يربط نسخة `ed164bd...` ومسار manifest الخاص بها.
- أُنشئ مفتاح Ed25519 تجريبي خارج المستودع بصلاحية خاصة، ووُقع manifest المرشح والسابق؛ تحقق Q13 بالمفتاح العام نجح للاثنين. لم يدخل private key أو signature إلى artifact أو Git.
- Q14 CAS simulation نجح: previous → candidate ثم rollback → previous، مع إعادة تحقق manifest قبل التراجع.
- manifest checksum للشجرة المرشحة: `e2dbd289309d7595a527a72aeb57b1920ca63eb4e2d9e783f078b8f5e2673661`.
- manifest checksum لنسخة التراجع: `ed164bd952aa8c886145e51702dfdcbc344fcd4bbc14a31fb371786873710395`.

## مصفوفة القرار

| البوابة | النتيجة |
|---|---|
| تطابق المرشح bf3529ee | GO |
| حدود Cloudflare count/size | GO |
| secrets/path/symlink scan | GO |
| headers/routes/cache artifact | GO |
| 23 عملاً/6 خرائط Word | GO |
| previous artifact ed164bd + manifest | GO |
| Ed25519 public verification | GO |
| Q14 CAS promote/rollback | GO |
| نشر Cloudflare فعلي | لم ينفذ؛ يحتاج تفويضًا/حسابًا خارجيًا |
| فحص HTTPS/domain/live headers | ينتقل إلى بوابة preview الخارجية |

أثبت preflight اللاحق أن Wrangler غير مصادق حاليًا (`cloudflare_authentication_required`)؛ الحزمة ما زالت GO محليًا، لكن لا يمكن إنشاء preview أو التحقق الحي قبل هوية خارجية مصرح بها. راجع `cloudflare-pages-deployment-preflight-2026-08-09.md`.

## نقطة الاستئناف

استخدم `pages-dist` الحالي فقط ما دام fingerprint المرشح `bf3529ee...` وQ13 النهائي `e2dbd289...`. في بيئة الإصدار الحقيقية يولد مفتاح الإصدار أو يستدعى من secret manager، وتُحفظ التواقيع والحالة خارج Git؛ ثم ينشر preview، وتُفحص routes/headers/cache/offline، وبعدها فقط يقرر إنتاجيًا.

مراجع الحدود الرسمية:

- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/pages/configuration/headers/
- https://developers.cloudflare.com/pages/configuration/serving-pages/

---

## المصدر: final-read-only-artifact-security-audit-2d31228b-2026-08-09.md

# Final read-only artifact security audit — 2d31228b

هذا فحص قراءة فقط للمرشح النهائي؛ لم يعدل artifact ولم ينفذ deploy.

## النتائج

- 294 ملفًا، 117,191,681 بايتًا.
- أكبر ملف `data/shamela-authors.json`: ‏25,066,154 بايتًا، أقل من 25 MiB.
- صفر `.map/.log/.pdb/.tsbuildinfo/.bak/.tmp`، وصفر مجلد test/coverage/node_modules/.git/.env داخل artifact.
- صفر private key marker، وصفر token/API-secret assignment، وصفر Windows/Linux user path leak في الملفات النصية.
- Q13 أعيد حسابه وتطابق: `7ea21c68f6dda157c99c6d3d252c5716a710eb62242c96d631c0a88d9b5c69e1`.
- التوقيع العام المحفوظ للمرشح تحقق مجددًا: true.

## headers/routes/cache

- موجودة: `X-Content-Type-Options: nosniff`، `Referrer-Policy: strict-origin-when-cross-origin`، Permissions-Policy للكاميرا/الميكروفون/الموقع، و`X-Frame-Options: SAMEORIGIN`.
- `/assets/*` immutable لسنة؛ `/quran/*` يوم واحد؛ SW v7 network-first للقرآن والكتالوج الكبير، ويحذف shell cache القديم فقط.
- SPA fallback صحيح: `/* /index.html 200`.

لا يوجد CSP حاليًا. لم أضفه في هذا الفحص لأن ذلك ليس تغييرًا آمنًا read-only ولأن التطبيق يحتوي theme bootstrap inline (hash الحالي `sha256-QzUShyiMQD6rFtJGphXBne4hhhAHtJn0ydS4xUVlgLI=`) وWASM/blob workers وموارد صوت/قرآن خارجية متعددة؛ CSP غير مكتملة قد تكسر القارئ والصوت. هذه **hardening follow-up** وليست خلل artifact مثبتًا: تبنى policy أولًا Report-Only في preview من inventory فعلي، ثم تُقفل بعد صفر violations. HSTS وheaders الحية لا تثبت إلا على نطاق HTTPS الخارجي.

## أمر النشر

Wrangler Pages deploy لا يقدم `--dry-run`. البديل الآمن المنفذ هو `pages:preflight`: تحقق من config/Q15/candidate ثم توقف code 2 عند `cloudflare_authentication_required`. لم يُستدع `pages deploy`.

## الحكم

**GO artifact / NO DEPLOY دون auth**. لا debug/source-map/secret/path/private-key gap. المتبقي CSP Report-Only وHSTS/live headers بعد Preview مصرح به.

---

## المصدر: final-release-candidate-576a5f70-audit-2026-08-09.md

# Final Q13–Q15 audit — candidate 576a5f70

بعد إصلاح Word ودوران artifact أعيدت جميع بوابات الإصدار دون نشر.

## المرشح والتراجع

- payload candidate: `576a5f707ed67b502844d29dfe7bc3f5db6d5a1b1ef6c2dd82692579f260ca92`.
- deploy fingerprint في `current.json`: `e53af0a10313340d569636a11e3c11196f86bca70a8a8acd1b7d887cc24d03bb`.
- previous immutable: `e2dbd289309d7595a527a72aeb57b1920ca63eb4e2d9e783f078b8f5e2673661`.
- 294 ملفًا؛ 23 عملاً جاهزًا و6/6 خرائط Word وفق Q15 live gate.

## Q13/Q14

- Q13 للشجرة المرشحة: 294 ملفًا، 117,190,474 بايتًا، checksum `e787cdc1bbc4e6903ff8100b0a1748c52ae58e9676189baec7a9c9a99cec43cc`.
- Q13 للشجرة السابقة: 294 ملفًا، 117,189,666 بايتًا، checksum `b891bca788faf21436ac661943f0ba753edf132fb13028a2398b063357ee4a2a`.
- أُنشئ مفتاح Ed25519 مؤقت خارج المستودع بصلاحية private، ونجح public verify للمرشح والسابق.
- Q14 CAS promote ثم rollback أعاد `release-e2dbd289` بنجاح.
- مواد التوقيع التجريبية بقيت في secure OS temp فقط، ولم تدخل artifact أو Git.

## Q15 وPages preflight

- اختبارات config/drift/traversal/reproducibility: 7/7 ناجحة.
- `release:verify` نجح على 576a5f70 والسابق e2dbd289.
- `pages:preflight` تحقق من artifact ثم توقف code 2 عند `cloudflare_authentication_required`.

## الحكم المثبت

**GO artifact / NO DEPLOY**: المرشح صالح للانتقال إلى preview عند توفر هوية Cloudflare مصرح بها. لا توجد جلسة أو اعتماد مُدار حاليًا، ولذلك لم ينفذ project create أو preview أو production deploy.

أُجري بعد ذلك تمرين promote/verify/rollback/verify/re-promote كامل ونُظفت المفاتيح الخاصة المؤقتة مع حفظ الأدلة العامة؛ راجع `go-live-rollback-drill-576a5f70-2026-08-09.md`.

---

## المصدر: final-source-to-pages-release-ordering-2026-08-09.md

# ترتيب الإصدار النهائي من المصدر إلى Cloudflare Pages

## نتيجة المراجعة

**لا**، `release-artifact.mjs` لا يشغّل بناء التطبيق ولا يلتقط تعديلات المصدر تلقائيًا. هو يفهرس `alpha-publish/pages-dist` الموجودة لحظة التشغيل فقط.

- `pages:prepare` يشغّل `copy-public-app.mjs` ثم ينسخ `app/dist` إلى `public/khizana` وبعدها إلى `pages-dist` ويضيف `_headers/_redirects`.
- `copy-public-app.mjs` لا يبني `app`; ينسخ آخر `app/dist` مهما كان عمرها.
- `alpha-publish build` أيضًا ينسخ `app/dist` ثم يبني الغلاف؛ لا يستدعي `app npm run build`.
- `release:candidate` يولد manifest مما في `pages-dist`; لا يعرف إن كانت search tatweel أو Word LRU أو accessibility دخلت build.

لذلك المرشح `38e2a975...` مرشح PWA صحيح لكنه **ليس نهائيًا** قبل انتهاء مساري design/Word وإعادة البناء من المصدر.

وجدت المراجعة أيضًا مفتاح `release:verify` مكررًا مرتين في `package.json`؛ JSON كان يخفي الأول بالأخير. أزيل التكرار وبقيت البوابة الأقوى `scripts/verify-release.mjs` وحدها.

## الترتيب الملزم بعد إشارة design وWord green

1. أعلن source freeze قصيرًا ولا تسمح بكتابة متوازية أثناء الخطوات التالية.
2. شغّل `release:verify` على المرشح الحالي ثم `release:snapshot-previous` **قبل** استبدال `pages-dist`، ليبقى rollback الحقيقي محفوظًا.
3. من جذر workspace شغّل البناء الكامل؛ يجب أن يبني workspace packages ثم `app`، لا `alpha-publish` وحدها.
4. تحقق أن `app/dist` الجديدة تحتوي معًا:
   - search normalization/tatweel النهائي؛
   - Word LRU النهائي؛
   - Service Worker `alkhizana-shell-v7`؛
   - accessibility cleanup الأخير.
5. داخل `alpha-publish` شغّل `pages:prepare` فقط بعد نجاح الخطوة 3؛ هذا هو النقل المصرح من `app/dist` إلى Pages.
6. تحقق أن نسخة `sw.js` وبصمات bundles/manifest في `pages-dist` توافق `app/dist`، وأن الاختلافات المقصودة فقط `_headers/_redirects/q13-manifest` وسياسة استبعاد الكتب الخاصة.
7. شغّل `release:candidate` ثم `release:verify` واختبارات PWA/Q15.
8. ابنِ Q13 core manifest ووقعه خارج Git، تحقق بالمفتاح العام، ثم نفذ Q14 promote/rollback drill.
9. شغّل `pages:preflight`. دون auth يبقى `NO DEPLOY`; مع تفويض يكون Preview أولًا.

## قاعدة الفشل

أي تعديل مصدر بعد بداية الخطوة 3 يبطل المرشح ويعيد السلسلة من البناء. لا يجوز «ترقية» manifest فقط فوق `pages-dist` قديمة، ولا اعتبار نجاح `release:verify` دليلًا على أن آخر source دخل build؛ هو دليل سلامة artifact المحددة فقط.

---

## المصدر: go-live-rollback-drill-576a5f70-2026-08-09.md

# Go-live failure/rollback drill — 576a5f70

تمرين محلي فقط، بلا Cloudflare API أو deploy.

## التسلسل المنفذ

1. أعيد بناء Q13 وverify لشجرة previous `e2dbd289...`.
2. ترويج CAS للمرشح `576a5f70...` ثم Q13 verify للشجرة المرشحة.
3. rollback CAS إلى `e2dbd289...` ثم Q13 verify للشجرة السابقة.
4. إعادة ترويج المرشح ثم Q13 verify أخير.

النتيجة: `e2dbd289 → 576a5f70 → e2dbd289 → 576a5f70` بلا mismatch.

- candidate Q13: `e787cdc1bbc4e6903ff8100b0a1748c52ae58e9676189baec7a9c9a99cec43cc`.
- previous Q13: `b891bca788faf21436ac661943f0ba753edf132fb13028a2398b063357ee4a2a`.

## نظافة الأسرار والأدلة

- نُقلت الأدلة العامة فقط (public key/signatures/manifests) إلى `tmp/release-audit-evidence`.
- أُكملت manifests للمرشح الحالي وأعيد public verification من الأدلة المحفوظة: candidate=true، previous=true.
- حُذفت مجلدات مفاتيح Ed25519 الخاصة المؤقتة بعد التحقق؛ بقي صفر مجلد signing مؤقت وصفر ملف اسمه private ضمن evidence.
- content scan في release-artifacts/evidence/docs: صفر private key أو token/API-secret pattern.
- لم تحذف التقارير أو البصمات أو المفاتيح العامة أو التواقيع.

## preflight الأخير

Q15 تحقق من 294 ملفًا والمرشح `576a5f70...`، ثم توقف Pages preflight code 2 عند `cloudflare_authentication_required`. الحكم ثابت: **GO artifact / NO DEPLOY دون auth**.

---

## المصدر: offline-pwa-cache-release-audit-2026-08-09.md

# Offline/PWA/cache release audit — 2026-08-09

## الفجوات المثبتة

1. تفعيل Service Worker v6 كان يحذف **كل** Cache Storage عدا shell الحالي؛ كان ذلك يستطيع حذف حزم القرآن أو كاش مستقل لا يملكه العامل.
2. `/quran/*` كان cache-first، فيبقى manifest/corpus قديمًا طوال حياة العامل حتى لو عاد الاتصال أو تغيرت الحزمة.
3. عمليات cache.put أثناء fetch لم تكن مربوطة بـ`event.waitUntil`؛ يستطيع العامل أن يتوقف قبل اكتمال حفظ fallback.
4. إعادة `release:candidate` فوق شجرة فيها `q13-manifest.json` قد تجعل manifest القديم جزءًا من payload الجديد بدل أن تكون العملية idempotent.

## الإصلاح

- Service Worker أصبح `alkhizana-shell-v7`.
- activation يحذف فقط مفاتيح `alkhizana-shell-*` القديمة ويحفظ كاش القرآن والكاشات الأخرى.
- الكتالوج الكبير و`/quran/*` network-first مع fallback؛ عودة الشبكة تحدث النسخة المحلية.
- كل كتابة runtime ترتبط بـ`event.waitUntil`.
- كتالوج المؤلفين الكبير لا يدخل install shell.
- candidate يستثني manifest المضمن دائمًا، واختبار rerun يثبت ثبات manifest/current.
- نسخ Service Worker الخمس المصدرية/المبنية متطابقة ببصمة `4a548462b3434d11d4a72b3843306260e7b17a31285922468507d5405eb4fceb`.

## اختبارات الأعطال

- الزيارة الأولى تثبت shell بلا كتالوج 25MB.
- تحديث v5→v7 يحذف shell القديم فقط ويحفظ Quran pack وcache غير تابع.
- غياب شبكة القرآن يعيد fallback القديم، ثم عودتها تعيد `new-pack` وتحدث cache بعد waitUntil.
- Q15 config/drift/traversal/reproducibility مع PWA: 11/11 ناجحة.

## artifact الجديد

- candidate: `38e2a975a278f4daf0afaf9f9255c6c253d9d5536e1f433fed6eea4d214ef942`.
- previous المحفوظ قبل الإصلاح: `e53af0a10313340d569636a11e3c11196f86bca70a8a8acd1b7d887cc24d03bb` (مرشح Word السابق 576a بالشجرة النهائية).
- Q13 candidate: `1fc31dc87760ec69b3ef0e512f147e927c519839706e8fd441b92d6725dd4b1a`، 294 ملفًا، 117,190,537 بايتًا.
- Q13 previous: `e787cdc1bbc4e6903ff8100b0a1748c52ae58e9676189baec7a9c9a99cec43cc`.
- public signature verification نجح للاثنين، وQ14 rollback أعاد `e53af0a1`. المفتاح الخاص لم يكتب إلى القرص؛ الأدلة العامة في `tmp/release-audit-evidence/alkhizana-release-pwa-v7-38e2a975`.

## الحكم

**GO artifact / NO DEPLOY**. Pages preflight تحقق من 294 ملفًا والمرشح 38e2a975، ثم توقف فقط عند `cloudflare_authentication_required`.

---

## المصدر: q15-release-reproducibility-dry-run-2026-08-09.md

# Q15 — بروفة إصدار حتمية مرتين من staging نظيف

## الفجوة والإصلاح

كان `release-artifact.mjs` يضع الوقت الحالي في كل manifest. لذلك تنتج شجرتان متطابقتان بصمتَي payload متساويتين، لكن bytes مختلفة للـmanifest وdeploy fingerprint مختلفًا؛ وهذا يعطل المقارنة والتوقيع والتراجع القابل لإعادة الإنتاج.

أصبح وقت البناء خارج المحتوى الحتمي. لا يضاف `generatedAt` إلا إذا زود CI قيمة `SOURCE_DATE_EPOCH` صريحة، فتتحول إلى ISO حتمي. وأضيف `ALKHIZANA_RELEASE_ROOT` لتشغيل البروفة على staging مؤقت مستقل دون لمس artifact الحقيقي.

## اختبار fixture

- مرشحان من clean roots متطابقان byte-for-byte في manifest/current/SW/headers/routes.
- snapshotان سابقان متطابقان في pointer/manifest/artifact.
- مع اختبارات drift/pointer security صار مجموع Q15 هو 5/5 ناجحة.

## بروفة الحزمة الحقيقية

نُسخ payload الحالي إلى مجلدين مؤقتين مستقلين، وحذف manifest المضمن من النسختين، ثم نُفذ `snapshot-previous` و`candidate` في كل واحدة. النتائج كلها متطابقة byte-for-byte:

| الملف | SHA-256 | bytes |
|---|---|---:|
| `q13-manifest.json` | `93c6168210c5ad42c646b604a388360fe486acd8b3b7a8142e2775697171de7e` | 48,795 |
| `current.json` | `fe94382970a2205d108e9d363521508beb379badad159fbdb4a5c57e0e528a28` | 304 |
| `previous.json` | `78ac472304ec48a8b2f329db1835ec158bcdf2ae62d894d10357c05f26161f93` | 281 |
| `sw.js` | `ebf2e46d07f40a718a57c967e69aa3de1d2419cb85f24b270d53d4aa79f76a4f` | 3,252 |
| `_headers` | `637295cfa450cd642f9b2efa51997d47cf37ff2cd0f3981bb1cbd8202e851e65` | 294 |
| `_redirects` | `6036983e5fc00f0169c9e939b1816ed771eee00e27f2fcc517b819041460b9ef` | 19 |

بصمة payload في الجولتين: `bf3529ee437ddf469cbfc280b6d20ecde8d87ac7e0d2e6241bc820aa49e80d24`.

نُظف مجلدا staging المؤقتان بعد المقارنة. لم يحدث deploy ولم تُعدل الحزمة الحقيقية أو بيانات المستخدم.

---

## المصدر: source-sync-q0-q15-requirement-audit-2026-08-09.md

# تدقيق متطلبات source-sync وQ0–Q15 قبل النشر — 2026-08-09

## الحكم

المتطلبات الداخلية المحددة مكتملة بعد إغلاق فجوة أمن مؤشرات Q15. المتبقي أعمال خارجية بطبيعتها: provisioning/migrations وR2/D1/OIDC/PDF الحية، companion على المنصات، تنزيل corpus الكبير الصريح، وCloudflare preview ثم production.

## المصفوفة

| النطاق | الحكم | الدليل المختصر |
|---|---|---|
| S0–S2 revisions/managed source/outbox | مكتمل داخليًا | `source-sync-s0-s8-audit`، backpressure/long-outage/content-scrub واختباراتها |
| S3 staging/security/quota/quarantine | مكتمل داخليًا؛ البيئة خارجية | migrations 0001–0011، local staging، grant/finalize/quarantine fault tests |
| S4 conflict/rollback | مكتمل داخليًا | conflict CAS/intents/replay و0010 |
| S5–S6 build/publication/cache | مكتمل داخليًا؛ الخدمات الحية خارجية | WordPageMap composition، build outbox reconciliation، atomic publication/cache |
| S7–S8 identity/session/companion | مكتمل داخليًا؛ provider والمنصات خارجية | OIDC/JWKS/service auth وcold-start/installability |
| Multi-format Word/PDF/BOK/EPUB/text | مكتمل داخليًا | immutable editions/CAS، validators/signatures/ZIP safety، seeded fuzz |
| Q0–Q4 corpus/resources/audio/update | مكتمل داخليًا | Q0 contracts، Q1 full pack، Q2 metadata، Q3 delta، Q4 recovery |
| Q5–Q8 concurrency/quota/cleanup | مكتمل داخليًا | lock، pinned LRU، live recheck، crash-trash |
| Q9–Q12 downloader integrity | مكتمل داخليًا | ETag range، fresh status، invalid reset، partial-append reset |
| Q13 artifact integrity | مكتمل داخليًا | per-file SHA، secret/path/symlink scan، Cloudflare limits |
| Q14 release rollback | مكتمل داخليًا | Ed25519 public verify، CAS promote/rollback، immutable previous |
| Q15 post-build drift | مكتمل داخليًا بعد الإصلاح | `release:verify` + 3 اختبارات + live 294/23/6 |

## الفجوة الداخلية المثبتة والمغلقة

كانت بوابة Q15 تقرأ `previousPointer` و`previous.artifact/manifest` عبر `resolve` دون إثبات بقائها داخل `release-artifacts`، ولم تكن تثبت أن `current.artifact/current.manifest` يشيران إلى شجرة Pages التي راجعتها. كان manifest مزور محليًا قادرًا على توجيه التدقيق إلى ملف خارج نطاق الإصدار.

أضيف الآن:

- رفض absolute/NUL/Windows-drive لكل pointer.
- `resolveWithin` وفشل مغلق عند traversal لكل مؤشرات previous.
- مطابقة current artifact وmanifest حرفيًا بعد الحل مع `pages-dist` المراجع.
- اختبار يثبت رفض `../../outside.json` وcurrent artifact بديل.

## القبول الحالي

- اختبارات Q15: 3/3 ناجحة.
- Q13/Q14: 4/4 ناجحة من الجولة السابقة.
- live drift gate: 294 ملفًا، candidate `bf3529ee...`، previous `ed164bd9...`، 23 عملاً، 6/6 خرائط Word.
- لا deploy ولا secret حقيقي ولا mutation لبيانات المستخدم.

## الاستئناف الخارجي

استدعاء `release:verify` بعد آخر candidate مباشرة، توقيع Q13 بمفتاح release من secret manager، ثم preview مصرح به وفحص `/ready` وheaders/routes/cache/offline وsmoke جهازين؛ بعدها فقط قرار production.
