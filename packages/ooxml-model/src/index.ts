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
  /** مرجعُ حاشية/تعليقٍ ختاميّ في هذا الرنّ (رقمُه التسلسليّ ومعرّفه) — أو null */
  noteRef?: { id: string | null; num: number; kind: string } | null;
  /** ‏w:vertAlign=superscript — علامةُ الحاشية تُرفَع وتُصغَّر (تدخل صندوق السطر) */
  superscript?: boolean;
  /** ‏w:b أو w:bCs — عريض (يرفع ارتفاع السطر: آليّة الصندوق) */
  bold?: boolean;
  /** رنُّ **نتيجةِ حقل** (PAGE/NUMPAGES) — يُستبدَل نصُّه وقت الترصيف */
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
}
export interface BodyParagraph {
  index: number;
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
  /** يجب أن تبدأ هذه الفقرة في صفحةٍ جديدة — من w:pageBreakBefore، أو كسرِ
   *  صفحةٍ صريح (w:br type=page) قبلها، أو حدِّ مقطعٍ (sectPr nextPage). generic. */
  pageBreakBefore: boolean;
  /** ضبط الأرملة/اليتيم (w:widowControl) — افتراضيّ Word مُفعَّل (true)؛ val=0 يعطّله.
   *  مُفعَّلًا: لا يُترَك سطرٌ وحيدٌ للفقرة أعلى صفحةٍ أو أسفلها عند الكسر. */
  widowControl: boolean;
  /** ‏w:snapToGrid=0 — هذه الفقرةُ لا تتبع شبكةَ المستند */
  snapToGrid?: boolean;
  /** ‏w:br type="column" في الفقرة — تبدأ التاليةُ عمودًا جديدًا */
  columnBreak?: boolean;
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
  row: number;
  col: number;
  colXTwips: number; // إزاحة يسار العمود عن يسار الجدول
  colWTwips: number; // عرض الخليّة (مجموع أعمدة span)
  firstInCell: boolean; // أوّل فقرةٍ في الخليّة (تبدأ عند أعلى الصفّ)
  firstInRow: boolean;
  lastInRow: boolean;
  /** تظليل الخليّة (w:shd@w:fill) — «auto»/FFFFFF يُعامَل شفّافًا (حصاد الشاملة الذهبية) */
  shdFill: string | null;
  /** نمط الجدول (w:tblStyle) — تُحلّ منه الحدود إن غابت المباشرة */
  tblStyleId: string | null;
  /** مجموع أعمدة tblGrid (twips) — أساسُ معامل القياس إلى عرض العمود المتاح */
  totalGridTwips: number;
  /** عرض الجدول w:tblW: القيمة والنوع (pct مقياسه 5000=100٪، أو dxa، أو auto) */
  tblWVal: number;
  tblWType: string;
  /** ‏w:cantSplit على الصفّ: يمنع انشقاقه عبر الصفحات. **الافتراضيّ في OOXML/Word أنّ
   *  الصفوف تنشقّ**، فلا يُنقَل الصفّ إلّا إن كان هذا العلَم مضبوطًا. */
  cantSplit: boolean;
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
}

/** حدٌّ واحد: سُمكُه بالـtwips (‏w:sz أثمانُ نقطة) وفراغُه ولونُه */
export interface BorderSide { wTwips: number; spaceTwips: number; color: string | null; val: string }

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
  /** معرّف علاقة الصورة (a:blip r:embed) — لاستخراج البايت من word/media للعرض */
  rId: string | null;
  /** الجزءُ المالك ("header1.xml"…) — rId يُحلّ من علاقاته. null = المستند. */
  part?: string;
  /** محتوى مربّع نصٍّ (wps:txbx/v:textbox ← w:txbxContent) — فقراتٌ تُرصَف داخل الصندوق */
  textBox?: BodyParagraph[];
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
  /** شكلٌ متّجه (‏a:prstGeom أو VML): هندستُه ولونُ حشوه وحدّه. الرسمُ يحوّله
   *  إلى SVG. ‏prst أسماءُ OOXML الثابتة (rect/roundRect/ellipse/diamond/…). */
  shape?: { prst: string; fill: string | null; stroke: string | null;
    strokeW: number; adj: number | null;
    /** ‏v:stroke@dashstyle محلولًا إلى أطوالٍ بالـtwips (مضاعفاتُ سُمك الخطّ) */
    dash?: number[];
    /** ‏v:stroke@endcap — الافتراضيّ **flat** (butt) لا round */
    endcap?: string };
  /** مجموعةُ أشكال (‏a:grpSp/wpg:wgp): أبناءٌ لكلٍّ موضعُه وحجمُه **بعد** تحويل
   *  فضاء إحداثيّات المجموعة (‏chOff/chExt ⟵ off/ext) — بالـtwips، نسبيّةً
   *  إلى ركن المجموعة. */
  groupChildren?: { x: number; y: number; w: number; h: number; rId: string | null;
    /** دورانُ الابن وانعكاسُه وقصُّه — كنّا نُسقِطها فتُرسَم أبناءُ المجموعة
     *  معتدلةً بلا قصّ (‏ImageParser.dart:54-159) */
    rotDeg?: number; flipH?: boolean; flipV?: boolean;
    srcRect?: { l: number; t: number; r: number; b: number } }[];
  /** ‏a:srcRect — قصُّ الصورة من أطرافها، كسورًا من ١ (‏OOXML يخزّنها بأجزاء
   *  المئة الألفيّة: ٢١٥٩٦ = ٢١٫٥٩٦٪). الرسمُ يعرض الجزءَ الباقي مُمَدَّدًا. */
  srcRect?: { l: number; t: number; r: number; b: number };
  /** ‏a:xfrm@rot — دورانٌ بالدرجات (‏OOXML يخزّنه بأجزاء الستّين ألفًا من الدرجة) */
  rotDeg?: number;
  /** ‏a:xfrm@flipH/@flipV — انعكاسٌ أفقيّ/رأسيّ */
  flipH?: boolean;
  flipV?: boolean;
  /** ‏wps:bodyPr@anchor — رسوُّ النصّ في الصندوق عموديًّا: t (أعلى) / ctr (وسط) / b (أسفل) */
  boxAnchor?: string;
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
}
export interface DocumentModelV0 {
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
  /** الترويسات/التذييلات: اسمُ الجزء (header1.xml…) → فقراتُه */
  headerFooters: Map<string, BodyParagraph[]>;
  /** rId → اسمُ الجزء (لحلّ مراجع المقطع) */
  relTargets: Map<string, string>;
  /** علاقاتُ كلّ جزء: اسمُ الجزء → (rId → هدف). الصورةُ في ترويسةٍ تُحلّ من جزئها. */
  partRels: Map<string, Map<string, string>>;
  /** w:evenAndOddHeaders — ترويسة/تذييل مختلفٌ للصفحات الزوجيّة */
  evenAndOddHeaders: boolean;
}

