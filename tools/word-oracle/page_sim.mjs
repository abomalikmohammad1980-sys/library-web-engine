#!/usr/bin/env node
/** المحاكي الكامل للمستند (نواة البعدين) — يرصف **كل** الفقرات من رأس
 *  المستند صفحةً صفحة، ويتنبأ بكل baseline. يعزل النموذج الرأسي عن كسر
 *  الأسطر الأفقي باستعمال محاذاة الحقيقة لعدّ الأسطر ومقاييسها per-run.
 *
 *  لكل صفحة: أول سطرٍ يُرسى على بدايتها المتنبأة (marTop + ascent، القاعدة 8/8ج)،
 *  ثم داخل الصفحة: حدود الفقرات (6+7) وخطوات الأسطر (7). فاصل الصفحة يعيد y.
 *  المقارنة: ‏baseline المتنبأ مقابل الحقيقة، لكل سطر، ضمن TOL.
 *
 *  البيئة: BOOK, FONT_FILE (subset المتن)، TOL (افتراضي 3). */
import { readFileSync } from "node:fs";
import { extractFromDocx } from "../../packages/ooxml-model/dist/index.js";

const BOOK = process.env.BOOK ?? "sample-tadris";
const FONT_FILE = process.env.FONT_FILE ??
  "corpus/ground-truth/fonts/sample-tadris/526A4B1D-1409-14CB-141D-3A12B73FA92B.ttf";
const TOL = Number(process.env.TOL ?? "3");

function fontVertMetrics(path) {
  const buf = readFileSync(path);
  const num = buf.readUInt16BE(4);
  const tables = new Map();
  for (let i = 0; i < num; i++) {
    const o = 12 + i * 16;
    tables.set(buf.toString("ascii", o, o + 4), buf.readUInt32BE(o + 8));
  }
  const head = tables.get("head"), hhea = tables.get("hhea"), os2 = tables.get("OS/2");
  const upem = buf.readUInt16BE(head + 18);
  const a = buf.readInt16BE(hhea + 4) / upem;
  const d = -buf.readInt16BE(hhea + 6) / upem;
  const g = buf.readInt16BE(hhea + 8) / upem;
  const wd = os2 != null ? buf.readUInt16BE(os2 + 76) / upem : d;
  return { a, d, g, wd };
}
const MAIN_MET = fontVertMetrics(FONT_FILE);

// مقاييس per-odttf من خريطة الخطوط
const runMet = new Map();
const famMet = new Map();
try {
  const fm = JSON.parse(readFileSync(`corpus/ground-truth/fonts/${BOOK}/fonts-map.json`, "utf-8"));
  for (const [odttf, info] of Object.entries(fm)) {
    const src = info.subset ?? info.original;
    if (!src) continue;
    try {
      const met = fontVertMetrics(src);
      runMet.set(odttf, met);
      if (info.family && !famMet.has(info.family)) famMet.set(info.family, met);
    } catch { /* لا ملف */ }
  }
} catch { /* لا خريطة */ }

const model = extractFromDocx(readFileSync(`corpus/books/${BOOK}.docx`));
const truth = JSON.parse(readFileSync(`corpus/ground-truth/${BOOK}.truth.json`, "utf-8"));

const norm = (s) => s
  .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
  .replace(/[ـ‎‏؜\s]+/g, "");

// أسطر الحقيقة مسطّحة مع الصفحة
const truthLines = [];
for (let pgI = 0; pgI < truth.pages.length; pgI++) {
  for (const ln of truth.pages[pgI].lines) {
    const rs = ln.runs.filter((r) => r.text.trim());
    const logical = [...rs].sort((a, b) => b.x - a.x).map((r) => r.text).join("");
    const nn = norm(logical);
    if (!nn) continue;
    truthLines.push({ n: nn, y: ln.baselineTwips, page: pgI,
      runFonts: rs.map((r) => ({ font: r.font, em: r.emTwips })) });
  }
}
// رتّب ضمن الصفحة بالـy (ترتيب القراءة الرأسي) — أسطر XPS قد لا تأتي مرتّبة
truthLines.sort((a, b) => a.page - b.page || a.y - b.y);

// مقاييس السطر (القاعدة 7): {asc, desc, gap, ascStart}
function lineMet(p, t, isFirstLine = false) {
  let asc = 0, desc = 0, gap = 0, textAsc = 0;
  for (const r of t.runFonts ?? []) {
    const met = runMet.get(r.font) ?? MAIN_MET;
    const em = Math.round(r.em / 10) * 10;
    asc = Math.max(asc, met.a * em);
    desc = Math.max(desc, met.d * em);
    gap = Math.max(gap, met.g * em);
    textAsc = Math.max(textAsc, met.a);
  }
  if (!asc) return null;
  if (isFirstLine && p.numbered && p.markEmTwips) {
    const mf = (p.markAsciiFamily && famMet.get(p.markAsciiFamily)?.a) ?? textAsc;
    asc = Math.max(asc, mf * p.markEmTwips);
  }
  let ascStart = 0;
  for (const r of t.runFonts ?? []) {
    const met = runMet.get(r.font) ?? MAIN_MET;
    const em = Math.round(r.em / 10) * 10;
    ascStart = Math.max(ascStart, (met.a + met.d + met.g - (met.wd ?? met.d)) * em);
  }
  return { asc, desc, gap, ascStart: Math.max(ascStart, asc) };
}

