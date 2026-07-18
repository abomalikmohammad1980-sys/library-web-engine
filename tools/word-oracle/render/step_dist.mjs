// توزيع خطأ الخطوة: يعرض الهيستوغرام والحالات الأسوأ مع نصّها — لتحديد نمط الخطأ.
import { readFileSync } from "node:fs";
const book = process.argv[2], ours = JSON.parse(readFileSync(process.argv[3], "utf8"));
const truth = JSON.parse(readFileSync(`corpus/ground-truth/${book}.truth.json`, "utf8"));
const norm = (s) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[ـ‎‏؜\s]+/g, "");
const W = [];
for (let pi = 0; pi < truth.pages.length; pi++) for (const l of truth.pages[pi].lines) {
  const rs = l.runs.filter((r) => r.text.trim()); if (!rs.length) continue;
  const y = l.baselineTwipsF ?? l.baselineTwips;
  const t = norm(rs.sort((a, b) => b.x - a.x).map((r) => r.text).join(""));
  if (t.length > 6) W.push({ t, y, page: pi, raw: rs.map(r=>r.text).join("") });
}
const O = [];
for (let pi = 0; pi < ours.pages.length; pi++) for (const l of ours.pages[pi].lines || []) {
  const t = norm(l.text || ""); if (t.length > 6) O.push({ t, y: l.y, page: pi, raw: l.text });
}
let wp = 0; const pairs = [];
for (const o of O) { let j=-1; for (let k=wp;k<Math.min(wp+40,W.length);k++) if (W[k].t===o.t||(W[k].t.length<o.t.length+8&&W[k].t.endsWith(o.t))){j=k;break;} if(j>=0){pairs.push({o,w:W[j]});wp=j+1;} }
const hist = {}; const big = [];
for (let i = 1; i < pairs.length; i++) {
  const a = pairs[i-1], b = pairs[i];
  if (a.o.page!==b.o.page||a.w.page!==b.w.page) continue;
  const os=b.o.y-a.o.y, ws=b.w.y-a.w.y; if (ws<300||ws>900) continue;
  const e = os - ws; // موقّع
  const bucket = Math.round(e); hist[bucket]=(hist[bucket]||0)+1;
  if (Math.abs(e) > 3) big.push({ e: e.toFixed(1), ws: ws.toFixed(1), os: os.toFixed(1), txt: b.w.raw.slice(0,32) });
}
console.log("هيستوغرام خطأ الخطوة الموقّع (tw→عدد):");
Object.keys(hist).map(Number).sort((a,b)=>a-b).forEach(k=>console.log(`  ${k>0?'+':''}${k}: ${'#'.repeat(hist[k])} ${hist[k]}`));
console.log(`\nأسوأ ${Math.min(15,big.length)} حالة (خطأنا-Word):`);
big.sort((a,b)=>Math.abs(b.e)-Math.abs(a.e)).slice(0,15).forEach(x=>console.log(`  e=${x.e} (نحن ${x.os} / Word ${x.ws}) «${x.txt}»`));
