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
      return { w: Math.min(60, Math.max(10, Math.round((sz / 8) * 20))),
        wRaw: Math.round((sz / 8) * 20), color: col === "auto" ? "000000" : col };
    };
    byStyle[st[1]] = { top: side("top"), bottom: side("bottom"), left: side("left"),
      right: side("right"), insideH: side("insideH"), insideV: side("insideV") };
  }
  return byStyle;
}
/** حدودُ كلّ جدولٍ المُصرَّحة في w:tblPr مباشرةً، مرتّبةً بترتيب ظهور الجداول
 *  (يوافق tableId في النموذج). تتقدّم على حدود النمط عند التعارض.
 *  ملحوظة: الجداولُ المتداخلة تُزيح الترتيب — لا تَرِد في كتبنا. */
function loadDirectTableBorders(docxPath) {
  const zip = unzipSync(readFileSync(docxPath));
  const doc = zip["word/document.xml"] ? strFromU8(zip["word/document.xml"]) : "";
  const out = [];
  for (const m of doc.matchAll(/<w:tblPr>([\s\S]*?)<\/w:tblPr>/g)) {
    const tb = m[1].match(/<w:tblBorders>([\s\S]*?)<\/w:tblBorders>/);
    if (!tb) { out.push(null); continue; }
    const side = (nm) => {
      const t = tb[1].match(new RegExp("<w:" + nm + "[ /][^>]*>"));
      if (!t || /w:val="(none|nil)"/.test(t[0])) return null;
      const sz = Number((t[0].match(/w:sz="(\d+)"/) || [])[1] || 4);
      const col = (t[0].match(/w:color="([^"]+)"/) || [])[1] || "auto";
      return { w: Math.min(60, Math.max(10, Math.round((sz / 8) * 20))),
        wRaw: Math.round((sz / 8) * 20), color: col === "auto" ? "000000" : col };
    };
    out.push({ top: side("top"), bottom: side("bottom"), left: side("left"),
      right: side("right"), insideH: side("insideH"), insideV: side("insideV") });
  }
  return out;
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
      const sup = /<w:vertAlign[^>]*w:val="superscript"/.test(rPr);
      const sub = /<w:vertAlign[^>]*w:val="subscript"/.test(rPr);
      const txt = [...r[1].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join("");
      if (txt) runs.push({ text: txt, bold, sz: szCs ? +szCs * 10 : null, fam, sup, sub });
    }
    const key = normKey(runs.map((r) => r.text).join(""));
    if (key && runs.length) byPara.set(key, runs);
  }
  return { byPara, key: normKey };
}
/** مقاييس كلّ كلمة (بولد/حجم) بالمشي عبر مقاطع الفقرة — يوازي words الناتجة من
 *  p.text.split(/\s+/). الكلمة الممتدّة عبر مقاطع تأخذ أطولها (أقصى pitch). */
