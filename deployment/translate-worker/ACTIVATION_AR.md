# تفعيل Hy-MT2 تدريجيًا

التغييرات في فرع محلي `task/hymt2-local-agent` من `abomalikmohammad1980-sys/library-web-engine`. أثبت الفحص أن main عند `5de644880017dd71a308d8207a0360cd81114f81` يختلف عن Cloudflare؛ لذلك أُعيد دمج Hy-MT2 على المصدر المنشور للإصدار 34 بتاريخ 2026-10-03. نسخة سطح المكتب لم تُعدّل. لم يحدث نشر أو تغيير موارد أو أسرار تشغيل.

## ما أُضيف

- Hy-MT2-7B Q4_K_M للغات المشتركة الـ22 فقط: `en fr tr ur ug fa hi id ms bn ru uk de es pt it nl pl kk zh ja ko`.
- اللغات الـ14 الأخرى تبقى على المسار الحالي: `ckb ku sw hu ps so ha sv no ro bs sq az uz`.
- يظل ترتيب fallback للنص: Azure ثم DeepL ثم Gemini ثم Groq ثم Mistral ثم OpenRouter ثم Cloudflare AI. الواجهة تبدأ DeepL ثم Azure. مسار المقاطع الحالي يحتفظ بترتيب دفعاته أيضًا.
- طابور سحب دائم مكافئ لـ Queue، داخل **LocalTranslationQueue** بقاعدة SQLite وأربعة shards. لا يحتاج Cloudflare API Token على اللابتوب؛ الاتصال بـ Worker فقط.
- حجز عشوائي لمدة 180 ثانية وتجديد كل 25 ثانية، مع منع الحفظ بحجز منتهي. السحب واحد تلو الآخر بما يناسب `--parallel 1`.
- نفس مفاتيح `tm:v2` و`n1` و`s1` ونفس R2/KV. تبقى المقاطع المرجع الدائم للنصوص الطويلة؛ لا نكتب نسخة R2 كاملة مكررة عند تركيب المقاطع.
- كذلك تُحفظ ذاكرة `auto/v1` وسجل `automatic-catalog:v1` القائمان. يسحب العامل الأعمال الناقصة منه ويحدث عداداته القديمة. يبقى حجز حصص `provider-quotas:v1` وجدول التشغيل كل خمس دقائق.
- fallback للفهرس التلقائي يبقى DeepL ثم Gemini ثم Groq ثم Mistral ثم OpenRouter ثم Cloudflare AI. Azure يظل معطلًا لهذا المسار كما في الإنتاج.
- فحص الذاكرة قبل التسجيل، وعند السحب، وقبل كل مقطع، وقبل الحفظ. تظل صيغ JSON القديمة والنص المضغوط ومفاتيح KV القديمة قابلة للقراءة.
- كتابة R2 مشروطة `If-None-Match: *`: أول ترجمة محفوظة تبقى المعتمدة. عدّاد الإنجاز في SQLite idempotent؛ Analytics قياس مساعد best-effort وليس مصدر عدّ التقدم.
- فحص الفراغ، UTF-8، الطول، الأرقام، التكرار، بعض أنظمة الكتابة، والناتج المبتور. هذه فحوص بنيوية ولا تثبت وحدها صحة المعنى في اللغات الـ22.

## اختبار محلي دون إنتاج

من جذر المستودع، باستخدام Node.js 22.13 أو أحدث (اختبارات SQLite)؛ استُخدم Node.js 24.19.0 أثناء التنفيذ:

```powershell
node --check deployment/translate-worker/src/index.js
node --experimental-vm-modules --test deployment/translate-worker/test/*.test.mjs
npx --yes wrangler@4.151.0 deploy --dry-run --config deployment/translate-worker/wrangler.toml
```

للمحاكاة المحلية استخدم الإعداد المنفصل التالي؛ لا يحتوي AI أو routes أو ربطًا بعيدًا:

```powershell
npx --yes wrangler@4.151.0 dev --local --config deployment/translate-worker/wrangler.local.toml --port 8787
```

أنشئ داخل `deployment/translate-worker/.dev.vars` قيمتين **اختباريتين فقط** بطول 32 محرفًا على الأقل باسم `LOCAL_TRANSLATION_AGENT_TOKEN` و`LOCAL_TRANSLATION_ENQUEUE_TOKEN`. الملف مستبعد أصلًا من Git. لا تضع مفاتيح حقيقية فيه لاختبار المحاكاة. تشغيل `dev` بالإعداد الرئيسي ليس بديلًا لهذا الأمر: الإعداد الرئيسي يتضمن Workers AI.

## المرحلة الأولى — بعد موافقة المستخدم على النشر والموارد والأسرار

كل أوامر هذا القسم مؤجلة؛ لم تُنفذ. يجب أن يكون حساب Wrangler هو الحساب الذي يملك العامل الحالي `khezana-translate-router`.

