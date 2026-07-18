// قياس اتّفاق حدود الصفحات: على الأزواج المتطابقة نصًّا، هل انتقالُ صفحةٍ عند Word
// يوافقه انتقالُ صفحةٍ عندنا؟ (وبالعكس) — يقيس صحّة كسر الصفحات لا الخطوة العموديّة.
import { readFileSync } from "node:fs";
const book = process.argv[2], ours = JSON.parse(readFileSync(process.argv[3], "utf8"));
const truth = JSON.parse(readFileSync(`corpus/ground-truth/${book}.truth.json`, "utf8"));
const norm = (s) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[ـ‎‏؜\s]+/g, "");
const W = [];
for (let pi = 0; pi < truth.pages.length; pi++) for (const l of truth.pages[pi].lines) {
  const rs = l.runs.filter((r) => r.text.trim()); if (!rs.length) continue;
  const t = norm(rs.sort((a, b) => b.x - a.x).map((r) => r.text).join(""));
  if (t.length > 6) W.push({ t, page: pi });
}
const O = [];
for (let pi = 0; pi < ours.pages.length; pi++) for (const l of ours.pages[pi].lines || []) {
  const t = norm(l.text || ""); if (t.length > 6) O.push({ t, page: pi });
}
let wp = 0; const pairs = [];
for (const o of O) {
  let j = -1;
  for (let k = wp; k < Math.min(wp + 40, W.length); k++) if (W[k].t === o.t || (W[k].t.length < o.t.length + 8 && W[k].t.endsWith(o.t))) { j = k; break; }
  if (j >= 0) { pairs.push({ o, w: W[j] }); wp = j + 1; }
}
// على الأزواج المتتالية: هل «تغيّر صفحة Word» == «تغيّر صفحتنا»؟
let both = 0, agree = 0, wBreak = 0, oBreak = 0;
for (let i = 1; i < pairs.length; i++) {
  const a = pairs[i - 1], b = pairs[i];
  const wb = b.w.page !== a.w.page, ob = b.o.page !== a.o.page;
  if (wb) wBreak++; if (ob) oBreak++;
  both++; if (wb === ob) agree++;
}
console.log(book.padEnd(16), "أزواج:", pairs.length, "| اتّفاق حدّ الصفحة:",
  (100 * agree / both).toFixed(0) + "%", "| حدود Word:", wBreak, "حدودنا:", oBreak);
