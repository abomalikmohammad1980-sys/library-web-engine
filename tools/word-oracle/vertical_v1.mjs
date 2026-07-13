#!/usr/bin/env node
/** المُحكِّم الرأسي v1 — خطوة السطر داخل الفقرة (الترصيف الرأسي، المرحلة 1).
 *
 *  النموذج: ‏pitch = hheaPitch(الخط) × em × (line/240) ‏[lineRule=auto]
 *           أو line ‏twips ‏[exact] أو max(single, line) ‏[atLeast]
 *  حيث hheaPitch = (ascent − descent + lineGap)/upem — تحقق يدويًا:
 *  ‏adwa 1.8916 (masjid 568✓)، ‏trado 1.4946 (jalsa ‏550.0✓ بـ×1.15)،
 *  ‏jazeera 1.6900 (ahadith 626✓ بـ×1.158).
 *
 *  المقارنة: فروق baselines المتتالية لأسطر الفقرة الواحدة (نفس الصفحة)
 *  من الحقيقة، ضد التنبؤ. حدود الفقرات (before/after) مرحلة تالية.
 */
import { readFileSync } from "node:fs";
import { extractFromDocx } from "../../packages/ooxml-model/dist/index.js";

const BOOK = process.env.BOOK ?? "sample-masjid";
const FAMILY = process.env.FAMILY ?? "adwa-assalaf";
const FONT_FILE = process.env.FONT_FILE ?? "corpus/book-fonts/adwa-assalaf.ttf";
const TOL = Number(process.env.TOL ?? "2");

// ---- مقاييس الخط الرأسية من الملف مباشرة (hhea + head)
function fontVerticalPitch(path) {
  const buf = readFileSync(path);
  const num = buf.readUInt16BE(4);
  const tables = new Map();
  for (let i = 0; i < num; i++) {
    const o = 12 + i * 16;
    tables.set(buf.toString("ascii", o, o + 4), buf.readUInt32BE(o + 8));
  }
  const head = tables.get("head"), hhea = tables.get("hhea");
  if (head == null || hhea == null) throw new Error("head/hhea غائبة");
  const upem = buf.readUInt16BE(head + 18);
  const ascent = buf.readInt16BE(hhea + 4);
  const descent = buf.readInt16BE(hhea + 6);
  const lineGap = buf.readInt16BE(hhea + 8);
  return (ascent - descent + lineGap) / upem;
}
const PITCH = fontVerticalPitch(FONT_FILE);

const model = extractFromDocx(readFileSync(`corpus/books/${BOOK}.docx`));
const truth = JSON.parse(readFileSync(`corpus/ground-truth/${BOOK}.truth.json`, "utf-8"));

const norm = (s) => s
  .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
  .replace(/[ـ‎‏؜\s]+/g, "");

const truthLines = [];
for (let pgI = 0; pgI < truth.pages.length; pgI++) {
  for (const ln of truth.pages[pgI].lines) {
    const rs = ln.runs.filter((r) => r.text.trim());
    const logical = [...rs].sort((a, b) => b.x - a.x).map((r) => r.text).join("");
    const nn = norm(logical);
    if (!nn) continue;
    truthLines.push({ n: nn, em: rs.length ? rs[0].emTwips : 0,
      ems: new Set(rs.map((r) => r.emTwips)), y: ln.baselineTwips, page: pgI });
  }
}

function predictedPitch(p, em) {
  const { line, lineRule } = p.spacing;
  if (process.env.GRID600 === "1") {
    // ★ شبكة الطابعة 600dpi (اكتشاف XPS الخام): ‏em والخطوة أعداد صحيحة
    // من النقاط (‏1 نقطة = 2.4 twips). ‏em: ‏16pt→133 نقطة (تفسر 15.96pt
    // المرصودة)؛ الخطوة: round(round(hhea×emDots) × line/240).
    const emDots = Math.round(em * 5 / 12); // twips → نقاط 600dpi
    const singleDots = Math.round(PITCH * emDots);
    let dots;
    if (line == null) dots = singleDots;
    else if (lineRule === "exact") dots = Math.round(line * 5 / 12);
    else if (lineRule === "atLeast") dots = Math.max(singleDots, Math.round(line * 5 / 12));
    else dots = Math.round(singleDots * line / 240);
    return dots * 2.4;
  }
  const single = PITCH * em;
  if (line == null) return single;
  if (lineRule === "exact") return line;
  if (lineRule === "atLeast") return Math.max(single, line);
  return single * (line / 240); // auto
}

