import type { SourceFingerprint } from "./contracts.js";
import { normalizeSha256Hex } from "./fingerprint.js";

export type RequiredDerivedArtifactKind = "reader" | "pdf" | "search" | "toc" | "cover";
export type OptionalDerivedArtifactKind = "quran-annotations";
export type DerivedArtifactKind = RequiredDerivedArtifactKind | OptionalDerivedArtifactKind;
export type DerivedArtifactStatus = "pending" | "ready" | "failed" | "quarantined";
export type BookBuildStatus = "staging" | "processing" | "ready" | "published" | "failed";

export interface DerivedArtifact {
  artifactId: string;
  kind: DerivedArtifactKind;
  bookId: string;
  sourceRevisionId: string;
  buildId: string;
  status: DerivedArtifactStatus;
  fingerprint: SourceFingerprint | null;
  objectKey: string | null;
  engineVersion: string;
  /** Provenance carried inside the atomic manifest; never contains source bytes. */
  sourceEdition?: { editionId: string; format: "docx"; sha256: string };
  wordPageMap?: { authoritative: true; engine: "microsoft-word-com"; fingerprint: string; totalPages: number };
  quranAnnotations?: { schemaVersion: 1; corpusVersion: string; corpusChecksum: string; confidence: "exact"; annotationCount: number };
  quranAnnotationDependency?: { artifactId: string; corpusVersion: string; corpusChecksum: string };
}

export interface BookBuildManifest {
  buildId: string;
  bookId: string;
  sourceRevisionId: string;
  status: BookBuildStatus;
  artifacts: DerivedArtifact[];
  createdAt: string;
}

export const REQUIRED_DERIVED_ARTIFACTS: readonly RequiredDerivedArtifactKind[] = [
  "reader",
  "pdf",
  "search",
  "toc",
  "cover",
] as const;

export type BuildReadinessDecision =
  | { kind: "ready"; manifest: BookBuildManifest }
  | {
      kind: "not-ready";
      missing: DerivedArtifactKind[];
      pending: DerivedArtifactKind[];
      failed: DerivedArtifactKind[];
      manifestStatus: BookBuildStatus;
      policyBlocked?: string[];
    };

export type AtomicPublicationDecision =
  | {
      kind: "publish";
      expectedActiveBuildId: string | null;
      nextActiveBuildId: string;
      nextActiveSourceRevisionId: string;
      activeManifestEtag: string;
      invalidationOperationId: string;
      artifactIds: Record<RequiredDerivedArtifactKind, string> & Partial<Record<OptionalDerivedArtifactKind, string>>;
    }
  | { kind: "already-published"; buildId: string }
  | { kind: "active-build-conflict"; currentActiveBuildId: string | null };

export interface RequiredDocxPublicationApproval { bookId:string;sourceRevisionId:string;sourceFingerprint:string;authoritativeWordPageMapFingerprint:string }
export function requiredDocxPublicationApproval(manifest:BookBuildManifest):RequiredDocxPublicationApproval|null { const reader=manifest.artifacts.find(item=>item.kind==="reader");if(reader?.sourceEdition?.format!=="docx")return null;if(!reader.wordPageMap||reader.wordPageMap.fingerprint!==reader.sourceEdition.sha256)throw new Error("DOCX publication requires a matching authoritative Word page map");return{bookId:manifest.bookId,sourceRevisionId:manifest.sourceRevisionId,sourceFingerprint:reader.sourceEdition.sha256,authoritativeWordPageMapFingerprint:reader.wordPageMap.fingerprint} }

export function evaluateBuildReadiness(
  manifest: BookBuildManifest,
  requiredKinds: readonly DerivedArtifactKind[] = REQUIRED_DERIVED_ARTIFACTS,
): BuildReadinessDecision {
  validateManifestIdentity(manifest);
  const required = uniqueRequiredKinds(requiredKinds);
  const byKind = new Map<DerivedArtifactKind, DerivedArtifact>();
  for (const artifact of manifest.artifacts) {
    validateArtifact(artifact, manifest);
    if (byKind.has(artifact.kind)) throw new Error(`Duplicate build artifact kind: ${artifact.kind}`);
    byKind.set(artifact.kind, artifact);
  }
  validateQuranSearchDependency(byKind);
  const policyBlocked = docxPaginationPolicyBlocks(byKind);

  const missing: DerivedArtifactKind[] = [];
  const pending: DerivedArtifactKind[] = [];
  const failed: DerivedArtifactKind[] = [];
  for (const kind of required) {
    const artifact = byKind.get(kind);
    if (artifact === undefined) missing.push(kind);
    else if (artifact.status === "pending") pending.push(kind);
    else if (artifact.status === "failed" || artifact.status === "quarantined") failed.push(kind);
  }
  if ((manifest.status !== "ready" && manifest.status !== "published")
    || missing.length > 0 || pending.length > 0 || failed.length > 0 || policyBlocked.length > 0) {
    return { kind: "not-ready", missing, pending, failed, manifestStatus: manifest.status, ...(policyBlocked.length ? { policyBlocked } : {}) };
  }
  return { kind: "ready", manifest };
}

function docxPaginationPolicyBlocks(byKind: ReadonlyMap<DerivedArtifactKind, DerivedArtifact>): string[] {
  const reader = byKind.get("reader");
  if (reader?.sourceEdition?.format !== "docx") return [];
  if (!reader.wordPageMap) return ["authoritative_word_page_map_missing"];
  if (reader.wordPageMap.fingerprint !== reader.sourceEdition.sha256) return ["authoritative_word_page_map_source_mismatch"];
  return [];
}

