import { createHash } from "node:crypto";
import type { DeploymentArtifactManifest } from "./deployment-artifact-integrity.js";

export interface DeploymentReleasePointer {
  schemaVersion: 1;
  releaseId: string;
  manifestChecksumSha256: string;
  promotedAt: string;
  operationId: string;
  previous: { releaseId: string; manifestChecksumSha256: string; promotedAt: string } | null;
}

export function promoteDeploymentRelease(input: {
  current: DeploymentReleasePointer | null;
  expectedCurrentManifestChecksum: string | null;
  releaseId: string;
  candidate: DeploymentArtifactManifest;
  candidateSignatureVerified: boolean;
  operationId: string;
  promotedAt: string;
}): DeploymentReleasePointer {
  validateIdentity(input.releaseId, input.operationId, input.promotedAt);
  validateManifest(input.candidate);
  if (!input.candidateSignatureVerified) throw Error("deployment_release_signature_required");
  if ((input.current?.manifestChecksumSha256 ?? null) !== input.expectedCurrentManifestChecksum) throw Error("deployment_release_cas_conflict");
  if (input.current?.operationId === input.operationId) return input.current;
  if (input.current?.manifestChecksumSha256 === input.candidate.manifestChecksumSha256) throw Error("deployment_release_duplicate_artifact");
  return {
    schemaVersion: 1,
    releaseId: input.releaseId,
    manifestChecksumSha256: input.candidate.manifestChecksumSha256,
    promotedAt: input.promotedAt,
    operationId: input.operationId,
    previous: input.current ? { releaseId: input.current.releaseId, manifestChecksumSha256: input.current.manifestChecksumSha256, promotedAt: input.current.promotedAt } : null,
  };
}

export function rollbackDeploymentRelease(input: {
  current: DeploymentReleasePointer;
  expectedCurrentManifestChecksum: string;
  previousManifest: DeploymentArtifactManifest;
  operationId: string;
  promotedAt: string;
}): DeploymentReleasePointer {
  validateIdentity(input.current.releaseId, input.operationId, input.promotedAt);
  validateManifest(input.previousManifest);
  if (input.current.manifestChecksumSha256 !== input.expectedCurrentManifestChecksum) throw Error("deployment_release_cas_conflict");
  if (!input.current.previous || input.previousManifest.manifestChecksumSha256 !== input.current.previous.manifestChecksumSha256) throw Error("deployment_release_rollback_manifest_mismatch");
  return {
    schemaVersion: 1,
    releaseId: input.current.previous.releaseId,
    manifestChecksumSha256: input.current.previous.manifestChecksumSha256,
    promotedAt: input.promotedAt,
    operationId: input.operationId,
    previous: { releaseId: input.current.releaseId, manifestChecksumSha256: input.current.manifestChecksumSha256, promotedAt: input.current.promotedAt },
  };
}

function validateIdentity(releaseId: string, operationId: string, timestamp: string) {
  if (!/^[a-z0-9][a-z0-9._-]{2,79}$/i.test(releaseId) || !/^[a-z0-9][a-z0-9._-]{7,127}$/i.test(operationId) || !Number.isFinite(Date.parse(timestamp))) throw Error("deployment_release_identity_invalid");
}
function validateManifest(manifest: DeploymentArtifactManifest) {
  const { manifestChecksumSha256: _checksum, ...body } = manifest;
  const checksum = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  if (checksum !== manifest.manifestChecksumSha256 || manifest.fileCount !== manifest.files.length || manifest.byteSize !== manifest.files.reduce((sum, file) => sum + file.byteSize, 0)) throw Error("deployment_release_manifest_invalid");
}
