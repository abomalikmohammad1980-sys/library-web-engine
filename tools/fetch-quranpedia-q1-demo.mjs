import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const output = resolve(process.argv[2] ?? "docs/qa/quran-q1-demo-staging");
const retrievedAt = new Date().toISOString();
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function get(url) {
  const response = await fetch(url, { headers: { accept: "application/json" }, redirect: "error" });
  if (!response.ok) throw new Error(`http_${response.status}:${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 256 * 1024) throw new Error(`size_limit:${url}`);
  return { url, etag: response.headers.get("etag"), bytes, checksumSha256: sha(bytes), data: JSON.parse(bytes.toString("utf8")) };
}
const metadata = await get("https://api.quranpedia.net/v1/mushafs");
const fathia = await get("https://api.quranpedia.net/v1/mushafs/2/1");
const mushaf = metadata.data.find((entry) => entry.id === 2);
if (!mushaf || !/الخط العثماني/u.test(mushaf.description ?? "")) throw new Error("uthmani_metadata_missing");
if (!Array.isArray(fathia.data) || fathia.data.length !== 7) throw new Error("fatiha_ayah_count");
const records = fathia.data.map((entry, index) => {
  if (Number(entry.number) !== index + 1 || Number(entry.surah) !== 1 || typeof entry.text !== "string" || !entry.text) throw new Error(`ayah_identity:${index + 1}`);
  return { ayahId: `1:${index + 1}`, surah: 1, ayah: index + 1, sourceRecordId: entry.id, script: "uthmani", text: entry.text };
});
const payload = Buffer.from(`${JSON.stringify({ schemaVersion: 1, datasetId: "quranpedia-hafs-uthmani-fatiha-demo", records }, null, 2)}\n`, "utf8");
const manifest = {
  datasetId: "quranpedia-hafs-uthmani-fatiha-demo", kind: "ayah-text", schemaVersion: 1, dataVersion: "0.1.0-demo",
  checksumSha256: sha(payload), byteSize: payload.length, locale: "ar", script: "uthmani", qiraa: "عاصم", riwaya: "حفص",
  mushafEdition: mushaf.description,
  publicationStatus: "publishable-user-attested-waqf-reuse",
  provenance: {
    sourceName: "الموسوعة القرآنية Quranpedia", sourceUrl: fathia.url, licenseId: "USER-ATTESTED-WAQF-REUSE",
    attribution: "الموسوعة القرآنية Quranpedia — API v1؛ عينة سورة الفاتحة من مصحف حفص النصي ذي الخط العثماني.", retrievedAt,
    permissionBasis: "إقرار صاحب مشروع الخزانة بتاريخ 2026-08-09 بأن المصدر وقفي مصرح بالانتفاع والنشر في الخزانة الوقفية؛ لا يمثل معرف SPDX أو نص ترخيص صادرًا من API.",
    etag: fathia.etag, sourceChecksumSha256: fathia.checksumSha256, metadataUrl: metadata.url,
    metadataEtag: metadata.etag, metadataChecksumSha256: metadata.checksumSha256,
  },
};
await mkdir(output, { recursive: true });
await writeFile(join(output, "fatiha-uthmani.json"), payload);
await writeFile(join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await writeFile(join(output, "source-response.json"), fathia.bytes);
await writeFile(join(output, "mushaf-metadata.json"), `${JSON.stringify(mushaf, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output, records: records.length, checksumSha256: manifest.checksumSha256, sourceChecksumSha256: fathia.checksumSha256, etag: fathia.etag }));
