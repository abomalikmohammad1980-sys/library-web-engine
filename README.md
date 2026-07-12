# Library Web Engine

محرك عرض ويب للكتب العربية (ملفات Word ‏.docx بتنسيق المكتبة الشاملة) بهدف **مطابقة هندسية كاملة مع Microsoft Word** — وخاصة النص العربي (كسر الأسطر، ارتفاع السطر، التسويغ بالكشيدة).

## ابدأ من هنا

| الوثيقة | دورها |
|---|---|
| [docs/architecture.md](docs/architecture.md) | الخطة المعمارية — ماذا نبني ولماذا |
| [docs/playbook.md](docs/playbook.md) | دليل التنفيذ — كيف يُدار المشروع (منفّذ واحد + أسطول وكلاء AI) |
| [docs/prd.md](docs/prd.md) | متطلبات المنتج |
| [AGENTS.md](AGENTS.md) | **دستور الوكلاء — إلزامي قبل أي مهمة** |
| [docs/adr/](docs/adr/) | سجل القرارات المعمارية |
| [docs/word-behavior-spec/](docs/word-behavior-spec/) | مواصفة سلوك Word الحية — ذاكرة المشروع |
| [PROGRESS.md](PROGRESS.md) | سجل تنفيذ المرحلة الجارية |

## الفكرة في سطرين

محرك تخطيط نصوص مملوك (TypeScript نقي) يعمل وقت تحضير الكتاب افتراضيًا (الوضع أ) وداخل المتصفح عند الطلب (الوضع ب)، يستأجر التشكيل من HarfBuzz والترسيم من Canvas، ويُقاس ضد **مُحكِّم Word** (إحداثيات الحقيقة من XPS) في كل بناء.

## الهيكل

```
packages/   المحرك وطبقاته (ooxml-model, font-system, shaper, bidi, layout,
            scene, paint, interact, a11y, search, oracle-client)
tools/      word-oracle, census, prep, corpus
reference/  محرك Dart الأصلي + دروسه (قراءة فقط — مصدر الترجمة)
corpus/     كتب الاختبار + ملفات الحقيقة (Git LFS)
docs/       الوثائق الحاكمة
app/        قشرة الواجهة
```
