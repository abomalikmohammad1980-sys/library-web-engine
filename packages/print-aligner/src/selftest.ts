import assert from "node:assert/strict";
import { alignPages } from "./align.js";
import { usableArabicTextLayer } from "./extract.js";
import { ngramDice, normalizeArabic } from "./normalize.js";

assert.equal(normalizeArabic("إِنَّ الـعِلْمَ"), "ان العلم");
assert.ok(ngramDice("دخول المجالس التشريعية", "دخولُ المجالسِ التشريعيَّة") > .9);
assert.equal(usableArabicTextLayer("íéÃè (cid:1) @@@ ×Â Ö]æ"), false);
const texts = ["مقدمة الكتاب وفيها بيان المقصد", "الفصل الأول الأدلة النقلية", "تفصيل الدليل الأول ووجه الاستدلال", "الفصل الثاني الأدلة العقلية", "خاتمة الكتاب ونتائجه"];
const paragraphs = texts.map((text,index)=>({index,text,normalized:normalizeArabic(text),excluded:false}));
const pages = [{page:1,text:texts.slice(0,2).join(" "),normalized:"",method:"text-layer" as const},{page:2,text:texts.slice(2).join(" "),normalized:"",method:"text-layer" as const}];
const result = alignPages(pages, paragraphs, [0,2]); assert.equal(result[1]!.paragraphIndex, 2); assert.ok(result[1]!.confidence > .7);
console.log("print-aligner selftest: ok");
