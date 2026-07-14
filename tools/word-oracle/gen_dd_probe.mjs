#!/usr/bin/env node
/** مسبار docDefaults — حسم آلية القاعدة 9: هل السقف خاص بالقيمة 278
 *  (≡الافتراضي المدمج) أم عام لكل docDefaults؟
 *  مستند واحد لكل قيمة LINE (لا يمكن تعدد docDefaults في مستند):
 *  ‏styles.xml أدنى بـpPrDefault spacing after=160 line=$LINE، والفقرات
 *  بلا أي spacing مباشر (كأسلوب الكتب). القيم المختارة كسورها منخفضة
 *  فالسقف مرئي: ‏240→بونص 1.6tw، ‏259→2.0، ‏277→2.2، ‏278→2.4.
 *  الاستخدام: LINE=259 node gen_dd_probe.mjs corpus/books/sample-vtest17-259.docx */
import { writeFileSync } from "node:fs";
import { strToU8, zipSync } from "../../node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/browser.js";

const LINE = process.env.LINE ?? "278";
const F = process.env.FONT ?? "Al-Jazeera-Arabic-Regular";
const RPR = `<w:rPr><w:rFonts w:ascii="${F}" w:hAnsi="${F}" w:cs="${F}"/><w:sz w:val="32"/><w:szCs w:val="32"/><w:rtl/></w:rPr>`;
const RUN_RPR = `<w:rPr><w:rFonts w:ascii="${F}" w:hAnsi="${F}" w:cs="${F}" w:hint="cs"/><w:sz w:val="32"/><w:szCs w:val="32"/><w:rtl/></w:rPr>`;
const BASE = "إن العناية بترصيف النص العربي على الشبكة تتطلب فهمًا دقيقًا لقواعد " +
  "التسويغ والكسر التي تحكم المطبوع منذ قرون طويلة وتستدعي مطابقة صارمة مع المرجع. ";
const ORD = ["الأولى","الثانية","الثالثة","الرابعة","الخامسة","السادسة","السابعة","الثامنة",
  "التاسعة","العاشرة","عشرة","الثانية عشرة"];

let body = "";
for (let k = 0; k < 12; k++) {
  const rep = 1 + (k % 3); // أطوال 4/6/8 أسطر تقريبًا — أطوار متنوعة
  const text = `المسبار النسخة ${ORD[k]} من قياس الافتراضيات، ` + BASE.repeat(rep);
  body += `<w:p><w:pPr>${RPR}</w:pPr><w:r>${RUN_RPR}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
<w:bidi/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>`;

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr/></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="${LINE}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="a"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:bidi/></w:pPr></w:style>
</w:styles>`;

const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:compat><w:compatSetting w:name="compatibilityMode"
 w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;
const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;

const OUT = process.argv[2] ?? `corpus/books/sample-vtest17-${LINE}.docx`;
writeFileSync(OUT, zipSync({
  "[Content_Types].xml": strToU8(types),
  "_rels/.rels": strToU8(rels),
  "word/document.xml": strToU8(doc),
  "word/styles.xml": strToU8(styles),
  "word/settings.xml": strToU8(settings),
  "word/_rels/document.xml.rels": strToU8(docRels),
}));
console.log("OK:", OUT, "— docDefaults line=" + LINE);
