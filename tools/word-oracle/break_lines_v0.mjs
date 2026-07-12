#!/usr/bin/env node
/** الكاسر البدائي v0 + أول رقم شمالي حقيقي (تطابق أسطر).
 *
 * المنهج (مستقل عن محلل docx عمدًا — يختبر «قرار الكسر» معزولًا):
 *   1. من الحقيقة: نبني «كتلًا نصية» — أسطر متتالية متقاربة الحدود الأفقية
 *      (نفس العمود) بخط adwa-assalaf، ‏3 أسطر فأكثر = فقرة مرشحة.
 *   2. نص الفقرة = ضم أسطر Word (داخل السطر: المقاطع بترتيب x تنازليًا — RTL).
 *   3. كاسرنا: تشكيل كل كلمة بالخط الأصلي (أعراض طبيعية غير مسوَّغة —
 *      وهو نفس ما يبني عليه Word قرار الكسر قبل التسويغ)، ملء greedy بعرض
 *      العمود، والمسافة الختامية لا تُحسب (سلوك Word).
 *   4. المقارنة: تسلسل كلمات كل سطر عندنا ≡ تسلسل كلمات سطر Word؟
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Blob, Buffer as HbBuffer, Face, Font, shape } from "harfbuzzjs";

const truth = JSON.parse(readFileSync("corpus/ground-truth/sample-masjid.truth.json", "utf-8"));
const fmap = JSON.parse(readFileSync("corpus/ground-truth/fonts/sample-masjid/fonts-map.json", "utf-8"));
const adwaFiles = new Set(Object.keys(fmap).filter((k) => fmap[k].family === "adwa-assalaf"));

const face = new Face(new Blob(readFileSync("corpus/book-fonts/adwa-assalaf.ttf")), 0);
const font = new Font(face);
const upem = face.upem;

const widthCache = new Map();
function widthTwips(text, emTwips) {
  const key = text + "@" + emTwips;
  if (widthCache.has(key)) return widthCache.get(key);
  const buf = new HbBuffer();
  buf.addText(text);
  buf.guessSegmentProperties();
  shape(font, buf);
  let u = 0;
  for (const p of buf.getGlyphPositions()) u += p.xAdvance;
  const w = (u / upem) * emTwips;
  widthCache.set(key, w);
  return w;
}

// ---- 1) بناء الكتل النصية من الحقيقة
const SPAN_TOL = 90; // twips — تسامح حدود العمود
const blocks = [];
for (const pg of truth.pages) {
  let cur = null;
  for (const ln of pg.lines) {
    const rs = ln.runs.filter((r) => adwaFiles.has(r.font) && r.text.trim());
    const pure = rs.length && rs.length === ln.runs.filter((r) => r.text.trim()).length;
    if (!pure) { cur = null; continue; }
    const em = rs[0].emTwips;
    const fits = cur && Math.abs(ln.xMax - cur.right) <= SPAN_TOL &&
                 ln.xMin >= cur.left - SPAN_TOL && cur.em === em;
    if (!fits) { cur = { left: ln.xMin, right: ln.xMax, em, lines: [] }; blocks.push(cur); }
    else cur.left = Math.min(cur.left, ln.xMin);
    // نص السطر بالترتيب المنطقي RTL: المقاطع من اليمين لليسار.
    // ‏Word قد يشطر الكلمة الواحدة على مقطعين متلاصقين — لا مسافة بينهما إلا
    // إذا وُجدت فجوة هندسية فعلية (> عتبة) أو كانت نصوص الحواف مسافات أصلًا.
    const sorted = [...rs].sort((a, b) => b.x - a.x);
    const GAP_TOL = 25; // twips
    let logical = "";
    let prevLeftEdge = null; // الحافة اليسرى للمقطع السابق (RTL: نهاية القراءة)
    for (const r of sorted) {
      const adv = r.advSumTwips ?? 0;
      const rightEdge = r.bidiLevel % 2 === 1 ? r.x : r.x + adv;
      const leftEdge = r.bidiLevel % 2 === 1 ? r.x - adv : r.x;
      const gap = prevLeftEdge == null ? 0 : prevLeftEdge - rightEdge;
      const needSpace =
        logical !== "" &&
        (gap > GAP_TOL || /\s$/.test(logical) === false && /^\s/.test(r.text)) &&
        !/\s$/.test(logical);
      logical += (needSpace ? " " : "") + r.text;
      prevLeftEdge = leftEdge;
    }
    cur.lines.push({ t: logical.replace(/\s+/g, " ").trim(), xMax: ln.xMax, xMin: ln.xMin });
  }
}

// تقسيم كل كتلة إلى فقرات: السطر المخلخل (لا يبلغ حافة العمود) نهايةُ فقرة —
// إعادة التدفق عبر حدود الفقرات كانت مصدر الفشل المتسلسل.
const RAGGED_TOL = 200; // twips
for (const b of blocks) {
  const paras2 = [];
  let p = [];
  for (const ln of b.lines) {
    p.push(ln.t);
    if (b.right - ln.xMax > RAGGED_TOL) { paras2.push(p); p = []; }
  }
  if (p.length) paras2.push(p);
  b.paraLines = paras2;
}
// استبعاد كتل الفهرس/الجداول: سطور بقادة نقاط/شرطات طويلة أو المنتهية برقم صفحة
// بعد قائد — هذه مداخل مستقلة لا فقرة متدفقة، وكسرها ليس قرار line-breaking.
const isTocLike = (t) => /[-–—ـ.]{6,}/.test(t);
const paras = [];
for (const b of blocks) {
  for (const pl of b.paraLines ?? []) {
    if (pl.length < 2) continue;                       // فقرة سطر واحد لا تختبر الكسر
    if (pl.filter(isTocLike).length) continue;          // مداخل فهرس
    paras.push({ left: b.left, right: b.right, em: b.em, lines: pl });
  }
}

// ---- 2) الكاسر + المقارنة
let linesTotal = 0, linesMatched = 0;
const failures = [];
for (const b of paras) {
  const W = b.right - b.left;
  const words = b.lines.join(" ").split(" ").filter(Boolean);
  const spaceW = widthTwips(" ", b.em);
  const ourLines = [];
  let line = [], w = 0;
  for (const word of words) {
    const ww = widthTwips(word, b.em);
    const need = line.length ? w + spaceW + ww : ww;
    if (line.length && need > W) { ourLines.push(line); line = [word]; w = ww; }
    else { line.push(word); w = need; }
  }
  if (line.length) ourLines.push(line);

  const wordLines = b.lines.map((t) => t.split(" ").filter(Boolean));
  for (let i = 0; i < wordLines.length; i++) {
    linesTotal++;
    const ok = i < ourLines.length && wordLines[i].join("") === ourLines[i].join("");
    if (ok) linesMatched++;
    else if (failures.length < 6)
      failures.push({ block: paras.indexOf(b), i, W,
        word: wordLines[i]?.slice(0, 8).join(" "), ours: ourLines[i]?.slice(0, 8).join(" ") });
  }
}

const pct = linesTotal ? ((100 * linesMatched) / linesTotal).toFixed(2) : "0";
console.log(`كتل نصية مؤهلة (≥3 أسطر): ${paras.length} | أسطر: ${linesTotal}`);
console.log(`★ الرقم الشمالي (تطابق أسطر): ${linesMatched}/${linesTotal} = ${pct}%`);
for (const f of failures) console.log("  فشل:", JSON.stringify(f));
writeFileSync("corpus/ground-truth/linebreak-report.json",
  JSON.stringify({ paras: paras.length, linesTotal, linesMatched, pct: Number(pct), failures }, null, 1));
