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
      abs[id][l[1]] = { fmt, text };
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
  const key = `${numId}:${ilvl}`; counters[key] = (counters[key] || 0) + 1;
  for (const k of Object.keys(counters)) { const [n, l] = k.split(":"); if (n === numId && +l > ilvl) delete counters[k]; }
  const n = counters[key];
  const val = lvl.fmt === "arabicAlpha" ? (ARA_ALPHA[n - 1] || String(n))
    : lvl.fmt === "arabicAbjad" ? (ARA_ALPHA[n - 1] || String(n)) : String(n);
  return lvl.text.replace(/%\d+/g, val);
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
const hasContextual = (p) => contextual.byText.has(contextual.norm(p.text)) || contextual.styleSet.has(p.styleId);
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

const paras = model.paragraphs.filter((p) => !p.excluded && p.text.trim() && p.runs[0]?.emTwips);
const bodySecIdx = (paras.find((p) => p.runs[0]?.family === MAIN_FAMILY) ?? paras[0])?.sectionIndex ?? 0;
const sec = model.sections?.[bodySecIdx] ?? model.section ?? model.sections[0];
const { pageWTwips: pageW, pageHTwips: pageH, marRightTwips: marR, marTopTwips: marT, marBottomTwips: marB } = sec;

const pages = [[]]; let cur = 0;
const fo0 = getFont(paras[0].runs[0].family);
let baseline = marT + pageStartAscent(fo0.met, paras[0].runs[0].emTwips, paras[0].spacing, PS_CAL);
let prev = null, prevDesc = null, pendingGap = 0, pageAnchor = baseline;
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

for (let pi = 0; pi < paras.length; pi++) {
  const p = paras[pi]; const em = p.runs[0].emTwips;
  const fo = getFont(p.runs[0].family); const MET = fo.met;
  const cal = p.runs[0].family === MAIN_FAMILY ? PS_CAL : null;
  const wordWidth = (w) => shapeWord(w, em, fo).width;
  const colBase = sec.columnTwips - p.indLeft - p.indRight;
  const rightEdge = pageW - marR;
  const spaceW = wordWidth(" ", em) || wordWidth(" ", em);
  const words = p.text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) continue;
  // كسرُ صفحةٍ صريح (w:br type=page / w:pageBreakBefore / حدّ مقطع nextPage):
  // الفقرة تبدأ صفحةً جديدة إن كانت الحاليّة غير فارغة — يطابق ترقيم صفحات Word.
  // تُكبَت مسافةُ before أعلى الصفحة (prev=null)، والأساس الأوّل من pageStartAscent.
  if (p.pageBreakBefore && pages[cur].length > 0 && process.env.NOPB !== "1") {
    pages.push([]); cur++;
    baseline = marT + pageStartAscent(MET, em, p.spacing, cal);
    prev = null; prevDesc = null; pendingGap = 0; pageAnchor = baseline;
  }
  const cw = process.env.CTXW === "0" ? null : contextualWidths(words, em, fo);
  const PUNCT = "،؛:.!؟»)";
  const items = words.map((w, i) => {
    const lc = w[w.length - 1];
    const tov = PUNCT.includes(lc) ? Math.min(shapeWord(lc, em, fo).width, 12) : 0;
    return { width: cw ? cw.wordW[i] : wordWidth(w, em), spaceBefore: i ? (cw ? cw.spaceW : spaceW) : 0, blankBefore: i > 0, trailingOverhang: tov };
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
  // بولد الفقرة (آليّة B): كلماتها العريضة
  const boldMet = metrics[`${p.runs[0].family}|bold`];
  const paraRuns = runsByPara.byPara.get(runsByPara.key(p.text));
  const wMeta = paraRuns ? paraWordMeta(paraRuns) : null; // مقاييس كلّ كلمة (بولد/حجم)

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
    let box = { asc: MET.a * em, desc: (MET.d + MET.g) * em };
    if (wMeta && process.env.BOLDBOX !== "0") {
      for (let gi = ln.start; gi < ln.end; gi++) {
        const wm = wMeta[gi]; if (!wm) continue;
        const fam = wm.fam || p.runs[0].family;
        const wsz = (wm.sz && wm.sz > 0) ? wm.sz : em;
        const wmet = (wm.bold && metrics[`${fam}|bold`]) || metrics[fam] || MET;
        box.asc = Math.max(box.asc, wmet.a * wsz);
        box.desc = Math.max(box.desc, (wmet.d + wmet.g) * wsz);
      }
    }
    // الخطوة (نموذج الصندوق): هبوط السابق + صعود الحاليّ + فراغ الحدّ المعلَّق
    if (BOX && prevDesc !== null) baseline += prevDesc + box.asc + pendingGap;
    else if (!BOX) baseline += pendingGap;
    pendingGap = 0;

    if (baseline > pageH - marB) { pages.push([]); cur++; baseline = marT + pageStartAscent(MET, em, p.spacing, cal); prevDesc = null; pageAnchor = baseline; }

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
    // آليّة A (Word، مؤكَّدة LibreOffice+الشبكة+القياس): تراكمٌ float ثم قنص **الإزاحة
    // عن مرساة الصفحة الحقيقيّة** لشبكة نقطة الجهاز (2.4tw @600dpi). LibreOffice: قنص
    // الموضع التراكميّ لا كلّ خطوة. مؤكَّد: 52 سطرًا مُنمّى بلا بولد = عبور نقطةٍ كسريّ.
    const yOut = process.env.DOTSNAP !== "1" ? baseline
      : pageAnchor + Math.round((baseline - pageAnchor) / 2.4) * 2.4;
    pages[cur].push({ y: Math.round(yOut * 100) / 100, em, font: fo.file, glyphs, text: lineWords.join(" ") });
    // هبوط السابق الفعّال يشمل فجوة المضاعف: desc + (asc+desc)×(mult−1)
    if (BOX) { const mlt = lineMultiplier(p.spacing); prevDesc = box.desc + (box.asc + box.desc) * (mlt - 1); }
    else baseline += singlePitch(MET, em) * lineMultiplier(p.spacing);
  }
  prev = { spacing: p.spacing, after: p.spacing?.after, styleId: p.styleId, contextual: hasContextual(p) };
}

const out = { source: "our-engine", unit: "twip", mainFont: MAIN_FILE,
  pageW, pageH, pages: pages.map((lines) => ({ w: pageW, h: pageH, lines })) };
writeFileSync(OUT, JSON.stringify(out), "utf8");
console.log(`محرّكنا: ${pages.length} صفحة، ${pages.reduce((a, p) => a + p.length, 0)} سطرًا -> ${OUT}`);
console.log(`صفحة 1: ${pages[1]?.length ?? 0} سطر، أول baseline=${pages[1]?.[0]?.y?.toFixed(1)}`);
