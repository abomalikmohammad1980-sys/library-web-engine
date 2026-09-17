import { describe, expect, it } from "vitest";
import type { BookBuildManifest, DerivedArtifact, DerivedArtifactKind } from "./publication.js";
import {
  decideAtomicPublication,
  evaluateBuildReadiness,
  REQUIRED_DERIVED_ARTIFACTS,
} from "./publication.js";

function artifact(kind: DerivedArtifactKind, overrides: Partial<DerivedArtifact> = {}): DerivedArtifact {
  return {
    artifactId: `artifact-${kind}`,
    kind,
    bookId: "book-1",
    sourceRevisionId: "revision-2",
    buildId: "build-2",
    status: "ready",
    fingerprint: { algorithm: "sha256", hex: "a".repeat(64), byteLength: 10 },
    objectKey: `staging/build-2/${kind}`,
    engineVersion: "engine-v1",
    ...overrides,
  };
}

function manifest(overrides: Partial<BookBuildManifest> = {}): BookBuildManifest {
  return {
    buildId: "build-2",
    bookId: "book-1",
    sourceRevisionId: "revision-2",
    status: "ready",
    artifacts: REQUIRED_DERIVED_ARTIFACTS.map((kind) => artifact(kind)),
    createdAt: "2026-08-08T00:00:00.000Z",
    ...overrides,
  };
}

describe("build manifest readiness", () => {
  it("accepts one ready artifact of every mandatory kind from the same revision", () => {
    expect(evaluateBuildReadiness(manifest()).kind).toBe("ready");
  });

  it("reports missing, pending, and failed derivatives without partial approval", () => {
    const build = manifest({
      status: "processing",
      artifacts: [
        artifact("reader"),
        artifact("pdf", { status: "pending", fingerprint: null, objectKey: null }),
        artifact("search", { status: "failed", fingerprint: null, objectKey: null }),
        artifact("toc"),
      ],
    });
    expect(evaluateBuildReadiness(build)).toEqual({
      kind: "not-ready",
      missing: ["cover"],
      pending: ["pdf"],
      failed: ["search"],
      manifestStatus: "processing",
    });
  });

  it("rejects an artifact from another revision/build instead of mixing output", () => {
    const build = manifest();
    build.artifacts[0] = artifact("reader", { sourceRevisionId: "revision-old" });
    expect(() => evaluateBuildReadiness(build)).toThrow(/book\/revision\/build/);
  });

  it("rejects duplicate artifact kinds", () => {
    const build = manifest();
    build.artifacts.push(artifact("pdf", { artifactId: "another-pdf" }));
    expect(() => evaluateBuildReadiness(build)).toThrow(/Duplicate/);
  });

  it("does not treat ready artifacts as publishable while manifest is processing", () => {
    expect(evaluateBuildReadiness(manifest({ status: "processing" }))).toMatchObject({
      kind: "not-ready",
      manifestStatus: "processing",
    });
  });

  it("blocks a DOCX build without a matching authoritative WordPageMap",()=>{const source={editionId:"edition-1",format:"docx"as const,sha256:"c".repeat(64)};const missing=manifest({artifacts:REQUIRED_DERIVED_ARTIFACTS.map(kind=>artifact(kind,kind==="reader"?{sourceEdition:source}:{}))});expect(evaluateBuildReadiness(missing)).toMatchObject({kind:"not-ready",policyBlocked:["authoritative_word_page_map_missing"]});const mismatch=manifest({artifacts:REQUIRED_DERIVED_ARTIFACTS.map(kind=>artifact(kind,kind==="reader"?{sourceEdition:source,wordPageMap:{authoritative:true,engine:"microsoft-word-com",fingerprint:"d".repeat(64),totalPages:2}}:{}))});expect(evaluateBuildReadiness(mismatch)).toMatchObject({kind:"not-ready",policyBlocked:["authoritative_word_page_map_source_mismatch"]});expect(evaluateBuildReadiness(manifest({artifacts:REQUIRED_DERIVED_ARTIFACTS.map(kind=>artifact(kind,kind==="reader"?{sourceEdition:source,wordPageMap:{authoritative:true,engine:"microsoft-word-com",fingerprint:source.sha256,totalPages:2}}:{}))})).kind).toBe("ready")});
});

describe("atomic publication decision", () => {
  it("returns one pointer-swap command covering all artifacts and the revision", () => {
    expect(decideAtomicPublication({
      manifest: manifest(),
      expectedActiveBuildId: "build-1",
      currentActiveBuildId: "build-1",
    })).toEqual({
      kind: "publish",
      expectedActiveBuildId: "build-1",
      nextActiveBuildId: "build-2",
      nextActiveSourceRevisionId: "revision-2",
      activeManifestEtag: '"build-build-2"',
      invalidationOperationId: "publication:book-1:build-2",
      artifactIds: {
        reader: "artifact-reader",
        pdf: "artifact-pdf",
        search: "artifact-search",
        toc: "artifact-toc",
        cover: "artifact-cover",
      },
    });
  });

  it("is idempotent when the target build is already active", () => {
    expect(decideAtomicPublication({
      manifest: manifest({ status: "published" }),
      expectedActiveBuildId: "build-1",
      currentActiveBuildId: "build-2",
    })).toEqual({ kind: "already-published", buildId: "build-2" });
  });

  it("returns a CAS conflict instead of overwriting a concurrently published build", () => {
    expect(decideAtomicPublication({
      manifest: manifest(),
      expectedActiveBuildId: "build-1",
      currentActiveBuildId: "build-other",
    })).toEqual({ kind: "active-build-conflict", currentActiveBuildId: "build-other" });
  });

  it("refuses publication when even one derivative is pending", () => {
    const build = manifest();
    build.artifacts[1] = artifact("pdf", { status: "pending", fingerprint: null, objectKey: null });
    expect(() => decideAtomicPublication({
      manifest: build,
      expectedActiveBuildId: "build-1",
      currentActiveBuildId: "build-1",
    })).toThrow(/incomplete/);
  });
  it("gives rollback/publication targets distinct manifest ETags and invalidation ids",()=>{const forward=decideAtomicPublication({manifest:manifest(),expectedActiveBuildId:"build-1",currentActiveBuildId:"build-1"});const rollbackManifest=manifest({buildId:"build-rollback",sourceRevisionId:"revision-1",artifacts:REQUIRED_DERIVED_ARTIFACTS.map(kind=>artifact(kind,{buildId:"build-rollback",sourceRevisionId:"revision-1"}))});const rollback=decideAtomicPublication({manifest:rollbackManifest,expectedActiveBuildId:"build-2",currentActiveBuildId:"build-2"});expect(forward.kind).toBe("publish");expect(rollback.kind).toBe("publish");if(forward.kind==="publish"&&rollback.kind==="publish"){expect(rollback.activeManifestEtag).not.toBe(forward.activeManifestEtag);expect(rollback.invalidationOperationId).not.toBe(forward.invalidationOperationId)}});
});
