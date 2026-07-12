#!/usr/bin/env node
/**
 * اختبار تباعد المُشكِّلين (المرحلة 0، المهمة 11):
 * يقارن مجموع تقدّمات الغليفات لكل مقطع (run) بين:
 *   - حقيقة Word (XPS ← truth.json، بالـ twips)
 *   - تشكيل HarfBuzz بنفس النص والخط الأصلي والحجم
 *
 * منهجية القياس:
 *   - نقتصر على المقاطع التي صرّح XPS بكل تقدماتها (لا omissions) — لأن
 *     التقدم المحذوف في XPS يعني «التقدم الطبيعي من الخط» فلا يصلح شاهدًا.
 *   - التحويل: twips = xAdvance / upem * emTwips (شبكة ADR-0004).
 *   - العتبة الأولية: ±10 twips (±0.5pt) لكل مقطع.
 *
 * الاستخدام:
 *   node verify_shaping.mjs <truth.json> <fonts-map.json> [--min-len 3]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Blob, Buffer as HbBuffer, Face, Font, shape } from "harfbuzzjs";

const [truthPath, mapPath] = process.argv.slice(2);
const TOL_TWIPS = 10;
const MIN_LEN = 3;

const truth = JSON.parse(readFileSync(truthPath, "utf-8"));
const fontsMap = JSON.parse(readFileSync(mapPath, "utf-8"));

/** كاش: مسار الخط ← {font, upem} */
const fontCache = new Map();
function getFont(path) {
  if (!fontCache.has(path)) {
    const bytes = readFileSync(path);
    const blob = new Blob(bytes);
    const face = new Face(blob, 0);
    const font = new Font(face);
    fontCache.set(path, { font, upem: face.upem });
  }
  return fontCache.get(path);
}

function shapeAdvanceSum(text, fontPath, emTwips, rtl) {
  const { font, upem } = getFont(fontPath);
  const buf = new HbBuffer();
  buf.addText(text);
  buf.guessSegmentProperties();
  shape(font, buf);
  const pos = buf.getGlyphPositions();
  let units = 0;
  for (const p of pos) units += p.xAdvance;
  return { twips: (units / upem) * emTwips, glyphs: pos.length };
}

const stats = { compared: 0, within: 0, skippedNoFont: 0, skippedOmitted: 0, skippedShort: 0 };
const perFont = new Map();
const worst = [];

for (const page of truth.pages) {
  for (const line of page.lines) {
    for (const run of line.runs) {
      const text = run.text;
      if (!text || text.trim().length < MIN_LEN) { stats.skippedShort++; continue; }
      if (run.advSumTwips == null || run.glyphAdvTwips.some((a) => a == null)) {
        stats.skippedOmitted++; continue;
      }
      const entry = fontsMap[run.font];
      if (!entry || !entry.original) { stats.skippedNoFont++; continue; }

      const ours = shapeAdvanceSum(text, entry.original, run.emTwips, run.bidiLevel % 2 === 1);
      const delta = ours.twips - run.advSumTwips;
      stats.compared++;
      if (Math.abs(delta) <= TOL_TWIPS) stats.within++;
      // فصل التسويغ عن التشكيل: اختلاف عدد الغليفات = غليفات كشيدة/تسويغ
      // أدرجها Word — ليست خلاف تشكيل. نقيس «نقاء التشكيل» على المقاطع
      // متطابقة العدد فقط.
      const glyphEq = ours.glyphs === run.glyphCount;
      if (glyphEq) {
        stats.glyphEq = (stats.glyphEq ?? 0) + 1;
        if (Math.abs(delta) <= TOL_TWIPS) stats.glyphEqWithin = (stats.glyphEqWithin ?? 0) + 1;
      } else {
        stats.glyphDiff = (stats.glyphDiff ?? 0) + 1;
      }

      const f = perFont.get(entry.family) ?? { n: 0, ok: 0, sumAbs: 0, max: 0 };
      f.n++; if (Math.abs(delta) <= TOL_TWIPS) f.ok++;
      f.sumAbs += Math.abs(delta); f.max = Math.max(f.max, Math.abs(delta));
      perFont.set(entry.family, f);

      if (Math.abs(delta) > TOL_TWIPS) {
        worst.push({ family: entry.family, delta: Math.round(delta),
                     word: Math.round(run.advSumTwips), ours: Math.round(ours.twips),
                     glyphsWord: run.glyphCount, glyphsOurs: ours.glyphs,
                     text: text.slice(0, 30) });
      }
    }
  }
}

worst.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
const pct = stats.compared ? ((100 * stats.within) / stats.compared).toFixed(2) : "0";

console.log(`\n=== تقرير تباعد المُشكِّلين ===`);
console.log(`مقاطع مقارنة: ${stats.compared} | ضمن ±${TOL_TWIPS} twips: ${stats.within} (${pct}%)`);
const gPct = stats.glyphEq ? ((100 * (stats.glyphEqWithin ?? 0)) / stats.glyphEq).toFixed(2) : "—";
console.log(`نقاء التشكيل (مقاطع متطابقة عدد الغليفات): ${stats.glyphEq ?? 0} مقطعًا، ضمن العتبة: ${gPct}%`);
console.log(`مقاطع بعدد غليفات مختلف (إشارة تسويغ/كشيدة من Word): ${stats.glyphDiff ?? 0}`);
console.log(`مستبعد: قصير=${stats.skippedShort} تقدمات-محذوفة=${stats.skippedOmitted} بلا-خط-أصلي=${stats.skippedNoFont}`);
console.log(`\nحسب الخط:`);
for (const [fam, f] of [...perFont.entries()].sort((a, b) => b[1].n - a[1].n)) {
  console.log(`  ${fam.padEnd(30)} n=${String(f.n).padStart(4)} ok=${((100 * f.ok) / f.n).toFixed(1).padStart(5)}% meanΔ=${(f.sumAbs / f.n).toFixed(1)} maxΔ=${f.max.toFixed(0)}`);
}
console.log(`\nأسوأ 5 حالات:`);
for (const w of worst.slice(0, 5)) console.log(` `, JSON.stringify(w));

const report = { tolTwips: TOL_TWIPS, stats, pctWithin: Number(pct),
  perFont: Object.fromEntries([...perFont.entries()].map(([k, v]) => [k, { ...v, meanAbs: v.sumAbs / v.n }])),
  worst: worst.slice(0, 50) };
const out = truthPath.replace(/\.truth\.json$/, ".shaping-report.json");
writeFileSync(out, JSON.stringify(report, null, 1));
console.log(`\nالتقرير: ${out}`);
