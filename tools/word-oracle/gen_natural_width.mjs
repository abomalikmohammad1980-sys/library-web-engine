#!/usr/bin/env node
/** مولّد قياس العرض الطبيعي — فقرات **غير مسوَّغة** (jc=start) بـTraditional
 *  Arabic، كل فقرة سطر واحد قصير لا يلتف، فيكون advSumTwips الحقيقي = العرض
 *  الطبيعي المحض (بلا تسويغ). يحسم فجوة تشكيل HarfBuzz/DirectWrite مقابل
 *  Word مباشرةً — القياس المستحيل على الكتب المسوَّغة. */
import { writeFileSync } from "node:fs";
import { strToU8, zipSync } from "../../node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/browser.js";

const F = process.env.FONT ?? "Traditional Arabic";
const SZ = process.env.SZ ?? "32";
// جُمَل عربية متنوعة الطول والحروف (رباطات، لام-ألف، تشكيل، أرقام)
const LONG = process.env.LONG === "1"; // أسطر طويلة (80+ حرفًا) على صفحة عريضة
const SENT_LONG = [
  "العناية بترصيف النص العربي على الشبكة تتطلب فهما دقيقا لقواعد التسويغ والكسر التي تحكم المطبوع منذ القرون",
  "وقد كان الوراقون يتوارثون أسرار الصناعة جيلا بعد جيل حتى استقرت قواعد راسخة في تقدير المسافات وضبط الأسطر",
  "ولما جاءت الحواسيب حملت معها أنظمة ترصيف جديدة تحتاج إلى مطابقة صارمة مع ما استقر عليه أهل الخبرة والمعرفة",
  "إن مطابقة محرك الترصيف الحديث لسلوك المعالجات المكتبية يستلزم قياسا دقيقا لعرض كل كلمة وكل فاصلة وكل حرف",
  "والحمد لله الذي علم بالقلم علم الإنسان ما لم يعلم وجعل الكتابة وعاء للعلم وحفظا للمعرفة عبر القرون الطويلة",
];
const SENT_SHORT = [
  "بسم الله الرحمن الرحيم",
  "الحمد لله رب العالمين",
  "محمد رسول الله صلى الله عليه وسلم",
  "لا إله إلا الله وحده لا شريك له",
  "إن الصلاة كانت على المؤمنين كتابا موقوتا",
  "وقل رب زدني علما وارزقني فهما",
  "العلم نور والجهل ظلام دامس",
  "الكتابة فن وصناعة تحتاج إلى دربة",
  "أخوة الإيمان أوثق من أخوة النسب",
  "طلب العلم فريضة على كل مسلم ومسلمة",
  "من جد وجد ومن زرع حصد ومن سار على الدرب وصل",
  "الصبر مفتاح الفرج والعجلة من الشيطان",
  "خير الكلام ما قل ودل وأصاب المعنى",
  "الوقت كالسيف إن لم تقطعه قطعك",
  "رحم الله امرأ عرف قدر نفسه",
];
const SENT = LONG ? SENT_LONG : SENT_SHORT;
const PGW = LONG ? 23811 : 11906;
const RPR = `<w:rPr><w:rFonts w:ascii="${F}" w:hAnsi="${F}" w:cs="${F}" w:hint="cs"/><w:sz w:val="${SZ}"/><w:szCs w:val="${SZ}"/><w:rtl/></w:rPr>`;
let body = "";
for (const s of SENT)
  body += `<w:p><w:pPr><w:bidi/><w:jc w:val="start"/>` +
    `<w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>` +
    `<w:r>${RPR}<w:t xml:space="preserve">${s}</w:t></w:r></w:p>`;

const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}<w:sectPr><w:pgSz w:w="${PGW}" w:h="16838"/>
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

const OUT = process.argv[2] ?? "corpus/books/sample-vtest20.docx";
writeFileSync(OUT, zipSync({
  "[Content_Types].xml": strToU8(types),
  "_rels/.rels": strToU8(rels),
  "word/document.xml": strToU8(doc),
  "word/settings.xml": strToU8(settings),
  "word/_rels/document.xml.rels": strToU8(docRels),
}));
console.log("OK:", OUT, "— 15 فقرة غير مسوَّغة،", F, SZ);
