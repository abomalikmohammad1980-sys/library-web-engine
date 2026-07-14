#!/usr/bin/env node
/** معايرة بداية الصفحة **تلقائيًا** لأي خط (تعميم ق8-د): بدل القياس اليدوي، يولّد
 *  مستندًا متحكّمًا به مفرد الخط لكل (عائلة، em، صنف تباعد) ناقصٍ من
 *  pagestart-cal.json، يُصدّره عبر Word COM، يستخرجه، ويسجّل الصعود فوق الهامش.
 *  يجعل المحرّك generic: كتابٌ/خطٌّ جديد يُعاير آليًّا (بشرط أن يكون الخط مثبَّتًا).
 *
 *  الاستخدام:
 *    node calibrate_pagestart.mjs            # يعاير كل نواقص الكوربوس
 *    node calibrate_pagestart.mjs --family "Traditional Arabic" --em 320 --m both
 *
 *  المتطلّبات (ويندوز، البيئة المرجعية): الخط مثبَّتٌ في النظام، Word، python.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const CAL_PATH = "tools/word-oracle/pagestart-cal.json";
const cal = existsSync(CAL_PATH) ? JSON.parse(readFileSync(CAL_PATH, "utf-8")) : { _doc: "" };

// صنف التباعد → قيمة w:line (m1=مفرد 240، mN=متعدّد 276 كمثال >1)
const LINE_OF = { m1: "240", mN: "276" };

/** يعاير مدخلًا واحدًا: يرجع الصعود فوق الهامش (twips) أو null عند الفشل. */
function calibrateOne(family, q10em, mclass) {
  const sz = String(Math.round(q10em / 10));          // نصف-نقاط = em/10
  const line = LINE_OF[mclass];
  const tag = `cal-${family.replace(/[^A-Za-z0-9]/g, "")}-${q10em}-${mclass}`;
  const docx = `corpus/books/${tag}.docx`;
  const xps = `corpus/ground-truth/${tag}.xps`;
  const truthJson = `corpus/ground-truth/${tag}.truth.json`;
  try {
    // 1) توليد المستند المتحكّم به
    execFileSync("node", ["tools/word-oracle/gen_pitch_cal.mjs", docx],
      { env: { ...process.env, FAM: family, SZ: sz, LINE: line }, stdio: "pipe" });
    // 2) تصدير XPS عبر Word COM
    execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass",
      "-File", "tools/word-oracle/export_xps.ps1", "-InputDocx", docx, "-OutXps", xps], { stdio: "pipe" });
    // 3) استخراج الحقيقة
    execFileSync("python", ["tools/word-oracle/extract_truth.py", xps, "--pages", "1"], { stdio: "pipe" });
    // 4) قراءة صعود أول سطر فوق الهامش (marTop=1440 في مستند المعايرة)
    const t = JSON.parse(readFileSync(truthJson, "utf-8"));
    const ln = t.pages?.[0]?.lines?.[0];
    if (!ln) return null;
    const asc = (ln.baselineTwipsF ?? ln.baselineTwips) - 1440;
    return Math.round(asc * 100) / 100;
  } catch (e) {
    console.error(`  فشل معايرة ${family}/${q10em}/${mclass}:`, (e.message || "").slice(0, 120));
    return null;
  } finally {
    for (const f of [docx, xps, truthJson]) try { execFileSync("rm", ["-f", f], { stdio: "pipe" }); } catch { /**/ }
  }
}

/** يستنبط احتياجات الكوربوس (عائلة، em المكمَّم، صنف) من الكتب. */
function corpusNeeds() {
  const map = JSON.parse(readFileSync("tools/word-oracle/book-fonts-map.json", "utf-8"));
  const needs = [];
  for (const book of Object.keys(map).filter((k) => !k.startsWith("_"))) {
    const cfg = map[book];
    try {
      const truth = JSON.parse(readFileSync(`corpus/ground-truth/${book}.truth.json`, "utf-8"));
      // ‏em المتن الغالب فقط (المنوال): بداياتُ الصفحات هي أسطرُ المتن، لا العناوين
      // (أحجامٌ متنوّعة تحتاج النموذج لا المعايرة — معايرتها تُنكِس الكتب ذات
      // العناوين غير المنتظمة كـtadris). نطاق معقول 240–520tw (12–26pt).
      const freq = new Map();
      for (const pg of truth.pages) for (const l of pg.lines) for (const r of l.runs)
        if (r.text.trim()) { const e = Math.round((r.emTwips ?? 0) / 10) * 10;
          if (e >= 240 && e <= 520) freq.set(e, (freq.get(e) ?? 0) + 1); }
      const dominant = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (dominant) for (const mc of ["mN", "m1"]) // صنفا التباعد (متعدّد/مفرد)
        needs.push({ family: cfg.family, em: dominant, mclass: mc });
    } catch { /* لا حقيقة */ }
  }
  // إزالة التكرار
  const seen = new Set(); return needs.filter((n) => {
    const k = `${n.family}|${n.em}|${n.mclass}`; if (seen.has(k)) return false; seen.add(k); return true;
  });
}

// ---- التشغيل
const args = process.argv.slice(2);
let targets;
if (args.includes("--family")) {
  const fam = args[args.indexOf("--family") + 1];
  const em = Math.round(Number(args[args.indexOf("--em") + 1]) / 10) * 10;
  const mc = args.includes("--m") ? (args[args.indexOf("--m") + 1] === "single" ? "m1" : "mN") : "mN";
  targets = [{ family: fam, em, mclass: mc }];
} else {
  targets = corpusNeeds();
}

let added = 0;
for (const { family, em, mclass } of targets) {
  cal[family] ??= {};
  cal[family][String(em)] ??= {};
  if (cal[family][String(em)][mclass] != null) { continue; } // موجودٌ سلفًا — تخطَّ
  process.stdout.write(`معايرة ${family} em=${em} ${mclass} ... `);
  const asc = calibrateOne(family, em, mclass);
  if (asc != null) {
    cal[family][String(em)][mclass] = asc; added++; console.log(`✓ ${asc}tw`);
    writeFileSync(CAL_PATH, JSON.stringify(cal, null, 2) + "\n", "utf-8"); // كتابةٌ تدريجية (متينة ضد التعطّل)
  } else console.log("✗");
}
console.log(`\nتمّ: أُضيف ${added} مدخلًا. المجموع في pagestart-cal.json.`);
