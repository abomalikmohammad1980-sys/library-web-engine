#!/usr/bin/env node
/** مُركِّب PoC: يحسب ترصيف الصفحة بـ**محرّكنا وحده** (لا Word):
 *  breakLines (كسرنا) + قواعدنا العموديّة + تشكيل HarfBuzz لكلّ كلمة (bidi تلقائيّ) + تسويغنا.
 *  يُخرج مواقع المحارف المطلقة {gid,x,y,em} ليرسمها render_ours.py ونقارنها بـWord.
 *  الاستخدام: node layout_ours.mjs [out.json]  (muqtarah) */
import { readFileSync, writeFileSync } from "node:fs";
import { Blob, Buffer as HbBuffer, Face, Font, shape } from "harfbuzzjs";
import { extractFromDocx } from "../../../packages/ooxml-model/dist/index.js";
import { breakLines, pageStartAscent, singlePitch, lineMultiplier, numTabTextStart } from "../../../packages/layout/dist/index.js";
import { unzipSync, strFromU8 } from "../../../node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/browser.js";

// ── قراءة الترقيم (numbering.xml + numPr من document.xml) ──
const ARA_ALPHA = "أبتثجحخدذرزسشصضطظعغفقكلمنهوي".split("");
// ترتيب الأبجد (يختلف عن الألفبائيّ): أبجد هوز حطي كلمن سعفص قرشت ثخذ ضظغ
const ARA_ABJAD = "أبجدهوزحطيكلمنسعفصقرشتثخذضظغ".split("");
const LATIN = "abcdefghijklmnopqrstuvwxyz";
const ROMAN = [[1000,"m"],[900,"cm"],[500,"d"],[400,"cd"],[100,"c"],[90,"xc"],[50,"l"],[40,"xl"],[10,"x"],[9,"ix"],[5,"v"],[4,"iv"],[1,"i"]];
function toRoman(n){ if(n<1||n>3999) return String(n); let r=""; for(const [v,sy] of ROMAN){ while(n>=v){ r+=sy; n-=v; } } return r; }
// تحويل عدّادٍ إلى نصّ العلامة حسب numFmt (حصاد «الشاملة الذهبية»، مُصحَّحًا)
function formatNum(n, fmt){
  switch(fmt){
    case "decimal": return String(n);
    case "decimalZero": return n<10 ? "0"+n : String(n);
    case "lowerLetter": return LATIN[(n-1)%26]||String(n);
    case "upperLetter": return (LATIN[(n-1)%26]||"").toUpperCase()||String(n);
    case "lowerRoman": return toRoman(n);
    case "upperRoman": return toRoman(n).toUpperCase();
    case "arabicAlpha": return ARA_ALPHA[n-1]||String(n);
    case "arabicAbjad": return ARA_ABJAD[n-1]||String(n);
    case "none": return "";
    default: return String(n);
  }
}
function loadNumbering(docxPath) {
  const zip = unzipSync(readFileSync(docxPath));
  const num = zip["word/numbering.xml"] ? strFromU8(zip["word/numbering.xml"]) : "";
  const doc = strFromU8(zip["word/document.xml"]);
  // abstractNum → مستويات {fmt, text}
  const abs = {};
  for (const a of num.matchAll(/<w:abstractNum[^>]*w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g)) {
    const id = a[1]; abs[id] = {};
    for (const l of a[2].matchAll(/<w:lvl[^>]*w:ilvl="(\d+)"[^>]*>([\s\S]*?)<\/w:lvl>/g)) {
      const fmt = (l[2].match(/<w:numFmt[^>]*w:val="([^"]+)"/) || [])[1] || "decimal";
      const text = (l[2].match(/<w:lvlText[^>]*w:val="([^"]*)"/) || [])[1] || "%1.";
      const start = +((l[2].match(/<w:start[^>]*w:val="(-?\d+)"/) || [])[1] ?? "1");
      abs[id][l[1]] = { fmt, text, start };
    }
  }
  // num → abstractNumId
  const numToAbs = {};
  for (const n of num.matchAll(/<w:num[^>]*w:numId="(\d+)"[^>]*>([\s\S]*?)<\/w:num>/g))
    numToAbs[n[1]] = (n[2].match(/<w:abstractNumId[^>]*w:val="(\d+)"/) || [])[1];
  // نصّ الفقرة (مطبَّع) → {numId, ilvl}
  const norm = (s) => s.replace(/<[^>]+>/g, "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/\s+/g, "").slice(0, 30);
  const byText = new Map();
  for (const p of doc.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)) {
    const numPr = p[1].match(/<w:numPr>([\s\S]*?)<\/w:numPr>/);
    if (!numPr) continue;
    const ilvl = (numPr[1].match(/<w:ilvl[^>]*w:val="(\d+)"/) || [])[1] || "0";
    const numId = (numPr[1].match(/<w:numId[^>]*w:val="(\d+)"/) || [])[1];
    const txt = norm([...p[1].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join(""));
    if (numId && txt) byText.set(txt, { numId, ilvl: +ilvl });
  }
  return { abs, numToAbs, byText,
    norm: (s) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/\s+/g, "").slice(0, 30) };
}
// ── قراءة contextualSpacing (من الأنماط + الفقرات المباشرة) — generic ──
function loadContextual(docxPath) {
  const zip = unzipSync(readFileSync(docxPath));
  const styles = zip["word/styles.xml"] ? strFromU8(zip["word/styles.xml"]) : "";
  const doc = strFromU8(zip["word/document.xml"]);
  // أنماطٌ فيها w:contextualSpacing
  const styleSet = new Set();
  for (const s of styles.matchAll(/<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/g))
    if (/<w:contextualSpacing(\s|\/|>)/.test(s[2]) && !/w:val="(0|false)"/.test((s[2].match(/<w:contextualSpacing[^>]*>/) || [""])[0])) styleSet.add(s[1]);
  // فقراتٌ فيها contextualSpacing مباشرةً (بالنصّ المطبَّع)
  const norm = (t) => t.replace(/<[^>]+>/g, "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/\s+/g, "").slice(0, 30);
  const byText = new Set();
  for (const p of doc.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)) {
    const pPr = (p[1].match(/<w:pPr>([\s\S]*?)<\/w:pPr>/) || [])[1] || "";
    if (/<w:contextualSpacing(\s|\/|>)/.test(pPr) && !/<w:contextualSpacing[^>]*w:val="(0|false)"/.test(pPr)) {
      const txt = norm([...p[1].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join(""));
      if (txt) byText.add(txt);
    }
  }
  return { styleSet, byText, norm: (s) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/\s+/g, "").slice(0, 30) };
}
// ── حدود أنماط الجداول (styles.xml → tblBorders) — حصاد «الشاملة الذهبية» ──
// عرض الحدّ: w:sz بوحدة 1/8 نقطة → twips = (sz/8)*20، مقيَّدًا [10,60] twips.
function loadTableBorders(docxPath) {
  const zip = unzipSync(readFileSync(docxPath));
  const styles = zip["word/styles.xml"] ? strFromU8(zip["word/styles.xml"]) : "";
  const byStyle = {};
  for (const st of styles.matchAll(/<w:style[^>]*w:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/g)) {
    const tb = st[2].match(/<w:tblBorders>([\s\S]*?)<\/w:tblBorders>/);
    if (!tb) continue;
    const side = (nm) => {
      const m = tb[1].match(new RegExp("<w:" + nm + "[ /][^>]*>"));
      if (!m || /w:val="(none|nil)"/.test(m[0])) return null;
      const sz = Number((m[0].match(/w:sz="(\d+)"/) || [])[1] || 4);
      const col = (m[0].match(/w:color="([^"]+)"/) || [])[1] || "auto";
      return { w: Math.min(60, Math.max(10, Math.round((sz / 8) * 20))), color: col === "auto" ? "000000" : col };
    };
    byStyle[st[1]] = { top: side("top"), bottom: side("bottom"), left: side("left"),
      right: side("right"), insideH: side("insideH"), insideV: side("insideV") };
  }
  return byStyle;
}
// ── استخراج مقاطع (runs) كلّ فقرة بخصائصها (generic، آليّة B) ──
// ارتفاع السطر = max عبر مقاطعه الفعليّة (بولد/حجم/خطّ). نبني، لكلّ فقرة، مصفوفةً
// من المقاطع {len, bold, sz} بترتيبها — فنُسقِطها على مدى أحرف كلّ سطر لاحقًا.
function loadRuns(docxPath) {
  const zip = unzipSync(readFileSync(docxPath));
  const doc = strFromU8(zip["word/document.xml"]);
  const normKey = (t) => t.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[ـ\s]/g, "").slice(0, 40);
  const byPara = new Map();
  for (const p of doc.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)) {
    const runs = [];
    for (const r of p[1].matchAll(/<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g)) {
      const rPr = (r[1].match(/<w:rPr>([\s\S]*?)<\/w:rPr>/) || [])[1] || "";
      const bold = (/<w:b(\s|\/|>)/.test(rPr) && !/<w:b[^>]*w:val="(0|false)"/.test(rPr))
        || (/<w:bCs(\s|\/|>)/.test(rPr) && !/<w:bCs[^>]*w:val="(0|false)"/.test(rPr));
      const szCs = (rPr.match(/<w:szCs[^>]*w:val="(\d+)"/) || rPr.match(/<w:sz[^>]*w:val="(\d+)"/) || [])[1];
      const fam = (rPr.match(/<w:rFonts[^>]*w:cs="([^"]*)"/) || rPr.match(/<w:rFonts[^>]*w:ascii="([^"]*)"/) || [])[1] || null;
      const txt = [...r[1].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join("");
      if (txt) runs.push({ text: txt, bold, sz: szCs ? +szCs * 10 : null, fam });
    }
    const key = normKey(runs.map((r) => r.text).join(""));
    if (key && runs.length) byPara.set(key, runs);
  }
  return { byPara, key: normKey };
}
/** مقاييس كلّ كلمة (بولد/حجم) بالمشي عبر مقاطع الفقرة — يوازي words الناتجة من
 *  p.text.split(/\s+/). الكلمة الممتدّة عبر مقاطع تأخذ أطولها (أقصى pitch). */
