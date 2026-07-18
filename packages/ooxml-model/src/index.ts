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
import { XMLParser } from "fast-xml-parser";

// ---------- الأنواع
export interface EffectiveRun {
  text: string;
  family: string | null;
  /** حجم الخط بالـ twips ‏(w:sz أنصاف نقاط × 10) — شبكة ADR-0004 */
  emTwips: number | null;
  /** ‏w:vanish — نص مخفي لا يعرضه Word (تستخدمه علامات {{PG:N}} في خط التحضير) */
  hidden: boolean;
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
  /** توقّفات الجدولة المخصّصة (w:pPr/w:tabs/w:tab) — بالـtwips. */
  tabStops: TabStop[];
  /** صفُّ جدول محتوياتٍ (TOC): مدخلٌ / قائدٌ يتمدّد / رقمُ صفحة — من حصاد «الشاملة
   *  الذهبية». يُكتشَف بنمطٍ toc أو بتوقّفٍ يمينيٍّ ذي leader مع w:tab فعليّ في رنّ.
   *  حين يوجد، الفقرة **لا تُقصى** بل تُرسَم صفًّا ثلاثيًّا. */
  toc: TocRow | null;
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
  posHRel: string; posHOffset: number;
  posVRel: string; posVOffset: number;
  distL: number; distR: number; distT: number; distB: number;
  /** ‏Square / Tight / Through / TopAndBottom / None */
  wrap: string;
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
}

// ---------- أدوات XML
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  preserveOrder: true,
  trimValues: false,
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

function findAttr(parent: XNode[], name: string): Record<string, string> | null {
  for (const n of parent) if (name in n) return ((n[":@"] as Record<string, string>) ?? {});
  return null;
}

// ---------- فتح الأرشيف
export function openDocx(bytes: Uint8Array): {
  documentXml: string; stylesXml: string | null; settingsXml: string | null;
  numberingXml: string | null;
} {
  const files = unzipSync(bytes);
  const dec = new TextDecoder("utf-8");
  const doc = files["word/document.xml"];
  if (!doc) throw new Error("word/document.xml غير موجود");
  const styles = files["word/styles.xml"];
  const settings = files["word/settings.xml"];
  const numbering = files["word/numbering.xml"];
  return {
    documentXml: dec.decode(doc),
    stylesXml: styles ? dec.decode(styles) : null,
    settingsXml: settings ? dec.decode(settings) : null,
    numberingXml: numbering ? dec.decode(numbering) : null,
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

function rPrProps(rpr: XNode[] | null): { sz: number | null; family: string | null } {
  if (!rpr) return { sz: null, family: null };
  let sz: number | null = null;
  let family: string | null = null;
  for (const n of rpr) {
    const a = (n[":@"] as Record<string, string>) ?? {};
    // ‏szCs للنص المركّب (العربية) مقدَّم عند وجوده — سلوك المحرك المرجعي (RPr.dart)
    if ("w:szCs" in n && a["@w:val"]) sz = Number(a["@w:val"]);
    else if ("w:sz" in n && sz == null && a["@w:val"]) sz = Number(a["@w:val"]);
    if ("w:rFonts" in n) family = a["@w:cs"] ?? a["@w:ascii"] ?? a["@w:hAnsi"] ?? family;
  }
  return { sz, family };
}

const NO_SPACING: SpacingProps = { present: false, line: null, lineRule: null, before: null, after: null };

export function parseStyles(stylesXml: string | null): StyleTable {
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
      basedOn: basedOnAttrs?.["@w:val"] ?? null,
    });
  }
  return table;
}

function resolveViaStyle(table: StyleTable, styleId: string | null) {
  let sz: number | null = null, family: string | null = null, jc: string | null = null;
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
    spacing: sp,
  };
}

