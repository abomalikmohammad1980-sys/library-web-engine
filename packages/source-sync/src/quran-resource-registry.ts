export type QuranResourceKind = "tafsir" | "gharib" | "qiraat" | "irab" | "tasrif";
export type QuranResourceStatus = "installed" | "source-required";

export interface QuranResourceRegistryEntry {
  resourceKey: string;
  kind: QuranResourceKind;
  title: string;
  author: string | null;
  status: QuranResourceStatus;
  sourceUrl: string | null;
  permissionBasis: string;
  packManifestPath: string | null;
  packManifestChecksumSha256: string | null;
  mapping: { contentPath: string; ayahRangePath: string; rangeMode: "exact" | "exact-single-ayah-word" } | null;
  note?: string;
}

export interface QuranResourceRegistry {
  schemaVersion: 1;
  datasetId: string;
  auditedAt: string;
  entries: QuranResourceRegistryEntry[];
}

const sha256 = /^[a-f0-9]{64}$/;

export function validateQuranResourceRegistry(registry: QuranResourceRegistry): QuranResourceRegistry {
  if (registry.schemaVersion !== 1 || !registry.datasetId.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(registry.auditedAt))
    throw Error("quran_resource_registry_identity_invalid");
  const keys = new Set<string>();
  for (const entry of registry.entries) {
    if (!entry.resourceKey.trim() || keys.has(entry.resourceKey) || !entry.title.trim() || !entry.permissionBasis.trim())
      throw Error("quran_resource_registry_entry_invalid");
    keys.add(entry.resourceKey);
    if (entry.sourceUrl !== null && new URL(entry.sourceUrl).protocol !== "https:")
      throw Error("quran_resource_registry_https_required");
    if (entry.status === "installed") {
      if (!entry.sourceUrl || !entry.packManifestPath || !sha256.test(entry.packManifestChecksumSha256 ?? "") || !entry.mapping)
        throw Error("quran_resource_registry_installed_incomplete");
      if ((entry.mapping.rangeMode !== "exact" && entry.mapping.rangeMode !== "exact-single-ayah-word") || !entry.mapping.contentPath.trim() || !entry.mapping.ayahRangePath.trim())
        throw Error("quran_resource_registry_mapping_invalid");
    } else if (entry.packManifestPath !== null || entry.packManifestChecksumSha256 !== null || entry.mapping !== null) {
      throw Error("quran_resource_registry_unavailable_must_not_advertise_pack");
    }
  }
  return registry;
}