function paraWordMeta(paraRuns) {
  const meta = []; let cur = null;
  const push = () => { if (cur) { meta.push(cur); cur = null; } };
  for (const r of paraRuns) {
    for (const ch of r.text) {
      if (/\s/.test(ch)) { push(); continue; }
      if (!cur) cur = { bold: false, sz: null, fam: null };
      cur.bold = cur.bold || r.bold;
      if (r.sz && (!cur.sz || r.sz > cur.sz)) cur.sz = r.sz;
      if (r.fam && !cur.fam) cur.fam = r.fam;
    }
  }
  push();
  return meta;
}
function markerText(numbering, numId, ilvl, counters) {
  const absId = numbering.numToAbs[numId]; const lvl = numbering.abs[absId]?.[ilvl];
  if (!lvl) return null;
  // عدّاد هذا المستوى: يبدأ من start، ويتقدّم؛ ثمّ تُصفَّر المستويات الأعمق (قاعدة Word)
  const key = `${numId}:${ilvl}`;
  if (counters[key] == null) counters[key] = (lvl.start ?? 1) - 1;
  counters[key]++;
  for (const k of Object.keys(counters)) { const [n, l] = k.split(":"); if (n === numId && +l > ilvl) delete counters[k]; }
  // كلّ %N في lvlText يُستبدَل بعدّاد المستوى (N-1) منسَّقًا بـnumFmt الخاصّ به (هرميّ صحيح)
  return lvl.text.replace(/%(\d+)/g, (_, d) => {
    const li = +d - 1; const lc = numbering.abs[absId]?.[li];
    const cnt = counters[`${numId}:${li}`] ?? (lc?.start ?? 1);
    return formatNum(cnt, lc?.fmt || "decimal");
  });
}