// ---------- المستند
export function parseDocument(
  documentXml: string, styles: StyleTable,
  numbering: NumberingTable = new Map(),
): DocumentModelV0 {
  const root = parser.parse(documentXml) as XNode[];
  const doc = first(root, "w:document");
  const body = doc ? first(doc, "w:body") : null;
  if (!body) throw new Error("w:body غير موجود");

  const DEFAULT_GEO: SectionGeometry = {
    pageWTwips: 11906, pageHTwips: 16838, marLeftTwips: 1440, marRightTwips: 1440,
    marTopTwips: 1440, marBottomTwips: 1440, columnTwips: 9026,
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
    return { pageWTwips: w, pageHTwips: h, marLeftTwips: l, marRightTwips: r,
      marTopTwips: t, marBottomTwips: b, columnTwips: w - l - r };
  }
  const sections: SectionGeometry[] = [];
  let pendingFrom = 0; // أول فقرة لم يُسند مقطعها بعد

  const paragraphs: BodyParagraph[] = [];
  let idx = 0;
  // كسرُ الصفحة المعلَّق: يُنقَل من فقرةٍ حاملةٍ للكسر (أو حدِّ مقطع) إلى الفقرة
  // المرصَّفة التالية. الفقرات غير المرصَّفة (فارغة/صور) لا تستهلكه بل تُمرِّره. generic.
  let pendingBreak = false;
  for (const child of body) {
    if (!("w:p" in child)) continue; // فقرات المستوى الأعلى فقط — الجداول تُقصى بنيويًا
    const p = child["w:p"] as XNode[];
    idx++;

    const pPr = first(p, "w:pPr");
    const styleId = pPr ? (findAttr(pPr, "w:pStyle")?.["@w:val"] ?? null) : null;
    const bidi = pPr ? findAttr(pPr, "w:bidi") != null : false;
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
    const pPrRPr = pPr ? rPrProps(first(pPr, "w:rPr")) : { sz: null, family: null };
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
    const tabTextPositions: number[] = []; // مواضع w:tab في نصّ الفقرة (لتقسيم TOC)
    let paraTextLen = 0; // طول نصّ الفقرة المتراكم عبر الرنّات (لموضع w:tab الصحيح)
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
          else text += "\n";
        }
        // ‏w:sym: حرفٌ بخطٍّ رمزيّ (ﷺ/زخارف AGA) — يُحلّ لمحرفٍ فعليّ (إزاحة PUA)
        // ويُضاف للنصّ بخطّه الرمزيّ (لا يُقصى بعد اليوم؛ حصاد «الشاملة الذهبية»).
        // الخطّ الرمزيّ متوفّرٌ في subset-metrics فيُشكَّل بعرضه الصحيح.
        if ("w:sym" in t) {
          const a = (t[":@"] as Record<string, string> | undefined) ?? {};
          const ch = resolveSymChar(a["@w:font"], a["@w:char"]);
          if (ch) { text += ch; symFont = a["@w:font"] ?? null; sawText = true; }
        }
        // ‏w:tab: نسجّل موضعه في النصّ (لتقسيم صفّ TOC لاحقًا). الإقصاء يُحسَم بعد
        // الحلقة: صفوف الفهرس تُرصَّف، وبقيّة w:tab تُقصى (excluded=tab) مؤقّتًا.
        if ("w:tab" in t) tabTextPositions.push(paraTextLen + text.length);
        if ("w:drawing" in t || "w:pict" in t) excluded = excluded || "drawing";
        // العائمات: هندسة wp:anchor (الامتداد والموضع والالتفاف) بالـ twips
        if ("w:drawing" in t) {
          const EMU = 635;
          for (const { node: anc, attrs: a } of collectDeep(t["w:drawing"] as XNode[], "wp:anchor")) {
            const ext = collectDeep(anc, "wp:extent")[0]?.attrs;
            const posH = collectDeep(anc, "wp:positionH")[0];
            const posV = collectDeep(anc, "wp:positionV")[0];
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
              extentW: ext ? Math.round(Number(ext["@cx"]) / EMU) : 0,
              extentH: ext ? Math.round(Number(ext["@cy"]) / EMU) : 0,
              posHRel: posH?.attrs["@relativeFrom"] ?? "column",
              posHOffset: off(posH),
              posVRel: posV?.attrs["@relativeFrom"] ?? "paragraph",
              posVOffset: off(posV),
              distL: Math.round(Number(a["@distL"] ?? 0) / EMU),
              distR: Math.round(Number(a["@distR"] ?? 0) / EMU),
              distT: Math.round(Number(a["@distT"] ?? 0) / EMU),
              distB: Math.round(Number(a["@distB"] ?? 0) / EMU),
              wrap: wrap.replace("wp:wrap", ""),
            });
          }
        }
        if ("w:fldChar" in t || "w:instrText" in t) excluded = excluded || "field";
      }
      if (!hidden) paraTextLen += text.length; // يوافق نصّ الفقرة (المرئيّ) لموضع w:tab
      if (!text) continue;
      runs.push({
        text,
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
    const tabStops = parseTabStops(pPr);
    const rightLeaderTab = tabStops.find(
      (t) => (t.val === "right" || t.val === "end") && t.leader && t.leader !== "none");
    const isTocStyle = /^toc/i.test(styleId ?? "");
    let toc: TocRow | null = null;
    if (tabTextPositions.length && (rightLeaderTab || isTocStyle) && text.trim()) {
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
    // بقيّة w:tab (لا فهرس): إقصاءٌ مؤقّت حتى نُعمّم التوقّفات المطلقة
    else if (tabTextPositions.length) excluded = excluded || "tab";
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
    if (excluded) {
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
      spacing, markEmTwips, markAsciiFamily, pageBreakBefore, widowControl, tabStops, toc,
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
  return { section, sections, paragraphs, compatibilityMode: 11, defaultTabStop: 720 };
}

export function extractFromDocx(bytes: Uint8Array): DocumentModelV0 {
  const { documentXml, stylesXml, settingsXml, numberingXml } = openDocx(bytes);
  const model = parseDocument(documentXml, parseStyles(stylesXml), parseNumbering(numberingXml));
  model.compatibilityMode = compatibilityMode(settingsXml);
  model.defaultTabStop = defaultTabStop(settingsXml);
  return model;
}
