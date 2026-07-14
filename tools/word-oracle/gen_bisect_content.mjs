#!/usr/bin/env node
/** مصفوفة عزل المحتوى — حسم حامل الـ+1 نقطة (262 مقابل 261) بعد أن برَّأت
 *  vtest11 سماتِ pPr وبرَّأ فك «خليط التقريب» نسخَ p25 الصافية:
 *    A: p25 صافية (ضابط سالب — متوقع 261: خليط 626/628)
 *    B: p25 مُشكَّلة بالكامل (فتحة بعد كل حرف)
 *    C: p25 + زوج أقواس قرآنية ﴿…﴾ بـTimes New Roman
 *    D: p03 حرفية (ضابط موجب — باعثة 630 المؤكدة، متوقع 262: خليط 628/630)
 *    E: p03 منزوعة التشكيل (بنية الـruns كما هي)
 *    F: p03 منزوعة أقواس TNR فقط (التشكيل باقٍ)
 *    G: p25 مُقطَّعة إلى runs كثيرة (كل ~12 حرفًا run بنفس rPr)
 *  5 نسخ لكل متغير ببادئة فريدة (فخ النص المكرر)، هيكل vtest8 بلا styles.xml. */
import { readFileSync, writeFileSync } from "node:fs";
import { strToU8, strFromU8, zipSync, unzipSync } from "../../node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/browser.js";

const zip = unzipSync(readFileSync("corpus/books/sample-vtest10.docx"));
const doc = strFromU8(zip["word/document.xml"]);
const paras = doc.match(/<w:p[ >][\s\S]*?<\/w:p>/g);
const p25 = paras[25], p03 = paras[3];

const MARKS = /[ً-ْٰ]/g;
const vocalize = (s) => s.replace(/([ب-ي])(?![ً-ْ])/g, "$1َ");
const stripMarks = (p) => p.replace(/(<w:t[^>]*>)([\s\S]*?)(<\/w:t>)/g,
  (_, a, t, b) => a + t.replace(MARKS, "") + b);
const dropTnrRuns = (p) => p.replace(/<w:r(?:[ >])(?:(?!<\/w:r>)[\s\S])*?<\/w:r>/g,
  (r) => /Times New Roman/.test(r) ? "" : r);

const p25text = (p25.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/) ?? [])[1];
const p25run = p25.match(/<w:r>[\s\S]*?<\/w:r>/)[0];
const RPR = p25run.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)[0];
const mkRun = (t, rpr = RPR) => `<w:r>${rpr}<w:t xml:space="preserve">${t}</w:t></w:r>`;
const TNR_RPR = RPR.replace(/Al-Jazeera-Arabic-Regular/g, "Times New Roman");

const withText = (t) => p25.replace(/<w:r>[\s\S]*<\/w:r>/, mkRun(t));
// C: النص الأوسط بين قوسين قرآنيين بـruns منفصلة كما في الكتاب حرفيًا
const third = Math.floor(p25text.length / 3);
const cBody = mkRun(p25text.slice(0, third)) + mkRun("﴿", TNR_RPR) +
  mkRun(p25text.slice(third, 2 * third)) + mkRun("﴾", TNR_RPR) +
  mkRun(p25text.slice(2 * third));
const cPara = p25.replace(/<w:r>[\s\S]*<\/w:r>/, cBody);
// G: تقطيع النص الصافي إلى runs كل 12 حرفًا
const chunks = p25text.match(/[\s\S]{1,12}/g);
const gPara = p25.replace(/<w:r>[\s\S]*<\/w:r>/, chunks.map((c) => mkRun(c)).join(""));

const variants = {
  A: p25,
  B: withText(vocalize(p25text)),
  C: cPara,
  D: p03,
  E: stripMarks(p03),
  F: dropTnrRuns(p03),
  G: gPara,
};

const NAME = { A: "ألف", B: "باء", C: "جيم", D: "دال", E: "هاء", F: "واو", G: "زاي" };
const ORD = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة"];
let body = "";
for (const [v, p] of Object.entries(variants))
  for (let k = 0; k < 5; k++)
    body += p.replace(/(<w:t[^>]*>)/, `$1متغير ${NAME[v]} النسخة ${ORD[k]} من القياس، `);

const out = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
<w:bidi/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>`;

// OTF=1: حقن enableOpenTypeFeatures كما في settings الكتاب (المشتبه البيئي)
const OTF = process.env.OTF ? `<w:compatSetting w:name="enableOpenTypeFeatures"
 w:uri="http://schemas.microsoft.com/office/word" w:val="1"/>` : "";
const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:compat><w:compatSetting w:name="compatibilityMode"
 w:uri="http://schemas.microsoft.com/office/word" w:val="15"/>${OTF}</w:compat></w:settings>`;
const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>`;
const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>`;

const OUT = process.argv[2] ?? "corpus/books/sample-vtest13.docx";
writeFileSync(OUT, zipSync({
  "[Content_Types].xml": strToU8(types),
  "_rels/.rels": strToU8(rels),
  "word/document.xml": strToU8(out),
  "word/settings.xml": strToU8(settings),
  "word/_rels/document.xml.rels": strToU8(docRels),
}));
console.log("OK:", OUT, "— 7 متغيرات × 5 نسخ");
