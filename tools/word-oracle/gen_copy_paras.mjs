#!/usr/bin/env node
/** ناقل فقرات حرفي — يقتطع فقرات w:p كما هي من كتاب مصدر ويضعها في
 *  الهيكل الأدنى (قالب vtest8) بعد تجريد السمات المُنَمَّسة غير المعلنة
 *  (w14:/w16:/…) التي ترفض Word فتح الهيكل بوجودها.
 *  الغرض: حسم «هل العلة تسافر مع w:p؟» بعينة إحصائية كافية.
 *  البيئة: SRC (docx المصدر)، COUNT (عدد الفقرات، افتراضي 18)،
 *          MINLEN (أدنى طول نص بالحرف، افتراضي 220)، OUT (الناتج). */
import { readFileSync, writeFileSync } from "node:fs";
import { strToU8, strFromU8, zipSync, unzipSync } from "../../node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/browser.js";

const SRC = process.env.SRC ?? "corpus/books/sample-ahadith.docx";
const COUNT = Number(process.env.COUNT ?? 18);
const MINLEN = Number(process.env.MINLEN ?? 220);
const OUT = process.env.OUT ?? process.argv[2] ?? "corpus/books/sample-vtest10.docx";

const zip = unzipSync(readFileSync(SRC));
const docXml = strFromU8(zip["word/document.xml"]);

// اقتطاع الفقرات (لا تداخل w:p في متن بلا جداول/AlternateContent — مؤكد للمصدر)
const paras = docXml.match(/<w:p [\s\S]*?<\/w:p>/g) ?? [];
const textOf = (p) => (p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) ?? [])
  .map((t) => t.replace(/<[^>]+>/g, "")).join("");

const picked = [];
for (const p of paras) {
  if (picked.length >= COUNT) break;
  if (/<w:drawing|<w:sectPr|<w:numPr/.test(p)) continue;      // متن صافٍ فقط
  if (textOf(p).length < MINLEN) continue;                     // فقرات تلتف لأسطر عدة
  picked.push(p);
}
if (picked.length < COUNT)
  console.warn(`تحذير: وُجد ${picked.length} فقرة فقط بشرط MINLEN=${MINLEN}`);

// تجريد كل سمة ذات بادئة نطاق غير w:/xml: (w14:paraId، w16cid:… إلخ)
const clean = picked.map((p) =>
  p.replace(/\s(?!w:|xml:)[a-zA-Z][a-zA-Z0-9]*:[a-zA-Z][a-zA-Z0-9]*="[^"]*"/g, ""));

const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${clean.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>
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

writeFileSync(OUT, zipSync({
  "[Content_Types].xml": strToU8(types),
  "_rels/.rels": strToU8(rels),
  "word/document.xml": strToU8(doc),
  "word/settings.xml": strToU8(settings),
  "word/_rels/document.xml.rels": strToU8(docRels),
}));
console.log(`OK: ${OUT} — فقرات منقولة: ${clean.length}، أحرف: ${clean.reduce((s, p) => s + textOf(p).length, 0)}`);
