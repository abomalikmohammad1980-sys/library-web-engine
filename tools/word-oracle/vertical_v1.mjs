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
  const os2 = tables.get("OS/2");
  const upem = buf.readUInt16BE(head + 18);
  const a = buf.readInt16BE(hhea + 4) / upem;
  const d = -buf.readInt16BE(hhea + 6) / upem;
  let g = buf.readInt16BE(hhea + 8) / upem;
  // ‏OS/2 win (لـexternalLeading): ‏usWinAscent@74، ‏usWinDescent@76
  const wd = os2 != null ? buf.readUInt16BE(os2 + 76) / upem : d;
  // ‏NOGAP=1: إسقاط lineGap الـhhea (فرضية: Word يستعمل win بلا فجوة لبعض
  // الخطوط — adwa فجوته 18 وحدة = 2.6tw@300 توافق انجراف masjid تمامًا)
  if (process.env.NOGAP === "1") g = 0;
  return { a, d, g, wd };
}
let MAIN_MET = fontVertMetrics(FONT_FILE);
const runMet = new Map(); // odttf → {a، d، g}
const famMet = new Map(); // family → {a، d، g} (لخط علامة الترقيم بشريحتها)

// ★ مطابقة المقاييس الدقيقة (PRECISE=1، افتراضي): subset الاستخراج قد يُعاد
// توليده بـupem مخفَّض (Jazeera 1000 مقابل 2048) فيُقرّب pitch بـ~0.03% —
// وWord يستعمل الخط الأصلي الدقيق. نطابق كل subset بأقرب أصلٍ بالـpitch من
// مجموعة book-fonts ونستعمل مقاييسه العالية الدقة. (تجاوز مسمّى fonts-map
// الخاطئ — يطابق بالقيمة لا بالاسم.) ‏PRECISE=0 للعودة لمقاييس subset الخام.
import { readdirSync } from "node:fs";
function fontUpem(path) {
  const buf = readFileSync(path);
  const num = buf.readUInt16BE(4);
  for (let i = 0; i < num; i++) {
    const o = 12 + i * 16;
    if (buf.toString("ascii", o, o + 4) === "head") return buf.readUInt16BE(buf.readUInt32BE(o + 8) + 18);
  }
  return 2048;
}
const origMets = [];
if (process.env.PRECISE !== "0") {
  try {
    for (const f of readdirSync("corpus/book-fonts")) {
      if (!f.endsWith(".ttf")) continue;
      try {
        const m = fontVertMetrics(`corpus/book-fonts/${f}`);
        origMets.push({ f, pitch: m.a + m.d + m.g, upem: fontUpem(`corpus/book-fonts/${f}`), met: m });
      } catch { /* تخطَّ */ }
    }
  } catch { /* لا مجلد */ }
}
/** أدقّ مقاييس أصليّة لـpitch معطى: ضمن 0.1% وبأعلى upem (المصدر الدقيق —
 *  subset الاستخراج المخفَّض upem يقرّب pitch فيلتبس بأصولٍ أدنى دقة بنفس
 *  القيمة المقرّبة؛ نفضّل الأعلى upem بينها). أو null إن لم يطابق. */
