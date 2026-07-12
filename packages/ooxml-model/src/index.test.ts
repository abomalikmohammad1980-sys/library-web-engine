import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractFromDocx } from "./index.js";

const DOCX = "corpus/books/sample-masjid.docx";

describe("ooxml-model v0 — عينة حقيقية", () => {
  const model = extractFromDocx(readFileSync(new URL(`../../../${DOCX}`, import.meta.url)));

  it("يقرأ هندسة القسم بالـ twips ويحسب عرض العمود", () => {
    const s = model.section;
    expect(s.pageWTwips).toBeGreaterThan(10000);
    expect(s.columnTwips).toBe(s.pageWTwips - s.marLeftTwips - s.marRightTwips);
  });

  it("يستخرج فقرات متن بنص وخط وحجم فعالين (سلسلة الوراثة تعمل)", () => {
    const body = model.paragraphs.filter((p) => !p.excluded && p.text.trim().length > 40);
    expect(body.length).toBeGreaterThan(10);
    const withFont = body.filter((p) => p.runs.every((r) => r.family && r.emTwips));
    // الأغلبية يجب أن تُحل خطوطها وأحجامها عبر النمط/الافتراضيات لا أن تبقى null
    expect(withFont.length / body.length).toBeGreaterThan(0.8);
  });

  it("يقصي الفقرات ذات الحقول/الرسومات/التبويبات بعلامة لا بالحذف الصامت", () => {
    const excluded = model.paragraphs.filter((p) => p.excluded);
    expect(excluded.length).toBeGreaterThan(0);
  });
});
