#!/usr/bin/env node
/** مولّد docx متحكم به — بذرة «مولد الـcorpus»: مستند اختبار بمصفوفة
 *  (خط × line) لعزل فرضيات الترصيف. الاستخدام الأول: حسم فرضية upem=1000
 *  (تكميم مقاييس Word في فضاء وحدات الخط) — ‏Amiri ‏(1000/1.758) مقابل
 *  ‏Traditional Arabic ‏(2048) ضابطًا، على line ∈ {240، 259، 278}. */
import { writeFileSync } from "node:fs";
import { strToU8, zipSync } from "../../node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/browser.js";

const SENT = [
  "إن العناية بترصيف النص العربي على الشبكة تتطلب فهمًا دقيقًا لقواعد التسويغ والكسر التي تحكم المطبوع منذ قرون طويلة.",
  "وقد كان الوراقون يتوارثون أسرار الصناعة جيلًا بعد جيل حتى استقرت قواعد راسخة في تقدير المسافات وضبط الأسطر.",
  "ولما جاءت الحواسيب حملت معها أنظمة ترصيف جديدة تحتاج إلى مطابقة صارمة مع ما استقر عليه أهل الخبرة والمعرفة.",
];
const para = (font, sz, line, k) => `
<w:p><w:pPr><w:bidi/><w:jc w:val="both"/>
<w:spacing w:after="0" w:line="${line}" w:lineRule="auto"/>
<w:rPr><w:rFonts w:cs="${font}"/><w:szCs w:val="${sz}"/></w:rPr></w:pPr>
<w:r><w:rPr><w:rFonts w:cs="${font}" w:hint="cs"/><w:szCs w:val="${sz}"/><w:rtl/></w:rPr>
<w:t>${SENT[k % 3]} ${SENT[(k + 1) % 3]} ${SENT[(k + 2) % 3]}</w:t></w:r></w:p>`;

// نص فريد لكل فقرة (فخ المحاذاة: النص المكرر يلتصق بأول ظهور في الحقيقة)
const ORD = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة",
  "السابعة", "الثامنة", "التاسعة", "العاشرة", "عشرة", "الثانية عشرة",
  "الثالثة عشرة", "الرابعة عشرة", "الخامسة عشرة", "السادسة عشرة",
  "السابعة عشرة", "الثامنة عشرة", "التاسعة عشرة", "العشرون",
  "الحادية والعشرون", "الثانية والعشرون", "الثالثة والعشرون", "الرابعة والعشرون"];
let body = "", idx = 0;
for (const font of ["Amiri", "Traditional Arabic"])
  for (const line of [240, 259, 278])
    for (let k = 0; k < 4; k++, idx++)
      body += para(font, 32, line, k)
        .replace("<w:t>", `<w:t>هذه الفقرة التجريبية ${ORD[idx]} في مصفوفة القياس، `);

const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
<w:bidi/></w:sectPr></w:body></w:document>`;

const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
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

const zip = zipSync({
  "[Content_Types].xml": strToU8(types),
  "_rels/.rels": strToU8(rels),
  "word/document.xml": strToU8(doc),
  "word/settings.xml": strToU8(settings),
  "word/_rels/document.xml.rels": strToU8(docRels),
});
const out = process.argv[2] ?? "corpus/books/sample-vtest.docx";
writeFileSync(out, zip);
console.log("OK:", out);
