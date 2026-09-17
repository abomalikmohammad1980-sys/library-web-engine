import type { BodyParagraph, SectionGeometry, TableCellCtx } from "@engine/ooxml-model";

/**
 * ‏@engine/scene — شجرة المشهد (v1): بنية الصفحة القابلة للترسيم الذاتي.
 *
 * كل الأبعاد بالـ twips (شبكة ADR-0004) أو بوحدات الخط (font units)؛
 * لا px إلا عند الرسم. البناء في `build.ts`، الحزم في `serialize.ts`.
 */

export type Direction = "rtl" | "ltr";

/** خطٌّ مستخدَم في المشهد — بايتاته محفوظة (لترسيم المسارات) وقياساته مخزنة. */
export interface SceneFont {
  /** معرّف فريد في المشهد (family|bold|italic) */
  key: string;
  family: string;
  bold?: boolean;
  italic?: boolean;
  data: Uint8Array;
  upem: number;
  ascender: number;   // font units
  descender: number;  // font units (سالب)
  lineGap: number;    // font units
  /** العائلة الفعلية إن كان المورّد يستطيع التصريح بهويتها. */
  resolvedFamily?: string;
  /** true عندما قيس النص بوجه غير عائلة Word المطلوبة. */
  substituted?: boolean;
  resolutionSource?: "exact" | "fallback-family" | "default";
}

/** غليف مُشكّل — تقدماته بوحدات الخط (بمقياس upem). */
export interface SceneGlyph {
  id: number;
  cluster: number;
  xAdvance: number;
  yAdvance: number;
  xOffset: number;
  yOffset: number;
  flags: number;
}

/** خصائص مظهرية للرسم */
export interface SceneLook {
  color: string | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  underlineColor: string | null;
  highlight: string | null;
  strike: boolean;
}

/**
 * كلمةٌ مُشكّلة (سطر مقطوع عند المسافات): غليفاتها بالترتيب البصري لاتجاهها،
 * وتقدّمها الإجمالي بـ twips (كسرية). هي وحدة الرسم الأصغر في السطر.
 */
export interface SceneWord extends SceneLook {
  text: string;
  fontIndex: number;
  direction: Direction;
  glyphs: SceneGlyph[];
  /** إجمالي تقدم الغليفات بـ twips (كسرية) */
  advanceTwips: number;
  /** مساحة U+0020 قبلها بـ twips (تُعدَّل عند التسويغ) */
  spaceBeforeTwips: number;
  /** تنتهي الكلمة بفاصل سطر Word يدوي (w:br/textWrapping). */
  forcedBreakAfter?: boolean;
  /** رفع/خفض خط الأساس (w:position/vertAlign) بـ twips */
  baselineShiftTwips: number;
  /** مستوى BiDi للمقطع — لترتيب السطر البصري */
  level: number;
  /** حجم em الفعلي بـ twips */
  emTwips: number;
  /** معامل التحويل بوحدات الخط→twips = emTwips/upem */
  unitTwips: number;
  /** مقياس عرض المحارف w:w (1 = 100%)؛ لا يغير الارتفاع. */
  horizontalScale?: number;
  /** مقاييس السطر المساهَمة (من خط الكلمة) */
  ascentTwips: number;
  descentTwips: number;
  /** upem الخط + فجوة الخط بـ twips (ارتفاع السطر الطبيعي) */
  upem: number;
  gapTwips: number;
}

export interface SceneLine {
  /** الكلمات **بترتيب التدفّق من حافة البداية** (يمينُ البداية لـRTL):
   *  أولُ عنصرٍ يُرسم عند startTwips ويُتبع باتجاه التدفّق. */
  words: SceneWord[];
  /** إحداثي أول غليف في خط التدفّق (نقطة بداية السطر) بـ twips */
  startTwips: number;
  /** العرض الطبيعي (بلا تسويغ) بـ twips */
  widthTwips: number;
  ascentTwips: number;
  descentTwips: number;
  lineGapTwips: number;
  heightTwips: number;
  /** صفّ جارٍ بالرسم — الإحداثيات تُملأ في التدفّق العمودي */
  yTwips: number;
  /** سطرٌ مسوَّغ يُملأ حتى نهاية العمود (jc=both غير الأخير) */
  justified: boolean;
  /** معامل انكماش مسافات سطرٍ محشور (القاعدة 16) — null لغير المحشور:
   *  الرسمُ يضرب كلّ spaceBeforeTwips به ليبلغ عرضَ العمود. */
  shrinkFactor: number | null;
}

export interface SceneBorderSide {
  wTwips: number;
  spaceTwips: number;
  color: string | null;
  val: string;
}

