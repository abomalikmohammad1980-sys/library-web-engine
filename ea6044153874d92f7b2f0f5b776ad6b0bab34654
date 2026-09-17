import { describe, expect, it } from "vitest";
import { validateExactQuranRange, validateQuranVerseResourceEndpoint } from "./quran-verse-resource.js";

describe("Quran exact verse resource ingestion contract", () => {
  const valid = {
    resourceId: "2",
    kind: "tafsir" as const,
    title: "تفسير البغوي",
    author: null,
    endpointTemplate: "https://api.quranpedia.net/books-contents/{resourceId}",
    responseContentPath: "contents[].text",
    responseAyahRangePath: "contents[].related_ayahs",
    provenanceUrl: "https://api.quranpedia.net/books-contents/2",
    attribution: "Quranpedia API v1",
    permissionBasis: "USER-ATTESTED-WAQF-REUSE",
  };

  it("accepts a documented HTTPS endpoint with explicit content and ayah mappings", () => {
    expect(validateQuranVerseResourceEndpoint(valid)).toMatchObject({ resourceId: "2", kind: "tafsir" });
    expect(validateExactQuranRange("1:1-1:7")).toBe("1:1-1:7");
  });

  it("fails closed for an inferred endpoint, unsafe transport, or non-exact range", () => {
    expect(() => validateQuranVerseResourceEndpoint({ ...valid, endpointTemplate: "https://example.org/books/2" })).toThrow(/mapping/);
    expect(() => validateQuranVerseResourceEndpoint({ ...valid, endpointTemplate: "http://example.org/{resourceId}" })).toThrow(/https/);
    expect(() => validateExactQuranRange("1:1-2:1")).toThrow(/range/);
    expect(() => validateExactQuranRange("الفاتحة:1-7")).toThrow(/range/);
  });
});
