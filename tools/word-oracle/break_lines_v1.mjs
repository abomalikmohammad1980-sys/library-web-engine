#!/usr/bin/env node
/** الكاسر v1 — نص الفقرات من docx مباشرة (القرار المنهجي بعد v0)،
 *  والحقيقة (XPS) للمقارنة فقط. المحاذاة بين فقرات docx وأسطر الحقيقة
 *  بتطبيع «بلا مسافات» + توحيد الأرقام + إسقاط علامات الاتجاه/التطويل. */
import { readFileSync, writeFileSync } from "node:fs";
import { Blob, Buffer as HbBuffer, Face, Font, shape } from "harfbuzzjs";
import { extractFromDocx } from "../../packages/ooxml-model/dist/index.js";

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
for (const pg of truth.pages) for (const ln of pg.lines) {
  const rs = ln.runs.filter((r) => r.text.trim());
  const logical = [...rs].sort((a, b) => b.x - a.x).map((r) => r.text).join("");
  const nn = norm(logical);
  if (!nn) continue; // سطر فارغ بصريًا — لا يشارك في تدفق النص
  truthLines.push({ n: nn, raw: logical.trim(),
    em: rs.length ? rs[0].emTwips : 0, runs: rs });
}

// فقرات docx المؤهلة: متن نظيف بخط adwa وحجم معلوم وكلمات كافية
const paras = model.paragraphs.filter((p) =>
  !p.excluded &&
  p.text.trim().split(/\s+/).length >= 8 &&
  p.runs.every((r) => r.family === FAMILY && r.emTwips),
);

let linesTotal = 0, linesMatched = 0, parasAligned = 0, parasSkipped = 0;
const failures = [];
const divDecisions = []; // نطاق الجدوى التجريبي لقاسم المقارنة الموزونة

