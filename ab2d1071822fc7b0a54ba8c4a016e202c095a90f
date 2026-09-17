import { describe, expect, it } from "vitest";
import { parseSurahpediaJsonEnvelope, parseSurahpediaWordPage } from "./surahpedia-word-resource.js";

const html = `<div data-page-title="سُورة الفاتحة - آية ۱">
  <div><a href="https://surahpedia.com/ar/quran/1/1/1">بِسْمِ</a></div>
  <span style="color:#008000">(الْبَاءُ)</span> حَرْفُ جَرٍّ.<br>عند الوصل
  <div><a href="https://surahpedia.com/ar/quran/1/1/2">اللَّهِ</a></div>
  اسْمُ الْجَلَالَةِ.</div>`;
const response = `<div style="display:none"><a href="https://spam.invalid">spam</a></div>${JSON.stringify({ title: "كلمات آية 1 - سورة الفاتحة", page: "1", html })}`;

describe("Surahpedia word resource ingestion", () => {
  it("discards an injected prefix and binds every word to the expected ayah identity", () => {
    expect(parseSurahpediaJsonEnvelope(response)).toMatchObject({ page: "1" });
    expect(parseSurahpediaWordPage(response, 22, { page: 1, surah: 1, ayah: 1 })).toMatchObject({
      kind: "irab", entries: [
        { wordId: 1, position: 1, word: "بِسْمِ", text: "(الْبَاءُ) حَرْفُ جَرٍّ.\nعند الوصل" },
        { wordId: 2, position: 2, word: "اللَّهِ", text: "اسْمُ الْجَلَالَةِ." },
      ],
    });
  });

  it("fails closed on a changed page, unsafe markup, or foreign word link", () => {
    expect(() => parseSurahpediaWordPage(response, 36, { page: 2, surah: 1, ayah: 2 })).toThrow(/page_identity/);
    const unsafe = JSON.stringify({ title: "كلمات آية 1 - سورة الفاتحة", page: "1", html: `${html}<script>alert(1)</script>` });
    expect(() => parseSurahpediaWordPage(unsafe, 22, { page: 1, surah: 1, ayah: 1 })).toThrow(/unsafe_markup/);
    const foreign = response.replace("/quran/1/1/2", "/quran/2/1/2");
    expect(() => parseSurahpediaWordPage(foreign, 22, { page: 1, surah: 1, ayah: 1 })).toThrow(/word_identity/);
  });

  it("keeps the morphology project distinct from gharib semantics", () => {
    expect(parseSurahpediaWordPage(response, 37, { page: 1, surah: 1, ayah: 1 }).kind).toBe("tasrif");
  });
});
