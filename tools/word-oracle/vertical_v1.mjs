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
const TOL = Number(process.env.TOL ?? "3"); // سماحية النقطة (2.4tw) + ضجيج تكميم twips

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

/** مقاييس رأسية مفصولة (القاعدة 7): {a، d، g} كسورًا من em */
function fontVertMetrics(path) {
  const buf = readFileSync(path);
  const num = buf.readUInt16BE(4);
  const tables = new Map();
  for (let i = 0; i < num; i++) {
    const o = 12 + i * 16;
    tables.set(buf.toString("ascii", o, o + 4), buf.readUInt32BE(o + 8));
  }
  const head = tables.get("head"), hhea = tables.get("hhea");
  const upem = buf.readUInt16BE(head + 18);
  return {
    a: buf.readInt16BE(hhea + 4) / upem,
    d: -buf.readInt16BE(hhea + 6) / upem,
    g: buf.readInt16BE(hhea + 8) / upem,
  };
}
const MAIN_MET = fontVertMetrics(FONT_FILE);
const runMet = new Map(); // odttf → {a، d، g}
const famMet = new Map(); // family → {a، d، g} (لخط علامة الترقيم بشريحتها)

// ‏v2: خطوة السطر = max على runs السطر من (خطوة خط الـrun × حجمه) —
// أسطر فيها بولد/لاتيني/مصحفي تعلو (عنقودا tadris ‏203/204 = tradbdo).
// خرائط الخطوط من fonts-map.json (odttf → الملف الأصلي).
const runPitch = new Map(); // odttf name → hhea pitch em-factor
try {
  const fm = JSON.parse(readFileSync(`corpus/ground-truth/fonts/${BOOK}/fonts-map.json`, "utf-8"));
  for (const [odttf, info] of Object.entries(fm)) {
    // ‏hhea من الـsubset المفكوك نفسه — مطابقة «الأصل» بالعائلة تخلط
    // العادي بالبولد (tradbdo) فتفسد الخطوة
    const src = info.subset ?? info.original;
    if (!src) continue;
    try {
      runPitch.set(odttf, fontVerticalPitch(src));
      const met = fontVertMetrics(src);
      runMet.set(odttf, met);
      if (info.family && !famMet.has(info.family)) famMet.set(info.family, met);
    } catch { /* خط بلا ملف */ }
  }
} catch { /* لا خريطة — نبقى على خط المتن */ }

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
      ems: new Set(rs.map((r) => r.emTwips)), y: ln.baselineTwips, page: pgI,
      runFonts: rs.map((r) => ({ font: r.font, em: r.emTwips })) });
  }
}

/** ‏v2: خطوة السطر من تركيبته الفعلية — max على runs من (خطوة الخط × emDots) */
function linePitchDots(t) {
  let maxDots = 0;
  for (const r of t.runFonts ?? []) {
    const factor = runPitch.get(r.font) ?? PITCH;
    const emDots = Math.round(r.em * 5 / 12);
    maxDots = Math.max(maxDots, factor * emDots);
  }
  return maxDots;
}

function predictedPitchV2(p, t) {
  const { line, lineRule } = p.spacing;
  const single = linePitchDots(t);
  if (!single) return null;
  let dots;
  if (line == null) dots = Math.round(single);
  else if (lineRule === "exact") dots = Math.round(line * 5 / 12);
  else if (lineRule === "atLeast") dots = Math.max(Math.round(single), Math.round(line * 5 / 12));
  else dots = Math.round(single * line / 240);
  return dots * 2.4;
}

/** ‏v3: الخطوة عند em «المثالي» غير المكمم (em/2.4 نقطة عائمة) — التكميم
 *  يقع على الـbaseline المتراكم لا على الخطوة (يفسر تناوب 199/200 بمتوسط
 *  ‏199.28، ودawra ‏249 الغالبة من 249.1، وmasjid ‏236/237 من 236.45). */