export interface SceneParagraph {
  index: number;
  dir: Direction;
  jc: string | null;
  /** بداية التدفّق (حافة النص): يسارٌ لـLTR، يمينٌ لـRTL — بـ twips من حافة الصفحة */
  flowStartTwips: number;
  /** عرض منطقة النص (العمود ناقص indents) بـ twips */
  widthTwips: number;
  /** مسافة السطر الأول الإضافية (موجبة = تُنقّص العرض وتبدأ داخليًا) */
  firstLineIndentTwips: number;
  spacingBeforeTwips: number;
  spacingAfterTwips: number;
  shd: string | null;
  pBdr: { top: SceneBorderSide | null; bottom: SceneBorderSide | null; left: SceneBorderSide | null; right: SceneBorderSide | null } | null;
  numbered: boolean;
  /** نص علامة الترقيم (مثل "1." أو "•") — يُرسَم قبل أول كلمة */
  markerText: string | null;
  /** عرض علامة الترقيم بالـ twips (لحجز مساحتها في التدفّق) */
  markerWidthTwips: number;
  lines: SceneLine[];
  /** أعلى الصندوق بـ twips من حافة الصفحة (يُملأ في التدفّق) */
  yTwips: number;
}

/** ملكية خلية/صف/جدول قبل الرسم؛ تبقي metadata OOXML مع الفقرات والمراسي. */
export interface SceneTableCellSource {
  tableCell: TableCellCtx;
  paragraphs: BodyParagraph[];
}
export interface SceneTableRowSource {
  tableId: number;
  parentTableId?: number; parentRow?: number; parentCol?: number; parentBlockIndex?: number; nestingDepth?: number;
  row: number;
  cantSplit: boolean;
  /** ‏w:tblHeader — صف رأس متصل ببداية الجدول ويعاد في الصفحات التالية. */
  repeatHeader: boolean;
  cells: SceneTableCellSource[];
}
export interface SceneTableSource {
  tableId: number;
  parentTableId?: number; parentRow?: number; parentCol?: number; parentBlockIndex?: number; nestingDepth?: number;
  rows: SceneTableRowSource[];
}
export interface SceneTableCell {
  xTwips: number; yTwips: number; wTwips: number; hTwips: number;
  gridSpan: number; shdFill: string | null;
  borders: TableCellCtx["tcBorders"];
  paragraphs: SceneParagraph[];
  /** جداول w:tbl المملوكة مباشرةً لهذه الخلية، بهندسة صفحة غير مكررة. */
  nestedTables?: SceneTableFragment[];
  anchors: BodyParagraph["anchors"];
}
export interface SceneTableRow {
  tableId: number; row: number; yTwips: number; hTwips: number; cantSplit: boolean;
  parentTableId?: number; parentRow?: number; parentCol?: number; parentBlockIndex?: number; nestingDepth?: number;
  repeatHeader: boolean;
  cells: SceneTableCell[];
}
export interface SceneTableFragment {
  tableId: number;
  parentTableId?: number; parentRow?: number; parentCol?: number; parentBlockIndex?: number; nestingDepth?: number;
  rows: SceneTableRow[];
}

/** صورة/شكل مرساة في المشهد: إحداثياتها × بايتاتها. */
export interface SceneAnchor {
  /** يسار الصندوق بالـ twips من حافة الصفحة */
  xTwips: number;
  /** أعلى الصندوق بالـ twips من حافة الصفحة */
  yTwips: number;
  /** عرض الصندوق بالـ twips */
  wTwips: number;
  /** ارتفاع الصندوق بالـ twips */
  hTwips: number;
  /** بايتات الصورة الخام (JPEG/PNG/GIF/SVG) — null للأشكال غير الصورية */
  imageData: Uint8Array | null;
  /** خلف النص (behindDoc) */
  behindDoc: boolean;
  /** مرساة عائمة (wp:anchor) لا سطرية (wp:inline) */
  floating: boolean;
  /** ترتيب التراكب من wp:relativeHeight/VML z-index؛ التعادل يحفظ ترتيب المصدر. */
  zOrder?: number;
  /** لون حشو الشكل — null إن لم يكن شكلاً */
  shapeFill: string | null;
  /** لون حد الشكل */
  shapeStroke: string | null;
  /** سماكة حد الشكل بالـtwips، وتدرجه المحلول من DrawingML. */
  shapeStrokeWTwips?: number;
  shapeGradient?: { angle: number; stops: { pos: number; color: string }[] };
  shapeAdj?: number;
  chart?: { kind: "bar" | "unsupported"; unsupportedType?: string;
    direction: "column" | "bar"; grouping: string; title: string | null;
    legend: { visible: boolean; position: string }; showValues: boolean;
    categoryAxis: boolean; valueAxis: boolean; categories: string[];
    series: { name: string; values: number[]; color: string }[] };
  /** شكلٌ محدد (rect/ellipse/…) */
  shapePrst: string | null;
  imageShadow?: { x: number; y: number; blur: number; color: string; opacity: number };
  imageBorder?: { width: number; color: string; dash?: string };
  imageGlow?: { radius: number; color: string; opacity: number };
  imageReflection?: { distance: number; startOpacity: number; endOpacity: number };
  /** alphaModFix للصورة؛ 0 شفاف و1 معتم. */
  imageOpacity?: number;
  /** فقرات مربّع النص مرصوفة داخل حشوات امتداد المرساة. */
  textBoxParas?: SceneParagraph[];
  /** دوران/انعكاس الشكل نفسه حول مركزه. */
  rotDeg?: number;
  flipH?: boolean;
  flipV?: boolean;
  /** أطفال مجموعة DrawingML بعد تحويل فضاء المجموعة إلى إحداثيات الصفحة. */
  groupChildren?: SceneAnchorChild[];
}

