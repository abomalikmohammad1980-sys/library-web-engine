#!/usr/bin/env node
/** مولّد اختبار القوائم — عزل لغز a4 ‏(خطوة عناصر القوائم ≈ sz+نصف نقطة):
 *  عناصر قائمة نقطية بشروط masjid حرفيًا (List Paragraph + contextualSpacing
 *  + numbering نقطي بخط Symbol + adwa ‏15pt + docGrid 360) وبينها فقرات
 *  ضابطة عادية — الفارق بين فجوات العنصرين والفقرتين يحسم الآلية.
 *  ‏env: ‏GRID=0 يسقط docGrid (لعزل فرضية الشبكة). */
import { writeFileSync } from "node:fs";
import { strToU8, zipSync } from "../../node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/browser.js";

const ORD = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس",
  "السابع", "الثامن", "التاسع", "العاشر"];
const FILL = "نص تجريبي يضبط سلوك الترصيف الرأسي لعناصر القوائم في هذا القياس المتحكم به تمامًا.";

const rpr = `<w:rPr><w:rFonts w:cs="adwa-assalaf" w:hint="cs"/><w:sz w:val="30"/><w:szCs w:val="30"/><w:rtl/></w:rPr>`;
const pRun = (txt) => `<w:r>${rpr}<w:t>${txt}</w:t></w:r>`;

let body = "";
const plain = (i) => `<w:p><w:pPr><w:bidi/><w:jc w:val="both"/>
<w:rPr><w:rFonts w:cs="adwa-assalaf"/><w:szCs w:val="30"/></w:rPr></w:pPr>
${pRun(`فقرة ضابطة عادية رقمها ${ORD[i]}، ${FILL}`)}</w:p>`;
const item = (i) => `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/>
<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:bidi/><w:jc w:val="both"/>
<w:rPr><w:rFonts w:cs="adwa-assalaf"/><w:szCs w:val="30"/></w:rPr></w:pPr>
${pRun(`عنصر القائمة ${ORD[i]} في مصفوفة العزل، ${FILL}`)}</w:p>`;

for (let i = 0; i < 3; i++) body += plain(i);
for (let i = 0; i < 6; i++) body += item(i);
for (let i = 3; i < 6; i++) body += plain(i);

const grid = process.env.GRID === "0" ? "" : `<w:docGrid w:linePitch="360"/>`;
const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
<w:bidi/>${grid}</w:sectPr></w:body></w:document>`;

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/>
<w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/><w:contextualSpacing/></w:pPr></w:style>
</w:styles>`;

const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>
<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="·"/>
<w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
<w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr></w:lvl>
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

const zip = zipSync({
  "[Content_Types].xml": strToU8(types),
  "_rels/.rels": strToU8(rels),
  "word/document.xml": strToU8(doc),
  "word/settings.xml": strToU8(settings),
  "word/styles.xml": strToU8(styles),
  "word/numbering.xml": strToU8(numbering),
  "word/_rels/document.xml.rels": strToU8(docRels),
});
const out = process.argv[2] ?? "corpus/books/sample-vtest3.docx";
writeFileSync(out, zip);
console.log("OK:", out);
