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
}
export interface SectionGeometry {
  pageWTwips: number;
  pageHTwips: number;
  marLeftTwips: number;
  marRightTwips: number;
  /** عرض عمود المتن = العرض − الهامشان */
  columnTwips: number;
}
export interface DocumentModelV0 {
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
        if (ilvl == null || !ind) continue;
        const left = ind["@w:left"] != null ? Number(ind["@w:left"]) : null;
        const right = ind["@w:right"] != null ? Number(ind["@w:right"]) : null;
        const hanging = ind["@w:hanging"] != null ? Number(ind["@w:hanging"]) : null;
        const firstLine = ind["@w:firstLine"] != null ? Number(ind["@w:firstLine"]) : null;
        lvls.set(ilvl, {
          indLeft: left, indRight: right,
          indFirstLine: hanging != null ? -hanging : firstLine,
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

// ---------- الأنماط: styleId ← {sz, family, basedOn} + docDefaults
interface StyleProps {
  sz: number | null; family: string | null; basedOn: string | null;
  indLeft: number | null; indRight: number | null; indFirstLine: number | null;
  /** ‏w:jc من pPr النمط — يورَّث (درس tadris para87: فقرة jc=null ظاهريًا
   *  وسطرها مسوَّغ ممتلئ لأن نمطها يحمل التسويغ) */
  jc: string | null;
}
export interface StyleTable {
  defaults: { sz: number | null; family: string | null };
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

export function parseStyles(stylesXml: string | null): StyleTable {
  const table: StyleTable = { defaults: { sz: null, family: null }, byId: new Map() };
  if (!stylesXml) return table;
  const root = parser.parse(stylesXml) as XNode[];
  const styles = first(root, "w:styles");
  if (!styles) return table;

  const docDefaults = first(styles, "w:docDefaults");
  if (docDefaults) {
    const rprDefault = first(docDefaults, "w:rPrDefault");
    const rpr = rprDefault ? first(rprDefault, "w:rPr") : null;
    table.defaults = rPrProps(rpr);
  }
  for (const styleNode of styles) {
    if (!("w:style" in styleNode)) continue;
    const a = (styleNode[":@"] as Record<string, string>) ?? {};
    const id = a["@w:styleId"];
    if (!id) continue;
    const body = styleNode["w:style"] as XNode[];
    const rpr = first(body, "w:rPr");
    const basedOnAttrs = findAttr(body, "w:basedOn");
    const p = rPrProps(rpr);
    const stylePPr = first(body, "w:pPr");
    const ind = indProps(stylePPr);
    const jc = stylePPr ? (findAttr(stylePPr, "w:jc")?.["@w:val"] ?? null) : null;
    table.byId.set(id, { ...p, ...ind, jc, basedOn: basedOnAttrs?.["@w:val"] ?? null });
  }
  return table;
}

function resolveViaStyle(table: StyleTable, styleId: string | null) {
  let sz: number | null = null, family: string | null = null, jc: string | null = null;
  let indLeft: number | null = null, indRight: number | null = null, indFirstLine: number | null = null;
  let id = styleId, guard = 0;
  while (id && guard++ < 12) {
    const s = table.byId.get(id);
    if (!s) break;
    sz ??= s.sz; family ??= s.family; jc ??= s.jc;
    indLeft ??= s.indLeft; indRight ??= s.indRight; indFirstLine ??= s.indFirstLine;
    id = s.basedOn;
  }
  return {
    sz: sz ?? table.defaults.sz, family: family ?? table.defaults.family, jc,
    indLeft: indLeft ?? 0, indRight: indRight ?? 0, indFirstLine: indFirstLine ?? 0,
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
    pageWTwips: 11906, pageHTwips: 16838, marLeftTwips: 1440, marRightTwips: 1440, columnTwips: 9026,
  };
  function geomFrom(sectPr: XNode[] | null): SectionGeometry {
    if (!sectPr) return DEFAULT_GEO;
    const pgSz = findAttr(sectPr, "w:pgSz");
    const pgMar = findAttr(sectPr, "w:pgMar");
    const w = Number(pgSz?.["@w:w"] ?? DEFAULT_GEO.pageWTwips);
    const h = Number(pgSz?.["@w:h"] ?? DEFAULT_GEO.pageHTwips);
    const l = Number(pgMar?.["@w:left"] ?? DEFAULT_GEO.marLeftTwips);
    const r = Number(pgMar?.["@w:right"] ?? DEFAULT_GEO.marRightTwips);
    return { pageWTwips: w, pageHTwips: h, marLeftTwips: l, marRightTwips: r, columnTwips: w - l - r };
  }
  const sections: SectionGeometry[] = [];
  let pendingFrom = 0; // أول فقرة لم يُسند مقطعها بعد

  const paragraphs: BodyParagraph[] = [];
  let idx = 0;
  for (const child of body) {
    if (!("w:p" in child)) continue; // فقرات المستوى الأعلى فقط — الجداول تُقصى بنيويًا
    const p = child["w:p"] as XNode[];
    idx++;

    const pPr = first(p, "w:pPr");
    const styleId = pPr ? (findAttr(pPr, "w:pStyle")?.["@w:val"] ?? null) : null;
    const bidi = pPr ? findAttr(pPr, "w:bidi") != null : false;
    const styleProps = resolveViaStyle(styles, styleId);
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

    let excluded: BodyParagraph["excluded"] = false;
    const runs: EffectiveRun[] = [];
    for (const rNode of p) {
      if (!("w:r" in rNode)) {
        if ("w:fldSimple" in rNode || "w:hyperlink" in rNode) excluded = excluded || "field";
        continue;
      }
      const r = rNode["w:r"] as XNode[];
      const rpr = first(r, "w:rPr");
      const own = rPrProps(rpr);
      const hidden = rpr ? rpr.some((n) => "w:vanish" in n) : false;
      let text = "";
      for (const t of r) {
        if ("w:t" in t) {
          const parts = t["w:t"] as XNode[];
          for (const seg of parts) if ("#text" in seg) text += String(seg["#text"]);
        }
        // فاصل سطر يدوي (w:br بأنواعه) — يُمثَّل بـ\n: نقطة كسر إجبارية للكاسر
        if ("w:br" in t) text += "\n";
        // ‏w:sym: حرف بخط رمزي (ﷺ ونحوه بـAGA Arabesque) — قياسه الصادق يتطلب
        // تشكيلًا متعدد الخطوط؛ حتى حينه تُستبعد الفقرة (وإلا قِيس نصها أقصر
        // من الحقيقة وفسدت المحاذاة — درس sample-tadris para291).
        if ("w:sym" in t) excluded = excluded || "sym";
        if ("w:tab" in t) excluded = excluded || "tab";
        if ("w:drawing" in t || "w:pict" in t) excluded = excluded || "drawing";
        if ("w:fldChar" in t || "w:instrText" in t) excluded = excluded || "field";
      }
      if (!text) continue;
      runs.push({
        text,
        family: own.family ?? pPrRPr.family ?? styleProps.family,
        emTwips: (own.sz ?? pPrRPr.sz ?? styleProps.sz) != null
          ? (own.sz ?? pPrRPr.sz ?? styleProps.sz)! * 10
          : null,
        hidden,
      });
    }
    const text = runs.filter((r) => !r.hidden).map((r) => r.text).join("");
    if (!text.trim()) excluded = excluded || "empty";
    paragraphs.push({
      index: idx, runs, text, styleId, jc, bidi,
      indLeft, indRight, indFirstLine, excluded, sectionIndex: -1, numbered,
    });
    // ‏sectPr داخل pPr يختم مقطعًا: هندسته تسري على هذه الفقرة وما سبقها
    const pSect = pPr ? first(pPr, "w:sectPr") : null;
    if (pSect) {
      sections.push(geomFrom(pSect));
      for (let k = pendingFrom; k < paragraphs.length; k++)
        paragraphs[k]!.sectionIndex = sections.length - 1;
      pendingFrom = paragraphs.length;
    }
  }
  // ‏sectPr الـbody يختم المقطع الأخير (البقية كلها له)
  sections.push(geomFrom(first(body, "w:sectPr")));
  for (let k = pendingFrom; k < paragraphs.length; k++)
    paragraphs[k]!.sectionIndex = sections.length - 1;
  const section = sections[sections.length - 1]!;
  return { section, sections, paragraphs, compatibilityMode: 11 };
}

export function extractFromDocx(bytes: Uint8Array): DocumentModelV0 {
  const { documentXml, stylesXml, settingsXml, numberingXml } = openDocx(bytes);
  const model = parseDocument(documentXml, parseStyles(stylesXml), parseNumbering(numberingXml));
  model.compatibilityMode = compatibilityMode(settingsXml);
  return model;
}