const BOOK = process.env.BOOK || "sample-muqtarah";
const OUT = process.argv[2] || "ours.json";
const bookMap = JSON.parse(readFileSync("tools/word-oracle/book-fonts-map.json", "utf-8"));
const metrics = JSON.parse(readFileSync("tools/word-oracle/render/font-metrics.json", "utf-8"));
// دمج مقاييس الـsubset المُضمَّن لهذا الكتاب (الخطّ الذي استعمله Word فعلًا) — generic:
// أيّ عائلةٍ (حتى النادرة) تُحلّ بمقاييسها الصحيحة. لا يدوس البولد العالميّ (family|bold).
try { const sm = JSON.parse(readFileSync(`tools/word-oracle/render/subset-metrics-${BOOK}.json`, "utf-8"));
  for (const [k, v] of Object.entries(sm)) if (!metrics[k]) metrics[k] = v; } catch { /**/ } // إضافةٌ فقط (لا دوس)
const cfg = bookMap[BOOK];
const MAIN_FAMILY = cfg.family;
const MAIN_FILE = cfg.horizFont;
const PS_CAL = (() => { try { return JSON.parse(readFileSync("tools/word-oracle/pagestart-cal.json", "utf-8"))[MAIN_FAMILY]; } catch { return null; } })();

const model = extractFromDocx(readFileSync(`corpus/books/${BOOK}.docx`));
const numbering = loadNumbering(`corpus/books/${BOOK}.docx`);
const contextual = loadContextual(`corpus/books/${BOOK}.docx`);
const tableBorders = loadTableBorders(`corpus/books/${BOOK}.docx`);
const tableCells = []; // مستطيلات خلايا الجداول {page,x,y,w,h,fill,bw,bc}
const hasContextual = (p) => contextual.byText.has(contextual.norm(p.text)) || contextual.styleSet.has(p.styleId);
// ضبط الأرملة/اليتيم مُفعَّلٌ ما لم يُعطَّل صراحةً (widowControl=false في النموذج)
const widowCtl = (p) => p.widowControl !== false;
const runsByPara = loadRuns(`corpus/books/${BOOK}.docx`);
const counters = {};

// ── تعدّد الخطوط (generic): ذاكرةُ خطوطٍ لكلّ عائلة، مع احتياطيٍّ لخطّ المتن ──
const fontCache = new Map();
function getFont(family) {
  const key = family || MAIN_FAMILY;
  if (fontCache.has(key)) return fontCache.get(key);
  const meta = metrics[key];
  const file = (meta && meta.file) || MAIN_FILE;
  let obj;
  try {
    const face = new Face(new Blob(readFileSync(file)), 0);
    obj = { font: new Font(face), upem: face.upem, file, met: meta || metrics[MAIN_FAMILY] };
  } catch { obj = getFont(MAIN_FAMILY); }
  fontCache.set(key, obj); return obj;
}

// قاعدة الخطوط المختلطة: هبوطُ الخطّ الاحتياطيّ للعربيّة (Sakkal Majalla في Windows).
// إن غاب من المقاييس نأخذ قيمته المعروفة (0.5127em @upem2048).
const FALLBACK_WD = (metrics["Sakkal Majalla"]?.wd) ?? 0.5127;
// تغطية الخطّ لمحرفٍ (nominalGlyph≠0) — مُخزَّنة. false = غير مُغطًّى (يسقط للاحتياط).
const coverCache = new Map();
function fontCovers(family, cp) {
  const k = family + " " + cp;
  const c = coverCache.get(k);
  if (c !== undefined) return c;
  let ok = true;
  try { ok = getFont(family).font.nominalGlyph(cp) !== 0; } catch { ok = true; }
  coverCache.set(k, ok); return ok;
}

/** يشكّل كلمةً مفردة (guessSegmentProperties يكتشف الاتّجاه: أرقام LTR، عربيّة RTL).
 *  HarfBuzz يُخرج المحارف دومًا بترتيبٍ بصريّ يسار→يمين مهما كان الاتّجاه. */
function shapeWord(w, em, fo) {
  const b = new HbBuffer(); b.addText(w); b.guessSegmentProperties(); shape(fo.font, b, []);
  const infos = b.getGlyphInfos(), poss = b.getGlyphPositions();
  const glyphs = infos.map((g, i) => ({ gid: g.codepoint, adv: (poss[i].xAdvance / fo.upem) * em }));
  return { glyphs, width: glyphs.reduce((a, g) => a + g.adv, 0) };
}
/** عرضُ كلّ كلمةٍ من **تشكيل النصّ الكامل سياقيًّا** (كـbreak_lines، أدقّ من المعزول
 *  بـ34٪ على dawra). يشكّل words.join(" ") ويوزّع تقدّم كلّ عنقودٍ على مرساه (cluster).
 *  يرجع {wordW[], spaceW} — للكسر فقط (الرسم يبقى per-word للـbidi البصريّ الصحيح). */
