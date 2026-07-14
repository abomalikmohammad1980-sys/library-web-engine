#!/usr/bin/env node
/** مُعايِر pitch لكل خط — مستندٌ متحكّمٌ به (منفصلٌ عن كتب التحقق) بفقرةٍ
 *  واحدةٍ طويلة (‏40+ سطرًا) بخطٍّ واحد، لقياس pitch Word الفعلي من الانجراف
 *  المتراكم بدقّة (مشروعٌ منهجيًا: معايرةٌ على بياناتٍ مولّدة، تحقّقٌ على الكتب).
 *  البيئة: ‏FAM (عائلة rFonts)، ‏SZ (نصف نقطة، افتراضي 30)، ‏LINE (افتراضي 259). */
import { writeFileSync } from "node:fs";
import { strToU8, zipSync } from "../../node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/browser.js";

const FAM = process.env.FAM ?? "adwa-assalaf";
const SZ = process.env.SZ ?? "30";
const LINE = process.env.LINE ?? "259";
// نصٌّ عربيٌّ طويلٌ متصلٌ يلتفّ لأربعين سطرًا فأكثر (فقرة واحدة، لا حدود)
const SENT = "إن العناية بترصيف النص العربي على الشبكة العنكبوتية تتطلب فهمًا دقيقًا " +
  "لقواعد التسويغ والكسر والتباعد التي تحكم المطبوع منذ قرون طويلة، وقد توارث " +
  "الوراقون أسرار هذه الصناعة جيلًا بعد جيل حتى استقرت قواعد راسخة في تقدير " +
  "المسافات وضبط الأسطر وموازنة البياض والسواد على الصفحة الواحدة، ولما جاءت " +
  "الحواسيب حملت معها أنظمة ترصيف جديدة تحتاج إلى مطابقة صارمة مع ما استقر عليه " +
  "أهل الخبرة والمعرفة في هذا الفن العريق الذي يجمع بين الدقة الهندسية والذوق الجمالي. ";
const RPR = `<w:rPr><w:rFonts w:ascii="${FAM}" w:hAnsi="${FAM}" w:cs="${FAM}" w:hint="cs"/><w:sz w:val="${SZ}"/><w:szCs w:val="${SZ}"/><w:rtl/></w:rPr>`;
const body = `<w:p><w:pPr><w:bidi/><w:jc w:val="both"/>` +
  `<w:spacing w:after="0" w:line="${LINE}" w:lineRule="auto"/></w:pPr>` +
  `<w:r>${RPR}<w:t xml:space="preserve">${SENT.repeat(8)}</w:t></w:r></w:p>`;

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

const OUT = process.argv[2] ?? `corpus/books/sample-cal-${FAM}.docx`;
writeFileSync(OUT, zipSync({
  "[Content_Types].xml": strToU8(types),
  "_rels/.rels": strToU8(rels),
  "word/document.xml": strToU8(doc),
  "word/settings.xml": strToU8(settings),
  "word/_rels/document.xml.rels": strToU8(docRels),
}));
console.log("OK:", OUT, "— فقرة واحدة", FAM, "sz=" + SZ, "line=" + LINE);
