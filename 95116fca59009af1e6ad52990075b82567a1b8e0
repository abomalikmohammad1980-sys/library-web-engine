import type { SourceFingerprint } from "./contracts.js";

export async function sha256Fingerprint(
  bytes: Uint8Array | ArrayBuffer,
): Promise<SourceFingerprint> {
  const input = bytes instanceof Uint8Array
    ? new Uint8Array(bytes).buffer
    : bytes.slice(0);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input);
  return {
    algorithm: "sha256",
    hex: bytesToHex(new Uint8Array(digest)),
    byteLength: input.byteLength,
  };
}

export function normalizeSha256Hex(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error("SHA-256 fingerprint must contain exactly 64 hexadecimal characters");
  }
  return normalized;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}
