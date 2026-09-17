import type { DerivedArtifact } from "./publication.js";

export interface QuranSourceRange { paragraphStart: number; paragraphEnd: number; characterStart: number; characterEnd: number }
export interface QuranAyahReference { surah: number; ayahStart: number; ayahEnd: number }
export interface ExactQuranAnnotation { sourceRange: QuranSourceRange; references: readonly QuranAyahReference[]; confidence: "exact" }
export interface VersionedQuranAnnotationSet { schemaVersion: 1; sourceRevisionId: string; corpusVersion: string; corpusChecksum: string; annotations: readonly ExactQuranAnnotation[] }

export function validateQuranAnnotationSet(value: VersionedQuranAnnotationSet): VersionedQuranAnnotationSet {
  if (value.schemaVersion !== 1 || !value.sourceRevisionId.trim() || !value.corpusVersion.trim() || !/^[a-f0-9]{64}$/.test(value.corpusChecksum)) throw new Error("quran_annotation_version_invalid");
  for (const annotation of value.annotations) {
    const range = annotation.sourceRange;
    if (annotation.confidence !== "exact" || !Number.isSafeInteger(range.paragraphStart) || !Number.isSafeInteger(range.paragraphEnd)
      || !Number.isSafeInteger(range.characterStart) || !Number.isSafeInteger(range.characterEnd) || range.paragraphStart < 0
      || range.paragraphEnd < range.paragraphStart || range.characterStart < 0 || range.characterEnd <= range.characterStart
      || annotation.references.length === 0) throw new Error("quran_annotation_range_invalid");
    for (const reference of annotation.references) if (!Number.isSafeInteger(reference.surah) || reference.surah < 1 || reference.surah > 114
      || !Number.isSafeInteger(reference.ayahStart) || !Number.isSafeInteger(reference.ayahEnd) || reference.ayahStart < 1 || reference.ayahEnd < reference.ayahStart) throw new Error("quran_annotation_reference_invalid");
  }
  return value;
}

/** Exact replay is allowed only for the same immutable source and corpus identity. */
export function isQuranAnnotationArtifactCurrent(artifact: DerivedArtifact, expected: { sourceRevisionId: string; corpusVersion: string; corpusChecksum: string }): boolean {
  return artifact.kind === "quran-annotations" && artifact.status === "ready" && artifact.sourceRevisionId === expected.sourceRevisionId
    && artifact.quranAnnotations?.schemaVersion === 1 && artifact.quranAnnotations.confidence === "exact"
    && artifact.quranAnnotations.corpusVersion === expected.corpusVersion && artifact.quranAnnotations.corpusChecksum === expected.corpusChecksum;
}

export function quranAnnotationManifestMetadata(set: VersionedQuranAnnotationSet) {
  validateQuranAnnotationSet(set);
  return { schemaVersion: 1 as const, corpusVersion: set.corpusVersion, corpusChecksum: set.corpusChecksum, confidence: "exact" as const, annotationCount: set.annotations.length };
}
