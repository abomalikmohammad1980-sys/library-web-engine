import { describe, expect, it } from "vitest";
import { ngramDice, normalizeArabic } from "./normalize.js";
import { usableArabicTextLayer } from "./extract.js";
describe("Arabic normalization", () => {
  it("tolerates tashkeel, tatweel and alef variants", () => expect(normalizeArabic("إِنَّ الـعِلْمَ")).toBe("ان العلم"));
  it("keeps unrelated Arabic distinguishable", () => expect(ngramDice("دخول المجالس التشريعية", "دخولُ المجالسِ التشريعيَّة")).toBeGreaterThan(.9));
  it("rejects legacy-glyph garbage as a usable PDF layer", () => expect(usableArabicTextLayer("íéÃè (cid:1) @@@ ×Â Ö]æ")).toBe(false));
});
