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

const BOOK = "sample-muqtarah";
const FONT_FILE = "corpus/book-fonts/Al-Jazeera-Arabic-Light.ttf";
const FAMILY = "Al-Jazeera-Arabic-Light";
const MET = { a: 1.0542, d: 0.60205, g: 0.03418, wd: 0.29395, wa: 1.0542 };
const OUT = process.argv[2] || "ours.json";

const model = extractFromDocx(readFileSync(`corpus/books/${BOOK}.docx`));
const numbering = loadNumbering(`corpus/books/${BOOK}.docx`);
const counters = {};
const face = new Face(new Blob(readFileSync(FONT_FILE)), 0);
const font = new Font(face); const upem = face.upem;

/** يشكّل كلمةً مفردة (guessSegmentProperties يكتشف الاتّجاه: أرقام LTR، عربيّة RTL).
 *  HarfBuzz يُخرج المحارف دومًا بترتيبٍ بصريّ يسار→يمين مهما كان الاتّجاه. */
function shapeWord(w, em) {
  const b = new HbBuffer(); b.addText(w); b.guessSegmentProperties(); shape(font, b, []);
  const infos = b.getGlyphInfos(), poss = b.getGlyphPositions();
  const glyphs = infos.map((g, i) => ({ gid: g.codepoint, adv: (poss[i].xAdvance / upem) * em }));
  return { glyphs, width: glyphs.reduce((a, g) => a + g.adv, 0) };
}
const wordWidth = (w, em) => shapeWord(w, em).width;

const sec = model.sections[0];
const { pageWTwips: pageW, pageHTwips: pageH, marRightTwips: marR, marTopTwips: marT, marBottomTwips: marB } = sec;

const paras = model.paragraphs.filter((p) =>
  !p.excluded && p.sectionIndex === 0 && p.text.trim() &&
  p.runs.every((r) => r.family === FAMILY && r.emTwips));

const pages = [[]]; let cur = 0;
let baseline = marT + pageStartAscent(MET, paras[0].runs[0].emTwips, paras[0].spacing);
let prev = null;

for (let pi = 0; pi < paras.length; pi++) {
  const p = paras[pi]; const em = p.runs[0].emTwips;
  const colBase = sec.columnTwips - p.indLeft - p.indRight;
  const rightEdge = pageW - marR;
  const spaceW = wordWidth(" ", em) || wordWidth(" ", em);
  const words = p.text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) continue;
  const items = words.map((w, i) => ({ width: wordWidth(w, em), spaceBefore: i ? spaceW : 0, blankBefore: i > 0 }));
  const lines = breakLines(items, { columnTwips: colBase, firstLineIndentTwips: p.indFirstLine || 0,
    justified: true, compatibilityMode: model.compatibilityMode });

  if (pi > 0 && prev) baseline += singlePitch(MET, em) * lineMultiplier(prev.spacing) + (prev.after || 0);

  // علامة الترقيم (numPr): تُرسم على السطر الأوّل وتزيح بدايته (تعليق)
  let marker = null;
  if (p.numbered) {
    const ninfo = numbering.byText.get(numbering.norm(p.text));
    const mstr = ninfo ? markerText(numbering, ninfo.numId, ninfo.ilvl, counters) : null;
    if (mstr) {
      const mg = shapeWord(mstr, em);
      const textStart = numTabTextStart({ indLeftTwips: p.indLeft,
        hangingTwips: p.indFirstLine < 0 ? -p.indFirstLine : 0,
        markerWidthTwips: mg.width, defaultTabStopTwips: model.defaultTabStop });
      marker = { glyphs: mg.glyphs, width: mg.width, indent: Math.max(0, textStart - p.indLeft) };
    }
  }

  for (let li = 0; li < lines.length; li++) {
    const ln = lines[li];
    const lineWords = words.slice(ln.start, ln.end);
    const shaped = lineWords.map((w) => shapeWord(w, em));
    const wordsW = shaped.reduce((a, s) => a + s.width, 0);
    const nSpaces = lineWords.length - 1;
    const natural = wordsW + nSpaces * spaceW;
    const isLast = li === lines.length - 1;
    const markerIndent = (li === 0 && marker) ? marker.indent : 0;
    const W = colBase - (li === 0 ? Math.max(0, p.indFirstLine || 0) + markerIndent : 0);
    const extra = (!isLast && !ln.forced && nSpaces > 0) ? (W - natural) / nSpaces : 0;
    const gap = spaceW + extra;

    if (baseline > pageH - marB) { pages.push([]); cur++; baseline = marT + pageStartAscent(MET, em, p.spacing); }

    // وضعٌ RTL: أوّل كلمةٍ (منطقيًّا) أقصى اليمين؛ المحارف داخل الكلمة يسار→يمين
    const glyphs = [];
    // العلامة في منطقة التعليق (يمين بداية النصّ)
    if (li === 0 && marker) {
      let gx = rightEdge - markerIndent;
      for (const g of marker.glyphs) { glyphs.push({ gid: g.gid, x: Math.round(gx * 100) / 100 }); gx += g.adv; }
    }
    let penX = rightEdge - markerIndent;
    for (const s of shaped) {
      const left = penX - s.width;
      let gx = left;
      for (const g of s.glyphs) { glyphs.push({ gid: g.gid, x: Math.round(gx * 100) / 100 }); gx += g.adv; }
      penX = left - gap;
    }
    pages[cur].push({ y: Math.round(baseline * 100) / 100, em, glyphs });
    baseline += singlePitch(MET, em) * lineMultiplier(p.spacing);
  }
  prev = { spacing: p.spacing, after: p.spacing?.after };
}

const out = { source: "our-engine", unit: "twip", font: FONT_FILE, upem,
  pageW, pageH, pages: pages.map((lines) => ({ w: pageW, h: pageH, lines })) };
writeFileSync(OUT, JSON.stringify(out), "utf8");
console.log(`محرّكنا: ${pages.length} صفحة، ${pages.reduce((a, p) => a + p.length, 0)} سطرًا -> ${OUT}`);
console.log(`صفحة 1: ${pages[1]?.length ?? 0} سطر، أول baseline=${pages[1]?.[0]?.y?.toFixed(1)}`);
