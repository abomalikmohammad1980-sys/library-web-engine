// مقياسٌ **أفقيّ**: يقارن حافّتَي كلّ سطر (xMin/xMax) بمخرجات Word.
// المقاييسُ السابقة كلُّها رأسيّة (الخطوة وحدّ الصفحة) فلا تُبصر المحاذاةَ ولا
// التسويغَ ولا المسافات البادئة. الاستعمال:
//   node measure_horizontal.mjs <book> <ours.json>
import { readFileSync } from "node:fs";

const BOOK = process.argv[2];
const OURS = process.argv[3];
const TOL = Number(process.env.HTOL ?? "40");   // ‏٤٠tw ≈ ٢ نقطة

const truth = JSON.parse(readFileSync(`corpus/ground-truth/${BOOK}.truth.json`, "utf8"));
const ours = JSON.parse(readFileSync(OURS, "utf8"));

const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

// نطابق الأسطرَ بنصّها داخل الصفحة الواحدة (أوّلُ مطابقةٍ غيرِ مستهلَكة)
let pairs = 0, okMin = 0, okMax = 0, okBoth = 0;
const worst = [];
const pages = Math.min(truth.pages.length, ours.pages.length);

for (let pi = 0; pi < pages; pi++) {
  const tl = truth.pages[pi].lines ?? [];
  const ol = (ours.pages[pi].lines ?? []).map((l) => {
    if (l.xMin == null) return null;   // حدّا الحبر يسجّلهما المُركِّب وقت الرصف
    return { text: norm(l.text), xMin: l.xMin, xMax: l.xMax };
  }).filter(Boolean);

  const used = new Set();
  for (const t of tl) {
    const key = norm(t.text);
    if (!key) continue;
    const j = ol.findIndex((o, k) => !used.has(k) && o.text === key);
    if (j < 0) continue;
    used.add(j);
    const o = ol[j];
    pairs++;
    // في RTL **بدايةُ** السطر هي الحافّة اليمنى (xMax) و**نهايتُه** اليسرى (xMin).
    // البدايةُ تقيس المحاذاةَ والمسافةَ البادئة؛ والنهايةُ تقيس عرضَ التشكيل.
    const dMin = o.xMax - t.xMax, dMax = o.xMin - t.xMin;
    const a = Math.abs(dMin) <= TOL, b = Math.abs(dMax) <= TOL;
    if (a) okMin++;
    if (b) okMax++;
    if (a && b) okBoth++;
    else worst.push({ pi, text: key.slice(0, 42), dMin: Math.round(dMin), dMax: Math.round(dMax) });
  }
}

const pc = (n) => (pairs ? Math.round((n / pairs) * 100) : 0);
worst.sort((a, b) => Math.abs(b.dMin) - Math.abs(a.dMin));
for (const w of worst.slice(0, 8)) {
  console.log(`  ص${w.pi} Δبداية=${String(w.dMin).padStart(6)} Δنهاية=${String(w.dMax).padStart(6)}  ${w.text}`);
}
console.log(`${BOOK}: أسطرٌ مطابَقة: ${pairs} | بدايةُ السطر (محاذاة): ${pc(okMin)}% | نهايتُه (عرض): ${pc(okMax)}% | كلتاهما: ${pc(okBoth)}% (±${TOL}tw)`);
