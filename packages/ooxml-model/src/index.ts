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
  excluded: false | "table" | "drawing" | "field" | "tab" | "empty";
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
  section: SectionGeometry;
  paragraphs: BodyParagraph[];
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
export function openDocx(bytes: Uint8Array): { documentXml: string; stylesXml: string | null } {
  const files = unzipSync(bytes);
  const dec = new TextDecoder("utf-8");
  const doc = files["word/document.xml"];
  if (!doc) throw new Error("word/document.xml غير موجود");
  const styles = files["word/styles.xml"];
  return { documentXml: dec.decode(doc), stylesXml: styles ? dec.decode(styles) : null };
}

// ---------- الأنماط: styleId ← {sz, family, basedOn} + docDefaults
interface StyleProps {
  sz: number | null; family: string | null; basedOn: string | null;
  indLeft: number | null; indRight: number | null; indFirstLine: number | null;
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
    const ind = indProps(first(body, "w:pPr"));
    table.byId.set(id, { ...p, ...ind, basedOn: basedOnAttrs?.["@w:val"] ?? null });
  }
  return table;
}

function resolveViaStyle(table: StyleTable, styleId: string | null) {
  let sz: number | null = null, family: string | null = null;
  let indLeft: number | null = null, indRight: number | null = null, indFirstLine: number | null = null;
  let id = styleId, guard = 0;
  while (id && guard++ < 12) {
    const s = table.byId.get(id);
    if (!s) break;
    sz ??= s.sz; family ??= s.family;
    indLeft ??= s.indLeft; indRight ??= s.indRight; indFirstLine ??= s.indFirstLine;
    id = s.basedOn;
  }
  return {
    sz: sz ?? table.defaults.sz, family: family ?? table.defaults.family,
    indLeft: indLeft ?? 0, indRight: indRight ?? 0, indFirstLine: indFirstLine ?? 0,
  };
}

// ---------- المستند
export function parseDocument(documentXml: string, styles: StyleTable): DocumentModelV0 {
  const root = parser.parse(documentXml) as XNode[];
  const doc = first(root, "w:document");
  const body = doc ? first(doc, "w:body") : null;
  if (!body) throw new Error("w:body غير موجود");

  // ‏sectPr الأخير على مستوى الـ body
  let section: SectionGeometry = {
    pageWTwips: 11906, pageHTwips: 16838, marLeftTwips: 1440, marRightTwips: 1440, columnTwips: 9026,
  };
  const sectPr = first(body, "w:sectPr");
  if (sectPr) {
    const pgSz = findAttr(sectPr, "w:pgSz");
    const pgMar = findAttr(sectPr, "w:pgMar");
    const w = Number(pgSz?.["@w:w"] ?? section.pageWTwips);
    const h = Number(pgSz?.["@w:h"] ?? section.pageHTwips);
    const l = Number(pgMar?.["@w:left"] ?? section.marLeftTwips);
    const r = Number(pgMar?.["@w:right"] ?? section.marRightTwips);
    section = { pageWTwips: w, pageHTwips: h, marLeftTwips: l, marRightTwips: r, columnTwips: w - l - r };
  }

  const paragraphs: BodyParagraph[] = [];
  let idx = 0;
  for (const child of body) {
    if (!("w:p" in child)) continue; // فقرات المستوى الأعلى فقط — الجداول تُقصى بنيويًا
    const p = child["w:p"] as XNode[];
    idx++;

    const pPr = first(p, "w:pPr");
    const styleId = pPr ? (findAttr(pPr, "w:pStyle")?.["@w:val"] ?? null) : null;
    const jc = pPr ? (findAttr(pPr, "w:jc")?.["@w:val"] ?? null) : null;
    const bidi = pPr ? findAttr(pPr, "w:bidi") != null : false;
    const styleProps = resolveViaStyle(styles, styleId);
    // ‏w:ind: المباشر على الفقرة يتقدم؛ وإلا فمن سلسلة النمط (نفس قاعدة rPr)
    const own = indProps(pPr);
    const indLeft = own.indLeft ?? styleProps.indLeft;
    const indRight = own.indRight ?? styleProps.indRight;
    const indFirstLine = own.indFirstLine ?? styleProps.indFirstLine;
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
      indLeft, indRight, indFirstLine, excluded,
    });
  }
  return { section, paragraphs };
}

export function extractFromDocx(bytes: Uint8Array): DocumentModelV0 {
  const { documentXml, stylesXml } = openDocx(bytes);
  return parseDocument(documentXml, parseStyles(stylesXml));
}