// ---------- أدوات XML
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  preserveOrder: true,
  trimValues: false,
});
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
  /** علاقاتُ **كلّ جزء**: اسمُ الجزء ("document.xml"/"header1.xml") → (rId → هدف).
   *  لازمٌ لأنّ rId محلّيٌّ لجزئه: rId1 في ترويسة masjid صورةٌ، وفي المستند
   *  عنصرُ customXml — فحلُّه من ملفٍّ واحدٍ يعطي هدفًا خاطئًا. */
  partRels: Map<string, Map<string, string>>;
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
    for (const m of xml.match(/<Relationship [^>]*>/g) ?? []) {
      const id = m.match(/Id="([^"]+)"/); const tgt = m.match(/Target="([^"]+)"/);
      if (id?.[1] && tgt?.[1]) out.set(id[1], tgt[1].replace(/^\/?word\//, "").replace(/^\.\.\//, ""));
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
  return {
    documentXml: dec.decode(doc),
    stylesXml: get("word/styles.xml"),
    settingsXml: get("word/settings.xml"),
    themeXml: get("word/theme/theme1.xml"),
    numberingXml: get("word/numbering.xml"),
    footnotesXml: get("word/footnotes.xml"),
    endnotesXml: get("word/endnotes.xml"),
    headerFooterParts, documentRels, partRels, diagramDrawings,
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
}
export type NumberingTable = Map<string, NumLevelProps>; // "numId/ilvl"

export function parseNumbering(numberingXml: string | null): NumberingTable {
  const table: NumberingTable = new Map();
  if (!numberingXml) return table;
  const root = parser.parse(numberingXml) as XNode[];
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
        if (!ind && sz == null) continue;
        const left = ind?.["@w:left"] != null ? Number(ind["@w:left"]) : null;
        const right = ind?.["@w:right"] != null ? Number(ind["@w:right"]) : null;
        const hanging = ind?.["@w:hanging"] != null ? Number(ind["@w:hanging"]) : null;
        const firstLine = ind?.["@w:firstLine"] != null ? Number(ind["@w:firstLine"]) : null;
        lvls.set(ilvl, {
          indLeft: left, indRight: right,
          indFirstLine: hanging != null ? -hanging : firstLine,
          sz,
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
    for (const [ilvl, props] of lvls) table.set(`${numId}/${ilvl}`, props);
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
  /** ‏w:jc من pPr النمط — يورَّث (درس tadris para87: فقرة jc=null ظاهريًا
   *  وسطرها مسوَّغ ممتلئ لأن نمطها يحمل التسويغ) */
  jc: string | null;
  spacing: SpacingProps;
  /** مظهرُ النصّ من rPr النمط — يُدمَج على السلسلة (الأساسُ أوّلًا فيدوسه الفرع) */
  look: RunLook;
}
export interface StyleTable {
  defaults: { sz: number | null; family: string | null; spacing: SpacingProps };
  /** نمط الفقرة الافتراضي (w:default="1") — الفقرات بلا pStyle ترثه قبل
   *  docDefaults (درس masjid الرأسي: ‏Normal ‏line=240 يلغي docDefaults 276) */
  defaultParagraphStyleId: string | null;
  byId: Map<string, StyleProps>;
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
  if (!sp) return { present: false, line: null, lineRule: null, before: null, after: null };
  return {
    present: true,
    line: sp["@w:line"] != null ? Number(sp["@w:line"]) : null,
    lineRule: (sp["@w:lineRule"] as SpacingProps["lineRule"]) ?? (sp["@w:line"] != null ? "auto" : null),
    before: sp["@w:before"] != null ? Number(sp["@w:before"]) : null,
    after: sp["@w:after"] != null ? Number(sp["@w:after"]) : null,
  };
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
  for (const m of scheme[0].matchAll(/<a:(\w+)>([\s\S]*?)<\/a:>/g)) {
    const name = m[1]!;
    const srgb = m[2]!.match(/<a:srgbClr val="([0-9A-Fa-f]{6})"/);
    const sys = m[2]!.match(/<a:sysClr[^>]*lastClr="([0-9A-Fa-f]{6})"/);
    const hex = (srgb?.[1] ?? sys?.[1] ?? "").toUpperCase();
    if (!hex) continue;
    out.set(name, hex);
    if (ALIAS[name]) out.set(ALIAS[name]!, hex);
  }
  return out;
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
  underline?: string | null; underlineColor?: string | null;
  strike?: boolean; doubleStrike?: boolean;
  caps?: boolean; smallCaps?: boolean; italic?: boolean;
  charSpacing?: number; position?: number; kern?: number;
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
  return out;
}

function rPrProps(rpr: XNode[] | null): { sz: number | null; family: string | null } {
  if (!rpr) return { sz: null, family: null };
  let sz: number | null = null;
  let family: string | null = null;
  for (const n of rpr) {
    const a = (n[":@"] as Record<string, string>) ?? {};
    // ‏szCs للنص المركّب (العربية) مقدَّم عند وجوده — سلوك المحرك المرجعي (RPr.dart)
    if ("w:szCs" in n && a["@w:val"]) sz = Number(a["@w:val"]);
    else if ("w:sz" in n && sz == null && a["@w:val"]) sz = Number(a["@w:val"]);
    if ("w:rFonts" in n)
      family = a["@w:cs"] ?? a["@w:ascii"] ?? a["@w:hAnsi"] ?? a["@w:eastAsia"] ?? family;
  }
  return { sz, family };
}

const NO_SPACING: SpacingProps = { present: false, line: null, lineRule: null, before: null, after: null };

export function parseStyles(
  stylesXml: string | null, theme: Map<string, string> = new Map(),
): StyleTable {
  const table: StyleTable = {
    defaults: { sz: null, family: null, spacing: NO_SPACING },
    defaultParagraphStyleId: null, byId: new Map(),
  };
  if (!stylesXml) return table;
  const root = parser.parse(stylesXml) as XNode[];
  const styles = first(root, "w:styles");
  if (!styles) return table;

  const docDefaults = first(styles, "w:docDefaults");
  if (docDefaults) {
    const rprDefault = first(docDefaults, "w:rPrDefault");
    const rpr = rprDefault ? first(rprDefault, "w:rPr") : null;
    const pprDefault = first(docDefaults, "w:pPrDefault");
    const dpPr = pprDefault ? first(pprDefault, "w:pPr") : null;
    table.defaults = { ...rPrProps(rpr), spacing: spacingProps(dpPr) };
  }
  for (const styleNode of styles) {
    if (!("w:style" in styleNode)) continue;
    const a = (styleNode[":@"] as Record<string, string>) ?? {};
    const id = a["@w:styleId"];
    if (!id) continue;
    if (a["@w:type"] === "paragraph" && (a["@w:default"] === "1" || a["@w:default"] === "true"))
      table.defaultParagraphStyleId = id;
    const body = styleNode["w:style"] as XNode[];
    const rpr = first(body, "w:rPr");
    const basedOnAttrs = findAttr(body, "w:basedOn");
    const p = rPrProps(rpr);
    const stylePPr = first(body, "w:pPr");
    const ind = indProps(stylePPr);
    const jc = stylePPr ? (findAttr(stylePPr, "w:jc")?.["@w:val"] ?? null) : null;
    table.byId.set(id, {
      ...p, ...ind, jc, spacing: spacingProps(stylePPr),
      look: rPrLook(rpr, theme),
      basedOn: basedOnAttrs?.["@w:val"] ?? null,
    });
  }
  return table;
}

function resolveViaStyle(table: StyleTable, styleId: string | null) {
  let sz: number | null = null, family: string | null = null, jc: string | null = null;
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
    sz ??= s.sz; family ??= s.family; jc ??= s.jc;
    for (const k of Object.keys(s.look) as (keyof RunLook)[])
      if (look[k] === undefined) (look as Record<string, unknown>)[k] = s.look[k];
    indLeft ??= s.indLeft; indRight ??= s.indRight; indFirstLine ??= s.indFirstLine;
    if (s.spacing.present) {
      sp.present = true;
      if (sp.line == null && s.spacing.line != null) {
        sp.line = s.spacing.line; sp.lineRule = s.spacing.lineRule; sp.lineSource = "style";
      }
      sp.before ??= s.spacing.before; sp.after ??= s.spacing.after;
    }
    id = s.basedOn;
  }
  const dsp = table.defaults.spacing;
  if (dsp.present) {
    sp.present = true;
    if (sp.line == null && dsp.line != null) {
      sp.line = dsp.line; sp.lineRule = dsp.lineRule; sp.lineSource = "docDefaults";
    }
    sp.before ??= dsp.before; sp.after ??= dsp.after;
  }
  return {
    sz: sz ?? table.defaults.sz, family: family ?? table.defaults.family, jc,
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
  "75": "picture", "20": "line", "32": "line" };

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
        const chStroke = vmlColor(ca["@strokecolor"], theme);
        const chFill = ca["@filled"] === "f" || ca["@filled"] === "false"
          ? null : vmlColor(ca["@fillcolor"], theme);
        out.push({
          extentW: Math.round((lw * gw) / cx), extentH: Math.round((lh * gh) / cy),
          posHRel: grh ? (REL_H0[grh] ?? "column") : "column",
          posHOffset: Math.round(gx + ((lx - (cox || 0)) * gw) / cx),
          posVRel: grv ? (REL_V0[grv] ?? "paragraph") : "paragraph",
          posVOffset: Math.round(gy + ((ly - (coy || 0)) * gh) / cy),
          posHAlign: null, posVAlign: null,
          behindDoc: gz < 0, zOrder: gz,
          distL: 0, distR: 0, distT: 0, distB: 0, wrap: "",
          rId: collectDeep(ch, "v:imagedata")[0]?.attrs?.["@r:id"] ?? null,
          shape: { prst: chKind, fill: chFill, stroke: chStroke,
            strokeW: ca["@stroked"] === "f" ? 0 : 15, adj: null },
          vml: true,
        });
      }
    }
  }
  for (const tag of VML_SHAPE_TAGS) {
    for (const { node: sh, attrs: a } of collectDeep(pict, tag)) {
      if (inGroup.has(sh)) continue;                 // عُولج ضمن مجموعته
      const st = parseVmlStyle(a["@style"]);
      // مربّعُ النصّ: قد يرد v:textbox بعيدًا عن الشكل فنبحث عميقًا
      const tbNode = collectDeep(sh, "v:textbox")[0];
      const hasBox = collectDeep(sh, "w:txbxContent").length > 0;
      // النوعُ: o:spt، وإلّا الاسمُ المحلّيّ، وإلّا وجودُ صورةٍ ⟵ picture
      const tRef = (a["@type"] ?? "").replace(/^#/, "");
      const tAttrs = tRef ? types.get(tRef) : undefined;
      const spt = a["@o:spt"] ?? a["@spt"] ?? tAttrs?.["@o:spt"] ?? tAttrs?.["@spt"];
      const local = tag.slice(2);
      let kind = spt && VML_SPT[spt] ? VML_SPT[spt]!
        : local !== "shape" ? local
        : collectDeep(sh, "v:imagedata").length ? "picture" : "rect";
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
      // الحشوُ والخطّ: يُورَثان من v:shapetype عند غياب السمة
      const attrOf = (nm: string) => a[nm] ?? tAttrs?.[nm];
      const offish = (v: string | undefined) => v === "f" || v === "false";
      const isFilled = !offish(attrOf("@filled"));
      const isStroked = !offish(attrOf("@stroked"));
      const fillColor = isFilled ? vmlColor(attrOf("@fillcolor"), theme) : null;
      const strokeColor = isStroked ? vmlColor(attrOf("@strokecolor"), theme) : null;
      const strokeNode = collectDeep(sh, "v:stroke")[0];
      const strokeW = attrOf("@strokeweight") ? vmlUnit(attrOf("@strokeweight")) : 15;
      const dash = vmlDash(strokeNode?.attrs?.["@dashstyle"], strokeW);
      const endcap = strokeNode?.attrs?.["@endcap"] ?? "flat";
      // حشوُ الشكل الافتراضيّ (‏VmlShapeFillResolver.dart:10-34): صورةٌ بلا مربّع
      // نصٍّ ⟵ **شفّاف** (لئلّا يُخترع مستطيلٌ أبيضُ خلف PNG شفّافة)، وإلّا أبيض.
      const effFill = !isFilled ? null
        : fillColor ?? (kind === "picture" && !hasBox ? null : "FFFFFF");
      const tb = hasBox ? parseTextBox(sh, styles, numbering, theme) : undefined;
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
        distL: 0, distR: 0, distT: 0, distB: 0,
        wrap: wrap === "None" ? "" : wrap,
        rId: collectDeep(sh, "v:imagedata")[0]?.attrs?.["@r:id"] ?? null,
        behindDoc: z < 0,
        posHAlign: alignH && ["left", "center", "right"].includes(alignH) ? alignH : null,
        posVAlign: alignV && ["top", "center", "bottom"].includes(alignV) ? alignV : null,
        zOrder: z,
        ...(tb ? { textBox: tb } : {}), ...(ins ? { boxIns: ins, boxAnchor: "t" } : {}),
        shape: { prst: kind, fill: effFill, stroke: strokeColor,
          strokeW: isStroked ? Math.round(strokeW) : 0,
          adj: kind === "roundrect" ? vmlArcSize(attrOf("@arcsize")) : null,
          ...(dash ? { dash } : {}), endcap },
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
let partNameRef: string | null = null;

/** أشكالُ رسم SmartArt من diagrams/drawingN.xml. الجزءُ المرسوم يحمل النتيجةَ
 *  النهائيّة (مواضعُ وأحجامٌ ونصوص) فلا نحتاج إعادةَ حساب التخطيط الدلاليّ. */
function parseDiagramDrawing(
  xml: string, theme: Map<string, string>, scale: number,
): NonNullable<FloatAnchor["diagram"]> {
  const out: NonNullable<FloatAnchor["diagram"]> = [];
  const root = parser.parse(xml) as XNode[];
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

export function parseDocument(
  documentXml: string, styles: StyleTable,
  numbering: NumberingTable = new Map(),
  theme: Map<string, string> = new Map(),
): DocumentModelV0 {
  const root = parser.parse(documentXml) as XNode[];
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
    // ‏w:cols: أعمدةٌ متساوية (num/space). عرضُ العمود = (المتاح − الفواصل) ÷ العدد.
    const colsAttr = findAttr(sectPr, "w:cols");
    const colCount = Math.max(1, Number(colsAttr?.["@w:num"] ?? 1) || 1);
    const colSpaceTwips = Number(colsAttr?.["@w:space"] ?? 708);
    const usable = w - l - r;
    const colWidthTwips = colCount > 1
      ? Math.floor((usable - colSpaceTwips * (colCount - 1)) / colCount) : usable;
    return { pageWTwips: w, pageHTwips: h, marLeftTwips: l, marRightTwips: r,
      marTopTwips: t, marBottomTwips: b, columnTwips: colWidthTwips,
      colCount, colSpaceTwips, colWidthTwips,
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
      titlePg: first(sectPr, "w:titlePg") !== null };
  }
  const sections: SectionGeometry[] = [];
  let pendingFrom = 0; // أول فقرة لم يُسند مقطعها بعد

  const paragraphs: BodyParagraph[] = [];
  let idx = 0;
  // كسرُ الصفحة المعلَّق: يُنقَل من فقرةٍ حاملةٍ للكسر (أو حدِّ مقطع) إلى الفقرة
  // المرصَّفة التالية. الفقرات غير المرصَّفة (فارغة/صور) لا تستهلكه بل تُمرِّره. generic.
  let pendingBreak = false;
  // عدّادا الحواشي/التعليقات: **تسلسليّان بترتيب الظهور** في المتن (لا بـw:id)
  const footnoteSeq = { n: 0 }, endnoteSeq = { n: 0 };
  // تسطيح الكتل: فقرات المستوى الأعلى + فقرات خلايا الجداول (w:tbl>w:tr>w:tc>w:p) بترتيب
  // المستند — لإدراج محتوى الجداول في التدفّق (حصاد «الشاملة الذهبية»؛ التخطيط الشبكيّ
  // الكامل لاحقًا، لكنّ المحتوى يحضر ويُقاس). التداخل يُعالَج تكراريًّا.
  let tableCounter = 0;
  const flattenBlocks = (nodes: XNode[], ctx: TableCellCtx | null = null): { node: XNode; cell: TableCellCtx | null }[] => {
    const out: { node: XNode; cell: TableCellCtx | null }[] = [];
    for (const n of nodes) {
      if ("w:p" in n) out.push({ node: n, cell: ctx });
      else if ("w:tbl" in n) {
        const tbl = n["w:tbl"] as XNode[];
        const tblPr = first(tbl, "w:tblPr");
        const tblStyleId = tblPr ? (findAttr(tblPr, "w:tblStyle")?.["@w:val"] ?? null) : null;
        const tblWAttr = tblPr ? findAttr(tblPr, "w:tblW") : null;
        const tblWVal = Number(tblWAttr?.["@w:w"] ?? 0);
        const tblWType = tblWAttr?.["@w:type"] ?? "auto";
        const tblPrNode = first(tbl, "w:tblPr");
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
        const grid = collectDeep(tbl, "w:gridCol").map((g) => Number(g.attrs["@w:w"] ?? 0));
        const colX: number[] = []; let acc = 0;
        for (const w of grid) { colX.push(acc); acc += w; }
        const tableId = tableCounter++;
        let row = 0;
        for (const tr of tbl) {
          if (!("w:tr" in tr)) continue;
          const trPr = first(tr["w:tr"] as XNode[], "w:trPr");
          const csVal = trPr ? findAttr(trPr, "w:cantSplit")?.["@w:val"] : undefined;
          const cantSplit = trPr ? (first(trPr, "w:cantSplit") !== null
            && !["0", "false", "off"].includes(csVal ?? "")) : false;
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
            const shdFill = rawFill && !["auto", "FFFFFF", "ffffff"].includes(rawFill) ? rawFill : null;
            // الدمجُ العموديّ: وجودُ w:vMerge بلا val يعني «استمرار» (ECMA-376)
            let vMerge: "restart" | "continue" | null = null;
            if (tcPr && first(tcPr, "w:vMerge") !== null) {
              const mv = findAttr(tcPr, "w:vMerge")?.["@w:val"];
              vMerge = mv === "restart" ? "restart" : "continue";
            }
            const vAlign = tcPr ? (findAttr(tcPr, "w:vAlign")?.["@w:val"] ?? null) : null;
            const textDirection = tcPr ? (findAttr(tcPr, "w:textDirection")?.["@w:val"] ?? null) : null;
            // الهوامش: هوامشُ الخليّة تتقدّم على هوامش الجدول ثمّ على افتراضيّ Word
            const cellMar = (side: string, dflt: number) => {
              const own = tcPr ? first(tcPr, "w:tcMar") : null;
              const fromOwn = own ? findAttr(own, `w:${side}`)?.["@w:w"] : undefined;
              if (fromOwn != null) return Number(fromOwn);
              const fromTbl = tblCellMar ? findAttr(tblCellMar, `w:${side}`)?.["@w:w"] : undefined;
              return fromTbl != null ? Number(fromTbl) : dflt;
            };
            const cc: TableCellCtx = { tableId, row, col, colXTwips: colX[col] ?? 0, colWTwips,
              firstInCell: false, firstInRow: ci === 0, lastInRow: ci === cells.length - 1,
              shdFill, tblStyleId, totalGridTwips: acc, tblWVal, tblWType, cantSplit,
              bidiVisual, tblIndTwips, tblJc,
              vMerge, vAlign, textDirection, rowHeight, rowHeightRule,
              marTop: cellMar("top", 0), marBottom: cellMar("bottom", 0),
              marLeft: cellMar("left", 108), marRight: cellMar("right", 108) };
            const cellParas = flattenBlocks(tc, cc);
            if (cellParas[0]?.cell) cellParas[0].cell = { ...cellParas[0].cell, firstInCell: true };
            out.push(...cellParas);
            col += span;
          });
          row++;
        }
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
    // ‏w:bidi: الحضورُ بلا val ⟵ صحيح، و val في {0,false,off} ⟵ **صريحُ LTR**.
    // (كان الفحصُ حضورًا محضًا فيُقرَأ `<w:bidi w:val="0"/>` RTL — مقلوبًا.)
    const bidi = pPr && first(pPr, "w:bidi") !== null
      ? !["0", "false", "off"].includes(findAttr(pPr, "w:bidi")?.["@w:val"] ?? "")
      : false;
    // فقرة بلا pStyle ترث نمط الفقرة الافتراضي (Normal) قبل docDefaults
    const styleProps = resolveViaStyle(styles, styleId ?? styles.defaultParagraphStyleId);
    // ‏w:jc: المباشر يتقدم وإلا فمن سلسلة النمط (درس tadris para87)
    const jc = (pPr ? (findAttr(pPr, "w:jc")?.["@w:val"] ?? null) : null) ?? styleProps.jc;
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
    const pPrRPr = rPrProps(pPrRPrNode);
    // خط علامة الترقيم بشريحة ASCII (أرقام «1.» لاتينية الشريحة!) — من
    // ‏rFonts ascii في rPr علامة الفقرة (حل لغز 586: ‏asc(Simplified)=1.18em)
    const markAsciiFamily = pPr
      ? (findAttr(first(pPr, "w:rPr") ?? [], "w:rFonts")?.["@w:ascii"] ?? null)
      : null;
    const markSz = pPrRPr.sz ?? styleProps.sz ?? null;
    // ملحوظة: طيّ lvl/rPr.sz هنا نتيجة سلبية مقيسة (tadris ‏96.1→93.7) —
    // الحقل مكشوف في NumberingTable لمن يحتاجه، بلا مشاركة في ارتفاع السطر.
    const markEmTwips = markSz != null ? markSz * 10 : null;

    let excluded: BodyParagraph["excluded"] = false;
    const runs: EffectiveRun[] = [];
    const anchors: FloatAnchor[] = [];
    // كسرُ الصفحة الصريح (w:br type=page): قبل نصّ الفقرة = هي على صفحةٍ جديدة؛
    // بعد نصّها (أو فقرة فارغة) = التالية على صفحةٍ جديدة. sawText يفرّق الحالتين.
    let sawText = false, leadingPageBreak = false, trailingPageBreak = false, anyPageBreak = false;
    let columnBreak = false;
    const tabTextPositions: number[] = []; // مواضع w:tab في نصّ الفقرة (لتقسيم TOC)
    const ptabPositions: BodyParagraph["ptabAt"] = []; // مواضعُ w:ptab المطلقة
    let paraTextLen = 0; // طول نصّ الفقرة المتراكم عبر الرنّات (لموضع w:tab الصحيح)
    let inlineImageHTwips = 0; // أطول صورةٍ سطريّة (تحجز صندوق سطر)
    let hasDrawing = false; // صورة/شكل — يُقصى فقط إن كانت الفقرة صورةً خالصةً بلا نصّ
    let fldDepth = 0, fldInResult = false; let fldKind: string | null = null;
    // نُسطِّح الرنّات: المستوى الأعلى + رنّات داخل w:hyperlink (فهارس TOC تلفّ رقم
    // الصفحة بـPAGEREF في hyperlink) + رنّات fldSimple. هكذا يكتمل نصّ صفّ الفهرس.
    const runNodes: XNode[] = [];
    for (const rNode of p) {
      if ("w:r" in rNode) runNodes.push(rNode);
      else if ("w:hyperlink" in rNode)
        for (const hr of rNode["w:hyperlink"] as XNode[]) if ("w:r" in hr) runNodes.push(hr);
      else if ("w:fldSimple" in rNode) {
        for (const fr of rNode["w:fldSimple"] as XNode[]) if ("w:r" in fr) runNodes.push(fr);
        excluded = excluded || "field";
      }
    }
    for (const rNode of runNodes) {
      const r = rNode["w:r"] as XNode[];
      const rpr = first(r, "w:rPr");
      const own = rPrProps(rpr);
      const hidden = rpr ? rpr.some((n) => "w:vanish" in n) : false;
      let text = "";
      let symFont: string | null = null; // خطُّ رمزٍ w:sym (يتقدّم على خطّ الرن)
      let noteRef: { id: string | null; num: number; kind: string } | null = null;
      for (const t of r) {
        if ("w:t" in t) {
          const parts = t["w:t"] as XNode[];
          for (const seg of parts) if ("#text" in seg) text += String(seg["#text"]);
          if (text.trim()) sawText = true;
        }
        // ‏w:br: كسرُ صفحةٍ (type=page) ليس فاصل سطر — يُرصَد ولا يدخل النصّ؛
        // غيره (الافتراضي/textWrapping/column) فاصل سطرٍ يدويّ يُمثَّل بـ\n.
        if ("w:br" in t) {
          const brType = (t[":@"] as Record<string, string> | undefined)?.["@w:type"];
          if (brType === "page") { anyPageBreak = true; if (sawText) trailingPageBreak = true; else leadingPageBreak = true; }
          else if (brType === "column") { columnBreak = true; text += "\n"; }
          else text += "\n";
        }
        // ‏w:sym: حرفٌ بخطٍّ رمزيّ (ﷺ/زخارف AGA) — يُحلّ لمحرفٍ فعليّ (إزاحة PUA)
        // ويُضاف للنصّ بخطّه الرمزيّ (لا يُقصى بعد اليوم؛ حصاد «الشاملة الذهبية»).
        // الخطّ الرمزيّ متوفّرٌ في subset-metrics فيُشكَّل بعرضه الصحيح.
        // ‏w:noBreakHyphen: شرطةٌ لا يُكسَر عندها السطر ⟵ شرطةٌ غيرُ فاصلة (U+2011)
        if ("w:noBreakHyphen" in t) { text += "\u2011"; sawText = true; }
        // ‏w:softHyphen: شرطةٌ اختياريّةٌ لا تظهر إلّا عند الكسر — لا نكسر عندها بعد،
        // فنُسقِطها من النصّ المرئيّ (إظهارُها بلا كسرٍ خطأٌ صريح).
        if ("w:softHyphen" in t) { /* تُتجاهَل حتّى نكسر عندها */ }
        if ("w:sym" in t) {
          const a = (t[":@"] as Record<string, string> | undefined) ?? {};
          const ch = resolveSymChar(a["@w:font"], a["@w:char"]);
          if (ch) { text += ch; symFont = a["@w:font"] ?? null; sawText = true; }
        }
        // مرجعُ حاشية/تعليقٍ ختاميّ: Word يرسم **رقمًا تسلسليًّا** بترتيب الظهور (لا w:id).
        // نحقنه نصًّا فيلتحم بقوسَي «(» و«)» المجاورتين طبيعيًّا فيصير «(N)» كما يعرضه Word.
        if ("w:footnoteReference" in t || "w:endnoteReference" in t) {
          const a = (t[":@"] as Record<string, string> | undefined) ?? {};
          const isEnd = "w:endnoteReference" in t;
          const refId = a["@w:id"] ?? null;
          const num = isEnd ? ++endnoteSeq.n : ++footnoteSeq.n;
          noteRef = { id: refId, num, kind: isEnd ? "endnote" : "footnote" };
          text += String(num); sawText = true;
        }
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
            if (!dm) continue;
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
              rId: collectDeep(anc, "a:blip")[0]?.attrs?.["@r:embed"]
                ?? collectDeep(anc, "a:blip")[0]?.attrs?.["@r:link"] ?? null,
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
                  kids.push({
                    x: Math.round(((num(kx, "a:off", "@x") - chOffX) * sx) / EMU),
                    y: Math.round(((num(kx, "a:off", "@y") - chOffY) * sy) / EMU),
                    w: Math.round((num(kx, "a:ext", "@cx") * sx) / EMU),
                    h: Math.round((num(kx, "a:ext", "@cy") * sy) / EMU),
                    rId: collectDeep(sp.node, "a:blip")[0]?.attrs?.["@r:embed"] ?? null,
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
                const hasNoFill = directChild(spPr, "a:noFill") !== undefined && !solid;
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
                return { shape: {
                  prst: geom?.attrs?.["@prst"] ?? (vml ? "rect" : "rect"),
                  fill: hasNoFill ? null : clrOf(solid),
                  stroke: lnNoFill ? null : (clrOf(lnNode?.node) ?? (strokeW ? "000000" : null)),
                  strokeW: strokeW || (lnNode ? 12 : 0), adj } };
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
                const bp = collectDeep(anc, "wps:bodyPr")[0]?.attrs ?? {};
                const ins = (k: string, dflt: number) =>
                  bp[k] != null ? Math.round(Number(bp[k]) / EMU) : dflt;
                return { textBox: tb, boxAnchor: bp["@anchor"] ?? "t",
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
          if (ft === "begin") { fldDepth++; fldKind = null; fldInResult = false; }
          else if (ft === "separate") { fldInResult = true; }
          else if (ft === "end") { fldDepth = Math.max(0, fldDepth - 1); fldInResult = false; if (!fldDepth) fldKind = null; }
          excluded = excluded || "field";
        }
        if ("w:instrText" in t) {
          const parts = t["w:instrText"] as XNode[];
          let instr = "";
          for (const seg of parts) if ("#text" in seg) instr += String(seg["#text"]);
          const INS = instr.toUpperCase();
          if (INS.includes("NUMPAGES")) fldKind = "NUMPAGES";   // قبل PAGE (يحتويها)
          else if (INS.includes("PAGE")) fldKind = "PAGE";
          excluded = excluded || "field";
        }
      }
      if (!hidden) paraTextLen += text.length; // يوافق نصّ الفقرة (المرئيّ) لموضع w:tab
      if (!text) continue;
      const vAlign = rpr ? (findAttr(rpr, "w:vertAlign")?.["@w:val"] ?? null) : null;
      const boldOn = (nm: string) => {
        if (!rpr || first(rpr, nm) === null) return false;
        const v = findAttr(rpr, nm)?.["@w:val"];
        return !["0", "false", "off"].includes(v ?? "");
      };
      // المظهر: المباشرُ يتقدّم، ثمّ rPr الفقرة، ثمّ سلسلةُ النمط
      const look: RunLook = { ...styleProps.look, ...rPrLook(pPrRPrNode, theme), ...rPrLook(rpr, theme) };
      runs.push({
        text,
        ...look,
        fieldResult: fldInResult && fldKind ? fldKind : null,
        noteRef,
        superscript: vAlign === "superscript",
        bold: boldOn("w:b") || boldOn("w:bCs"),
        family: symFont ?? own.family ?? pPrRPr.family ?? styleProps.family,
        emTwips: (own.sz ?? pPrRPr.sz ?? styleProps.sz) != null
          ? (own.sz ?? pPrRPr.sz ?? styleProps.sz)! * 10
          : null,
        hidden,
      });
    }
    const text = runs.filter((r) => !r.hidden).map((r) => r.text).join("");
    if (!text.trim()) excluded = excluded || "empty";
    // صفّ TOC (حصاد «الشاملة الذهبية»): توقّفٌ يمينيٌّ ذو leader (أو نمط toc) مع w:tab
    // فعليّ في رنّ. التقسيم: **آخر** w:tab يفصل المدخل عن رقم الصفحة (الأسبق داخليّة).
    // ‏w:pBdr — حدودُ الفقرة (سُمكٌ + فراغٌ يزيدان ارتفاعَها)
    const pBdrNode = pPr ? first(pPr, "w:pBdr") : null;
    const bdrSide = (nm: string): BorderSide | null => {
      if (!pBdrNode) return null;
      const a = findAttr(pBdrNode, `w:${nm}`);
      if (!a) return null;
      const val = a["@w:val"] ?? "single";
      if (val === "none" || val === "nil") return null;
      return { wTwips: Math.round((Number(a["@w:sz"] ?? 4) / 8) * 20),
        spaceTwips: Number(a["@w:space"] ?? 0) * 20, // w:space بالنقاط
        color: (a["@w:color"] && a["@w:color"] !== "auto") ? a["@w:color"].toUpperCase() : null,
        val };
    };
    const pBdr = pBdrNode ? { top: bdrSide("top"), bottom: bdrSide("bottom"),
      left: bdrSide("left"), right: bdrSide("right") } : null;
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
    const wcVal = pPr ? findAttr(pPr, "w:widowControl")?.["@w:val"] : undefined;
    const wcEl = pPr ? first(pPr, "w:widowControl") !== null : false;
    const widowControl = !wcEl || !["0", "false", "off"].includes(wcVal ?? "");
    // حسم كسرِ الصفحة: الفقرة المرصَّفة تستهلك المعلَّق (وتبدأ صفحةً)؛ غير المرصَّفة
    // تُمرِّره. كسرٌ لاحقٌ لنصّها (أو فارغة حاملة) يدفع التالية.
    let pageBreakBefore = false;
    // الفقرةُ الفارغة **تُرصَّف** (سطرٌ فارغ) فتستهلك كسرَها بنفسها ولا تُمرِّره — وإلّا
    // تنهار الكسراتُ المتتالية في واحدة (masjid: ٨٧ كسرًا كانت تُنتج ٢٦ فقط).
    if (excluded && excluded !== "empty") {
      pendingBreak = pendingBreak || ppPageBreak || anyPageBreak;
    } else {
      pageBreakBefore = pendingBreak || ppPageBreak || leadingPageBreak;
      pendingBreak = trailingPageBreak;
    }
    // ‏w:spacing: وراثة سمّية — سمات المباشر تتقدم وتُكمَّل من السلسلة
    const ownSp = spacingProps(pPr);
    const chain = styleProps.spacing;
    const spacing: SpacingProps = {
      present: ownSp.present || chain.present,
      line: ownSp.line ?? chain.line,
      lineRule: ownSp.line != null ? ownSp.lineRule : chain.lineRule,
      before: ownSp.before ?? chain.before,
      after: ownSp.after ?? chain.after,
      lineDirect: ownSp.line != null,
      lineSource: ownSp.line != null ? "ppr" : (chain.lineSource ?? null),
    };
    paragraphs.push({
      index: idx, runs, text, styleId, jc, bidi,
      indLeft, indRight, indFirstLine, excluded, sectionIndex: -1, numbered, anchors,
      spacing, markEmTwips, markAsciiFamily, pageBreakBefore, widowControl, tabStops, toc, inlineImageHTwips, tableCell,
      tabAt: tabTextPositions, ptabAt: ptabPositions, columnBreak, pBdr, shd: pShd,
      snapToGrid: pPr && first(pPr, "w:snapToGrid") !== null
        ? !["0", "false", "off"].includes(findAttr(pPr, "w:snapToGrid")?.["@w:val"] ?? "") : true,
    });
    // ‏sectPr داخل pPr يختم مقطعًا: هندسته تسري على هذه الفقرة وما سبقها
    const pSect = pPr ? first(pPr, "w:sectPr") : null;
    if (pSect) {
      sections.push(geomFrom(pSect));
      for (let k = pendingFrom; k < paragraphs.length; k++)
        paragraphs[k]!.sectionIndex = sections.length - 1;
      pendingFrom = paragraphs.length;
      // مقطعٌ من نوع nextPage/even/odd (الافتراضي nextPage) يدفع التالية لصفحةٍ
      // جديدة؛ continuous لا يكسر. (المقطع الأخير للـbody بلا تالية فلا أثر).
      const sType = findAttr(pSect, "w:type")?.["@w:val"] ?? "nextPage";
      if (sType !== "continuous") pendingBreak = true;
    }
  }
  // ‏sectPr الـbody يختم المقطع الأخير (البقية كلها له)
  sections.push(geomFrom(first(body, "w:sectPr")));
  for (let k = pendingFrom; k < paragraphs.length; k++)
    paragraphs[k]!.sectionIndex = sections.length - 1;
  const section = sections[sections.length - 1]!;
  return { section, sections, paragraphs, compatibilityMode: 11, defaultTabStop: 720,
    footnotes: new Map(), endnotes: new Map(), headerFooters: new Map(), relTargets: new Map(),
    evenAndOddHeaders: false, partRels: new Map() };
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
    const idM = m.match(/w:id="(-?\d+)"/);
    if (!idM) continue;
    if (/w:type="(separator|continuationSeparator)"/.test(m)) continue;
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

export function extractFromDocx(bytes: Uint8Array): DocumentModelV0 {
  const { documentXml, stylesXml, settingsXml, numberingXml, footnotesXml, endnotesXml,
    headerFooterParts, documentRels, themeXml, partRels, diagramDrawings } = openDocx(bytes);
  partRelsRef = partRels; diagramsRef = diagramDrawings; partNameRef = "document.xml";
  const theme = parseTheme(themeXml);
  const styles = parseStyles(stylesXml, theme);
  const numbering = parseNumbering(numberingXml);
  const model = parseDocument(documentXml, styles, numbering, theme);
  model.compatibilityMode = compatibilityMode(settingsXml);
  model.defaultTabStop = defaultTabStop(settingsXml);
  // نصوصُ الحواشي/التعليقات — تُرصَّف أسفل الصفحة التي فيها مرجعُها
  model.footnotes = parseNotes(footnotesXml, documentXml, styles, numbering, "w:footnote", theme);
  model.endnotes = parseNotes(endnotesXml, documentXml, styles, numbering, "w:endnote", theme);
  // الترويسات/التذييلات: كلُّ جزءٍ يُحلَّل فقراتٍ، وrId يُربَط باسم جزئه
  model.relTargets = documentRels;
  model.partRels = partRels;
  model.evenAndOddHeaders = (settingsXml ?? "").includes("<w:evenAndOddHeaders");
  for (const [name, xml] of headerFooterParts)
    model.headerFooters.set(name, parseHeaderFooterPart(xml, documentXml, styles, numbering, theme, name));
  return model;
}
