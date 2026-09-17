# SPEC — ربط القشرة `app/` بمحرك `ooxml-model` (المرحلة 1)

**الحالة:** مُجمّدة كعقد المرحلة 1 (2026-08-05). أي تغيير يتطلب ADR يعتمده المنفّذ.

## الغرض

عقد أدنى بين قشرة الواجهة ومحرك OOXML: كيف يفتح القارئ كتاب docx حقيقيًا ويعرض
صفحاته (نص + تنسيقات) دون بيانات وهمية، وبلا تبعية workspace (قيد بيئي Windows).

## ربط الحزم (قيد بيئي)

- لا `workspace:*` في `app/package.json` — `pnpm install` يفشل بـ `ERR_PNPM_EISDIR`
  لغياب صلاحيات إنشاء symlink على هذا الجهاز.
- الربط عبر مسارين متزامنين إلى مصدر الحزمة `packages/ooxml-model/src/index.ts`:
  - `app/tsconfig.json`: `compilerOptions.paths["@engine/ooxml-model"]`
  - `app/vite.config.ts`: `resolve.alias["@engine/ooxml-model"]` عبر `resolve(__dirname, ...)`

## واجهة القارئ (المستهلك)

- `app/src/engine/bridge.ts` — نقي DOM (لا `h()`):
  - `loadBook(url: string): Promise<LoadedBook>` — جلب docx (ArrayBuffer) ←
    `extractFromDocx` ← `splitPages`.
  - `splitPages(model: DocModel): BookPage[]` — صفحة تبدأ عند فقرة `pageBreakBefore`
    بعد فقرة محتوى؛ الفقرات `excluded`/`tableCell`/فارغة النص لا تبدأ صفحة ولا تُضمّ.
  - `LoadedBook { model, pages, errors? }` — `pages` هي التي يستهلكها القارئ.
- `app/src/engine/render.ts` — `paragraphToDom(p: BodyParagraph): HTMLParagraphElement`
  (لا innerHTML؛ نص عبر createTextNode؛ وحدات twips→px: `twips × 20/96`).

## نموذج المحرك (المصدر)

- `extractFromDocx(buffer: Uint8Array): DocModel` من `packages/ooxml-model` —
  محلول الأنماط؛ الفقرات تحمل `pageBreakBefore` (من `w:lastRenderedPageBreak` داخل
  `w:r` و`w:br type=page` و`w:pageBreakBefore`)، `runs[]` (family/emTwips/bold/italic/
  underline/color/cssFontFamily)، `jc`, `bidi`, `indFirstLine/indLeft/indRight` (twips).
- مرجع تقسيم الصفحات: `reference/dart-engine/lib/Utils/WordUtils.dart` (تصفية
  `lastRenderedPageBreak`).

## معايير القبول

1. `pnpm exec vitest run` في `app/` أخضر (اختبارات bridge على docx حقيقي).
2. `pnpm build` + `pnpm test` من الجذر أخضران.
3. `#/reader/:id` لكتاب يحمل `docx` يعرض نصًا عربيًا فعليًا بخطوطه وتنسيقاته
   من النموذج، مع pager صحيح.

## خارج النطاق (للمرحلة 2)

- التفاف النص بمحركنا وترسيم Canvas (`scene`/`paint`). حاليًا `render.ts` يسلّم
  الترسيم للمتصفح، والتنسيقات (size/weight/family/align/indents) تأتي من النموذج
  لا من تخمين CSS.
- تحديد/نسخ، بحث، وصولية.
