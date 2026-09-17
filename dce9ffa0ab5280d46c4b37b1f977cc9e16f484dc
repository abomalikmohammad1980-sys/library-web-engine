# تدقيق تثبيت وبدء مرافق مزامنة المصدر — 2026-08-08

## الفجوتان المكتشفتان

1. كان tarball يضم `src` والاختبارات و`tsbuildinfo`، وكان `dist/cli-main.js`
   يحتفظ باستيرادات نسبية إلى حزم workspace؛ ينجح داخل المستودع ويفشل بعد التثبيت.
2. كان `provision-check/remote-check` يكتفي بـHTTP 200 من `/ready`، فيقبل body
   يصرح `ready:false` أو missing bindings/tables.

## الإصلاح

- حُصرت الحزمة المنشورة في `dist` و`SPEC.md`.
- يبني esbuild ملفي `cli-main.js` و`index.js` مستقلين مع shebang محفوظة، بينما
  يبقى tsc مسؤولًا عن declarations وفحص الأنواع.
- صار preflight يفك JSON ويفرض `ready===true` و`bindings=[]` و`missingTables=[]`؛
  body ناقص/تالف أو ready=false يعيد exit 5 بلا متابعة build/PDF checks.

## بوابة التثبيت البارد

`pnpm --filter @library/source-sync-node verify:installability` ينفذ بلا شبكة:

1. build نظيف للحزمة؛
2. `pnpm pack`؛
3. `npm install` للـtarball في مجلد مؤقت مستقل؛
4. تشغيل الملف المثبت فعليًا لأوامر `config-check`, `provision-check`,
   `remote-check` ضد خادم HTTP محلي read-only؛
5. حقن `ready:false` والتأكد من exit 5؛
6. فحص أن stdout/stderr لا يحتويان السر أو مسار config؛ ثم حذف المجلد المؤقت.

النتيجة: `package-installability-ok` لأربعة أوامر. اختبار unit إضافي يغطي
ready=false وmissing binding وmissing table وJSON تالف مع HTTP 200.

لم يحدث نشر أو اتصال خارجي ولم تستخدم أسرار حقيقية.
