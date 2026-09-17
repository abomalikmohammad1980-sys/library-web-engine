# بوابة staging المحلية لمزامنة المصدر — 2026-08-08

## الغرض وحد الأمان

بروفة محلية قابلة للتكرار تسبق staging البعيدة، ولا تتصل بشبكة ولا تقبل مسار قاعدة
من المستخدم. كل تشغيل ينشئ مجلدًا وقاعدة SQLite مؤقتين باسم عشوائي تحت مجلد النظام
المؤقت، ثم يغلق القاعدة ويحذف المجلد في `finally` حتى عند الفشل. القيم المستخدمة
bindings محلية وهمية وليست أسرارًا، ولا يحدث deploy أو قراءة لبيانات المكتبة.

## التشغيل

```powershell
pnpm --filter @library/source-sync-cloudflare staging:local
```

النجاح: اختبار واحد أخضر، وهو يشغل البوابة مرتين على قاعدتين منفصلتين ويقارن
النتيجة الحتمية. الفشل يمنع الانتقال إلى staging البعيدة.

## ما تثبته البوابة

1. تطابق SHA-256 ثم تطبيق migrations ‏0001→0011 بالترتيب.
2. سجل Word legacy قبل 0011 ثم backfill إلى `logical_works` ونسخ DOCX.
3. عقدا `/ready` و`/health` الفعليان عبر D1 adapter محلي: 200 وready/ok.
4. وجود triggerي conflict/source-edition CAS ورفض stale version في كليهما.
5. جهازان نشطان: الثاني يحسم conflict، والأول يسجل rollback منشورًا.
6. حجر synthetic ينتقل من pending إلى allowed بعد lease، ثم تحرير lease.
7. تبديل publication إلى build تالٍ وزيادة cache version وإيصال invalidation.
8. إرفاق EPUB alternate دون تبديل Word authority.

هذه بوابة schema/integration محلية؛ اختبارات authority/router/store القائمة تكمل
التحقق من HTTP وIDOR وidempotency. لا تستبدل D1/R2/OIDC/PDF staging الحقيقية ولا
تثبت خصائص Cloudflare التشغيلية أو الشبكة.

## الدليل

- التنفيذ: `packages/source-sync-cloudflare/src/local-staging-gate.ts`.
- التكرار: `packages/source-sync-cloudflare/src/local-staging-gate.test.ts`.
- Cloudflare والبناء داخل البوابة الجامعة أخضران.
- مسار المزامنة الحالي: 296 اختبارًا ناجحًا في 78 ملفًا، واختبار COM اختياري
  متجاوز؛ بناء الحزم الأربع أخضر.