function validateQuranSearchDependency(byKind: ReadonlyMap<DerivedArtifactKind, DerivedArtifact>): void {
  const dependency = byKind.get("search")?.quranAnnotationDependency;
  if (!dependency) return;
  const annotations = byKind.get("quran-annotations");
  if (annotations?.status !== "ready" || annotations.artifactId !== dependency.artifactId
    || annotations.quranAnnotations?.corpusVersion !== dependency.corpusVersion
    || annotations.quranAnnotations.corpusChecksum !== dependency.corpusChecksum) {
    throw new Error("Quran annotation search dependency does not match the immutable annotation artifact");
  }
}

/**
 * Produces the single pointer-swap command a persistence adapter must commit in
 * one transaction. It never writes individual artifact pointers.
 */
export function decideAtomicPublication(input: {
  manifest: BookBuildManifest;
  expectedActiveBuildId: string | null;
  currentActiveBuildId: string | null;
}): AtomicPublicationDecision {
  const readiness = evaluateBuildReadiness(input.manifest);
  if (readiness.kind !== "ready") throw new Error("Cannot publish an incomplete build manifest");
  if (input.currentActiveBuildId === input.manifest.buildId) {
    return { kind: "already-published", buildId: input.manifest.buildId };
  }
  if (input.currentActiveBuildId !== input.expectedActiveBuildId) {
    return { kind: "active-build-conflict", currentActiveBuildId: input.currentActiveBuildId };
  }
  const artifactIds = {} as Record<RequiredDerivedArtifactKind, string> & Partial<Record<OptionalDerivedArtifactKind,string>>;
  for (const artifact of input.manifest.artifacts) artifactIds[artifact.kind] = artifact.artifactId;
  return {
    kind: "publish",
    expectedActiveBuildId: input.expectedActiveBuildId,
    nextActiveBuildId: input.manifest.buildId,
    nextActiveSourceRevisionId: input.manifest.sourceRevisionId,
    activeManifestEtag: `"build-${input.manifest.buildId}"`,
    invalidationOperationId: `publication:${input.manifest.bookId}:${input.manifest.buildId}`,
    artifactIds,
  };
}

function validateManifestIdentity(manifest: BookBuildManifest): void {
  if (manifest.buildId.trim() === "" || manifest.bookId.trim() === ""
    || manifest.sourceRevisionId.trim() === "") {
    throw new Error("Build manifest identifiers cannot be empty");
  }
}

function validateArtifact(artifact: DerivedArtifact, manifest: BookBuildManifest): void {
  if (artifact.artifactId.trim() === "" || artifact.engineVersion.trim() === "") {
    throw new Error("Artifact identifiers and engineVersion cannot be empty");
  }
  if (artifact.bookId !== manifest.bookId
    || artifact.sourceRevisionId !== manifest.sourceRevisionId
    || artifact.buildId !== manifest.buildId) {
    throw new Error("Every artifact must belong to the manifest book/revision/build");
  }
  if (artifact.status === "ready") {
    if (artifact.fingerprint === null || artifact.objectKey === null || artifact.objectKey.trim() === "") {
      throw new Error("A ready artifact requires fingerprint and objectKey");
    }
    normalizeSha256Hex(artifact.fingerprint.hex);
    if (artifact.fingerprint.algorithm !== "sha256"
      || !Number.isSafeInteger(artifact.fingerprint.byteLength)
      || artifact.fingerprint.byteLength < 0) {
      throw new Error("A ready artifact requires a valid SHA-256 fingerprint");
    }
  }
  if (artifact.sourceEdition) {
    if (!artifact.sourceEdition.editionId.trim() || artifact.sourceEdition.format !== "docx"
      || !/^[a-f0-9]{64}$/.test(artifact.sourceEdition.sha256)) throw new Error("Invalid source edition provenance");
  }
  if (artifact.wordPageMap && (artifact.kind !== "reader" || artifact.wordPageMap.authoritative !== true
    || artifact.wordPageMap.engine !== "microsoft-word-com" || !/^[a-f0-9]{64}$/.test(artifact.wordPageMap.fingerprint)
    || !Number.isSafeInteger(artifact.wordPageMap.totalPages) || artifact.wordPageMap.totalPages < 1)) {
    throw new Error("Invalid authoritative Word page map provenance");
  }
  if (artifact.quranAnnotations && (artifact.kind !== "quran-annotations" || artifact.quranAnnotations.schemaVersion !== 1
    || artifact.quranAnnotations.confidence !== "exact" || !artifact.quranAnnotations.corpusVersion.trim()
    || !/^[a-f0-9]{64}$/.test(artifact.quranAnnotations.corpusChecksum)
    || !Number.isSafeInteger(artifact.quranAnnotations.annotationCount) || artifact.quranAnnotations.annotationCount < 0)) {
    throw new Error("Invalid Quran annotation provenance");
  }
  if (artifact.kind === "quran-annotations" && !artifact.quranAnnotations) throw new Error("Quran annotations require versioned provenance");
  if (artifact.quranAnnotationDependency && (artifact.kind !== "search" || !artifact.quranAnnotationDependency.artifactId.trim()
    || !artifact.quranAnnotationDependency.corpusVersion.trim() || !/^[a-f0-9]{64}$/.test(artifact.quranAnnotationDependency.corpusChecksum))) {
    throw new Error("Invalid Quran annotation search dependency");
  }
}

function uniqueRequiredKinds(kinds: readonly DerivedArtifactKind[]): DerivedArtifactKind[] {
  const unique = [...new Set(kinds)];
  if (unique.length !== kinds.length) throw new Error("Required artifact kinds must be unique");
  return unique;
}
