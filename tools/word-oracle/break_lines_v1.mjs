#!/usr/bin/env node
/** الكاسر v1 — نص الفقرات من docx مباشرة (القرار المنهجي بعد v0)،
 *  والحقيقة (XPS) للمقارنة فقط. المحاذاة بين فقرات docx وأسطر الحقيقة
 *  بتطبيع «بلا مسافات» + توحيد الأرقام + إسقاط علامات الاتجاه/التطويل. */
import { readFileSync, writeFileSync } from "node:fs";
import { Blob, Buffer as HbBuffer, Face, Font, shape } from "harfbuzzjs";
import { extractFromDocx } from "../../packages/ooxml-model/dist/index.js";

const model = extractFromDocx(readFileSync("corpus/books/sample-masjid.docx"));
const truth = JSON.parse(readFileSync("corpus/ground-truth/sample-masjid.truth.json", "utf-8"));

const face = new Face(new Blob(readFileSync("corpus/book-fonts/adwa-assalaf.ttf")), 0);
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
  p.runs.every((r) => r.family === "adwa-assalaf" && r.emTwips),
);

let linesTotal = 0, linesMatched = 0, parasAligned = 0, parasSkipped = 0;
const failures = [];

for (const p of paras) {
  const em = p.runs[0].emTwips;
  const words = p.text.trim().split(/\s+/);
  const spaceW = widthTwips(" ", em);
  const colBase = model.section.columnTwips - p.indLeft - p.indRight;

  // كاسر greedy على أعراض عناقيد الفقرة المشكَّلة كاملةً (لا جمع كلمات معزولة):
  // التشكيل السياقي يلتقط kerning/الوصل عبر الحدود — كما يقيس محرك حقيقي.
  const fullText = words.join(" ");
  const buf = new HbBuffer();
  buf.addText(fullText); buf.guessSegmentProperties(); shape(font, buf);
  const infos = buf.getGlyphInfos(), poss = buf.getGlyphPositions();
  const advAtChar = new Float64Array(fullText.length + 1);
  for (let g = 0; g < infos.length; g++) advAtChar[infos[g].cluster] += (poss[g].xAdvance / upem) * em;
  const prefix = new Float64Array(fullText.length + 1);
  for (let c = 0; c < fullText.length; c++) prefix[c + 1] = prefix[c] + advAtChar[c];
  const width = (a, b) => prefix[b] - prefix[a]; // عرض النص [a,b)

  const ourLines = []; const ourMeta = [];
  let lineStartChar = 0, lineEndChar = 0, lineWords = [], cursor = 0;
  for (const word of words) {
    const wordStart = fullText.indexOf(word, cursor);
    const wordEnd = wordStart + word.length;
    cursor = wordEnd;
    const W = colBase - (ourLines.length === 0 ? Math.max(p.indFirstLine, 0) : 0);
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
    if (!fits && process.env.SMART_JUSTIFY !== "0" && p.jc === "both" && lineWords.length) {
      const D = width(lineStartChar, wordEnd) - W;
      const seg = fullText.slice(lineStartChar, wordEnd);
      const n = (seg.match(/ /g) ?? []).length;
      if (n > 0) {
        const sigma = 1 - D / (n * spaceW);
        if (sigma >= 0.75) {
          const L1 = width(lineStartChar, lineEndChar);
          const n1 = Math.max(n - 1, 0);
          const e = n1 > 0 ? 1 + (W - L1) / (n1 * spaceW) : Infinity;
          if (e > 1.5 || 1 + (e - 1) / 1.7 >= 1 / sigma) { fits = true; shrinkPacked = true; }
        }
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

  let firstDiv = -1;
  for (let i = 0; i < ourLines.length; i++) {
    const t = seq[i];
    if (!t) break;
    linesTotal++;
    const ok = norm(ourLines[i].join("")) === t.n;
    if (ok) linesMatched++;
    else if (firstDiv < 0 && process.env.FORENSICS) {
      firstDiv = i;
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
}

const pct = linesTotal ? ((100 * linesMatched) / linesTotal).toFixed(2) : "0";
console.log(`فقرات docx مؤهلة: ${paras.length} | محاذاة: ${parasAligned} | بلا محاذاة: ${parasSkipped}`);
console.log(`★★ الرقم الشمالي v1 (نص من XML): ${linesMatched}/${linesTotal} = ${pct}%`);
for (const f of failures) console.log("  فشل:", JSON.stringify(f));
writeFileSync("corpus/ground-truth/linebreak-v1-report.json",
  JSON.stringify({ paras: paras.length, parasAligned, linesTotal, linesMatched, pct: Number(pct), failures }, null, 1));
