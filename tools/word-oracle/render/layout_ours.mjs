#!/usr/bin/env node
/** مُركِّب PoC: يحسب ترصيف الصفحة بـ**محرّكنا وحده** (لا Word):
 *  breakLines (كسرنا) + قواعدنا العموديّة + تشكيل HarfBuzz + تسويغنا.
 *  يُخرج المواقع المحسوبة بصيغة truth.json ليرسمها render_page.py ونقارنها بـWord.
 *  الاستخدام: node layout_ours.mjs  (muqtarah فقط حاليًّا)  > ours.json */
import { readFileSync, writeFileSync } from "node:fs";
import { Blob, Buffer as HbBuffer, Face, Font, shape } from "harfbuzzjs";
import { extractFromDocx } from "../../../packages/ooxml-model/dist/index.js";
import { breakLines, pageStartAscent, singlePitch, lineMultiplier } from "../../../packages/layout/dist/index.js";

const BOOK = "sample-muqtarah";
const FONT_FILE = "corpus/book-fonts/Al-Jazeera-Arabic-Light.ttf";
const FAMILY = "Al-Jazeera-Arabic-Light";
const MET = { a: 1.0542, d: 0.60205, g: 0.03418, wd: 0.29395, wa: 1.0542 };
const OUT = process.argv[2] || "ours.json";

const model = extractFromDocx(readFileSync(`corpus/books/${BOOK}.docx`));
const face = new Face(new Blob(readFileSync(FONT_FILE)), 0);
const font = new Font(face); const upem = face.upem;

function shapeText(text, em) {
  const b = new HbBuffer(); b.addText(text); b.guessSegmentProperties(); shape(font, b, []);
  const infos = b.getGlyphInfos(), poss = b.getGlyphPositions();
  return infos.map((g, i) => ({ gid: g.codepoint, cluster: g.cluster, adv: (poss[i].xAdvance / upem) * em }));
}
const widthOf = (t, em) => shapeText(t, em).reduce((a, g) => a + g.adv, 0);

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
  const spaceW = widthOf(" ", em);
  const words = p.text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 1) continue;
  const items = words.map((w, i) => ({ width: widthOf(w, em), spaceBefore: i ? spaceW : 0, blankBefore: i > 0 }));
  const lines = breakLines(items, { columnTwips: colBase, firstLineIndentTwips: p.indFirstLine || 0,
    justified: true, compatibilityMode: model.compatibilityMode });

  // حدّ الفقرات: خطوةُ سطرٍ (بمضاعف الفقرة السابقة) + فراغ after السابقة
  if (pi > 0 && prev) baseline += singlePitch(MET, em) * lineMultiplier(prev.spacing) + (prev.after || 0);

  for (let li = 0; li < lines.length; li++) {
    const ln = lines[li];
    const lineWords = words.slice(ln.start, ln.end);
    const lineText = lineWords.join(" ");
    const glyphs = shapeText(lineText, em);
    const natural = glyphs.reduce((a, g) => a + g.adv, 0);
    const isLast = li === lines.length - 1;
    const W = colBase - (li === 0 ? Math.max(0, p.indFirstLine || 0) : 0);
    const nSpaces = (lineText.match(/ /g) || []).length;
    const extra = (!isLast && !ln.forced && nSpaces > 0) ? (W - natural) / nSpaces : 0;

    if (baseline > pageH - marB) { pages.push([]); cur++; baseline = marT + pageStartAscent(MET, em, p.spacing); }

    let penX = rightEdge;
    const gids = [], advs = [];
    for (const g of glyphs) {
      let adv = g.adv;
      if (lineText[g.cluster] === " ") adv += extra;
      penX -= adv;
      gids.push(g.gid); advs.push(adv);
    }
    // موضع الـrun: أقصى يمين = rightEdge؛ نخزّن x = penX الأيسر للـrun كاملًا
    pages[cur].push({ x: penX, yF: baseline, emTwips: em, gids, advs });
    baseline += singlePitch(MET, em) * lineMultiplier(p.spacing);
  }
  prev = { spacing: p.spacing, after: p.spacing?.after };
}

// أخرِج بصيغة truth.json (run واحد لكل سطر، RTL: x=يسار، لكن render يتوقّع x=بداية منطقيّة)
const out = { source: "our-engine", unit: "twip", pageCount: pages.length,
  pages: pages.map((lines) => ({ widthTwips: pageW, heightTwips: pageH,
    lines: lines.map((l) => ({ baselineTwips: Math.round(l.yF), baselineTwipsF: l.yF, xMin: l.x, xMax: l.x,
      text: "", runs: [{ text: "", x: l.x + l.advs.reduce((a, b) => a + b, 0), yF: l.yF, y: Math.round(l.yF),
        emTwips: l.emTwips, font: "ORIG", bidiLevel: 1, glyphCount: l.gids.length,
        advSumTwips: l.advs.reduce((a, b) => a + b, 0),
        glyphAdvTwips: l.advs, glyphIds: l.gids }] })) })) };
writeFileSync(OUT, JSON.stringify(out), "utf8");
console.log(`محرّكنا: ${pages.length} صفحة، ${pages.reduce((a, p) => a + p.length, 0)} سطرًا -> ${OUT}`);
console.log(`صفحة 1: ${pages[1]?.length ?? 0} سطر، أول baseline=${pages[1]?.[0]?.yF?.toFixed(1)}`);
