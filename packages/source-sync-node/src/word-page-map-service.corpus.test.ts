import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createWordPageMapHttpServer, WordPageMapService } from "./word-page-map-service.js";
import { InternalWordMapHttpClient, WordPageMapPipeline, type StoredAuthoritativeWordMap } from "./word-page-map-pipeline.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const SCRIPT = resolve(ROOT, "tools/convert-docx-to-pdf.ps1");
const MINHAJ = resolve(ROOT, "../../كتب للاختبار/منهاج مخيم جيل العزة - المخيم الصيفي لمدة أسبوع.docx");
const TAWHID = resolve(ROOT, "../../كتب للاختبار/توحيد الحاكمية.docx");
const run = process.platform === "win32" && process.env.KHIZANA_WORD_COM_TEST === "1"
  && existsSync(SCRIPT) && existsSync(MINHAJ) && existsSync(TAWHID);

describe.runIf(run)("WordPageMapService — Microsoft Word corpus", () => {
  it("يعيد منهاج 41 وتوحيد الحاكمية 32 ويعالج parts معًا", async () => {
    const service = new WordPageMapService({ scriptPath: SCRIPT, timeoutMs: 5 * 60_000, maxParts: 2 });
    const port = await new Promise<number>((resolvePort, reject) => { const probe = createServer(); probe.once("error", reject);
      probe.listen(0, "127.0.0.1", () => { const address = probe.address(); const selected = typeof address === "object" && address ? address.port : 0;
        probe.close(error => error ? reject(error) : resolvePort(selected)); }); });
    const token = "corpus-internal-word-map-token-00000000";
    const server = createWordPageMapHttpServer({ port, authToken: token, service });
    if (!server.listening) await new Promise<void>(resolveReady => server.once("listening", resolveReady));
    const parts = [readFileSync(MINHAJ), readFileSync(TAWHID)];
    const current = parts.map(bytes => ({ fingerprint: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.byteLength }));
    let committed: StoredAuthoritativeWordMap | undefined;
    const pipeline = new WordPageMapPipeline(new InternalWordMapHttpClient(`http://127.0.0.1:${port}/v1/word-page-map`, token), { commitIfCurrent: async input => {
      if (JSON.stringify(input.expectedParts) !== JSON.stringify(current)) return false;
      committed = input.artifact; return true;
    } }, { timeoutMs: 7 * 60_000, maxAttempts: 1, retryDelayMs: 0 });
    try {
      const result = await pipeline.process({ bookId: "corpus", sourceRevisionId: "corpus-r1", parts });
      expect(result.maps.map(map => map.totalPages)).toEqual([41, 32]);
      expect(result.maps[0]!.starts).toHaveLength(41);
      expect(result.maps[1]!.starts).toHaveLength(32);
      expect(result.sourceParts.every(part => /^[0-9a-f]{64}$/.test(part.fingerprint))).toBe(true);
      expect(committed).toEqual(result);
    } finally { await new Promise<void>(resolveClose => server.close(() => resolveClose())); }
  }, 8 * 60_000);
});