**مرجع التفعيل:** اكتمل تنزيل المصدر المنشور وفحص سجل التقدم وعيّنات R2/KV بتاريخ 2026-10-16. اقرأ [نتيجة الفحص المباشر](LIVE_AUDIT_AR.md). قبل النشر أعد قراءة الإصدار النشط؛ إن تغير عن `f6634c4b-fb27-442b-b7b6-60961b99d5e6` قارن التغيير أولًا. جلسة الفحص للقراءة فقط؛ صلاحيات النشر تُطلب بعد موافقة المستخدم. رمز R2/KV المؤقت ليس مفتاح العامل.

```powershell
cd deployment/translate-worker
npx --yes wrangler@4.151.0 whoami
npx --yes wrangler@4.151.0 deployments list --config wrangler.toml
npx --yes wrangler@4.151.0 deploy --dry-run --config wrangler.toml
npx --yes wrangler@4.151.0 deploy --config wrangler.toml
npx --yes wrangler@4.151.0 secret put LOCAL_TRANSLATION_AGENT_TOKEN --config wrangler.toml
npx --yes wrangler@4.151.0 secret put LOCAL_TRANSLATION_ENQUEUE_TOKEN --config wrangler.toml
```

أدخل سرين مختلفين عشوائيين قويين، كل واحد 32 محرفًا على الأقل، عبر مطالبة Wrangler التفاعلية. لا تضعهما في سطر الأوامر أو المستودع. مفتاح العامل يُستخدم على اللابتوب. مفتاح enqueue يبقى عند المسؤول/منتج الفهرس.

أول نشر يبقي أعلام `HY_MT_ENABLED` و`HY_MT_AUTOMATIC_ENABLED` و`HY_MT_REQUEST_ENABLED` كلها `"false"`. تنشئ صيغة `[exports.LocalTranslationQueue]` مساحة SQLite الجديدة، كما تستخدم النسخة الحالية `[exports.TranslationCoordinator]`. لا تضف migration يعيد إنشاء المنسق الحالي، ولا تغيّر أسماء الربط أو KV/R2/Analytics أو مفاتيح بيانات المنسق. حُفظ cron القائم `*/5 * * * *`. أُكدت صيغة exports باستخدام schema وdry-run في Wrangler 4.151.0.

## المرحلة الثانية — عينة خلفية صغيرة

غيّر **HY_MT_ENABLED فقط** إلى `"true"`، واترك `HY_MT_AUTOMATIC_ENABLED="false"` و`HY_MT_REQUEST_ENABLED="false"`، ثم أعد dry-run والنشر **بعد الموافقة**. هكذا تعمل العينة الداخلية وتظل طلبات الموقع والفهرس التلقائي على مسارهما الحالي.

أنشئ ملف NDJSON بترميز UTF-8، سطر واحد لكل نص. مثال لعينة إنجليزية:

```json
{"text":"فتح الباري شرح صحيح البخاري","targetLanguage":"en","purpose":"text","sourceType":"title"}
{"text":"محمد بن إسماعيل البخاري","targetLanguage":"en","purpose":"text","sourceType":"author"}
```

السطر الذي لا يتضمن `targetLanguage` يسجل النص للغات الـ22 فقط. `purpose` هو `text` أو `ui`، ولا تغيره بعد اختيار الغرض الفعلي لأن الغرض جزء من هوية الذاكرة.

من مجلد `translate-worker`، شغّل أداة التسجيل. مفتاح التسجيل هنا يقرأ بشكل مخفي ولا يوضع في الملف:

```powershell
$env:LOCAL_TRANSLATION_URL = 'https://khzanah.com'
$secureToken = Read-Host 'Enqueue token' -AsSecureString
$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
    $env:LOCAL_TRANSLATION_ENQUEUE_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
    node local-agent/enqueue.mjs 'C:\path\catalog.ndjson'
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
    Remove-Item Env:LOCAL_TRANSLATION_ENQUEUE_TOKEN -ErrorAction SilentlyContinue
}
```

يمكن إعادة تشغيل الاستيراد من البداية: Cloudflare يرفض التكرار ويعيد استخدام الموجود، ولا يوجد ملف محلي يحدد نقطة التقدم. ابدأ بـ5–20 نصًا ولغة واحدة ثم شغّل `local-agent/Start-Translation.cmd`. تحقق من completed، ومن وصول الترجمة عبر API العادي، ثم أوقف العامل أثناء مهمة وأعد تشغيله للتحقق من الاستئناف. افصل الإنترنت مؤقتًا لاختبار إعادة الإرسال.

استيراد NDJSON للعينة أو لمصادر إضافية فقط. **لا تعِد استيراد الفهرس القائم**: الإنتاج يملك سجلًا دائمًا بالمصادر والأعمال الناقصة. شاشة العامل تعرض عدادات الطابور المحلي، وسطرًا مستقلًا `Library` من سجل Cloudflare القديم لكل الأجهزة واللغات الـ36.

## المرحلة الثالثة — التوسيع واعتماد المزود الأساسي

