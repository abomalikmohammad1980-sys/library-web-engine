/**
 * ‏@engine/ooxml-model — نواة نموذج المستند (v0: مستخرج فقرات المتن).
 *
 * ترجمة مفاهيمية من المحرك المرجعي `reference/dart-engine/lib/wordToHTML/`
 * (‏AddDocData ← ParagraphXmlParsing ← StyleRefResolver) بنفس أسماء المفاهيم:
 * سلسلة حلّ الخصائص: خصائص الـ run المباشرة ← نمط الفقرة (pStyle، مع basedOn
 * تكراريًا) ← افتراضيات المستند (docDefaults).
 *
 * النطاق عمدًا (v0): نص فقرات المتن + الخط/الحجم الفعالين + هندسة العمود —
 * ما يحتاجه كاسر الأسطر v1. الجداول/الصور/الحقول تُقصى وتُعلَّم.
 */
import { unzipSync } from "fflate";
import { XMLParser, XMLBuilder } from "fast-xml-parser";

// ---------- الأنواع
export interface EffectiveRun {
  text: string;
  /** نص Word الخام للمطابقة مع Document.Range.Text. يختلف عن نص العرض فقط
   * للخطوط الرمزية القديمة: Word COM يعيد بايت الرمز بينما الرسم يحتاج PUA. */
  sourceText?: string;
  /** معادلة Word ‏(OMML) محفوظة كبنية دلالية؛ text هو تمثيلها الخطي للبحث. */
  math?: MathNode | null;
  /** اتجاهٌ صريح على مستوى الرنّ من w:rtl/w:ltr؛ null/غياب = يرث الفقرة. */
  direction?: "rtl" | "ltr" | null;
  /** مرجعُ حاشية/تعليقٍ ختاميّ في هذا الرنّ (رقمُه التسلسليّ ومعرّفه) — أو null */
  noteRef?: { id: string | null; num: number; kind: string; fmt?: string;
    /** w:customMarkFollows: Word uses the following run text as the mark and
     * does not substitute an automatic sequence number. */
    custom?: boolean; customMark?: string } | null;
  /** موضع w:footnoteRef/w:endnoteRef داخل قصة الحاشية، وليس مرجعًا جديدًا. */
  noteBodyRef?: "footnote" | "endnote" | null;
  /** ‏w:vertAlign=superscript — علامةُ الحاشية تُرفَع وتُصغَّر (تدخل صندوق السطر) */
  superscript?: boolean;
  /** رابط تشعبي (من w:hyperlink) — يُفتَح عند النقر */
  href?: string | null;
  /** ‏w:b أو w:bCs — عريض (يرفع ارتفاع السطر: آليّة الصندوق) */
  bold?: boolean;
  /** رنُّ **نتيجةِ حقل صفحة** — يُستبدَل نصُّه وقت الترصيف. */
  fieldResult?: string | null;
  family: string | null;
  /** حجم الخط بالـ twips ‏(w:sz أنصاف نقاط × 10) — شبكة ADR-0004 */
  emTwips: number | null;
  /** ‏w:vanish — نص مخفي لا يعرضه Word (تستخدمه علامات {{PG:N}} في خط التحضير) */
  hidden: boolean;
  /** لونُ النصّ RRGGBB (‏w:color أو themeColor محلولًا) — null يعني «يقرّره Word» */
  color?: string | null;
  /** ‏w:highlight — اسمُ لونِ التظليل (yellow/cyan…) كما يسمّيه OOXML */
  highlight?: string | null;
  /** ‏w:u@val — نوعُ التسطير (single/double/…)، وnone/غياب = بلا تسطير */
  underline?: string | null;
  /** لونُ التسطير إن خالف لونَ النصّ */
  underlineColor?: string | null;
  /** ‏w:strike / w:dstrike — شطبٌ مفردٌ أو مزدوج */
  strike?: boolean;
  doubleStrike?: boolean;
  /** ‏w:caps / w:smallCaps — تكبيرُ الحروف (لا أثرَ في العربيّة، وله في اللاتينيّة) */
  caps?: boolean;
  smallCaps?: boolean;
  /** ‏w:i / w:iCs — مائل */
  italic?: boolean;
  /** ‏w:vertAlign=subscript */
  subscript?: boolean;
  /** ‏w:spacing@val — تباعدُ المحارف بالـtwips (موجبٌ يوسّع، سالبٌ يضيّق) */
  charSpacing?: number;
  /** ‏w:position@val — رفعُ/خفضُ خطّ الأساس (أنصافُ نقاط ⟵ twips ×١٠) */
  position?: number;
  /** ‏w:kern@val — أدنى حجمٍ يُفعَّل عنده التقنين (أنصافُ نقاط) */
  kern?: number;
  /** ‏w:w@val — مقياس عرض المحارف نسبةً مئويةً (100 = بلا تغيير). */
  charScale?: number;
  /** ‏w14:textFill/w14:gradFill — تدرج حشو الغليفات، لا خلفية الرن. */
  textGradient?: { angle: number; stops: { pos: number; color: string }[] };
  /** ‏w14:textOutline — حد الغليف بعرض twips ولون محلول. */
  textOutline?: { widthTwips: number; color: string };
  /** ‏w14:shadow — ظل الغليف: إزاحة وتمويه بالـtwips ولون/عتامة محلولان. */
  textShadow?: { xTwips: number; yTwips: number; blurTwips: number; color: string; opacity: number };
  /** ‏w14:reflection — نسخة غليف مستقلة لا تدخل قياس السطر أو التفافه. */
  textReflection?: { xTwips: number; yTwips: number; blurTwips: number;
    scaleX: number; scaleY: number; startOpacity: number; endOpacity: number;
    startPosition: number; endPosition: number; fadeAngle: number };
  /** ‏w14:ligatures — مجموعة ميزات ligature المطلوبة صراحة. */
  ligatures?: string;
  /** ‏w:lang — لغات النص اللاتيني/ثنائي الاتجاه/شرق آسيا بعد سلسلة الأنماط. */
  language?: string;
  bidiLanguage?: string;
  eastAsiaLanguage?: string;
}

export type PageFieldKind = "PAGE" | "NUMPAGES" | "SECTIONPAGES";

/** اسم الحقل هو أول token في تعليمة Word؛ PAGEREF حقل مستقل وليس PAGE. */
export function pageFieldKind(instruction: string): PageFieldKind | null {
  const name = instruction.trim().match(/^([A-Za-z]+)/)?.[1]?.toUpperCase();
  return name === "PAGE" || name === "NUMPAGES" || name === "SECTIONPAGES" ? name : null;
}

/** ترميز STYLEREF يحتفظ بمعرّف النمط كي يستطيع الرأس حله لكل صفحة. */
export function styleRefField(instruction: string, styles: StyleTable): string | null {
  const match = instruction.trim().match(/^STYLEREF\s+(?:"([^"]+)"|([^\s\\]+))/i);
  const name = match?.[1] ?? match?.[2];
  if (!name) return null;
  // Built-in heading names are stored in styles.xml in English even when the
  // field instruction uses Word's localized UI name (e.g. «عنوان 2»).
  const heading = name.match(/^عنوان\s*(\d+)$/);
  const candidates = [name, name.toLowerCase(), ...(heading ? [`heading ${heading[1]}`, `Heading${heading[1]}`] : [])];
  const id = candidates.map(candidate => styles.nameToId.get(candidate)
    ?? styles.nameToId.get(candidate.toLowerCase())
    ?? (styles.byId.has(candidate) ? candidate : null)).find(Boolean) ?? null;
  return id ? `STYLEREF:${id}` : null;
}

/** الحد الأدنى الدلالي المشترك بين OMML وMathML، مع إبقاء الفروع غير المعروفة صفوفًا. */
export type MathNode =
  | { kind: "row"; children: MathNode[] }
  | { kind: "text"; text: string }
  | { kind: "fraction"; numerator: MathNode; denominator: MathNode }
  | { kind: "sup" | "sub"; base: MathNode; script: MathNode }
  | { kind: "subsup"; base: MathNode; sub: MathNode; sup: MathNode }
  | { kind: "radical"; degree: MathNode | null; radicand: MathNode }
  | { kind: "delimiter"; begin: string; end: string; content: MathNode }
  | { kind: "matrix"; rows: MathNode[][] }
  | { kind: "nary"; operator: string; base: MathNode; sub: MathNode | null; sup: MathNode | null; limits: boolean }
  | { kind: "accent"; base: MathNode; char: string; position: "top" | "bottom" }
  | { kind: "function"; name: MathNode; argument: MathNode }
  | { kind: "limit"; base: MathNode; limit: MathNode; position: "lower" | "upper" };
export interface BodyParagraph {
  index: number;
  /** أسماء w:bookmarkStart الواقعة في الفقرة — أهدافُ الروابط الداخلية والفهرس. */
  bookmarkIds?: string[];
  runs: EffectiveRun[];
  text: string;
  styleId: string | null;
  jc: string | null;
  bidi: boolean;
  /** مسافات بادئة بالـ twips */
  indLeft: number;
  indRight: number;
  indFirstLine: number;
  excluded: false | "table" | "drawing" | "field" | "tab" | "sym" | "empty";
  /** فهرس مقطع الفقرة في DocumentModelV0.sections */
  sectionIndex: number;
  /** فقرة معدودة (w:numPr بـnumId فعّال) — علامتها تُرسم ولا تعيش في النص */
  numbered: boolean;
  /** معرّف الترقيم (numId) لتجميع الفقرات المعدودة */
  numId: string | null;
  /** مستوى الترقيم (ilvl) للفقرات المعدودة متعددة المستويات */
  ilvl: string | null;
  /** كائنات عائمة مرساة في هذه الفقرة (wp:anchor) — تضيّق أسطر الجوار */
  anchors: FloatAnchor[];
  /** ‏w:spacing محسومًا (مباشر ← سلسلة النمط ← docDefaults) — الترصيف الرأسي */
  spacing: SpacingProps;
  /** حجم «علامة الفقرة» (rPr داخل pPr ← النمط) بالـ twips — يشارك في ارتفاع
   *  السطر ولو غير مرئي (فرضية masjid ‏a4: ‏+19..21 = فرق نصف نقطة) */
  markEmTwips: number | null;
  /** خط علامة الترقيم بشريحة ASCII (rFonts ascii من rPr علامة الفقرة) —
   *  أرقام العلامة «1.» لاتينية فتُرسم به وترفع ascent سطرها (لغز 586) */
  markAsciiFamily: string | null;
  /** Resolved paragraph-mark face; supplies the line box of a textless paragraph. */
  paragraphMark?: { family: string | null; emTwips: number | null; bold: boolean; italic: boolean };
  /** يجب أن تبدأ هذه الفقرة في صفحةٍ جديدة — من w:pageBreakBefore، أو كسرِ
   *  صفحةٍ صريح (w:br type=page) قبلها، أو حدِّ مقطعٍ (sectPr nextPage). generic. */
  pageBreakBefore: boolean;
  /** عدد حدود الصفحات قبل الفقرة. أكبر من 1 يحفظ صفحات فارغة/كسورًا
   * متتالية لا يستطيع boolean تمثيلها. */
  pageBreaksBefore?: number;
  /** ضبط الأرملة/اليتيم (w:widowControl) — افتراضيّ Word مُفعَّل (true)؛ val=0 يعطّله.
   *  مُفعَّلًا: لا يُترَك سطرٌ وحيدٌ للفقرة أعلى صفحةٍ أو أسفلها عند الكسر. */
  widowControl: boolean;
  /** ‏w:suppressAutoHyphens — تعطيل الفصل الآلي للكلمات في هذه الفقرة. */
  suppressAutoHyphens?: boolean;
  /** ‏w:outlineLvl: ‏0..8 عنوان، و9 متن بلا مستوى outline. */
  outlineLevel?: number | null;
  keepNext?: boolean;
  keepLines?: boolean;
  /** ‏w:contextualSpacing — يلغي before/after لهذه الفقرة عند مجاورة فقرة
   * من النمط نفسه؛ يبقى كل جانب مستقلًا حتى لا نسقط مسافة الفقرة الأخرى. */
  contextualSpacing?: boolean;
  /** ‏w:snapToGrid=0 — هذه الفقرةُ لا تتبع شبكةَ المستند */
  snapToGrid?: boolean;
  /** ‏w:framePr — إطار فقرة الرأس/التذييل. الفقرات المتجاورة ذات التوقيع
   * نفسه تنتمي إلى إطار مركب واحد وتعلو فقرة الارتكاز التالية. */
  framePr?: { signature: string; w: number | null; h: number | null;
    x: number | null; y: number | null; hSpace: number; vSpace: number;
    hAnchor: string; vAnchor: string; xAlign: string | null;
    yAlign: string | null; wrap: string } | null;
  /** ‏w:br type="column" في الفقرة — تبدأ التاليةُ عمودًا جديدًا */
  columnBreak?: boolean;
  /** مواضع فواصل الأعمدة داخل نص الفقرة المرئي؛ الموضع يسبق محرف \n التمثيلي. */
  columnBreakAt?: number[];
  /** تظليلُ الفقرة (‏w:pPr/w:shd@w:fill أو themeFill محلولًا) — RRGGBB أو null */
  shd?: string | null;
  /** ‏w:pBdr — حدودُ الفقرة (تزيد ارتفاعها بسُمكها + w:space) */
  pBdr?: { top: BorderSide | null; bottom: BorderSide | null;
    left: BorderSide | null; right: BorderSide | null } | null;
  /** توقّفات الجدولة المخصّصة (w:pPr/w:tabs/w:tab) — بالـtwips. */
  tabStops: TabStop[];
  /** مواضعُ w:tab داخل نصّ الفقرة (فهارس محارف) — للقفز إلى التوقّف التالي. */
  tabAt: number[];
  /** ‏w:ptab — جدولةٌ **مطلقةُ الموضع** لا تتبع شبكةَ التوقّفات: تقفز إلى موضعٍ
   *  محسوبٍ من المرجع (‏margin/indent/leftMargin) بمحاذاةٍ (left/center/right). */
  ptabAt: { at: number; relativeTo: string; alignment: string; leader: string | null }[];
  /** صفُّ جدول محتوياتٍ (TOC): مدخلٌ / قائدٌ يتمدّد / رقمُ صفحة — من حصاد «الشاملة
   *  الذهبية». يُكتشَف بنمطٍ toc أو بتوقّفٍ يمينيٍّ ذي leader مع w:tab فعليّ في رنّ.
   *  حين يوجد، الفقرة **لا تُقصى** بل تُرسَم صفًّا ثلاثيًّا. */
  toc: TocRow | null;
  /** ارتفاع أطولِ صورةٍ سطريّة (wp:inline) في الفقرة بالـtwips — تحجز صندوقَ سطرٍ
   *  بارتفاعها (تؤثّر في التدفّق العموديّ). 0 إن لا صورة سطريّة. حصاد «الشاملة الذهبية». */
  inlineImageHTwips: number;
  /** موضعُ الفقرة في جدولٍ (خليّة) — للتخطيط الشبكيّ في المُركِّب. null لغير الجداول.
   *  حصاد «الشاملة الذهبية»: عرضُ العمود وموضعُه من tblGrid، وحدود الصفّ/الخليّة. */
  tableCell: TableCellCtx | null;
}

/** سياقُ خليّة جدولٍ لفقرةٍ (من tblGrid + gridSpan) — بالـtwips من يسار الجدول */
export interface TableCellCtx {
  tableId: number;
  /** ملكية الجدول المتداخل؛ غائبة لجدول المتن الأعلى. */
  parentTableId?: number;
  parentRow?: number;
  parentCol?: number;
  /** ترتيب الجدول الابن ككتلة مباشرة داخل الخلية الأم. */
  parentBlockIndex?: number;
  /** 0 للجدول الأعلى، ويزداد مع كل w:tbl داخل w:tc. */
  nestingDepth?: number;
  /** ترتيب w:p ككتلة مباشرة داخل خليتها؛ مستقل عن index العام للفقرة. */
  cellBlockIndex?: number;
  row: number;
  col: number;
  colXTwips: number; // إزاحة يسار العمود عن يسار الجدول
  colWTwips: number; // عرض الخليّة (مجموع أعمدة span)
  /** ‏w:gridSpan الصريح؛ لا يمكن استنتاجه من جزء صفحة قد تغيب عنه بقية الحدود. */
  gridSpan: number;
  firstInCell: boolean; // أوّل فقرةٍ في الخليّة (تبدأ عند أعلى الصفّ)
  firstInRow: boolean;
  lastInRow: boolean;
  /** تظليل الخليّة (w:shd@w:fill) — «auto»/FFFFFF يُعامَل شفّافًا (حصاد الشاملة الذهبية) */
  shdFill: string | null;
  /** نمط الجدول (w:tblStyle) — تُحلّ منه الحدود إن غابت المباشرة */
  tblStyleId: string | null;
  /** تنسيق النص/الفقرة الشرطي المحلول للخلية من tblStylePr. */
  conditionalStyle?: {
    sz: number | null; family: string | null; jc: string | null; bidi: boolean | null;
    look: RunLook;
    spacing?: SpacingProps;
  };
  /** مجموع أعمدة tblGrid (twips) — أساسُ معامل القياس إلى عرض العمود المتاح */
  totalGridTwips: number;
  /** عرض الجدول w:tblW: القيمة والنوع (pct مقياسه 5000=100٪، أو dxa، أو auto) */
  tblWVal: number;
  tblWType: string;
  /** ‏w:tblLayout — fixed يحافظ على شبكة الأعمدة، وautofit يتيح لـWord توسيعها
   *  بحسب المحتوى. غياب الوسم يعني autofit حسب ECMA-376. */
  tblLayout: "fixed" | "autofit";
  /** ‏w:cantSplit على الصفّ: يمنع انشقاقه عبر الصفحات. **الافتراضيّ في OOXML/Word أنّ
   *  الصفوف تنشقّ**، فلا يُنقَل الصفّ إلّا إن كان هذا العلَم مضبوطًا. */
  cantSplit: boolean;
  /** ‏w:tblHeader على الصف: يكرر صف/صفوف الرأس عند امتداد الجدول لصفحة تالية. */
  repeatHeader: boolean;
  /** ‏w:bidiVisual — أوّلُ خليّةٍ تُرسَم يمينًا (الافتراضيّ عند غياب tblPr كلّيًّا) */
  bidiVisual: boolean;
  /** ‏w:tblInd — إزاحةُ الجدول بالـtwips (٠ إن كان النوعُ pct/auto/nil) */
  tblIndTwips: number;
  /** ‏w:tblPr/w:jc — محاذاةُ الجدول (start/end نسبيّةٌ للاتّجاه، left/right مطلقة) */
  tblJc: string | null;
  /** ‏w:vMerge — "restart" تبدأ دمجًا عموديًّا، و"continue" استمرارُه (لا تُرسَم حدودُه
   *  الداخليّة ولا يُكرَّر نصُّه)، وnull لا دمج. */
  vMerge: "restart" | "continue" | null;
  /** ‏w:vAlign — محاذاةُ محتوى الخليّة رأسيًّا: top (افتراضيّ) / center / bottom */
  vAlign: string | null;
  /** هوامشُ الخليّة بالـtwips (‏w:tcMar، وإلّا هوامشُ الجدول w:tblCellMar، وإلّا
   *  افتراضيُّ Word: يمين/يسار ١٠٨ وأعلى/أسفل ٠). */
  marTop: number; marBottom: number; marLeft: number; marRight: number;
  /** ‏w:trHeight — ارتفاعُ الصفّ وقاعدتُه (atLeast/exact) بالـtwips */
  rowHeight: number | null;
  rowHeightRule: string | null;
  /** ‏w:textDirection — اتّجاهُ نصّ الخليّة (‏tbRl/btLr للأعمدة الرأسيّة) */
  textDirection: string | null;
  /** حدودُ الخليّة (‏w:tcPr/w:tcBorders، مع fallback لحدود الجدول w:tblPr/w:tblBorders
   *  حين لا تُصرَّح حدودٌ للخليّة). ‏null = بلا حدودٍ على الإطلاق. */
  tcBorders: { top: BorderSide | null; bottom: BorderSide | null;
    left: BorderSide | null; right: BorderSide | null } | null;
}

/** حدٌّ واحد: سُمكُه بالـtwips (‏w:sz أثمانُ نقطة) وفراغُه ولونُه */
export interface BorderSide { wTwips: number; spaceTwips: number; color: string | null; val: string }

/** حدودٌ أربعة (فقرة/خليّة/جدول) — ‏null لكلِّ اتّجاهٍ بلا حدّ */
export interface Borders4 {
  top: BorderSide | null; bottom: BorderSide | null;
  left: BorderSide | null; right: BorderSide | null;
  /** لا يستعملهما pBdr/tcBorders؛ في tblBorders يوزعان على حواف الخلايا الداخلية. */
  insideH?: BorderSide | null; insideV?: BorderSide | null;
}

/** يحوّل عقدةَ w:pBdr/w:tcBorders/w:tblBorders إلى حدودٍ أربعة. ‏w:sz أثمانُ
 *  نقاط (20tw = 1pt)؛ ‏w:space بالنقاط؛ اللون auto ⟵ null (يلزم لون النصّ). */
export function parseBorders(node: XNode[]): Borders4 {
  const side = (nm: string): BorderSide | null => {
    const a = findAttr(node, `w:${nm}`);
    if (!a) return null;
    const val = a["@w:val"] ?? "single";
    if (val === "none" || val === "nil") return null;
    return { wTwips: Math.round((Number(a["@w:sz"] ?? 4) / 8) * 20),
      spaceTwips: Number(a["@w:space"] ?? 0) * 20, // w:space بالنقاط
      color: (a["@w:color"] && a["@w:color"] !== "auto") ? a["@w:color"].toUpperCase() : null,
      val };
  };
  return { top: side("top"), bottom: side("bottom"), left: side("left"), right: side("right"),
    insideH: side("insideH"), insideV: side("insideV") };
}

/** توقّف جدولةٍ مخصّص (§17.3.1.37) */
export interface TabStop {
  /** left/start · center · right/end · bar · clear */
  val: string;
  posTwips: number;
  /** dot · hyphen · underscore · middleDot · heavy · none */
  leader: string | null;
}
/** صفُّ فهرس: نصُّ المدخل، رقمُ الصفحة، حرفُ القائد، وموضع التوقّف اليمينيّ (twips) */
export interface TocRow {
  entry: string;
  pageNum: string;
  leader: string;
  rightTabTwips: number;
}

/** عائم wp:anchor — الأبعاد بالـ twips (‏EMU ÷ 635) */
export interface FloatAnchor {
  extentW: number; extentH: number;
  /** إزاحة صفحة المرساة عن صفحة نص الفقرة المالكة. تظهر عندما يخزن Word
   * غلافًا عائمًا ثم lastRenderedPageBreak داخل الفقرة نفسها. */
  pageOffset?: number;
  posHRel: string; posHOffset: number;
  posVRel: string; posVOffset: number;
  /** ‏wp:align بدل wp:posOffset — محاذاةٌ نسبيّةٌ إلى المرجع (‏left/center/right،
   *  و‏top/center/bottom رأسيًّا). قراءةُ الإزاحة وحدَها تضع الشكلَ عند الصفر خطأً. */
  posHAlign: string | null;
  posVAlign: string | null;
  /** ‏wp:anchor@behindDoc — طبقةٌ خلف النصّ لا أمامه */
  behindDoc: boolean;
  /** ‏wp:anchor@relativeHeight — ترتيبُ التراكب (الأصغر أسفل) */
  zOrder: number;
  distL: number; distR: number; distT: number; distB: number;
  /** ‏Square / Tight / Through / TopAndBottom / None */
  wrap: string;
  /** ‏wp:wrapSquare@wrapText: جهة التفاف النص حول المستطيل. */
  wrapSide?: "left" | "right" | "bothSides" | "largest";
  /** معرّف علاقة الصورة (a:blip r:embed) — لاستخراج البايت من word/media للعرض */
  rId: string | null;
  /** الجزءُ المالك ("header1.xml"…) — rId يُحلّ من علاقاته. null = المستند. */
  part?: string;
  /** ‏wp:docPr@descr/@title — النص البديل واسم الرسم. */
  alt?: string;
  title?: string;
  /** محتوى مربّع نصٍّ (wps:txbx/v:textbox ← w:txbxContent) — فقراتٌ تُرصَف داخل الصندوق */
  textBox?: BodyParagraph[];
  /** صورةُ حشو الشكل (a:blipFill) منفصلةٌ عن صورة العنصر؛ يجب أن تبقى خلف
   *  نص مربع الرأس لا أن تستبدله. */
  shapeFill?: { rId: string; mode: "stretch" | "tile";
    srcRect?: { l: number; t: number; r: number; b: number } };
  /** الرسمُ سطريٌّ في تدفّق الفقرة (‏wp:inline) لا مرساةً عائمة */
  inlineFlow?: boolean;
  /** الشكلُ من مسار VML (‏w:pict) لا من DrawingML — هندستُه من سمة style */
  vml?: boolean;
  /** ‏a:stretch (‏+a:fillRect): الصورةُ **تُمَدّ** لتملأ الامتداد. وغيابُها يعني
   *  أنّها **تُحتوى** بنسبتها الأصليّة — كنّا نمدّ دائمًا فنشوّه. */
  stretch?: boolean;
  /** أشكالُ رسم SmartArt (‏dsp:sp في diagrams/drawingN.xml): لكلٍّ موضعُه وحجمُه
   *  وهندستُه ونصُّه — بالـtwips نسبيّةً إلى ركن الرسم. */
  diagram?: { x: number; y: number; w: number; h: number;
    prst: string; fill: string | null; text: string; em: number }[];
  /** رسم بياني OOXML من cache المضمّن؛ الأنواع غير المدعومة تبقى حالة صريحة. */
  chart?: { kind: "bar" | "unsupported"; unsupportedType?: string;
    direction: "column" | "bar"; grouping: string; title: string | null;
    legend: { visible: boolean; position: string }; showValues: boolean;
    categoryAxis: boolean; valueAxis: boolean; categories: string[];
    series: { name: string; values: number[]; color: string }[] };
  /** شكلٌ متّجه (‏a:prstGeom أو VML): هندستُه ولونُ حشوه وحدّه. الرسمُ يحوّله
   *  إلى SVG. ‏prst أسماءُ OOXML الثابتة (rect/roundRect/ellipse/diamond/…). */
  shape?: { prst: string; fill: string | null; stroke: string | null;
    strokeW: number; adj: number | null;
    /** تدرّج DrawingML محلول من a:gradFill أو wps:style/a:fillRef. */
    gradient?: { angle: number; stops: { pos: number; color: string }[] };
    /** ‏v:stroke@dashstyle محلولًا إلى أطوالٍ بالـtwips (مضاعفاتُ سُمك الخطّ) */
    dash?: number[];
    /** ‏v:stroke@endcap — الافتراضيّ **flat** (butt) لا round */
    endcap?: string;
    /** ‏v:stroke@linestyle — thinThin/thinThick/... خطوطٌ مركبة لا خط مصمت واحد. */
    lineStyle?: string };
  /** مجموعةُ أشكال (‏a:grpSp/wpg:wgp): أبناءٌ لكلٍّ موضعُه وحجمُه **بعد** تحويل
   *  فضاء إحداثيّات المجموعة (‏chOff/chExt ⟵ off/ext) — بالـtwips، نسبيّةً
   *  إلى ركن المجموعة. */
  groupChildren?: { x: number; y: number; w: number; h: number; rId: string | null;
    /** دورانُ الابن وانعكاسُه وقصُّه — كنّا نُسقِطها فتُرسَم أبناءُ المجموعة
     *  معتدلةً بلا قصّ (‏ImageParser.dart:54-159) */
    rotDeg?: number; flipH?: boolean; flipV?: boolean;
    srcRect?: { l: number; t: number; r: number; b: number };
    /** أبناء المجموعة قد يكونون أشكالًا/مربعات نص بلا صورة؛ إسقاطهم يحذف
     * أجزاءً كاملة من الرسم المركب. */
    shape?: { prst: string; fill: string | null; stroke: string | null; strokeW: number; adj: number | null;
      lineStyle?: string };
    text?: string }[];
  /** ‏a:srcRect — قصُّ الصورة من أطرافها، كسورًا من ١ (‏OOXML يخزّنها بأجزاء
   *  المئة الألفيّة: ٢١٥٩٦ = ٢١٫٥٩٦٪). الرسمُ يعرض الجزءَ الباقي مُمَدَّدًا. */
  srcRect?: { l: number; t: number; r: number; b: number };
  /** مؤثراتُ a:blip التي يمكن تمثيلُها بلا إتلاف الصورة في CSS. */
  imageEffects?: {
    opacity?: number;
    grayscale?: boolean;
    brightness?: number;
    contrast?: number;
    shadow?: { x: number; y: number; blur: number; color: string; opacity: number };
    glow?: { radius: number; color: string; opacity: number };
    softEdge?: number;
    border?: { width: number; color: string; dash?: string };
    duotone?: { low: string; high: string };
    reflection?: { distance: number; startOpacity: number; endOpacity: number };
  };
  /** ‏wp14:sizeRelH/V — نسبة الحجم من الصفحة/الهامش/العمود (1 = 100%). */
  relWidth?: { from: string; pct: number };
  relHeight?: { from: string; pct: number };
  /** سلوك المرساة في Word عند التراكب وداخل خلايا الجدول. */
  allowOverlap?: boolean;
  layoutInCell?: boolean;
  /** نقاط wp:wrapPolygon بوحداتها الأصلية؛ تتحول إلى shape-outside بالنسبة المئوية. */
  wrapPolygon?: { x: number; y: number }[];
  /** ‏a:xfrm@rot — دورانٌ بالدرجات (‏OOXML يخزّنه بأجزاء الستّين ألفًا من الدرجة) */
  rotDeg?: number;
  /** ‏a:xfrm@flipH/@flipV — انعكاسٌ أفقيّ/رأسيّ */
  flipH?: boolean;
  flipV?: boolean;
  /** ‏wps:bodyPr@anchor — رسوُّ النصّ في الصندوق عموديًّا: t (أعلى) / ctr (وسط) / b (أسفل) */
  boxAnchor?: string;
  /** ‏a:noAutofit داخل wps:bodyPr — لا يصغّر Word النص كي يلائم الامتداد،
   *  بل يسمح له بالفيض رأسيًّا. نحفظه صراحةً كي لا يقصّه الراسم. */
  boxNoAutofit?: boolean;
  /** حشواتُ الصندوق بالـtwips (‏tIns/bIns/lIns/rIns؛ الافتراضيّ ٧٢ و١٤٤) */
  boxIns?: { t: number; b: number; l: number; r: number };
}
export interface SectionGeometry {
  pageWTwips: number;
  pageHTwips: number;
  marLeftTwips: number;
  marRightTwips: number;
  /** الهامش العلوي — بداية الصفحة الرأسية (القاعدة 8) */
  marTopTwips: number;
  marBottomTwips: number;
  /** عرض عمود المتن = العرض − الهامشان */
  columnTwips: number;
  /** مراجعُ الترويسة/التذييل لهذا المقطع: النوع (default/even/first) → rId */
  headerRefs?: Record<string, string>;
  footerRefs?: Record<string, string>;
  /** مسافةُ الترويسة/التذييل عن حافّة الصفحة (w:pgMar@header/@footer) بالـtwips */
  headerDistTwips?: number;
  footerDistTwips?: number;
  /** ‏w:titlePg — صفحةٌ أولى بترويسةٍ/تذييلٍ مختلفَين */
  titlePg?: boolean;
  /** ‏w:cols — عددُ الأعمدة (١ افتراضًا) والمسافةُ بينها وعرضُ العمود الواحد بالـtwips.
   *  متساويةٌ ما لم يُصرَّح بغير ذلك؛ في RTL العمودُ الأوّل على اليمين. */
  colCount: number;
  colSpaceTwips: number;
  colWidthTwips: number;
  /** ‏w:cols@equalWidth="0" — هندسة الأعمدة الصريحة بالترتيب المنطقي. */
  explicitColumns?: { widthTwips: number; spaceAfterTwips: number }[];
  /** ‏w:pgNumType — تنسيقُ رقم الصفحة (decimal/arabicAbjad/…) وبدايةُ الترقيم.
   *  ‏start موجودةٌ ⟵ الترقيمُ يُستأنَف من هذا الرقم في أوّل صفحةٍ من المقطع. */
  pgNumFmt: string | null;
  pgNumStart: number | null;
  /** ‏w:type — كيف يبدأ المقطع: nextPage (افتراضيّ) / continuous / evenPage / oddPage */
  sectStart: string;
  /** ‏w:docGrid — شبكةُ المستند: linePitch أرضيّةٌ لارتفاع السطر (كلُّ كتبنا ٣٦٠tw)،
   *  وtype (‏none/lines/linesAndChars/snapToChars) يحدّد هل تُطبَّق. */
  docGridLinePitch: number | null;
  docGridType: string | null;
  /** ‏w:pgBorders — إطار الصفحة بأضلاعه ومسافاتِه عن الحافة. */
  pageBorders?: Borders4 | null;
  pageBorderOffsetFrom?: "page" | "text";
  pageBorderDisplay?: "allPages" | "firstPage" | "notFirstPage";
  pageBorderZOrder?: "front" | "back";
  /** تجاوزات الحواشي المحلية في sectPr؛ غير المذكور يرث settings.xml. */
  footnotePr?: Partial<NotePreferences>;
  endnotePr?: Partial<NotePreferences>;
}
export interface NotePreferences {
  start: number;
  restart: string;
  fmt: string;
  position: string;
}
export interface DocumentModelV0 {
  /** ‏w:document/w:background@color — لون ورقة المستند العام (RGB). */
  pageBackground?: string;
  /** ‏w:defaultTabStop — فاصل التوقفات التلقائية بالـ twips (افتراضي 720) */
  defaultTabStop: number;
  /** هندسة المقطع الأخير — توافق خلفي؛ المعتمد: sections[sectionIndex] */
  section: SectionGeometry;
  /** كل مقاطع المستند بترتيبها (sectPr داخل pPr يختم مقطعًا، وsectPr
   *  الـbody يختم الأخير) — درس sample-muqtarah: مقطع عمودي ثم عرضي،
   *  واعتماد الأخير وحده أعطى عمودًا 14299 لفقرات عمودها 8722. */
  sections: SectionGeometry[];
  paragraphs: BodyParagraph[];
  /** من settings.xml؛ ‏11 عند الغياب (ما قبل 2010) — مفتاح القاعدة 16 */
  compatibilityMode: number;
  /** الحواشي: معرّفُ الحاشية → فقراتُها (من footnotes.xml). فارغةٌ إن لا حواشي. */
  footnotes: Map<string, BodyParagraph[]>;
  /** التعليقات الختاميّة: معرّف → فقرات (من endnotes.xml) */
  endnotes: Map<string, BodyParagraph[]>;
  noteSettings?: {
    footnote: NotePreferences;
    endnote: NotePreferences;
  };
  /** الترقيم: "numId/ilvl" → خصائصُ المستوى (بادئات المسافات + تنسيق/قالب/بداية العلامة) */
  numbering: NumberingTable;
  /** الترويسات/التذييلات: اسمُ الجزء (header1.xml…) → فقراتُه */
  headerFooters: Map<string, BodyParagraph[]>;
  /** rId → اسمُ الجزء (لحلّ مراجع المقطع) */
  relTargets: Map<string, string>;
  /** علاقاتُ كلّ جزء: اسمُ الجزء → (rId → هدف). الصورةُ في ترويسةٍ تُحلّ من جزئها. */
  partRels: Map<string, Map<string, string>>;
  /** w:evenAndOddHeaders — ترويسة/تذييل مختلفٌ للصفحات الزوجيّة */
  evenAndOddHeaders: boolean;
  /** ملفاتُ الوسائط: اسمُ الملف ("image1.png") → بايتات الخام (لرسم الصور) */
  mediaFiles: Map<string, Uint8Array>;
  /** الخطوط المضمّنة من word/fonts مع وجه FontFace المطابق لعقدة embed. */
  embeddedFonts: Map<string, EmbeddedFontFace>;
}