export interface SceneAnchorChild {
  xTwips: number; yTwips: number; wTwips: number; hTwips: number;
  imageData: Uint8Array | null;
  shapeFill: string | null; shapeStroke: string | null; shapePrst: string | null;
  shapeStrokeWTwips?: number;
  shapeGradient?: { angle: number; stops: { pos: number; color: string }[] };
  shapeAdj?: number;
  /** نص شكل SmartArt وحجمه؛ أطفال المجموعات العاديون قد يخلوان منه. */
  text?: string;
  textEmTwips?: number;
  rotDeg?: number; flipH?: boolean; flipV?: boolean;
}

export interface ScenePage {
  index: number;
  /** المقطع الذي أنشأ الصفحة، لاختيار first/even/default للرأس والتذييل. */
  sectionIndex: number;
  widthTwips: number;
  heightTwips: number;
  marLeftTwips: number;
  marRightTwips: number;
  marTopTwips: number;
  marBottomTwips: number;
  /** لون w:background العام، دون #. */
  backgroundColor?: string;
  paragraphs: SceneParagraph[];
  /** أجزاء الجداول المالكة لهذه الصفحة؛ يملؤها table paginator المرحلي. */
  tables?: SceneTableFragment[];
  /** الصور/الأشكال العائمة على الصفحة (مرتبة بـ zOrder) */
  anchors: SceneAnchor[];
  /** فقرات الترويسة (تُرسَم أعلى الصفحة) */
  headerParas?: SceneParagraph[];
  /** فقرات التذييل (تُرسَم أسفل الصفحة) */
  footerParas?: SceneParagraph[];
  /** إطار الصفحة المحلول بعد تطبيق display للصفحة داخل المقطع. */
  pageBorders?: SectionGeometry["pageBorders"];
  pageBorderOffsetFrom?: SectionGeometry["pageBorderOffsetFrom"];
  pageBorderZOrder?: SectionGeometry["pageBorderZOrder"];
}

export interface SceneDocument {
  pages: ScenePage[];
  fonts: SceneFont[];
}

/** خيارات البناء */
export interface BuildOptions {
  /** حدّ أقصى لعدد الصفحات — حارس للوثائق الشاذة */
  maxPages?: number;
  /** نسبة الخط الواحد default عند غياب w:sz (twips) */
  defaultEmTwips?: number;
  /** طول جملة التنبؤ للتسويغ — لا حاجة في v1 */
  /** دالة التقدم: (الفقرة الحالية، إجمالي الفقرات، رسالة) */
  onProgress?: (current: number, total: number, msg: string) => void;
  /** تُستدعى عند اكتمال كل صفحة — للعرض التدريجي */
  onPage?: (page: ScenePage, partial: SceneDocument) => void;
}

/** أسماء ألوان التظليل الشائعة (w:highlight) ⟵ RRGGBB */
export const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: "FFFF00", green: "00FF00", cyan: "00FFFF", magenta: "FF00FF",
  blue: "0000FF", red: "FF0000", darkBlue: "00008B", darkCyan: "008B8B",
  darkGreen: "006400", darkMagenta: "8B008B", darkRed: "8B0000",
  darkYellow: "BDB76B", darkGray: "A9A9A9", lightGray: "D3D3D3", black: "000000",
};

export function highlightHex(name: string): string | null {
  return HIGHLIGHT_COLORS[name] ?? null;
}
