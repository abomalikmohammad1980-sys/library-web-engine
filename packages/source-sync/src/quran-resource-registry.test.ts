import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateQuranResourceRegistry, type QuranResourceRegistry } from "./quran-resource-registry.js";

const root = resolve(import.meta.dirname, "../../../app/public/quran");
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

describe("Quran verse resource registry", () => {
  it("publishes only locally verified packs and binds them to their manifest checksum", async () => {
    const registry = validateQuranResourceRegistry(JSON.parse(await readFile(resolve(root, "resources/manifest.json"), "utf8")));
    const installed = registry.entries.filter((entry) => entry.status === "installed");
    expect(installed.map((entry) => entry.resourceKey)).toEqual([
      "quranpedia-tafsir-pack", "mokhtasar-tafsir", "fi-zilal-al-quran", "quran-gharib", "quran-qiraat", "quran-tasrif", "quran-irab",
    ]);
    for (const entry of installed) {
      const bytes = await readFile(resolve(root, entry.packManifestPath!));
      expect(sha256(bytes)).toBe(entry.packManifestChecksumSha256);
      expect(["exact", "exact-single-ayah-word"]).toContain(entry.mapping?.rangeMode);
    }
  });

  it("never exposes a fabricated pack for requested resources whose text source is absent", async () => {
    const registry = validateQuranResourceRegistry(JSON.parse(await readFile(resolve(root, "resources/manifest.json"), "utf8")));
    const pending = registry.entries.filter((entry) => entry.status === "source-required");
    expect(pending.map((entry) => entry.resourceKey)).toEqual([]);
    expect(pending.every((entry) => entry.packManifestPath === null && entry.mapping === null)).toBe(true);
  });

  it("rejects a pending resource that falsely advertises local content", () => {
    const fixture: QuranResourceRegistry = {
      schemaVersion: 1,
      datasetId: "fixture",
      auditedAt: "2026-08-09",
      entries: [{
        resourceKey: "fake", kind: "tafsir", title: "نص غير موثق", author: null, status: "source-required",
        sourceUrl: null, permissionBasis: "source-not-present", packManifestPath: "fake.json",
        packManifestChecksumSha256: "a".repeat(64), mapping: null,
      }],
    };
    expect(() => validateQuranResourceRegistry(fixture)).toThrow(/must_not_advertise/);
  });
});
