import type { StagingUploadGrantIssuer } from "../../source-sync-server/src/index.js";
import type { R2BucketBinding } from "./bindings.js";

const encoder = new TextEncoder();
export class WorkerHmacStagingGrantIssuer implements StagingUploadGrantIssuer {
  constructor(private readonly publicBaseUrl: string, private readonly secret: string) {}
  async issue(input: { uploadId: string; objectKey: string; byteLength: number; contentType: string; expiresAt: string }) {
    const expires = Date.parse(input.expiresAt); const token = await sign(this.secret, grantMessage(input.uploadId, input.objectKey, input.byteLength, expires));
    const url = new URL(`source-revisions/uploads/${encodeURIComponent(input.uploadId)}/bytes`, this.publicBaseUrl);
    url.searchParams.set("expires", String(expires)); url.searchParams.set("bytes", String(input.byteLength)); url.searchParams.set("token", token);
    return { uploadUrl: url.toString() };
  }
}

export async function handleStagingPut(request: Request, input: { bucket: R2BucketBinding; secret: string; nowMs?: number }): Promise<Response> {
  const url = new URL(request.url); const match = url.pathname.match(/\/source-revisions\/uploads\/([^/]+)\/bytes$/);
  if (request.method !== "PUT" || !match?.[1]) return new Response(null, { status: 404 });
  const uploadId = decodeURIComponent(match[1]); const expires = Number(url.searchParams.get("expires")); const byteLength = Number(url.searchParams.get("bytes"));
  const token = url.searchParams.get("token") ?? ""; const objectKey = `staging/source/${uploadId}`;
  if (!Number.isSafeInteger(expires) || expires < (input.nowMs ?? Date.now()) || !Number.isSafeInteger(byteLength) || byteLength < 0) return error("invalid_or_expired_grant", 403);
  if (!await verify(input.secret, grantMessage(uploadId, objectKey, byteLength, expires), token)) return error("invalid_grant", 403);
  const declared = Number(request.headers.get("content-length"));
  if (declared !== byteLength || request.body === null) return error("content_length_mismatch", 422);
  const stored = await input.bucket.put(objectKey, request.body, { onlyIf: { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }, customMetadata: { uploadId, expectedBytes: String(byteLength) } });
  return stored === null ? error("upload_already_exists", 409) : new Response(null, { status: 204 });
}

function grantMessage(uploadId: string, key: string, bytes: number, expires: number) { return `${uploadId}\n${key}\n${bytes}\n${expires}`; }
async function key(secret: string, usage: KeyUsage[]) { return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usage); }
async function sign(secret: string, value: string) { return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret, ["sign"]), encoder.encode(value)))); }
async function verify(secret: string, value: string, token: string) { try { return crypto.subtle.verify("HMAC", await key(secret, ["verify"]), fromBase64url(token), encoder.encode(value)); } catch { return false; } }
function base64url(bytes: Uint8Array) { let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }
function fromBase64url(value: string) { const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(binary, (char) => char.charCodeAt(0)); }
function error(code: string, status: number) { return Response.json({ error: { code } }, { status, headers: { "cache-control": "no-store" } }); }
