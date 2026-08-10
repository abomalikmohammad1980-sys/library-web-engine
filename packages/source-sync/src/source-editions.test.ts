import { describe, expect, it } from "vitest";
import { SOURCE_FORMATS, SOURCE_FORMAT_CAPABILITIES, attachSourceEdition, validateSourceFormatSecurityLimits, type ImmutableSourceEdition, type LogicalWork, type SourceFormat } from "./source-editions.js";

const hash = "a".repeat(64);
function edition(format: SourceFormat, id = `edition-${format}`, role: ImmutableSourceEdition["role"] = "authoritative"): ImmutableSourceEdition {
  const mediaType = SOURCE_FORMAT_CAPABILITIES[format].mediaTypes[0]!;
  return { editionId: id, operationId: `operation-${id}`, workId: "work", format, role, objectKey: `sources/${hash}/${id}`, fingerprint: { algorithm: "sha256", hex: hash, byteLength: 10 }, mediaType, sourceName: `book.${format}`, createdAt: "2026-08-08T00:00:00Z", createdByDeviceId: "device" };
}
const empty = (): LogicalWork => ({ workId: "work", title: "كتاب", authority: null, recordVersion: 0 });

describe("logical works and immutable source editions", () => {
  it("defines explicit capabilities for every supported format without treating PDF as structured Word", () => {
    expect(Object.keys(SOURCE_FORMAT_CAPABILITIES).sort()).toEqual([...SOURCE_FORMATS].sort());
    expect(SOURCE_FORMAT_CAPABILITIES.docx).toMatchObject({ canBeLiveWordAuthority: true, supportsStructuredText: true });
    expect(SOURCE_FORMAT_CAPABILITIES.pdf).toMatchObject({ canBeLiveWordAuthority: false, supportsStructuredText: false, requiresSandboxedParser: true });
  });
  it("establishes Word live authority and forbids silently replacing it with another format", () => {
    const word = attachSourceEdition(empty(), edition("docx"), "establish-authority", 0);
    expect(word).toMatchObject({ authority: { kind: "word-live", format: "docx" }, recordVersion: 1 });
    expect(() => attachSourceEdition(word, edition("pdf"), "advance-authority", 1)).toThrow(/word_authority_format_change_forbidden/);
    expect(attachSourceEdition(word, edition("docx", "edition-docx-2"), "advance-authority", 1)).toMatchObject({ authority: { editionId: "edition-docx-2" }, recordVersion: 2 });
  });
  it("supports an immutable non-Word authority for works that never had Word and keeps alternates non-authoritative", () => {
    const pdf = attachSourceEdition(empty(), edition("pdf"), "establish-authority", 0);
    expect(pdf.authority).toEqual({ kind: "immutable-edition", editionId: "edition-pdf", format: "pdf" });
    const unchanged = attachSourceEdition(pdf, edition("epub", "alternate", "alternate"), "attach-alternate", 1);
    expect(unchanged).toBe(pdf);
    expect(() => attachSourceEdition(pdf, edition("epub"), "advance-authority", 1)).toThrow(/explicit_workflow/);
  });
  it("enforces CAS, immutable object identity, media type, and per-format security limits", () => {
    expect(() => attachSourceEdition(empty(), edition("text"), "establish-authority", 1)).toThrow(/version_conflict/);
    expect(() => attachSourceEdition(empty(), { ...edition("pdf"), objectKey: "sources/not-content-addressed" }, "establish-authority", 0)).toThrow(/fingerprint/);
    expect(() => attachSourceEdition(empty(), { ...edition("pdf"), mediaType: "text/plain" }, "establish-authority", 0)).toThrow(/media_type/);
    expect(() => validateSourceFormatSecurityLimits("epub", { maxBytes: 100, allowEmbeddedFiles: false, allowExternalReferences: false, allowActiveContent: false })).toThrow(/archive_limits/);
    expect(() => validateSourceFormatSecurityLimits("text", { maxBytes: 100, maxTextCodePoints: 1000, allowEmbeddedFiles: false, allowExternalReferences: false, allowActiveContent: false })).not.toThrow();
    expect(() => validateSourceFormatSecurityLimits("pdf", { maxBytes: 100, allowEmbeddedFiles: false, allowExternalReferences: true, allowActiveContent: false })).toThrow(/unsafe/);
    expect(() => validateSourceFormatSecurityLimits("pdf", { maxBytes: 100, allowEmbeddedFiles: true, allowExternalReferences: false, allowActiveContent: false })).toThrow(/embedded/);
  });
});