/** عائلةُ خطّ كلمةٍ بفهرسها (للمقاييس عند رسم الزخارف). */
function wMetaFam(wMeta, gi, p) {
  return (wMeta && wMeta[gi] && wMeta[gi].fam) || p.runs[0]?.family || MAIN_FAMILY;
}
function paraWordMeta(paraRuns) {
  const meta = []; let cur = null;
  const push = () => { if (cur) { meta.push(cur); cur = null; } };
  for (const r of paraRuns) {
    for (const ch of r.text) {
      if (/\s/.test(ch)) { push(); continue; }
      if (!cur) cur = { bold: false, sz: null, fam: null, sup: false, sub: false,
        color: null, highlight: null, underline: null, ucolor: null,
        strike: false, dstrike: false, italic: false, pos: 0, csp: 0 };
      cur.bold = cur.bold || r.bold;
      cur.sup = cur.sup || !!r.sup; cur.sub = cur.sub || !!r.sub;
      if (r.sz && (!cur.sz || r.sz > cur.sz)) cur.sz = r.sz;
      if (r.fam && !cur.fam) cur.fam = r.fam;
      // المظهر: أوّلُ مقطعٍ في الكلمة يحسم (الكلمةُ وحدةُ رسمٍ عندنا)
      if (r.color && !cur.color) cur.color = r.color;
      if (r.highlight && !cur.highlight) cur.highlight = r.highlight;
      if (r.underline && !cur.underline) { cur.underline = r.underline; cur.ucolor = r.ucolor ?? null; }
      cur.strike = cur.strike || !!r.strike; cur.dstrike = cur.dstrike || !!r.dstrike;
      cur.italic = cur.italic || !!r.italic;
      if (r.pos && !cur.pos) cur.pos = r.pos;
      if (r.csp && !cur.csp) cur.csp = r.csp;
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
const tableDirect = loadDirectTableBorders(`corpus/books/${BOOK}.docx`);
// سُمكُ الحدّ الأفقيّ يزيد تباعدَ الصفوف بمقداره — قاعدةٌ مقيسةٌ على Word بثلاث
// نسخٍ من نفس الجدول (بلا حدّ / ١pt / ٣pt): الزيادةُ ٠ ثمّ ٢٠ ثمّ **٦٠٫٠tw**
// بالضبط، أي عرضُ الحدّ نفسه. الحدُّ العلويّ عند بدء الجدول، وinsideH بين
// الصفوف، والسفليّ عند الخروج منه.
function borderH(tc, which) {
  const d = tableDirect[tc.tableId] ?? null;
  const st = tableBorders[tc.tblStyleId] ?? null;
  const b = (d && d[which]) || (st && st[which]) || null;
  return b ? (b.wRaw ?? b.w ?? 0) : 0;
}
const tableCells = []; // مستطيلات خلايا الجداول {page,x,y,w,h,fill,bw,bc}
const notesByPage = new Map(); // صفحة → مراجعُ الحواشي الواقعة فيها
const endnoteRefs = [];        // التعليقاتُ الختاميّة بترتيبها (تُرصَف في آخر المستند)
const hasContextual = (p) => contextual.byText.has(contextual.norm(p.text)) || contextual.styleSet.has(p.styleId);
// ضبط الأرملة/اليتيم مُفعَّلٌ ما لم يُعطَّل صراحةً (widowControl=false في النموذج)
const widowCtl = (p) => p.widowControl !== false;
// مقاييسُ الرفع/الخفض (مقيسةٌ من Word): الحجم ⅔ الأصل، والرفع ⅓ الأصل فوق الأساس
const SUP_SCALE = 0.66, SUP_RISE = 1 / 3; // مقيسٌ من Word: 211/320 = 0.66
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
// الأعمدة (w:cols): «الخانة» = صفحة×عددُ الأعمدة + العمود. المحتوى يملأ الخانةَ
// إلى أسفلها ثمّ ينتقل إلى التالية؛ وفي RTL العمودُ الأوّل على اليمين (قياسٌ من
// Word: gap-cols2 عمودان بعرض ٤١٥٩ وفاصلٍ ٧٠٨، الأوّل يمينًا عند x=١٠٤٧١).
let curCol = 0;
let pendingColBreak = false;   // w:br type="column" — يُطبَّق على الفقرة التالية
const slotCount = []; // خانة → عددُ أسطرها (للأرملة/اليتيم وبداية الصفحة)
const pageSec = [];   // صفحة → فهرسُ مقطعها (لاختيار ترويستها/تذييلها)
const fo0 = getFont(paras[0].runs[0]?.family || MAIN_FAMILY);
let baseline = marT + pageStartAscent(fo0.met, paras[0].runs[0]?.emTwips || 200, paras[0].spacing, PS_CAL);
let prev = null, prevDesc = null, pendingGap = 0, pageAnchor = baseline;
let curTable = null; // {id,row,startBaseline,maxBottom} — التخطيط الشبكيّ للجداول
// آليّة B (max عبر المقاطع): صندوق السطر — صعودٌ وهبوطٌ يأخذان أقصى مقطعٍ فيه
// (بولد أطول). الخطوة = هبوط السابق + صعود الحاليّ (BOX=0 للعودة للـpitch الثابت).
const BOX = process.env.BOX !== "0";
const DOCGRID = process.env.DOCGRID !== "0";  // شبكةُ المستند (قِيست: محايدةٌ إلى نافعة)
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
  let top = t.rowTop != null ? t.rowTop : t.startBaseline;
  let bottom = Math.max(t.maxBottom, top + 1) + (t.marBottom || 0);
  // ‏w:trHeight: atLeast يوسّع الصفّ إلى الحدّ الأدنى، وexact يفرضه فرضًا
  if (t.exactH) bottom = top + t.exactH;
  else if (t.minH && bottom - top < t.minH) bottom = top + t.minH;
  t.maxBottom = Math.max(t.maxBottom, bottom);
  // كسرُ الصفحة على مستوى الصفّ (سلوك Word): صفٌّ لا يسعه ما بقي من الصفحة يُنقَل
  // **كاملًا** للصفحة التالية (لا يُشقّ)، بشرط أن يسعه ارتفاعُ صفحةٍ كاملة وأن يكون
  // فوقه محتوًى على صفحته (وإلّا فهو أطول من صفحةٍ فلا ينفع نقلُه). ROWBREAK=0 للتعطيل.
  const pageBottom = pageH - marB, pageTop = marT;
  const rowH = bottom - top;
  if (t.cantSplit && process.env.ROWBREAK !== "0" && bottom > pageBottom && rowH <= (pageBottom - pageTop)
      && top > pageTop + 1 && t.lines.length > 0) { // بدأ الصفّ وسطَ الصفحة (فوقه محتوًى)
    const shift = pageTop - top;              // ننقل أعلى الصفّ إلى أعلى الصفحة الجديدة
    pages.push([]); const np = pages.length - 1;
    for (const ref of t.lines) {              // انزع السطر من صفحته وضعه في الجديدة
      const arr = pages[ref.pg]; const i = arr.indexOf(ref.o);
      if (i >= 0) arr.splice(i, 1);
      ref.o.y = Math.round((ref.o.y + shift) * 100) / 100;
      pages[np].push(ref.o);
    }
    for (const c of t.cells) c.page = np;
    top += shift; bottom += shift;
    cur = np; baseline = bottom; prevDesc = null; // نتابع بعد الصفّ في الصفحة الجديدة
    t.maxBottom = bottom;
  }
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
  // هوامشُ الخليّة من w:tcMar/w:tblCellMar (وافتراضيُّ Word ١٠٨ يمينًا ويسارًا)
  const CM_R = p.tableCell?.marRight ?? Number(process.env.CELLMAR ?? "108");
  const CM_L = p.tableCell?.marLeft ?? Number(process.env.CELLMAR ?? "108");
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
    rightEdge = cellOuterRight - CM_R;                   // بداية النصّ بعد الهامش
    colBase = Math.max(200, cellW - CM_L - CM_R - p.indLeft - p.indRight);
  }
  const spaceW = wordWidth(" ", em) || wordWidth(" ", em);
  const words = p.text.trim().split(/\s+/).filter(Boolean);
  // فقرةُ صورةٍ سطريّةٍ خالصة: كلمةٌ نائبة (nbsp) لتنتج سطرًا واحدًا يحجز ارتفاع الصورة.
  if (!words.length && (p.inlineImageHTwips > 0 || p.excluded === "empty")) words.push(" ");
  // صورٌ عائمة (wp:anchor): طبقةٌ على الصفحة الحاليّة بموضعها المحلول (page/margin/paragraph).
  if (p.anchors && p.anchors.length) for (const a of p.anchors) {
    if (!a.rId && !a.textBox) continue;
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
    if (a.rId) imgAnchors.push({ page: cur, x: ax, y: ay, w: a.extentW, h: a.extentH, rId: a.rId,
      ...(a.srcRect ? { srcRect: a.srcRect } : {}), ...(a.rotDeg ? { rot: a.rotDeg } : {}),
      ...(a.flipH ? { flipH: true } : {}), ...(a.flipV ? { flipV: true } : {}) });
    // مربّعُ نصٍّ في المتن (لوحاتُ الغلاف والترويسات): نصُّه كان يضيع كلّيًّا لأنّ فقرته
    // تُقصى «drawing» والمرساةُ بلا rId. حصاد «الشاملة الذهبية»: tadris ٥ مربّعات،
    // muqtarah ٢ (٢٨٥ محرفًا).
    else if (a.textBox) emitBoxParas(cur, a.textBox, ax, ay, a.extentW, a.extentH, a.boxIns, a.boxAnchor, cur + 1, pages.length, "textbox");
  }
  if (!words.length) continue;
  // كسرُ صفحةٍ صريح (w:br type=page / w:pageBreakBefore / حدّ مقطع nextPage):
  // الفقرة تبدأ صفحةً جديدة إن كانت الحاليّة غير فارغة — يطابق ترقيم صفحات Word.
  // تُكبَت مسافةُ before أعلى الصفحة (prev=null)، والأساس الأوّل من pageStartAscent.
  // كسرُ عمودٍ سابق (w:br type="column"): ابدأ الخانةَ التالية قبل هذه الفقرة
  if (pendingColBreak) {
    pendingColBreak = false;
    const nc = Math.max(1, (model.sections[p.sectionIndex] ?? sec).colCount || 1);
    if (curCol + 1 < nc) { curCol++; }
    else { pages.push([]); cur++; curCol = 0; }
    baseline = marT + pageStartAscent(MET, em, p.spacing, cal);
    prev = null; prevDesc = null; pendingGap = 0; pageAnchor = baseline;
  }
  if (p.pageBreakBefore && pages[cur].length > 0 && process.env.NOPB !== "1") {
    pages.push([]); cur++; curCol = 0;
    baseline = marT + pageStartAscent(MET, em, p.spacing, cal);
    prev = null; prevDesc = null; pendingGap = 0; pageAnchor = baseline;
  }
  // تخطيطٌ شبكيّ للجداول (حصاد «الشاملة الذهبية»): صفٌّ = خلايا جنبًا لجنب من نفس
  // startBaseline؛ الصفّ يتقدّم بأطول خليّة. خارج الجدول: نُنهي الصفّ الأخير.
  if (p.tableCell) {
    const tc = p.tableCell;
    if (!curTable || curTable.id !== tc.tableId || curTable.row !== tc.row) {
      const sameTbl = curTable && curTable.id === tc.tableId;
      if (curTable) { finishRow(curTable); baseline = curTable.maxBottom; prevDesc = 0; }
      // الحدُّ الأفقيّ: العلويُّ عند دخول الجدول، وinsideH بين صفّين منه
      baseline += sameTbl ? borderH(tc, "insideH") : borderH(tc, "top");
      // صفٌّ جديد: نحفظ أساسَه **وهبوطَ ما قبله** معًا. كان prevDesc يُصفَّر إلى null
      // فيصير nb = b بلا صعود، فتقع أوّلُ أسطر الصفّ **على** أساس ما قبله ولا ينزل
      // الجدولُ أصلًا (قِيس على gap-vmerge: صفوفُنا ١٧١٨٫٤ و١٨٥٨٫٥ مقابل ٢١٥٨ و٢٥٩٤٫٨).
      baseline += tc.marTop || 0;                 // هامشُ الخليّة العلويّ
      curTable = { id: tc.tableId, row: tc.row, startBaseline: baseline, startPd: prevDesc ?? 0,
        minH: tc.rowHeightRule === "exact" ? null : (tc.rowHeight || null),
        exactH: tc.rowHeightRule === "exact" ? (tc.rowHeight || null) : null,
        marBottom: tc.marBottom || 0,
        maxBottom: baseline, rowTop: null, cells: [], lines: [], startPage: cur,
        cantSplit: !!tc.cantSplit, botBorder: borderH(tc, "bottom") }; // rowTop من أعلى أوّل سطر
      pendingGap = 0;
    } else if (tc.firstInCell) {
      baseline = curTable.startBaseline; prevDesc = curTable.startPd; pendingGap = 0;
    }
    // مستطيلُ الخليّة (تظليلٌ + حدود من نمط الجدول) — يُختَم ارتفاعُه عند نهاية الصفّ
    // ‏vMerge=continue: الخليّةُ امتدادُ ما فوقها — لا تُسهم بارتفاعٍ ولا يُكرَّر نصُّها
    if (tc.vMerge === "continue") continue;
    if (tc.firstInCell) {
      const bs = tableBorders[tc.tblStyleId] || null;
      const bside = bs && (bs.insideH || bs.top || bs.left);
      const rect = { page: cur, x: cellOuterRight - cellW, y: 0, w: cellW, h: 0,
        fill: tc.shdFill || null, bw: bside ? bside.w : 0, bc: bside ? bside.color : "000000" };
      curTable.cells.push(rect); tableCells.push(rect);
    }
  } else if (curTable) {
    finishRow(curTable);
    baseline = curTable.maxBottom + (curTable.botBorder || 0);   // الحدُّ السفليّ عند الخروج
    curTable = null; prevDesc = 0;
  }
  const gsec = model.sections[p.sectionIndex] ?? sec;
  const boldMet = metrics[`${p.runs[0]?.family || MAIN_FAMILY}|bold`];
  // مقاييسُ كلّ كلمة من **مقاطع النموذج نفسها** (مصدرٌ واحدٌ للحقيقة): نصُّها يطابق p.text
  // تمامًا (بما فيه أرقامُ الحواشي المحقونة)، وعائلتُها محلولةٌ عبر سلسلة الأنماط.
  const mRuns = p.runs.filter((r) => !r.hidden).map((r) => ({
    text: r.text, bold: !!r.bold, sz: r.emTwips, fam: r.family, sup: !!r.superscript,
    sub: !!r.subscript, color: r.color ?? null, highlight: r.highlight ?? null,
    underline: r.underline ?? null, ucolor: r.underlineColor ?? null,
    strike: !!r.strike, dstrike: !!r.doubleStrike, italic: !!r.italic, pos: r.position ?? 0, csp: r.charSpacing ?? 0 }));
  const wMeta = mRuns.length ? paraWordMeta(mRuns) : null;
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
    // علامةُ الحاشية (superscript): Word يصغّرها إلى ⅔ ويرفعها ⅓ (قياسٌ: 211/320 و120/320)
    if (wMeta?.[i]?.sup || wMeta?.[i]?.sub) width = shapeWord(w, em * SUP_SCALE, fo).width;
    if (wMeta?.[i]?.csp) width += wMeta[i].csp * [...w].length;
    return { width, spaceBefore: i ? (cw ? cw.spaceW : spaceW) : 0, blankBefore: i > 0, trailingOverhang: tov };
  });
  // ── قفزةُ الجدولة (w:tab) — القاعدة مقيسةٌ من Word على gap-tabs.docx ──
  // في مقطعٍ RTL تُقاس الوقفةُ **يسارًا من الهامش الأيمن**، والدلالةُ مرآتيّة:
  //   left/الافتراضيّ ⟶ الحافّةُ اليمنى للمقطع عند الوقفة   (قِيس Δ=+٣tw)
  //   right/end       ⟶ الحافّةُ اليسرى عندها (المقطعُ ينتهي بها)  (Δ=+٣tw)
  //   center          ⟶ المقطعُ متوسّطٌ عليها
  // وعند غياب التوقّفات المخصّصة: شبكةُ defaultTabStop (٧٢٠tw) — قِيس Δ=+٥tw.
  const tabGap = [], tabLead = [];
  if ((p.tabAt?.length || p.ptabAt?.length) && !p.toc) {
    const stops = (p.tabStops || []).filter((t) => (t.posTwips ?? 0) > 0)
      .sort((a, b) => a.posTwips - b.posTwips);
    const DTS = model.defaultTabStop || 720;
    const nextStop = (pos) => {
      for (const st of stops) if (st.posTwips > pos + 1) return st;
      return { posTwips: (Math.floor(pos / DTS) + 1) * DTS, val: "left" };
    };
    const starts = []; { const re = /\S+/g; let m; while ((m = re.exec(p.text))) starts.push(m.index); }
    // ‏w:ptab: موضعٌ مطلقٌ من المرجع لا توقّفٌ من الشبكة. في RTL نقيس من الحافّة
    // اليمنى: يسار⟶العرضُ كلُّه، وسط⟶نصفُه، يمين⟶الصفر (بدايةُ السطر).
    const ptabStop = new Map();
    for (const pt of p.ptabAt ?? []) {
      const width = pt.relativeTo === "indent" ? colBase : sec.columnTwips;
      const posTwips = pt.alignment === "center" ? width / 2
        : pt.alignment === "right" ? width : 0;
      ptabStop.set(pt.at, { posTwips, val: "left", leader: pt.leader });
    }
    const tabBefore = new Set();
    for (const off of p.tabAt) {
      const wi = starts.findIndex((st) => st >= off);
      if (wi >= 0 && wi < words.length) tabBefore.add(wi);
    }
    const ptabByWord = new Map();
    for (const [at, st] of ptabStop) {
      const wi = starts.findIndex((x) => x >= at);
      if (wi >= 0 && wi < words.length) { tabBefore.add(wi); ptabByWord.set(wi, st); }
    }
    let pos = Math.max(0, p.indFirstLine || 0);
    for (let i = 0; i < words.length; i++) {
      if (tabBefore.has(i)) {
        const st = ptabByWord.get(i) ?? nextStop(pos);   // ‏ptab يتقدّم على الشبكة
        let segW = 0;                       // عرضُ المقطع حتى الجدولة التالية
        for (let j = i; j < words.length; j++) {
          if (j > i && tabBefore.has(j)) break;
          segW += items[j].width + (j > i ? spaceW : 0);
        }
        const v = st.val;
        const target = (v === "right" || v === "end") ? st.posTwips - segW
          : v === "center" ? st.posTwips - segW / 2 : st.posTwips;
        tabGap[i] = Math.max(0, target - pos);
        if (st.leader && st.leader !== "none") tabLead[i] = st.leader;
        pos = Math.max(pos, target);
      } else if (i) pos += spaceW;
      pos += items[i].width;
    }
    for (let i = 0; i < words.length; i++)
      if (tabGap[i] != null) items[i].spaceBefore = tabGap[i];
  }
  // فواصلُ الأسطر اليدويّة (w:br غير type=page) — يمثّلها النموذج بمحرف سطرٍ جديد.
  // Word يقطع
  // السطر عندها قطعًا، والسطرُ المنتهي بها **لا يُسوَّغ** (كآخر سطرٍ في فقرة). نكسر
  // كلَّ مقطعٍ على حدةٍ ثمّ نُزيح فهارسه — فينتج الأمران معًا بلا حالةٍ خاصّة.
  // (‏tadris ٣٢ فاصلًا، muqtarah ٤، ahadith ٣ — كانت تُدمَج فراغًا عاديًّا.)
  const segCounts = p.text.trim().split("\n")
    .map((sg) => sg.trim().split(/\s+/).filter(Boolean).length).filter((n) => n > 0);
  let lines;
  if (segCounts.length > 1) {
    lines = []; let off = 0;
    for (const n of segCounts) {
      const sub = breakLines(items.slice(off, off + n).map((it, k) => (k ? it : { ...it, spaceBefore: 0, blankBefore: false })),
        { columnTwips: colBase, firstLineIndentTwips: off === 0 ? (p.indFirstLine || 0) : 0,
          justified: true, compatibilityMode: model.compatibilityMode });
      for (const l of sub) lines.push({ ...l, start: l.start + off, end: l.end + off });
      off += n;
    }
  } else {
    lines = breakLines(items, { columnTwips: colBase, firstLineIndentTwips: p.indFirstLine || 0,
      justified: true, compatibilityMode: model.compatibilityMode });
  }

  // حدّ الفقرة (generic، قاعدة OOXML): السطر الأخير للسابقة أضاف pitch سلفًا؛
  // نضيف فراغ التباعد = max(after السابقة, before اللاحقة). contextualSpacing
  // يكبت الفراغ بين فقرتين **من نفس النمط** (الجانب المُعلَّم به contextual).
  if (pi > 0 && prev) {
    const sameStyle = prev.styleId === p.styleId;
    const afterEff = (prev.contextual && sameStyle) ? 0 : (prev.after || 0);
    const beforeEff = (hasContextual(p) && sameStyle) ? 0 : (p.spacing?.before || 0);
    pendingGap += Math.max(afterEff, beforeEff);
  }
  // حدُّ الفقرة العلويّ يزيد الفراغَ فوقها بسُمكه + w:space (والسفليّ بعدها)
  if (p.pBdr?.top) pendingGap += p.pBdr.top.wTwips + p.pBdr.top.spaceTwips;

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
    const shaped = lineWords.map((w, k) => {
      const wm = wMeta?.[ln.start + k];
      const isSup = !!(wm && (wm.sup || wm.sub));
      const wem = isSup ? em * SUP_SCALE : em;
      const sh = shapeWord(w, wem, fo);
      // ‏w:spacing (rPr): تباعدٌ يُضاف بعد كلّ محرف — يوسّع الكلمة بمجموعه
      const csp = wm?.csp || 0;
      // ‏w:position يرفع/يخفض الأساس بمقداره (twips، موجبٌ يرفع)
      const dyBase = wm?.sup ? -(em * SUP_RISE) : wm?.sub ? (em * SUP_RISE * 0.5) : 0;
      return { glyphs: sh.glyphs, width: sh.width + csp * sh.glyphs.length, csp, em: wem,
        dy: dyBase - (wm?.pos || 0),
        color: wm?.color ?? null, highlight: wm?.highlight ?? null,
        underline: wm?.underline ?? null, ucolor: wm?.ucolor ?? null,
        strike: !!wm?.strike, dstrike: !!wm?.dstrike };
    });
    const wordsW = shaped.reduce((a, s) => a + s.width, 0);
    const nSpaces = lineWords.length - 1;
    const natural = wordsW + nSpaces * spaceW;
    const isLast = li === lines.length - 1;
    const W = colBase - (li === 0 ? Math.max(0, p.indFirstLine || 0) : 0);
    let hasTab = false;
    for (let gi = ln.start; gi < ln.end; gi++) if (tabGap[gi] != null) { hasTab = true; break; }
    const extra = (!isLast && !ln.forced && nSpaces > 0 && !hasTab) ? (W - natural) / nSpaces : 0;
    const gap = spaceW + extra;

    // آليّة B (max عبر خطوط السطر الفعليّة): صعود/هبوط = أقصى مقطعٍ فيه بخطّه الحقيقيّ
    // (عائلة/بولد/حجم لكلّ كلمة). خطُّ العنوان الأصغر يخفض، البولد يرفع — كلاهما generic.
    let box = { asc: MET.a * em, desc: (MET.d + MET.g) * em, extraWd: 0 };
    // شبكةُ المستند (w:docGrid@linePitch): أرضيّةٌ لارتفاع السطر — إن كان صندوقُ
    // السطر أقصرَ من خطوة الشبكة رُفِع إليها. تُعطَّل بـw:snapToGrid=0 على الفقرة
    // وبـdocGrid type=none. (كلُّ كتبنا linePitch=٣٦٠.) DOCGRID=0 للتعطيل.
    if (DOCGRID && p.snapToGrid !== false && gsec.docGridLinePitch
        && gsec.docGridType !== "none") {
      const need = gsec.docGridLinePitch - (box.asc + box.desc);
      if (need > 0) box.desc += need;
    }
    // صورةٌ سطريّة على السطر الأوّل: ترفع صعوده لارتفاع الصورة (تحجز مساحتها). generic.
    if (li === 0 && p.inlineImageHTwips > 0) box.asc = Math.max(box.asc, p.inlineImageHTwips);
    // علامةٌ مرفوعة: صعودُها = الرفع + صعودُ حجمها المصغَّر (قد يتجاوز صعود السطر)
    for (const sh of shaped) if (sh.dy < 0) box.asc = Math.max(box.asc, -sh.dy + MET.a * sh.em);
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
    const glyphs = []; const decos = [];
    // العلامة تتدلّى يمين حافّة النصّ (في الهامش) — لا تُزيح النصّ نفسه
    if (li === 0 && marker) {
      let gx = rightEdge;
      for (const g of marker.glyphs) { glyphs.push({ gid: g.gid, x: Math.round(gx * 100) / 100 }); gx += g.adv; }
    }
    let penX = rightEdge;
    for (let k = 0; k < shaped.length; k++) {
      const s = shaped[k];
      const left = penX - s.width;
      let gx = left;
      for (const g of s.glyphs) {
        const go = { gid: g.gid, x: Math.round(gx * 100) / 100 };
        if (s.em !== em) go.em = s.em;      // حجمٌ خاصّ (رفع/خفض)
        if (s.dy) go.dy = Math.round(s.dy * 100) / 100;
        if (s.color) go.fill = s.color;     // لونُ النصّ (w:color/themeColor)
        glyphs.push(go); gx += g.adv + (s.csp || 0);
      }
      // زخارفُ الكلمة: تظليلٌ خلفها، وتسطيرٌ/شطبٌ خطوطًا — بإحداثيّات السطر
      if (s.highlight || s.underline || s.strike || s.dstrike) {
        const met = (metrics[wMetaFam(wMeta, ln.start + k, p)] || MET);
        decos.push({ x: left, w: s.width, dy: s.dy || 0, em: s.em,
          highlight: s.highlight || null, underline: s.underline || null,
          ucolor: s.ucolor || s.color || null, color: s.color || null,
          strike: !!s.strike, dstrike: !!s.dstrike,
          asc: met.a * s.em, desc: (met.d + met.g) * s.em });
      }
      const gi2 = ln.start + k + 1;
      const nxt = tabGap[gi2];
      penX = left - (nxt != null ? nxt : gap);
      // قائدُ الجدولة (نقاط/شرطات) يملأ الفجوة — نفسُ محارف مسار الفهرس
      if (nxt != null && tabLead[gi2] && nxt > 0) {
        const lch = tabLead[gi2] === "hyphen" ? "-" : tabLead[gi2] === "underscore" ? "_"
          : tabLead[gi2] === "middleDot" ? "·" : ".";
        const lg = shapeWord(lch, em, fo);
        if (lg.width > 0) {
          const n = Math.floor(nxt / lg.width);
          let lx = left - lg.width;          // من حافّة الكلمة الحاليّة نحو اليسار
          for (let d = 0; d < n; d++) {
            let gx = lx;
            for (const g of lg.glyphs) { glyphs.push({ gid: g.gid, x: Math.round(gx * 100) / 100 }); gx += g.adv; }
            lx -= lg.width;
          }
        }
      }
    }
    descs.push({ glyphs, decos, asc: box.asc, desc: box.desc, extraWd: box.extraWd, mlt: lineMultiplier(p.spacing), text: lineWords.join(" ") });
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
  const gsec2 = model.sections[p.sectionIndex] ?? sec;
  const NCOL = Math.max(1, gsec2.colCount || 1);
  const COLSTEP = (gsec2.colWidthTwips ?? sec.columnTwips) + (gsec2.colSpaceTwips ?? 0);
  const yArr = new Array(n), pgArr = new Array(n), colArr = new Array(n);
  let b = baseline, pd = prevDesc, pg = pendingGap;
  let slot = cur * NCOL + curCol;
  const slotInit = slot;
  let pageHasPrior = (slotCount[slot] ?? 0) > 0; // محتوًى سابقٌ في هذه الخانة
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
      slot++; b = pageStartB; pd = null; pg = 0;   // الخانةُ التالية: عمودٌ ثمّ صفحة
      pageHasPrior = false; paraFirstOnPage = bi; i = bi; atPageTop = true;
      continue;
    }
    yArr[i] = nb; pgArr[i] = Math.floor(slot / NCOL); colArr[i] = slot % NCOL;
    slotCount[slot] = (slotCount[slot] ?? 0) + 1;
    pg = 0; atPageTop = false;
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
    // المحارفُ رُصِفت على أنّها في العمود الأوّل؛ العمودُ c يُزاح يسارًا c×(عرض+فاصل)
    const dx = colArr[i] ? -colArr[i] * COLSTEP : 0;
    const gl = dx ? descs[i].glyphs.map((g) => ({ ...g, x: Math.round((g.x + dx) * 100) / 100 })) : descs[i].glyphs;
    const lineObj = { y: Math.round(yOut * 100) / 100, em, font: fo.file, glyphs: gl, text: descs[i].text };
    if (descs[i].decos?.length) lineObj.decos = dx
      ? descs[i].decos.map((d) => ({ ...d, x: Math.round((d.x + dx) * 100) / 100 }))
      : descs[i].decos;
    pages[pgArr[i]].push(lineObj);
    if (curTable && p.tableCell) curTable.lines.push({ pg: pgArr[i], o: lineObj }); // لنقل الصفّ إن لزم
  }
  // حالة ما بعد الفقرة (للفقرة التالية)
  // حواشي هذه الفقرة تنتمي إلى الصفحة التي وقع فيها سطرُها الأوّل
  if (n > 0) for (const r of p.runs) if (r.noteRef) {
    if (r.noteRef.kind === "footnote") {
      const pg = pgArr[0];
      if (!notesByPage.has(pg)) notesByPage.set(pg, []);
      notesByPage.get(pg).push(r.noteRef);
    } else endnoteRefs.push(r.noteRef);   // الختاميّة تُرصَف في آخر المستند
  }
  baseline = b; prevDesc = pd; pendingGap = 0;
  if (p.pBdr?.bottom) pendingGap += p.pBdr.bottom.wTwips + p.pBdr.bottom.spaceTwips;
  cur = pgArr[n - 1]; curCol = colArr[n - 1];
  if (curTable && p.tableCell) {
    curTable.maxBottom = Math.max(curTable.maxBottom, baseline + (prevDesc || 0));
    if (n > 0) { const top = yArr[0] - descs[0].asc; // أعلى أوّل سطرٍ فعليّ لهذه الخليّة
      curTable.rowTop = curTable.rowTop == null ? top : Math.min(curTable.rowTop, top); }
  }
  for (let q = curInit; q <= cur; q++) if (pageSec[q] === undefined) pageSec[q] = p.sectionIndex;
  pageAnchor = (cur * NCOL + curCol) === slotInit ? pageAnchorInit : pageStartB;
  if (p.columnBreak) pendingColBreak = true;
  prev = { spacing: p.spacing, after: p.spacing?.after, styleId: p.styleId, contextual: hasContextual(p) };
}

