#!/usr/bin/env node
/** مصفوفة حسم pPr — الفقرة p25 (ناقلة العلة المؤكدة: ‏run واحد، بلا تشكيل يذكر)
 *  تُستنسخ في 4 متغيرات لعزل سبب فرق 262/261 نقطة بين الكتاب ومولدنا:
 *    A: حرفية (ضابط — متوقع 628/262)
 *    B: + w:spacing after=0 line=240 lineRule=auto
 *    C: + w:bidi
 *    D: + كلاهما (تكوين مولدنا — متوقع 626/261 إن كان أحدهما العلة)
 *  كل متغير 6 نسخ ببادئة ترتيبية فريدة (فخ النص المكرر). */
import { readFileSync, writeFileSync } from "node:fs";
import { strToU8, strFromU8, zipSync, unzipSync } from "../../node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/browser.js";

const zip = unzipSync(readFileSync("corpus/books/sample-vtest10.docx"));
const doc = strFromU8(zip["word/document.xml"]);
const p25 = (doc.match(/<w:p[ >][\s\S]*?<\/w:p>/g))[25];

const ORD = ["الأولى","الثانية","الثالثة","الرابعة","الخامسة","السادسة",
  "السابعة","الثامنة","التاسعة","العاشرة","عشرة","الثانية عشرة",
  "الثالثة عشرة","الرابعة عشرة","الخامسة عشرة","السادسة عشرة",
  "السابعة عشرة","الثامنة عشرة","التاسعة عشرة","العشرون",
  "الحادية والعشرون","الثانية والعشرون","الثالثة والعشرون","الرابعة والعشرون"];

const SPACING = '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>';
const BIDI = "<w:bidi/>";
const variants = { A: "", B: SPACING, C: BIDI, D: BIDI + SPACING };

let body = "", idx = 0;
for (const [tag, inject] of Object.entries(variants))
  for (let k = 0; k < 6; k++, idx++) {
    let p = p25.replace("<w:pPr>", `<w:pPr>${inject}`);
    p = p.replace(/<w:t>/, `<w:t>النسخة ${ORD[idx]} من متغير القياس، `);
    body += p;
  }

const out = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
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

const OUT = process.argv[2] ?? "corpus/books/sample-vtest11.docx";
writeFileSync(OUT, zipSync({
  "[Content_Types].xml": strToU8(types),
  "_rels/.rels": strToU8(rels),
  "word/document.xml": strToU8(out),
  "word/settings.xml": strToU8(settings),
  "word/_rels/document.xml.rels": strToU8(docRels),
}));
console.log("OK:", OUT, "— 4 متغيرات × 6 نسخ");
