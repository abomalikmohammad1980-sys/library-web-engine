import { describe, expect, it, vi } from "vitest";
import { WorkerHmacStagingGrantIssuer, handleStagingPut } from "./staging-grants.js";
import type { R2BucketBinding } from "./bindings.js";

function bucket(): R2BucketBinding {
  return { head: vi.fn(), get: vi.fn(), put: vi.fn(async () => ({})), delete: vi.fn() };
}
describe("Worker HMAC staging grants", () => {
  it("accepts one exact-length PUT into the grant-bound staging key", async () => {
    const storage = bucket(); const issuer = new WorkerHmacStagingGrantIssuer("https://sync.example/v1/", "secret-key-with-enough-entropy");
    const grant = await issuer.issue({ uploadId: "upload-1", objectKey: "staging/source/upload-1", byteLength: 3,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", expiresAt: "2030-01-01T00:00:00Z" });
    const response = await handleStagingPut(new Request(grant.uploadUrl, { method: "PUT", headers: { "content-length": "3" }, body: new Uint8Array([1, 2, 3]) }),
      { bucket: storage, secret: "secret-key-with-enough-entropy", nowMs: Date.parse("2029-01-01T00:00:00Z") });
    expect(response.status).toBe(204);
    expect(storage.put).toHaveBeenCalledWith("staging/source/upload-1", expect.anything(), expect.objectContaining({ onlyIf: { etagDoesNotMatch: "*" } }));
  });
  it("rejects tampered, expired, and wrong-length grants before R2", async () => {
    const storage = bucket(); const issuer = new WorkerHmacStagingGrantIssuer("https://sync.example/v1/", "secret");
    const grant = await issuer.issue({ uploadId: "upload-1", objectKey: "staging/source/upload-1", byteLength: 3, contentType: "x", expiresAt: "2030-01-01T00:00:00Z" });
    for (const request of [
      new Request(grant.uploadUrl.replace("bytes=3", "bytes=4"), { method: "PUT", headers: { "content-length": "4" }, body: new Uint8Array(4) }),
      new Request(grant.uploadUrl, { method: "PUT", headers: { "content-length": "2" }, body: new Uint8Array(2) }),
    ]) expect((await handleStagingPut(request, { bucket: storage, secret: "secret", nowMs: Date.parse("2029-01-01T00:00:00Z") })).status).toBeGreaterThanOrEqual(400);
    expect((await handleStagingPut(new Request(grant.uploadUrl, { method: "PUT", headers: { "content-length": "3" }, body: new Uint8Array(3) }),
      { bucket: storage, secret: "secret", nowMs: Date.parse("2031-01-01T00:00:00Z") })).status).toBe(403);
    expect(storage.put).not.toHaveBeenCalled();
  });
});
