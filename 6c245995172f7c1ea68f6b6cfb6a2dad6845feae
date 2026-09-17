import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../../app/public/quran/tafsir");
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

describe("documented Quran tafsir pack", () => {
  it("binds every exact-surah payload to its manifest checksum", async () => {
    const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
    expect(manifest).toMatchObject({ schemaVersion: 2, datasetId: "quranpedia-exact-tafsir-segments" });
    expect(manifest.attribution).toContain("Quranpedia");
    expect(manifest.permissionBasis).toBe("USER-ATTESTED-WAQF-REUSE");
    expect(manifest.books.map((book: { id: number }) => book.id)).toEqual([2, 3, 4]);
    for (const book of manifest.books) {
      expect(book.files).toHaveLength(book.surahs);
      expect(book.files.reduce((sum: number, file: { segments: number }) => sum + file.segments, 0)).toBe(book.segments);
      for (const file of book.files) {
        const bytes = await readFile(resolve(root, file.file));
        expect(bytes.byteLength, file.file).toBe(file.byteSize);
        expect(sha256(bytes), file.file).toBe(file.checksumSha256);
        const payload = JSON.parse(bytes.toString("utf8"));
        expect(payload).toMatchObject({ schemaVersion: 1, bookId: book.id, surah: file.surah });
      }
    }
  }, 30_000);
});
