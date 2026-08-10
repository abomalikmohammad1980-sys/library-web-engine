import { describe, expect, it, vi } from "vitest";
import { HttpSourceRevisionApi, SourceSyncApiError, type SourceRevisionUploadRequest } from "./source-sync-api-client.js";

const request: SourceRevisionUploadRequest = {
  operationId: "operation-1", bookId: "book-1", baseRevisionId: null,
  fingerprint: { algorithm: "sha256", hex: "a".repeat(64), byteLength: 3 },
  sourceName: "book.docx", deviceId: "device-1",
};

describe("HttpSourceRevisionApi", () => {
  it("authenticates metadata calls but never forwards the bearer token to object storage", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input); calls.push({ url, init });
      if (url.endsWith("/source-revisions/uploads")) {
        return Response.json({ kind: "upload", uploadId: "upload-1", uploadUrl: "https://objects.example/signed", expiresAt: "2030-01-01T00:00:00Z" });
      }
      if (url === "https://objects.example/signed") return new Response(null, { status: 200 });
      return Response.json({ kind: "accepted", revision: {} });
    });
    const api = new HttpSourceRevisionApi("https://api.example/v1/", async () => "secret", fetchImpl);
    const plan = await api.prepareUpload(request);
    expect(plan.kind).toBe("upload");
    if (plan.kind !== "upload") throw new Error("expected upload plan");
    await api.uploadBytes(plan, new Uint8Array([1, 2, 3]));
    await api.finalizeUpload(plan.uploadId, request);

    expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe("Bearer secret");
    expect(new Headers(calls[1]?.init?.headers).get("authorization")).toBeNull();
    expect(new Headers(calls[2]?.init?.headers).get("authorization")).toBe("Bearer secret");
    expect(JSON.parse(String(calls[0]?.init?.body))).not.toHaveProperty("ownerId");
  });

  it("classifies throttling as retryable and authorization denial as permanent", async () => {
    for (const [status, retryable] of [[429, true], [403, false]] as const) {
      const api = new HttpSourceRevisionApi("https://api.example/v1/", async () => "secret",
        vi.fn(async () => new Response(null, { status })));
      const error = await api.prepareUpload(request).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(SourceSyncApiError);
      expect(error).toMatchObject({ status, retryable });
    }
  });

  it("does not propagate an untrusted server error string into CLI-visible errors", async () => {
    const secret = "https://objects.example/signed?token=seeded-secret";
    const api = new HttpSourceRevisionApi("https://api.example/v1/", async () => "user-token",
      vi.fn(async () => Response.json({ error: { code: secret } }, { status: 500 })));
    const error = await api.prepareUpload(request).catch((caught: unknown) => caught) as SourceSyncApiError;
    expect(error.code).toBe("source_sync_api_failed");
    expect(JSON.stringify(error)).not.toContain(secret);
  });

  it("parses Retry-After and aborts a request at the injected timeout",async()=>{
    const throttled=new HttpSourceRevisionApi("https://api.example/",async()=>"token",vi.fn(async()=>new Response(null,{status:429,headers:{"retry-after":"7"}})));
    await expect(throttled.prepareUpload(request)).rejects.toMatchObject({status:429,retryable:true,retryAfterMs:7000});
    const hanging=new HttpSourceRevisionApi("https://api.example/",async()=>"token",vi.fn(async(_input,init)=>new Promise<Response>((_resolve,reject)=>init?.signal?.addEventListener("abort",()=>reject(init.signal?.reason),{once:true}))),5);
    await expect(hanging.prepareUpload(request)).rejects.toMatchObject({name:"TimeoutError"});
  });

  it("classifies prepare, partial PUT, and finalize failures without hidden mutation retries",async()=>{
    for(const status of [408,409,429,500,503]){
      const calls=vi.fn(async()=>new Response(null,{status,headers:{"retry-after":"2"}}));
      const api=new HttpSourceRevisionApi("https://api.example/",async()=>"token",calls);
      const error=await api.prepareUpload(request).catch(e=>e);
      expect(error).toMatchObject({status,retryable:status!==409,retryAfterMs:2000});
      expect(calls).toHaveBeenCalledOnce();
    }
    const put=vi.fn(async()=>new Response(null,{status:503,headers:{"retry-after":"3"}}));
    const api=new HttpSourceRevisionApi("https://api.example/",async()=>"token",put);
    const plan={kind:"upload" as const,uploadId:"u",uploadUrl:"https://objects.example/signed",expiresAt:"2030-01-01"};
    await expect(api.uploadBytes(plan,new Uint8Array([1,2,3]))).rejects.toMatchObject({code:"staging_upload_failed",status:503,retryable:true,retryAfterMs:3000});
    expect(put).toHaveBeenCalledOnce();
  });
});
