export type QuranVerseResourceKind = "tafsir" | "gharib" | "qiraat" | "irab" | "tasrif";

export interface QuranVerseResourceEndpointContract {
  resourceId: string;
  kind: QuranVerseResourceKind;
  title: string;
  author: string | null;
  endpointTemplate: string;
  responseContentPath: string;
  responseAyahRangePath: string;
  provenanceUrl: string;
  attribution: string;
  permissionBasis: string;
}

const exactRange = /^(?:[1-9]|[1-9]\d|1[01]\d|11[0-4]):(?:[1-9]\d*)-(?:[1-9]|[1-9]\d|1[01]\d|11[0-4]):(?:[1-9]\d*)$/;

export function validateQuranVerseResourceEndpoint(input: QuranVerseResourceEndpointContract): QuranVerseResourceEndpointContract {
  if (!input.resourceId.trim() || !input.title.trim() || !input.attribution.trim() || !input.permissionBasis.trim())
    throw Error("quran_verse_resource_identity_invalid");
  const endpoint = new URL(input.endpointTemplate.replace("{resourceId}", encodeURIComponent(input.resourceId)).replace("{surah}", "1"));
  const provenance = new URL(input.provenanceUrl);
  if (endpoint.protocol !== "https:" || provenance.protocol !== "https:") throw Error("quran_verse_resource_https_required");
  if (!input.endpointTemplate.includes("{resourceId}") || !input.responseContentPath.trim() || !input.responseAyahRangePath.trim())
    throw Error("quran_verse_resource_mapping_invalid");
  return { ...input, author: input.author?.trim() || null };
}

export function validateExactQuranRange(value: string): string {
  if (!exactRange.test(value)) throw Error("quran_verse_resource_range_invalid");
  const [fromText = "", toText = ""] = value.split("-");
  const [fromSurah = 0, fromAyah = 0] = fromText.split(":").map(Number);
  const [toSurah = 0, toAyah = 0] = toText.split(":").map(Number);
  if (fromSurah !== toSurah || fromAyah > toAyah) throw Error("quran_verse_resource_range_invalid");
  return value;
}
