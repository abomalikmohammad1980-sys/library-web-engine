#!/usr/bin/env node
/** الكاسر v1 — نص الفقرات من docx مباشرة (القرار المنهجي بعد v0)،
 *  والحقيقة (XPS) للمقارنة فقط. المحاذاة بين فقرات docx وأسطر الحقيقة
 *  بتطبيع «بلا مسافات» + توحيد الأرقام + إسقاط علامات الاتجاه/التطويل. */
import { readFileSync, writeFileSync } from "node:fs";
import { Blob, Buffer as HbBuffer, Face, Font, shape } from "harfbuzzjs";
import { extractFromDocx } from "../../packages/ooxml-model/dist/index.js";
import { numTabTextStart } from "../../packages/layout/dist/index.js";

// معايير الكتاب عبر البيئة — الافتراضي الكتاب الأول (sample-masjid/adwa)
const BOOK = process.env.BOOK ?? "sample-masjid";
const FAMILY = process.env.FAMILY ?? "adwa-assalaf";
const FONT_FILE = process.env.FONT_FILE ?? "corpus/book-fonts/adwa-assalaf.ttf";

const model = extractFromDocx(readFileSync(`corpus/books/${BOOK}.docx`));
const truth = JSON.parse(readFileSync(`corpus/ground-truth/${BOOK}.truth.json`, "utf-8"));

const face = new Face(new Blob(readFileSync(FONT_FILE)), 0);
const font = new Font(face);
const upem = face.upem;
const wCache = new Map();
function widthTwips(text, em) {
  const k = text + "@" + em;
  if (wCache.has(k)) return wCache.get(k);
  const b = new HbBuffer();
  b.addText(text); b.guessSegmentProperties(); shape(font, b);
  let u = 0; for (const p of b.getGlyphPositions()) u += p.xAdvance;
  const w = (u / upem) * em; wCache.set(k, w); return w;
}

const norm = (s) => s
  .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
  .replace(/[ـ‎‏؜\s]+/g, "");

// أسطر الحقيقة مسطّحة بالترتيب (نصوصها بالضم الهندسي من v0 يكفي هنا للتطبيع اللافراغي)
const truthLines = [];
for (let pgI = 0; pgI < truth.pages.length; pgI++) {
  for (const ln of truth.pages[pgI].lines) {
    const rs = ln.runs.filter((r) => r.text.trim());
    const logical = [...rs].sort((a, b) => b.x - a.x).map((r) => r.text).join("");
    const nn = norm(logical);
    if (!nn) continue; // سطر فارغ بصريًا — لا يشارك في تدفق النص
    truthLines.push({ n: nn, raw: logical.trim(),
      em: rs.length ? rs[0].emTwips : 0, runs: rs,
      xMin: ln.xMin, xMax: ln.xMax, y: ln.baselineTwips, page: pgI,
      advAll: ln.runs.reduce((a, r) => a + (r.advSumTwips ?? 0), 0) });
  }
}

// جدول العائمات المضيّقة (wrapSquare/Tight/Through) — تصميم العزل: النطاق
// الرأسي يُرسى على سطر فقرة المرساة الأول في الحقيقة (y مقيس)، والأفقي
// (التضييق ومن أي جهة) تنبؤ خالص من هندسة wp:anchor. ‏(FLOATS=0 للتعطيل)
const floatBands = [];
if (process.env.FLOATS !== "0") {
  for (const q of model.paragraphs) {
    for (const a of q.anchors ?? []) {
      if (!["Square", "Tight", "Through"].includes(a.wrap)) continue;
      if (a.posVRel !== "paragraph") continue; // ‏margin/page تحتاج الهامش الأعلى — v2
      const qn = norm(q.text);
      if (qn.length < 11) continue;
      const tl = truthLines.find((t) => t.n.length > 10 && qn.startsWith(t.n));
      if (!tl) continue;
      const sec2 = model.sections?.[q.sectionIndex] ?? model.section;
      const top = tl.y - tl.em + a.posVOffset; // قمة سطر المرساة تقريبًا
      // ‏posH من حافة العمود (وmargin ≈ العمود لعمود واحد — تقريب v1)
      const leftGap = a.posHOffset - a.distL;
      const rightGap = sec2.columnTwips - (a.posHOffset + a.extentW + a.distR);
      floatBands.push({ page: tl.page, top, bottom: top + a.extentH,
        avail: Math.max(leftGap, rightGap) });
    }
  }
  if (floatBands.length && process.env.FORENSICS)
    console.log("عائمات:", JSON.stringify(floatBands));
}

