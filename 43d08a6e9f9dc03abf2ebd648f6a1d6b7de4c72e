import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const root = resolve(process.argv[2] ?? "docs/qa/quran-q1-demo-staging");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const payloadBytes = await readFile(join(root, "fatiha-uthmani.json"));
const sourceBytes = await readFile(join(root, "source-response.json"));
const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
const payload = JSON.parse(payloadBytes.toString("utf8"));
const source = JSON.parse(sourceBytes.toString("utf8"));
if (manifest.checksumSha256 !== sha(payloadBytes) || manifest.byteSize !== payloadBytes.length) throw new Error("payload_integrity");
if (manifest.provenance.sourceChecksumSha256 !== sha(sourceBytes)) throw new Error("source_integrity");
if (payload.records.length !== 7 || source.length !== 7) throw new Error("fatiha_count");
for (let index = 0; index < 7; index++) {
  const record = payload.records[index], original = source[index];
  if (record.ayahId !== `1:${index + 1}` || record.surah !== 1 || record.ayah !== index + 1) throw new Error(`identity:${index + 1}`);
  if (record.sourceRecordId !== original.id || record.text !== original.text) throw new Error(`source_fidelity:${index + 1}`);
}
console.log(JSON.stringify({ verified: true, records: 7, payloadSha256: manifest.checksumSha256, sourceSha256: manifest.provenance.sourceChecksumSha256 }));
