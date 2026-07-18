// قياسٌ عالميّ: يحاذي تسلسل أسطرنا بأسطر Word (حفظًا للترتيب)، ويقيس دقّة **الخطوة**
// (فرق الأساس بين سطرين متتاليين) على الأزواج المتطابقة — يعزل آليّة العموديّ عن
// انجراف التركيب/الكسر. الاستخدام: node measure_steps.mjs <book> <ours.json>
import { readFileSync } from "node:fs";
const book = process.argv[2], ours = JSON.parse(readFileSync(process.argv[3], "utf8"));
const truth = JSON.parse(readFileSync(`corpus/ground-truth/${book}.truth.json`, "utf8"));
const norm = (s) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[ـ‎‏؜\s]+/g, "");
// تسلسل أسطر Word (المتن، بالترتيب) — {t, y, page}
const W = [];
for (let pi = 0; pi < truth.pages.length; pi++) for (const l of truth.pages[pi].lines) {
  const rs = l.runs.filter((r) => r.text.trim()); if (!rs.length) continue;
  const y = l.baselineTwipsF ?? l.baselineTwips;
  const t = norm(rs.sort((a, b) => b.x - a.x).map((r) => r.text).join(""));
  if (t.length > 6) W.push({ t, y, page: pi });
}
// تسلسل أسطرنا — {t, y, page}
const O = [];
for (let pi = 0; pi < ours.pages.length; pi++) for (const l of ours.pages[pi].lines || []) {
  const t = norm(l.text || ""); if (t.length > 6) O.push({ t, y: l.y, page: pi });
}
// محاذاة حافظة للترتيب: لكلّ سطرٍ لنا، ابحث أقرب سطر Word مطابقٍ بعد المؤشّر
let wp = 0; const pairs = [];
for (const o of O) {
  let j = -1;
  for (let k = wp; k < Math.min(wp + 40, W.length); k++) if (W[k].t === o.t) { j = k; break; }
  if (j >= 0) { pairs.push({ o, w: W[j] }); wp = j + 1; }
}
// دقّة الخطوة: أزواجٌ متتاليةٌ متطابقة، كلاهما نفس الصفحة في الجانبين
let n = 0, within = 0, es = [];
for (let i = 1; i < pairs.length; i++) {
  const a = pairs[i - 1], b = pairs[i];
  if (a.o.page !== b.o.page || a.w.page !== b.w.page) continue;
  const os = b.o.y - a.o.y, ws = b.w.y - a.w.y;
  if (ws < 300 || ws > 900) continue;
  n++; const e = Math.abs(os - ws); if (e <= 3) within++; es.push(e);
}
es.sort((a, b) => a - b);
console.log(book.padEnd(16), "أزواج متطابقة:", pairs.length, "| خطوات مقيسة:", n,
  "| خطوة ضمن±3tw:", (100 * within / n).toFixed(0) + "%", "| وسيط", (es[Math.floor(n / 2)] || 0).toFixed(2) + "tw");
