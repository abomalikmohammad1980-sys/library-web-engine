#!/usr/bin/env node
/** مصفوفة علامة الفقرة ¶ — حسم آلية «+1 نقطة في الخطوة إلى آخر سطر الفقرة»
 *  (اكتشاف vtest13 الموضعي: أول/أوسط=النموذج، أخير=+1 نقطة):
 *    M0: علامة كتابية (ascii=Jazeera sz=32) بلا spacing — استنساخ الظاهرة
 *    M1: pPr بلا rPr إطلاقًا (علامة افتراضية صغيرة) — هل تختفي؟
 *    M2: علامة عملاقة sz=72 — إن شاركت العلامة قفز آخر سطر جسيمًا؛
 *        وإن كان قانون تقريب بقي +1 نقطة
 *    M3: كالكتابية + spacing مباشر line=278 — هل المسار المباشر يلغيها؟
 *  أطوال متدرجة (2–6 أسطر) لرصد الموضع بدقة. */
import { writeFileSync } from "node:fs";
import { strToU8, zipSync } from "../../node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/browser.js";

const F = "Al-Jazeera-Arabic-Regular";
const RPR = (sz) => `<w:rPr><w:rFonts w:ascii="${F}" w:hAnsi="${F}" w:cs="${F}"/>` +
  `<w:sz w:val="${sz}"/><w:szCs w:val="32"/><w:rtl/></w:rPr>`;
const RUN_RPR = `<w:rPr><w:rFonts w:ascii="${F}" w:hAnsi="${F}" w:cs="${F}" w:hint="cs"/>` +
  `<w:sz w:val="32"/><w:szCs w:val="32"/><w:rtl/></w:rPr>`;

const BASE = "إن العناية بترصيف النص العربي على الشبكة تتطلب فهمًا دقيقًا لقواعد " +
  "التسويغ والكسر التي تحكم المطبوع منذ قرون طويلة وتستدعي مطابقة صارمة مع المرجع. ";
const SPACING = '<w:spacing w:after="0" w:line="278" w:lineRule="auto"/>';

const ORD = ["الأولى","الثانية","الثالثة","الرابعة","الخامسة","السادسة","السابعة",
  "الثامنة","التاسعة","العاشرة","عشرة","الثانية عشرة","الثالثة عشرة","الرابعة عشرة",
  "الخامسة عشرة","السادسة عشرة","السابعة عشرة","الثامنة عشرة","التاسعة عشرة",
  "العشرون","الحادية والعشرون","الثانية والعشرون","الثالثة والعشرون","الرابعة والعشرون",
  "الخامسة والعشرون","السادسة والعشرون","السابعة والعشرون","الثامنة والعشرون"];

const variants = [
  { tag: "ميم-صفر", ppr: `<w:pPr>${RPR(32)}</w:pPr>`, reps: [1,2,3,4,5] },
  { tag: "ميم-واحد", ppr: `<w:pPr></w:pPr>`, reps: [1,2,3,4,5] },
  { tag: "ميم-اثنان", ppr: `<w:pPr>${RPR(72)}</w:pPr>`, reps: [1,2,3,4,5] },
  { tag: "ميم-ثلاثة", ppr: `<w:pPr>${SPACING}${RPR(32)}</w:pPr>`, reps: [1,2,3,4,5] },
];

let body = "", idx = 0;
for (const v of variants)
  for (const rep of v.reps) {
    const text = `متغير ${v.tag} النسخة ${ORD[idx % ORD.length]} من مصفوفة العلامة، ` +
      BASE.repeat(rep);
    body += `<w:p>${v.ppr}<w:r>${RUN_RPR}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
    idx++;
  }

const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
<w:bidi/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>`;

const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:compat><w:compatSetting w:name="compatibilityMode"
 w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;
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

const OUT = process.argv[2] ?? "corpus/books/sample-vtest15.docx";
writeFileSync(OUT, zipSync({
  "[Content_Types].xml": strToU8(types),
  "_rels/.rels": strToU8(rels),
  "word/document.xml": strToU8(doc),
  "word/settings.xml": strToU8(settings),
  "word/_rels/document.xml.rels": strToU8(docRels),
}));
console.log("OK:", OUT, "— 4 متغيرات علامة × 5 أطوال");
