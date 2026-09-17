import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { validateAudioSourceCatalog } from "../packages/source-sync/dist/media-packs.js";

const output = resolve(process.argv[2] ?? "generated/quranpedia-audio-catalog-v1");
const url = "https://api.quranpedia.net/v1/reciters", retrievedAt = new Date().toISOString();
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const response = await fetch(url, { headers: { accept: "application/json" }, redirect: "error" });
if (!response.ok) throw Error(`http_${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
if (bytes.length > 1024 * 1024) throw Error("audio_catalog_size_limit");
const groups = JSON.parse(bytes.toString("utf8"));
if (!Array.isArray(groups)) throw Error("audio_catalog_shape");
const rejected = [], entries = [];
for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
  const group = groups[groupIndex]; if (!Array.isArray(group)) continue;
  for (const source of group) try {
    const speaker = String(source.name ?? "").match(/^مصحف\s+(.+?)\s+برواية/u)?.[1]?.trim() ?? null;
    const media = new URL(source.server); if (media.protocol !== "https:") throw Error("unsafe_server");
    const chapters = [...new Set((source.surahs_list ?? []).map(Number))];
    if (!chapters.length || chapters.some((n) => !Number.isSafeInteger(n) || n < 1 || n > 114)) throw Error("invalid_surahs");
    entries.push({ sourceId: `quranpedia:${source.id}`, workId: `quranpedia-reciter-group:${groupIndex + 1}`, kind: "recitation", title: String(source.name), speaker, reciter: speaker, riwaya: source.rawi?.name ?? null, chapterIds: chapters.map(String), segmentation: source.classification?.name === "حسب الآيات" ? "segment" : "chapter", mediaBaseUrl: media.href, timingManifestUrl: source.timing_url ? new URL(source.timing_url).href : null, durationMs: null, checksumSha256: null });
  } catch (error) { rejected.push({ id: source?.id ?? null, reason: error instanceof Error ? error.message : String(error) }); }
}
const catalog = { schemaVersion: 1, catalogId: "quranpedia-recitations-v1", entries, provenance: { provider: "Quranpedia", sourceUrl: url, retrievedAt, version: "v1", checksumSha256: sha(bytes), license: "USER-ATTESTED-WAQF-REUSE" }, offline: { metadataOnly: true, mediaDownload: "explicit" } };
validateAudioSourceCatalog(catalog);
const catalogBytes = Buffer.from(`${JSON.stringify(catalog)}\n`);
const manifest = { schemaVersion: 1, catalogId: catalog.catalogId, entryCount: entries.length, rejected, checksumSha256: sha(catalogBytes), sourceChecksumSha256: sha(bytes), sourceUrl: url, retrievedAt, etag: response.headers.get("etag"), permissionBasis: "USER-ATTESTED-WAQF-REUSE 2026-08-09; no SPDX claim" };
await mkdir(output, { recursive: true });
for (const [name, data] of [["source-response.json", bytes], ["catalog.json", catalogBytes], ["manifest.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)]]) {
  const temp = join(output, `${name}.tmp`); await writeFile(temp, data); await rename(temp, join(output, name));
}
console.log(JSON.stringify({ output, groups: groups.length, entries: entries.length, rejected: rejected.length, sourceSha256: sha(bytes), catalogSha256: manifest.checksumSha256 }));
