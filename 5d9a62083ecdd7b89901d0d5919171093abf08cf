import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { WordMapResult } from "./word-page-map-service.js";
import { InternalWordMapHttpClient, WordMapPipelineError, WordPageMapPipeline, type StoredAuthoritativeWordMap, type WordMapArtifactStore } from "./word-page-map-pipeline.js";

const docx = (marker: number): Uint8Array => new Uint8Array([0x50, 0x4b, 3, 4, marker]);
const fp = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const result = (parts: readonly Uint8Array[], totals = parts.map(() => 2)): WordMapResult => ({ schemaVersion: 1, authoritative: true,
  engine: "microsoft-word-com", fingerprint: "f".repeat(64), parts: parts.map((bytes, index) => ({ fingerprint: fp(bytes), bytes: bytes.byteLength,
    map: { totalPages: totals[index]!, paragraphCount: 2, starts: [
      { paragraphIndex: 0, physicalPage: 1, adjustedPage: 1 }, { paragraphIndex: 1, physicalPage: 2, adjustedPage: 2 }] } })) });

class AtomicStore implements WordMapArtifactStore {
  currentRevision = "r1"; currentParts: Array<{fingerprint:string;bytes:number}> = []; saved: StoredAuthoritativeWordMap | null = null;
  async commitIfCurrent(input: Parameters<WordMapArtifactStore["commitIfCurrent"]>[0]) {
    if (this.currentRevision !== input.sourceRevisionId || JSON.stringify(this.currentParts) !== JSON.stringify(input.expectedParts)) return false;
    this.saved = structuredClone(input.artifact); return true;
  }
}

describe("WordPageMapPipeline", () => {
  it("يحفظ أجزاء متعددة ذريًا فقط لبصمة النسخة الحالية ويعيد المحاولة", async () => {
    const parts = [docx(1), docx(2)]; const store = new AtomicStore(); store.currentParts = parts.map(bytes => ({ fingerprint: fp(bytes), bytes: bytes.byteLength }));
    const build = vi.fn().mockRejectedValueOnce(new Error("temporary")).mockResolvedValue(result(parts));
    const pipeline = new WordPageMapPipeline({ build }, store, { timeoutMs: 100, maxAttempts: 2, retryDelayMs: 0 }, () => new Date("2026-08-08T00:00:00Z"));
    const saved = await pipeline.process({ bookId: "b1", sourceRevisionId: "r1", parts });
    expect(build).toHaveBeenCalledTimes(2); expect(saved.maps).toHaveLength(2); expect(store.saved).toEqual(saved);
    expect(saved.sourceParts.map(item => item.fingerprint)).toEqual(parts.map(fp));
  });

  it("يرفض نتيجة قديمة إذا تعدل المصدر أثناء التحويل ولا يكتب artifact", async () => {
    const parts = [docx(1)]; const store = new AtomicStore(); store.currentParts = parts.map(bytes => ({ fingerprint: fp(bytes), bytes: bytes.byteLength }));
    const pipeline = new WordPageMapPipeline({ build: async () => { store.currentRevision = "r2"; return result(parts); } }, store,
      { timeoutMs: 100, maxAttempts: 1, retryDelayMs: 0 });
    await expect(pipeline.process({ bookId: "b1", sourceRevisionId: "r1", parts })).rejects.toMatchObject({ code: "stale_source", retryable: false });
    expect(store.saved).toBeNull();
  });

  it("يرفض بصمة جزء غير مطابقة حتى لو قالت الخدمة authoritative", async () => {
    const parts = [docx(1)]; const store = new AtomicStore(); store.currentParts = parts.map(bytes => ({ fingerprint: fp(bytes), bytes: bytes.byteLength }));
    const stale = result([docx(9)]);
    const pipeline = new WordPageMapPipeline({ build: async () => stale }, store, { timeoutMs: 100, maxAttempts: 1, retryDelayMs: 0 });
    await expect(pipeline.process({ bookId: "b1", sourceRevisionId: "r1", parts })).rejects.toBeInstanceOf(WordMapPipelineError);
    expect(store.saved).toBeNull();
  });

  it("يفرض مهلة صلبة ولا يسمح بعنوان HTTP عام", async () => {
    expect(() => new InternalWordMapHttpClient("http://example.com/map", "x".repeat(32))).toThrow(WordMapPipelineError);
    const parts = [docx(1)]; const store = new AtomicStore(); store.currentParts = parts.map(bytes => ({ fingerprint: fp(bytes), bytes: bytes.byteLength }));
    const pipeline = new WordPageMapPipeline({ build: () => new Promise<WordMapResult>(() => undefined) }, store,
      { timeoutMs: 5, maxAttempts: 1, retryDelayMs: 0 });
    await expect(pipeline.process({ bookId: "b1", sourceRevisionId: "r1", parts })).rejects.toMatchObject({ code: "word_map_unavailable", retryable: true });
  });
});
