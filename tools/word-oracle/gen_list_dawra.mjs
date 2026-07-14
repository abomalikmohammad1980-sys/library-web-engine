#!/usr/bin/env node
/** تجربة حدود قوائم dawra — الحدود المرصودة بين عناصر afc ‏598–600tw
 *  ‏(≈1.5em) مقابل 613 (‏hhea) المتنبأة. مثلثة بحجمين: إن كانت القاعدة
 *  ‏1.5em ظهرت 600/480؛ وإن كانت hhea ظهرت 613/490.
 *  استنساخ شروط dawra: ‏Traditional Arabic، ‏ListParagraph+contextualSpacing،
 *  ترقيم عشري «%1-»، docDefaults **بلا pPrDefault** (كالكتاب). */
import { writeFileSync } from "node:fs";
import { strToU8, zipSync } from "../../node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/browser.js";

const F = "Traditional Arabic";
const FILL = "نص تجريبي طويل يضبط سلوك الترصيف الرأسي لعناصر القوائم المرقمة في هذا القياس المتحكم به تمامًا ويجعل العنصر يلتف على سطرين كاملين على الأقل بإذن الله.";
const ORD = ["الأول","الثاني","الثالث","الرابع","الخامس","السادس","السابع","الثامن"];

const rpr = (sz) => `<w:rPr><w:rFonts w:ascii="${F}" w:hAnsi="${F}" w:cs="${F}" w:hint="cs"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:rtl/></w:rPr>`;
const item = (i, sz) => `<w:p><w:pPr><w:pStyle w:val="afc"/>
<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:bidi/><w:jc w:val="both"/>
<w:rPr><w:rFonts w:cs="${F}"/><w:szCs w:val="${sz}"/></w:rPr></w:pPr>
<w:r>${rpr(sz)}<w:t>عنصر القياس ${ORD[i]} بحجم ${sz}، ${FILL}</w:t></w:r></w:p>`;
const plain = (i, sz) => `<w:p><w:pPr><w:bidi/><w:jc w:val="both"/>
<w:rPr><w:rFonts w:cs="${F}"/><w:szCs w:val="${sz}"/></w:rPr></w:pPr>
<w:r>${rpr(sz)}<w:t>فقرة ضابطة عادية ${ORD[i]} بحجم ${sz}، ${FILL}</w:t></w:r></w:p>`;

let body = "";
for (const sz of [40, 32]) {
  for (let i = 0; i < 2; i++) body += plain(i, sz);
  for (let i = 0; i < 5; i++) body += item(i, sz);
  for (let i = 2; i < 4; i++) body += plain(i, sz);
}

const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
<w:bidi/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>`;

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="a"><w:name w:val="Normal"/><w:pPr><w:bidi/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="afc"><w:name w:val="List Paragraph"/>
<w:basedOn w:val="a"/><w:pPr><w:ind w:left="720"/><w:contextualSpacing/></w:pPr></w:style>
</w:styles>`;

const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>
<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1-"/>
<w:lvlJc w:val="left"/><w:pPr><w:ind w:left="1174" w:hanging="720"/></w:pPr>
<w:rPr><w:rFonts w:hint="default"/></w:rPr></w:lvl>
</w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;

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
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`;
const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`;

writeFileSync("corpus/books/sample-vtest18.docx", zipSync({
  "[Content_Types].xml": strToU8(types),
  "_rels/.rels": strToU8(rels),
  "word/document.xml": strToU8(doc),
  "word/settings.xml": strToU8(settings),
  "word/styles.xml": strToU8(styles),
  "word/numbering.xml": strToU8(numbering),
  "word/_rels/document.xml.rels": strToU8(docRels),
}));
console.log("OK: sample-vtest18.docx — قوائم dawra بحجمين 40/32");