finishRow(curTable); // اختم آخر صفٍّ في المستند

// ── ترصيفُ الحواشي أسفلَ صفحاتها (حصاد «الشاملة الذهبية»؛ مقيسٌ على Word) ──
// Word يضع نصوصَ الحواشي في أسفل منطقة النصّ بترتيب مراجعها، كلٌّ مسبوقةٌ برقمها.
// نرصّفها من الأسفل: نحسب ارتفاعها الكلّيّ ثمّ نبدأ من (أسفل المنطقة − الارتفاع).
for (const [pgIdx, refs] of notesByPage) {
  if (!pages[pgIdx]) continue;
  const built = [];
  for (const ref of refs) {
    const paras = model.footnotes.get(String(ref.id)) || [];
    for (const fp of paras) {
      const fem = fp.runs[0]?.emTwips || 200; // حجمُ الحاشية الافتراضيّ
      const ffo = getFont(fp.runs[0]?.family || MAIN_FAMILY);
      const fmet = ffo.met;
      const fwords = (String(ref.num) + " " + fp.text).trim().split(/\s+/).filter(Boolean);
      if (!fwords.length) continue;
      const fsp = shapeWord(" ", fem, ffo).width;
      const fitems = fwords.map((w, i) => ({ width: shapeWord(w, fem, ffo).width,
        spaceBefore: i ? fsp : 0, blankBefore: i > 0, trailingOverhang: 0 }));
      const flines = breakLines(fitems, { columnTwips: sec.columnTwips, firstLineIndentTwips: 0,
        justified: false, compatibilityMode: model.compatibilityMode });
      const fmlt = lineMultiplier(fp.spacing);
      flines.forEach((fl, k) => built.push({ words: fwords.slice(fl.start, fl.end), fem, ffo, fmet, fsp,
        mlt: fmlt, after: k === flines.length - 1 ? (fp.spacing?.after || 0) : 0 }));
    }
  }
  if (!built.length) continue;
  const lineH = (b) => (b.fmet.a + b.fmet.d + b.fmet.g) * b.fem * (b.mlt || 1) + (b.after || 0);
  const total = built.reduce((a, b) => a + lineH(b), 0);
  let fy = (pageH - marB) - total + built[0].fmet.a * built[0].fem; // أوّل أساسٍ للحواشي
  for (const b of built) {
    const shaped = b.words.map((w) => shapeWord(w, b.fem, b.ffo));
    const glyphs = []; let penX = pageW - marR;
    for (const sh of shaped) {
      const left = penX - sh.width; let gx = left;
      for (const g of sh.glyphs) { glyphs.push({ gid: g.gid, x: Math.round(gx * 100) / 100 }); gx += g.adv; }
      penX = left - b.fsp;
    }
    pages[pgIdx].push({ y: Math.round(fy * 100) / 100, em: b.fem, font: b.ffo.file, glyphs,
      text: b.words.join(" "), footnote: true });
    fy += lineH(b);
  }
}
// ── التعليقاتُ الختاميّة (endnotes): تُرصَف متتابعةً في آخر المستند ──
// خلافُ الحاشية التي تلزم صفحةَ مرجعها، الختاميّةُ تُجمَع كلُّها في نهايته.
if (endnoteRefs.length && process.env.ENDNOTES !== "0") {
  let ey = null, epage = pages.length - 1;
  for (const ref of endnoteRefs) {
    for (const ep of model.endnotes.get(String(ref.id)) || []) {
      const eem = ep.runs[0]?.emTwips || 200;
      const efo = getFont(ep.runs[0]?.family || MAIN_FAMILY);
      const words = (String(ref.num) + " " + ep.text).trim().split(/\s+/).filter(Boolean);
      if (!words.length) continue;
      const esp = shapeWord(" ", eem, efo).width;
      const items = words.map((w, i) => ({ width: shapeWord(w, eem, efo).width,
        spaceBefore: i ? esp : 0, blankBefore: i > 0, trailingOverhang: 0 }));
      const els = breakLines(items, { columnTwips: sec.columnTwips, firstLineIndentTwips: 0,
        justified: false, compatibilityMode: model.compatibilityMode });
      const mlt = lineMultiplier(ep.spacing);
      const pitch = (efo.met.a + efo.met.d + efo.met.g) * eem * mlt;
      for (const l of els) {
        if (ey == null) ey = marT + efo.met.a * eem;      // نبدأ من أعلى منطقة النصّ
        if (ey > pageH - marB) { pages.push([]); epage = pages.length - 1; ey = marT + efo.met.a * eem; }
        emitBoxLine(epage, words.slice(l.start, l.end).join(" "), eem, efo, ey, ep.jc,
          sec.marLeftTwips, sec.columnTwips, "endnote");
        ey += pitch;
      }
    }
  }
}