const R9T = 0.1505;
const inhPlus = (p) => {
  const sp = p.spacing;
  if (sp.line == null || sp.lineSource === "ppr" || sp.lineRule !== "auto") return 0;
  const em = p.runs?.find((r) => r.emTwips)?.emTwips;
  if (!em) return 0;
  const emI = Math.round(em / 10) * 10;
  const met = runMet.get(p.runs.find((r) => r.emTwips)?.family) ?? MAIN_MET;
  const d = ((met.a + met.d + met.g) * emI * sp.line / 240) / 2.4;
  return (d % 1) < R9T ? (Math.ceil(d) - d) * 2.4 : 0;
};

function stepV7(p, ta, tb) {
  const A = lineMet(p, ta), B = lineMet(p, tb);
  if (!A || !B) return null;
  const { line, lineRule } = p.spacing;
  if (line != null && lineRule === "exact") return line;
  const m = line != null && lineRule !== "atLeast" ? line / 240 : 1;
  return A.desc + A.gap + (A.asc + A.desc + A.gap) * (m - 1) + B.asc;
}

// محاذاة: لكل سطر حقيقة، حدّد فقرته وهل هو أول سطرها. المشي المتسلسل
// عبر أسطر الحقيقة (لا عدّ أسطر) — يتجنب انجراف المؤشر.
const paras = model.paragraphs.filter((p) => !p.excluded && norm(p.text).length > 3);
const marTopOf = (p) => (model.sections?.[p.sectionIndex] ?? model.section).marTopTwips ?? 1440;

// رتّب الفقرات بمؤشرٍ متقدّم: كل سطرٍ يُنسب للفقرة الجارية حتى تبدأ التالية
const lineOwner = new Array(truthLines.length).fill(null); // {p, isFirst}
let pIdx = 0, li = 0;
// طابق بداية كل فقرة إلى أول سطرٍ يبدؤها من li فصاعدًا
const startsAt = (tn, pn) => {
  if (!tn || tn.length < 4) return false;
  const lim = Math.min(6, tn.length - 4);
  for (let j = 0; j <= lim; j++) if (pn.startsWith(tn.slice(j))) return true;
  return false;
};
// أوجد سطر بداية كل فقرة (متسلسل، لا رجوع)
const paraStart = new Array(paras.length).fill(-1);
{
  let cur = 0;
  for (let pi = 0; pi < paras.length; pi++) {
    const pn = norm(paras[pi].text);
    for (let i = cur; i < truthLines.length && i < cur + 60; i++) {
      if (startsAt(truthLines[i].n, pn)) { paraStart[pi] = i; cur = i + 1; break; }
    }
  }
}
// انسب الأسطر: من paraStart[pi] حتى paraStart[pi+1]−1 للفقرة pi
for (let pi = 0; pi < paras.length; pi++) {
  const s = paraStart[pi]; if (s < 0) continue;
  let e = truthLines.length;
  for (let k = pi + 1; k < paras.length; k++) if (paraStart[k] >= 0) { e = paraStart[k]; break; }
  for (let i = s; i < e; i++) lineOwner[i] = { p: paras[pi], isFirst: i === s };
}

// المحاكاة: امش عبر كل أسطر الحقيقة، اضبط y، أعِد الضبط عند فاصل الصفحة
let y = null, curPage = -1, prevP = null, prevT = null;
let ok = 0, total = 0;
const missHist = new Map();
const FP = process.env.FP_TRACE;
for (let idx = 0; idx < truthLines.length; idx++) {
  const t = truthLines[idx];
  const own = lineOwner[idx];
  if (!own) { continue; } // سطر بلا فقرة (فوتر/رقم صفحة) — تخطَّ بلا كسر التسلسل
  const p = own.p;
  const M = lineMet(p, t, own.isFirst);
  if (!M) { prevT = t; prevP = p; continue; }
  if (t.page !== curPage) {
    curPage = t.page;
    y = marTopOf(p) + (M.ascStart ?? M.asc);
  } else if (own.isFirst) {
    const MP = prevT ? lineMet(prevP, prevT, false) : null;
    if (MP) {
      const la = prevP.spacing;
      const mA = la.line != null && la.lineRule !== "exact" && la.lineRule !== "atLeast" ? la.line / 240 : 1;
      y += MP.desc + MP.gap + (MP.asc + MP.desc + MP.gap) * (mA - 1)
        + Math.max(prevP.spacing.after ?? 0, p.spacing.before ?? 0) + M.asc + inhPlus(p);
    } else y = t.y;
  } else {
    y += (stepV7(p, prevT, t) ?? 0);
  }
  total++;
  const err = t.y - y;
  if (Math.abs(err) <= TOL) ok++;
  else missHist.set(Math.round(err / 5) * 5, (missHist.get(Math.round(err / 5) * 5) ?? 0) + 1);
  if (FP && String(t.page) === FP)
    console.log(`  [p${t.page} ${own.isFirst ? "حد/بداية" : "خطوة"}] pred=${Math.round(y)} obs=${t.y} err=${Math.round(err)}`);
  prevT = t; prevP = p;
}
const pct = total ? (100 * ok / total).toFixed(2) : "0";
console.log(`★ المحاكي الكامل (${BOOK}): ${ok}/${total} baselines = ${pct}% (كل الصفحات، كل الفقرات)`);
const top = [...missHist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
if (top.length) console.log("   انحرافات (×5):", top.map(([k, v]) => `${k > 0 ? "+" : ""}${k}×${v}`).join("  "));