// فقرات docx المؤهلة: متن نظيف بخط adwa وحجم معلوم وكلمات كافية
// ‏JC_ONLY تشخيصي: يقصر القياس على وضع تسويغٍ بعينه (both/lowKashida/…)
// لعزل مساهمة الكشيدة عن التسويغ بالمسافات في المصفوفة الأفقية.
const JC_ONLY = process.env.JC_ONLY;
const paras = model.paragraphs.filter((p) =>
  !p.excluded &&
  p.text.trim().split(/\s+/).length >= 8 &&
  (!JC_ONLY || (JC_ONLY === "kashida"
    ? /Kashida$/.test(p.jc ?? "")
    : (p.jc ?? "null") === JC_ONLY)) &&
  p.runs.every((r) => r.family === FAMILY && r.emTwips),
);

let linesTotal = 0, linesMatched = 0, parasAligned = 0, parasSkipped = 0;
const failures = [];
const divDecisions = []; // نطاق الجدوى التجريبي لقاسم المقارنة الموزونة

for (const p of paras) {
  // تكميم em على شبكة 600dpi: نتيجة سلبية قاطعة أفقيًا (jalsa ‏82.8←65.8،
  // ‏dawra ‏96.6←81.7) — ‏Word يقيس الأعراض الأفقية بالمقاييس المثالية
  // (em الكسري) بينما شبكة النقاط تحكم الرأسي والرسم فقط. ‏EM600=1 للتجريب.
  const emQ = (v) => process.env.EM600 === "1" ? Math.round(v * 5 / 12) * 2.4 : v;
  const em = emQ(p.runs[0].emTwips);
  // فواصل الأسطر اليدوية (w:br ⇒ \n من النموذج): كسر إجباري بعد الكلمة —
  // درس sample-tadris: ‏33 فاصلًا يدويًا ظهرت أسطرها «قصيرة بلا سبب».
  const words = []; const brkAfter = new Set();
  if (process.env.MANUAL_BR !== "0") {
    for (const seg of p.text.split("\n")) {
      const ws = seg.trim().split(/\s+/).filter(Boolean);
      words.push(...ws);
      if (words.length) brkAfter.add(words.length - 1);
    }
    brkAfter.delete(words.length - 1); // آخر الفقرة ينتهي طبيعيًا
  } else words.push(...p.text.trim().split(/\s+/).filter(Boolean));
  const spaceW = widthTwips(" ", em);
  // هندسة مقطع الفقرة نفسها — المستندات متعددة المقاطع (درس muqtarah:
  // مقطع عمودي 8722 يليه عرضي 14299 واعتماد الأخير كسّر كل المحاذاة)
  const sec = model.sections?.[p.sectionIndex] ?? model.section;
  const colBase = sec.columnTwips - p.indLeft - p.indRight;

  // كاسر greedy على أعراض عناقيد الفقرة المشكَّلة كاملةً (لا جمع كلمات معزولة):
  // التشكيل السياقي يلتقط kerning/الوصل عبر الحدود — كما يقيس محرك حقيقي.
  const fullText = words.join(" ");
  // خريطة حجم كل حرف من runs الفقرة — الفقرات مختلطة الأحجام (درس para181:
  // run بحجم 320 وسط فقرة 300 جعل قياسنا أقصر 6.7% فحشرنا كلمة زائدة،
  // وبدا سطر Word «لا يبلغ الهامش» — الفئة 2 كانت خلل عدّة لا سلوك Word).
  const emAt = new Float64Array(fullText.length);
  if (process.env.RUN_EM !== "0") {
    const raw = p.text, rawEm = [];
    for (const r of p.runs) for (const ch of r.text) rawEm.push(emQ(r.emTwips));
    let k = 0;
    for (let fi = 0; fi < fullText.length; fi++) {
      if (fullText[fi] === " ") {
        emAt[fi] = /\s/.test(raw[k] ?? "") ? rawEm[k] : em;
        while (k < raw.length && /\s/.test(raw[k])) k++;
      } else {
        while (k < raw.length && /\s/.test(raw[k])) k++;
        emAt[fi] = rawEm[k] ?? em; k++;
      }
    }
  } else emAt.fill(em);
  const advAtChar = new Float64Array(fullText.length + 1);
  if (process.env.WORD_SHAPE === "1") {
    // تجربة: تشكيل كل كلمة معزولة (قطع kerning/السياق عبر المسافات —
    // فرضية أن Word يقيس أجزاء السطر لا السطر المتصل)
    let pos = 0;
    for (const wd of words) {
      const b = new HbBuffer(); b.addText(wd); b.guessSegmentProperties(); shape(font, b);
      const is = b.getGlyphInfos(), ps = b.getGlyphPositions();
      for (let g = 0; g < is.length; g++)
        advAtChar[pos + is[g].cluster] += (ps[g].xAdvance / upem) * emAt[pos + is[g].cluster];
      pos += wd.length;
      if (pos < fullText.length) { advAtChar[pos] = (emAt[pos] / em) * spaceW; pos++; }
    }
  } else {
    const buf = new HbBuffer();
    buf.addText(fullText); buf.guessSegmentProperties(); shape(font, buf);
    const infos = buf.getGlyphInfos(), poss = buf.getGlyphPositions();
    for (let g = 0; g < infos.length; g++) advAtChar[infos[g].cluster] += (poss[g].xAdvance / upem) * emAt[infos[g].cluster];
  }
  // تجارب تقريب المقاييس (عائلة الحدّيات ±80 twips):
  // ‏ROUND_ADV=1: تقريب تقدم العنقود لأقرب twip (نتيجة سلبية صافية مقيسة).
  // ‏ROUND_ADV=2: تكميم على 1/100 من em (محبب XPS Indices نفسه).
  if (process.env.ROUND_ADV === "1")
    for (let c = 0; c <= fullText.length; c++) advAtChar[c] = Math.round(advAtChar[c]);
  else if (process.env.ROUND_ADV === "2")
    for (let c = 0; c <= fullText.length; c++) {
      const emC = emAt[c] || em;
      advAtChar[c] = Math.round((advAtChar[c] / emC) * 100) / 100 * emC;
    }
  // معايرة محرك قديم (compat<15): انحياز مقيس ثابت (jalsa: وسيط 0.9855)
  const SCALE = Number(process.env.ADV_SCALE ?? "1");
  if (SCALE !== 1) for (let c = 0; c <= fullText.length; c++) advAtChar[c] *= SCALE;
  const prefix = new Float64Array(fullText.length + 1);
  for (let c = 0; c < fullText.length; c++) prefix[c + 1] = prefix[c] + advAtChar[c];
  const width = (a, b) => prefix[b] - prefix[a]; // عرض النص [a,b)

  // محاذاة قبل الكسر (لا تعتمد على أسطرنا): أول truth line بادئةٌ لنص الفقرة.
  // تسامح بادئة العلامة: فقرات w:numPr يرسم Word علامتها (·، ‏1-، …) كـrun
  // في بداية السطر وليست في نص docx — نسمح بإسقاط ≤5 أحرف من رأس سطر الحقيقة
  // (درس muqtarah: ‏11 فقرة معدودة بلا محاذاة).
  const paraN = norm(p.text);
  let start = -1, markerLen = 0;
  outer:
  for (let i = 0; i < truthLines.length; i++) {
    const tn = truthLines[i].n;
    // شرط الحجم: نفس الفقرة النصية قد تتكرر بأحجام مختلفة (ملخص/متن)
    if (!tn || tn.length <= 10 || Math.abs(truthLines[i].em - em) > 3) continue;
    for (let j = 0; j <= 5 && j < tn.length - 10; j++) {
      if (paraN.startsWith(tn.slice(j))) { start = i; markerLen = j; break outer; }
    }
  }
  if (start < 0) { parasSkipped++; continue; }
  parasAligned++;
  // علامة التعداد والسطر الأول — قاعدة تاب الترقيم (بحث Clean-room، ‏ECMA-376
  // ‏suff/defaultTabStop/doNotUseIndentAsNumberingTabStop): العلامة ترتكز عند
  // ‏(indLeft − hanging)، والنص يبدأ عند أول موقف تبويب بعد نهايتها —
  // الموقف الافتراضي (virtual) عند indLeft، وإلا فمضاعفات defaultTabStop
  // المقيسة من هامش النص. ‏(MARKER_W=0 للتعطيل A/B)
  let markerW = 0; // خصم من عمود السطر الأول = (موقف بدء النص − indLeft)
  if (markerLen > 0 && p.numbered && process.env.MARKER_W !== "0") {
    // عرض العلامة من runs الحقيقة أولًا (علامات Wingdings ليست بخط المتن —
    // قياسها به خطأ صريح)؛ الرجوع لخط المتن إن لم تنطبق حدود الـruns.
    let mW = 0;
    if (process.env.MARKER_TRUTH !== "0") {
      let covered = 0;
      for (const r of [...truthLines[start].runs].sort((a, b) => b.x - a.x)) {
        if (covered >= markerLen) break;
        mW += r.advSumTwips ?? 0;
        covered += norm(r.text).length;
      }
      if (covered !== markerLen) mW = 0; // حدود لا تنطبق — تراجع
    }
    if (!mW) mW = widthTwips(truthLines[start].raw.replace(/\s+/g, "").slice(0, markerLen), em);
    const textStart = numTabTextStart({
      indLeftTwips: p.indLeft,
      hangingTwips: p.indFirstLine < 0 ? -p.indFirstLine : 0,
      markerWidthTwips: mW,
      defaultTabStopTwips: model.defaultTabStop,
    });
    markerW = Math.round(Math.max(0, textStart - p.indLeft));
  }

  // استهلاك أسطر الحقيقة مقدَّمًا (قبل الكسر) مع تخطي الفوترات المتخللة —
  // يوفر y لكل سطر متوقع (البعد الرأسي المقيس لتضييق العائمات)
  const seq = [];
  for (let j = start, accLen = 0;
       j < truthLines.length && accLen < paraN.length && seq.length < words.length + 2; j++) {
    const t = truthLines[j];
    if (/^[()0-9]{1,6}$/.test(t.n)) continue;
    if (/^الصفحة\(?\d+\)?من\(?\d+\)?$/.test(t.n)) continue;
    seq.push(t); accLen += t.n.length;
  }

  const ourLines = []; const ourMeta = [];
  let lineStartChar = 0, lineEndChar = 0, lineWords = [], cursor = 0, wi = -1;
  for (const word of words) {
    wi++;
    const wordStart = fullText.indexOf(word, cursor);
    const wordEnd = wordStart + word.length;
    cursor = wordEnd;
    // التقدم الأول بإشارته: السالب تعليقٌ (hanging) يوسّع السطر الأول —
    // الحقيقة أكدته (para127: سطر أول يمتد إلى 15456 متجاوزًا هامش 15398 بـ58).
    // الفقرة المعدودة: العلامة + التبويب يملآن منطقة التعليق حتى indLeft
    // ⇒ نص السطر الأول يبدأ كسائر الأسطر (لا توسعة).
    const indFL = p.numbered ? 0
      : process.env.HANG_IND === "0" ? Math.max(p.indFirstLine, 0) : p.indFirstLine;
    let W = colBase - (ourLines.length === 0 ? indFL + markerW : 0);
    // تضييق العائم: السطر المتوقع (y من الحقيقة) داخل نطاق عائم ⇒ عرضه المتاح
    const tSeq = seq[ourLines.length];
    if (tSeq && floatBands.length)
      for (const fb of floatBands)
        if (fb.page === tSeq.page && tSeq.y >= fb.top && tSeq.y <= fb.bottom && fb.avail < W)
          W = fb.avail;
    // سماحية ضغط مسافات في قرار الكسر — يعاد قياسها على العدّة المُصلحة
    // (القياس الأول كان على عدّة معطوبة: أسطر فارغة + تخلل فوتر).
    const FLOOR = Number(process.env.SPACE_FLOOR ?? "1");
    const nSp = (fullText.slice(lineStartChar, wordEnd).match(/ /g) ?? []).length;
    let allowance = nSp * spaceW * (1 - FLOOR);
    // ‏EPS تشخيصي فقط: يقيس حجم عائلة الحدّيات (لا يُتبنى كقاعدة)
    allowance += Number(process.env.EPS ?? "0");
    // ‏w:overflowPunct (افتراضي OOXML: true): علامة الترقيم في نهاية السطر
    // يُسمح لها بتجاوز الهامش — سماحية بعرض العلامة الطرفية نفسها.
    // ★ تعليق الترقيم الطرفيّ (وكيل بحث Q4: Word يكسر بعرض advance/ABC لا
    // الحبر، فالمِحبرة اليمنى للترقيم الطرفيّ تتدلّى خارج الهامش). التدلّي =
    // الحاملة اليمنى (ink خلف advance) — صغيرٌ، لا عرض المحرف كاملًا (الكامل
    // يُفرِط فيحشر masjid خطأً). نقرّبها بسقفٍ صغير OVERFLOW_CAP (افتراضي 24tw
    // = نقطة واحدة). ‏OVERFLOW_PUNCT=full للسلوك القديم (العرض الكامل).
    if (process.env.OVERFLOW_PUNCT !== "0") {
      const lastCh = word[word.length - 1];
      if ("،؛:.!؟»)".includes(lastCh)) {
        const cw = width(wordEnd - 1, wordEnd);
        allowance += process.env.OVERFLOW_PUNCT === "full"
          ? cw : Math.min(cw, Number(process.env.OVERFLOW_CAP ?? "12"));
      }
    }
    // ★ سماحية كسر حسب وضع الكشيدة (وكيل بحث: الوضع الأعلى K_max أكبر ⇒
    // يكسر أبكر). المقيس على tadris: ‏lowKashida نحشر أقل (Word يحشر متجاوزًا
    // قليلًا ⇒ سماحية موجبة) وmediumKashida نحشر أكثر (Word يكسر أبكر ⇒
    // سماحية سالبة/تحفّظ). الوحدة كسرٌ من عرض المسافة. ‏KASHIDA_MARGIN=0 للتعطيل.
    const KM = Number(process.env.KASHIDA_MARGIN ?? "0");
    let kMargin = 0;
    if (KM) {
      if (p.jc === "lowKashida") kMargin = +0.9 * spaceW;      // احشر أكثر
      else if (p.jc === "mediumKashida") kMargin = -0.9 * spaceW; // اكسر أبكر
      else if (p.jc === "highKashida") kMargin = -1.8 * spaceW;
    }
    let fits = !(lineWords.length && width(lineStartChar, wordEnd) - allowance - kMargin > W);
    // ★ خوارزمية Word 2013+ ‏(compatibilityMode≥15، ‏jc=both) — القاعدة 16:
    // تمريرة انكماش: أرضية المسافة 75%، وتُتبنى فقط إن كان بديل التمديد أسوأ
    // (المقارنة الموزونة: e>1.5 أو 1+(e−1)/1.7 ≥ 1/σ). مصدر النموذج:
    // هندسة LibreOffice العكسية لـ MSO ‏(tdf#119908 وسلسلته).
    let shrinkPacked = false;
    // أوضاع الكشيدة تسوّغ لكن بمعاملات حشر مختلفة: تعميم بوابة both عليها
    // نتيجة سلبية مقيسة (كتاب1: 98.9%←87.4%؛ ‏tadris: ‏89.2%←85.8%) —
    // ‏Word يحشر في mediumKashida ‏(tadris 48/242) ولا يحشر في lowKashida
    // بنفس العتبات ⇒ بند بحث مستقل. ‏KASHIDA_JC=1 للتجريب فقط.
    const JUST_JC = process.env.KASHIDA_JC === "1"
      ? ["both", "lowKashida", "mediumKashida", "highKashida"] : ["both"];
    // بوابة القاعدة 16 الآلية: الانكماش لـcompatibilityMode ≥ 15 حصرًا —
    // تأكدت على sample-jalsa27 ‏(compat=11): تعطيله 59.5%←82.4%.
    const smartOn = process.env.SMART_JUSTIFY != null
      ? process.env.SMART_JUSTIFY !== "0" : model.compatibilityMode >= 15;
    if (!fits && smartOn && JUST_JC.includes(p.jc) && lineWords.length) {
      const D = width(lineStartChar, wordEnd) - W;
      const seg = fullText.slice(lineStartChar, wordEnd);
      const n = (seg.match(/ /g) ?? []).length;
      if (n > 0) {
        const sigma = 1 - D / (n * spaceW);
        // ★ أرضية الانكماش الصلبة (قاعدة 16-ب، وكيل بحث LO/Németh tdf#119908):
        // Word 2013+ يضغط المسافة بحدٍّ أقصى، فوقه **يكسر** حتمًا مهما حسُنت
        // نسبة الحدّين. البحث دلّ على المفهوم (PropWordSpacingMinimum)؛ والمسح
        // على الحقيقة ثبّت القيمة **σ≥0.75 (أقصى 25% انكماش)** — muqtarah أفقي
        // 91.3→100% بلا انتكاس (كان يحشر سطورًا تتطلّب >25% كسرها Word). البوابة
        // القديمة D≤0.25(n+1)w كانت أرخى بـ0.25/n فتُمرّر تلك السطور. SIGMA_FLOOR
        // لتعديل القيمة، =0 للبوابة القديمة.
        const sigFloor = process.env.SIGMA_FLOOR != null ? Number(process.env.SIGMA_FLOOR) : 0.75;
        const gateOK = sigFloor > 0 ? (sigma >= sigFloor) : (D <= 0.25 * (n + 1) * spaceW);
        let e = null, L1 = null, n1 = null;
        if (gateOK) {
          L1 = width(lineStartChar, lineEndChar);
          n1 = Math.max(n - 1, 0);
          e = n1 > 0 ? 1 + (W - L1) / (n1 * spaceW) : Infinity;
          // فرضية بحث الكشيدة: سقف التمديد = هدف الوضع (1.33/2.0/3.0)
          const CAP_BY_JC = { both: 1.5, lowKashida: 1.33, mediumKashida: 2.0, highKashida: 3.0 };
          const CAP = process.env.KASHIDA_CAP === "1"
            ? (CAP_BY_JC[p.jc] ?? 1.5)
            : Number(process.env.E_CAP ?? "1.5");
          // قاسم المقارنة الموزونة: 1.6 معايرةً على نطاق الجدوى التجريبي
          // (1.481, 1.680] من 33 قرارًا محكومًا بالحقيقة — 1.7 المستعار من
          // هندسة LO العكسية خارج النطاق (يرفض حشر 104:0 الذي فعله Word).
          const DIV = Number(process.env.W_DIV ?? "1.6");
          // ★ نموذج نسبة الحدّين (وكيل بحث LO/Németh 2026-07-14) — **الافتراضي**:
          // القرار مقارنة «رداءة» الحشر (انكماش s=1−σ نسبةً لسقفه S_max=0.25،
          // أرضية 75%) بـ«رداءة» الكسر (تمديد t=e−1 نسبةً لسقفه T_max=0.50،
          // أي E_CAP=1.5). الأس المكعّب المشترك يُلغى فتصير: احشر ⇔ s/t < k،
          // ‏**k = S_max/T_max = 0.25/0.50 = 0.50** (ليس ثابتًا مُعايَرًا بل نسبة
          // حدّين فيزيائيين). يفصل «أن» الحدّية (s/t=0.52≥0.50 ⇒ كسر) التي عجز
          // النموذج الخطّي القديم عنها (‏1+(e−1)/DIV≥1/σ)؛ ‏masjid 99.5→100،
          // ‏ahadith 97.7→99.2، بلا انتكاس. ‏W_MODEL=linear للنموذج القديم.
          const K = Number(process.env.W_K ?? "0.50");
          const adopt = process.env.W_MODEL === "linear"
            ? (e > CAP || 1 + (e - 1) / DIV >= 1 / sigma)
            : (e > CAP || sigma >= 1 || (1 - sigma) / (e - 1) < K);
          if (adopt) { fits = true; shrinkPacked = true; }
          // حدّ القاسم الذي يقلب هذا القرار: adopt ⇔ DIV ≤ (e−1)σ/(1−σ)
          if (e <= CAP && sigma < 1)
            divDecisions.push({ para: p.index, line: ourLines.length, adopted: adopt,
              bound: (e - 1) * sigma / (1 - sigma) });
        }
        if (process.env.FORENSIC_SHRINK &&
            process.env.FORENSIC_SHRINK.split(",").includes(String(p.index)))
          console.log("قرار-انكماش:", JSON.stringify({ para: p.index, line: ourLines.length,
            word, D: Math.round(D), n, spaceW: Math.round(spaceW),
            gate: Math.round(0.25 * (n + 1) * spaceW), gateOK,
            sigma: +sigma.toFixed(4), invSigma: +(1 / sigma).toFixed(4),
            e: e === null ? null : +(+e).toFixed(4),
            weighted: e === null ? null : +(1 + (e - 1) / 1.7).toFixed(4),
            adopted: shrinkPacked }));
      }
    }
    if (!fits) {
      ourLines.push(lineWords); ourMeta.push({ start: lineStartChar, nextWordEnd: wordEnd });
      lineWords = [word]; lineStartChar = wordStart;
    } else {
      lineWords.push(word);
      // بعد الحشر بالانكماش السطر ممتلئ — يُغلق فورًا (السلوك المرصود)
      if (shrinkPacked) {
        ourLines.push(lineWords); ourMeta.push({ start: lineStartChar, nextWordEnd: -1 });
        lineWords = []; lineStartChar = wordEnd + 1;
      }
    }
    lineEndChar = wordEnd;
    // كسر إجباري بعد هذه الكلمة (w:br) — يُغلق السطر مهما كان امتلاؤه
    if (brkAfter.has(wi) && lineWords.length) {
      ourLines.push(lineWords); ourMeta.push({ start: lineStartChar, nextWordEnd: -1 });
      lineWords = []; lineStartChar = wordEnd + 1;
    }
  }
  if (lineWords.length) { ourLines.push(lineWords); ourMeta.push({ start: lineStartChar, nextWordEnd: -1 }); }

  let firstDiv = -1, cmpN = 0;
  for (let i = 0; i < ourLines.length; i++) {
    const t = seq[i];
    if (!t) break;
    cmpN = i + 1;
    linesTotal++;
    // سطر الفقرة الأول يقارن بعد إسقاط علامة التعداد المرسومة (markerLen)
    const tn = i === 0 ? t.n.slice(markerLen) : t.n;
    const ok = norm(ourLines[i].join("")) === tn;
    if (!ok && firstDiv < 0) firstDiv = i;
    if (ok) linesMatched++;
    else if (firstDiv === i && process.env.FORENSICS) {
      // الكلمة الحدية: أول اختلاف بين تسلسلي الكلمات
      const oN = norm(ourLines[i].join(""));
      let c = 0; while (c < Math.min(t.n.length, oN.length) && t.n[c] === oN[c]) c++;
      const wWords = [t.n.slice(Math.max(0,c-8), c+10)];
      const oWords = [oN.slice(Math.max(0,c-8), c+10)];
      const k = c;
      const kashN = t.runs.reduce((a, r) => a + (r.glyphIds ?? []).filter((g) => g === 229).length, 0);
      const wordLineAdv = t.runs.reduce((a, r) => a + (r.advSumTwips ?? 0), 0);
      const rightEdge = sec.pageWTwips - sec.marRightTwips;
      console.log("تشريح:", JSON.stringify({
        para: p.index, line: i, jc: p.jc, divergeAtWord: k,
        wordSide: wWords[0], ourSide: oWords[0], wLen: t.n.length, oLen: oN.length,
        boundaryLastChar: (wWords[wWords.length - 1] ?? "").slice(-1),
        // هندسة سطر الحقيقة مقابل حواف العمود: تضيّق يسار/يمين (عائم؟ تقدم؟)
        gapL: t.xMin - sec.marLeftTwips, gapR: rightEdge - t.xMax,
        tAdv: Math.round(t.advAll),
        kashidasOnLine: kashN, wordLineAdvTwips: Math.round(wordLineAdv), W: colBase,
        ourNatOverIfPacked: ourMeta[i] && ourMeta[i].nextWordEnd > 0
          ? Math.round(width(ourMeta[i].start, ourMeta[i].nextWordEnd) - colBase) : null,
      }));
    }
    else if (failures.length < 8) {
      // تشخيص: عرض سطر Word الفعلي بكلماته (تشكيلنا) مقابل عمودنا
      const wWords = t.raw.split(/\s+/).filter(Boolean);
      let ww = 0; for (let k = 0; k < wWords.length; k++)
        ww += (k ? spaceW : 0) + widthTwips(wWords[k], em);
      failures.push({ para: p.index, i, W: colBase, wordLineW: Math.round(ww),
        over: Math.round(ww - colBase),
        word: t.raw.slice(0, 35), ours: ourLines[i].join(" ").slice(0, 35) });
    }
  }
  // تعليم صحة قرارات الانكماش: قبل أول انحراف = موافقة Word؛ عنده = مخالفته؛
  // بعده أو خارج المقارنة = مجهولة (الحقيقة تنزاح بالتتالي) فتُسقط من النطاق.
  for (const d of divDecisions) if (d.para === p.index && d.truth === undefined) {
    if (d.line >= cmpN) d.truth = null;
    else if (firstDiv < 0 || d.line < firstDiv) d.truth = d.adopted;
    else if (d.line === firstDiv) d.truth = !d.adopted;
    else d.truth = null;
  }
}