// ── الترويسة والتذييل (حصاد «الشاملة الذهبية»؛ مقيساً على Word) ──
// الاختيار لكلّ صفحة: first (مع titlePg) ← even (مع evenAndOddHeaders) ← default.
// الرأسيّ: قيسَ من ahadith (الأساس 16010.4 ثابتاً في كلّ الصفحات):
//   أسفلُ صندوق سطر التذييل ينطبق على (pageH − footerDist)، فالأساس = ذلك − (d+g)×em.
//   (16838 − 708 − 0.500488×240 = 16009.9 مقابل 16010.4 في Word — فرق 0.5tw.)
// والترويسة بالعكس: أعلى صندوقها عند headerDist فالأساس = headerDist + a×em.
/** يرصّف فقرات مربّع نصٍّ داخل صندوقه: لفٌّ عند عرضه الداخليّ، واحترامُ فواصل
 *  الأسطر اليدويّة. الحشواتُ الافتراضيّة في OOXML: ‏tIns/bIns=45720EMU=72tw،
 *  ‏lIns/rIns=91440EMU=144tw (وهي ما يستعمله Word ما لم يُصرَّح بغيرها). */
/** يرصّف فقرات مربّع نصٍّ داخل صندوقه: لفٌّ عند عرضه الداخليّ، واحترامُ فواصل
 *  الأسطر اليدويّة، والرسوّ العموديّ من wps:bodyPr@anchor (‏tadris وmuqtarah
 *  يوسّطان: anchor="ctr"). الحشواتُ من bodyPr أيضًا لا مُقدَّرة. */