export interface EmbeddedFontFace {
  data: Uint8Array;
  /** الاسم المعلن في fontTable؛ أدق من name table في خطوط subset. */
  family: string | null;
  style: "normal" | "italic";
  weight: "normal" | "700";
}

/** ‏wp14:sizeRel*: النسبة صفر لا تستبدل wp:extent؛ Word يبقي المقاس المطلق. */
export function relativeSize(from: string | undefined, rawPct: unknown):
  { from: string; pct: number } | undefined {
  if (rawPct == null) return undefined;
  const pct = Number(rawPct) / 100000;
  if (!Number.isFinite(pct) || pct <= 0) return undefined;
  return { from: from ?? "page", pct };
}

// ---------- أدوات XML
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  preserveOrder: true,
  trimValues: false,
  parseTagValue: false,
});
const OOXML_CANONICAL_PREFIX = new Map<string, string>([
  ["http://schemas.openxmlformats.org/wordprocessingml/2006/main", "w"],
  ["http://schemas.openxmlformats.org/officeDocument/2006/relationships", "r"],
  ["http://schemas.openxmlformats.org/markup-compatibility/2006", "mc"],
  ["http://schemas.openxmlformats.org/drawingml/2006/main", "a"],
  ["http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing", "wp"],
  ["http://schemas.openxmlformats.org/drawingml/2006/picture", "pic"],
  ["urn:schemas-microsoft-com:vml", "v"],
  ["urn:schemas-microsoft-com:office:office", "o"],
  ["urn:schemas-microsoft-com:office:word", "w10"],
]);

/**
 * بادئات XML ليست جزءًا من هوية مساحة الاسم. بعض أدوات التعقيم الصحيحة تعيد
 * تسمية w/r إلى ns0/ns1؛ نوحّد المعروف قبل بناء شجرة fast-xml-parser حتى لا
 * يُرفض DOCX سليم لمجرد اختلاف الاسم النصي للبادئة.
 */
