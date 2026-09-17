#!/usr/bin/env node
/** مُشغّل المصفوفة الكاملة — يطبّق الخريطة القانونية (book-fonts-map.json)
 *  على المُحكّمين الأفقي والرأسي لكل كتاب، ويطبع جدول الدقة الموحّد.
 *  الاستخدام: node tools/word-oracle/run_all.mjs [horiz|vert|both] */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const MAP = JSON.parse(readFileSync("tools/word-oracle/book-fonts-map.json", "utf-8"));
const WHICH = ["horiz", "vert", "both"].includes(process.argv[2]) ? process.argv[2] : "both";
const CHECK = process.argv.includes("--check");
const BASELINES = CHECK
  ? JSON.parse(readFileSync("tools/word-oracle/oracle-baselines.json", "utf-8")) : {};
// المحكمان v1 مخصصان للكتب الكاملة ذات خط أفقي وsubset رأسي وحقيقة XPS؛
// عينات gap لها محكمات مستقلة ولا يجوز إظهار 0% كأنه فشل في محكم غير مناسب.
const books = Object.entries(MAP)
  .filter(([book, cfg]) => !book.startsWith("_") && cfg.vertSubset
    && existsSync(`corpus/books/${book}.docx`)
    && existsSync(`corpus/ground-truth/${book}.truth.json`)
    && existsSync(cfg.horizFont) && existsSync(cfg.vertSubset))
  .map(([book]) => book);

const runOracle = (script, book, family, font) => {
  const env = { ...process.env, BOOK: book, FAMILY: family, FONT_FILE: font };
  const result = spawnSync("node", [`tools/word-oracle/${script}`], { env, encoding: "utf-8" });
  const out = (result.stdout ?? "") + (result.stderr ?? "");
  if (result.status !== 0) throw new Error(`${book}/${script} فشل:\n${out}`);
  return out;
};

const pctOf = (out, re) => { const m = out.match(re); return m ? Number(m[1]) : null; };
const show = (value) => value == null ? "—" : value.toFixed(2);
const failures = [];

console.log("الكتاب".padEnd(18), "أفقي".padEnd(8), "رأسي-داخلي".padEnd(12), "حدود".padEnd(8), "صفحة-كاملة");
for (const book of books) {
  const cfg = MAP[book];
  let h = null, vi = null, vb = null, vf = null;
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
  console.log(book.padEnd(18), (show(h) + "%").padEnd(8), (show(vi) + "%").padEnd(12), (show(vb) + "%").padEnd(8), show(vf) + "%");
  if (CHECK) {
    const actual = { horizontal: h, verticalInternal: vi, paragraphBounds: vb, fullPage: vf };
    const minimum = BASELINES[book];
    if (!minimum) failures.push(`${book}: لا خط أساس`);
    else for (const [metric, floor] of Object.entries(minimum)) {
      if (actual[metric] == null) failures.push(`${book}/${metric}: القياس مفقود`);
      else if (actual[metric] + 1e-9 < floor)
        failures.push(`${book}/${metric}: ${actual[metric].toFixed(2)}% < ${floor.toFixed(2)}%`);
    }
  }
}

if (CHECK) {
  if (failures.length) {
    console.error("\nفشل محكّم Word:\n- " + failures.join("\n- "));
    process.exitCode = 1;
  } else console.log("\n✓ لم تتراجع مقاييس Word عن الحدود المرجعية المودعة.");
}