function emitBoxParas(pgIdx, paras, boxLeft, boxTop, boxWidth, boxHeight, ins, anchor, pageNo, total, tag) {
  const I = ins ?? { t: 72, b: 72, l: 144, r: 144 };
  const inner = Math.max(200, boxWidth - I.l - I.r);
  // مرحلة ١: نبني الأسطر ونقيس ارتفاعها الكلّيّ (يلزم للرسوّ الأوسط/الأسفل).
  const built = [];
  for (const q of paras) {
    const q0 = q.runs.find((r) => !r.hidden) ?? q.runs[0];
    const qem = q0?.emTwips || 200;
    const qfo = getFont(q0?.family || MAIN_FAMILY);
    const mlt = lineMultiplier(q.spacing);
    for (const segment of hfText(q, pageNo, total).split("\n")) {
      const words = segment.trim().split(/\s+/).filter(Boolean);
      if (!words.length) { built.push({ blank: true, qem, qfo, mlt, jc: q.jc }); continue; }
      const sp = shapeWord(" ", qem, qfo).width;
      const items = words.map((w, i) => ({ width: shapeWord(w, qem, qfo).width,
        spaceBefore: i ? sp : 0, blankBefore: i > 0, trailingOverhang: 0 }));
      const ls = breakLines(items, { columnTwips: inner, firstLineIndentTwips: 0,
        justified: false, compatibilityMode: model.compatibilityMode });
      for (const l of ls)
        built.push({ text: words.slice(l.start, l.end).join(" "), qem, qfo, mlt, jc: q.jc });
    }
  }
  if (!built.length) return;
  const lineH = (b) => (b.qfo.met.a + b.qfo.met.d + b.qfo.met.g) * b.qem * b.mlt;
  const totalH = built.reduce((a, b) => a + lineH(b), 0);
  // مرحلة ٢: الرسوّ العموديّ (wps:bodyPr@anchor) — ctr يوسّط الكتلة في الصندوق الداخليّ.
  // الصندوقُ ينمو لنصّه (‏vertOverflow="overflow" وautofit في Word): إن فاض النصُّ
  // عن extentH فالارتفاعُ الفعليّ هو ارتفاعُ النصّ، فيصير الرسوّ الأوسط بلا أثرٍ
  // ويبدأ النصّ من الأعلى — وهو ما يفعله Word. (قياسٌ: التوسيطُ بـextentH وحده
  // رفع أسطر tadris ١٠٧٠tw عن مواضعها في Word.)
  const effH = Math.max(boxHeight || 0, totalH + I.t + I.b);
  const availTop = boxTop + I.t, availH = Math.max(0, effH - I.t - I.b);
  let y = anchor === "ctr" ? availTop + (availH - totalH) / 2
        : anchor === "b" ? availTop + (availH - totalH)
        : availTop;
  for (const b of built) {
    if (!b.blank) {
      emitBoxLine(pgIdx, b.text, b.qem, b.qfo, y + b.qfo.met.a * b.qem * b.mlt,
        b.jc, boxLeft + I.l, inner, tag);
    }
    y += lineH(b);
  }
}
const HF = process.env.HF !== "0";
// مرجعٌ من نوعٍ ما: إن أغفله المقطع ورثه من سابقه (‏Link to Previous في Word).
function refFor(kind, si, type) {
  for (let i = si; i >= 0; i--) {
    const r = (kind === "header" ? model.sections[i]?.headerRefs : model.sections[i]?.footerRefs) ?? {};
    if (r[type]) return r[type];
  }
  return null;
}
function hfParas(kind, pageNo, si) {
  const gs = model.sections[si] ?? sec;
  let rid;
  if (gs.titlePg && pageNo === 1) rid = refFor(kind, si, "first"); // صفحةُ العنوان تخلو إن غاب first
  else if (model.evenAndOddHeaders && pageNo % 2 === 0)
    rid = refFor(kind, si, "even") ?? refFor(kind, si, "default");
  else rid = refFor(kind, si, "default");
  if (!rid) return [];
  const tgt = model.relTargets?.get(rid);
  if (!tgt) return [];
  return model.headerFooters.get(tgt.split("/").pop()) ?? [];
}
/** نصُّ فقرةٍ بعد حلّ حقولها: رنُّ نتيجة PAGE/NUMPAGES يُستبدل بالرقم الفعليّ. */
function hfText(par, pageNo, total) {
  let out = "";
  for (const r of par.runs) {
    if (r.hidden) continue;
    if (r.fieldResult === "PAGE") out += String(pageNo);
    else if (r.fieldResult === "NUMPAGES") out += String(total);
    else out += r.text;
  }
  return out;
}
/** يرصّف سطراً مفرداً (ترويسة/تذييل/مربّع نصّ) ويدفعه إلى صفحته. */
function emitBoxLine(pgIdx, text, em, fo, baseline, jc, boxLeft, boxWidth, tag) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return;
  const sp = shapeWord(" ", em, fo).width;
  const shaped = words.map((w) => shapeWord(w, em, fo));
  const width = shaped.reduce((a, sh) => a + sh.width, 0) + sp * (words.length - 1);
  // المحاذاة داخل صندوقه (RTL: القلم يبدأ من يمين المحتوى)
  let penX = boxLeft + boxWidth;                                  // right / الافتراضيّ في RTL
  if (jc === "center") penX = boxLeft + (boxWidth + width) / 2;
  else if (jc === "left") penX = boxLeft + width;
  const glyphs = [];
  for (const sh of shaped) {
    const left = penX - sh.width; let gx = left;
    for (const g of sh.glyphs) { glyphs.push({ gid: g.gid, x: Math.round(gx * 100) / 100 }); gx += g.adv; }
    penX = left - sp;
  }
  while (pages.length <= pgIdx) pages.push([]);
  pages[pgIdx].push({ y: Math.round(baseline * 100) / 100, em, font: fo.file, glyphs, text, [tag]: true });
}
if (HF) {
  const total = pages.length;
  for (let pi = 0; pi < total; pi++) {
    const pageNo = pi + 1;
    const si = pageSec[pi] ?? pageSec.slice(0, pi).filter((x) => x !== undefined).pop() ?? 0;
    const gs = model.sections[si] ?? sec;
    const colL = gs.marLeftTwips, colW = gs.columnTwips;
    for (const kind of ["header", "footer"]) {
      for (const par of hfParas(kind, pageNo, si)) {
        const r0 = par.runs.find((r) => !r.hidden) ?? par.runs[0];
        const em = r0?.emTwips || 240;
        const fo = getFont(r0?.family || MAIN_FAMILY);
        const base = kind === "footer"
          ? (gs.pageHTwips - (gs.footerDistTwips ?? 720)) - (fo.met.d + fo.met.g) * em
          : (gs.headerDistTwips ?? 720) + fo.met.a * em;
        emitBoxLine(pi, hfText(par, pageNo, total), em, fo, base, par.jc, colL, colW, kind);
        // مربّعات النصّ المرساة في الجزء (masjid/tadris يضعان رقم الصفحة فيها)
        for (const a of par.anchors ?? []) {
          if (!a.textBox) continue;
          // RTL: إزاحةُ المرساة من حافة العمود — نفسُ قاعدة الصور العائمة
          const bx = colL + a.posHOffset, bw = a.extentW || colW;
          for (const q of a.textBox) {
            const q0 = q.runs.find((r) => !r.hidden) ?? q.runs[0];
            const qem = q0?.emTwips || em;
            const qfo = getFont(q0?.family || r0?.family || MAIN_FAMILY);
            const qb = base + a.posVOffset + qfo.met.a * qem;
            emitBoxLine(pi, hfText(q, pageNo, total), qem, qfo, qb, q.jc, bx, bw, kind);
          }
        }
      }
    }
  }
}

const out = { source: "our-engine", unit: "twip", mainFont: MAIN_FILE,
  pageW, pageH, docx: `corpus/books/${BOOK}.docx`,
  pages: pages.map((lines, pi) => ({ w: pageW, h: pageH, lines,
    anchors: imgAnchors.filter((a) => a.page === pi),
    cells: tableCells.filter((c) => c.page === pi && c.h > 0) })) };
writeFileSync(OUT, JSON.stringify(out), "utf8");
console.log(`محرّكنا: ${pages.length} صفحة، ${pages.reduce((a, p) => a + p.length, 0)} سطرًا -> ${OUT}`);
console.log(`صفحة 1: ${pages[1]?.length ?? 0} سطر، أول baseline=${pages[1]?.[0]?.y?.toFixed(1)}`);