function stepDotsV3(p, t) {
  let maxDots = 0;
  for (const r of t.runFonts ?? []) {
    const factor = runPitch.get(r.font) ?? PITCH;
    // ‏em الحقيقة مكمم (319 من 15.96) — نعيده للمثالي: أقرب نصف نقطة (10 twips)
    const emIdeal = Math.round(r.em / 10) * 10;
    maxDots = Math.max(maxDots, factor * (emIdeal / 2.4));
  }
  // علامة الفقرة تشارك في ارتفاع السطر (rPr داخل pPr — قصة a4). ‏MARK=0 للتعطيل
  if (process.env.MARK === "1" && p.markEmTwips)
    maxDots = Math.max(maxDots, PITCH * (p.markEmTwips / 2.4));
  if (!maxDots) return null;
  // ‏VMODE=5 (فرضية ahadith): سقف المفرد لنقطة صحيحة قبل المضاعف
  if (process.env.VMODE === "5") maxDots = Math.ceil(maxDots);
  const { line, lineRule } = p.spacing;
  if (line == null) return maxDots;
  if (lineRule === "exact") return line / 2.4;
  if (lineRule === "atLeast") return Math.max(maxDots, line / 2.4);
  return maxDots * line / 240;
}

/** ‏v7 (القاعدة 7): مقاييس السطر مفصولة — {asc، desc، gap} = ‏max على runs،
 *  وعلامة الترقيم (بحجم rPr علامة الفقرة) ترفع ascent فقط (sdkjs:3895). */
function lineMet(p, t, isFirstLine = false) {
  let asc = 0, desc = 0, gap = 0;
  for (const r of t.runFonts ?? []) {
    const met = runMet.get(r.font) ?? MAIN_MET;
    const emIdeal = Math.round(r.em / 10) * 10;
    asc = Math.max(asc, met.a * emIdeal);
    desc = Math.max(desc, met.d * emIdeal);
    gap = Math.max(gap, met.g * emIdeal);
  }
  if (!asc) return null;
  // رفع العلامة: العلامة تسكن **أول سطر** الفقرة المعدودة فقط — ترفع
  // ‏ascent ذلك السطر وحده (sdkjs:3895)، **بخطها الفعلي حسب شريحة نصها**:
  // أرقام «1.» لاتينية ⇒ ‏rFonts ascii من rPr علامة الفقرة (لغز 586:
  // ‏desc(adwa)+asc(Simplified ‏1.18em) = ‏586.7 والمرصود 586–588 ✓)
  if (isFirstLine && p.numbered && p.markEmTwips) {
    const met = (p.markAsciiFamily && famMet.get(p.markAsciiFamily)) ?? MAIN_MET;
    asc = Math.max(asc, met.a * p.markEmTwips);
  }
  return { asc, desc, gap };
}

/** ‏Δ ‏baseline(a←b) داخل الفقرة: ‏desc(a) + فجوة التباعد (بارتفاع a —
 *  ‏LINE_SPACING_AS_GAP_BELOW) + ‏gap(a) + ‏asc(b) */