const precise = (subMet) => {
  if (!origMets.length) return null;
  const p = subMet.a + subMet.d + subMet.g;
  const cands = origMets.filter((o) => Math.abs(o.pitch - p) / p < 0.001);
  if (!cands.length) return null;
  cands.sort((a, b) => b.upem - a.upem); // أعلى upem أولًا
  return cands[0].met;
};
{ const pm = precise(MAIN_MET); if (pm) MAIN_MET = pm; } // ترقية خط المتن الرئيسي

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
      let met = fontVertMetrics(src);
      const pm = precise(met); // مقاييس أصليّة دقيقة إن طابقت بالـpitch
      if (pm) met = pm;
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
    // ‏baselineTwipsF (الكسري، بلا تكميم دلو 2tw الاستخراجي) هو المرجع الصحيح —
    // التكميم كان يخفي دقة النموذج الحقيقية (فرقه يبلغ 1.4tw = نصف عتبة ±3).
    // ‏NOFLOAT=1 للعودة للمكمَّم. (جبهة أرضية المقاييس: كانت ضجيج استخراجٍ جزئيًا.)
    truthLines.push({ n: nn, em: rs.length ? rs[0].emTwips : 0,
      ems: new Set(rs.map((r) => r.emTwips)),
      y: process.env.NOFLOAT === "1" ? ln.baselineTwips : (ln.baselineTwipsF ?? ln.baselineTwips), page: pgI,
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
// ‏VPS: معايرة مقياس المقاييس الرأسية (اختبار انحياز ~0.2% المتراكم الذي
// يظهر في الصفحة الكاملة رغم اجتياز الداخلي — hhea مقابل GDI الدقيق).
const VPS = Number(process.env.VPS ?? "1");
function lineMet(p, t, isFirstLine = false) {
  let asc = 0, desc = 0, gap = 0, textAscFactor = 0, ascRunGap = 0;
  for (const r of t.runFonts ?? []) {
    const met = runMet.get(r.font) ?? MAIN_MET;
    // ‏EM_MODE: ‏q10 (افتراضي) em لأقرب 10 (المثالي 16pt→320)؛ ‏exact em
    // المرصود كما هو (319 المكمَّم 600dpi) — تجربة إزالة انجراف tadris +3
    const emIdeal = (process.env.EM_MODE === "exact" ? r.em : Math.round(r.em / 10) * 10) * VPS;
    if (met.a * emIdeal > asc) { asc = met.a * emIdeal; ascRunGap = met.g * emIdeal; }
    desc = Math.max(desc, met.d * emIdeal);
    gap = Math.max(gap, met.g * emIdeal);
    textAscFactor = Math.max(textAscFactor, met.a); // صعود خط المتن نفسه
  }
  if (!asc) return null;
  // القاعدة 7-ب (GDI، مقيسة page_sim صفحة 2): externalLeading من الخط
  // **المهيمن** (أعلى asc) لا max على الـruns — رُونٌ لاتينية ثانوية
  // (Arial gap=67=10tw) كانت تضخّم التباعد الحدّي زائفًا. ‏GAP_COUPLE=0 للتعطيل.
  if (process.env.GAP_COUPLE !== "0") gap = ascRunGap;
  // رفع العلامة: العلامة تسكن **أول سطر** الفقرة المعدودة فقط — ترفع
  // ‏ascent ذلك السطر وحده (sdkjs:3895)، **بخطها الفعلي حسب شريحة نصها**:
  // أرقام «1.» لاتينية ⇒ ‏rFonts ascii من rPr علامة الفقرة (لغز 586:
  // ‏desc(adwa)+asc(Simplified ‏1.18em) = ‏586.7 والمرصود 586–588 ✓).
  // بلا شريحة لاتينية معلنة: العلامة بخط المتن نفسه (dawra «1-» بترادو
  // العادي) — فالمرجع صعود المتن، لا MAIN_MET (كان subset البولد فيرفع +11.5)
  if (isFirstLine && p.numbered && p.markEmTwips) {
    const markAscFactor = (p.markAsciiFamily && famMet.get(p.markAsciiFamily)?.a)
      ?? textAscFactor;
    asc = Math.max(asc, markAscFactor * p.markEmTwips);
  }
  // ‏ascStart (القاعدة 8-ج): صعود «أول سطر الصفحة» يشمل externalLeading —
  // ‏(hheaTotal − winDesc)×em = ‏ext + winAsc (‏LO: ‏leading فوق السطر).
  // ‏jazeera الوحيد ذو ext>0 ‏(0.342em): يفسر +104/+112 حرفيًا.
  let ascStart = 0;
  for (const r of t.runFonts ?? []) {
    const met = runMet.get(r.font) ?? MAIN_MET;
    const emIdeal = Math.round(r.em / 10) * 10;
    const hheaTotal = met.a + met.d + met.g;
    ascStart = Math.max(ascStart, (hheaTotal - (met.wd ?? met.d)) * emIdeal);
  }
  return { asc, desc, gap, ascStart: Math.max(ascStart, asc) };
}

/** ‏Δ ‏baseline(a←b) داخل الفقرة: ‏desc(a) + فجوة التباعد (بارتفاع a —
 *  ‏LINE_SPACING_AS_GAP_BELOW) + ‏gap(a) + ‏asc(b) */
// نفي: تكميم خطوة السطر لشبكة 600dpi (2.4tw) هدم الكتب الكسرية الخطوة
// (jalsa داخلي 100→62، masjid 96→88) — ‏Word **لا** يكمّم الخطوة للدوت؛
// تطابق muqtarah ‏547.27→547.2 كان مصادفة (547.2 = ‏228 دوت بحتَ اتفاق).
// الخطوات كسرية فعلًا. ‏STEP_DOT=1 لتجربة التكميم (معطّل افتراضيًا).
const DOT = Number(process.env.STEP_DOT ?? "0"); // ‏0=معطّل، وإلا حجم الشبكة (tw)
const qStep = (s) => DOT > 0 ? Math.round(s / DOT) * DOT : s;
function stepV7(p, ta, tb) {
  const A = lineMet(p, ta), B = lineMet(p, tb);
  if (!A || !B) return null;
  const { line, lineRule } = p.spacing;
  if (line != null && lineRule === "exact") return qStep(line);
  const m = line != null && lineRule !== "atLeast" ? line / 240 : 1;
  // ‏gap يدخل المضاعف (قياس muqtarah: انجراف +0.8/سطر = gap×(m−1) بدونه)
  const base = A.desc + A.gap + (A.asc + A.desc + A.gap) * (m - 1) + B.asc;
  if (line != null && lineRule === "atLeast") return Math.max(qStep(base), line);
  return qStep(base);
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

/** القاعدة 9 — **قانون الكسر** (مسبار docDefaults عشري القيم vtest17):
 *  فقرة تباعدها **غير مباشر** (موروث من docDefaults/نمط لا من pPr نفسه)
 *  تُرفع خطوةُ سطرها الأول لسقف نقطة 600dpi صحيحة **إذا كان كسر الخطوة
 *  دون 1/6 نقطة**: ‏T(n) = ceil(خطوة) + (n−1)×خطوة.
 *  المسبار: كسور {.011، .072، .089→لم يُقس، .111، .133، .150} مسقوفة كلها،
 *  و{.172، .211، .256، .333، .378} حرة كلها — العتبة محسورة في
 *  ‏(0.150، 0.172] و1/6 في وسطها (الآلية الدقيقة سؤال مفتوح — تكميم
 *  ‏LineServices داخلي؟). ‏ahadith ‏(.011): ‏+2.37tw والمقيس 2.4 ✓؛
 *  ‏muqtarah ‏(.974 بمقاييس Light النقية): حر ✓ — قيمة stepV7 الملوثة
 *  بmax-عبر-runs (‏.033) خادعة، لذا الحساب هنا بالمقاييس النقية حصرًا.
 *  المباشر في pPr لا يُسقَّف أبدًا (vtest15-M3 حتى n=12، ‏tadris/jalsa).
 *  ‏R9=0 للتعطيل، ‏R9T لتعديل العتبة. */
// العتبة 0.15 شاملة: جزيرة كسر .150 مسقوف (vtest17-243) وترادو .154 حر
// (vtest19-282) — الحصر (0.150 ≤ ‏t < 0.154] والقيمة 3/20 في رأسه
const R9T = Number(process.env.R9T ?? 0.1505);
const inhPlus = (p) => {
  if (process.env.R9 === "0") return 0;
  const sp = p.spacing;
  if (sp.line == null || sp.lineSource === "ppr" || sp.lineRule !== "auto") return 0;
  const em = p.runs?.[0]?.emTwips;
  if (!em) return 0;
  const emIdeal = Math.round(em / 10) * 10;
  const d = (PITCH * emIdeal * sp.line / 240) / 2.4; // خطوة نقية بخط المتن
  const f = d % 1;
  return f < R9T ? (Math.ceil(d) - d) * 2.4 : 0;
};

// ‏ALLFAM=1: يضمّ **كل** الفقرات (عناوين وأحجام/خطوط مختلطة) لا فقرات المتن
// المحاذاة فقط — لسدّ ثغرة بداية الصفحة في المُحكِّم الكامل (الفقرات غير
// المنمّطة قبل المتن). المقاييس per-run فالخطوط المختلطة مدعومة أصلًا.
const ALLFAM = process.env.ALLFAM === "1";
const paras = model.paragraphs.filter((p) =>
  !p.excluded &&
  (ALLFAM
    ? p.runs.some((r) => r.emTwips) && p.text.trim().split(/\s+/).length >= 2
    : (p.text.trim().split(/\s+/).length >= 8 &&
       p.runs.every((r) => r.family === FAMILY && r.emTwips))));

let pairs = 0, ok = 0;
const missHist = new Map();
const missSamples = [];
const paraSpans = []; // حدود الفقرات: {startIdx، endIdx، p، firstT، lastT}
// مسار أول: رؤوس كل الفقرات — يمنع ابتلاع فقرة لاحقة كأسطر داخلية
// (درس ahadith: فقرات القوائم المتلاصقة استُهلكت كأسطر «داخلية» فظهرت
// حدودها متنكرة بأزواج +4 وشاذّي المحاذاة −458)
const heads = [];
const taken = new Set();
for (const p of paras) {
  const em = (p.runs.find((r) => r.emTwips) ?? p.runs[0]).emTwips;
  const paraN = norm(p.text);
  // العناوين القصيرة (ALLFAM): تخفيف عتبة الطول ومطابقة em
  const minLen = ALLFAM ? 4 : 11;
  let start = -1;
  outer:
  for (let i = 0; i < truthLines.length; i++) {
    if (taken.has(i)) continue;
    const tn = truthLines[i].n;
    if (!tn || tn.length < minLen) continue;
    if (!ALLFAM && Math.abs(truthLines[i].em - em) > 3) continue;
    // المطابقة الأصلية (طويلة): بادئة بإزاحة ≤5 وطول السطر > 10
    for (let j = 0; j <= 5 && j < tn.length - 10; j++)
      if (paraN.startsWith(tn.slice(j))) { start = i; break outer; }
    // ‏ALLFAM: العناوين القصيرة — تطابق البادئة الكامل من الطرفين
    if (ALLFAM && tn.length < 14 && (paraN.startsWith(tn) || tn.startsWith(paraN)))
      { start = i; break outer; }
  }
  if (start < 0) continue;
  taken.add(start);
  heads.push({ p, start, paraN });
}
heads.sort((a, b) => a.start - b.start);
const headSet = new Set(heads.map((h) => h.start));
// حواجز إضافية: رؤوس **كل** فقرات النموذج (حتى خارج مرشح المقياس —
// فقرات القوائم القصيرة) كي لا تُبتلع أسطرها في فقرة سابقة
for (const p of model.paragraphs) {
  if (p.excluded) continue;
  const pn = norm(p.text);
  if (pn.length <= 10) continue;
  for (let i = 0; i < truthLines.length; i++) {
    if (taken.has(i)) continue;
    const tn = truthLines[i].n;
    if (!tn || tn.length <= 10) continue;
    let hit = false;
    for (let j = 0; j <= 5 && j < tn.length - 10; j++)
      if (pn.startsWith(tn.slice(j))) { hit = true; break; }
    if (hit) { taken.add(i); headSet.add(i); break; }
  }
}
for (let hi = 0; hi < heads.length; hi++) {
  const { p, start, paraN } = heads[hi];
  const em = p.runs[0].emTwips;
  // استهلاك أسطر الفقرة — حتى رأس الفقرة التالية حصرًا
  const seq = [];
  let endIdx = start;
  for (let j = start, accLen = 0;
       j < truthLines.length && accLen < paraN.length && seq.length < 200; j++) {
    if (j > start && headSet.has(j)) break; // رأس فقرة أخرى — توقف
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
    const fresh = anchorY == null;
    if (fresh) { anchorY = a.y; accPred = 0; }
    pairs++;
    const stepPred = MODE === "7" ? (stepV7(p, a, b) ?? pred)
      : (MODE === "3" || MODE === "4" || MODE === "5") ? ((stepDotsV3(p, b) ?? pred / 2.4) * 2.4)
      : MODE === "2" ? (predictedPitchV2(p, b) ?? pred) : pred;
    const bonus = fresh ? inhPlus(p) : 0;
    if (process.env.R9DBG === "1" && fresh && bonus)
      console.log("r9:", JSON.stringify({ para: p.index, step: +stepPred.toFixed(2),
        bonus: +bonus.toFixed(2), src: p.spacing.lineSource, line: p.spacing.line }));
    accPred += stepPred + bonus; // القاعدة 9: سقف أول خطوة
    // تكميم baseline المتراكم على شبكة 600dpi: ‏v3 دائمًا. ‏v7 **لا** يُكمَّم
    // هنا (Q7=1 لتجربته): المرساة نقطةُ حقيقةٍ منتصفَ صفحةٍ ناتجةٌ عن تراكم
    // تكميمات من رأس الصفحة — فإعادة التكميم محليًا تضاعف الخطأ (جُرّب:
    // الستة انحدرت). التكميم محلّه المُحكِّم الكامل (يتراكم من الرأس).
    const quant = MODE === "3" || (MODE === "7" && process.env.Q7 === "1");
    const predicted = accum
      ? (quant ? Math.round((anchorY + accPred) / 2.4) * 2.4 : anchorY + accPred)
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
    // القاعدة 9 لا تمس الحدود (تجربتها هنا: 86→31% — النقطة تسكن أول خطوة داخلية)
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
// القاعدة 8: بداية الصفحة — ‏baseline أول سطر = الهامش العلوي + ascent السطر
{
  let pOk = 0, pN = 0;
  const pHist = new Map();
  const marTopOf = (p) =>
    (model.sections?.[p.sectionIndex] ?? model.section).marTopTwips ?? 1440;
  const marTop = model.section.marTopTwips ?? 1440; // للعنوان فقط
  // ‏8-ب: قاع الهيدر لكل صفحة (أسطر تحت الهامش العلوي + 400) — الهيدر
  // العميق يدفع المتن: البداية = hdrLast + خطوة سطرٍ كاملة بمقاييس المتن
  const pageStartPred = (p, firstT) => {
    const M = lineMet(p, firstT, true);
    if (!M) return null;
    let pred = marTopOf(p) + (M.ascStart ?? M.asc);
    // أسطر الهيدر: ما يقع فوق التنبؤ الأساسي بوضوح (أدنى من pred−50)
    let hdr = null;
    for (const t of truthLines)
      if (t.page === firstT.page && t !== firstT && t.y < pred - 50 && (hdr == null || t.y > hdr))
        hdr = t.y;
    if (hdr != null) {
      const sp = p.spacing;
      const m = sp.line != null && sp.lineRule !== "exact" && sp.lineRule !== "atLeast" ? sp.line / 240 : 1;
      const self = M.desc + M.gap + (M.asc + M.desc + M.gap) * (m - 1) + M.asc;
      pred = Math.max(pred, hdr + self);
    }
    if (process.env.PS_DEBUG === "1")
      console.log("ps:", JSON.stringify({ pg: firstT.page, obs: firstT.y,
        base: Math.round(marTopOf(p) + M.asc), hdr, pred: Math.round(pred),
        asc: Math.round(M.asc), marTop: marTopOf(p) }));
    return pred;
  };
  // أول سطر فقرة يبدأ صفحةً: من paraSpans حيث firstT هو أول أسطر صفحته
  const firstOfPage = new Map();
  for (const t of truthLines)
    if (!firstOfPage.has(t.page) || t.y < firstOfPage.get(t.page).y)
      firstOfPage.set(t.page, t);
  for (const S of paraSpans) {
    const f = firstOfPage.get(S.firstT.page);
    if (f !== S.firstT) continue; // ليست بادئة الصفحة
    const pred = pageStartPred(S.p, S.firstT);
    if (pred == null) continue;
    pN++;
    const err = S.firstT.y - pred;
    if (Math.abs(err) <= TOL) pOk++;
    else pHist.set(Math.round(err), (pHist.get(Math.round(err)) ?? 0) + 1);
  }
  if (pN) {
    console.log(`▲ بداية الصفحة: ${pOk}/${pN} = ${(100 * pOk / pN).toFixed(2)}% (هامش ${marTop})`);
    const top = [...pHist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (top.length) console.log("   أخطاء البداية:", top.map(([k, v]) => `${k > 0 ? "+" : ""}${k}×${v}`).join("  "));
  }

  // ★ مُحكِّم الصفحة الكاملة: تركيب القواعد 8+7+6 — تنبؤ متسلسل بكل
  // ‏baselines الصفحة من الهامش العلوي، بلا أي مرساة من الحقيقة بعد البداية.
  const FOOT = (n) => /^[()0-9]{1,6}$/.test(n) || /^الصفحة\(?\d+\)?من\(?\d+\)?$/.test(n);
  const spanLines = (S) => {
    const out = [];
    for (let j = S.startIdx; j <= S.endIdx; j++)
      if (!FOOT(truthLines[j].n)) out.push(truthLines[j]);
    return out;
  };
  const byPage = new Map();
  for (const S of paraSpans) {
    if (!byPage.has(S.firstT.page)) byPage.set(S.firstT.page, []);
    byPage.get(S.firstT.page).push(S);
  }
  let fOk = 0, fN = 0, pagesFull = 0, pagesTried = 0;
  const fHist = new Map();
  for (const [pg, spans] of byPage) {
    spans.sort((a, b) => a.startIdx - b.startIdx);
    if (firstOfPage.get(pg) !== spans[0].firstT) continue; // الصفحة لا تبدأ بفقرة محاذاة
    pagesTried++;
    let y = null, prevS = null, prevT = null, pageOk = true;
    for (const S of spans) {
      if (prevS && S.startIdx !== prevS.endIdx + 1) { pageOk = false; break; } // انقطاع محاذاة
      const lines = spanLines(S).filter((t) => t.page === pg);
      if (!lines.length) break;
      for (let i = 0; i < lines.length; i++) {
        const t = lines[i];
        const M = lineMet(S.p, t, i === 0);
        if (!M) { pageOk = false; break; }
        // ‏ANCHOR_PAGE=1: ارسِ أول سطر صفحةٍ على موضعه المقيس (يعزل دقة
        // الخطوات عن تنبؤ بداية الصفحة — الصفحات التي تسبقها عناوين/كتل
        // غير منمّطة تفشل تنبؤ البداية بإزاحة ثابتة، والخطوات تبقى تامة)
        if (y == null) y = (process.env.ANCHOR_PAGE === "1")
          ? t.y
          : (pageStartPred(S.p, t) ?? (marTopOf(S.p) + M.asc)); // القاعدة 8+8ب
        else if (i === 0) {                                             // حد فقرات (6+7ب)
          const MP = lineMet(prevS.p, prevT, false);
          const la = prevS.p.spacing;
          const mA = la.line != null && la.lineRule !== "exact" && la.lineRule !== "atLeast" ? la.line / 240 : 1;
          const gap = Math.max(prevS.p.spacing.after ?? 0, S.p.spacing.before ?? 0);
          const bstep = MP.desc + MP.gap + (MP.asc + MP.desc + MP.gap) * (mA - 1) + gap + M.asc;
          if (process.env.BND_DBG === "1")
            console.log("bnd:", JSON.stringify({ obsStep: t.y - prevT.y, predStep: Math.round(bstep),
              err: Math.round(t.y - prevT.y - bstep), pDesc: Math.round(MP.desc), pGap: Math.round(MP.gap),
              cAsc: Math.round(M.asc), gap, emPrev: prevS.p.runs.find((r) => r.emTwips)?.emTwips,
              emCur: S.p.runs.find((r) => r.emTwips)?.emTwips, numCur: S.p.numbered }));
          y += bstep;
        } else {                                                         // القاعدة 7
          y += (stepV7(S.p, prevT, t) ?? 0)
            + (i === 1 ? inhPlus(S.p) : 0); // (+9 في أول خطوة داخلية)
        }
        fN++;
        // تكميم شبكة 600dpi للمقارنة: **معطّل افتراضيًا** (QFP=1 لتجربته) —
        // ‏round(y/2.4) الساذج يقلب قيم tadris الجالسة على حدود الشبكة تمامًا
        // ‏(100→88): النموذج الكسري أدقّ من التكميم الساذج، وخوارزمية تكميم
        // ‏LineServices الحقيقية (تراكم كسري بأنصاف نقاط) هدف بحثٍ لاحق.
        // ‏QFP: تكميم baseline المتراكم لشبكةٍ دقيقة (نموذج LineServices:
        // تراكمٌ كسريّ + قنص كل baseline) — القيمة = حجم الشبكة (0.6 دقيقة).
        const qfp = Number(process.env.QFP ?? "0");
        const yCmp = qfp > 0 ? Math.round(y / qfp) * qfp : y;
        const err = t.y - yCmp;
        if (process.env.FP_TRACE === String(pg))
          console.log(`  [${i === 0 ? (y === marTopOf(S.p) + M.asc ? "بداية" : "حد") : "خطوة"}] ` +
            `pred=${Math.round(yCmp)} obs=${t.y} err=${Math.round(err)}`);
        if (Math.abs(err) <= TOL) fOk++;
        else fHist.set(Math.round(err / 5) * 5, (fHist.get(Math.round(err / 5) * 5) ?? 0) + 1);
        prevT = t;
      }
      prevS = S;
      if (!pageOk) break;
    }
    if (pageOk) pagesFull++;
  }
  if (fN) {
    console.log(`★ الصفحة الكاملة: ${fOk}/${fN} baselines = ${(100 * fOk / fN).toFixed(2)}% ` +
      `(صفحات مكتملة السلسلة: ${pagesFull}/${pagesTried})`);
    const top = [...fHist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (top.length) console.log("   انحرافات (مجمعة ×5):", top.map(([k, v]) => `${k > 0 ? "+" : ""}${k}×${v}`).join("  "));
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
