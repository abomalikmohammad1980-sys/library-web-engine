import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../../app/public/quran/resources/packs/mokhtasar-tafsir");
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

describe("Quranpedia exact verse book pack", () => {
  it("binds all 6236 verses of al-Mokhtasar to their exact surah/ayah", async () => {
    const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      resource: { id: "2003", kind: "tafsir", slug: "mokhtasar-tafsir" },
      counts: { surahs: 114, ayahs: 6236 },
      mapping: { rangeMode: "exact-single-ayah" },
    });
    expect(manifest.provenance.sourceTemplate).toBe("https://quranpedia.net/surah/1/{surah}/book/2003");
    let total = 0;
    for (const file of manifest.files) {
      const bytes = await readFile(resolve(root, file.file));
      expect(bytes.byteLength, file.file).toBe(file.byteSize);
      expect(sha256(bytes), file.file).toBe(file.checksumSha256);
      const payload = JSON.parse(bytes.toString("utf8"));
      expect(payload.surah).toBe(file.surah);
      expect(payload.records).toHaveLength(file.ayahs);
      expect(payload.records.map((record: { ayah: number }) => record.ayah)).toEqual(
        Array.from({ length: file.ayahs }, (_, index) => index + 1),
      );
      expect(payload.records.every((record: { ayah: number; from: number; to: number; text: string }) =>
        record.from === record.ayah && record.to === record.ayah && record.text.trim().length > 0)).toBe(true);
      total += payload.records.length;
    }
    expect(total).toBe(6236);
  }, 30_000);

  it.each([
    ["gharib-ibn-qutaybah", "341", "gharib", 386],
    ["irab-darwish", "64", "irab", 1377],
  ])("keeps sparse %s entries exact without fabricating missing verses", async (slug, id, kind, expectedAyahs) => {
    const packRoot = resolve(root, "..", slug);
    const manifest = JSON.parse(await readFile(resolve(packRoot, "manifest.json"), "utf8"));
    expect(manifest).toMatchObject({ resource: { id, kind, slug }, coverage: "partial", counts: { surahs: 114, ayahs: expectedAyahs } });
    let total = 0;
    for (const file of manifest.files) {
      const bytes = await readFile(resolve(packRoot, file.file));
      expect(sha256(bytes), file.file).toBe(file.checksumSha256);
      const payload = JSON.parse(bytes.toString("utf8"));
      const ayahs = payload.records.map((record: { ayah: number }) => record.ayah);
      expect(ayahs).toEqual([...ayahs].sort((a, b) => a - b));
      expect(new Set(ayahs).size).toBe(ayahs.length);
      expect(payload.records.every((record: { ayah: number; from: number; to: number; text: string }) =>
        record.from === record.ayah && record.to === record.ayah && record.text.trim().length > 0)).toBe(true);
      total += ayahs.length;
    }
    expect(total).toBe(expectedAyahs);
  }, 30_000);
});
