import { describe, expect, it } from "vitest";
import { alignPages } from "./align.js";
import { normalizeArabic } from "./normalize.js";
describe("monotonic page alignment", () => {
  it("finds Arabic page boundaries in order", () => {
    const texts = ["مقدمة الكتاب وفيها بيان المقصد", "الفصل الأول الأدلة النقلية", "تفصيل الدليل الأول ووجه الاستدلال", "الفصل الثاني الأدلة العقلية", "خاتمة الكتاب ونتائجه"];
    const ps = texts.map((text,index)=>({index,text,normalized:normalizeArabic(text),excluded:false}));
    const pages = [{page:1,text:texts.slice(0,2).join(" "),normalized:"",method:"text-layer" as const},{page:2,text:texts.slice(2).join(" "),normalized:"",method:"text-layer" as const}];
    const result = alignPages(pages, ps, [0,2]); expect(result[1]!.paragraphIndex).toBe(2); expect(result[1]!.confidence).toBeGreaterThan(.7);
  });
  it("never guesses a scanned page", () => { const result=alignPages([{page:1,text:"",normalized:"",method:"empty-needs-ocr"}],[]); expect(result[0]!.status).toBe("needs_review") });
});
