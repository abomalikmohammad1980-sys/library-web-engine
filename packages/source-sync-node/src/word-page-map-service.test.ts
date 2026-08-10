import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createWordPageMapHttpServer, isValidAuthoritativeWordPageMap, WordMapServiceError, WordPageMapService } from "./word-page-map-service.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
const docx = (size = 8): Uint8Array => { const value = new Uint8Array(size); value.set([0x50, 0x4b, 3, 4]); return value };
const map = { totalPages: 2, paragraphCount: 3,
  starts: [{ paragraphIndex: 0, physicalPage: 1, adjustedPage: 1 }, { paragraphIndex: 2, physicalPage: 2, adjustedPage: 2 }] };

describe("WordPageMapService", () => {
  it("يعيد خرائط موثقة وبصمات مستقرة وينظف مجلد الطلب", async () => {
    const root = await mkdtemp(join(tmpdir(), "word-map-test-")); roots.push(root);
    let requestDir = "";
    const service = new WordPageMapService({ scriptPath: "unused", tempRoot: root,
      runner: async paths => { requestDir = paths.input.slice(0, paths.input.lastIndexOf("\\") + 1 || paths.input.lastIndexOf("/") + 1); await writeFile(paths.mapPath, JSON.stringify(map)); } });
    const first = docx(), second = docx(9); second[8] = 7;
    const result = await service.build([first, second]);
    expect(result.authoritative).toBe(true); expect(result.engine).toBe("microsoft-word-com");
    expect(result.parts.map(part => part.map.totalPages)).toEqual([2, 2]);
    expect(result.parts[0]!.fingerprint).toBe(createHash("sha256").update(first).digest("hex"));
    expect(JSON.stringify(result)).not.toMatch(/[A-Z]:\\|source\.docx|khizana-word-map-/i);
    expect(await readdir(root)).toEqual([]);
    expect(requestDir).not.toBe("");
  });

  it("يرفض التوقيع والحجم وعدد الأجزاء قبل تشغيل Word", async () => {
    let calls = 0;
    const service = new WordPageMapService({ scriptPath: "unused", maxPartBytes: 8, maxTotalBytes: 12, maxParts: 2,
      runner: async () => { calls++; } });
    await expect(service.build([new Uint8Array([1, 2, 3, 4])])).rejects.toMatchObject({ code: "invalid_request" });
    await expect(service.build([docx(9)])).rejects.toMatchObject({ code: "too_large" });
    await expect(service.build([docx(8), docx(8)])).rejects.toMatchObject({ code: "too_large" });
    await expect(service.build([docx(), docx(), docx()])).rejects.toMatchObject({ code: "invalid_request" });
    expect(calls).toBe(0);
  });

  it("يرفض خريطة ناقصة بدل وسمها authoritative", async () => {
    const service = new WordPageMapService({ scriptPath: "unused", runner: async paths => {
      await writeFile(paths.mapPath, JSON.stringify({ ...map, totalPages: 3 }));
    } });
    await expect(service.build([docx()])).rejects.toBeInstanceOf(WordMapServiceError);
  });

  it("يقبل الورقة الفارغة كسجل pages بلا بداية فقرة ويرفض أي تناقض", async () => {
    const blank = { totalPages: 3, paragraphCount: 3,
      starts: [
        { paragraphIndex: 0, physicalPage: 1, adjustedPage: 1 },
        { paragraphIndex: 2, physicalPage: 3, adjustedPage: 3 },
      ],
      pages: [
        { physicalPage: 1, adjustedPage: 1, firstParagraphIndex: 0, lastParagraphIndex: 1, firstText: "أ", lastText: "ب" },
        { physicalPage: 2, adjustedPage: 2, firstParagraphIndex: -1, lastParagraphIndex: -1, firstText: "", lastText: "" },
        { physicalPage: 3, adjustedPage: 3, firstParagraphIndex: 2, lastParagraphIndex: 2, firstText: "ج", lastText: "ج" },
      ],
      paragraphs: [
        { paragraphIndex: 0, physicalPage: 1, adjustedPage: 1, text: "أ" },
        { paragraphIndex: 1, physicalPage: 1, adjustedPage: 1, text: "ب" },
        { paragraphIndex: 2, physicalPage: 3, adjustedPage: 3, text: "ج" },
      ],
    };
    expect(isValidAuthoritativeWordPageMap(blank)).toBe(true);
    expect(isValidAuthoritativeWordPageMap({ ...blank,
      starts: [...blank.starts, { paragraphIndex: 2, physicalPage: 2, adjustedPage: 2 }] })).toBe(false);
    expect(isValidAuthoritativeWordPageMap({ ...blank, pages: blank.pages.slice(0, 2) })).toBe(false);
    expect(isValidAuthoritativeWordPageMap({ ...blank, pages: blank.pages.map((page, index) =>
      index === 1 ? { ...page, firstText: "نص مزعوم" } : page) })).toBe(false);
    const service = new WordPageMapService({ scriptPath: "unused", runner: async paths => {
      await writeFile(paths.mapPath, JSON.stringify(blank));
    } });
    const result = await service.build([docx()]);
    expect(result.parts[0]!.map.pages?.[1]).toMatchObject({ physicalPage: 2, firstParagraphIndex: -1 });
  });

  it("ينهي الطلب المتعطل بمهلة ثابتة وينظف مجلده", async () => {
    const root = await mkdtemp(join(tmpdir(), "word-map-timeout-")); roots.push(root);
    const service = new WordPageMapService({ scriptPath: "unused", tempRoot: root, timeoutMs: 10,
      runner: () => new Promise<void>(() => undefined) });
    await expect(service.build([docx()])).rejects.toMatchObject({ code: "timeout", status: 504 });
    expect(await readdir(root)).toEqual([]);
  });

  it("لا يقبل منفذ API المحقون إلا بمفتاح Bearer ويعيد عقدًا بلا تسريب", async () => {
    const token = "a".repeat(32);
    const service = new WordPageMapService({ scriptPath: "unused", runner: async paths => {
      await writeFile(paths.mapPath, JSON.stringify(map));
    } });
    const server = createWordPageMapHttpServer({ port: 32179, authToken: token, service });
    try {
      if (!server.listening) await new Promise<void>(resolve => server.once("listening", resolve));
      const url = "http://127.0.0.1:32179/v1/word-page-map";
      const denied = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ parts: [] }) });
      expect(denied.status).toBe(401);
      expect(await denied.json()).toEqual({ error: "unauthorized" });
      const health = await fetch(url, { method: "HEAD", headers: { authorization: `Bearer ${token}` } });
      expect(health.status).toBe(204);
      const response = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ parts: [Buffer.from(docx()).toString("base64")] }) });
      expect(response.status).toBe(200);
      const body = await response.json() as { authoritative: boolean; fingerprint: string; parts: unknown[] };
      expect(body.authoritative).toBe(true); expect(body.parts).toHaveLength(1);
      expect(body.fingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify(body)).not.toMatch(/[A-Z]:\\|source\.docx|khizana-word-map-/i);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
