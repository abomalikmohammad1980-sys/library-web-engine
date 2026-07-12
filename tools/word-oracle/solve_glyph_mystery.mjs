#!/usr/bin/env node
/** حسم لغز الغليف الواحد: مقارنة تسلسل GIDs بين حقيقة Word وتشكيل HarfBuzz.
 *  فرضيات تحت الاختبار: (أ) كشيدة تسويغ (GID التطويل)؛ (ب) غليف زائد آخر يحدد بالفحص.
 *  ملاحظة: subsets XPS تحافظ على أرقام GID الأصلية — نتحقق ضمنيًا: أي تطابق واسع يثبتها. */
import { readFileSync, writeFileSync } from "node:fs";
import { Blob, Buffer as HbBuffer, Face, Font, shape } from "harfbuzzjs";

const truth = JSON.parse(readFileSync("corpus/ground-truth/sample-masjid.truth.json", "utf-8"));
const fmap = JSON.parse(readFileSync("corpus/ground-truth/fonts/sample-masjid/fonts-map.json", "utf-8"));
const adwaFiles = new Set(Object.keys(fmap).filter((k) => fmap[k].family === "adwa-assalaf"));
const ORIG = "corpus/book-fonts/adwa-assalaf.ttf";
const TAT_GID = 229;

const bytes = readFileSync(ORIG);
const face = new Face(new Blob(bytes), 0);
const font = new Font(face);
const upem = face.upem;

function shapeRun(text) {
  const buf = new HbBuffer();
  buf.addText(text);
  buf.guessSegmentProperties();
  shape(font, buf);
  const infos = buf.getGlyphInfos();
  const pos = buf.getGlyphPositions();
  return infos.map((g, i) => ({ gid: g.codepoint, adv: pos[i].xAdvance }));
}

const stats = { runs: 0, exactMatch: 0, kashidaExplained: 0, unexplained: 0 };
const mysteries = new Map(); // gid ← تكرار الغليفات الزائدة غير المفسرة

for (const pg of truth.pages) for (const ln of pg.lines) for (const r of ln.runs) {
  if (!adwaFiles.has(r.font) || !r.glyphIds?.length) continue;
  if (r.text.trim().length < 3) continue;
  const wordGids = r.glyphIds.filter((g) => g != null);
  const ours = shapeRun(r.text);
  const oursGids = ours.map((o) => o.gid);
  stats.runs++;

  // إزالة التطويلات من تسلسل Word ثم مقارنة كمجموعات مرتبة (الترتيب بصري↔منطقي قد يعكس)
  const wordNoTat = wordGids.filter((g) => g !== TAT_GID);
  const sortEq = (a, b) => a.length === b.length && [...a].sort((x,y)=>x-y).join() === [...b].sort((x,y)=>x-y).join();

  if (sortEq(wordGids, oursGids)) { stats.exactMatch++; continue; }
  if (sortEq(wordNoTat, oursGids)) { stats.kashidaExplained++; continue; }

  stats.unexplained++;
  // ما الغليفات الزائدة لدى Word بعد خصم التطويل ومقارنة multiset؟
  const oursCount = new Map();
  for (const g of oursGids) oursCount.set(g, (oursCount.get(g) ?? 0) + 1);
  for (const g of wordNoTat) {
    const c = oursCount.get(g) ?? 0;
    if (c > 0) oursCount.set(g, c - 1);
    else mysteries.set(g, (mysteries.get(g) ?? 0) + 1);
  }
}

console.log(JSON.stringify(stats));
const top = [...mysteries.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);
console.log("الغليفات الزائدة غير المفسرة (GID←تكرار):", JSON.stringify(top));
writeFileSync("corpus/ground-truth/_mystery.json", JSON.stringify({ stats, top }, null, 1));