function stepV7(p, ta, tb) {
  const A = lineMet(p, ta), B = lineMet(p, tb);
  if (!A || !B) return null;
  const { line, lineRule } = p.spacing;
  if (line != null && lineRule === "exact") return line;
  const m = line != null && lineRule !== "atLeast" ? line / 240 : 1;
  // ‏gap يدخل المضاعف (قياس muqtarah: انجراف +0.8/سطر = gap×(m−1) بدونه)
  const base = A.desc + A.gap + (A.asc + A.desc + A.gap) * (m - 1) + B.asc;
  if (line != null && lineRule === "atLeast") return Math.max(base, line);
  return base;
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
const paraSpans = []; // حدود الفقرات: {startIdx، endIdx، p، firstT، lastT}
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
  let endIdx = start;
  for (let j = start, accLen = 0;
       j < truthLines.length && accLen < paraN.length && seq.length < 200; j++) {
    const t = truthLines[j];
    if (/^[()0-9]{1,6}$/.test(t.n)) continue;
    if (/^الصفحة\(?\d+\)?من\(?\d+\)?$/.test(t.n)) continue;
    seq.push(t); accLen += t.n.length; endIdx = j;
  }
  if (seq.length)
    paraSpans.push({ startIdx: start, endIdx, p, firstT: seq[0], lastT: seq[seq.length - 1] });
  const pred = predictedPitch(p, em);
  // ‏MODE: ‏v3 (افتراضي) خطوة عائمة عند em المثالي + تكميم baseline للنقطة؛
  // ‏v2 خطوة نقاط صحيحة لكل سطر؛ ‏v1 خطوة الفقرة الموحدة. ‏ACCUM=0 للأزواج.
  const MODE = process.env.VMODE ?? "7";
  const accum = process.env.ACCUM !== "0";
  let anchorY = null, accPred = 0;
  for (let i = 1; i < seq.length; i++) {
    const a = seq[i - 1], b = seq[i];
    if (a.page !== b.page) { anchorY = null; continue; } // فاصل صفحة — خارج v1
    if (MODE === "1" && (a.ems.size > 1 || b.ems.size > 1)) { anchorY = null; continue; }
    if (b.y - a.y <= 0) { anchorY = null; continue; }
    if (anchorY == null) { anchorY = a.y; accPred = 0; }
    pairs++;
    const stepPred = MODE === "7" ? (stepV7(p, a, b) ?? pred)
      : (MODE === "3" || MODE === "4" || MODE === "5") ? ((stepDotsV3(p, b) ?? pred / 2.4) * 2.4)
      : MODE === "2" ? (predictedPitchV2(p, b) ?? pred) : pred;
    accPred += stepPred;
    // ‏v3: تكميم baseline المتراكم للنقاط؛ ‏v4: نفس الخطوة بلا تكميم
    const predicted = accum
      ? (MODE === "3" ? Math.round((anchorY + accPred) / 2.4) * 2.4 : anchorY + accPred)
      : stepPred;
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

// حدود الفقرات (v3): فقرتان متتاليتان في الحقيقة على نفس الصفحة —
// ‏Δ المتنبأ = خطوة السطر الأول للاحقة + after(السابقة) + before(اللاحقة)
{
  paraSpans.sort((a, b) => a.startIdx - b.startIdx);
  let bPairs = 0, bOk = 0;
  const bHist = new Map();
  for (let i = 1; i < paraSpans.length; i++) {
    const A = paraSpans[i - 1], B = paraSpans[i];
    if (B.startIdx - A.endIdx !== 1) continue;              // غير متلاصقتين
    if (A.lastT.page !== B.firstT.page) continue;           // فاصل صفحة
    const obs = B.firstT.y - A.lastT.y;
    if (obs <= 0) continue;
    // ‏v7 للحدود: ‏desc من آخر أسطر A (بمضاعفها) + ‏asc أول أسطر B (بعلامتها)
    let step;
    if ((process.env.VMODE ?? "7") === "7") {
      const MA = lineMet(A.p, A.lastT, A.startIdx === A.endIdx),
        MB = lineMet(B.p, B.firstT, true);
      if (!MA || !MB) continue;
      const la = A.p.spacing, mA = la.line != null && la.lineRule !== "exact" && la.lineRule !== "atLeast" ? la.line / 240 : 1;
      step = MA.desc + MA.gap + (MA.asc + MA.desc + MA.gap) * (mA - 1) + MB.asc;
    } else step = (stepDotsV3(B.p, B.firstT) ?? 0) * 2.4;
    if (!step) continue;
    const af = A.p.spacing.after ?? 0, bf = B.p.spacing.before ?? 0;
    // ‏BGAP=max: قاعدة انهيار الفواصل (Word يأخذ الأكبر لا المجموع)
    const predB = step + (process.env.BGAP === "sum" ? af + bf : Math.max(af, bf));
    bPairs++;
    if (Math.abs(obs - predB) <= TOL) bOk++;
    else {
      const k = Math.round(obs - predB);
      bHist.set(k, (bHist.get(k) ?? 0) + 1);
      if (process.env.BFOR === "1")
        console.log("حد-فاشل:", JSON.stringify({ af, bf, gapObs: Math.round(obs - step),
          stepR: Math.round(step), pA: A.p.index, pB: B.p.index,
          styleA: A.p.styleId, styleB: B.p.styleId }));
    }
  }
  if (bPairs) {
    console.log(`▲ حدود الفقرات: ${bOk}/${bPairs} = ${(100 * bOk / bPairs).toFixed(2)}%`);
    const top = [...bHist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (top.length) console.log("   أخطاء الحدود:", top.map(([k, v]) => `${k > 0 ? "+" : ""}${k}×${v}`).join("  "));
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
