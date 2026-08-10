import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { DeploymentArtifactManifest } from "./deployment-artifact-integrity.js";
import { promoteDeploymentRelease, rollbackDeploymentRelease } from "./deployment-release-state.js";

function manifest(path: string, checksum: string): DeploymentArtifactManifest {
  const files = [{ path, byteSize: 1, checksumSha256: checksum.repeat(64).slice(0, 64) }];
  const body = { schemaVersion: 1 as const, fileCount: 1, byteSize: 1, files };
  return { ...body, manifestChecksumSha256: createHash("sha256").update(JSON.stringify(body)).digest("hex") };
}

describe("deployment release promotion and rollback", () => {
  it("promotes only a verified candidate under CAS and rolls back to a reverified manifest", () => {
    const v1 = manifest("v1.js", "a"), v2 = manifest("v2.js", "b");
    const first = promoteDeploymentRelease({ current: null, expectedCurrentManifestChecksum: null, releaseId: "release-v1", candidate: v1, candidateSignatureVerified: true, operationId: "operation-v1", promotedAt: "2026-08-09T00:00:00Z" });
    const second = promoteDeploymentRelease({ current: first, expectedCurrentManifestChecksum: v1.manifestChecksumSha256, releaseId: "release-v2", candidate: v2, candidateSignatureVerified: true, operationId: "operation-v2", promotedAt: "2026-08-09T01:00:00Z" });
    expect(second.previous).toMatchObject({ releaseId: "release-v1", manifestChecksumSha256: v1.manifestChecksumSha256 });
    const rolled = rollbackDeploymentRelease({ current: second, expectedCurrentManifestChecksum: v2.manifestChecksumSha256, previousManifest: v1, operationId: "operation-rollback", promotedAt: "2026-08-09T02:00:00Z" });
    expect(rolled).toMatchObject({ releaseId: "release-v1", manifestChecksumSha256: v1.manifestChecksumSha256, previous: { releaseId: "release-v2" } });
  });

  it("fails closed on unsigned promotion, stale CAS, or tampered rollback manifest", () => {
    const v1 = manifest("v1.js", "a"), v2 = manifest("v2.js", "b");
    expect(() => promoteDeploymentRelease({ current: null, expectedCurrentManifestChecksum: null, releaseId: "release-v1", candidate: v1, candidateSignatureVerified: false, operationId: "operation-v1", promotedAt: "2026-08-09T00:00:00Z" })).toThrow(/signature/);
    const first = promoteDeploymentRelease({ current: null, expectedCurrentManifestChecksum: null, releaseId: "release-v1", candidate: v1, candidateSignatureVerified: true, operationId: "operation-v1", promotedAt: "2026-08-09T00:00:00Z" });
    expect(() => promoteDeploymentRelease({ current: first, expectedCurrentManifestChecksum: "0".repeat(64), releaseId: "release-v2", candidate: v2, candidateSignatureVerified: true, operationId: "operation-v2", promotedAt: "2026-08-09T01:00:00Z" })).toThrow(/cas/);
    const second = promoteDeploymentRelease({ current: first, expectedCurrentManifestChecksum: v1.manifestChecksumSha256, releaseId: "release-v2", candidate: v2, candidateSignatureVerified: true, operationId: "operation-v2", promotedAt: "2026-08-09T01:00:00Z" });
    expect(() => rollbackDeploymentRelease({ current: second, expectedCurrentManifestChecksum: v2.manifestChecksumSha256, previousManifest: { ...v1, fileCount: 2 }, operationId: "operation-rollback", promotedAt: "2026-08-09T02:00:00Z" })).toThrow(/manifest/);
  });
});
