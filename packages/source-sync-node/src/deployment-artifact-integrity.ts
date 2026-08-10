import { createHash, verify as verifySignature } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

export interface DeploymentArtifactManifest {
  schemaVersion: 1;
  fileCount: number;
  byteSize: number;
  files: readonly { path: string; byteSize: number; checksumSha256: string }[];
  manifestChecksumSha256: string;
}

export async function buildDeploymentArtifactManifest(rootDirectory: string): Promise<DeploymentArtifactManifest> {
  const root = resolve(rootDirectory);
  const files: { path: string; byteSize: number; checksumSha256: string }[] = [];
  await walk(root, root, files);
  files.sort((a, b) => a.path.localeCompare(b.path, "en"));
  const body = { schemaVersion: 1 as const, fileCount: files.length, byteSize: files.reduce((sum, file) => sum + file.byteSize, 0), files };
  return { ...body, manifestChecksumSha256: hash(JSON.stringify(body)) };
}

export async function verifyDeploymentArtifactManifest(rootDirectory: string, expected: DeploymentArtifactManifest) {
  const actual = await buildDeploymentArtifactManifest(rootDirectory);
  if (actual.manifestChecksumSha256 !== expected.manifestChecksumSha256 || actual.fileCount !== expected.fileCount || actual.byteSize !== expected.byteSize) throw Error("deployment_artifact_integrity_mismatch");
  return actual;
}

export function verifyDeploymentManifestSignature(manifest: DeploymentArtifactManifest, signatureBase64: string, publicKeyPem: string) {
  if (!signatureBase64 || !publicKeyPem.includes("PUBLIC KEY")) throw Error("deployment_artifact_signature_invalid");
  const { manifestChecksumSha256: _checksum, ...body } = manifest;
  if (hash(JSON.stringify(body)) !== manifest.manifestChecksumSha256) throw Error("deployment_artifact_manifest_tampered");
  if (!verifySignature(null, Buffer.from(manifest.manifestChecksumSha256, "hex"), publicKeyPem, Buffer.from(signatureBase64, "base64"))) throw Error("deployment_artifact_signature_invalid");
  return true;
}

async function walk(root: string, directory: string, files: { path: string; byteSize: number; checksumSha256: string }[]) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = resolve(directory, entry.name);
    if (absolute !== root && !absolute.startsWith(root + sep)) throw Error("deployment_artifact_path_escape");
    const metadata = await lstat(absolute);
    if (metadata.isSymbolicLink()) throw Error("deployment_artifact_symlink_rejected");
    if (metadata.isDirectory()) { await walk(root, absolute, files); continue; }
    if (!metadata.isFile()) throw Error("deployment_artifact_file_type_rejected");
    const bytes = await readFile(absolute);
    scan(relative(root, absolute).replaceAll("\\", "/"), bytes);
    files.push({ path: relative(root, absolute).replaceAll("\\", "/"), byteSize: bytes.length, checksumSha256: hash(bytes) });
  }
}

function scan(path: string, bytes: Buffer) {
  if (bytes.length > 50 * 1024 * 1024) throw Error("deployment_artifact_file_too_large");
  if (!/\.(?:html?|css|js|mjs|json|xml|txt|md|webmanifest|svg)$/i.test(path)) return;
  const text = bytes.toString("utf8");
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|secret|token)\s*[:=]\s*["'][A-Za-z0-9_\-]{20,}["']|[A-Z]:\\Users\\/i.test(text)) throw Error(`deployment_artifact_sensitive_content:${path}`);
}

function hash(value: string | Uint8Array) { return createHash("sha256").update(value).digest("hex"); }