if (process.env.DIV_BAND) {
  // نطاق الجدوى: adopt ⇔ DIV ≤ bound ⇒ الحشود الصحيحة تعطي حدًا أعلى مسموحًا
  // (DIV ≤ min bounds)، والرفوض الصحيحة حدًا أدنى (DIV > max bounds).
  const judged = divDecisions.filter((d) => d.truth !== null && d.truth !== undefined);
  const adopts = judged.filter((d) => d.truth).sort((a, b) => a.bound - b.bound);
  const rejects = judged.filter((d) => !d.truth).sort((a, b) => b.bound - a.bound);
  console.log(`قرارات محكومة: ${judged.length} (حشر ${adopts.length} / كسر ${rejects.length})`);
  console.log("أدنى حدود الحشر:", adopts.slice(0, 5).map((d) => `${d.bound.toFixed(4)}@${d.para}:${d.line}`).join(" "));
  console.log("أعلى حدود الكسر:", rejects.slice(0, 5).map((d) => `${d.bound.toFixed(4)}@${d.para}:${d.line}`).join(" "));
  const lo = rejects.length ? rejects[0].bound : -Infinity;
  const hi = adopts.length ? adopts[0].bound : Infinity;
  console.log(lo < hi
    ? `★ نطاق DIV الممكن: (${lo.toFixed(4)}, ${hi.toFixed(4)}]`
    : `⚠ لا نطاق متسقًا — تعارضات: ${rejects.filter((d) => d.bound >= hi).length + adopts.filter((d) => d.bound <= lo).length}`);
}
const pct = linesTotal ? ((100 * linesMatched) / linesTotal).toFixed(2) : "0";
console.log(`فقرات docx مؤهلة: ${paras.length} | محاذاة: ${parasAligned} | بلا محاذاة: ${parasSkipped}`);
console.log(`★★ الرقم الشمالي v1 (نص من XML): ${linesMatched}/${linesTotal} = ${pct}%`);
for (const f of failures) console.log("  فشل:", JSON.stringify(f));
writeFileSync(`corpus/ground-truth/linebreak-v1-report${BOOK === "sample-masjid" ? "" : "-" + BOOK}.json`,
  JSON.stringify({ paras: paras.length, parasAligned, linesTotal, linesMatched, pct: Number(pct), failures }, null, 1));