function contextualWidths(words, em, fo) {
  const fullText = words.join(" ");
  const b = new HbBuffer(); b.addText(fullText); b.guessSegmentProperties(); shape(fo.font, b, []);
  const infos = b.getGlyphInfos(), poss = b.getGlyphPositions();
  const advAt = new Float64Array(fullText.length + 1);
  for (let g = 0; g < infos.length; g++) advAt[infos[g].cluster] += (poss[g].xAdvance / fo.upem) * em;
  const prefix = new Float64Array(fullText.length + 1);
  for (let c = 0; c < fullText.length; c++) prefix[c + 1] = prefix[c] + advAt[c];
  const wordW = []; let cur = 0;
  for (const w of words) {
    const s = fullText.indexOf(w, cur), e = s + w.length;
    wordW.push(prefix[e] - prefix[s]); cur = e;
  }
  const spaceW = words.length > 1 ? (prefix[words[0].length + 1] - prefix[words[0].length]) : shapeWord(" ", em, fo).width;
  return { wordW, spaceW };
}
// em الجهاز (generic، من تفكيك MSLS70): Word يقرّب حجم الخطّ لبكسل الجهاز أوّلًا
// (ppem = round(pt·dpi/72))، ثم يشتقّ كلّ المقاييس العموديّة منه. عند 600dpi:
// emDev = round(emTw·600/1440)·2.4. يفسّر انجراف ~1tw/سطر (20pt → 400.8tw لا 400).
const DPI = Number(process.env.DPI ?? "600");
const emDevice = (emTw) => Math.round((emTw * DPI) / 1440) * (1440 / DPI);
const pitchV = (met, emTw, sp) => (met.a + met.d + met.g) * emDevice(emTw) * lineMultiplier(sp);

const paras = model.paragraphs.filter((p) => (!p.excluded && (p.text.trim() || p.inlineImageHTwips > 0) && (p.runs[0]?.emTwips || p.inlineImageHTwips > 0)) || (p.anchors?.length > 0));
const imgAnchors = []; // صورٌ عائمة: {page,x,y,w,h,rId} — تُرسَم طبقةً على الصفحة
const bodySecIdx = (paras.find((p) => p.runs[0]?.family === MAIN_FAMILY) ?? paras[0])?.sectionIndex ?? 0;
const sec = model.sections?.[bodySecIdx] ?? model.section ?? model.sections[0];
const { pageWTwips: pageW, pageHTwips: pageH, marRightTwips: marR, marTopTwips: marT, marBottomTwips: marB } = sec;

const pages = [[]]; let cur = 0;
const fo0 = getFont(paras[0].runs[0]?.family || MAIN_FAMILY);
let baseline = marT + pageStartAscent(fo0.met, paras[0].runs[0]?.emTwips || 200, paras[0].spacing, PS_CAL);
let prev = null, prevDesc = null, pendingGap = 0, pageAnchor = baseline;
let curTable = null; // {id,row,startBaseline,maxBottom} — التخطيط الشبكيّ للجداول
// آليّة B (max عبر المقاطع): صندوق السطر — صعودٌ وهبوطٌ يأخذان أقصى مقطعٍ فيه
// (بولد أطول). الخطوة = هبوط السابق + صعود الحاليّ (BOX=0 للعودة للـpitch الثابت).
const BOX = process.env.BOX !== "0";
const lineBoxAscDesc = (met, boldMet, em, hasBold, sizeEm) => {
  // max عبر المقاطع: عاديّ@em، بولد@em، عاديّ@sizeEm، بولد@sizeEm (أيّها موجود)
  let asc = met.a * em, dg = (met.d + met.g) * em;
  const consider = (m, e) => { asc = Math.max(asc, m.a * e); dg = Math.max(dg, (m.d + m.g) * e); };
  if (hasBold && boldMet) consider(boldMet, em);
  if (sizeEm && sizeEm > em) { consider(met, sizeEm); if (hasBold && boldMet) consider(boldMet, sizeEm); }
  // QPITCH: تقريب ارتفاع السطر (asc+desc) لنقطة الجهاز 2.4tw (نمط Word المقيس 597.6=249
  // نقطة، مقابل 597.85 الأملس)؛ يقسم التقريب على asc/desc نسبةً. QPITCH=1 للتفعيل.
  if (process.env.QPITCH === "1") {
    const h = asc + dg, hq = Math.round(h / 2.4) * 2.4, f = h ? hq / h : 1;
    asc *= f; dg *= f;
  }
  return { asc, desc: dg };
};

