import { writeFileSync } from "node:fs";
import { strToU8, zipSync } from "../../node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/browser.js";
const FAM=process.env.FAM, SZ=process.env.SZ, LINE=process.env.LINE, AFTER=process.env.AFTER, GRID=process.env.GRID??"360";
const S="النص العربي المتصل لقياس التباعد بين الفقرات على الشبكة يحتاج فهما دقيقا لقواعد الترصيف. ";
const RPR=`<w:rPr><w:rFonts w:ascii="${FAM}" w:hAnsi="${FAM}" w:cs="${FAM}" w:hint="cs"/><w:sz w:val="${SZ}"/><w:szCs w:val="${SZ}"/><w:rtl/></w:rPr>`;
const P=(t)=>`<w:p><w:pPr><w:bidi/><w:jc w:val="both"/><w:spacing w:after="${AFTER}" w:line="${LINE}" w:lineRule="auto"/></w:pPr><w:r>${RPR}<w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
const body=P(S.repeat(3))+P(S.repeat(3))+P(S.repeat(3));
const doc=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/><w:bidi/><w:docGrid w:linePitch="${GRID}"/></w:sectPr></w:body></w:document>`;
const settings=`<?xml version="1.0"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;
writeFileSync(process.argv[2],zipSync({
 "[Content_Types].xml":strToU8(`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>`),
 "_rels/.rels":strToU8(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`),
 "word/document.xml":strToU8(doc),
 "word/settings.xml":strToU8(settings),
 "word/_rels/document.xml.rels":strToU8(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>`),
}));
console.log("OK",process.argv[2]);
