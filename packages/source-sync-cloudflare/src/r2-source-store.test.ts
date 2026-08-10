import { describe, expect, it, vi } from "vitest";
import { R2ImmutableSourceObjectStore } from "./r2-source-store.js";
import type { R2BucketBinding } from "./bindings.js";

describe("R2ImmutableSourceObjectStore", () => {
  it("promotes with If-None-Match semantics and reports dedupe without overwrite", async () => {
    const body = new ReadableStream<Uint8Array>();
    const binding: R2BucketBinding = { head: vi.fn(), get: vi.fn(async () => ({ size: 3, body, arrayBuffer: async () => new ArrayBuffer(3) })),
      put: vi.fn(async () => null), delete: vi.fn() };
    const store = new R2ImmutableSourceObjectStore(binding);
    await expect(store.promoteIfAbsent("staging/a", "sources/book/hash.docx")).resolves.toBe("exists");
    expect(binding.put).toHaveBeenCalledWith("sources/book/hash.docx", body, expect.objectContaining({ onlyIf: { etagDoesNotMatch: "*" } }));
  });
});
