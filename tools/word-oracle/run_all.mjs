#!/usr/bin/env node
/** مُشغّل المصفوفة الكاملة — يطبّق الخريطة القانونية (book-fonts-map.json)
 *  على المُحكّمين الأفقي والرأسي لكل كتاب، ويطبع جدول الدقة الموحّد.
 *  الاستخدام: node tools/word-oracle/run_all.mjs [horiz|vert|both] */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const MAP = JSON.parse(readFileSync("tools/word-oracle/book-fonts-map.json", "utf-8"));
const WHICH = process.argv[2] ?? "both";
const books = Object.keys(MAP).filter((k) => !k.startsWith("_"));

const runOracle = (script, book, family, font) => {
  const env = { ...process.env, BOOK: book, FAMILY: family, FONT_FILE: font };
  try {
    return execFileSync("node", [`tools/word-oracle/${script}`], { env, encoding: "utf-8" });
  } catch (e) { return (e.stdout ?? "") + (e.stderr ?? ""); }
};

const pctOf = (out, re) => { const m = out.match(re); return m ? m[1] : "—"; };

console.log("الكتاب".padEnd(18), "أفقي".padEnd(8), "رأسي-داخلي".padEnd(12), "حدود".padEnd(8), "صفحة-كاملة");
for (const book of books) {
  const cfg = MAP[book];
  let h = "—", vi = "—", vb = "—", vf = "—";
  if (WHICH !== "vert") {
    const o = runOracle("break_lines_v1.mjs", book, cfg.family, cfg.horizFont);
    h = pctOf(o, /= ([0-9.]+)%/);
  }
  if (WHICH !== "horiz") {
    const o = runOracle("vertical_v1.mjs", book, cfg.family, cfg.vertSubset);
    vi = pctOf(o, /الرقم الشمالي الرأسي[^=]*= ([0-9.]+)%/);
    vb = pctOf(o, /حدود الفقرات: \d+\/\d+ = ([0-9.]+)%/);
    vf = pctOf(o, /الصفحة الكاملة: \d+\/\d+ baselines = ([0-9.]+)%/);
  }
  console.log(book.padEnd(18), (h + "%").padEnd(8), (vi + "%").padEnd(12), (vb + "%").padEnd(8), vf + "%");
}
