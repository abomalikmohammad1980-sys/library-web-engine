#!/usr/bin/env node
/** تنصيف الهيكل×النص — vtest13 (نسخ p25) أظهر إجماليات 784.0 نقطة
 *  وvtest15 (هيكلنا) أظهر 783.33 لنفس الطول: الفارق إما هيكل w:p (‏rsid…)
 *  أو النص الحرفي. أربعة أذرع × 8 نسخ:
 *    س-أ: p25 حرفية (هل تتكرر 1884؟)
 *    س-ب: p25 منزوعة سمات rsid
 *    س-ج: نص p25 داخل هيكلنا النظيف
 *    س-د: نصنا القياسي داخل هيكل p25 */
import { readFileSync, writeFileSync } from "node:fs";
import { strToU8, strFromU8, zipSync, unzipSync } from "../../node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/browser.js";

const zip = unzipSync(readFileSync("corpus/books/sample-vtest10.docx"));
const doc = strFromU8(zip["word/document.xml"]);
const p25 = (doc.match(/<w:p[ >][\s\S]*?<\/w:p>/g))[25];
const p25text = p25.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/)[1];

const F = "Al-Jazeera-Arabic-Regular";
const RPR = `<w:rPr><w:rFonts w:ascii="${F}" w:hAnsi="${F}" w:cs="${F}"/><w:sz w:val="32"/><w:szCs w:val="32"/><w:rtl/></w:rPr>`;
const RUN_RPR = `<w:rPr><w:rFonts w:ascii="${F}" w:hAnsi="${F}" w:cs="${F}" w:hint="cs"/><w:sz w:val="32"/><w:szCs w:val="32"/><w:rtl/></w:rPr>`;
const OURTEXT = "إن العناية بترصيف النص العربي على الشبكة تتطلب فهمًا دقيقًا لقواعد " +
  "التسويغ والكسر التي تحكم المطبوع منذ قرون طويلة وتستدعي مطابقة صارمة مع المرجع " +
  "الموثق في كل تفاصيله الدقيقة الكاملة.";
const ourPara = (t) => `<w:p><w:pPr>${RPR}</w:pPr><w:r>${RUN_RPR}<w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
const noRsid = p25.replace(/\sw:rsid[A-Za-z]*="[^"]*"/g, "");

const arms = {
  "سين-ألف": (t) => p25.replace(/(<w:t[^>]*>)[\s\S]*?(<\/w:t>)/, `$1${t}${p25text}$2`),
  "سين-باء": (t) => noRsid.replace(/(<w:t[^>]*>)[\s\S]*?(<\/w:t>)/, `$1${t}${p25text}$2`),
  "سين-جيم": (t) => ourPara(t + p25text),
  "سين-دال": (t) => p25.replace(/(<w:t[^>]*>)[\s\S]*?(<\/w:t>)/, `$1${t}${OURTEXT}$2`),
};

const ORD = ["الأولى","الثانية","الثالثة","الرابعة","الخامسة","السادسة","السابعة","الثامنة"];
let body = "";
for (const [tag, mk] of Object.entries(arms))
  for (let k = 0; k < 8; k++)
    body += mk(`ذراع ${tag} النسخة ${ORD[k]} من تنصيف الهيكل، `);

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

writeFileSync("corpus/books/sample-vtest16.docx", zipSync({
  "[Content_Types].xml": strToU8(types),
  "_rels/.rels": strToU8(rels),
  "word/document.xml": strToU8(out),
  "word/settings.xml": strToU8(settings),
  "word/_rels/document.xml.rels": strToU8(docRels),
}));
console.log("OK: sample-vtest16.docx — 4 أذرع × 8 نسخ");