// يختم ارتفاعات خلايا الصفّ عند انتهائه (أطول خليّة تحدّد ارتفاع الصفّ)
// يختم هندسة الصفّ: أعلاه = أعلى أوّل سطرٍ فعليّ عبر خلاياه (baseline − ascent)، وأسفله =
// أسفل أطول خليّة (baseline + descent). هوامش الخليّة الرأسيّة صفرٌ في Word (لا حشوَ مصطنعًا).
function finishRow(t) {
  if (!t) return;
  const top = t.rowTop != null ? t.rowTop : t.startBaseline;
  const bottom = Math.max(t.maxBottom, top + 1);
  for (const c of t.cells) { c.y = top; c.h = bottom - top; }
}
for (let pi = 0; pi < paras.length; pi++) {
  const p = paras[pi]; const em = p.runs[0]?.emTwips || 200; // احتياطٌ لفقرة صورةٍ خالصة
  const fo = getFont(p.runs[0]?.family || MAIN_FAMILY); const MET = fo.met;
  const MAIN_WD = MET.wd ?? (MET.d + MET.g); // هبوط winDescent للخطّ الرئيس (قاعدة المختلطة)
  const cal = (p.runs[0]?.family || MAIN_FAMILY) === MAIN_FAMILY ? PS_CAL : null;
  const wordWidth = (w) => shapeWord(w, em, fo).width;
  let colBase = sec.columnTwips - p.indLeft - p.indRight;
  let rightEdge = pageW - marR;
  // هامشُ الخليّة الأفقيّ الافتراضيّ في Word: start/end = 108tw (الرأسيّ صفر)
  const CELL_MAR = Number(process.env.CELLMAR ?? "108");
  let cellOuterRight = 0, cellW = 0;
  if (p.tableCell) {
    const tc = p.tableCell;
    // معامل قياس الجدول (حصاد §1.2): الهدفُ من w:tblW (pct مقياسه **5000 = 100٪**، أو dxa)
    // مقصورًا على العرض المتاح؛ وإن غاب الهدف يُضغَط الجدولُ الطبيعيّ إن تجاوز المتاح.
    // بدونه كانت أعمدةُ muqtarah أعرضَ من المتاح بـ~55٪ (grid 13948 مقابل متاح 9026).
    // العرضُ المتاح من **مقطع الفقرة نفسها** لا مقطع المتن (muqtarah: جدولٌ في مقطعٍ
    // عرضيّ 13958 بينما المتن عموديّ 8306 — القياس بمقطع المتن كان يضغطه 40٪ خطأً).
    const usable = (model.sections[p.sectionIndex] ?? sec).columnTwips;
    const target = tc.tblWType === "pct" ? usable * (tc.tblWVal / 5000)
      : tc.tblWType === "dxa" ? tc.tblWVal : null;
    const finalW = target != null ? Math.min(target, usable) : Math.min(tc.totalGridTwips, usable);
    const sf = tc.totalGridTwips > 0 ? finalW / tc.totalGridTwips : 1;
    cellW = tc.colWTwips * sf;
    cellOuterRight = (pageW - marR) - tc.colXTwips * sf; // حافّة الخليّة (للمستطيل)
    rightEdge = cellOuterRight - CELL_MAR;               // بداية النصّ بعد الهامش
    colBase = Math.max(200, cellW - 2 * CELL_MAR - p.indLeft - p.indRight);
  }
  const spaceW = wordWidth(" ", em) || wordWidth(" ", em);
  const words = p.text.trim().split(/\s+/).filter(Boolean);
  // فقرةُ صورةٍ سطريّةٍ خالصة: كلمةٌ نائبة (nbsp) لتنتج سطرًا واحدًا يحجز ارتفاع الصورة.
  if (!words.length && (p.inlineImageHTwips > 0 || p.excluded === "empty")) words.push(" ");
  // صورٌ عائمة (wp:anchor): طبقةٌ على الصفحة الحاليّة بموضعها المحلول (page/margin/paragraph).
  if (p.anchors && p.anchors.length) for (const a of p.anchors) {
    if (!a.rId) continue;
    // أفقيًّا (RTL، حصاد «الشاملة الذهبية»): الإزاحة تُقاس من الحافّة اليمنى للمرجع نحو
    // اليسار؛ الإزاحة السالبة تدفع الصورة يمينًا (داخل الهامش) — ١٤٢ حالةً في masjid.
    const refRight = a.posHRel === "page" ? pageW : (pageW - marR);
    const ax = refRight - a.posHOffset - a.extentW;
    // عموديًّا: page من أعلى الصفحة، margin من الهامش العلويّ، paragraph من **أعلى الفقرة**
    const paraTop = baseline - MET.a * em;
    let ay = a.posVRel === "page" ? a.posVOffset
      : a.posVRel === "margin" ? marT + a.posVOffset : paraTop + a.posVOffset;
    // (AGENTS §23) صورةٌ أطول من منطقة الهوامش بإزاحةٍ سالبة تبقى داخل الصفحة: تُوسَّط عموديًّا
    const marginArea = pageH - marT - marB;
    if (a.posVRel === "margin" && a.wrap !== "None" && a.extentH > marginArea && a.extentH <= pageH && ay < 0)
      ay = (pageH - a.extentH) / 2;
    imgAnchors.push({ page: cur, x: ax, y: ay, w: a.extentW, h: a.extentH, rId: a.rId });
  }
  if (!words.length) continue;
  // كسرُ صفحةٍ صريح (w:br type=page / w:pageBreakBefore / حدّ مقطع nextPage):
  // الفقرة تبدأ صفحةً جديدة إن كانت الحاليّة غير فارغة — يطابق ترقيم صفحات Word.
  // تُكبَت مسافةُ before أعلى الصفحة (prev=null)، والأساس الأوّل من pageStartAscent.
  if (p.pageBreakBefore && pages[cur].length > 0 && process.env.NOPB !== "1") {
    pages.push([]); cur++;
    baseline = marT + pageStartAscent(MET, em, p.spacing, cal);
    prev = null; prevDesc = null; pendingGap = 0; pageAnchor = baseline;
  }
  // تخطيطٌ شبكيّ للجداول (حصاد «الشاملة الذهبية»): صفٌّ = خلايا جنبًا لجنب من نفس
  // startBaseline؛ الصفّ يتقدّم بأطول خليّة. خارج الجدول: نُنهي الصفّ الأخير.
  if (p.tableCell) {
    const tc = p.tableCell;
    if (!curTable || curTable.id !== tc.tableId || curTable.row !== tc.row) {
      if (curTable) { finishRow(curTable); baseline = curTable.maxBottom; }
      curTable = { id: tc.tableId, row: tc.row, startBaseline: baseline, maxBottom: baseline,
        rowTop: null, cells: [] }; // rowTop يُحسَب من أعلى أوّل سطرٍ فعليّ لكلّ خليّة
      prevDesc = null; pendingGap = 0;
    } else if (tc.firstInCell) { baseline = curTable.startBaseline; prevDesc = null; pendingGap = 0; }
    // مستطيلُ الخليّة (تظليلٌ + حدود من نمط الجدول) — يُختَم ارتفاعُه عند نهاية الصفّ
    if (tc.firstInCell) {
      const bs = tableBorders[tc.tblStyleId] || null;
      const bside = bs && (bs.insideH || bs.top || bs.left);
      const rect = { page: cur, x: cellOuterRight - cellW, y: 0, w: cellW, h: 0,
        fill: tc.shdFill || null, bw: bside ? bside.w : 0, bc: bside ? bside.color : "000000" };
      curTable.cells.push(rect); tableCells.push(rect);
    }
  } else if (curTable) { finishRow(curTable); baseline = curTable.maxBottom; curTable = null; prevDesc = null; }
  const boldMet = metrics[`${p.runs[0]?.family || MAIN_FAMILY}|bold`];
  const paraRuns = runsByPara.byPara.get(runsByPara.key(p.text));
  const wMeta = paraRuns ? paraWordMeta(paraRuns) : null; // مقاييس كلّ كلمة (بولد/حجم/عائلة)
  const cw = process.env.CTXW === "0" ? null : contextualWidths(words, em, fo);
  const PUNCT = "،؛:.!؟»)";
  const items = words.map((w, i) => {
    const lc = w[w.length - 1];
    const tov = PUNCT.includes(lc) ? Math.min(shapeWord(lc, em, fo).width, 12) : 0;
    let width = cw ? cw.wordW[i] : wordWidth(w, em);
    // كلمةٌ فيها رمزٌ PUA (w:sym): تُشكَّل بخطّها الرمزيّ (AGA…) لعرضٍ صحيح — لا خطّ
    // الفقرة (الذي يعطي .notdef فيفسد كسر السطر). حصاد «الشاملة الذهبية».
    const hasPua = [...w].some((c) => { const cp = c.codePointAt(0); return cp >= 0xf000 && cp <= 0xf0ff; });
    if (hasPua && wMeta?.[i]?.fam) width = shapeWord(w, em, getFont(wMeta[i].fam)).width;
    return { width, spaceBefore: i ? (cw ? cw.spaceW : spaceW) : 0, blankBefore: i > 0, trailingOverhang: tov };
  });
  const lines = breakLines(items, { columnTwips: colBase, firstLineIndentTwips: p.indFirstLine || 0,
    justified: true, compatibilityMode: model.compatibilityMode });

  // حدّ الفقرة (generic، قاعدة OOXML): السطر الأخير للسابقة أضاف pitch سلفًا؛
  // نضيف فراغ التباعد = max(after السابقة, before اللاحقة). contextualSpacing
  // يكبت الفراغ بين فقرتين **من نفس النمط** (الجانب المُعلَّم به contextual).
  if (pi > 0 && prev) {
    const sameStyle = prev.styleId === p.styleId;
    const afterEff = (prev.contextual && sameStyle) ? 0 : (prev.after || 0);
    const beforeEff = (hasContextual(p) && sameStyle) ? 0 : (p.spacing?.before || 0);
    pendingGap += Math.max(afterEff, beforeEff);
  }

  // علامة الترقيم (numPr): تُرسم على السطر الأوّل وتزيح بدايته (تعليق)
  let marker = null;
  if (p.numbered) {
    const ninfo = numbering.byText.get(numbering.norm(p.text));
    const mstr = ninfo ? markerText(numbering, ninfo.numId, ninfo.ilvl, counters) : null;
    if (mstr) {
      const mg = shapeWord(mstr, em, fo);
      const textStart = numTabTextStart({ indLeftTwips: p.indLeft,
        hangingTwips: p.indFirstLine < 0 ? -p.indFirstLine : 0,
        markerWidthTwips: mg.width, defaultTabStopTwips: model.defaultTabStop });
      marker = { glyphs: mg.glyphs, width: mg.width, indent: Math.max(0, textStart - p.indLeft) };
    }
  }

  // المرحلة 1: بناء واصفات الأسطر (رسومها وصندوقها ومضاعفها) دون إسناد صفحة —
  // ليتمكّن ضبط الأرملة/اليتيم من نقل حدّ الكسر بمعرفة كلّ أسطر الفقرة.
  const descs = [];
  for (let li = 0; li < lines.length; li++) {
    const ln = lines[li];
    const lineWords = words.slice(ln.start, ln.end);
    const shaped = lineWords.map((w) => shapeWord(w, em, fo));
    const wordsW = shaped.reduce((a, s) => a + s.width, 0);
    const nSpaces = lineWords.length - 1;
    const natural = wordsW + nSpaces * spaceW;
    const isLast = li === lines.length - 1;
    const W = colBase - (li === 0 ? Math.max(0, p.indFirstLine || 0) : 0);
    const extra = (!isLast && !ln.forced && nSpaces > 0) ? (W - natural) / nSpaces : 0;
    const gap = spaceW + extra;

    // آليّة B (max عبر خطوط السطر الفعليّة): صعود/هبوط = أقصى مقطعٍ فيه بخطّه الحقيقيّ
    // (عائلة/بولد/حجم لكلّ كلمة). خطُّ العنوان الأصغر يخفض، البولد يرفع — كلاهما generic.
    let box = { asc: MET.a * em, desc: (MET.d + MET.g) * em, extraWd: 0 };
    // صورةٌ سطريّة على السطر الأوّل: ترفع صعوده لارتفاع الصورة (تحجز مساحتها). generic.
    if (li === 0 && p.inlineImageHTwips > 0) box.asc = Math.max(box.asc, p.inlineImageHTwips);
    if (wMeta && process.env.BOLDBOX !== "0") {
      for (let gi = ln.start; gi < ln.end; gi++) {
        const wm = wMeta[gi]; if (!wm) continue;
        const fam = wm.fam || p.runs[0].family;
        const wsz = (wm.sz && wm.sz > 0) ? wm.sz : em;
        const wmet = (wm.bold && metrics[`${fam}|bold`]) || metrics[fam] || MET;
        box.asc = Math.max(box.asc, wmet.a * wsz);
        box.desc = Math.max(box.desc, (wmet.d + wmet.g) * wsz);
        // قاعدة ارتفاع سطر الخطوط المختلطة (Word، مكشوفةٌ بالتجربة على محرّك Word نفسه
        // 2026-07-18): محرفٌ يُرسَم بخطٍّ احتياطيّ (fallback) أكبرَ هبوطًا (usWinDescent)
        // يمتدّ هبوطُ السطر بفارق (fallbackWinDesc − mainWinDesc) × em بعد المضاعف.
        // المحفِّز في كتبنا: قوس الآية ﴿﴾ (مُعلَنٌ Times) يسقط إلى Sakkal Majalla.
        // generic: أيّ محرفٍ لا يغطّيه خطّه المُعلَن يسقط للاحتياط (العربيّة → Sakkal).
        if (process.env.WINDESC !== "0") {
          let renderWd = (metrics[fam]?.wd ?? MAIN_WD);
          const w = words[gi];
          if (w) for (const ch of w) {
            if (fontCovers(fam, ch.codePointAt(0)) === false) { renderWd = Math.max(renderWd, FALLBACK_WD); break; }
          }
          box.extraWd = Math.max(box.extraWd, Math.max(0, renderWd - MAIN_WD) * wsz);
        }
      }
    }
    // وضعٌ RTL: أوّل كلمةٍ (منطقيًّا) أقصى اليمين؛ المحارف داخل الكلمة يسار→يمين
    const glyphs = [];
    // العلامة تتدلّى يمين حافّة النصّ (في الهامش) — لا تُزيح النصّ نفسه
    if (li === 0 && marker) {
      let gx = rightEdge;
      for (const g of marker.glyphs) { glyphs.push({ gid: g.gid, x: Math.round(gx * 100) / 100 }); gx += g.adv; }
    }
    let penX = rightEdge;
    for (const s of shaped) {
      const left = penX - s.width;
      let gx = left;
      for (const g of s.glyphs) { glyphs.push({ gid: g.gid, x: Math.round(gx * 100) / 100 }); gx += g.adv; }
      penX = left - gap;
    }
    descs.push({ glyphs, asc: box.asc, desc: box.desc, extraWd: box.extraWd, mlt: lineMultiplier(p.spacing), text: lineWords.join(" ") });
  }

  // صفّ فهرس (TOC، حصاد «الشاملة الذهبية»): سطرٌ واحد — المدخل يمينًا، رقمُ الصفحة عند
  // الحافّة اليسرى (RTL)، والقائد (شرطة/نقطة) يملأ الوسط. يستبدل الأسطر العاديّة.
  if (p.toc) {
    const entryG = shapeWord(p.toc.entry, em, fo);
    const pageG = shapeWord(p.toc.pageNum, em, fo);
    const lch = p.toc.leader === "hyphen" ? "-" : p.toc.leader === "underscore" ? "_"
      : p.toc.leader === "middleDot" ? "·" : ".";
    const leadG = shapeWord(lch, em, fo); const leadW = leadG.width || em * 0.3;
    const g = [];
    let gx = rightEdge - entryG.width; const entryLeft = gx;
    for (const gl of entryG.glyphs) { g.push({ gid: gl.gid, x: Math.round(gx * 100) / 100 }); gx += gl.adv; }
    const colLeft = rightEdge - colBase; let px = colLeft; const pageRight = colLeft + pageG.width;
    for (const gl of pageG.glyphs) { g.push({ gid: gl.gid, x: Math.round(px * 100) / 100 }); px += gl.adv; }
    if (leadW > 0) for (let lx = pageRight + leadW * 0.4; lx + leadW <= entryLeft - leadW * 0.4; lx += leadW)
      for (const gl of leadG.glyphs) g.push({ gid: gl.gid, x: Math.round(lx * 100) / 100 });
    descs.length = 0;
    descs.push({ glyphs: g, asc: MET.a * em, desc: (MET.d + MET.g) * em, extraWd: 0,
      mlt: lineMultiplier(p.spacing), text: p.toc.entry + " " + p.toc.pageNum });
  }

  // المرحلة 2: الإسناد إلى صفحاتٍ بتراكم float (آليّة A/B كما هي) + ضبط الأرملة/اليتيم
  // (widowControl، افتراضيّ Word ON): لا يُترَك سطرٌ وحيدٌ للفقرة أعلى صفحة (أرملة) أو
  // أسفلها (يتيم) — يُنقَل حدّ الكسر ليبقى ≥٢ سطرًا معًا. WIDOW=0 للتعطيل (تشخيصيّ).
  const n = descs.length;
  const pageStartB = marT + pageStartAscent(MET, em, p.spacing, cal);
  const pageBottom = pageH - marB;
  const WIDOW = process.env.WIDOW !== "0" && widowCtl(p);
  const curInit = cur, pageAnchorInit = pageAnchor;
  const yArr = new Array(n), pgArr = new Array(n);
  let b = baseline, pd = prevDesc, pg = pendingGap, page = cur;
  let pageHasPrior = pages[cur].length > 0; // محتوًى سابقٌ (فقراتٌ أخرى) على صفحة البداية
  let paraFirstOnPage = 0; // فهرس أوّل سطرٍ لهذه الفقرة على الصفحة الجارية
  let atPageTop = !pageHasPrior && pd === null; // سطرٌ أوّلُ صفحةٍ لا يُكسَر قبله (منع اللانهاية)
  for (let i = 0; i < n;) {
    const d = descs[i];
    const nb = (BOX && pd !== null) ? b + pd + d.asc + pg : (BOX ? b : b + pg);
    if (!atPageTop && nb > pageBottom) {
      // فيض: احسب حدّ الكسر الطبيعيّ i ثم اضبطه للأرملة/اليتيم
      let bi = i;
      const above = i - paraFirstOnPage, below = n - i;
      if (WIDOW) {
        if (above === 1 && pageHasPrior) bi = paraFirstOnPage;            // يتيمٌ أسفل: انقل الفقرة كلَّها
        else if (below === 1 && above >= 2) bi = (above >= 3) ? i - 1     // أرملةٌ أعلى: اجذب سطرًا
          : (pageHasPrior ? paraFirstOnPage : i);
      }
      if (bi < paraFirstOnPage) bi = paraFirstOnPage;
      page++; b = pageStartB; pd = null; pg = 0;
      pageHasPrior = false; paraFirstOnPage = bi; i = bi; atPageTop = true;
      continue;
    }
    yArr[i] = nb; pgArr[i] = page; pg = 0; atPageTop = false;
    b = nb;
    // هبوط السابق الفعّال يشمل فجوة المضاعف: desc + (asc+desc)×(mult−1)؛ ثمّ امتداد
    // الخطّ الاحتياطيّ (extraWd) يُضاف **بعد** المضاعف (قاعدة المختلطة، مؤكَّدةٌ تجريبيًّا).
    pd = BOX ? d.desc + (d.asc + d.desc) * (d.mlt - 1) + (d.extraWd || 0) : null;
    if (!BOX) b += singlePitch(MET, em) * d.mlt;
    i++;
  }

  // الإصدار: ادفع الأسطر إلى صفحاتها المُسنَدة (تُنشأ الصفحات عند الحاجة بالترتيب)
  for (let i = 0; i < n; i++) {
    while (pages.length <= pgArr[i]) pages.push([]);
    const anchor = pgArr[i] === curInit ? pageAnchorInit : pageStartB;
    const yOut = process.env.DOTSNAP !== "1" ? yArr[i]
      : anchor + Math.round((yArr[i] - anchor) / 2.4) * 2.4;
    pages[pgArr[i]].push({ y: Math.round(yOut * 100) / 100, em, font: fo.file, glyphs: descs[i].glyphs, text: descs[i].text });
  }
  // حالة ما بعد الفقرة (للفقرة التالية)
  baseline = b; prevDesc = pd; pendingGap = 0; cur = pgArr[n - 1];
  if (curTable && p.tableCell) {
    curTable.maxBottom = Math.max(curTable.maxBottom, baseline + (prevDesc || 0));
    if (n > 0) { const top = yArr[0] - descs[0].asc; // أعلى أوّل سطرٍ فعليّ لهذه الخليّة
      curTable.rowTop = curTable.rowTop == null ? top : Math.min(curTable.rowTop, top); }
  }
  pageAnchor = cur === curInit ? pageAnchorInit : pageStartB;
  prev = { spacing: p.spacing, after: p.spacing?.after, styleId: p.styleId, contextual: hasContextual(p) };
}

finishRow(curTable); // اختم آخر صفٍّ في المستند
const out = { source: "our-engine", unit: "twip", mainFont: MAIN_FILE,
  pageW, pageH, docx: `corpus/books/${BOOK}.docx`,
  pages: pages.map((lines, pi) => ({ w: pageW, h: pageH, lines,
    anchors: imgAnchors.filter((a) => a.page === pi),
    cells: tableCells.filter((c) => c.page === pi && c.h > 0) })) };
writeFileSync(OUT, JSON.stringify(out), "utf8");
console.log(`محرّكنا: ${pages.length} صفحة، ${pages.reduce((a, p) => a + p.length, 0)} سطرًا -> ${OUT}`);
console.log(`صفحة 1: ${pages[1]?.length ?? 0} سطر، أول baseline=${pages[1]?.[0]?.y?.toFixed(1)}`);