const paras = model.paragraphs.filter((p) =>
  !p.excluded &&
  p.text.trim().split(/\s+/).length >= 8 &&
  p.runs.every((r) => r.family === FAMILY && r.emTwips));

let pairs = 0, ok = 0;
const missHist = new Map();
const missSamples = [];
for (const p of paras) {
  const em = p.runs[0].emTwips;
  const paraN = norm(p.text);
  let start = -1;
  outer:
  for (let i = 0; i < truthLines.length; i++) {
    const tn = truthLines[i].n;
    if (!tn || tn.length <= 10 || Math.abs(truthLines[i].em - em) > 3) continue;
    for (let j = 0; j <= 5 && j < tn.length - 10; j++)
      if (paraN.startsWith(tn.slice(j))) { start = i; break outer; }
  }
  if (start < 0) continue;
  // استهلاك أسطر الفقرة
  const seq = [];
  for (let j = start, accLen = 0;
       j < truthLines.length && accLen < paraN.length && seq.length < 200; j++) {
    const t = truthLines[j];
    if (/^[()0-9]{1,6}$/.test(t.n)) continue;
    if (/^الصفحة\(?\d+\)?من\(?\d+\)?$/.test(t.n)) continue;
    seq.push(t); accLen += t.n.length;
  }
  const pred = predictedPitch(p, em);
  // نمط التراكم (الافتراضي): Word يحسب المواضع عائمةً ويقرب كل baseline
  // مستقلًا — فالموضع المتراكم من مرساة الفقرة هو الثابت، لا فرق الزوج
  // (الذي يتذبذب ±2 بالتقريب). ‏ACCUM=0 يعيد مقياس الأزواج القديم.
  const accum = process.env.ACCUM !== "0";
  let anchorY = null, anchorI = 0;
  for (let i = 1; i < seq.length; i++) {
    const a = seq[i - 1], b = seq[i];
    if (a.page !== b.page) { anchorY = null; continue; } // فاصل صفحة — خارج v1
    if (a.ems.size > 1 || b.ems.size > 1) { anchorY = null; continue; } // خلط أحجام — v2
    if (b.y - a.y <= 0) { anchorY = null; continue; }
    if (anchorY == null) { anchorY = a.y; anchorI = i - 1; }
    pairs++;
    const predicted = accum ? anchorY + (i - anchorI) * pred : pred;
    const obs = accum ? b.y : b.y - a.y;
    const err = Math.abs(obs - predicted);
    if (err <= TOL) ok++;
    else {
      const k = Math.round(obs - predicted);
      missHist.set(k, (missHist.get(k) ?? 0) + 1);
      if (missSamples.length < 8)
        missSamples.push({ para: p.index, line: i, obs, pred: Math.round(predicted),
          spacing: p.spacing });
    }
  }
}

const pct = pairs ? ((100 * ok) / pairs).toFixed(2) : "0";
console.log(`▲ الرقم الشمالي الرأسي v1 ‏(${BOOK}): ${ok}/${pairs} = ${pct}% ` +
  `(|خطأ| ≤ ${TOL} twips، ‏hheaPitch=${PITCH.toFixed(4)}em)`);
const topMiss = [...missHist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
if (topMiss.length)
  console.log("توزيع الأخطاء (obs−pred × عدد):",
    topMiss.map(([k, v]) => `${k > 0 ? "+" : ""}${k}×${v}`).join("  "));
for (const s of missSamples) console.log("  عينة:", JSON.stringify(s));