for (const p of paras) {
  const em = p.runs[0].emTwips;
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
  const colBase = model.section.columnTwips - p.indLeft - p.indRight;

  // كاسر greedy على أعراض عناقيد الفقرة المشكَّلة كاملةً (لا جمع كلمات معزولة):
  // التشكيل السياقي يلتقط kerning/الوصل عبر الحدود — كما يقيس محرك حقيقي.
  const fullText = words.join(" ");
  // خريطة حجم كل حرف من runs الفقرة — الفقرات مختلطة الأحجام (درس para181:
  // run بحجم 320 وسط فقرة 300 جعل قياسنا أقصر 6.7% فحشرنا كلمة زائدة،
  // وبدا سطر Word «لا يبلغ الهامش» — الفئة 2 كانت خلل عدّة لا سلوك Word).
  const emAt = new Float64Array(fullText.length);
  if (process.env.RUN_EM !== "0") {
    const raw = p.text, rawEm = [];
    for (const r of p.runs) for (const ch of r.text) rawEm.push(r.emTwips);
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
  const buf = new HbBuffer();
  buf.addText(fullText); buf.guessSegmentProperties(); shape(font, buf);
  const infos = buf.getGlyphInfos(), poss = buf.getGlyphPositions();
  const advAtChar = new Float64Array(fullText.length + 1);
  for (let g = 0; g < infos.length; g++) advAtChar[infos[g].cluster] += (poss[g].xAdvance / upem) * emAt[infos[g].cluster];
  const prefix = new Float64Array(fullText.length + 1);
  for (let c = 0; c < fullText.length; c++) prefix[c + 1] = prefix[c] + advAtChar[c];
  const width = (a, b) => prefix[b] - prefix[a]; // عرض النص [a,b)

  const ourLines = []; const ourMeta = [];
  let lineStartChar = 0, lineEndChar = 0, lineWords = [], cursor = 0, wi = -1;
  for (const word of words) {
    wi++;
    const wordStart = fullText.indexOf(word, cursor);
    const wordEnd = wordStart + word.length;
    cursor = wordEnd;
    // التقدم الأول بإشارته: السالب تعليقٌ (hanging) يوسّع السطر الأول —
    // الحقيقة أكدته (para127: سطر أول يمتد إلى 15456 متجاوزًا هامش 15398 بـ58).
    const indFL = process.env.HANG_IND === "0" ? Math.max(p.indFirstLine, 0) : p.indFirstLine;
    const W = colBase - (ourLines.length === 0 ? indFL : 0);
    // سماحية ضغط مسافات في قرار الكسر — يعاد قياسها على العدّة المُصلحة
    // (القياس الأول كان على عدّة معطوبة: أسطر فارغة + تخلل فوتر).
    const FLOOR = Number(process.env.SPACE_FLOOR ?? "1");
    const nSp = (fullText.slice(lineStartChar, wordEnd).match(/ /g) ?? []).length;
    let allowance = nSp * spaceW * (1 - FLOOR);
    // ‏w:overflowPunct (افتراضي OOXML: true): علامة الترقيم في نهاية السطر
    // يُسمح لها بتجاوز الهامش — سماحية بعرض العلامة الطرفية نفسها.
    if (process.env.OVERFLOW_PUNCT === "1") {
      const lastCh = word[word.length - 1];
      if ("،؛:.!؟»)".includes(lastCh))
        allowance += width(wordEnd - 1, wordEnd);
    }
    let fits = !(lineWords.length && width(lineStartChar, wordEnd) - allowance > W);
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
        // بوابة السماحية بنص الخوارزمية: n_allow = n + 1 ‏(القاعدة 16 §3)
        const gateOK = D <= 0.25 * (n + 1) * spaceW;
        let e = null, L1 = null, n1 = null;
        if (gateOK) {
          L1 = width(lineStartChar, lineEndChar);
          n1 = Math.max(n - 1, 0);
          e = n1 > 0 ? 1 + (W - L1) / (n1 * spaceW) : Infinity;
          const CAP = Number(process.env.E_CAP ?? "1.5");
          // قاسم المقارنة الموزونة: 1.6 معايرةً على نطاق الجدوى التجريبي
          // (1.481, 1.680] من 33 قرارًا محكومًا بالحقيقة — 1.7 المستعار من
          // هندسة LO العكسية خارج النطاق (يرفض حشر 104:0 الذي فعله Word).
          const DIV = Number(process.env.W_DIV ?? "1.6");
          const adopt = e > CAP || 1 + (e - 1) / DIV >= 1 / sigma;
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

  // محاذاة: أول truth line يطابق nospace سطرنا الأول
  const target = norm(ourLines[0].join(" "));
  const paraN = norm(p.text);
  let start = -1;
  for (let i = 0; i < truthLines.length; i++) {
    // شرط الحجم: نفس الفقرة النصية قد تتكرر بأحجام مختلفة (ملخص/متن)
    if (truthLines[i].n && paraN.startsWith(truthLines[i].n) && truthLines[i].n.length > 10
        && Math.abs(truthLines[i].em - em) <= 3) { start = i; break; }
  }
  if (start < 0) { parasSkipped++; continue; }
  parasAligned++;

  // استهلاك أسطر الحقيقة مع تخطي أسطر أرقام صفحات الفوتر المتخللة
  // (فقرة عابرة للصفحات ⇐ رقم الصفحة يقع بين سطرين — الفئة أ في المصنّف)
  const seq = [];
  for (let j = start; j < truthLines.length && seq.length <= ourLines.length; j++) {
    if (/^[()0-9]{1,6}$/.test(truthLines[j].n)) continue;
    seq.push(truthLines[j]);
  }

  let firstDiv = -1, cmpN = 0;
  for (let i = 0; i < ourLines.length; i++) {
    const t = seq[i];
    if (!t) break;
    cmpN = i + 1;
    linesTotal++;
    const ok = norm(ourLines[i].join("")) === t.n;
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
      console.log("تشريح:", JSON.stringify({
        para: p.index, line: i, divergeAtWord: k,
        wordSide: wWords[0], ourSide: oWords[0], wLen: t.n.length, oLen: oN.length,
        boundaryLastChar: (wWords[wWords.length - 1] ?? "").slice(-1),
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
