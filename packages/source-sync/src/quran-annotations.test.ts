import { describe, expect, it } from "vitest";
import type { BookBuildManifest, DerivedArtifact, DerivedArtifactKind } from "./publication.js";
import { decideAtomicPublication, evaluateBuildReadiness, REQUIRED_DERIVED_ARTIFACTS } from "./publication.js";
import {
  isQuranAnnotationArtifactCurrent,
  quranAnnotationManifestMetadata,
  validateQuranAnnotationSet,
  type VersionedQuranAnnotationSet,
} from "./quran-annotations.js";

const checksum = "a".repeat(64);

function set(): VersionedQuranAnnotationSet {
  return {
    schemaVersion: 1,
    sourceRevisionId: "revision-1",
    corpusVersion: "tanzil-uthmani-2026-01",
    corpusChecksum: checksum,
    annotations: [{
      sourceRange: { paragraphStart: 2, paragraphEnd: 2, characterStart: 5, characterEnd: 21 },
      references: [{ surah: 2, ayahStart: 255, ayahEnd: 255 }],
      confidence: "exact",
    }],
  };
}

function artifact(kind: DerivedArtifactKind, overrides: Partial<DerivedArtifact> = {}): DerivedArtifact {
  return {
    artifactId: `artifact-${kind}`,
    kind,
    bookId: "book-1",
    sourceRevisionId: "revision-1",
    buildId: "build-1",
    status: "ready",
    fingerprint: { algorithm: "sha256", hex: "b".repeat(64), byteLength: 10 },
    objectKey: `immutable/build-1/${kind}`,
    engineVersion: "engine-v1",
    ...overrides,
  };
}

function manifest(artifacts: DerivedArtifact[]): BookBuildManifest {
  return { buildId: "build-1", bookId: "book-1", sourceRevisionId: "revision-1", status: "ready", artifacts, createdAt: "2026-08-08T00:00:00Z" };
}

describe("versioned exact Quran annotations", () => {
  it("validates exact source ranges and Quran references without embedding the corpus", () => {
    const value = set();
    expect(validateQuranAnnotationSet(value)).toBe(value);
    expect(quranAnnotationManifestMetadata(value)).toEqual({ schemaVersion: 1, corpusVersion: value.corpusVersion, corpusChecksum: checksum, confidence: "exact", annotationCount: 1 });
    expect(value).not.toHaveProperty("corpus");
  });

  it("rejects fuzzy or AI confidence and malformed ranges or references", () => {
    const fuzzy = set() as unknown as { annotations: Array<{ confidence: string }> };
    fuzzy.annotations[0]!.confidence = "fuzzy";
    expect(() => validateQuranAnnotationSet(fuzzy as unknown as VersionedQuranAnnotationSet)).toThrow(/range/);
    const invalid = set();
    invalid.annotations[0]!.references[0]!.surah = 115;
    expect(() => validateQuranAnnotationSet(invalid)).toThrow(/reference/);
  });

  it("replays only against the identical immutable source and corpus identity", () => {
    const quran = artifact("quran-annotations", { quranAnnotations: quranAnnotationManifestMetadata(set()) });
    expect(isQuranAnnotationArtifactCurrent(quran, { sourceRevisionId: "revision-1", corpusVersion: "tanzil-uthmani-2026-01", corpusChecksum: checksum })).toBe(true);
    expect(isQuranAnnotationArtifactCurrent(quran, { sourceRevisionId: "revision-1", corpusVersion: "tanzil-uthmani-2026-02", corpusChecksum: checksum })).toBe(false);
    expect(isQuranAnnotationArtifactCurrent(quran, { sourceRevisionId: "revision-1", corpusVersion: "tanzil-uthmani-2026-01", corpusChecksum: "c".repeat(64) })).toBe(false);
    expect(isQuranAnnotationArtifactCurrent(quran, { sourceRevisionId: "revision-2", corpusVersion: "tanzil-uthmani-2026-01", corpusChecksum: checksum })).toBe(false);
  });

  it("keeps the artifact optional, but makes an indexed dependency exact and atomic", () => {
    const required = REQUIRED_DERIVED_ARTIFACTS.map((kind) => artifact(kind));
    expect(evaluateBuildReadiness(manifest(required)).kind).toBe("ready");
    const quran = artifact("quran-annotations", { quranAnnotations: quranAnnotationManifestMetadata(set()) });
    const search = required.find((item) => item.kind === "search")!;
    search.quranAnnotationDependency = { artifactId: quran.artifactId, corpusVersion: "tanzil-uthmani-2026-01", corpusChecksum: checksum };
    const build = manifest([...required, quran]);
    expect(evaluateBuildReadiness(build).kind).toBe("ready");
    expect(decideAtomicPublication({ manifest: build, expectedActiveBuildId: null, currentActiveBuildId: null })).toMatchObject({ kind: "publish", artifactIds: { "quran-annotations": quran.artifactId } });
    quran.quranAnnotations = { ...quran.quranAnnotations!, corpusVersion: "tanzil-uthmani-2026-02" };
    expect(() => evaluateBuildReadiness(build)).toThrow(/search dependency/);
  });
});
