import type { ImmutableSourceObjectStore } from "../../source-sync-server/src/index.js";
import type { R2BucketBinding } from "./bindings.js";

export class R2ImmutableSourceObjectStore implements ImmutableSourceObjectStore {
  constructor(private readonly bucket: R2BucketBinding) {}
  async stat(key: string) { const item = await this.bucket.head(key); return item === null ? null : { byteLength: item.size }; }
  async read(key: string) { const item = await this.bucket.get(key); if (item === null) throw new Error("R2 source object missing"); return new Uint8Array(await item.arrayBuffer()); }
  async promoteIfAbsent(stagingKey: string, immutableKey: string): Promise<"created" | "exists"> {
    const source = await this.bucket.get(stagingKey); if (source === null) throw new Error("R2 staging object missing");
    const created = await this.bucket.put(immutableKey, source.body, { onlyIf: { etagDoesNotMatch: "*" },
      httpMetadata: { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } });
    return created === null ? "exists" : "created";
  }
  delete(key: string) { return this.bucket.delete(key); }
}