بعد نجاح العينة وموافقة التوسيع، غيّر `HY_MT_AUTOMATIC_ENABLED="true"` وأعد dry-run والنشر. عند فتح ملف التشغيل يسحب من `automatic-catalog:v1` الناقص في اللغات الـ22 تلقائيًا، دون ملف تقدم أو إعادة إدخال الفهرس. تُحفظ النتيجة بصيغة `auto/v1` وتظهر عبر lookup القائم، ثم تُحدَّث عدادات Cloudflare القديمة مرة واحدة. عند انقطاع الجهاز يستمر المجدول القائم بمزوّديه؛ اللغات الـ14 تبقى عليه دائمًا.

راقب `failed` و`health:translation-provider:v1:hymt2-local` وAnalytics؛ نوع المصدر في blob12. حجز حصص fallback يبقى في `provider-quotas:v1` كما في المصدر المنشور. لا تغيّر قيم الحصص أو تفعيل Azure التلقائي.

بعد الموافقة على تفعيل الطلبات، غيّر `HY_MT_REQUEST_ENABLED="true"` ثم نفذ dry-run والنشر. عند غياب ترجمة من الذاكرة، يحاول الموقع Hy-MT2 أولًا إذا كان العامل متصلًا، بانتظار محدود `HY_MT_WAIT_MS=10000` (حد أقصى 20000). إذا كان الجهاز مغلقًا أو انتهت المهلة يعود للمسار الحالي. العينة الخلفية والاستيراد لا يحتاجان انتظار طلب من زائر.

قد تتزامن محاولة fallback مع توليد محلي بدأ قبل انتهاء مهلة الموقع؛ الكتابة المشروطة تحمي الذاكرة ويُعاد فحصها قبل كل مقطع. لا يمكن ضمان تنفيذ الاستدلال مرة واحدة بالضبط عند انقطاع الشبكة، لكن الحفظ والتقدم يمنعان تكرار الأثر أو استبدال ترجمة موجودة.

إذا فشل Hy-MT2 أو فشل فحصه، ينفذ Worker مسار fallback نفسه مع تعطيل إعادة الدخول إلى Hy-MT2. عند فشل كل المزودين تؤجل المهمة ثم تعاد، حتى أربع دورات fallback، ثم تُصنف failed. إعادة المحاولة يدوية ومحددة بالمعرّف؛ لا يوجد زر لمسح الذاكرة أو إعادة ترجمتها.

لإعادة مهمة failed استخدم نفس إعدادات مفتاح التسجيل، ثم `node local-agent/enqueue.mjs --retry JOB_ID`؛ انسخ المعرّف من سطر Failed في نافذة العامل أو من `failedItems` في status. تبقى إعادة المحاولة على مسار fallback ولا تعيد ترجمة المقاطع المحفوظة.

## عقد الاتصال الداخلي

المسار الأساسي: `/api/translate/internal/local/`. كل الطرق تتطلب HTTPS و`Authorization: Bearer ...` وتمنع ترويسة Origin. لا توضع الأسرار في query string ولا يمنح العامل صلاحية إرسال النصوص أو مفاتيح R2 ضمن نتيجة.

| العملية | الطريقة | المفتاح | الطلب |
|---|---|---|---|
| enqueue | POST | مسؤول التسجيل | text, targetLanguage, purpose, sourceType |
| retry | POST | مسؤول التسجيل | id لمهمة failed |
| status | GET | العامل | بلا جسم |
| heartbeat / pull | POST | العامل | model=`Hy-MT2-7B-Q4_K_M`, utf8Probe=`مرحبا بالعالم`؛ pull يقبل shard |
| renew / complete | POST | العامل | id, token للحجز |
| prepare | POST | العامل | id, token, index؛ فحص الذاكرة قبل الاستدلال |
| result | POST | العامل | id, token, index, translation, finishReason, latencyMs |
| fail | POST | العامل | id, token, reason |

لا يُخزن التقدم على اللابتوب. كلمة token في طلب المهمة هي رمز حجز مؤقت وليست مفتاح Cloudflare. 409 يعني انتهاء الحجز؛ لا يجوز حفظ نتيجة قديمة بعده. 503 خطأ مؤقت في التخزين أو الخدمات، وتظل المهمة قابلة للاستئناف. توجد أربعة shards ثابتة؛ لا تغيّر عددها بعد التفعيل دون ترحيل بيانات.

## الإيقاف والتراجع

للإيقاف التشغيلي أغلق العامل المحلي. لإيقاف المسار الجديد بالكامل اجعل `HY_MT_ENABLED="false"` وأعد النشر بعد الموافقة، مع الاحتفاظ بربط/export الطابور. لا تحذف namespace أو R2 أو KV. ستظل كل الترجمات المحفوظة قابلة للقراءة من المسار القديم. لا ترجع عميانيًا إلى إصدار يحذف Durable Object الجديد.

## مراجع التنفيذ

قائمة النموذج مأخوذة من [Tencent Hy-MT2-7B](https://huggingface.co/tencent/Hy-MT2-7B) ومقاطعة مع LANGUAGES في Worker. الاستئناف مبني على [SQLite Durable Object storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)، والحفظ المحمي على [R2 conditional operations](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/#conditional-operations). فحص النموذج والقالب وعدد الرموز يتبع [llama.cpp server API](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md).