export function canonicalizeOoxmlPrefixes(xml: string): string {
  const aliases = [...xml.matchAll(/xmlns:([A-Za-z_][\w.-]*)=(['"])([^'"]+)\2/g)]
    .map(match => ({ alias: match[1]!, uri: match[3]! }));
  let normalized = xml;
  for (const { alias, uri } of aliases) {
    const canonical = OOXML_CANONICAL_PREFIX.get(uri);
    if (!canonical || canonical === alias) continue;
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    normalized = normalized.replace(new RegExp(`(<\\/?|\\s)${escaped}:`, "g"), `$1${canonical}:`);
    const aliasDecl = new RegExp(`\\s+xmlns:${escaped}=(['"])${uri.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\1`);
    if (new RegExp(`xmlns:${canonical}=(['"])${uri.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\1`).test(normalized)) normalized = normalized.replace(aliasDecl, "");
    else normalized = normalized.replace(new RegExp(`xmlns:${escaped}=`, "g"), `xmlns:${canonical}=`);
  }
  return normalized;
}

function parseOoxml(xml: string): XNode[] {
  return parser.parse(canonicalizeOoxmlPrefixes(xml)) as XNode[];
}
const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  preserveOrder: true,
  suppressEmptyNode: false,
});
type XNode = Record<string, unknown>;

function children(node: XNode[], name: string): XNode[][] {
  const out: XNode[][] = [];
  for (const n of node) if (name in n) out.push(n[name] as XNode[]);
  return out;
}
function first(node: XNode[], name: string): XNode[] | null {
  for (const n of node) if (name in n) return n[name] as XNode[];
  return null;
}
function attrs(node: XNode[] | null, container: XNode[] | null, name: string): Record<string, string> {
  // ‏preserveOrder يضع السمات في ":@" على العنصر الحاوي
  if (!container) return {};
  for (const n of container) {
    if (name in n) return ((n[":@"] as Record<string, string>) ?? {});
  }
  return {};
}
/** جمع كل العناصر باسم معيّن في أي عمق (لأشجار wp:drawing المتشعبة) */
function collectDeep(nodes: XNode[], name: string): { node: XNode[]; attrs: Record<string, string> }[] {
  const out: { node: XNode[]; attrs: Record<string, string> }[] = [];
  for (const n of nodes) {
    for (const key of Object.keys(n)) {
      if (key === ":@" || key === "#text") continue;
      const child = n[key];
      if (!Array.isArray(child)) continue;
      if (key === name)
        out.push({ node: child as XNode[], attrs: (n[":@"] as Record<string, string>) ?? {} });
      out.push(...collectDeep(child as XNode[], name));
    }
  }
  return out;
}

function mathRow(children: MathNode[]): MathNode {
  const flat = children.flatMap(child => child.kind === "row" ? child.children : [child]);
  return flat.length === 1 ? flat[0]! : { kind: "row", children: flat };
}

function mathChild(nodes: XNode[], name: string): MathNode {
  const child = first(nodes, name);
  return child ? parseMathNodes(child) : { kind: "row", children: [] };
}

/** يحوّل OMML إلى شجرة دلالية لا تعتمد على صورة أو خط Office خاص. */
export function parseMathNodes(nodes: XNode[]): MathNode {
  const out: MathNode[] = [];
  for (const node of nodes) {
    if ("#text" in node) {
      const text = String(node["#text"] ?? "");
      // المسافة بين وسوم OMML تنسيق XML فقط؛ النص المقصود محفوظ داخل m:t/w:t.
      if (text.trim()) out.push({ kind: "text", text });
      continue;
    }
    const entry = Object.entries(node).find(([key]) => key !== ":@");
    if (!entry) continue;
    const [name, raw] = entry;
    const body = Array.isArray(raw) ? raw as XNode[] : [];
    if (name === "m:t" || name === "w:t") {
      const text = body.filter(part => "#text" in part).map(part => String(part["#text"] ?? "")).join("");
      if (text) out.push({ kind: "text", text });
    } else if (name === "m:f") {
      out.push({ kind: "fraction", numerator: mathChild(body, "m:num"), denominator: mathChild(body, "m:den") });
    } else if (name === "m:sSup" || name === "m:sSub") {
      out.push({ kind: name === "m:sSup" ? "sup" : "sub", base: mathChild(body, "m:e"),
        script: mathChild(body, name === "m:sSup" ? "m:sup" : "m:sub") });
    } else if (name === "m:sSubSup") {
      out.push({ kind: "subsup", base: mathChild(body, "m:e"), sub: mathChild(body, "m:sub"), sup: mathChild(body, "m:sup") });
    } else if (name === "m:rad") {
      const degree = first(body, "m:deg");
      out.push({ kind: "radical", degree: degree ? parseMathNodes(degree) : null, radicand: mathChild(body, "m:e") });
    } else if (name === "m:d") {
      const pr = first(body, "m:dPr") ?? [];
      const chr = (tag: string, fallback: string) => findAttr(pr, tag)?.["@m:val"] ?? fallback;
      out.push({ kind: "delimiter", begin: chr("m:begChr", "("), end: chr("m:endChr", ")"), content: mathChild(body, "m:e") });
    } else if (name === "m:m") {
      const rows = body.filter(part => "m:mr" in part).map(part => {
        const row = part["m:mr"] as XNode[];
        return row.filter(cell => "m:e" in cell).map(cell => parseMathNodes(cell["m:e"] as XNode[]));
      });
      out.push({ kind: "matrix", rows });
    } else if (name === "m:nary") {
      const pr = first(body, "m:naryPr") ?? [];
      const operator = findAttr(pr, "m:chr")?.["@m:val"] ?? "∫";
      const limLoc = findAttr(pr, "m:limLoc")?.["@m:val"] ?? "subSup";
      const sub = first(body, "m:sub"), sup = first(body, "m:sup");
      out.push({ kind: "nary", operator, base: mathChild(body, "m:e"),
        sub: sub ? parseMathNodes(sub) : null, sup: sup ? parseMathNodes(sup) : null,
        limits: limLoc === "undOvr" });
    } else if (name === "m:acc" || name === "m:bar") {
      const prName = name === "m:acc" ? "m:accPr" : "m:barPr";
      const pr = first(body, prName) ?? [];
      const position = findAttr(pr, "m:pos")?.["@m:val"] === "bot" ? "bottom" : "top";
      const char = name === "m:acc" ? (findAttr(pr, "m:chr")?.["@m:val"] ?? "̂")
        : position === "bottom" ? "_" : "¯";
      out.push({ kind: "accent", base: mathChild(body, "m:e"), char, position });
    } else if (name === "m:func") {
      out.push({ kind: "function", name: mathChild(body, "m:fName"), argument: mathChild(body, "m:e") });
    } else if (name === "m:limLow" || name === "m:limUpp") {
      out.push({ kind: "limit", base: mathChild(body, "m:e"), limit: mathChild(body, "m:lim"),
        position: name === "m:limLow" ? "lower" : "upper" });
    } else if (!name.endsWith("Pr")) {
      out.push(parseMathNodes(body));
    }
  }
  return mathRow(out);
}

export function mathPlainText(node: MathNode): string {
  switch (node.kind) {
    case "text": return node.text;
    case "row": return node.children.map(mathPlainText).join("");
    case "fraction": return `(${mathPlainText(node.numerator)})/(${mathPlainText(node.denominator)})`;
    case "sup": return `${mathPlainText(node.base)}^${mathPlainText(node.script)}`;
    case "sub": return `${mathPlainText(node.base)}_${mathPlainText(node.script)}`;
    case "subsup": return `${mathPlainText(node.base)}_${mathPlainText(node.sub)}^${mathPlainText(node.sup)}`;
    case "radical": return `${node.degree ? `root[${mathPlainText(node.degree)}]` : "sqrt"}(${mathPlainText(node.radicand)})`;
    case "delimiter": return `${node.begin}${mathPlainText(node.content)}${node.end}`;
    case "matrix": return node.rows.map(row => row.map(mathPlainText).join(",")).join(";");
    case "nary": return `${node.operator}${node.sub ? `_${mathPlainText(node.sub)}` : ""}${node.sup ? `^${mathPlainText(node.sup)}` : ""}${mathPlainText(node.base)}`;
    case "accent": return `${node.position === "bottom" ? "under" : "over"}(${mathPlainText(node.base)},${node.char})`;
    case "function": return `${mathPlainText(node.name)}(${mathPlainText(node.argument)})`;
    case "limit": return `${mathPlainText(node.base)}${node.position === "lower" ? "_" : "^"}${mathPlainText(node.limit)}`;
  }
}

/** جذورُ الرسم داخل رنٍّ: ‏w:drawing مباشرةً، أو داخل mc:AlternateContent.
 *  في الأخير نُفضّل mc:Choice (‏DrawingML الحديث) ونتجاهل mc:Fallback (‏VML) كي لا نعدّ الشكلَ مرّتين؛
 *  فإن غاب الـChoice رجعنا إلى الـFallback حتّى لا نُسقِط الشكلَ في المستندات القديمة. */
function drawingRoots(t: XNode): XNode[][] {
  if ("w:drawing" in t) return [t["w:drawing"] as XNode[]];
  if ("mc:AlternateContent" in t) {
    const alt = t["mc:AlternateContent"] as XNode[];
    const choice = collectDeep(alt, "mc:Choice")[0]?.node;
    const root = choice ?? collectDeep(alt, "mc:Fallback")[0]?.node;
    return root ? [root] : [];
  }
  if ("w:pict" in t) return [t["w:pict"] as XNode[]];
  return [];
}

function findAttr(parent: XNode[], name: string): Record<string, string> | null {
  for (const n of parent) if (name in n) return ((n[":@"] as Record<string, string>) ?? {});
  return null;
}

// ---------- فتح الأرشيف
/** يفك أول 32 بايت من خط OOXML المضمّن وفق مفتاح GUID في w:fontKey. */
export function deobfuscateEmbeddedFont(data: Uint8Array, fontKey: string): Uint8Array {
  const hex = fontKey.replace(/[^0-9A-Fa-f]/g, "");
  if (hex.length !== 32 || data.length < 32) return data;
  const key = Uint8Array.from(hex.match(/../g)!.map(part => Number.parseInt(part, 16))).reverse();
  const out = data.slice();
  for (let i = 0; i < 32; i++) out[i] = out[i]! ^ key[i % 16]!;
  return out;
}

export function openDocx(bytes: Uint8Array): {
  documentXml: string; stylesXml: string | null; settingsXml: string | null;
  numberingXml: string | null; footnotesXml: string | null; endnotesXml: string | null;
  /** أجزاءُ الترويسة/التذييل: اسمُ الجزء (مثل "header1.xml") → محتواه */
  headerFooterParts: Map<string, string>;
  /** علاقاتُ المستند: rId → هدفُه (لحلّ headerReference/footerReference) */
  documentRels: Map<string, string>;
  /** ‏word/theme/theme1.xml — لحلّ w:themeColor */
  themeXml: string | null;
  /** أجزاءُ رسوم SmartArt المرسومة: "diagrams/drawing1.xml" → محتواه */
  diagramDrawings: Map<string, string>;
  /** أجزاء الرسوم البيانية: "charts/chart1.xml" → محتواها. */
  chartParts: Map<string, string>;
  /** علاقاتُ **كلّ جزء**: اسمُ الجزء ("document.xml"/"header1.xml") → (rId → هدف).
   *  لازمٌ لأنّ rId محلّيٌّ لجزئه: rId1 في ترويسة masjid صورةٌ، وفي المستند
   *  عنصرُ customXml — فحلُّه من ملفٍّ واحدٍ يعطي هدفًا خاطئًا. */
  partRels: Map<string, Map<string, string>>;
  /** ملفاتُ وسائط (صور، إلخ): اسمُ الملف (مثل "media/image1.png") → بايتاته */
  mediaFiles: Map<string, Uint8Array>;
  /** الخطوط المضمّنة: اسم الخط → بايتات الملف (TTF/OTF) */
  embeddedFonts: Map<string, EmbeddedFontFace>;
} {
  const files = unzipSync(bytes);
  const dec = new TextDecoder("utf-8");
  const doc = files["word/document.xml"];
  if (!doc) throw new Error("word/document.xml غير موجود");
  const get = (n: string) => (files[n] ? dec.decode(files[n]!) : null);
  const headerFooterParts = new Map<string, string>();
  for (const name of Object.keys(files)) {
    const b = name.match(/^word\/((?:header|footer)\d+\.xml)$/);
    if (b && b[1]) headerFooterParts.set(b[1], dec.decode(files[name]!));
  }
  // علاقاتُ **كلّ جزء** على حدة: rId محلّيٌّ لجزئه. (‏rId1 في ترويسة masjid
  // صورةٌ، وفي المستند عنصرُ customXml — فحلُّه من ملفٍّ واحدٍ يعطي هدفًا خاطئًا.)
  const partRels = new Map<string, Map<string, string>>();
  const readRels = (relsPath: string): Map<string, string> => {
    const out = new Map<string, string>();
    const xml = get(relsPath);
    if (!xml) return out;
    // أدوات التعقيم قد تعيد تسمية namespace الافتراضي إلى ns0 وتستعمل اقتباسًا
    // مفردًا؛ اسم البادئة والاقتباس ليسا جزءًا من دلالة OPC Relationship.
    for (const m of xml.match(/<(?:[\w.-]+:)?Relationship\b[^>]*\/?\s*>/g) ?? []) {
      const id = m.match(/\bId=(['"])(.*?)\1/); const tgt = m.match(/\bTarget=(['"])(.*?)\1/);
      if (id?.[2] && tgt?.[2]) out.set(id[2], tgt[2].replace(/^\/?word\//, "").replace(/^\.\.\//, ""));
    }
    return out;
  };
  for (const name of Object.keys(files)) {
    const m = name.match(/^word\/_rels\/(.+)\.rels$/);
    if (m?.[1]) partRels.set(m[1], readRels(name));
  }
  const documentRels = partRels.get("document.xml") ?? new Map<string, string>();
  // رسومُ SmartArt: الجزءُ المرسوم يحمل الأشكالَ بمواضعها ونصوصِها جاهزةً
  const diagramDrawings = new Map<string, string>();
  for (const name of Object.keys(files)) {
    const m = name.match(/^word\/(diagrams\/drawing\d+\.xml)$/);
    if (m?.[1]) diagramDrawings.set(m[1], dec.decode(files[name]!));
  }
  const chartParts = new Map<string, string>();
  for (const name of Object.keys(files)) {
    const m = name.match(/^word\/(charts\/chart\d+\.xml)$/);
    if (m?.[1]) chartParts.set(m[1], dec.decode(files[name]!));
  }
  // ملفاتُ الوسائط: بايتات الصور/الأصوات الخام — لحلّ a:blip r:embed
  const mediaFiles = new Map<string, Uint8Array>();
  for (const name of Object.keys(files)) {
    const m = name.match(/^word\/media\/(.+)$/);
    if (m?.[1]) mediaFiles.set(m[1], files[name]!);
  }
  // الخطوط المضمّنة: بايتات ملفات TTF/OTF من word/fonts/
  const embeddedFonts = new Map<string, EmbeddedFontFace>();
  const fontFaces = new Map<string, { key: string; family: string | null; style: EmbeddedFontFace["style"]; weight: EmbeddedFontFace["weight"] }>();
  const fontTable = get("word/fontTable.xml");
  const fontRels = partRels.get("fontTable.xml") ?? new Map<string, string>();
  for (const font of fontTable?.matchAll(/<w:font\b([^>]*)>([\s\S]*?)<\/w:font>/g) ?? []) {
    const family = font[1]!.match(/w:name="([^"]+)"/)?.[1] ?? null;
    for (const m of font[2]!.matchAll(/<w:embed(?:Regular|Bold|Italic|BoldItalic)\b([^>]*)>/g)) {
      const relId = m[1]!.match(/r:id="([^"]+)"/)?.[1];
      const key = m[1]!.match(/w:fontKey="([^"]+)"/)?.[1];
      const target = relId ? fontRels.get(relId) : undefined;
      const kind = m[0]!.match(/<w:embed(Regular|Bold|Italic|BoldItalic)/)?.[1] ?? "Regular";
      if (target && key) fontFaces.set(target.replace(/^\.\//, ""), {
        key, family, style: kind.includes("Italic") ? "italic" : "normal",
        weight: kind.includes("Bold") ? "700" : "normal",
      });
    }
  }
  for (const name of Object.keys(files)) {
    const m = name.match(/^word\/fonts\/(.+\.(ttf|otf|ttc|odttf))$/i);
    if (m?.[1]) {
      const target = `fonts/${m[1]}`;
      const face = fontFaces.get(target) ?? { key: "", family: null, style: "normal" as const, weight: "normal" as const };
      embeddedFonts.set(m[1], {
        data: face.key ? deobfuscateEmbeddedFont(files[name]!, face.key) : files[name]!,
        family: face.family, style: face.style, weight: face.weight,
      });
    }
  }
  return {
    documentXml: dec.decode(doc),
    stylesXml: get("word/styles.xml"),
    settingsXml: get("word/settings.xml"),
    themeXml: get("word/theme/theme1.xml"),
    numberingXml: get("word/numbering.xml"),
    footnotesXml: get("word/footnotes.xml"),
    endnotesXml: get("word/endnotes.xml"),
    headerFooterParts, documentRels, partRels, diagramDrawings, chartParts, mediaFiles, embeddedFonts,
  };
}

// ---------- الترقيم: numId+ilvl ← تقدمات المستوى (numbering.xml)
// درس sample-dawra: فقرات التعداد بلا w:ind مباشر وتقدماتها في lvl
// ‏(left=720/hanging=360) — تجاهلها ⇒ عمود أعرض بـ720 لكل أسطرها.
export interface NumLevelProps {
  indLeft: number | null; indRight: number | null;
  /** التعليق بإشارة firstLine السالبة (نفس تمثيل الفقرات) */
  indFirstLine: number | null;
  /** حجم علامة القائمة (lvl/rPr sz بأنصاف النقاط) — يشارك في ارتفاع السطر */
  sz: number | null;
  /** خط شريحة ASCII لعلامة القائمة من lvl/rPr/rFonts. */
  markerFamily: string | null;
  markerBold: boolean;
  markerUnderline: string | null;
  markerColor: string | null;
  /** تنسيقُ العلامة (w:numFmt@w:val): decimal/upperRoman/bullet/none… — null=غير مصرّح */
  fmt: string | null;
  /** قالبُ العلامة (w:lvlText@w:val) مثل "%1." أو "•" أو "(%1)"; ‏%n = قيمة المستوى n */
  lvlText: string | null;
  /** بدايةُ العدّ (w:start@w:val) — 1 افتراضيًا */
  start: number | null;
  /** ‏w:lvlJc — محاذاة علامة القائمة داخل عرض التعليق. */
  jc: string | null;
}
export type NumberingTable = Map<string, NumLevelProps>; // "numId/ilvl"

export function parseNumbering(numberingXml: string | null): NumberingTable {
  const table: NumberingTable = new Map();
  if (!numberingXml) return table;
  const root = parseOoxml(numberingXml);
  const numbering = first(root, "w:numbering");
  if (!numbering) return table;
  // ‏abstractNumId ← مستوياته
  const absLvls = new Map<string, Map<string, NumLevelProps>>();
  for (const node of numbering) {
    if ("w:abstractNum" in node) {
      const abs = node["w:abstractNum"] as XNode[];
      const absId = (node[":@"] as Record<string, string> | undefined)?.["@w:abstractNumId"];
      if (absId == null) continue;
      const lvls = new Map<string, NumLevelProps>();
      for (const l of abs) {
        if (!("w:lvl" in l)) continue;
        const lvl = l["w:lvl"] as XNode[];
        const ilvl = (l[":@"] as Record<string, string> | undefined)?.["@w:ilvl"];
        const pPr = first(lvl, "w:pPr");
        const ind = pPr ? findAttr(pPr, "w:ind") : null;
        if (ilvl == null) continue;
        const sz = rPrProps(first(lvl, "w:rPr")).sz;
        const markerFonts = findAttr(first(lvl, "w:rPr") ?? [], "w:rFonts");
        const markerFamily = markerFonts?.["@w:ascii"] ?? markerFonts?.["@w:hAnsi"]
          ?? markerFonts?.["@w:cs"] ?? markerFonts?.["@w:eastAsia"] ?? null;
        const markerRPr = first(lvl, "w:rPr");
        const markerBold = markerRPr ? (onFlag(markerRPr, "w:b") ?? onFlag(markerRPr, "w:bCs") ?? false) : false;
        const markerUnderline = markerRPr ? (findAttr(markerRPr, "w:u")?.["@w:val"] ?? null) : null;
        const rawMarkerColor = markerRPr ? findAttr(markerRPr, "w:color")?.["@w:val"] : null;
        const markerColor = rawMarkerColor && /^[0-9A-Fa-f]{6}$/.test(rawMarkerColor)
          ? rawMarkerColor.toUpperCase() : null;
        if (!ind && sz == null && !first(lvl, "w:numFmt") && !first(lvl, "w:lvlText") && !first(lvl, "w:lvlJc")) continue;
        const left = ind?.["@w:left"] != null ? Number(ind["@w:left"]) : null;
        const right = ind?.["@w:right"] != null ? Number(ind["@w:right"]) : null;
        const hanging = ind?.["@w:hanging"] != null ? Number(ind["@w:hanging"]) : null;
        const firstLine = ind?.["@w:firstLine"] != null ? Number(ind["@w:firstLine"]) : null;
        const fmt = findAttr(lvl, "w:numFmt")?.["@w:val"] ?? null;
        const lvlText = findAttr(lvl, "w:lvlText")?.["@w:val"] ?? null;
        const start = findAttr(lvl, "w:start")?.["@w:val"] != null
          ? Number(findAttr(lvl, "w:start")?.["@w:val"]) : null;
        const jc = findAttr(lvl, "w:lvlJc")?.["@w:val"] ?? null;
        lvls.set(ilvl, {
          indLeft: left, indRight: right,
          indFirstLine: hanging != null ? -hanging : firstLine,
          sz, markerFamily, markerBold, markerUnderline, markerColor, fmt, lvlText, start, jc,
        });
      }
      absLvls.set(absId, lvls);
    }
  }
  // ‏num ← abstractNum
  for (const node of numbering) {
    if (!("w:num" in node)) continue;
    const num = node["w:num"] as XNode[];
    const numId = (node[":@"] as Record<string, string> | undefined)?.["@w:numId"];
    const absRef = findAttr(num, "w:abstractNumId")?.["@w:val"];
    if (numId == null || absRef == null) continue;
    const lvls = absLvls.get(String(absRef));
    if (!lvls) continue;
    const startOverrides = new Map<string, number>();
    for (const child of num) {
      if (!("w:lvlOverride" in child)) continue;
      const ilvl = (child[":@"] as Record<string, string> | undefined)?.["@w:ilvl"];
      const body = child["w:lvlOverride"] as XNode[];
      const raw = findAttr(body, "w:startOverride")?.["@w:val"];
      if (ilvl != null && raw != null && Number.isFinite(Number(raw))) startOverrides.set(ilvl, Number(raw));
    }
    for (const [ilvl, props] of lvls) table.set(`${numId}/${ilvl}`, {
      ...props, start: startOverrides.get(ilvl) ?? props.start,
    });
  }
  return table;
}

/** ‏compatibilityMode من settings.xml — مفتاح خوارزمية التسويغ الذكي
 *  (القاعدة 16: الانكماش لـ≥15 فقط؛ تنبؤ تأكد على كتاب compat=11).
 *  الغياب = وثيقة ما قبل 2010 ⇒ ‏11. */
export function compatibilityMode(settingsXml: string | null): number {
  if (!settingsXml) return 11;
  const m = settingsXml.match(
    /w:name="compatibilityMode"[^>]*w:val="(\d+)"|w:val="(\d+)"[^>]*w:name="compatibilityMode"/);
  return m ? Number(m[1] ?? m[2]) : 11;
}

/** ‏w:defaultTabStop من settings.xml (ECMA-376 §17.15.1.25) — فاصل التوقفات
 *  التلقائية مقيسًا من هامش النص؛ الافتراضي 720 twips. مدخل قاعدة تاب
 *  الترقيم (نص السطر الأول بعد علامة أعرض من التعليق). */
export function defaultTabStop(settingsXml: string | null): number {
  if (!settingsXml) return 720;
  const m = settingsXml.match(/w:defaultTabStop[^>]*w:val="(\d+)"/);
  return m ? Number(m[1]) : 720;
}

// ---------- الأنماط: styleId ← {sz, family, basedOn} + docDefaults
interface StyleProps {
  sz: number | null; family: string | null; basedOn: string | null;
  indLeft: number | null; indRight: number | null; indFirstLine: number | null;
  /** ‏w:bidi من pPr النمط — خاصية فقرة موروثة. */
  bidi: boolean | null;
  suppressAutoHyphens: boolean | null;
  outlineLevel: number | null;
  keepNext: boolean | null;
  keepLines: boolean | null;
  contextualSpacing: boolean | null;
  widowControl: boolean | null;
  snapToGrid: boolean | null;
  /** ‏w:jc من pPr النمط — يورَّث (درس tadris para87: فقرة jc=null ظاهريًا
   *  وسطرها مسوَّغ ممتلئ لأن نمطها يحمل التسويغ) */
  jc: string | null;
  spacing: SpacingProps;
  /** مظهرُ النصّ من rPr النمط — يُدمَج على السلسلة (الأساسُ أوّلًا فيدوسه الفرع) */
  look: RunLook;
}
export interface StyleTable {
  defaults: { sz: number | null; family: string | null; spacing: SpacingProps; jc: string | null; bidi: boolean | null; suppressAutoHyphens: boolean | null; outlineLevel: number | null; keepNext: boolean | null; keepLines: boolean | null; contextualSpacing: boolean | null; widowControl: boolean | null; snapToGrid: boolean | null };
  /** نمط الفقرة الافتراضي (w:default="1") — الفقرات بلا pStyle ترثه قبل
   *  docDefaults (درس masjid الرأسي: ‏Normal ‏line=240 يلغي docDefaults 276) */
  defaultParagraphStyleId: string | null;
  byId: Map<string, StyleProps>;
  /** الاسم الظاهر في w:name → styleId؛ تستخدمه حقول STYLEREF. */
  nameToId: Map<string, string>;
  /** أنماط الجداول: الخصائص العامة ومناطق tblStylePr الشرطية. */
  tableById: Map<string, TableStyleProps>;
}

interface TableStyleRegion {
  spacing: SpacingProps;
  shdFill: string | null;
  borders: Borders4 | null;
  sz: number | null;
  family: string | null;
  jc: string | null;
  bidi: boolean | null;
  look: RunLook;
}
interface TableStyleProps {
  whole: TableStyleRegion;
  regions: Map<string, TableStyleRegion>;
  rowBandSize: number;
  colBandSize: number;
}

function indProps(pPr: XNode[] | null): { indLeft: number | null; indRight: number | null; indFirstLine: number | null } {
  const ind = pPr ? findAttr(pPr, "w:ind") : null;
  if (!ind) return { indLeft: null, indRight: null, indFirstLine: null };
  const fl = ind["@w:firstLine"] != null || ind["@w:hanging"] != null
    ? Number(ind["@w:firstLine"] ?? 0) - Number(ind["@w:hanging"] ?? 0)
    : null;
  return {
    indLeft: ind["@w:left"] != null ? Number(ind["@w:left"]) : null,
    indRight: ind["@w:right"] != null ? Number(ind["@w:right"]) : null,
    indFirstLine: fl,
  };
}

/** حلّ رمز w:sym (حصاد «الشاملة الذهبية»): (خطٌّ رمزيّ + كودٌ ستّ-عشريّ) → محرفٌ فعليّ.
 *  إزاحة المنطقة الخاصّة PUA: خطوط AGA/Wingdings ترمّز عند 0x20-0xFF بينما الغليفات
 *  عند U+F020-F0FF؛ فإن كان الكود < 0xF000 نضيف 0xF000. لا يُفسَّر الكود كـUnicode عاديّ. */
function resolveSymChar(font: string | undefined, charHex: string | undefined): string | null {
  if (!charHex) return null;
  const cp = parseInt(charHex, 16);
  if (!Number.isFinite(cp)) return null;
  const isSym = /aga|arabesque|wingding|webding|symbol|marlett/i.test(font ?? "");
  const resolved = isSym && cp < 0xf000 ? 0xf000 + cp : cp;
  return String.fromCodePoint(resolved);
}

/** النص الذي تعيده Word automation لرموز الخطوط القديمة قد يختلف عن PUA
 * المخزن في OOXML. ثبت بالمقارنة المباشرة أن AGA Arabesque/F072 (غليف ﷺ)
 * يعيده Document.Range.Text كـ"("؛ يبقى U+F072 في run.text للرسم. */
function sourceSymChar(font: string | undefined, charHex: string | undefined): string | null {
  const cp = parseInt(charHex ?? "", 16);
  if (/^AGA Arabesque$/i.test((font ?? "").trim()) && cp === 0xf072) return "(";
  return null;
}

/** توقّفات الجدولة من w:pPr/w:tabs (حصاد «الشاملة الذهبية»): val/pos/leader. */
function parseTabStops(pPr: XNode[] | null): TabStop[] {
  const tabsEl = pPr ? first(pPr, "w:tabs") : null;
  if (!tabsEl) return [];
  const out: TabStop[] = [];
  for (const n of tabsEl) {
    if (!("w:tab" in n)) continue;
    const a = (n[":@"] as Record<string, string>) ?? {};
    const val = a["@w:val"] ?? "left";
    if (val === "clear") continue; // clear يُلغي توقّفًا موروثًا — لا يُرسَم
    out.push({ val, posTwips: Number(a["@w:pos"] ?? 0), leader: a["@w:leader"] ?? null });
  }
  return out;
}

/** ‏w:spacing من pPr — مدخل الترصيف الرأسي (line بوحدة 240 لكل سطر مفرد،
 *  ‏lineRule: ‏auto (مضاعف) / exact / atLeast (twips)؛ ‏before/after بالـ twips) */
export interface SpacingProps {
  /** وجود عنصر w:spacing نفسه — الوراثة **عنصرية** لا سمّية: العنصر المباشر
   *  (ولو بسمة واحدة) يلغي عنصر النمط كليًا (درس masjid الرأسي: فقرات
   *  ‏after مباشر فقط تُرصف بالمفرد رغم line=276 في النمط) */
  present: boolean;
  line: number | null;
  lineRule: "auto" | "exact" | "atLeast" | null;
  before: number | null;
  after: number | null;
  /** ‏before/afterAutospacing بعد الوراثة. قياس Word OM للحالات الفعلية في
   * corpus أعاد 5pt ثابتة، أي 100twips، مستقلًا عن حجم الخط. */
  beforeAuto?: boolean | null;
  afterAuto?: boolean | null;
  /** ‏line جاء من pPr المباشر (القاعدة الرأسية 9) */
  lineDirect?: boolean;
  /** مصدر line بدقة: ‏pPr مباشر / نمط مسمى / docDefaults — القاعدة 9
   *  (+1 نقطة 600dpi لكل فقرة) تنطبق على docDefaults حصرًا: تعميمها على
   *  وراثة النمط كسر masjid ‏92.7→75.6 وmuqtarah ‏97.9→66.7 (محاكمة 2026-07-14) */
  lineSource?: "ppr" | "style" | "docDefaults" | null;
}
function spacingProps(pPr: XNode[] | null): SpacingProps {
  const el = pPr ? pPr.find((n) => "w:spacing" in n) : null;
  const sp = el ? ((el[":@"] as Record<string, string>) ?? {}) : null;
  if (!sp) return { present: false, line: null, lineRule: null, before: null, after: null,
    beforeAuto: null, afterAuto: null };
  const auto = (name: string): boolean | null => sp[`@w:${name}`] == null ? null
    : !["0", "false", "off"].includes(sp[`@w:${name}`]!);
  return {
    present: true,
    line: sp["@w:line"] != null ? Number(sp["@w:line"]) : null,
    lineRule: (sp["@w:lineRule"] as SpacingProps["lineRule"]) ?? (sp["@w:line"] != null ? "auto" : null),
    before: sp["@w:before"] != null ? Number(sp["@w:before"]) : null,
    after: sp["@w:after"] != null ? Number(sp["@w:after"]) : null,
    beforeAuto: auto("beforeAutospacing"),
    afterAuto: auto("afterAutospacing"),
  };
}

/** قيمة خاصية on/off في pPr؛ null يعني غيابها واستمرار الوراثة. */
function pPrFlag(pPr: XNode[] | null, name: string): boolean | null {
  if (!pPr || first(pPr, name) === null) return null;
  const value = findAttr(pPr, name)?.["@w:val"];
  return !["0", "false", "off"].includes(value ?? "");
}

/** جدولُ ألوان السمة من word/theme/theme1.xml: اسمُ اللون ← RRGGBB.
 *  ‏w:themeColor يشير إلى هذه الأسماء؛ وWord يسمّي dk1/lt1 في المستند
 *  ‏text1/background1 (وdk2/lt2 ⟵ text2/background2) فنُسجّل الاسمَين. */
export function parseTheme(themeXml: string | null): Map<string, string> {
  const out = new Map<string, string>();
  if (!themeXml) return out;
  const scheme = themeXml.match(/<a:clrScheme[\s\S]*?<\/a:clrScheme>/);
  if (!scheme) return out;
  const ALIAS: Record<string, string> = { dk1: "text1", lt1: "background1",
    dk2: "text2", lt2: "background2" };
  for (const m of scheme[0].matchAll(/<a:(\w+)>([\s\S]*?)<\/a:\1>/g)) {
    const name = m[1]!;
    const srgb = m[2]!.match(/<a:srgbClr val="([0-9A-Fa-f]{6})"/);
    const sys = m[2]!.match(/<a:sysClr[^>]*lastClr="([0-9A-Fa-f]{6})"/);
    const hex = (srgb?.[1] ?? sys?.[1] ?? "").toUpperCase();
    if (!hex) continue;
    out.set(name, hex);
    if (ALIAS[name]) out.set(ALIAS[name]!, hex);
  }
  const fontScheme = themeXml.match(/<a:fontScheme\b[^>]*>([\s\S]*?)<\/a:fontScheme>/)?.[1];
  if (fontScheme) {
    for (const size of ["major", "minor"] as const) {
      const family = fontScheme.match(new RegExp(`<a:${size}Font>([\\s\\S]*?)<\\/a:${size}Font>`))?.[1];
      if (!family) continue;
      const face = (tag: string) => family.match(new RegExp(`<a:${tag}\\b[^>]*typeface="([^"]*)"`))?.[1];
      const latin = face("latin"), eastAsia = face("ea"), bidi = face("cs");
      if (latin) { out.set(`__font:${size}Ascii`, latin); out.set(`__font:${size}HAnsi`, latin); }
      if (eastAsia) out.set(`__font:${size}EastAsia`, eastAsia);
      if (bidi) out.set(`__font:${size}Bidi`, bidi);
    }
  }
  // ‏fillRef@idx يشير إلى ترتيب fillStyleLst، وقد يكون تدرجًا لا لونًا مصمتًا.
  // نحفظ القالب ثم نستبدل phClr بلون المرجع الفعلي عند تحليل الشكل.
  const fills = themeXml.match(/<a:fillStyleLst>([\s\S]*?)<\/a:fillStyleLst>/)?.[1];
  if (fills) {
    let idx = 0;
    for (const m of fills.matchAll(/<a:(solidFill|gradFill)\b([^>]*)>([\s\S]*?)<\/a:\1>/g)) {
      idx++;
      if (m[1] !== "gradFill") continue;
      const linear = m[3]!.match(/<a:lin\b([^>]*)\/?\s*>/);
      const attr = (raw: string, name: string) => raw.match(new RegExp(`${name}="([^"]+)"`))?.[1];
      const stops: { pos: number; token: string; transforms: Record<string, number> }[] = [];
      for (const gs of m[3]!.matchAll(/<a:gs\b([^>]*)>([\s\S]*?)<\/a:gs>/g)) {
        const rgb = gs[2]!.match(/<a:srgbClr\b[^>]*val="([0-9A-Fa-f]{6})"/)?.[1]?.toUpperCase();
        const sch = gs[2]!.match(/<a:schemeClr\b[^>]*val="([^"]+)"/)?.[1];
        const transforms: Record<string, number> = {};
        for (const tr of gs[2]!.matchAll(/<a:(tint|shade|satMod|lumMod|lumOff)\b[^>]*val="(\d+)"/g))
          transforms[tr[1]!] = Number(tr[2]);
        stops.push({ pos: Number(attr(gs[1]!, "pos") ?? 0) / 100000,
          token: rgb ?? sch ?? "phClr", transforms });
      }
      if (stops.length) out.set(`__fillStyle:${idx}`, JSON.stringify({
        angle: ((Number(attr(linear?.[1] ?? "", "ang") ?? 0) / 60000) + 90) % 360,
        stops,
      }));
    }
  }
  // مراجع effectRef في أشكال DrawingML لا تحمل الظل داخل الشكل نفسه؛ بل تشير
  // إلى قائمة fmtScheme في theme1.xml. نحفظ الوصفَ مضغوطًا في الجدول نفسه كي
  // يبقى توقيع parseTheme المتداول متوافقًا، ثم يحلّه imageEffectsOf.
  const effects = themeXml.match(/<a:effectStyleLst>([\s\S]*?)<\/a:effectStyleLst>/)?.[1];
  if (effects) {
    let idx = 0;
    for (const m of effects.matchAll(/<a:effectStyle>([\s\S]*?)<\/a:effectStyle>/g)) {
      idx++;
      const sh = m[1]!.match(/<a:outerShdw([^>]*)>([\s\S]*?)<\/a:outerShdw>/);
      if (!sh) continue;
      const attr = (name: string) => sh[1]!.match(new RegExp(`${name}="([^"]+)"`))?.[1];
      const rgb = sh[2]!.match(/<a:srgbClr[^>]*val="([0-9A-Fa-f]{6})"/)?.[1]?.toUpperCase();
      const schemeName = sh[2]!.match(/<a:schemeClr[^>]*val="([^"]+)"/)?.[1];
      const alpha = sh[2]!.match(/<a:alpha[^>]*val="(\d+)"/)?.[1];
      out.set(`__effectStyle:${idx}`, JSON.stringify({
        blurRad: Number(attr("blurRad") ?? 0), dist: Number(attr("dist") ?? 0),
        dir: Number(attr("dir") ?? 0), color: rgb ?? out.get(schemeName ?? "") ?? "000000",
        opacity: alpha == null ? 1 : Math.max(0, Math.min(1, Number(alpha) / 100000)),
      }));
    }
  }
  return out;
}

function drawingColor(hex: string, transforms: Record<string, number>): string {
  let rgb = [0, 1, 2].map(i => parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  const shade = transforms.shade; if (shade != null) rgb = rgb.map(v => v * shade / 100000);
  const tint = transforms.tint; if (tint != null) rgb = rgb.map(v => v + (255 - v) * tint / 100000);
  const lumMod = transforms.lumMod; if (lumMod != null) rgb = rgb.map(v => v * lumMod / 100000);
  const lumOff = transforms.lumOff; if (lumOff != null) rgb = rgb.map(v => v + 255 * lumOff / 100000);
  const satMod = transforms.satMod;
  if (satMod != null) {
    const c = rgb.map(v => Math.max(0, Math.min(255, v)) / 255);
    const max = Math.max(...c), min = Math.min(...c), l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      const s0 = l > .5 ? d / (2 - max - min) : d / (max + min);
      const s = Math.max(0, Math.min(1, s0 * satMod / 100000));
      const h = max === c[0] ? ((c[1]! - c[2]!) / d + (c[1]! < c[2]! ? 6 : 0)) / 6
        : max === c[1] ? ((c[2]! - c[0]!) / d + 2) / 6 : ((c[0]! - c[1]!) / d + 4) / 6;
      const hue = (p: number, q: number, t0: number) => { let t = t0; if (t < 0) t += 1; if (t > 1) t -= 1;
        return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
      const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      rgb = [h + 1 / 3, h, h - 1 / 3].map(t => hue(p, q, t) * 255);
    }
  }
  return rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0").toUpperCase()).join("");
}

function themeGradient(theme: Map<string, string>, idx: string | undefined, placeholder: string | null) {
  const raw = idx ? theme.get(`__fillStyle:${idx}`) : undefined;
  if (!raw || !placeholder) return undefined;
  try {
    const parsed = JSON.parse(raw) as { angle: number; stops: { pos: number; token: string; transforms: Record<string, number> }[] };
    const stops = parsed.stops.map(stop => {
      const base = stop.token === "phClr" ? placeholder
        : theme.get(stop.token) ?? (/^[0-9A-F]{6}$/.test(stop.token) ? stop.token : placeholder);
      return { pos: Math.max(0, Math.min(1, stop.pos)), color: drawingColor(base, stop.transforms) };
    });
    return stops.length ? { angle: parsed.angle, stops } : undefined;
  } catch { return undefined; }
}

function drawingGradient(node: XNode[] | undefined, theme: Map<string, string>) {
  if (!node) return undefined;
  const stops = collectDeep(node, "a:gs").map(gs => {
    const rgb = collectDeep(gs.node, "a:srgbClr")[0]?.attrs?.["@val"]?.toUpperCase();
    const scheme = collectDeep(gs.node, "a:schemeClr")[0]?.attrs?.["@val"];
    const base = rgb ?? theme.get(scheme ?? "");
    if (!base) return null;
    const transforms: Record<string, number> = {};
    for (const name of ["tint", "shade", "satMod", "lumMod", "lumOff"])
      for (const hit of collectDeep(gs.node, `a:${name}`)) transforms[name] = Number(hit.attrs["@val"] ?? 0);
    return { pos: Math.max(0, Math.min(1, Number(gs.attrs["@pos"] ?? 0) / 100000)),
      color: drawingColor(base, transforms) };
  }).filter((stop): stop is { pos: number; color: string } => Boolean(stop));
  if (!stops.length) return undefined;
  const angle = ((Number(collectDeep(node, "a:lin")[0]?.attrs?.["@ang"] ?? 0) / 60000) + 90) % 360;
  return { angle, stops };
}

/** يطبّق tint/shade على لونٍ ست عشريّ (ECMA-376: القيمة جزءٌ من ٢٥٥ ست عشريّ).
 *  ‏tint يُفتِح نحو الأبيض، وshade يُعتِم نحو الأسود. */
function applyTintShade(hex: string, tint?: string, shade?: string): string {
  const f = (v: string | undefined) => (v ? parseInt(v, 16) / 255 : null);
  const t = f(tint), sh = f(shade);
  if (t == null && sh == null) return hex;
  const ch = (i: number) => parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  const conv = (c: number) => {
    if (t != null) return Math.round(c * t + 255 * (1 - t));
    return Math.round(c * (sh as number));
  };
  return [0, 1, 2].map((i) => conv(ch(i)).toString(16).padStart(2, "0").toUpperCase()).join("");
}

/** لونُ عنصرٍ من rPr/tcPr: ‏w:color@val المباشر، أو themeColor محلولًا بالسمة.
 *  «auto» تعني «يقرّره Word» ⟵ نُعيد null فيرثه الراسمُ (أسود عادةً). */
function resolveColor(
  attrs: Record<string, string> | null | undefined, theme: Map<string, string>,
): string | null {
  if (!attrs) return null;
  const tc = attrs["@w:themeColor"];
  if (tc) {
    const base = theme.get(tc);
    if (base) return applyTintShade(base, attrs["@w:themeTint"], attrs["@w:themeShade"]);
  }
  const v = attrs["@w:val"];
  if (v && v !== "auto" && /^[0-9A-Fa-f]{6}$/.test(v)) return v.toUpperCase();
  return null;
}

/** خصائصُ مظهر رنٍّ من rPr — تُدمَج على سلسلة (مباشر ← pPr/rPr ← النمط). */
export interface RunLook {
  color?: string | null; highlight?: string | null;
  bold?: boolean;
  underline?: string | null; underlineColor?: string | null;
  strike?: boolean; doubleStrike?: boolean;
  caps?: boolean; smallCaps?: boolean; italic?: boolean;
  superscript?: boolean; subscript?: boolean;
  charSpacing?: number; position?: number; kern?: number; charScale?: number;
  textGradient?: { angle: number; stops: { pos: number; color: string }[] };
  textOutline?: { widthTwips: number; color: string };
  textShadow?: { xTwips: number; yTwips: number; blurTwips: number; color: string; opacity: number };
  /** ‏w:shadow القديم: إزاحة غليف مقاسة = 1/24 em، رمادي Word الثابت. */
  legacyShadow?: boolean;
  textReflection?: { xTwips: number; yTwips: number; blurTwips: number;
    scaleX: number; scaleY: number; startOpacity: number; endOpacity: number;
    startPosition: number; endPosition: number; fadeAngle: number };
  ligatures?: string;
  language?: string; bidiLanguage?: string; eastAsiaLanguage?: string;
}
/** «مُفعَّل» في OOXML: وجودُ الوسم بلا val، أو val ليست 0/false/off. */
function onFlag(rpr: XNode[], nm: string): boolean | undefined {
  if (first(rpr, nm) === null) return undefined;
  const v = findAttr(rpr, nm)?.["@w:val"];
  return !["0", "false", "off"].includes(v ?? "");
}
export function rPrLook(rpr: XNode[] | null, theme: Map<string, string>): RunLook {
  if (!rpr) return {};
  const out: RunLook = {};
  const colAttrs = findAttr(rpr, "w:color");
  const col = resolveColor(colAttrs, theme);
  if (col) out.color = col;
  const hl = findAttr(rpr, "w:highlight")?.["@w:val"];
  if (hl && hl !== "none") out.highlight = hl;
  const uAttrs = findAttr(rpr, "w:u");
  if (uAttrs) {
    const uv = uAttrs["@w:val"] ?? "single";
    if (uv !== "none") {
      out.underline = uv;
      const uc = resolveColor(uAttrs, theme);
      if (uc) out.underlineColor = uc;
    }
  }
  const st = onFlag(rpr, "w:strike"); if (st !== undefined) out.strike = st;
  const ds = onFlag(rpr, "w:dstrike"); if (ds !== undefined) out.doubleStrike = ds;
  const cp = onFlag(rpr, "w:caps"); if (cp !== undefined) out.caps = cp;
  const sc = onFlag(rpr, "w:smallCaps"); if (sc !== undefined) out.smallCaps = sc;
  const it = onFlag(rpr, "w:i") ?? onFlag(rpr, "w:iCs"); if (it !== undefined) out.italic = it;
  const bd = onFlag(rpr, "w:b") ?? onFlag(rpr, "w:bCs"); if (bd !== undefined) out.bold = bd;
  const va = findAttr(rpr, "w:vertAlign")?.["@w:val"];
  if (va) { out.superscript = va === "superscript"; out.subscript = va === "subscript"; }
  const legacyShadow = onFlag(rpr, "w:shadow");
  if (legacyShadow !== undefined) out.legacyShadow = legacyShadow;
  // ‏w:spacing داخل rPr تباعدُ محارفَ بالـtwips (غيرُ w:spacing في pPr وهو رأسيّ)
  for (const n of rpr) {
    if (!("w:spacing" in n)) continue;
    const v = (n[":@"] as Record<string, string> | undefined)?.["@w:val"];
    if (v != null && v !== "") out.charSpacing = Number(v);
  }
  const pos = findAttr(rpr, "w:position")?.["@w:val"];
  if (pos != null && pos !== "") out.position = Number(pos) * 10;   // أنصافُ نقاط ⟵ twips
  const kn = findAttr(rpr, "w:kern")?.["@w:val"];
  if (kn != null && kn !== "") out.kern = Number(kn);
  const width = findAttr(rpr, "w:w")?.["@w:val"];
  if (width != null && width !== "") out.charScale = Number(width);
  const ligatures = findAttr(rpr, "w14:ligatures")?.["@w14:val"];
  if (ligatures) out.ligatures = ligatures;
  const lang = findAttr(rpr, "w:lang");
  if (lang?.["@w:val"]) out.language = lang["@w:val"];
  if (lang?.["@w:bidi"]) out.bidiLanguage = lang["@w:bidi"];
  if (lang?.["@w:eastAsia"]) out.eastAsiaLanguage = lang["@w:eastAsia"];
  const textFill = collectDeep(rpr, "w14:textFill")[0]?.node;
  const grad = textFill ? collectDeep(textFill, "w14:gradFill")[0]?.node : undefined;
  if (grad) {
    const stops = collectDeep(grad, "w14:gs").map(gs => {
      const rgb = collectDeep(gs.node, "w14:srgbClr")[0]?.attrs?.["@w14:val"]?.toUpperCase();
      const scheme = collectDeep(gs.node, "w14:schemeClr")[0]?.attrs?.["@w14:val"];
      const base = rgb ?? theme.get(scheme ?? "");
      if (!base) return null;
      const transforms: Record<string, number> = {};
      for (const name of ["tint", "shade", "satMod", "lumMod", "lumOff"])
        for (const hit of collectDeep(gs.node, `w14:${name}`)) transforms[name] = Number(hit.attrs["@w14:val"] ?? 0);
      return { pos: Math.max(0, Math.min(1, Number(gs.attrs["@w14:pos"] ?? 0) / 100000)),
        color: drawingColor(base, transforms) };
    }).filter((stop): stop is { pos: number; color: string } => Boolean(stop));
    const lin = collectDeep(grad, "w14:lin")[0]?.attrs;
    if (stops.length) out.textGradient = {
      angle: ((Number(lin?.["@w14:ang"] ?? 0) / 60000) + 90) % 360, stops,
    };
  }
  const outline = collectDeep(rpr, "w14:textOutline")[0];
  if (outline && !collectDeep(outline.node, "w14:noFill").length) {
    const rgbNode = collectDeep(outline.node, "w14:srgbClr")[0];
    const schemeNode = collectDeep(outline.node, "w14:schemeClr")[0];
    const base = rgbNode?.attrs?.["@w14:val"]?.toUpperCase()
      ?? theme.get(schemeNode?.attrs?.["@w14:val"] ?? "");
    const colorNode = rgbNode?.node ?? schemeNode?.node;
    if (base && colorNode) {
      const transforms: Record<string, number> = {};
      for (const name of ["tint", "shade", "satMod", "lumMod", "lumOff"])
        for (const hit of collectDeep(colorNode, `w14:${name}`)) transforms[name] = Number(hit.attrs["@w14:val"] ?? 0);
      out.textOutline = { widthTwips: Math.max(0, Number(outline.attrs["@w14:w"] ?? 0) / 635),
        color: drawingColor(base, transforms) };
    }
  }
  const shadow = collectDeep(rpr, "w14:shadow")[0];
  if (shadow) {
    const rgbNode = collectDeep(shadow.node, "w14:srgbClr")[0];
    const schemeNode = collectDeep(shadow.node, "w14:schemeClr")[0];
    const base = rgbNode?.attrs?.["@w14:val"]?.toUpperCase()
      ?? theme.get(schemeNode?.attrs?.["@w14:val"] ?? "");
    const colorNode = rgbNode?.node ?? schemeNode?.node;
    if (base && colorNode) {
      const transforms: Record<string, number> = {};
      for (const name of ["tint", "shade", "satMod", "lumMod", "lumOff"])
        for (const hit of collectDeep(colorNode, `w14:${name}`)) transforms[name] = Number(hit.attrs["@w14:val"] ?? 0);
      const alpha = collectDeep(colorNode, "w14:alpha")[0]?.attrs?.["@w14:val"];
      const distanceTwips = Number(shadow.attrs["@w14:dist"] ?? 0) / 635;
      const radians = Number(shadow.attrs["@w14:dir"] ?? 0) / 60000 * Math.PI / 180;
      out.textShadow = {
        xTwips: distanceTwips * Math.cos(radians),
        yTwips: distanceTwips * Math.sin(radians),
        blurTwips: Math.max(0, Number(shadow.attrs["@w14:blurRad"] ?? 0) / 635),
        color: drawingColor(base, transforms),
        opacity: alpha == null ? 1 : Math.max(0, Math.min(1, Number(alpha) / 100000)),
      };
    }
  }
  const reflection = collectDeep(rpr, "w14:reflection")[0]?.attrs;
  if (reflection) {
    const distanceTwips = Number(reflection["@w14:dist"] ?? 0) / 635;
    const radians = Number(reflection["@w14:dir"] ?? 0) / 60000 * Math.PI / 180;
    out.textReflection = {
      xTwips: distanceTwips * Math.cos(radians),
      yTwips: distanceTwips * Math.sin(radians),
      blurTwips: Math.max(0, Number(reflection["@w14:blurRad"] ?? 0) / 635),
      scaleX: Number(reflection["@w14:sx"] ?? 100000) / 100000,
      scaleY: Number(reflection["@w14:sy"] ?? -100000) / 100000,
      startOpacity: Math.max(0, Math.min(1, Number(reflection["@w14:stA"] ?? 100000) / 100000)),
      endOpacity: Math.max(0, Math.min(1, Number(reflection["@w14:endA"] ?? 0) / 100000)),
      startPosition: Math.max(0, Math.min(1, Number(reflection["@w14:stPos"] ?? 0) / 100000)),
      endPosition: Math.max(0, Math.min(1, Number(reflection["@w14:endPos"] ?? 100000) / 100000)),
      fadeAngle: ((Number(reflection["@w14:fadeDir"] ?? 5400000) / 60000) + 90) % 360,
    };
  }
  return out;
}

function rPrProps(rpr: XNode[] | null, theme: Map<string, string> = new Map()): { sz: number | null; family: string | null } {
  if (!rpr) return { sz: null, family: null };
  let sz: number | null = null;
  let family: string | null = null;
  for (const n of rpr) {
    const a = (n[":@"] as Record<string, string>) ?? {};
    // ‏szCs للنص المركّب (العربية) مقدَّم عند وجوده — سلوك المحرك المرجعي (RPr.dart)
    if ("w:szCs" in n && a["@w:val"]) sz = Number(a["@w:val"]);
    else if ("w:sz" in n && sz == null && a["@w:val"]) sz = Number(a["@w:val"]);
    if ("w:rFonts" in n) {
      const themed = (token: string | undefined) => token ? theme.get(`__font:${token}`) : undefined;
      family = a["@w:cs"] ?? a["@w:ascii"] ?? a["@w:hAnsi"] ?? a["@w:eastAsia"]
        ?? themed(a["@w:cstheme"] ?? a["@w:csTheme"])
        ?? themed(a["@w:asciiTheme"]) ?? themed(a["@w:hAnsiTheme"])
        ?? themed(a["@w:eastAsiaTheme"]) ?? family;
    }
  }
  return { sz, family };
}

const NO_SPACING: SpacingProps = { present: false, line: null, lineRule: null, before: null, after: null,
  beforeAuto: null, afterAuto: null };

export function parseStyles(
  stylesXml: string | null, theme: Map<string, string> = new Map(),
): StyleTable {
  const table: StyleTable = {
    defaults: { sz: null, family: null, spacing: NO_SPACING, jc: null, bidi: null, suppressAutoHyphens: null, outlineLevel: null, keepNext: null, keepLines: null, contextualSpacing: null, widowControl: null, snapToGrid: null },
    defaultParagraphStyleId: null, byId: new Map(), nameToId: new Map(), tableById: new Map(),
  };
  if (!stylesXml) return table;
  const root = parseOoxml(stylesXml);
  const styles = first(root, "w:styles");
  if (!styles) return table;

  const docDefaults = first(styles, "w:docDefaults");
  if (docDefaults) {
    const rprDefault = first(docDefaults, "w:rPrDefault");
    const rpr = rprDefault ? first(rprDefault, "w:rPr") : null;
    const pprDefault = first(docDefaults, "w:pPrDefault");
    const dpPr = pprDefault ? first(pprDefault, "w:pPr") : null;
    table.defaults = {
      ...rPrProps(rpr, theme), spacing: spacingProps(dpPr),
      jc: findAttr(dpPr ?? [], "w:jc")?.["@w:val"] ?? null,
      bidi: pPrFlag(dpPr, "w:bidi"),
      suppressAutoHyphens: pPrFlag(dpPr, "w:suppressAutoHyphens"),
      outlineLevel: findAttr(dpPr ?? [], "w:outlineLvl")?.["@w:val"] != null
        ? Number(findAttr(dpPr ?? [], "w:outlineLvl")!["@w:val"]) : null,
      keepNext: pPrFlag(dpPr, "w:keepNext"), keepLines: pPrFlag(dpPr, "w:keepLines"),
      contextualSpacing: pPrFlag(dpPr, "w:contextualSpacing"),
      widowControl: pPrFlag(dpPr, "w:widowControl"),
      snapToGrid: pPrFlag(dpPr, "w:snapToGrid"),
    };
  }
  for (const styleNode of styles) {
    if (!("w:style" in styleNode)) continue;
    const a = (styleNode[":@"] as Record<string, string>) ?? {};
    const id = a["@w:styleId"];
    if (!id) continue;
    if (a["@w:type"] === "paragraph" && (a["@w:default"] === "1" || a["@w:default"] === "true"))
      table.defaultParagraphStyleId = id;
    const body = styleNode["w:style"] as XNode[];
    const displayName = findAttr(body, "w:name")?.["@w:val"];
    if (displayName) {
      table.nameToId.set(displayName, id);
      table.nameToId.set(displayName.toLowerCase(), id);
    }
    if (a["@w:type"] === "table") {
      const regionOf = (host: XNode[]): TableStyleRegion => {
        const tcPr = first(host, "w:tcPr");
        const tblPr = first(host, "w:tblPr");
        const shd = findAttr(tcPr ?? tblPr ?? host, "w:shd");
        const rawFill = shd?.["@w:fill"];
        const shdFill = rawFill && !["auto", "FFFFFF", "ffffff", "nil"].includes(rawFill)
          ? rawFill.toUpperCase() : null;
        const bordersNode = first(tcPr ?? [], "w:tcBorders")
          ?? first(tblPr ?? [], "w:tblBorders");
        const pPr = first(host, "w:pPr");
        const rPr = first(host, "w:rPr");
        const font = rPrProps(rPr, theme);
        return { shdFill, borders: bordersNode ? parseBorders(bordersNode) : null,
          ...font, jc: pPr ? (findAttr(pPr, "w:jc")?.["@w:val"] ?? null) : null,
          bidi: pPrFlag(pPr, "w:bidi"), look: rPrLook(rPr, theme), spacing: spacingProps(pPr) };
      };
      const regions = new Map<string, TableStyleRegion>();
      for (const child of body) {
        if (!("w:tblStylePr" in child)) continue;
        const type = ((child[":@"] as Record<string, string>) ?? {})["@w:type"];
        if (type) regions.set(type, regionOf(child["w:tblStylePr"] as XNode[]));
      }
      const styleTblPr = first(body, "w:tblPr");
      const bandSize = (name: string) => Math.max(1,
        Number(findAttr(styleTblPr ?? [], `w:${name}`)?.["@w:val"] ?? 1) || 1);
      table.tableById.set(id, { whole: regionOf(body), regions,
        rowBandSize: bandSize("tblStyleRowBandSize"),
        colBandSize: bandSize("tblStyleColBandSize") });
    }
    const rpr = first(body, "w:rPr");
    const basedOnAttrs = findAttr(body, "w:basedOn");
    const p = rPrProps(rpr, theme);
    const stylePPr = first(body, "w:pPr");
    const ind = indProps(stylePPr);
    const jc = stylePPr ? (findAttr(stylePPr, "w:jc")?.["@w:val"] ?? null) : null;
    table.byId.set(id, {
      ...p, ...ind, jc, bidi: pPrFlag(stylePPr, "w:bidi"),
      suppressAutoHyphens: pPrFlag(stylePPr, "w:suppressAutoHyphens"), spacing: spacingProps(stylePPr),
      outlineLevel: findAttr(stylePPr ?? [], "w:outlineLvl")?.["@w:val"] != null
        ? Number(findAttr(stylePPr ?? [], "w:outlineLvl")!["@w:val"]) : null,
      keepNext: pPrFlag(stylePPr, "w:keepNext"), keepLines: pPrFlag(stylePPr, "w:keepLines"),
      contextualSpacing: pPrFlag(stylePPr, "w:contextualSpacing"),
      widowControl: pPrFlag(stylePPr, "w:widowControl"),
      snapToGrid: pPrFlag(stylePPr, "w:snapToGrid"),
      look: rPrLook(rpr, theme),
      basedOn: basedOnAttrs?.["@w:val"] ?? null,
    });
  }
  for (const [id, style] of table.tableById) style.whole.spacing = resolveViaStyle(table, id, false).spacing;
  return table;
}

/** Attribute-wise style cascade; a zero spacing value is explicit, not absent. */
function overlaySpacing(base: SpacingProps, higher: SpacingProps): SpacingProps {
  return { ...base, present: base.present || higher.present,
    line: higher.line ?? base.line, lineRule: higher.line != null ? higher.lineRule : base.lineRule,
    lineSource: higher.line != null ? (higher.lineSource ?? "style") : base.lineSource ?? null,
    before: higher.before ?? base.before, after: higher.after ?? base.after,
    beforeAuto: higher.beforeAuto ?? base.beforeAuto ?? null, afterAuto: higher.afterAuto ?? base.afterAuto ?? null };
}

function tableLookFlag(attrs: Record<string, string> | null, name: string, dflt: boolean): boolean {
  const value = attrs?.[`@w:${name}`];
  if (value != null) return !["0", "false", "off"].includes(value);
  const mask: Record<string, number> = {
    firstRow: 0x20, lastRow: 0x40, firstColumn: 0x80,
    lastColumn: 0x100, noHBand: 0x200, noVBand: 0x400,
  };
  const raw = attrs?.["@w:val"];
  if (raw && mask[name] != null) return (parseInt(raw, 16) & mask[name]!) !== 0;
  return dflt;
}

/** يحل منطقة نمط الجدول للخلية بترتيب Word المرئي؛ المباشر يُطبّق بعده. */
function tableStyleRegionForCell(
  style: TableStyleProps | undefined, look: Record<string, string> | null,
  row: number, rowCount: number, col: number, colCount: number,
  rowBandSize = style?.rowBandSize ?? 1, colBandSize = style?.colBandSize ?? 1,
): TableStyleRegion {
  const merged: TableStyleRegion = style ? {
    shdFill: style.whole.shdFill, borders: style.whole.borders,
    sz: style.whole.sz, family: style.whole.family, jc: style.whole.jc,
    bidi: style.whole.bidi, look: { ...style.whole.look }, spacing: { ...style.whole.spacing },
  } : { shdFill: null, borders: null, sz: null, family: null, jc: null, bidi: null, look: {}, spacing: { ...NO_SPACING } };
  if (!style) return merged;
  const apply = (name: string) => {
    const region = style.regions.get(name); if (!region) return;
    if (region.shdFill != null) merged.shdFill = region.shdFill;
    if (region.borders != null) merged.borders = region.borders;
    if (region.sz != null) merged.sz = region.sz;
    if (region.family != null) merged.family = region.family;
    if (region.jc != null) merged.jc = region.jc;
    if (region.bidi != null) merged.bidi = region.bidi;
    merged.spacing = overlaySpacing(merged.spacing, region.spacing);
    Object.assign(merged.look, region.look);
  };
  const hasFirstRow = tableLookFlag(look, "firstRow", true);
  const hasFirstCol = tableLookFlag(look, "firstColumn", true);
  const bandRow = Math.max(0, row - (hasFirstRow ? 1 : 0));
  const bandCol = Math.max(0, col - (hasFirstCol ? 1 : 0));
  if (!tableLookFlag(look, "noHBand", false))
    apply(Math.floor(bandRow / Math.max(1, rowBandSize)) % 2 === 0 ? "band1Horz" : "band2Horz");
  if (!tableLookFlag(look, "noVBand", true))
    apply(Math.floor(bandCol / Math.max(1, colBandSize)) % 2 === 0 ? "band1Vert" : "band2Vert");
  if (hasFirstRow && row === 0) apply("firstRow");
  if (tableLookFlag(look, "lastRow", false) && row === rowCount - 1) apply("lastRow");
  if (hasFirstCol && col === 0) apply("firstCol");
  if (tableLookFlag(look, "lastColumn", false) && col === colCount - 1) apply("lastCol");
  if (row === 0 && col === 0) apply("nwCell");
  if (row === 0 && col === colCount - 1) apply("neCell");
  if (row === rowCount - 1 && col === 0) apply("swCell");
  if (row === rowCount - 1 && col === colCount - 1) apply("seCell");
  return merged;
}

function resolveViaStyle(table: StyleTable, styleId: string | null, includeDefaults = true) {
  let sz: number | null = null, family: string | null = null, jc: string | null = null;
  let bidi: boolean | null = null, suppressAutoHyphens: boolean | null = null, outlineLevel: number | null = null;
  let keepNext: boolean | null = null, keepLines: boolean | null = null;
  let contextualSpacing: boolean | null = null;
  let widowControl: boolean | null = null;
  let snapToGrid: boolean | null = null;
  const look: RunLook = {};
  let indLeft: number | null = null, indRight: number | null = null, indFirstLine: number | null = null;
  // وراثة w:spacing سمّية عبر السلسلة (درسا masjid/muqtarah الرأسيان:
  // ‏after المباشر يتعايش مع line من النمط/docDefaults؛ وطبقة النمط
  // الافتراضي هي التي تحسم لا العنصرية)
  const sp: SpacingProps = { ...NO_SPACING, lineSource: null };
  let id = styleId, guard = 0;
  while (id && guard++ < 12) {
    const s = table.byId.get(id);
    if (!s) break;
    sz ??= s.sz; family ??= s.family; jc ??= s.jc; bidi ??= s.bidi;
    suppressAutoHyphens ??= s.suppressAutoHyphens;
    outlineLevel ??= s.outlineLevel;
    keepNext ??= s.keepNext; keepLines ??= s.keepLines;
    contextualSpacing ??= s.contextualSpacing;
    widowControl ??= s.widowControl;
    snapToGrid ??= s.snapToGrid;
    for (const k of Object.keys(s.look) as (keyof RunLook)[])
      if (look[k] === undefined) (look as Record<string, unknown>)[k] = s.look[k];
    indLeft ??= s.indLeft; indRight ??= s.indRight; indFirstLine ??= s.indFirstLine;
    if (s.spacing.present) {
      sp.present = true;
      if (sp.line == null && s.spacing.line != null) {
        sp.line = s.spacing.line; sp.lineRule = s.spacing.lineRule; sp.lineSource = "style";
      }
      sp.before ??= s.spacing.before; sp.after ??= s.spacing.after;
      sp.beforeAuto ??= s.spacing.beforeAuto ?? null;
      sp.afterAuto ??= s.spacing.afterAuto ?? null;
    }
    id = s.basedOn;
  }
  const dsp = table.defaults.spacing;
  if (includeDefaults && dsp.present) {
    sp.present = true;
    if (sp.line == null && dsp.line != null) {
      sp.line = dsp.line; sp.lineRule = dsp.lineRule; sp.lineSource = "docDefaults";
    }
    sp.before ??= dsp.before; sp.after ??= dsp.after;
    sp.beforeAuto ??= dsp.beforeAuto ?? null;
    sp.afterAuto ??= dsp.afterAuto ?? null;
  }
  return {
    sz: sz ?? table.defaults.sz, family: family ?? table.defaults.family,
    jc: jc ?? table.defaults.jc,
    bidi: bidi ?? table.defaults.bidi,
    suppressAutoHyphens: suppressAutoHyphens ?? table.defaults.suppressAutoHyphens,
    outlineLevel: outlineLevel ?? table.defaults.outlineLevel,
    keepNext: keepNext ?? table.defaults.keepNext, keepLines: keepLines ?? table.defaults.keepLines,
    contextualSpacing: contextualSpacing ?? table.defaults.contextualSpacing,
    widowControl: widowControl ?? table.defaults.widowControl,
    snapToGrid: snapToGrid ?? table.defaults.snapToGrid,
    indLeft: indLeft ?? 0, indRight: indRight ?? 0, indFirstLine: indFirstLine ?? 0,
    spacing: sp, look,
  };
}

// ---------- المستند
// ═══════════ نظامُ VML (‏w:pict) — حصادُ «الشاملة الذهبية»، كتلة ١ ═══════════
// خلافَ DrawingML الذي يصف الهندسةَ بعناصرَ ووحداتِ EMU، يصف VML شكلَه بسمة
// ‏`style` نصّيّةٍ شبيهةٍ بـCSS وبوحداتٍ مطبعيّة. فلا `wp:extent` ولا `wp:posOffset`.

/** يفكّ سمةَ `style` في VML: `a:b;c:d` ⟵ خريطةٌ مصغَّرةُ المفاتيح والقيم.
 *  ‏ImageParser.dart:866-875 */
function parseVmlStyle(style: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (!style) return out;
  for (const part of style.split(";")) {
    const i = part.indexOf(":");
    if (i < 0) continue;
    const k = part.slice(0, i).trim().toLowerCase();
    const v = part.slice(i + 1).trim().toLowerCase();
    if (k) out.set(k, v);
  }
  return out;
}

/** دوران VML: رقم عادي بالدرجات أو Office fixed-point بلاحقة fd (16.16). */
function vmlAngle(value: string | undefined): number {
  if (!value) return 0;
  const raw = value.trim().toLowerCase();
  return raw.endsWith("fd") ? (Number(raw.slice(0, -2)) || 0) / 65536 : Number(raw) || 0;
}

/** محوّلُ وحدات VML ⟵ **twips**. المرجعُ يحوّل إلى بكسلات ٩٦dpi؛ ونحن نبقى في
 *  شبكة الـtwips (‏ADR-0004) فنضرب مباشرةً: نقطةٌ=٢٠ · بكسل=١٥ · بوصةٌ=١٤٤٠ ·
 *  سم=٥٦٦٫٩٢٩ · مم=٥٦٫٦٩٣. والمجرَّدُ بكسلٌ. ‏ImageParser.dart:1054-1071 */
function vmlUnit(tok: string | undefined): number {
  if (!tok) return 0;
  const t = tok.trim().toLowerCase();
  const num = parseFloat(t);
  if (!isFinite(num)) return 0;
  if (t.endsWith("pt")) return num * 20;
  if (t.endsWith("in")) return num * 1440;
  if (t.endsWith("cm")) return num * 566.9291;
  if (t.endsWith("mm")) return num * 56.69291;
  if (t.endsWith("px")) return num * 15;
  return num * 15;                                  // مجرَّدٌ = بكسل
}

/** ألوانُ HTML الستّةَ عشرَ التي يعرفها VML. ‏VmlColorResolver.dart:5-58 */
const VML_NAMED: Record<string, string> = {
  aqua: "00FFFF", black: "000000", blue: "0000FF", fuchsia: "FF00FF",
  gray: "808080", grey: "808080", green: "008000", lime: "00FF00",
  maroon: "800000", navy: "000080", olive: "808000", purple: "800080",
  red: "FF0000", silver: "C0C0C0", teal: "008080", white: "FFFFFF",
  yellow: "FFFF00",
};
/** ألوانُ نظام Windows التي يستعملها Word في VML. ‏VmlColorResolver.dart:20-58 */
const VML_SYS: Record<string, string> = {
  windowtext: "000000", window: "FFFFFF", buttonface: "F0F0F0",
  buttontext: "000000", buttonshadow: "A0A0A0", buttonhighlight: "FFFFFF",
  highlight: "0078D7", highlighttext: "FFFFFF", graytext: "6D6D6D",
  infobackground: "FFFFE1", infotext: "000000", menu: "F0F0F0",
  menutext: "000000", scrollbar: "C8C8C8", background: "000000",
  activecaption: "99B4D1", inactivecaption: "BFCDDB", captiontext: "000000",
  inactivecaptiontext: "434E54", activeborder: "B4B4B4", inactiveborder: "F4F7FC",
  appworkspace: "ABABAB", threeddarkshadow: "696969", threedlightshadow: "E3E3E3",
};
/** أسماءُ ألوان السمة في VML (‏scheme.* والمفهرسة scheme(N)).
 *  ‏VmlColorResolver.dart:60-71,141-184 */
const VML_SCHEME: Record<string, string> = {
  "scheme.background": "lt1", "scheme.fill": "lt1", "scheme.text": "dk1",
  "scheme.shadow": "dk1", "scheme.title": "dk1", "scheme.accent": "accent1",
  "scheme.hyperlink": "hlink", "scheme.followed": "folHlink",
};
const VML_SCHEME_IDX = ["lt1", "dk1", "dk1", "dk1", "lt1", "accent1", "hlink", "folHlink"];

/** يحلّ رمزَ لونٍ في VML (‏fillcolor/strokecolor/v:fill@color2/v:shadow@color).
 *  **الأهمّ**: Word يخزّن فهرسَ Office بعد اللون (`white [3212]`) فيجب قشرُه
 *  أوّلًا، وإلّا سقط كلُّ لونٍ كهذا. ‏VmlColorResolver.dart:5-125 */
function vmlColor(raw: string | undefined, theme: Map<string, string>): string | null {
  if (!raw) return null;
  // قشرُ لاحقة فهرس Office في آخر السلسلة: `#f2f2f2 [3041]`
  let t = raw.trim().toLowerCase().replace(/\s+\[[^\]]*\]$/, "").trim();
  if (!t || t === "none" || t === "auto") return null;
  if (VML_NAMED[t]) return VML_NAMED[t]!;
  if (VML_SYS[t]) return VML_SYS[t]!;
  if (VML_SCHEME[t]) return theme.get(VML_SCHEME[t]!)?.toUpperCase() ?? null;
  const idx = t.match(/^scheme\s*\(\s*(\d+)\s*\)$/);
  if (idx) {
    const nm = VML_SCHEME_IDX[Number(idx[1])];
    return nm ? (theme.get(nm)?.toUpperCase() ?? null) : null;
  }
  const rgbFn = t.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgbFn) {
    const cl = (v: string) => Math.max(0, Math.min(255, Number(v))).toString(16).padStart(2, "0");
    return (cl(rgbFn[1]!) + cl(rgbFn[2]!) + cl(rgbFn[3]!)).toUpperCase();
  }
  if (t.startsWith("#")) t = t.slice(1);
  if (/^[0-9a-f]{3}$/.test(t)) return t.split("").map((c) => c + c).join("").toUpperCase();
  if (/^[0-9a-f]{6}$/.test(t)) return t.toUpperCase();
  return null;
}

/** ‏arcsize بثلاث صيغ: لاحقة `f` كسرٌ ثابتٌ ١٦٫١٦ (÷65536) · `%` ÷100 ·
 *  ومجرَّدٌ كسرٌ مباشر · والافتراضيّ ٠٫٢. ‏VmlShapeDataParser.dart:26-31,81-95 */
function vmlArcSize(raw: string | undefined): number {
  if (!raw) return 0.2;
  const t = raw.trim().toLowerCase();
  const n = parseFloat(t);
  if (!isFinite(n)) return 0.2;
  if (t.endsWith("f")) return n / 65536;
  if (t.endsWith("%")) return n / 100;
  return n;
}

/** نمطُ التشريط: صيغةٌ رقميّةٌ (مضاعفاتُ سُمك الخطّ) أو اسمٌ معروف.
 *  ‏VmlDashPatternResolver.dart:41-83 */
function vmlDash(style: string | undefined, w: number): number[] | null {
  if (!style) return null;
  const t = style.trim().toLowerCase();
  const u = w > 0 ? w : 1;
  if (/^[\d.\s]+$/.test(t)) {
    const nums = t.split(/\s+/).map(Number).filter((n) => isFinite(n) && n > 0);
    return nums.length ? nums.map((n) => n * u) : null;
  }
  switch (t) {
    case "dash": case "shortdash": case "longdash": return [3 * u, 2 * u];
    case "dot": case "shortdot": return [u, 1.5 * u];
    case "dashdot": case "shortdashdot": case "longdashdot": return [3 * u, 1.5 * u, u, 1.5 * u];
    case "dashdotdot": case "shortdashdotdot": case "longdashdotdot":
      return [3 * u, 1.5 * u, u, 1.5 * u, u, 1.5 * u];
    default: return null;                            // مجهولٌ ⟵ مصمت
  }
}

/** عناصرُ VML التي تُعَدّ أشكالًا. ‏ImageParser.dart:634-644 */
const VML_SHAPE_TAGS = ["v:shape", "v:rect", "v:roundrect", "v:oval", "v:line",
  "v:polyline", "v:curve", "v:arc", "v:image"];
/** ‏o:spt ⟵ نوعُ الشكل (يُقرأ بالاسم المحلّيّ). ‏VmlShapeTypeResolver.dart:32-48 */
const VML_SPT: Record<string, string> = { "110": "diamond", "202": "rect",
  "75": "picture", "20": "line", "32": "line", "9": "hexagon" };

/** يستخرج أشكالَ VML من `w:pict` ويحوّلها إلى مراسٍ بهندسةٍ بالـtwips.
 *  هذا المسارُ كان **غائبًا بالكامل**: `drawingRoots` تُعيد شجرةَ w:pict لكنّ
 *  مستهلكَيها الوحيدَين حلقتا wp:anchor/wp:inline ولا تردان تحتها. */
function parseVmlShapes(
  pict: XNode[], styles: StyleTable, numbering: NumberingTable,
  theme: Map<string, string>,
): FloatAnchor[] {
  const out: FloatAnchor[] = [];
  // ‏v:shapetype قد يرد بعيدًا عن v:shape الذي يشير إليه، فنجمعها كلَّها أوّلًا
  const types = new Map<string, Record<string, string>>();
  for (const st of collectDeep(pict, "v:shapetype")) {
    const id = st.attrs["@id"];
    if (id) types.set(id, st.attrs);
  }
  // ‏v:group يعرّف **فضاءَ إحداثيّاتٍ منطقيًّا** لأبنائه: صندوقُه بالوحدات
  // الحقيقيّة من style، وأبناؤه بأعدادٍ مجرَّدةٍ تُسقَط عليه بـcoordsize/coordorigin.
  // فقراءةُ قيم الأبناء أطوالًا تعطي أرقامًا هذيانيّة (١٥٢٨٥٠tw في تذييل jalsa27).
  const groups = collectDeep(pict, "v:group");
  const inGroup = new Set<XNode[]>();
  // أشكال w:txbxContent قصة Word مستقلة، ويعيد parseTextBox تحليلها داخل
  // الصندوق. حصادها مرة أخرى من w:pict الخارجي كان يرسم شعار صفحة إبهاج
  // مرتين: مرة داخل الجدول المؤلف، ومرة كصورة عائمة فوق الصندوق كله؛ بل كان
  // collectDeep يورث rId الصورة الداخلية إلى v:roundrect الأب فيمدد الشعار
  // إلى أبعاد الصندوق. نمنع فقط إعادة الحصاد الخارجي ونبقي القصة الداخلية.
  const inTextBox = new Set<XNode[]>();
  for (const { node: box } of collectDeep(pict, "v:textbox")) {
    for (const tag of VML_SHAPE_TAGS)
      for (const { node } of collectDeep(box, tag)) inTextBox.add(node);
  }
  for (const { node: g, attrs: ga } of groups) {
    const gst = parseVmlStyle(ga["@style"]);
    const gw = vmlUnit(gst.get("width")), gh = vmlUnit(gst.get("height"));
    const gx = (() => { const a1 = gst.get("left"), a2 = gst.get("margin-left");
      return a1 != null && a2 != null ? vmlUnit(a1) + vmlUnit(a2) : vmlUnit(a1 ?? a2); })();
    const gy = (() => { const a1 = gst.get("top"), a2 = gst.get("margin-top");
      return a1 != null && a2 != null ? vmlUnit(a1) + vmlUnit(a2) : vmlUnit(a1 ?? a2); })();
    const [csx, csy] = (ga["@coordsize"] ?? "1,1").split(",").map(Number);
    const [cox, coy] = (ga["@coordorigin"] ?? "0,0").split(",").map(Number);
    const cx = csx || 1, cy = csy || 1;              // حرسُ القسمة على صفر
    // إطارُ المجموعة ومحاذاتُها يرثهما الأبناء
    const REL_H0: Record<string, string> = { page: "page", margin: "margin", text: "column" };
    const REL_V0: Record<string, string> = { page: "page", margin: "margin",
      text: "paragraph", line: "line" };
    const grh = gst.get("mso-position-horizontal-relative");
    const grv = gst.get("mso-position-vertical-relative");
    const gz = gst.get("z-index") ? Number(gst.get("z-index")!.replace(/[^0-9.-]/g, "")) : 0;
    for (const tag of VML_SHAPE_TAGS) {
      for (const { node: ch, attrs: ca } of collectDeep(g, tag)) {
        inGroup.add(ch);
        const cst = parseVmlStyle(ca["@style"]);
        const wrapDistance = (side: string) => vmlUnit(cst.get(`mso-wrap-distance-${side}`)
          ?? gst.get(`mso-wrap-distance-${side}`));
        const flip = (cst.get("flip") ?? gst.get("flip") ?? "").toLowerCase();
        const rotation = vmlAngle(cst.get("rotation") ?? gst.get("rotation"));
        // قيمُ الابن **أعدادٌ منطقيّةٌ مجرَّدة** ما لم تحمل لاحقةَ وحدة
        const logical = (v: string | undefined) => {
          if (v == null) return 0;
          const t = v.trim().toLowerCase();
          return /(pt|px|in|cm|mm)$/.test(t) ? vmlUnit(t) : (parseFloat(t) || 0);
        };
        const lx = logical(cst.get("left")), ly = logical(cst.get("top"));
        const lw = logical(cst.get("width")), lh = logical(cst.get("height"));
        const chKind = tag === "v:shape"
          ? (collectDeep(ch, "v:imagedata").length ? "picture" : "rect")
          : tag.slice(2);
        const tRef = (ca["@type"] ?? "").replace(/^#/, "");
        const tAttrs = tRef ? types.get(tRef) : undefined;
        const attrOf = (name: string) => ca[name] ?? tAttrs?.[name];
        const offish = (v: string | undefined) => v === "f" || v === "false";
        const hasBox = collectDeep(ch, "w:txbxContent").length > 0;
        const tbNode = collectDeep(ch, "v:textbox")[0];
        const tb = hasBox ? parseTextBox(ch, styles, numbering, theme) : undefined;
        const chStroke = offish(attrOf("@stroked")) ? null
          : vmlColor(attrOf("@strokecolor"), theme);
        const rawFill = vmlColor(attrOf("@fillcolor"), theme);
        const chFill = offish(attrOf("@filled")) ? null
          : rawFill ?? (chKind === "picture" && !hasBox ? null : "FFFFFF");
        const chImage = collectDeep(ch, "v:imagedata")[0];
        const chStrokeNode = collectDeep(ch, "v:stroke")[0];
        let ins: FloatAnchor["boxIns"] | undefined;
        if (tb) {
          const parts = (tbNode?.attrs?.["@inset"] ?? "").split(/[,\s]+/).filter(Boolean);
          const DEF = [144, 72, 144, 72];
          const inset = (i: number) => parts[i] ? vmlUnit(parts[i]) : DEF[i]!;
          ins = { l: inset(0), t: inset(1), r: inset(2), b: inset(3) };
        }
        out.push({
          extentW: Math.round((lw * gw) / cx), extentH: Math.round((lh * gh) / cy),
          posHRel: grh ? (REL_H0[grh] ?? "column") : "column",
          posHOffset: Math.round(gx + ((lx - (cox || 0)) * gw) / cx),
          posVRel: grv ? (REL_V0[grv] ?? "paragraph") : "paragraph",
          posVOffset: Math.round(gy + ((ly - (coy || 0)) * gh) / cy),
          posHAlign: null, posVAlign: null,
          behindDoc: gz < 0, zOrder: gz,
          distL: wrapDistance("left"), distR: wrapDistance("right"),
          distT: wrapDistance("top"), distB: wrapDistance("bottom"), wrap: "",
          rId: chImage?.attrs?.["@r:id"] ?? chImage?.attrs?.["@o:relid"] ?? null,
          ...(chImage ? { stretch: true } : {}),
          ...(rotation ? { rotDeg: rotation } : {}),
          ...(flip.includes("x") ? { flipH: true } : {}),
          ...(flip.includes("y") ? { flipV: true } : {}),
          ...(tb ? { textBox: tb } : {}),
          ...(ins ? { boxIns: ins, boxAnchor: cst.get("v-text-anchor") === "middle" ? "ctr" : "t" } : {}),
          shape: { prst: chKind, fill: chFill, stroke: chStroke,
            strokeW: offish(attrOf("@stroked")) ? 0
              : Math.round(attrOf("@strokeweight") ? vmlUnit(attrOf("@strokeweight")) : 15), adj: null,
            ...(chStrokeNode?.attrs?.["@linestyle"] ? { lineStyle: chStrokeNode.attrs["@linestyle"] } : {}) },
          vml: true,
        });
      }
    }
  }
  for (const tag of VML_SHAPE_TAGS) {
    for (const { node: sh, attrs: a } of collectDeep(pict, tag)) {
      if (inGroup.has(sh)) continue;                 // عُولج ضمن مجموعته
      if (inTextBox.has(sh)) continue;               // سيُرسم داخل قصة مربع النص
      const st = parseVmlStyle(a["@style"]);
      // VML لا يملك عنصرًا منفصلًا مماثلًا لـ wp:inline. في مستندات Word
      // القديمة يكون الشكل سطريًا ما لم تصرّح سمة style بالتموضع المطلق.
      // معاملته كمرساة عائمة يجعل صندوق الفقرة ينهار، فتغطي الزخرفة النص
      // اللاحق بدل أن تحجز ارتفاعها في السطر.
      const inlineFlow = (st.get("position") ?? "").toLowerCase() !== "absolute";
      // مربّعُ النصّ: قد يرد v:textbox بعيدًا عن الشكل فنبحث عميقًا
      const tbNode = collectDeep(sh, "v:textbox")[0];
      const hasBox = collectDeep(sh, "w:txbxContent").length > 0;
      // النوعُ: o:spt، وإلّا الاسمُ المحلّيّ، وإلّا وجودُ صورةٍ ⟵ picture
      const tRef = (a["@type"] ?? "").replace(/^#/, "");
      const tAttrs = tRef ? types.get(tRef) : undefined;
      const spt = a["@o:spt"] ?? a["@spt"] ?? tAttrs?.["@o:spt"] ?? tAttrs?.["@spt"];
      const local = tag.slice(2);
      const directShapeContent = sh.filter(item => !("v:textbox" in item) && !("w:txbxContent" in item));
      const imageData = collectDeep(directShapeContent, "v:imagedata")[0];
      let kind = spt && VML_SPT[spt] ? VML_SPT[spt]!
        : local !== "shape" ? local
        : imageData ? "picture" : "rect";
      if (hasBox && kind === "rect") kind = "rect";
      // القياسُ من style (لا wp:extent في VML)
      let w = vmlUnit(st.get("width")), h = vmlUnit(st.get("height"));
      // الموضع: left وmargin-left **يُجمعان** إن وُجدا معًا (‏ImageParser.dart:746-762)
      const sum = (k1: string, k2: string) => {
        const v1 = st.get(k1), v2 = st.get(k2);
        if (v1 != null && v2 != null) return vmlUnit(v1) + vmlUnit(v2);
        return vmlUnit(v1 ?? v2);
      };
      let x = sum("left", "margin-left"), y = sum("top", "margin-top");
      // ‏v:line هندستُه من from/to لا من القياس (‏ImageParser.dart:789-808)
      if (kind === "line" && (a["@from"] || a["@to"])) {
        const pt = (v: string | undefined) => (v ?? "0,0").split(",").map((c) => vmlUnit(c.trim()));
        const [fx, fy] = pt(a["@from"]) as [number, number];
        const [tx, ty] = pt(a["@to"]) as [number, number];
        w = Math.max(1, Math.abs(tx - fx)); h = Math.max(1, Math.abs(ty - fy));
        if (x <= 0) x = Math.min(fx, tx);
        if (y <= 0) y = Math.min(fy, ty);
      }
      // ‏z-index: سالبٌ ⟵ خلف النصّ (‏ImageParser.dart:1040-1052)
      const zRaw = st.get("z-index");
      const z = zRaw ? Number(zRaw.replace(/[^0-9.-]/g, "")) : 0;
      // الإطارُ المرجعيّ والمحاذاة (‏ImageParser.dart:885-925)
      const REL_H: Record<string, string> = { page: "page", margin: "margin", text: "column" };
      const REL_V: Record<string, string> = { page: "page", margin: "margin",
        text: "paragraph", line: "line" };
      const alignH = st.get("mso-position-horizontal") ?? null;
      const alignV = st.get("mso-position-vertical") ?? null;
      const relHRaw = st.get("mso-position-horizontal-relative");
      const relVRaw = st.get("mso-position-vertical-relative");
      // **قاعدةٌ تخالف DrawingML**: محاذاةٌ موجودةٌ و-relative غائبة ⟵ page
      const posHRel = relHRaw ? (REL_H[relHRaw] ?? "column") : (alignH ? "page" : "column");
      const posVRel = relVRaw ? (REL_V[relVRaw] ?? "paragraph") : "paragraph";
      // ‏w10:wrap هو نموذجُ الالتفاف؛ وغيابُه على شكلٍ مطلقٍ ⟵ بلا التفاف
      const wrapNode = collectDeep(sh, "w10:wrap")[0] ?? collectDeep(pict, "w10:wrap")[0];
      const wt = (wrapNode?.attrs?.["@type"] ?? "").toLowerCase();
      const WRAP: Record<string, string> = { square: "Square", tight: "Tight",
        through: "Through", topandbottom: "TopAndBottom" };
      const wrap = WRAP[wt] ?? "None";
      const wrapDistance = (side: string) => vmlUnit(st.get(`mso-wrap-distance-${side}`));
      const flip = (st.get("flip") ?? "").toLowerCase();
      const rotation = vmlAngle(st.get("rotation"));
      // الحشوُ والخطّ: يُورَثان من v:shapetype عند غياب السمة
      const attrOf = (nm: string) => a[nm] ?? tAttrs?.[nm];
      const offish = (v: string | undefined) => v === "f" || v === "false";
      const isFilled = !offish(attrOf("@filled"));
      const isStroked = !offish(attrOf("@stroked"));
      const fillColor = isFilled ? vmlColor(attrOf("@fillcolor"), theme) : null;
      // VML's authored default stroke is black.  In particular, Word commonly
      // omits `strokecolor` from footer rules (`v:line`) while still expecting
      // the rule to be painted.  Treating an omitted colour as "no stroke"
      // silently removed those footer rules from the browser rendering.
      const strokeColor = isStroked ? (vmlColor(attrOf("@strokecolor"), theme) ?? "000000") : null;
      const strokeNode = collectDeep(sh, "v:stroke")[0];
      const strokeW = attrOf("@strokeweight") ? vmlUnit(attrOf("@strokeweight")) : 15;
      const dash = vmlDash(strokeNode?.attrs?.["@dashstyle"], strokeW);
      const endcap = strokeNode?.attrs?.["@endcap"] ?? "flat";
      // حشوُ الشكل الافتراضيّ (‏VmlShapeFillResolver.dart:10-34): صورةٌ بلا مربّع
      // نصٍّ ⟵ **شفّاف** (لئلّا يُخترع مستطيلٌ أبيضُ خلف PNG شفّافة)، وإلّا أبيض.
      const effFill = !isFilled ? null
        : fillColor ?? (kind === "picture" && !hasBox ? null : "FFFFFF");
      const tb = hasBox ? parseTextBox(sh, styles, numbering, theme) : undefined;
      const vmlCrop = (v: string | undefined) => {
        if (!v) return 0;
        const s = v.trim().toLowerCase();
        if (s.endsWith("f")) return Number(s.slice(0, -1)) / 65536;
        if (s.endsWith("%")) return Number(s.slice(0, -1)) / 100;
        return Number(s) || 0;
      };
      const crop = imageData ? {
        l: vmlCrop(imageData.attrs["@cropleft"]), t: vmlCrop(imageData.attrs["@croptop"]),
        r: vmlCrop(imageData.attrs["@cropright"]), b: vmlCrop(imageData.attrs["@cropbottom"]),
      } : null;
      // حشواتُ مربّع النصّ: ترتيبُ VML يسار/أعلى/يمين/أسفل وافتراضاتُه تخالف
      // ‏DrawingML قيمةً وترتيبًا (‏0.1in,0.05in,0.1in,0.05in).
      let ins: FloatAnchor["boxIns"] | undefined;
      if (tb) {
        const parts = (tbNode?.attrs?.["@inset"] ?? "").split(/[,\s]+/).filter((x) => x !== "");
        const DEF = [144, 72, 144, 72];              // ‏0.1in/0.05in بالـtwips
        const g = (i: number) => (parts[i] ? vmlUnit(parts[i]) : DEF[i]!);
        ins = { l: g(0), t: g(1), r: g(2), b: g(3) };
      }
      if (!tb && !w && !h) continue;                 // لا هندسةَ ولا محتوًى
      out.push({
        extentW: Math.round(w), extentH: Math.round(h),
        posHRel, posHOffset: Math.round(x), posVRel, posVOffset: Math.round(y),
        distL: wrapDistance("left"), distR: wrapDistance("right"),
        distT: wrapDistance("top"), distB: wrapDistance("bottom"),
        wrap: wrap === "None" ? "" : wrap,
        rId: imageData?.attrs?.["@r:id"] ?? imageData?.attrs?.["@o:relid"] ?? null,
        ...(imageData ? { stretch: true } : {}),
        ...(rotation ? { rotDeg: rotation } : {}),
        ...(flip.includes("x") ? { flipH: true } : {}),
        ...(flip.includes("y") ? { flipV: true } : {}),
        ...(crop && (crop.l || crop.t || crop.r || crop.b) ? { srcRect: crop } : {}),
        behindDoc: z < 0,
        ...(inlineFlow ? { inlineFlow: true } : {}),
        posHAlign: alignH && ["left", "center", "right"].includes(alignH) ? alignH : null,
        posVAlign: alignV && ["top", "center", "bottom"].includes(alignV) ? alignV : null,
        zOrder: z,
        ...(tb ? { textBox: tb } : {}), ...(ins ? { boxIns: ins, boxAnchor: "t" } : {}),
        shape: { prst: kind, fill: effFill, stroke: strokeColor,
          strokeW: isStroked ? Math.round(strokeW) : 0,
          adj: kind === "roundrect" ? vmlArcSize(attrOf("@arcsize")) : null,
          ...(dash ? { dash } : {}), endcap,
          ...(strokeNode?.attrs?.["@linestyle"] ? { lineStyle: strokeNode.attrs["@linestyle"] } : {}) },
        vml: true,
      });
    }
  }
  return out;
}

/** فقراتُ مربّع نصٍّ داخل شكل (‏wps:txbx أو v:textbox ← w:txbxContent).
 *  نُعيد تسلسلَ محتواه إلى XML ثمّ نمرّره على parseDocument نفسِه، فتنطبق عليه
 *  كلُّ قواعد الفقرة (الأنماط، الحقول، الترقيم) بلا ازدواجِ منطق. */
function parseTextBox(
  shape: XNode[], styles: StyleTable, numbering: NumberingTable,
  theme: Map<string, string> = new Map(),
): BodyParagraph[] | undefined {
  const box = collectDeep(shape, "w:txbxContent")[0]?.node;
  if (!box || !box.length) return undefined;
  try {
    const inner = builder.build(box) as string;
    const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`
      + `<w:body>${inner}</w:body></w:document>`;
    const paras = parseDocument(xml, styles, numbering, theme).paragraphs;
    return paras.length ? paras : undefined;
  } catch {
    return undefined; // مربّعٌ لا يُعاد تسلسلُه: نتجاهله ولا نُسقِط بقيّة الصفحة
  }
}

// سياقُ الحزمة أثناء التحليل: علاقاتُ الأجزاء ورسومُ SmartArt والجزءُ الجاري.
// يُضبَط في extractFromDocx قبل التحليل — لأنّ parseDocument يعمل على XML مفردٍ
// لا يعرف حزمتَه، والمرساةُ تحتاج علاقاتِ جزئها لتحلّ رسمَها.
let partRelsRef: Map<string, Map<string, string>> = new Map();
let diagramsRef: Map<string, string> = new Map();
let chartsRef: Map<string, string> = new Map();
let partNameRef: string | null = null;

/** أشكالُ رسم SmartArt من diagrams/drawingN.xml. الجزءُ المرسوم يحمل النتيجةَ
 *  النهائيّة (مواضعُ وأحجامٌ ونصوص) فلا نحتاج إعادةَ حساب التخطيط الدلاليّ. */
function parseDiagramDrawing(
  xml: string, theme: Map<string, string>, scale: number,
): NonNullable<FloatAnchor["diagram"]> {
  const out: NonNullable<FloatAnchor["diagram"]> = [];
  const root = parseOoxml(xml);
  for (const { node: sp } of collectDeep(root, "dsp:sp")) {
    const spPr = collectDeep(sp, "dsp:spPr")[0]?.node ?? sp;
    const xfrm = collectDeep(spPr, "a:xfrm")[0]?.node ?? [];
    const off = collectDeep(xfrm, "a:off")[0]?.attrs;
    const ext = collectDeep(xfrm, "a:ext")[0]?.attrs;
    if (!off || !ext) continue;
    // اللون: حشوٌ صريح، وإلّا أوّلُ محطّةٍ في التدرّج (تقريبٌ معلَن للتدرّج)
    const clrNode = collectDeep(spPr, "a:solidFill")[0]?.node
      ?? collectDeep(spPr, "a:gs")[0]?.node;
    const srgb = clrNode ? collectDeep(clrNode, "a:srgbClr")[0]?.attrs?.["@val"] : undefined;
    const sch = clrNode ? collectDeep(clrNode, "a:schemeClr")[0]?.attrs?.["@val"] : undefined;
    const fill = srgb ? srgb.toUpperCase() : (sch ? theme.get(sch) ?? null : null);
    // النصّ: كلُّ a:t في dsp:txBody، وحجمُه من a:rPr@sz (مئاتُ النقطة ⟵ twips ÷٥)
    const tx = collectDeep(sp, "dsp:txBody")[0]?.node ?? [];
    let text = "";
    for (const { node: t } of collectDeep(tx, "a:t")) {
      const seg = t.find((n) => "#text" in n)?.["#text"];
      if (seg != null) text += String(seg);
    }
    const szAttr = collectDeep(tx, "a:rPr")[0]?.attrs?.["@sz"];
    out.push({
      x: Math.round(Number(off["@x"]) * scale / 635),
      y: Math.round(Number(off["@y"]) * scale / 635),
      w: Math.round(Number(ext["@cx"]) * scale / 635),
      h: Math.round(Number(ext["@cy"]) * scale / 635),
      prst: collectDeep(spPr, "a:prstGeom")[0]?.attrs?.["@prst"] ?? "rect",
      fill, text: text.trim(),
      em: szAttr ? Math.round(Number(szAttr) / 5) : 200,
    });
  }
  return out;
}

/** يقرأ cache الرسم نفسه؛ لا يعتمد على workbook خارجي ولا يختلق بيانات مفقودة. */
export function parseChart(xml: string, theme: Map<string, string>): NonNullable<FloatAnchor["chart"]> {
  const root = parseOoxml(xml);
  const plot = collectDeep(root, "c:plotArea")[0]?.node ?? [];
  const supported = collectDeep(plot, "c:barChart")[0];
  if (!supported) {
    const type = Object.keys(plot.find(node => Object.keys(node).some(key => /^c:.+Chart$/.test(key))) ?? {})
      .find(key => /^c:.+Chart$/.test(key))?.slice(2) ?? "unknown";
    return { kind: "unsupported", unsupportedType: type, direction: "column", grouping: "",
      title: null, legend: { visible: false, position: "r" }, showValues: false,
      categoryAxis: false, valueAxis: false, categories: [], series: [] };
  }
  const node = supported.node;
  const value = (host: XNode[], tag: string): string | null => {
    const found = collectDeep(host, tag)[0];
    if (!found) return null;
    return found.attrs["@val"] ?? String(found.node.find(n => "#text" in n)?.["#text"] ?? "");
  };
  const texts = (host: XNode[], parent: string): string[] => {
    const part = collectDeep(host, parent)[0]?.node ?? [];
    return collectDeep(part, "c:pt").sort((a, b) => Number(a.attrs["@idx"]) - Number(b.attrs["@idx"]))
      .map(point => value(point.node, "c:v") ?? "");
  };
  const chartTitle = collectDeep(root, "c:title")[0]?.node;
  const title = chartTitle ? (collectDeep(chartTitle, "a:t").map(t =>
    String(t.node.find(n => "#text" in n)?.["#text"] ?? "")).join("").trim()
    || texts(chartTitle, "c:strCache")[0] || null) : null;
  const firstSer = collectDeep(node, "c:ser")[0]?.node ?? [];
  const categories = texts(firstSer, "c:cat");
  const darken = (hex: string, factor: number) => hex.match(/../g)!
    .map(part => Math.round(Number.parseInt(part, 16) * factor).toString(16).padStart(2, "0")).join("").toUpperCase();
  const series = collectDeep(node, "c:ser").map((entry, index) => {
    const ser = entry.node;
    const name = texts(ser, "c:tx")[0] ?? `Series ${index + 1}`;
    const values = texts(ser, "c:val").map(Number).filter(Number.isFinite);
    const srgb = collectDeep(ser, "a:srgbClr")[0]?.attrs["@val"];
    const schemeNode = collectDeep(ser, "a:schemeClr")[0];
    let color = srgb?.toUpperCase() ?? theme.get(schemeNode?.attrs["@val"] ?? "") ?? "4472C4";
    const lum = !srgb && schemeNode ? Number(value(schemeNode.node, "a:lumMod") ?? 100000) / 100000 : 1;
    if (lum !== 1) color = darken(color, lum);
    return { name, values, color };
  });
  const legend = collectDeep(root, "c:legend")[0]?.node;
  return { kind: "bar", direction: value(node, "c:barDir") === "bar" ? "bar" : "column",
    grouping: value(node, "c:grouping") ?? "clustered", title,
    legend: { visible: Boolean(legend), position: legend ? value(legend, "c:legendPos") ?? "r" : "r" },
    showValues: value(node, "c:showVal") === "1", categoryAxis: collectDeep(plot, "c:catAx").length > 0,
    valueAxis: collectDeep(plot, "c:valAx").some(axis => value(axis.node, "c:delete") !== "1"),
    categories, series };
}

function imageEffectsOf(node: XNode[], theme: Map<string, string>): FloatAnchor["imageEffects"] | undefined {
  const blip = collectDeep(node, "a:blip")[0]?.node;
  const out: NonNullable<FloatAnchor["imageEffects"]> = {};
  const alpha = blip ? collectDeep(blip, "a:alphaModFix")[0]?.attrs?.["@amt"] : null;
  if (alpha != null) out.opacity = Math.max(0, Math.min(1, Number(alpha) / 100000));
  if (blip && collectDeep(blip, "a:grayscl").length) out.grayscale = true;
  const lum = blip ? collectDeep(blip, "a:lum")[0]?.attrs : undefined;
  if (lum?.["@bright"] != null) out.brightness = 1 + Number(lum["@bright"]) / 100000;
  if (lum?.["@contrast"] != null) out.contrast = 1 + Number(lum["@contrast"]) / 100000;
  const colorOf = (host: XNode[]): { color: string; opacity: number } => {
    const srgb = collectDeep(host, "a:srgbClr")[0];
    const scheme = collectDeep(host, "a:schemeClr")[0];
    const color = (srgb?.attrs["@val"] ?? theme.get(scheme?.attrs["@val"] ?? "") ?? "000000").toUpperCase();
    const colorNode = srgb?.node ?? scheme?.node ?? [];
    const a = collectDeep(colorNode, "a:alpha")[0]?.attrs?.["@val"];
    return { color, opacity: a == null ? 1 : Math.max(0, Math.min(1, Number(a) / 100000)) };
  };
  const shadow = collectDeep(node, "a:outerShdw")[0];
  if (shadow) {
    const dist = Number(shadow.attrs["@dist"] ?? 0) / 9525;
    const angle = Number(shadow.attrs["@dir"] ?? 0) / 60000 * Math.PI / 180;
    const c = colorOf(shadow.node);
    out.shadow = { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist,
      blur: Number(shadow.attrs["@blurRad"] ?? 0) / 9525, ...c };
  } else {
    // ‏wps:style/a:effectRef@idx — مثل ظل مربع PAGE في رؤوس الصفحات.
    const effectIdx = collectDeep(node, "a:effectRef")[0]?.attrs?.["@idx"];
    const encoded = effectIdx ? theme.get(`__effectStyle:${effectIdx}`) : undefined;
    if (encoded) {
      try {
        const e = JSON.parse(encoded) as { blurRad: number; dist: number; dir: number;
          color: string; opacity: number };
        const angle = e.dir / 60000 * Math.PI / 180;
        out.shadow = { x: Math.cos(angle) * e.dist / 9525,
          y: Math.sin(angle) * e.dist / 9525, blur: e.blurRad / 9525,
          color: e.color, opacity: e.opacity };
      } catch { /* سمة تالفة: لا نسقط بقية الشكل. */ }
    }
  }
  const glow = collectDeep(node, "a:glow")[0];
  if (glow) out.glow = { radius: Number(glow.attrs["@rad"] ?? 0) / 9525, ...colorOf(glow.node) };
  const soft = collectDeep(node, "a:softEdge")[0]?.attrs?.["@rad"];
  if (soft != null) out.softEdge = Number(soft) / 9525;
  const line = collectDeep(node, "a:ln")[0];
  if (line && !collectDeep(line.node, "a:noFill").length) {
    const c = colorOf(line.node);
    const dash = collectDeep(line.node, "a:prstDash")[0]?.attrs?.["@val"];
    out.border = { width: Math.max(0.5, Number(line.attrs["@w"] ?? 0) / 9525), color: c.color,
      ...(dash ? { dash } : {}) };
  }
  if (blip) {
    const duo = collectDeep(blip, "a:duotone")[0];
    if (duo) {
      const colors = duo.node.filter(n => "a:srgbClr" in n || "a:schemeClr" in n)
        .map(n => colorOf([n]).color);
      if (colors.length >= 2) out.duotone = { low: colors[0]!, high: colors[1]! };
    }
  }
  const reflection = collectDeep(node, "a:reflection")[0];
  if (reflection) out.reflection = {
    distance: Number(reflection.attrs["@dist"] ?? 0) / 9525,
    startOpacity: Number(reflection.attrs["@stA"] ?? 100000) / 100000,
    endOpacity: Number(reflection.attrs["@endA"] ?? 0) / 100000,
  };
  return Object.keys(out).length ? out : undefined;
}

export function parseDocument(
  documentXml: string, styles: StyleTable,
  numbering: NumberingTable = new Map(),
  theme: Map<string, string> = new Map(),
  rels?: Map<string, string>,
): DocumentModelV0 {
  const root = parseOoxml(documentXml);
  const doc = first(root, "w:document");
  const body = doc ? first(doc, "w:body") : null;
  if (!body) throw new Error("w:body غير موجود");

  const DEFAULT_GEO: SectionGeometry = {
    pageWTwips: 11906, pageHTwips: 16838, marLeftTwips: 1440, marRightTwips: 1440,
    marTopTwips: 1440, marBottomTwips: 1440, columnTwips: 9026,
    colCount: 1, colSpaceTwips: 708, colWidthTwips: 9026,
    pgNumFmt: null, pgNumStart: null, sectStart: "nextPage",
    docGridLinePitch: null, docGridType: null,
  };
  function geomFrom(sectPr: XNode[] | null): SectionGeometry {
    if (!sectPr) return DEFAULT_GEO;
    const pgSz = findAttr(sectPr, "w:pgSz");
    const pgMar = findAttr(sectPr, "w:pgMar");
    const w = Number(pgSz?.["@w:w"] ?? DEFAULT_GEO.pageWTwips);
    const h = Number(pgSz?.["@w:h"] ?? DEFAULT_GEO.pageHTwips);
    const l = Number(pgMar?.["@w:left"] ?? DEFAULT_GEO.marLeftTwips);
    const r = Number(pgMar?.["@w:right"] ?? DEFAULT_GEO.marRightTwips);
    const t = Number(pgMar?.["@w:top"] ?? DEFAULT_GEO.marTopTwips);
    const b = Number(pgMar?.["@w:bottom"] ?? DEFAULT_GEO.marBottomTwips);
    const headerRefs: Record<string, string> = {}, footerRefs: Record<string, string> = {};
    for (const node of sectPr) {
      for (const [key, bag] of [["w:headerReference", headerRefs], ["w:footerReference", footerRefs]] as const) {
        if (!(key in node)) continue;
        const a = (node[":@"] as Record<string, string>) ?? {};
        const ty = a["@w:type"] ?? "default";
        const rid = a["@r:id"];
        if (rid) (bag as Record<string, string>)[ty] = rid;
      }
    }
    // ‏w:cols: أعمدة متساوية أو قائمة w:col صريحة عندما equalWidth="0".
    const colsAttr = findAttr(sectPr, "w:cols");
    const colsNode = first(sectPr, "w:cols");
    const explicitColumns = (colsNode ?? []).flatMap(node => {
      if (!("w:col" in node)) return [];
      const attrs = (node[":@"] as Record<string, string>) ?? {};
      const widthTwips = Number(attrs["@w:w"]);
      if (!Number.isFinite(widthTwips) || widthTwips <= 0) return [];
      const spaceAfterTwips = Number(attrs["@w:space"] ?? colsAttr?.["@w:space"] ?? 0);
      return [{ widthTwips, spaceAfterTwips: Number.isFinite(spaceAfterTwips) ? spaceAfterTwips : 0 }];
    });
    const colCount = Math.max(1, explicitColumns.length || Number(colsAttr?.["@w:num"] ?? 1) || 1);
    const colSpaceTwips = Number(colsAttr?.["@w:space"] ?? 708);
    const usable = w - l - r;
    const colWidthTwips = explicitColumns[0]?.widthTwips ?? (colCount > 1
      ? Math.floor((usable - colSpaceTwips * (colCount - 1)) / colCount) : usable);
    const notePr = (kind: "footnote" | "endnote"): Partial<NotePreferences> | undefined => {
      const host = first(sectPr, `w:${kind}Pr`);
      if (!host) return undefined;
      const val = (tag: string) => findAttr(host, `w:${tag}`)?.["@w:val"];
      const out: Partial<NotePreferences> = {};
      const start = val("numStart");
      if (start != null && Number.isFinite(Number(start))) out.start = Number(start);
      const restart = val("numRestart"); if (restart) out.restart = restart;
      const fmt = val("numFmt"); if (fmt) out.fmt = fmt;
      const position = val("pos"); if (position) out.position = position;
      return Object.keys(out).length ? out : undefined;
    };
    const footnotePr = notePr("footnote");
    const endnotePr = notePr("endnote");
    return { pageWTwips: w, pageHTwips: h, marLeftTwips: l, marRightTwips: r,
      marTopTwips: t, marBottomTwips: b, columnTwips: colWidthTwips,
      colCount, colSpaceTwips, colWidthTwips,
      ...(explicitColumns.length ? { explicitColumns } : {}),
      headerRefs, footerRefs,
      pgNumFmt: findAttr(sectPr, "w:pgNumType")?.["@w:fmt"] ?? null,
      pgNumStart: findAttr(sectPr, "w:pgNumType")?.["@w:start"] != null
        ? Number(findAttr(sectPr, "w:pgNumType")!["@w:start"]) : null,
      sectStart: findAttr(sectPr, "w:type")?.["@w:val"] ?? "nextPage",
      docGridLinePitch: findAttr(sectPr, "w:docGrid")?.["@w:linePitch"] != null
        ? Number(findAttr(sectPr, "w:docGrid")!["@w:linePitch"]) : null,
      docGridType: findAttr(sectPr, "w:docGrid")?.["@w:type"] ?? null,
      headerDistTwips: Number(pgMar?.["@w:header"] ?? 720),
      footerDistTwips: Number(pgMar?.["@w:footer"] ?? 720),
      titlePg: first(sectPr, "w:titlePg") !== null,
      ...(footnotePr ? { footnotePr } : {}),
      ...(endnotePr ? { endnotePr } : {}),
      ...(() => {
        const pgBorders = collectDeep(sectPr, "w:pgBorders")[0];
        if (!pgBorders) return { pageBorders: null };
        return {
          pageBorders: parseBorders(pgBorders.node),
          pageBorderOffsetFrom: (pgBorders.attrs["@w:offsetFrom"] === "text" ? "text" : "page") as "page" | "text",
          pageBorderDisplay: (pgBorders.attrs["@w:display"] ?? "allPages") as "allPages" | "firstPage" | "notFirstPage",
          pageBorderZOrder: (pgBorders.attrs["@w:zOrder"] === "back" ? "back" : "front") as "front" | "back",
        };
      })() };
  }
  const sections: SectionGeometry[] = [];
  let pendingFrom = 0; // أول فقرة لم يُسند مقطعها بعد

  const paragraphs: BodyParagraph[] = [];
  let idx = 0;
  // كسرُ الصفحة المعلَّق: يُنقَل من فقرةٍ حاملةٍ للكسر (أو حدِّ مقطع) إلى الفقرة
  // المرصَّفة التالية. الفقرات غير المرصَّفة (فارغة/صور) لا تستهلكه بل تُمرِّره. generic.
  let pendingBreaks = 0;
  // عدّادا الحواشي/التعليقات: **تسلسليّان بترتيب الظهور** في المتن (لا بـw:id)
  const footnoteSeq = { n: 0 }, endnoteSeq = { n: 0 };
  // تسطيح الكتل: فقرات المستوى الأعلى + فقرات خلايا الجداول (w:tbl>w:tr>w:tc>w:p) بترتيب
  // المستند — لإدراج محتوى الجداول في التدفّق (حصاد «الشاملة الذهبية»؛ التخطيط الشبكيّ
  // الكامل لاحقًا، لكنّ المحتوى يحضر ويُقاس). التداخل يُعالَج تكراريًّا.
  let tableCounter = 0;
  const MAX_TABLE_NESTING = 16;
  const flattenBlocks = (
    nodes: XNode[], ctx: TableCellCtx | null = null, depth = 0,
    sharedCellBlock?: { value: number },
  ): { node: XNode; cell: TableCellCtx | null }[] => {
    const out: { node: XNode; cell: TableCellCtx | null }[] = [];
    const cellBlock = sharedCellBlock ?? { value: 0 };
    for (const n of nodes) {
      if ("w:p" in n) {
        out.push({ node: n, cell: ctx ? { ...ctx, cellBlockIndex: cellBlock.value } : null });
        if (ctx) cellBlock.value++;
      }
      else if ("w:sdt" in n) {
        // Built-in Word galleries (most notably “Page Numbers”) wrap their
        // actual paragraphs/tables in w:sdt/w:sdtContent.  Treat the content
        // control as a transparent block container; otherwise a perfectly
        // valid PAGE field in a footer disappears and only a following empty
        // paragraph survives.  Recursion also preserves nested tables and the
        // owning cell context without making document-specific assumptions.
        const content = first(n["w:sdt"] as XNode[], "w:sdtContent");
        if (content) out.push(...flattenBlocks(content, ctx, depth, cellBlock));
      }
      else if ("w:tbl" in n) {
        if (depth >= MAX_TABLE_NESTING) throw new Error(`تجاوز تعشيش الجداول الحد ${MAX_TABLE_NESTING}`);
        const tbl = n["w:tbl"] as XNode[];
        const tblPr = first(tbl, "w:tblPr");
        const tblStyleId = tblPr ? (findAttr(tblPr, "w:tblStyle")?.["@w:val"] ?? null) : null;
        const tblWAttr = tblPr ? findAttr(tblPr, "w:tblW") : null;
        const tblWVal = Number(tblWAttr?.["@w:w"] ?? 0);
        const tblWType = tblWAttr?.["@w:type"] ?? "auto";
        const tblPrNode = first(tbl, "w:tblPr");
        const rawTblLayout = tblPrNode ? findAttr(tblPrNode, "w:tblLayout")?.["@w:type"] : undefined;
        const tblLayout: "fixed" | "autofit" = rawTblLayout === "fixed" ? "fixed" : "autofit";
        const tblLook = tblPrNode ? findAttr(tblPrNode, "w:tblLook") : null;
        const tableStyle = tblStyleId ? styles.tableById.get(tblStyleId) : undefined;
        const directBandSize = (name: string, fallback: number) => Math.max(1,
          Number(findAttr(tblPrNode ?? [], `w:${name}`)?.["@w:val"] ?? fallback) || fallback);
        const rowBandSize = directBandSize("tblStyleRowBandSize", tableStyle?.rowBandSize ?? 1);
        const colBandSize = directBandSize("tblStyleColBandSize", tableStyle?.colBandSize ?? 1);
        // ‏w:bidiVisual: ترتيبُ الخلايا بصريًّا (أوّلُ خليّةٍ يمينًا). غيابُ tblPr
        // بالكلّيّة ⟵ true (انحيازٌ للمستندات العربيّة)، ووجودُه بلا الوسم ⟵ false.
        const bidiVisual = !tblPrNode ? true
          : (first(tblPrNode, "w:bidiVisual") !== null
            && !["0", "false"].includes(findAttr(tblPrNode, "w:bidiVisual")?.["@w:val"] ?? ""));
        // ‏w:tblInd: إزاحةُ الجدول — تُهمَل إن كان النوعُ pct/auto/nil أو القيمةُ ≤ ٠
        const indAttr = tblPrNode ? findAttr(tblPrNode, "w:tblInd") : null;
        const indType = indAttr?.["@w:type"] ?? "dxa";
        const rawInd = Number(indAttr?.["@w:w"] ?? 0);
        const tblIndTwips = (["pct", "auto", "nil"].includes(indType) || rawInd <= 0) ? 0 : rawInd;
        const tblJc = tblPrNode ? (findAttr(tblPrNode, "w:jc")?.["@w:val"] ?? null) : null;
        const tblCellMar = tblPrNode ? first(tblPrNode, "w:tblCellMar") : null;
        // حدودُ الجدول (w:tblPr/w:tblBorders) — fallback لخلايا بلا حدودٍ مباشرة
        const tblBordersNode = tblPrNode ? first(tblPrNode, "w:tblBorders") : null;
        const tblBorders = tblBordersNode ? parseBorders(tblBordersNode) : null;
        const grid = collectDeep(tbl, "w:gridCol").map((g) => Number(g.attrs["@w:w"] ?? 0));
        const colX: number[] = []; let acc = 0;
        for (const w of grid) { colX.push(acc); acc += w; }
        const tableId = tableCounter++;
        const tableRows = tbl.filter((item) => "w:tr" in item);
        const rowCount = tableRows.length;
        const colCount = Math.max(1, grid.length);
        let row = 0;
        for (const tr of tbl) {
          if (!("w:tr" in tr)) continue;
          const trPr = first(tr["w:tr"] as XNode[], "w:trPr");
          const csVal = trPr ? findAttr(trPr, "w:cantSplit")?.["@w:val"] : undefined;
          const cantSplit = trPr ? (first(trPr, "w:cantSplit") !== null
            && !["0", "false", "off"].includes(csVal ?? "")) : false;
          const headerVal = trPr ? findAttr(trPr, "w:tblHeader")?.["@w:val"] : undefined;
          const repeatHeader = trPr ? (first(trPr, "w:tblHeader") !== null
            && !["0", "false", "off"].includes(headerVal ?? "")) : false;
          // Word permits a row-level justification override in trPr.  It is
          // physical/visual table placement metadata, not paragraph alignment.
          const rowTblJc = trPr ? (findAttr(trPr, "w:jc")?.["@w:val"] ?? tblJc) : tblJc;
          // ‏w:trHeight: ارتفاعٌ مفروضٌ للصفّ (atLeast يوسّع، exact يقصّ)
          const trH = trPr ? findAttr(trPr, "w:trHeight") : null;
          const rowHeight = trH?.["@w:val"] != null ? Number(trH["@w:val"]) : null;
          // ‏w:hRule الافتراضيّ **auto**: القيمةُ تُهمَل ولا تُفرَض حدًّا أدنى.
          // ‏atLeast وحدها توسّع، وexact وحدها تفرض. (كان عندي atLeast خطأً.)
          const rowHeightRule = trH?.["@w:hRule"] ?? "auto";
          const cells = (tr["w:tr"] as XNode[]).filter((c) => "w:tc" in c);
          let col = 0;
          cells.forEach((cell, ci) => {
            const tc = cell["w:tc"] as XNode[];
            const span = Number(findAttr(first(tc, "w:tcPr") ?? tc, "w:gridSpan")?.["@w:val"] ?? 1);
            const colWTwips = grid.slice(col, col + span).reduce((a, b) => a + b, 0) || 0;
            const tcPr = first(tc, "w:tcPr");
            const rawFill = tcPr ? (findAttr(tcPr, "w:shd")?.["@w:fill"] ?? null) : null;
            const directShd = rawFill && !["auto", "FFFFFF", "ffffff", "nil"].includes(rawFill)
              ? rawFill.toUpperCase() : null;
            const styled = tableStyleRegionForCell(tableStyle, tblLook, row, rowCount, col, colCount,
              rowBandSize, colBandSize);
            const shdFill = directShd ?? styled.shdFill;
            // الدمجُ العموديّ: وجودُ w:vMerge بلا val يعني «استمرار» (ECMA-376)
            let vMerge: "restart" | "continue" | null = null;
            if (tcPr && first(tcPr, "w:vMerge") !== null) {
              const mv = findAttr(tcPr, "w:vMerge")?.["@w:val"];
              vMerge = mv === "restart" ? "restart" : "continue";
            }
            const vAlign = tcPr ? (findAttr(tcPr, "w:vAlign")?.["@w:val"] ?? null) : null;
            const textDirection = tcPr ? (findAttr(tcPr, "w:textDirection")?.["@w:val"] ?? null) : null;
            // حدودُ الخليّة: المباشرة (w:tcBorders) تتقدم على حدود الجدول
            const tcBordersNode = tcPr ? first(tcPr, "w:tcBorders") : null;
            const tableBordersForCell = tblBorders ? {
              top: row === 0 ? tblBorders.top : (tblBorders.insideH ?? null),
              bottom: row === rowCount - 1 ? tblBorders.bottom : (tblBorders.insideH ?? null),
              left: col === 0 ? tblBorders.left : (tblBorders.insideV ?? null),
              right: col + Math.max(1, span) >= colCount ? tblBorders.right : (tblBorders.insideV ?? null),
            } : null;
            const tcBorders = tcBordersNode ? parseBorders(tcBordersNode) : (tableBordersForCell ?? styled.borders);
            // الهوامش: هوامشُ الخليّة تتقدّم على هوامش الجدول ثمّ على افتراضيّ Word
            const cellMar = (side: string, dflt: number) => {
              const own = tcPr ? first(tcPr, "w:tcMar") : null;
              const fromOwn = own ? findAttr(own, `w:${side}`)?.["@w:w"] : undefined;
              if (fromOwn != null) return Number(fromOwn);
              const fromTbl = tblCellMar ? findAttr(tblCellMar, `w:${side}`)?.["@w:w"] : undefined;
              return fromTbl != null ? Number(fromTbl) : dflt;
            };
            const cc: TableCellCtx = { tableId,
              ...(ctx ? { parentTableId: ctx.tableId, parentRow: ctx.row, parentCol: ctx.col,
                parentBlockIndex: cellBlock.value } : {}),
              nestingDepth: depth,
              row, col, colXTwips: colX[col] ?? 0, colWTwips, gridSpan: Math.max(1, span),
              firstInCell: false, firstInRow: ci === 0, lastInRow: ci === cells.length - 1,
              shdFill, tblStyleId, totalGridTwips: acc, tblWVal, tblWType, tblLayout, cantSplit, repeatHeader,
              conditionalStyle: { sz: styled.sz, family: styled.family, jc: styled.jc,
                bidi: styled.bidi, look: { ...styled.look }, spacing: { ...styled.spacing } },
              bidiVisual, tblIndTwips, tblJc: rowTblJc,
              vMerge, vAlign, textDirection, rowHeight, rowHeightRule,
              marTop: cellMar("top", 0), marBottom: cellMar("bottom", 0),
              marLeft: cellMar("left", 108), marRight: cellMar("right", 108),
              tcBorders };
            const cellParas = flattenBlocks(tc, cc, depth + 1);
            if (cellParas[0]?.cell) cellParas[0].cell = { ...cellParas[0].cell, firstInCell: true };
            out.push(...cellParas);
            col += span;
          });
          row++;
        }
        if (ctx) cellBlock.value++;
      }
    }
    return out;
  };
  for (const child of flattenBlocks(body)) {
    const tableCell = child.cell;
    const p = child.node["w:p"] as XNode[];
    idx++;

    const pPr = first(p, "w:pPr");
    const styleId = pPr ? (findAttr(pPr, "w:pStyle")?.["@w:val"] ?? null) : null;
    // فقرة بلا pStyle ترث نمط الفقرة الافتراضي (Normal) قبل docDefaults
    const styleProps = resolveViaStyle(styles, styleId ?? styles.defaultParagraphStyleId);
    // ‏w:bidi خاصية فقرة موروثة: المباشر يتقدم، ثم سلسلة النمط، ثم docDefaults.
    // غيابها في الجميع فقط يعني LTR.
    const conditionalStyle = tableCell?.conditionalStyle;
    const bidi = pPrFlag(pPr, "w:bidi") ?? conditionalStyle?.bidi ?? styleProps.bidi ?? false;
    // ‏w:jc: المباشر يتقدم وإلا فمن سلسلة النمط (درس tadris para87)
    const directJc = pPr ? findAttr(pPr, "w:jc")?.["@w:val"] : undefined;
    const jc = directJc ?? conditionalStyle?.jc ?? styleProps.jc;
    // ترقيم الفقرة: تقدمات مستوى الترقيم تتوسط الأسبقية (مباشر > ترقيم > نمط)
    const numPr = pPr ? first(pPr, "w:numPr") : null;
    const numId = numPr ? (findAttr(numPr, "w:numId")?.["@w:val"] ?? null) : null;
    const ilvl = numPr ? (findAttr(numPr, "w:ilvl")?.["@w:val"] ?? "0") : "0";
    const numbered = numId != null && numId !== "0";
    const numProps = numbered ? (numbering.get(`${numId}/${ilvl}`) ?? null) : null;
    // ‏w:ind: المباشر على الفقرة يتقدم؛ وإلا فمن الترقيم؛ وإلا فسلسلة النمط
    const own = indProps(pPr);
    const indLeft = own.indLeft ?? numProps?.indLeft ?? styleProps.indLeft;
    const indRight = own.indRight ?? numProps?.indRight ?? styleProps.indRight;
    const indFirstLine = own.indFirstLine ?? numProps?.indFirstLine ?? styleProps.indFirstLine;
    const pPrRPrNode = pPr ? first(pPr, "w:rPr") : null;
    const pPrRPr = rPrProps(pPrRPrNode, theme);
    // خط علامة الترقيم بشريحة ASCII (أرقام «1.» لاتينية الشريحة!) — من
    // ‏rFonts ascii في rPr علامة الفقرة (حل لغز 586: ‏asc(Simplified)=1.18em)
    const directMarkAsciiFamily = pPr
      ? findAttr(first(pPr, "w:rPr") ?? [], "w:rFonts")?.["@w:ascii"]
      : undefined;
    const markAsciiFamily = directMarkAsciiFamily ?? numProps?.markerFamily ?? null;
    const markSz = pPrRPr.sz ?? conditionalStyle?.sz ?? styleProps.sz ?? null;
    // ملحوظة: طيّ lvl/rPr.sz هنا نتيجة سلبية مقيسة (tadris ‏96.1→93.7) —
    // الحقل مكشوف في NumberingTable لمن يحتاجه، بلا مشاركة في ارتفاع السطر.
    const markEmTwips = markSz != null ? markSz * 10 : null;
    const markLook: RunLook = { ...styleProps.look, ...conditionalStyle?.look, ...rPrLook(pPrRPrNode, theme) };
    const paragraphMark = {
      family: pPrRPr.family ?? conditionalStyle?.family ?? styleProps.family,
      emTwips: markEmTwips, bold: Boolean(markLook.bold), italic: Boolean(markLook.italic),
    };

    let excluded: BodyParagraph["excluded"] = false;
    const runs: EffectiveRun[] = [];
    const anchors: FloatAnchor[] = [];
    // كسرُ الصفحة الصريح (w:br type=page): قبل نصّ الفقرة = هي على صفحةٍ جديدة؛
    // بعد نصّها (أو فقرة فارغة) = التالية على صفحةٍ جديدة. sawText يفرّق الحالتين.
    let sawText = false, leadingPageBreaks = 0, trailingPageBreaks = 0;
    let lastPageBreakKind: "explicit" | "rendered" | null = null;
    let columnBreak = false;
    const columnBreakPositions: number[] = [];
    const tabTextPositions: number[] = []; // مواضع w:tab في نصّ الفقرة (لتقسيم TOC)
    const ptabPositions: BodyParagraph["ptabAt"] = []; // مواضعُ w:ptab المطلقة
    let paraTextLen = 0; // طول نصّ الفقرة المتراكم عبر الرنّات (لموضع w:tab الصحيح)
    let inlineImageHTwips = 0; // أطول صورةٍ سطريّة (تحجز صندوق سطر)
    let hasDrawing = false; // صورة/شكل — يُقصى فقط إن كانت الفقرة صورةً خالصةً بلا نصّ
    const recordLeadingPageBreak = () => {
      leadingPageBreaks++;
      // كل مرساة قُرئت قبل الحد تبقى في الورقة السابقة؛ المراسي اللاحقة
      // تنتمي إلى صفحة النص الجديدة. التكرار يحفظ أكثر من صفحة فارغة.
      for (const anchor of anchors) anchor.pageOffset = (anchor.pageOffset ?? 0) - 1;
    };
    let fldDepth = 0, fldInResult = false, fldResultMarked = false;
    let fldKind: string | null = null, fldInstruction = "";
    // نُسطِّح الرنّات: المستوى الأعلى + رنّات داخل w:hyperlink (فهارس TOC تلفّ رقم
    // الصفحة بـPAGEREF في hyperlink) + رنّات fldSimple. هكذا يكتمل نصّ صفّ الفهرس.
    const runNodes: XNode[] = [];
    const hyperlinkRids: (string | null)[] = []; // rId الرابط لكل runNode
    const simpleFieldKinds: (string | null)[] = [];
    const collectInlineNodes = (
      nodes: XNode[], inheritedHref: string | null = null, inheritedField: string | null = null,
    ): void => {
      for (const rNode of nodes) {
      if ("w:r" in rNode) { runNodes.push(rNode); hyperlinkRids.push(inheritedHref); simpleFieldKinds.push(inheritedField); }
      else if ("m:oMath" in rNode) {
        const math = parseMathNodes(rNode["m:oMath"] as XNode[]);
        runNodes.push({ "w:r": [{ "w:t": [{ "#text": mathPlainText(math) }] }], "__math": math });
        hyperlinkRids.push(inheritedHref); simpleFieldKinds.push(inheritedField);
      } else if ("m:oMathPara" in rNode) {
        for (const equation of rNode["m:oMathPara"] as XNode[]) if ("m:oMath" in equation) {
          const math = parseMathNodes(equation["m:oMath"] as XNode[]);
          runNodes.push({ "w:r": [{ "w:t": [{ "#text": mathPlainText(math) }] }], "__math": math });
          hyperlinkRids.push(inheritedHref); simpleFieldKinds.push(inheritedField);
        }
      }
      else if ("w:hyperlink" in rNode) {
        const hyperlink = rNode["w:hyperlink"] as XNode[];
        const attrs = rNode[":@"] as Record<string, string> | undefined;
        const hid = attrs?.["@r:id"] ?? attrs?.["@w:anchor"] ?? inheritedHref;
        collectInlineNodes(hyperlink, hid, inheritedField);
      } else if ("w:fldSimple" in rNode) {
        const attrs = (rNode[":@"] as Record<string, string> | undefined) ?? {};
        const instruction = attrs["@w:instr"] ?? "";
        const kind = pageFieldKind(instruction) ?? styleRefField(instruction, styles);
        collectInlineNodes(rNode["w:fldSimple"] as XNode[], inheritedHref, kind);
        excluded = excluded || "field";
      } else if ("w:smartTag" in rNode) {
        // Legacy semantic annotations wrap ordinary visible runs, including
        // nested smart tags. Their properties are metadata, not displayed text.
        collectInlineNodes(rNode["w:smartTag"] as XNode[], inheritedHref, inheritedField);
      } else if ("w:sdt" in rNode) {
        // Inline content controls are transparent too (date/property controls,
        // author metadata, and fields embedded in a paragraph).
        const content = first(rNode["w:sdt"] as XNode[], "w:sdtContent");
        if (content) collectInlineNodes(content, inheritedHref, inheritedField);
      }
      }
    }
    collectInlineNodes(p);
    for (let ri = 0; ri < runNodes.length; ri++) {
      const rNode = runNodes[ri]!;
      const math = (rNode["__math"] as MathNode | undefined) ?? null;
      const currentHref = hyperlinkRids[ri]
        ? (rels?.get(hyperlinkRids[ri]!) ?? hyperlinkRids[ri]) : null;
      const r = rNode["w:r"] as XNode[];
      const rpr = first(r, "w:rPr");
      const own = rPrProps(rpr, theme);
      const runStyleId = rpr ? (findAttr(rpr, "w:rStyle")?.["@w:val"] ?? null) : null;
      const runStyle = resolveViaStyle(styles, runStyleId);
      const hidden = rpr ? rpr.some((n) => "w:vanish" in n) : false;
      let text = "";
      const sourceSymbols: { at: number; raw: string }[] = [];
      let symFont: string | null = null; // خطُّ رمزٍ w:sym (يتقدّم على خطّ الرن)
      let noteRef: EffectiveRun["noteRef"] = null;
      let noteBodyRef: EffectiveRun["noteBodyRef"] = null;
      let customMarkStart: number | null = null;
      for (const t of r) {
        if ("w:t" in t) {
          const parts = t["w:t"] as XNode[];
          for (const seg of parts) if ("#text" in seg) text += String(seg["#text"]);
          if (text.trim() && !hidden) { sawText = true; lastPageBreakKind = null; }
        }
        // ‏w:br: كسرُ صفحةٍ (type=page) ليس فاصل سطر — يُرصَد ولا يدخل النصّ؛
        // غيره (الافتراضي/textWrapping/column) فاصل سطرٍ يدويّ يُمثَّل بـ\n.
        if ("w:br" in t) {
          const brType = (t[":@"] as Record<string, string> | undefined)?.["@w:type"];
          if (brType === "page") {
            if (sawText) trailingPageBreaks++; else recordLeadingPageBreak();
            lastPageBreakKind = "explicit";
          }
          else if (brType === "column") {
            columnBreak = true;
            columnBreakPositions.push(paraTextLen + text.length);
            text += "\n";
          }
          else text += "\n";
        }
        // ‏w:lastRenderedPageBreak: علامةُ كسرِ الصفحة التي رصّفها Word فعلًا
        // (تظهر داخل w:r كمكوّنٍ واحدٍ بلا نصّ). هي المرجعُ لتقسيم كتب «الشاملة»
        // غير المعالَجة بعلامات {{PG:N}} — تُعامَل ككسرِ صفحةٍ قبل/بعد نصّ الرنّ.
        if ("w:lastRenderedPageBreak" in t) {
          // Word often serializes the rendered marker beside the explicit
          // break, separated only by hidden {{PG:n}} metadata. They describe
          // one boundary; consecutive markers of the same kind remain distinct.
          if (lastPageBreakKind !== "explicit") {
            if (sawText) trailingPageBreaks++; else recordLeadingPageBreak();
          }
          lastPageBreakKind = "rendered";
        }
        // ‏w:sym: حرفٌ بخطٍّ رمزيّ (ﷺ/زخارف AGA) — يُحلّ لمحرفٍ فعليّ (إزاحة PUA)
        // ويُضاف للنصّ بخطّه الرمزيّ (لا يُقصى بعد اليوم؛ حصاد «الشاملة الذهبية»).
        // الخطّ الرمزيّ متوفّرٌ في subset-metrics فيُشكَّل بعرضه الصحيح.
        // ‏w:noBreakHyphen: شرطةٌ لا يُكسَر عندها السطر ⟵ شرطةٌ غيرُ فاصلة (U+2011)
        if ("w:noBreakHyphen" in t) { text += "\u2011"; if (!hidden) { sawText = true; lastPageBreakKind = null; } }
        // Preserve the discretionary break and its one-character COM story slot.
        if ("w:softHyphen" in t) {
          sourceSymbols.push({ at: text.length, raw: "\u001f" });
          text += "\u00ad";
        }
        if ("w:sym" in t) {
          const a = (t[":@"] as Record<string, string> | undefined) ?? {};
          const ch = resolveSymChar(a["@w:font"], a["@w:char"]);
          if (ch) {
            const raw = sourceSymChar(a["@w:font"], a["@w:char"]);
            if (raw) sourceSymbols.push({ at: text.length, raw });
            text += ch; symFont = a["@w:font"] ?? null;
            if (!hidden) { sawText = true; lastPageBreakKind = null; }
          }
        }
        // مرجعُ حاشية/تعليقٍ ختاميّ: Word يرسم **رقمًا تسلسليًّا** بترتيب الظهور (لا w:id).
        // نحقنه نصًّا فيلتحم بقوسَي «(» و«)» المجاورتين طبيعيًّا فيصير «(N)» كما يعرضه Word.
        if ("w:footnoteReference" in t || "w:endnoteReference" in t) {
          const a = (t[":@"] as Record<string, string> | undefined) ?? {};
          const isEnd = "w:endnoteReference" in t;
          const refId = a["@w:id"] ?? null;
          const custom = ["1", "true"].includes(a["@w:customMarkFollows"] ?? "");
          const seq = isEnd ? endnoteSeq : footnoteSeq;
          const num = custom ? seq.n : ++seq.n;
          noteRef = { id: refId, num, kind: isEnd ? "endnote" : "footnote", custom };
          if (custom) customMarkStart = text.length;
          else { text += String(num); if (!hidden) { sawText = true; lastPageBreakKind = null; } }
        }
        if ("w:footnoteRef" in t) noteBodyRef = "footnote";
        if ("w:endnoteRef" in t) noteBodyRef = "endnote";
        // ‏w:tab: نسجّل موضعه في النصّ (لتقسيم صفّ TOC لاحقًا). الإقصاء يُحسَم بعد
        // الحلقة: صفوف الفهرس تُرصَّف، وبقيّة w:tab تُقصى (excluded=tab) مؤقّتًا.
        // الجدولةُ تفصل الكلمات: نُدخلها محرفَ جدولةٍ فعليًّا في نصّ الرنّ كي يبقى
        // نصُّ الفقرة ومقاطعُها متوافقَين، ولئلّا تلتحم الكلمتان حولها
        // (كانت «بابٌ الأولى» + «ألف» تصير كلمةً واحدة).
        if ("w:tab" in t) { tabTextPositions.push(paraTextLen + text.length); text += "\t"; }
        // ‏w:ptab: تقفز إلى موضعٍ مطلقٍ من المرجع لا إلى التوقّف التالي
        if ("w:ptab" in t) {
          const a = (t[":@"] as Record<string, string> | undefined) ?? {};
          ptabPositions.push({ at: paraTextLen + text.length,
            relativeTo: a["@w:relativeTo"] ?? "margin",
            alignment: a["@w:alignment"] ?? "left",
            leader: (a["@w:leader"] && a["@w:leader"] !== "none") ? a["@w:leader"] : null });
          text += "\t";
        }
        // الرسمُ قد يسكن داخل mc:AlternateContent أو w:object فالفحصُ السطحيّ
        // يُخطئه (‏ImageParser.dart:1664-1669).
        if ("w:drawing" in t || "w:pict" in t || "mc:AlternateContent" in t
            || "w:object" in t) hasDrawing = true;
        // صورةٌ سطريّة (wp:inline): تحجز صندوقَ سطرٍ بارتفاعها — نلتقط أطولها.
        for (const root of drawingRoots(t)) {
          for (const { node: inl } of collectDeep(root, "wp:inline")) {
            const ext = collectDeep(inl, "wp:extent")[0]?.attrs;
            const cy = ext?.["@cy"];
            if (cy != null) inlineImageHTwips = Math.max(inlineImageHTwips, Math.round(Number(cy) / 635));
            // رسمُ SmartArt **سطريّ** (masjid يضع رسومه هكذا لا مرساةً): نُنشئ له
            // مرساةً صوريّةً في تدفّق الفقرة ليُرصَف كبقيّة الرسوم.
            const dm = collectDeep(inl, "dgm:relIds")[0]?.attrs?.["@r:dm"];
            const chartRel = collectDeep(inl, "c:chart")[0]?.attrs?.["@r:id"];
            if (chartRel) {
              const rels = partRelsRef.get(partNameRef ?? "document.xml")
                ?? partRelsRef.get("document.xml");
              const target = rels?.get(chartRel);
              const chartXml = target ? chartsRef.get(target) : undefined;
              anchors.push({
                extentW: ext?.["@cx"] ? Math.round(Number(ext["@cx"]) / 635) : 1500,
                extentH: cy != null ? Math.round(Number(cy) / 635) : 1500,
                posHRel: "column", posHOffset: 0, posVRel: "paragraph", posVOffset: 0,
                posHAlign: null, posVAlign: null, behindDoc: false, zOrder: 0,
                distL: 0, distR: 0, distT: 0, distB: 0, wrap: "TopAndBottom",
                rId: null, inlineFlow: true,
                chart: chartXml ? parseChart(chartXml, theme) : {
                  kind: "unsupported", unsupportedType: "missing-part", direction: "column",
                  grouping: "", title: null, legend: { visible: false, position: "r" },
                  showValues: false, categoryAxis: false, valueAxis: false,
                  categories: [], series: [],
                },
              });
              continue;
            }
            if (!dm) {
              // شكل WordprocessingShape سطري (لا a:blip): كان يحجز ارتفاعه عبر
              // wp:extent ثم يختفي لأن مسار الصور يشترط rId. نحفظ هندسته ونصه
              // كمرساة تدفق، كما نفعل للشكل العائم، بلا الرجوع إلى VML fallback.
              const inlineWsp = collectDeep(inl, "wps:wsp")[0];
              if (inlineWsp) {
                const spPr = collectDeep(inlineWsp.node, "wps:spPr")[0]?.node ?? [];
                const geom = collectDeep(spPr, "a:prstGeom")[0];
                const solid = collectDeep(spPr, "a:solidFill")[0]?.node;
                const ln = collectDeep(spPr, "a:ln")[0];
                const colorOf = (host: XNode[] | undefined): string | null => {
                  if (!host) return null;
                  const rgb = collectDeep(host, "a:srgbClr")[0]?.attrs?.["@val"];
                  if (rgb) return rgb.toUpperCase();
                  const scheme = collectDeep(host, "a:schemeClr")[0]?.attrs?.["@val"];
                  const aliases: Record<string, string> = { bg1: "lt1", tx1: "dk1",
                    bg2: "lt2", tx2: "dk2" };
                  return scheme ? (theme.get(scheme) ?? theme.get(aliases[scheme] ?? "") ?? null) : null;
                };
                const style = collectDeep(inlineWsp.node, "wps:style")[0]?.node;
                const styleLine = style ? collectDeep(style, "a:lnRef")[0]?.node : undefined;
                const noFill = spPr.some(child => "a:noFill" in child);
                const lnNoFill = ln ? ln.node.some(child => "a:noFill" in child) : false;
                const strokeW = ln?.attrs?.["@w"]
                  ? Math.max(10, Math.round(Number(ln.attrs["@w"]) / 635)) : (styleLine ? 15 : 0);
                const tb = parseTextBox(inlineWsp.node, styles, numbering, theme);
                const bp = collectDeep(inlineWsp.node, "wps:bodyPr")[0]?.attrs ?? {};
                const ins = (k: string, dflt: number) =>
                  bp[k] != null ? Math.round(Number(bp[k]) / 635) : dflt;
                anchors.push({
                  extentW: ext?.["@cx"] ? Math.round(Number(ext["@cx"]) / 635) : 1500,
                  extentH: cy != null ? Math.round(Number(cy) / 635) : 1500,
                  posHRel: "column", posHOffset: 0, posVRel: "paragraph", posVOffset: 0,
                  posHAlign: null, posVAlign: null, behindDoc: false, zOrder: 0,
                  distL: 0, distR: 0, distT: 0, distB: 0, wrap: "", rId: null,
                  inlineFlow: true,
                  shape: { prst: geom?.attrs?.["@prst"] ?? "rect",
                    fill: noFill ? null : colorOf(solid),
                    stroke: lnNoFill ? null : (colorOf(ln?.node) ?? colorOf(styleLine)
                      ?? (strokeW ? "000000" : null)), strokeW, adj: null },
                  ...(tb ? { textBox: tb, boxAnchor: bp["@anchor"] ?? "t",
                    boxIns: { t: ins("@tIns", 72), b: ins("@bIns", 72),
                      l: ins("@lIns", 144), r: ins("@rIns", 144) } } : {}),
                });
                continue;
              }
              // **صورةٌ سطريّةٌ عاديّة**: كنّا نحجز ارتفاعَها ولا نرسمها البتّة.
              // تُرصَف في تدفّق الفقرة بمقاسها (‏ImageToWidget.dart:421-425).
              const bl = collectDeep(inl, "a:blip")[0]?.attrs;
              const svg = collectDeep(inl, "asvg:svgBlip")[0]?.attrs;
              const docPr = collectDeep(inl, "wp:docPr")[0]?.attrs;
              const pictureGeom = collectDeep(inl, "pic:spPr")[0]
                ? collectDeep(collectDeep(inl, "pic:spPr")[0]!.node, "a:prstGeom")[0]
                : undefined;
              const rid = svg?.["@r:embed"] ?? svg?.["@r:link"]
                ?? bl?.["@r:embed"] ?? bl?.["@r:link"];
              if (rid) {
                const isr = collectDeep(inl, "a:srcRect")[0]?.attrs;
                const ixf = collectDeep(inl, "a:xfrm")[0]?.attrs;
                const iEffects = imageEffectsOf(inl, theme);
                const tru = (v: string | undefined) => v === "1" || v === "true";
                anchors.push({
                  extentW: ext?.["@cx"] ? Math.round(Number(ext["@cx"]) / 635) : 1500,
                  extentH: cy != null ? Math.round(Number(cy) / 635) : 1500,
                  posHRel: "column", posHOffset: 0, posVRel: "paragraph", posVOffset: 0,
                  posHAlign: null, posVAlign: null, behindDoc: false, zOrder: 0,
                  distL: 0, distR: 0, distT: 0, distB: 0,
                  wrap: "", rId: rid, inlineFlow: true,
                  ...(iEffects ? { imageEffects: iEffects } : {}),
                  ...(collectDeep(inl, "a:stretch").length ? { stretch: true } : {}),
                  ...(ixf?.["@rot"] ? { rotDeg: Number(ixf["@rot"]) / 60000 } : {}),
                  ...(tru(ixf?.["@flipH"]) ? { flipH: true } : {}),
                  ...(tru(ixf?.["@flipV"]) ? { flipV: true } : {}),
                  ...(isr && (isr["@l"] || isr["@t"] || isr["@r"] || isr["@b"])
                    ? { srcRect: { l: Number(isr["@l"] ?? 0) / 100000,
                        t: Number(isr["@t"] ?? 0) / 100000, r: Number(isr["@r"] ?? 0) / 100000,
                        b: Number(isr["@b"] ?? 0) / 100000 } } : {}),
                  ...(docPr?.["@descr"] ? { alt: docPr["@descr"] } : {}),
                  ...(docPr?.["@title"] || docPr?.["@name"]
                    ? { title: docPr["@title"] ?? docPr["@name"] } : {}),
                  ...(pictureGeom ? { shape: { prst: pictureGeom.attrs["@prst"] ?? "rect",
                    fill: null, stroke: null, strokeW: 0, adj: null } } : {}),
                });
              }
              continue;
            }
            const rels = partRelsRef.get(partNameRef ?? "document.xml")
              ?? partRelsRef.get("document.xml");
            const target = rels?.get(dm);
            if (!target) continue;
            const drawXml = diagramsRef.get(target.replace(/data(\d+)\.xml$/, "drawing$1.xml"));
            if (!drawXml) continue;
            const shapes = parseDiagramDrawing(drawXml, theme, 1);
            if (!shapes.length) continue;
            anchors.push({
              extentW: ext?.["@cx"] ? Math.round(Number(ext["@cx"]) / 635) : 0,
              extentH: cy != null ? Math.round(Number(cy) / 635) : 0,
              posHRel: "column", posHOffset: 0, posVRel: "paragraph", posVOffset: 0,
              posHAlign: null, posVAlign: null, behindDoc: false, zOrder: 0,
              distL: 0, distR: 0, distT: 0, distB: 0,
              wrap: "TopAndBottom", rId: null, diagram: shapes, inlineFlow: true,
            });
          }
        }
        // مسارُ VML (‏w:pict): هندستُه من سمة style لا من wp:extent/wp:posOffset
        if ("w:pict" in t) {
          for (const va of parseVmlShapes(t["w:pict"] as XNode[], styles, numbering, theme)) {
            anchors.push(va);
          }
        }
        // العائمات: هندسة wp:anchor (الامتداد والموضع والالتفاف) بالـ twips
        for (const root of drawingRoots(t)) {
          const EMU = 635;
          for (const { node: anc, attrs: a } of collectDeep(root, "wp:anchor")) {
            // يُختار أوّلُ wp:extent يحمل cx **وَ**cy معًا؛ وعند الغياب ١٠٠px
            // (١٥٠٠tw) لا صفرًا — الصفرُ ينهار بالشكل. ‏ImageParser.dart:1220-1238
            const ext = collectDeep(anc, "wp:extent")
              .map((e) => e.attrs).find((at) => at?.["@cx"] != null && at?.["@cy"] != null);
            const posH = collectDeep(anc, "wp:positionH")[0];
            const posV = collectDeep(anc, "wp:positionV")[0];
            // ‏wp:align نصٌّ داخل positionH/V — بديلٌ عن posOffset لا مكمّلٌ له
            const alignOf = (w: { node: XNode[] } | undefined) => {
              if (!w) return null;
              const al = collectDeep(w.node, "wp:align")[0];
              const txt = al?.node.find((n) => "#text" in n)?.["#text"];
              return txt != null ? String(txt).trim() : null;
            };
            const off = (w: { node: XNode[] } | undefined) => {
              if (!w) return 0;
              const o = collectDeep(w.node, "wp:posOffset")[0];
              const txt = o?.node.find((n) => "#text" in n)?.["#text"];
              return txt != null ? Math.round(Number(txt) / EMU) : 0;
            };
            const wrap = ["wp:wrapSquare", "wp:wrapTight", "wp:wrapThrough",
              "wp:wrapTopAndBottom", "wp:wrapNone"]
              .find((n) => collectDeep(anc, n).length > 0) ?? "";
            const wrapNode = wrap ? collectDeep(anc, wrap)[0] : undefined;
            const wrapText = wrapNode?.attrs?.["@wrapText"];
            const docPr = collectDeep(anc, "wp:docPr")[0]?.attrs;
            const aEffects = imageEffectsOf(anc, theme);
            const ownsTextBox = collectDeep(anc, "wps:txbx").length > 0
              || collectDeep(anc, "v:textbox").length > 0;
            const textOf = (nodes: XNode[]) => nodes.find(n => "#text" in n)?.["#text"];
            const sizeH = collectDeep(anc, "wp14:sizeRelH")[0];
            const sizeV = collectDeep(anc, "wp14:sizeRelV")[0];
            const pctH = sizeH ? textOf(collectDeep(sizeH.node, "wp14:pctWidth")[0]?.node ?? []) : null;
            const pctV = sizeV ? textOf(collectDeep(sizeV.node, "wp14:pctHeight")[0]?.node ?? []) : null;
            const polygonHost = collectDeep(anc, "wp:wrapPolygon")[0];
            const polygon = polygonHost
              ? [collectDeep(polygonHost.node, "wp:start")[0], ...collectDeep(polygonHost.node, "wp:lineTo")]
                .filter(Boolean).map(point => ({ x: Number(point!.attrs["@x"] ?? 0), y: Number(point!.attrs["@y"] ?? 0) }))
              : [];
            anchors.push({
              extentW: ext ? Math.round(Number(ext["@cx"]) / EMU) : 1500,
              extentH: ext ? Math.round(Number(ext["@cy"]) / EMU) : 1500,
              posHRel: posH?.attrs["@relativeFrom"] ?? "column",
              posHOffset: off(posH),
              posVRel: posV?.attrs["@relativeFrom"] ?? "paragraph",
              posVOffset: off(posV),
              posHAlign: alignOf(posH),
              posVAlign: alignOf(posV),
              behindDoc: a["@behindDoc"] === "1",
              zOrder: Number(a["@relativeHeight"] ?? 0),
              distL: Math.round(Number(a["@distL"] ?? 0) / EMU),
              distR: Math.round(Number(a["@distR"] ?? 0) / EMU),
              distT: Math.round(Number(a["@distT"] ?? 0) / EMU),
              distB: Math.round(Number(a["@distB"] ?? 0) / EMU),
              wrap: wrap.replace("wp:wrap", ""),
              ...(["left", "right", "bothSides", "largest"].includes(wrapText ?? "")
                ? { wrapSide: wrapText as NonNullable<FloatAnchor["wrapSide"]> } : {}),
              rId: ownsTextBox ? null : (collectDeep(anc, "asvg:svgBlip")[0]?.attrs?.["@r:embed"]
                ?? collectDeep(anc, "asvg:svgBlip")[0]?.attrs?.["@r:link"]
                ?? collectDeep(anc, "a:blip")[0]?.attrs?.["@r:embed"]
                ?? collectDeep(anc, "a:blip")[0]?.attrs?.["@r:link"] ?? null),
              ...(aEffects ? { imageEffects: aEffects } : {}),
              ...(relativeSize(sizeH?.attrs["@relativeFrom"], pctH) != null
                ? { relWidth: relativeSize(sizeH?.attrs["@relativeFrom"], pctH)! } : {}),
              ...(relativeSize(sizeV?.attrs["@relativeFrom"], pctV) != null
                ? { relHeight: relativeSize(sizeV?.attrs["@relativeFrom"], pctV)! } : {}),
              allowOverlap: !["0", "false"].includes(a["@allowOverlap"] ?? "1"),
              layoutInCell: !["0", "false"].includes(a["@layoutInCell"] ?? "1"),
              ...(polygon.length >= 3 ? { wrapPolygon: polygon } : {}),
              ...(docPr?.["@descr"] ? { alt: docPr["@descr"] } : {}),
              ...(docPr?.["@title"] || docPr?.["@name"]
                ? { title: docPr["@title"] ?? docPr["@name"] } : {}),
              ...(() => {
                const chartRel = collectDeep(anc, "c:chart")[0]?.attrs?.["@r:id"];
                if (!chartRel) return {};
                const rels = partRelsRef.get(partNameRef ?? "document.xml")
                  ?? partRelsRef.get("document.xml");
                const target = rels?.get(chartRel);
                const xml = target ? chartsRef.get(target) : undefined;
                return xml ? { chart: parseChart(xml, theme) } : {};
              })(),
              ...(() => {
                // ‏SmartArt: dgm:relIds@r:dm ⟵ diagrams/dataN.xml، والمرسومُ
                // diagrams/drawingN.xml (اصطلاحُ التسمية نفسُه). الجزءُ المرسوم
                // يحمل الأشكالَ بمواضعها ونصوصِها جاهزةً.
                const dm = collectDeep(anc, "dgm:relIds")[0]?.attrs?.["@r:dm"];
                if (!dm) return {};
                const rels = partRelsRef.get(partNameRef ?? "document.xml")
                  ?? partRelsRef.get("document.xml");
                const dataTarget = rels?.get(dm);
                if (!dataTarget) return {};
                const drawName = dataTarget.replace(/data(\d+)\.xml$/, "drawing$1.xml");
                const drawXml = diagramsRef.get(drawName);
                if (!drawXml) return {};
                const shapes = parseDiagramDrawing(drawXml, theme, 1);
                return shapes.length ? { diagram: shapes } : {};
              })(),
              ...(() => {
                // مجموعةُ أشكال: كلُّ ابنٍ يُحوَّل من فضاء إحداثيّات المجموعة إلى
                // فضاء الصفحة. القاعدة (‏DrawingML): الابنُ عند chOff يقع عند off،
                // والمقياسُ ext/chExt. بلا هذا التحويل تتكدّس الأبناءُ في الركن.
                const grp = collectDeep(anc, "a:grpSp")[0]?.node
                  ?? collectDeep(anc, "wpg:wgp")[0]?.node;
                if (!grp) return {};
                const gx = collectDeep(grp, "a:xfrm")[0]?.node ?? [];
                const num = (n: XNode[] | undefined, tag: string, at: string) =>
                  Number(collectDeep(n ?? [], tag)[0]?.attrs?.[at] ?? 0);
                const chOffX = num(gx, "a:chOff", "@x"), chOffY = num(gx, "a:chOff", "@y");
                const chExtX = num(gx, "a:chExt", "@cx") || 1, chExtY = num(gx, "a:chExt", "@cy") || 1;
                const extX = num(gx, "a:ext", "@cx"), extY = num(gx, "a:ext", "@cy");
                const sx = extX ? extX / chExtX : 1, sy = extY ? extY / chExtY : 1;
                const kids: NonNullable<FloatAnchor["groupChildren"]> = [];
                for (const sp of [...collectDeep(grp, "pic:pic"), ...collectDeep(grp, "wps:wsp")]) {
                  const kx = collectDeep(sp.node, "a:xfrm")[0]?.node ?? [];
                  const spPr = collectDeep(sp.node, "wps:spPr")[0]?.node
                    ?? collectDeep(sp.node, "pic:spPr")[0]?.node ?? sp.node;
                  const colorIn = (host: XNode[] | undefined): string | null => {
                    if (!host) return null;
                    const rgb = collectDeep(host, "a:srgbClr")[0]?.attrs?.["@val"];
                    if (rgb) return rgb.toUpperCase();
                    const scheme = collectDeep(host, "a:schemeClr")[0]?.attrs?.["@val"];
                    return scheme ? theme.get(scheme) ?? null : null;
                  };
                  const fillNode = collectDeep(spPr, "a:solidFill")[0]?.node;
                  const line = collectDeep(spPr, "a:ln")[0];
                  const geom = collectDeep(spPr, "a:prstGeom")[0];
                  const text = collectDeep(sp.node, "a:t").map(item =>
                    String(item.node.find(n => "#text" in n)?.["#text"] ?? "")).join("").trim();
                  kids.push({
                    x: Math.round(((num(kx, "a:off", "@x") - chOffX) * sx) / EMU),
                    y: Math.round(((num(kx, "a:off", "@y") - chOffY) * sy) / EMU),
                    w: Math.round((num(kx, "a:ext", "@cx") * sx) / EMU),
                    h: Math.round((num(kx, "a:ext", "@cy") * sy) / EMU),
                    rId: collectDeep(sp.node, "asvg:svgBlip")[0]?.attrs?.["@r:embed"]
                      ?? collectDeep(sp.node, "a:blip")[0]?.attrs?.["@r:embed"] ?? null,
                    ...(geom ? { shape: {
                      prst: geom.attrs["@prst"] ?? "rect",
                      fill: collectDeep(spPr, "a:noFill").length ? null : colorIn(fillNode),
                      stroke: line && !collectDeep(line.node, "a:noFill").length ? colorIn(line.node) : null,
                      strokeW: line ? Math.round(Number(line.attrs["@w"] ?? 0) / EMU) : 0,
                      adj: null,
                    } } : {}),
                    ...(text ? { text } : {}),
                    ...(() => {
                      // الدورانُ والانعكاسُ والقصُّ لكلّ ابنٍ على حدة
                      const xa = (() => { for (const n of sp.node) {
                        const found = collectDeep([n], "a:xfrm")[0];
                        if (found) return found.attrs;
                      } return {} as Record<string, string>; })();
                      const csr = collectDeep(sp.node, "a:srcRect")[0]?.attrs;
                      const tru = (v: string | undefined) => v === "1" || v === "true";
                      const o: Record<string, unknown> = {};
                      if (xa["@rot"]) o["rotDeg"] = Number(xa["@rot"]) / 60000;
                      if (tru(xa["@flipH"])) o["flipH"] = true;
                      if (tru(xa["@flipV"])) o["flipV"] = true;
                      if (csr && (csr["@l"] || csr["@t"] || csr["@r"] || csr["@b"])) {
                        o["srcRect"] = { l: Number(csr["@l"] ?? 0) / 100000,
                          t: Number(csr["@t"] ?? 0) / 100000, r: Number(csr["@r"] ?? 0) / 100000,
                          b: Number(csr["@b"] ?? 0) / 100000 };
                      }
                      return o;
                    })(),
                  });
                }
                return kids.length ? { groupChildren: kids } : {};
              })(),
              ...(() => {
                // شكلٌ متّجه: هندستُه من a:prstGeom (أو VML)، وحشوُه وحدُّه من
                // a:solidFill/a:ln. ‏a:noFill يعني بلا حشوٍ لا أسودَ مفروضًا.
                const geom = collectDeep(anc, "a:prstGeom")[0];
                const vml = collectDeep(anc, "v:shape")[0] ?? collectDeep(anc, "v:rect")[0]
                  ?? collectDeep(anc, "v:line")[0] ?? collectDeep(anc, "v:roundrect")[0]
                  ?? collectDeep(anc, "v:oval")[0];
                if (!geom && !vml) return {};
                const spPr = collectDeep(anc, "wps:spPr")[0]?.node
                  ?? collectDeep(anc, "pic:spPr")[0]?.node ?? anc;
                // لونُ حشوٍ صريح؛ وschemeClr يُحلّ بالسمة
                // ‏a:solidFill/a:noFill يجب أن تكون **أبناءً مباشرين** لـspPr: البحثُ
                // العميق يلتقط حشوَ a:ln (الخطّ) فيجعله حشوَ الشكل — والعكس.
                const directChild = (parent: XNode[], nm: string): XNode[] | undefined => {
                  for (const n of parent) if (nm in n) return n[nm] as XNode[];
                  return undefined;
                };
                const solid = directChild(spPr, "a:solidFill");
                const gradFill = directChild(spPr, "a:gradFill");
                const blipFill = directChild(spPr, "a:blipFill");
                const clrOf = (node: XNode[] | undefined): string | null => {
                  if (!node) return null;
                  const srgb = collectDeep(node, "a:srgbClr")[0]?.attrs?.["@val"];
                  if (srgb) return srgb.toUpperCase();
                  const sch = collectDeep(node, "a:schemeClr")[0]?.attrs?.["@val"];
                  // ‏DrawingML يسمّيها bg1/tx1 وclrScheme يسمّيها lt1/dk1
                  const SCH_ALIAS: Record<string, string> = { bg1: "lt1", tx1: "dk1",
                    bg2: "lt2", tx2: "dk2" };
                  if (sch) return theme.get(sch) ?? theme.get(SCH_ALIAS[sch] ?? "") ?? null;
                  return null;
                };
                const hasNoFill = directChild(spPr, "a:noFill") !== undefined && !solid && !gradFill;
                // بعض مربعات PAGE لا تحمل حشوًا مباشرًا؛ Word يأخذه من
                // wps:style/a:fillRef (مثل idx=3 + dk1 = المربع الأسود).
                // يبقى a:noFill الصريح أعلى أولوية كي يظل عنوان الرأس شفافًا.
                const wspStyle = collectDeep(anc, "wps:style")[0]?.node;
                const styleFillRef = wspStyle ? collectDeep(wspStyle, "a:fillRef")[0] : undefined;
                const styleFill = styleFillRef?.node;
                const styleLine = wspStyle ? collectDeep(wspStyle, "a:lnRef")[0]?.node : undefined;
                const lnRaw = directChild(spPr, "a:ln");
                const lnNode = lnRaw ? { node: lnRaw, attrs: (() => {
                  for (const n of spPr) if ("a:ln" in n) return (n[":@"] as Record<string, string>) ?? {};
                  return {} as Record<string, string>;
                })() } : undefined;
                // خطٌّ بـa:noFill لا لونَ له (لا يُرسَم) — ولا يُخلَط بحشو الشكل
                const lnNoFill = lnRaw ? directChild(lnRaw, "a:noFill") !== undefined : false;
                const strokeW = lnNode?.attrs?.["@w"]
                  ? Math.max(10, Math.round(Number(lnNode.attrs["@w"]) / EMU)) : 0;
                const adjVal = collectDeep(geom?.node ?? [], "a:gd")[0]?.attrs?.["@fmla"];
                const adj = adjVal ? Number(String(adjVal).replace(/[^0-9.-]/g, "")) / 100000 : null;
                const directGradient = hasNoFill ? undefined : drawingGradient(gradFill, theme);
                const fill = hasNoFill ? null
                  : (clrOf(solid) ?? directGradient?.stops[0]?.color ?? clrOf(styleFill));
                const gradient = directGradient ?? (hasNoFill ? undefined
                  : themeGradient(theme, styleFillRef?.attrs?.["@idx"], clrOf(styleFill)));
                const fillBlip = blipFill ? collectDeep(blipFill, "a:blip")[0] : undefined;
                const fillRid = fillBlip?.attrs?.["@r:embed"] ?? fillBlip?.attrs?.["@r:link"];
                const fillCrop = blipFill ? collectDeep(blipFill, "a:srcRect")[0]?.attrs : undefined;
                const shapeFill = fillRid ? {
                  rId: fillRid,
                  mode: (blipFill && collectDeep(blipFill, "a:tile").length ? "tile" : "stretch") as "tile" | "stretch",
                  ...(fillCrop ? { srcRect: { l: Number(fillCrop["@l"] ?? 0) / 100000,
                    t: Number(fillCrop["@t"] ?? 0) / 100000, r: Number(fillCrop["@r"] ?? 0) / 100000,
                    b: Number(fillCrop["@b"] ?? 0) / 100000 } } : {}),
                } : undefined;
                return { shape: {
                  prst: geom?.attrs?.["@prst"] ?? (vml ? "rect" : "rect"),
                  fill,
                  stroke: lnNoFill ? null : (clrOf(lnNode?.node) ?? clrOf(styleLine)
                    ?? (strokeW ? "000000" : null)),
                  strokeW: strokeW || (lnNode ? 12 : styleLine ? 15 : 0), adj,
                  ...(gradient ? { gradient } : {}) }, ...(shapeFill ? { shapeFill } : {}) };
              })(),
              ...(() => {
                // القصُّ والدوران: قيمُ OOXML بأجزاء المئة الألفيّة وأجزاء الستّين ألفًا
                const sr = collectDeep(anc, "a:srcRect")[0]?.attrs;
                const xf = collectDeep(anc, "a:xfrm")[0]?.attrs;
                const o: Record<string, unknown> = {};
                if (sr && (sr["@l"] || sr["@t"] || sr["@r"] || sr["@b"])) {
                  o["srcRect"] = { l: Number(sr["@l"] ?? 0) / 100000, t: Number(sr["@t"] ?? 0) / 100000,
                    r: Number(sr["@r"] ?? 0) / 100000, b: Number(sr["@b"] ?? 0) / 100000 };
                }
                // الدورانُ لا يسكن a:xfrm وحدها: أوّلُ سليلٍ يحمل @rot يحسم
                // (‏ImageParser.dart:1080-1108)، و@flipH/@flipV تقبل "1" و"true".
                const rotHost = xf?.["@rot"] ? xf
                  : collectDeep(anc, "a:off").length ? undefined : undefined;
                void rotHost;
                if (xf?.["@rot"]) o["rotDeg"] = Number(xf["@rot"]) / 60000;
                const truthy = (v: string | undefined) => v === "1" || v === "true";
                if (truthy(xf?.["@flipH"])) o["flipH"] = true;
                if (truthy(xf?.["@flipV"])) o["flipV"] = true;
                // ‏a:stretch يمدّ الصورة؛ وغيابُه يعني الاحتواءَ بالنسبة
                if (collectDeep(anc, "a:stretch").length) o["stretch"] = true;
                return o;
              })(),
              ...(() => {
                const tb = parseTextBox(anc, styles, numbering, theme);
                if (!tb) return {};
                // ‏bodyPr: الرسوّ العموديّ والحشوات. الافتراضيّات في ECMA-376:
                // ‏lIns/rIns=91440EMU=144tw، tIns/bIns=45720EMU=72tw، anchor=t.
                const bodyPr = collectDeep(anc, "wps:bodyPr")[0];
                const bp = bodyPr?.attrs ?? {};
                const ins = (k: string, dflt: number) =>
                  bp[k] != null ? Math.round(Number(bp[k]) / EMU) : dflt;
                return { textBox: tb, boxAnchor: bp["@anchor"] ?? "t",
                  ...(bodyPr && collectDeep(bodyPr.node, "a:noAutofit").length
                    ? { boxNoAutofit: true } : {}),
                  boxIns: { t: ins("@tIns", 72), b: ins("@bIns", 72),
                    l: ins("@lIns", 144), r: ins("@rIns", 144) } };
              })(),
            });
          }
        }
        // آلةُ حالة الحقول (حصاد «الشاملة الذهبية»): begin → instrText → separate → **النتيجة** → end.
        // نعلّم رنَّ النتيجة بنوع حقله ليستبدله المُركِّب (رقمُ الصفحة مثلًا).
        if ("w:fldChar" in t) {
          const ft = (t[":@"] as Record<string, string> | undefined)?.["@w:fldCharType"];
          if (ft === "begin") { fldDepth++; fldKind = null; fldInstruction = ""; fldInResult = false; fldResultMarked = false; }
          else if (ft === "separate") {
            fldKind = pageFieldKind(fldInstruction) ?? styleRefField(fldInstruction, styles);
            fldInResult = true; fldResultMarked = false;
          }
          else if (ft === "end") { fldDepth = Math.max(0, fldDepth - 1); fldInResult = false;
            if (!fldDepth) { fldKind = null; fldInstruction = ""; } }
          excluded = excluded || "field";
        }
        if ("w:instrText" in t) {
          const parts = t["w:instrText"] as XNode[];
          let instr = "";
          for (const seg of parts) if ("#text" in seg) instr += String(seg["#text"]);
          fldInstruction += instr;
          excluded = excluded || "field";
        }
      }
      if (noteRef?.custom && customMarkStart != null) {
        noteRef.customMark = text.slice(customMarkStart);
        if (noteRef.customMark && !hidden) { sawText = true; lastPageBreakKind = null; }
      }
      if (!hidden) paraTextLen += text.length; // يوافق نصّ الفقرة (المرئيّ) لموضع w:tab
      // علامة رقم الحاشية داخل قصتها رنّ دلالي بلا w:t؛ إبقاؤه ضروري كي
      // يضع العارض الرقم في موضعه المؤلف (مثل القوسين) بدل عمود منفصل.
      if (!text && !noteBodyRef) continue;
      const vAlign = rpr ? (findAttr(rpr, "w:vertAlign")?.["@w:val"] ?? null) : null;
      const toggleOn = (nm: string): boolean | null => {
        if (!rpr || first(rpr, nm) === null) return null;
        const v = findAttr(rpr, nm)?.["@w:val"];
        return !["0", "false", "off"].includes(v ?? "");
      };
      const rtl = toggleOn("w:rtl");
      const ltr = toggleOn("w:ltr");
      const direction: EffectiveRun["direction"] = rtl !== null
        ? (rtl ? "rtl" : "ltr")
        : ltr !== null ? (ltr ? "ltr" : "rtl") : null;
      // المظهر: المباشرُ يتقدّم، ثمّ rPr الفقرة، ثمّ سلسلةُ النمط
      const look: RunLook = { ...styleProps.look, ...conditionalStyle?.look, ...runStyle.look,
        ...rPrLook(pPrRPrNode, theme), ...rPrLook(rpr, theme) };
      const effectiveEmTwips = (own.sz ?? pPrRPr.sz ?? runStyle.sz ?? conditionalStyle?.sz ?? styleProps.sz) != null
        ? (own.sz ?? pPrRPr.sz ?? runStyle.sz ?? conditionalStyle?.sz ?? styleProps.sz)! * 10
        : null;
      const { legacyShadow, superscript: styledSuperscript, subscript: styledSubscript, ...resolvedLook } = look;
      if (legacyShadow && resolvedLook.textShadow == null && effectiveEmTwips != null) {
        const offset = effectiveEmTwips / 24;
        resolvedLook.textShadow = { xTwips: offset, yTwips: offset,
          blurTwips: 0, color: "C0C0C0", opacity: 1 };
      }
      const directBold = toggleOn("w:b") ?? toggleOn("w:bCs");
      const dynamicField = simpleFieldKinds[ri]
        ?? (fldInResult && fldKind ? (fldResultMarked ? "" : fldKind) : null);
      if (dynamicField) fldResultMarked = true;
      let sourceText = text;
      for (const symbol of [...sourceSymbols].reverse())
        sourceText = sourceText.slice(0, symbol.at) + symbol.raw + sourceText.slice(symbol.at + 1);
      runs.push({
        text,
        ...(sourceText !== text ? { sourceText } : {}),
        ...(math ? { math } : {}),
        direction,
        ...resolvedLook,
        fieldResult: dynamicField,
        noteRef,
        noteBodyRef,
        href: currentHref ?? null,
        superscript: vAlign ? vAlign === "superscript" : (styledSuperscript ?? false),
        subscript: vAlign ? vAlign === "subscript" : (styledSubscript ?? false),
        bold: directBold ?? resolvedLook.bold ?? false,
        family: symFont ?? own.family ?? pPrRPr.family ?? runStyle.family ?? conditionalStyle?.family ?? styleProps.family,
        emTwips: effectiveEmTwips,
        hidden,
      });
    }
    // paragraph.text هو نص المصدر الذي تعيده Word automation ويُستخدم لربط
    // خريطة الصفحات؛ run.text يبقى نص العرض الصحيح للخط الرمزي.
    const text = runs.filter((r) => !r.hidden).map((r) => r.sourceText ?? r.text).join("");
    // fldChar/instrText metadata is not display text, but the runs between
    // separate/end are Word's cached visible result. Unknown fields such as
    // GREETINGLINE must keep that result instead of losing the whole paragraph.
    if (excluded === "field" && text.trim()) excluded = false;
    if (!text.trim()) excluded = excluded || "empty";
    // صفّ TOC (حصاد «الشاملة الذهبية»): توقّفٌ يمينيٌّ ذو leader (أو نمط toc) مع w:tab
    // فعليّ في رنّ. التقسيم: **آخر** w:tab يفصل المدخل عن رقم الصفحة (الأسبق داخليّة).
    // ‏w:pBdr — حدودُ الفقرة (سُمكٌ + فراغٌ يزيدان ارتفاعَها)
    const pBdrNode = pPr ? first(pPr, "w:pBdr") : null;
    const pBdr = pBdrNode ? parseBorders(pBdrNode) : null;
    // تظليلُ الفقرة: w:fill مباشرًا أو themeFill محلولًا بالسمة (بأولويّة السمة)
    const pShdAttrs = pPr ? findAttr(pPr, "w:shd") : null;
    let pShd: string | null = null;
    if (pShdAttrs) {
      const tf = pShdAttrs["@w:themeFill"];
      const base = tf ? theme.get(tf) : undefined;
      pShd = base
        ? applyTintShade(base, pShdAttrs["@w:themeFillTint"], pShdAttrs["@w:themeFillShade"])
        : ((pShdAttrs["@w:fill"] && !["auto", "FFFFFF", "ffffff"].includes(pShdAttrs["@w:fill"]))
          ? pShdAttrs["@w:fill"].toUpperCase() : null);
    }
    const tabStops = parseTabStops(pPr);
    const rightLeaderTab = tabStops.find(
      (t) => (t.val === "right" || t.val === "end") && t.leader && t.leader !== "none");
    const isTocStyle = /^toc/i.test(styleId ?? "");
    let toc: TocRow | null = null;
    // صفُّ الفهرس = مدخلٌ + جدولةٌ واحدة + رقمُ صفحة. أكثرُ من جدولةٍ يعني جدولًا
    // نصّيًّا بأعمدةٍ متعدّدة فيمرّ على المسار العامّ (قياسٌ: صفوفُ masjid الـ٦٦
    // كلُّها جدولةٌ واحدة، وgap-tabs أربع).
    if (tabTextPositions.length && (tabTextPositions.length === 1 || isTocStyle)
        && (rightLeaderTab || isTocStyle) && text.trim()) {
      const split = tabTextPositions[tabTextPositions.length - 1]!;
      const entry = text.slice(0, split).trim();
      const pageNum = text.slice(split).trim();
      const rightTab = rightLeaderTab ?? tabStops.find((t) => t.val === "right" || t.val === "end");
      if (entry && pageNum) {
        toc = { entry, pageNum, leader: rightLeaderTab?.leader ?? "dot", rightTabTwips: rightTab?.posTwips ?? 0 };
      }
    }
    // صفّ الفهرس يُرصَّف (يُلغى إقصاء field/hyperlink عنه — نصٌّ خالص)
    if (toc) { if (excluded === "field") excluded = false; }
    // بقيّةُ w:tab (لا فهرس): كانت الفقرةُ **تُقصى بأكملها** فيضيع نصّها (masjid ٣ فقرات،
    // dawra ١). لا نُسقِط نصًّا: تتدفّق الفقرة، ويُصدَّر موضعُ كلّ w:tab في نصّها ليصنع
    // المُركِّبُ قفزةَ الجدولة. الجدولةُ نفسها فاصلٌ كالفراغ في كسر السطر.
    // الصور/الأشكال: تُقصى الفقرةُ فقط إن كانت **صورةً خالصةً بلا نصّ** (طبقةُ overlay).
    // فقرةٌ فيها صورةٌ عائمة (wrapNone) **مع نصّ** يتدفّق نصّها (الصورة طبقةٌ منفصلة)؛ وصورةٌ
    // سطريّة تحجز صندوقَ سطرٍ. حصاد «الشاملة الذهبية» (tadris 8 فقرات نصّ كانت تُسقَط).
    if (hasDrawing && !text.trim() && inlineImageHTwips === 0) excluded = excluded || "drawing";
    // ‏w:pageBreakBefore في pPr — كسرٌ صريحٌ قبل الفقرة (val=0/false/off يُبطله)
    const pbbVal = pPr ? findAttr(pPr, "w:pageBreakBefore")?.["@w:val"] : undefined;
    const pbbEl = pPr ? first(pPr, "w:pageBreakBefore") !== null : false;
    const ppPageBreak = pbbEl && !["0", "false", "off"].includes(pbbVal ?? "");
    // ‏w:widowControl: مُفعَّلٌ افتراضًا (Word)؛ حضورُه بـval=0/false/off يعطّله
    const widowControl = pPrFlag(pPr, "w:widowControl") ?? styleProps.widowControl ?? true;
    const suppressAutoHyphens = pPrFlag(pPr, "w:suppressAutoHyphens")
      ?? styleProps.suppressAutoHyphens ?? false;
    const ownOutline = pPr ? findAttr(pPr, "w:outlineLvl")?.["@w:val"] : undefined;
    const outlineLevel = ownOutline != null ? Number(ownOutline) : styleProps.outlineLevel;
    const keepNext = pPrFlag(pPr, "w:keepNext") ?? styleProps.keepNext ?? false;
    const keepLines = pPrFlag(pPr, "w:keepLines") ?? styleProps.keepLines ?? false;
    const contextualSpacing = pPrFlag(pPr, "w:contextualSpacing")
      ?? styleProps.contextualSpacing ?? false;
    // حسم كسرِ الصفحة: الفقرة المرصَّفة تستهلك المعلَّق (وتبدأ صفحةً)؛ غير المرصَّفة
    // تُمرِّره. كسرٌ لاحقٌ لنصّها (أو فارغة حاملة) يدفع التالية.
    let pageBreaksBefore = 0;
    // الفقرةُ الفارغة **تُرصَّف** (سطرٌ فارغ) فتستهلك كسرَها بنفسها ولا تُمرِّره — وإلّا
    // تنهار الكسراتُ المتتالية في واحدة (masjid: ٨٧ كسرًا كانت تُنتج ٢٦ فقط).
    if (excluded && excluded !== "empty") {
      pendingBreaks += Math.max(ppPageBreak ? 1 : 0, leadingPageBreaks + trailingPageBreaks);
    } else {
      pageBreaksBefore = Math.max(pendingBreaks, ppPageBreak ? 1 : 0, leadingPageBreaks);
      pendingBreaks = trailingPageBreaks;
    }
    // ‏w:spacing: وراثة سمّية — سمات المباشر تتقدم وتُكمَّل من السلسلة
    const ownSp = spacingProps(pPr);
    const chain = conditionalStyle?.spacing?.present
      ? overlaySpacing(overlaySpacing(styles.defaults.spacing, conditionalStyle.spacing),
        resolveViaStyle(styles, styleId ?? styles.defaultParagraphStyleId, false).spacing)
      : styleProps.spacing;
    const beforeAuto = ownSp.beforeAuto ?? chain.beforeAuto;
    const afterAuto = ownSp.afterAuto ?? chain.afterAuto;
    const spacing: SpacingProps = {
      present: ownSp.present || chain.present,
      line: ownSp.line ?? chain.line,
      lineRule: ownSp.line != null ? ownSp.lineRule : chain.lineRule,
      before: beforeAuto ? 100 : (ownSp.before ?? chain.before),
      after: afterAuto ? 100 : (ownSp.after ?? chain.after),
      beforeAuto: beforeAuto ?? null,
      afterAuto: afterAuto ?? null,
      lineDirect: ownSp.line != null,
      lineSource: ownSp.line != null ? "ppr" : (chain.lineSource ?? null),
    };
    const bookmarkIds = collectDeep(p, "w:bookmarkStart")
      .map(x => x.attrs?.["@w:name"]).filter((x): x is string => Boolean(x));
    const frameAttrs = pPr ? findAttr(pPr, "w:framePr") : null;
    const frameNum = (name: string): number | null => frameAttrs?.[name] != null
      ? Number(frameAttrs[name]) : null;
    const framePr = frameAttrs ? {
      signature: JSON.stringify(Object.entries(frameAttrs).sort(([a], [b]) => a.localeCompare(b))),
      w: frameNum("@w:w"), h: frameNum("@w:h"), x: frameNum("@w:x"), y: frameNum("@w:y"),
      hSpace: frameNum("@w:hSpace") ?? 0, vSpace: frameNum("@w:vSpace") ?? 0,
      hAnchor: frameAttrs["@w:hAnchor"] ?? "text", vAnchor: frameAttrs["@w:vAnchor"] ?? "text",
      xAlign: frameAttrs["@w:xAlign"] ?? null, yAlign: frameAttrs["@w:yAlign"] ?? null,
      wrap: frameAttrs["@w:wrap"] ?? "around",
    } : null;
    paragraphs.push({
      index: idx, bookmarkIds, runs, text, styleId, jc, bidi,
      indLeft, indRight, indFirstLine, excluded, sectionIndex: -1, numbered, numId, ilvl, anchors,
      spacing, markEmTwips, markAsciiFamily, paragraphMark, pageBreakBefore: pageBreaksBefore > 0,
      pageBreaksBefore, widowControl, suppressAutoHyphens, outlineLevel, keepNext, keepLines,
      contextualSpacing,
      tabStops, toc, inlineImageHTwips, tableCell,
      tabAt: tabTextPositions, ptabAt: ptabPositions, columnBreak,
      columnBreakAt: columnBreakPositions, pBdr, shd: pShd,
      snapToGrid: pPrFlag(pPr, "w:snapToGrid") ?? styleProps.snapToGrid ?? true,
      framePr,
    });
    // أداة ترقيم المكتبة قد تحفظ صفحتين خاليتين داخل فقرة خفية واحدة
    // (TheLibraryPage_1 + _2). كل اسم إضافي حد صفحة مستقل قبل الفقرة التالية.
    const libraryPageMarkers = bookmarkIds.filter(name => /^TheLibraryPage_\d+$/.test(name)).length;
    if (libraryPageMarkers > 1) pendingBreaks += libraryPageMarkers - 1;
    // ‏sectPr داخل pPr يختم مقطعًا: هندسته تسري على هذه الفقرة وما سبقها
    const pSect = pPr ? first(pPr, "w:sectPr") : null;
    if (pSect) {
      sections.push(geomFrom(pSect));
      for (let k = pendingFrom; k < paragraphs.length; k++)
        paragraphs[k]!.sectionIndex = sections.length - 1;
      pendingFrom = paragraphs.length;
      // نوع بدء المقطع التالي يسكن sectPr **التالي** لا هذا الذي أنهى السابق؛
      // لذلك يؤجل قرار الحد إلى ما بعد جمع sections كلها.
    }
  }
  // ‏sectPr الـbody يختم المقطع الأخير (البقية كلها له)
  sections.push(geomFrom(first(body, "w:sectPr")));
  for (let k = pendingFrom; k < paragraphs.length; k++)
    paragraphs[k]!.sectionIndex = sections.length - 1;
  // غيابُ header/footerReference في مقطع Word يعني «Link to Previous»، لا
  // غيابَ الرأس أو التذييل. نورّث كل نوع على حدة، مع إبقاء المرجع المحلي مقدّمًا.
  for (let i = 1; i < sections.length; i++) {
    const prev = sections[i - 1]!;
    const cur = sections[i]!;
    cur.headerRefs = { ...(prev.headerRefs ?? {}), ...(cur.headerRefs ?? {}) };
    cur.footerRefs = { ...(prev.footerRefs ?? {}), ...(cur.footerRefs ?? {}) };
  }
  // ‏w:type يصف كيف يبدأ المقطع المالك له. أول فقرة ذات sectionIndex=i هي
  // موضع الحد مع السابق؛ continuous يبقى في الورقة نفسها، والبقية حد صفحة.
  for (let i = 1; i < sections.length; i++) {
    if (sections[i]!.sectStart === "continuous") continue;
    const firstParagraph = paragraphs.find(paragraph => paragraph.sectionIndex === i);
    if (!firstParagraph) continue;
    firstParagraph.pageBreaksBefore = (firstParagraph.pageBreaksBefore ?? 0) + 1;
    firstParagraph.pageBreakBefore = true;
  }
  // الفهارس اليدوية قد تكون سلسلة صفوف tab+رقم بلا TOC style ولا leader
  // مباشر (التوقف موروث/افتراضي). لا نرقّي سطرًا منفردًا؛ السلسلة الطويلة
  // وحدها دلالة جدول محتويات يدوي، ونستعير موضع التوقف من أي صف TOC صريح فيها.
  for (let start = 0; start < paragraphs.length;) {
    const candidate = (paragraph: BodyParagraph) => !paragraph.tableCell
      && paragraph.tabAt.length === 1
      && /^.+\t\s*[0-9٠-٩]+\s*$/u.test(paragraph.text.trim());
    if (!candidate(paragraphs[start]!)) { start++; continue; }
    let end = start + 1;
    while (end < paragraphs.length && candidate(paragraphs[end]!)) end++;
    if (end - start >= 3) {
      const explicit = paragraphs.slice(start, end).find(paragraph => paragraph.toc);
      const rightTabTwips = explicit?.toc?.rightTabTwips ?? 0;
      for (let i = start; i < end; i++) if (!paragraphs[i]!.toc) {
        const paragraph = paragraphs[i]!;
        const split = paragraph.text.lastIndexOf("\t");
        paragraph.toc = { entry: paragraph.text.slice(0, split).trim(),
          pageNum: paragraph.text.slice(split + 1).trim(), leader: "dot", rightTabTwips };
      }
    }
    start = end;
  }
  const section = sections[sections.length - 1]!;
  const pageBackground = documentXml.match(/<w:background\b[^>]*\bw:color="([0-9A-Fa-f]{6})"/)?.[1]
    ?.toUpperCase();
  return { section, sections, paragraphs, compatibilityMode: 11, defaultTabStop: 720,
    ...(pageBackground ? { pageBackground } : {}),
    footnotes: new Map(), endnotes: new Map(), numbering,
    headerFooters: new Map(), relTargets: new Map(),
    evenAndOddHeaders: false, partRels: new Map(), mediaFiles: new Map(), embeddedFonts: new Map() };
}

/** يحلّل word/footnotes.xml (أو endnotes) إلى: معرّف الحاشية → فقراتُها.
 *  يُعيد استعمال parseDocument كاملًا (الخطوط/التباعد/الأنماط) بلفّ فقرات كلّ حاشيةٍ في
 *  body مؤقّت — فتُعامَل الحاشيةُ كنصٍّ كامل الحقوق لا كنصٍّ خام. حصاد «الشاملة الذهبية».
 *  الفواصل (separator/continuationSeparator) تُتجاهَل: لا تُربَط بمرجعٍ في المتن. */
export function parseNotes(
  notesXml: string | null, documentXml: string, styles: StyleTable,
  numbering: NumberingTable = new Map(), tag = "w:footnote",
  theme: Map<string, string> = new Map(),
): Map<string, BodyParagraph[]> {
  const out = new Map<string, BodyParagraph[]>();
  if (!notesXml) return out;
  // نلتقط تصريحات النطاقات من جذر المستند ليُحلَّل XML الحاشية بنفس البادئات
  const nsMatch = documentXml.match(/<w:document([^>]*)>/);
  const ns = nsMatch ? nsMatch[1] : ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  // مسحٌ نصّيٌّ بحدود وسمٍ حقيقيّة: «<w:footnote » أو «<w:footnote>» فقط — لا الجذر
  // «<w:footnotes>» ولا «<w:footnoteRef/>» الواقع **داخل** الحاشية (وهو ما يكسر أيّ split).
  const open = "<" + tag, close = "</" + tag + ">";
  let pos = 0;
  for (;;) {
    const i = notesXml.indexOf(open, pos);
    if (i < 0) break;
    const after = notesXml[i + open.length];
    if (after !== " " && after !== ">") { pos = i + open.length; continue; }
    const e = notesXml.indexOf(close, i);
    if (e < 0) break;
    const m = notesXml.slice(i, e + close.length);
    pos = e + close.length;
    const openingTag = m.slice(0, m.indexOf(">") + 1);
    const idM = openingTag.match(/w:id="(-?\d+)"/);
    if (!idM) continue;
    // الفاصلان الخاصان (-1/0 غالبًا) يُحفظان أيضًا؛ العارض يستخدم محتواهما
    // إن كان مخصصًا، وإلا يرسم فاصل Word الافتراضي.
    // نزعُ وسمِ الحاشية بلا regex (أسلمُ من الهروب داخل RegExp)
    const inner = m.slice(m.indexOf(">") + 1, m.lastIndexOf("</"));
    const id = idM[1];
    if (!id) continue;
    try {
      const wrapped = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document${ns}><w:body>${inner}</w:body></w:document>`;
      const notePs = parseDocument(wrapped, styles, numbering, theme).paragraphs;
      // نفسُ قاعدة الترويسة: rId داخل حاشيةٍ يُحلّ من footnotes.xml.rels لا من المستند
      const notePart = tag === "w:endnote" ? "endnotes.xml" : "footnotes.xml";
      for (const q of notePs) for (const a of q.anchors ?? []) a.part = notePart;
      out.set(id, notePs);
      // نوعا الفصل دلالةٌ مستقلة عن المعرّف العددي. تستخدم ملفات Word الشائعة
      // -1/0، لكن العقد يعرّف w:type بوصفه المصدر الحقيقي؛ نوفر المفتاحين
      // القياسيين للعارض حتى مع ملفات منتجة بمعرّفات مختلفة.
      const noteType = openingTag.match(/w:type="(separator|continuationSeparator)"/)?.[1];
      if (noteType === "separator") out.set("-1", notePs);
      else if (noteType === "continuationSeparator") out.set("0", notePs);
    } catch { /* حاشيةٌ لا تُحلَّل: تُتجاهَل بدل إسقاط المستند */ }
  }
  return out;
}

/** يحلّل جزءَ ترويسةٍ/تذييل (جذرُه w:hdr أو w:ftr) إلى فقرات، بإعادة استعمال
 *  parseDocument كاملًا (لفُّ محتواه في body مؤقّت). حصاد «الشاملة الذهبية». */
export function parseHeaderFooterPart(
  partXml: string, documentXml: string, styles: StyleTable, numbering: NumberingTable = new Map(),
  theme: Map<string, string> = new Map(), partName: string | null = null,
): BodyParagraph[] {
  const nsMatch = documentXml.match(/<w:document([^>]*)>/);
  const ns = nsMatch ? nsMatch[1] : ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const openAt = partXml.indexOf("<w:hdr") >= 0 ? partXml.indexOf("<w:hdr") : partXml.indexOf("<w:ftr");
  if (openAt < 0) return [];
  const gt = partXml.indexOf(">", openAt);
  const closeAt = partXml.lastIndexOf("</");
  if (gt < 0 || closeAt < 0) return [];
  const inner = partXml.slice(gt + 1, closeAt);
  try {
    const wrapped = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document${ns}><w:body>${inner}</w:body></w:document>`;
    const ps = parseDocument(wrapped, styles, numbering, theme).paragraphs;
    // ختمُ الجزء المالك على مراسيه: rId يُحلّ من علاقات هذا الجزء لا المستند
    if (partName) for (const q of ps) for (const a of q.anchors ?? []) a.part = partName;
    return ps;
  } catch { return []; }
}

function notePreferences(settingsXml: string | null, kind: "footnote" | "endnote") {
  const defaults = kind === "footnote"
    ? { start: 1, restart: "continuous", fmt: "decimal", position: "pageBottom" }
    : { start: 1, restart: "continuous", fmt: "decimal", position: "docEnd" };
  if (!settingsXml) return defaults;
  const block = settingsXml.match(new RegExp(`<w:${kind}Pr\\b[\\s\\S]*?</w:${kind}Pr>`))?.[0];
  if (!block) return defaults;
  const val = (tag: string) => block.match(new RegExp(`<w:${tag}\\b[^>]*w:val="([^"]+)"`))?.[1];
  return {
    start: Number(val("numStart") ?? defaults.start) || defaults.start,
    restart: val("numRestart") ?? defaults.restart,
    fmt: val("numFmt") ?? defaults.fmt,
    position: val("pos") ?? defaults.position,
  };
}

export function extractFromDocx(bytes: Uint8Array): DocumentModelV0 {
  const { documentXml, stylesXml, settingsXml, numberingXml, footnotesXml, endnotesXml,
    headerFooterParts, documentRels, themeXml, partRels, diagramDrawings, chartParts,
    mediaFiles, embeddedFonts } = openDocx(bytes);
  partRelsRef = partRels; diagramsRef = diagramDrawings; chartsRef = chartParts;
  partNameRef = "document.xml";
  const theme = parseTheme(themeXml);
  const styles = parseStyles(stylesXml, theme);
  const numbering = parseNumbering(numberingXml);
  const model = parseDocument(documentXml, styles, numbering, theme, documentRels);
  // sectPr يحمل r:id، بينما headerFooters مفهرسة باسم الجزء. إبقاء rId كان
  // يجعل scene لا يجد أي رأس/تذييل حقيقي رغم نجاح استخراجه.
  const resolveMarginRef = (rid: string): string => {
    const target = documentRels.get(rid) ?? rid;
    return target.replace(/^\.\.\//, "").replace(/^word\//, "");
  };
  for (const section of model.sections) {
    if (section.headerRefs) section.headerRefs = Object.fromEntries(
      Object.entries(section.headerRefs).map(([kind, rid]) => [kind, resolveMarginRef(rid)]));
    if (section.footerRefs) section.footerRefs = Object.fromEntries(
      Object.entries(section.footerRefs).map(([kind, rid]) => [kind, resolveMarginRef(rid)]));
  }
  model.compatibilityMode = compatibilityMode(settingsXml);
  model.defaultTabStop = defaultTabStop(settingsXml);
  model.numbering = numbering;
  // نصوصُ الحواشي/التعليقات — تُرصَّف أسفل الصفحة التي فيها مرجعُها
  model.footnotes = parseNotes(footnotesXml, documentXml, styles, numbering, "w:footnote", theme);
  model.endnotes = parseNotes(endnotesXml, documentXml, styles, numbering, "w:endnote", theme);
  model.noteSettings = {
    footnote: notePreferences(settingsXml, "footnote"),
    endnote: notePreferences(settingsXml, "endnote"),
  };
  // أرقام المراجع تُحسم بعد معرفة settings.xml: البداية وإعادة البدء لكل صفحة/مقطع.
  const counters = {
    footnote: model.noteSettings.footnote.start - 1,
    endnote: model.noteSettings.endnote.start - 1,
  };
  let previousSection = -1;
  for (let pi = 0; pi < model.paragraphs.length; pi++) {
    const paragraph = model.paragraphs[pi]!;
    const sectionChanged = previousSection >= 0 && paragraph.sectionIndex !== previousSection;
    previousSection = paragraph.sectionIndex;
    for (const kind of ["footnote", "endnote"] as const) {
      const local = model.sections[paragraph.sectionIndex]?.[`${kind}Pr`];
      const pref = { ...model.noteSettings[kind], ...local };
      if ((pref.restart === "eachPage" && paragraph.pageBreakBefore && pi > 0)
          || (sectionChanged && (pref.restart === "eachSect" || local?.start != null)))
        counters[kind] = pref.start - 1;
    }
    for (const run of paragraph.runs) {
      const ref = run.noteRef;
      if (!ref) continue;
      const kind = ref.kind === "endnote" ? "endnote" : "footnote";
      const local = model.sections[paragraph.sectionIndex]?.[`${kind}Pr`];
      const pref = { ...model.noteSettings[kind], ...local };
      if (!ref.custom) ref.num = ++counters[kind];
      ref.fmt = pref.fmt;
    }
  }
  // الترويسات/التذييلات: كلُّ جزءٍ يُحلَّل فقراتٍ، وrId يُربَط باسم جزئه
  model.relTargets = documentRels;
  model.partRels = partRels;
  model.mediaFiles = mediaFiles;
  model.embeddedFonts = embeddedFonts;
  const evenOdd = (settingsXml ?? "").match(/<w:evenAndOddHeaders\b([^>]*)\/?\s*>/);
  const evenOddVal = evenOdd?.[1]?.match(/w:val="([^"]+)"/)?.[1];
  model.evenAndOddHeaders = Boolean(evenOdd)
    && !["0", "false", "off"].includes(evenOddVal ?? "");
  for (const [name, xml] of headerFooterParts)
    model.headerFooters.set(name, parseHeaderFooterPart(xml, documentXml, styles, numbering, theme, name));
  return model;
}
