import { generateKeyPairSync, sign } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildDeploymentArtifactManifest, verifyDeploymentArtifactManifest, verifyDeploymentManifestSignature } from "./deployment-artifact-integrity.js";

const roots: string[] = [];
afterEach(() => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));

describe("deployment artifact integrity", () => {
  it("builds a deterministic manifest, detects byte drift, and verifies an Ed25519 signature", async () => {
    const root = await mkdtemp(join(tmpdir(), "deploy-integrity-"));
    roots.push(root);
    await mkdir(join(root, "assets"));
    await writeFile(join(root, "index.html"), "<h1>الخزانة</h1>");
    await writeFile(join(root, "assets", "app.js"), "console.log('ok')");
    const manifest = await buildDeploymentArtifactManifest(root);
    expect(manifest).toMatchObject({ schemaVersion: 1, fileCount: 2 });
    expect(await verifyDeploymentArtifactManifest(root, manifest)).toEqual(manifest);
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const signature = sign(null, Buffer.from(manifest.manifestChecksumSha256, "hex"), privateKey).toString("base64");
    expect(verifyDeploymentManifestSignature(manifest, signature, publicKey.export({ format: "pem", type: "spki" }).toString())).toBe(true);
    await writeFile(join(root, "assets", "app.js"), "console.log('changed')");
    await expect(verifyDeploymentArtifactManifest(root, manifest)).rejects.toThrow(/mismatch/);
  });

  it("rejects secret-shaped content before a manifest can be approved", async () => {
    const root = await mkdtemp(join(tmpdir(), "deploy-secret-"));
    roots.push(root);
    await writeFile(join(root, "config.js"), `const token = "${"a".repeat(32)}"`);
    await expect(buildDeploymentArtifactManifest(root)).rejects.toThrow(/sensitive_content/);
  });
});
