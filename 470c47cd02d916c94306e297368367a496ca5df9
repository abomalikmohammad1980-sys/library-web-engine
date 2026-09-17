import { createHash } from "node:crypto";
import { isValidAuthoritativeWordPageMap, type AuthoritativeWordPageMap, type WordMapResult } from "./word-page-map-service.js";

export class WordPageMapClientError extends Error {
  constructor(readonly code: string, readonly retryable: boolean) { super(code); this.name = "WordPageMapClientError"; }
}
export interface WordPageMapClientOptions { endpoint: string | URL; serviceToken: () => Promise<string>; timeoutMs: number; maxResponseBytes: number; fetchImpl?: typeof fetch }

export class WordPageMapClient {
  constructor(private readonly options: WordPageMapClientOptions) {}
  async health(): Promise<boolean> {
    try { const response = await this.request({ method: "HEAD" }); return response.status === 204; } catch { return false; }
  }
  async build(docx: Uint8Array): Promise<{ map: AuthoritativeWordPageMap; fingerprint: string }> {
    const response = await this.request({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ parts: [Buffer.from(docx).toString("base64")] }) });
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > this.options.maxResponseBytes) throw new WordPageMapClientError("word_map_too_large", false);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > this.options.maxResponseBytes) throw new WordPageMapClientError("word_map_too_large", false);
    let result: WordMapResult; try { result = JSON.parse(new TextDecoder().decode(bytes)) as WordMapResult; } catch { throw new WordPageMapClientError("word_map_invalid", false); }
    const sourceHash = createHash("sha256").update(docx).digest("hex"), part = result.parts?.[0];
    if (result.schemaVersion !== 1 || result.authoritative !== true || result.engine !== "microsoft-word-com" || result.parts.length !== 1
      || part?.fingerprint !== sourceHash || part.bytes !== docx.byteLength
      || !isValidAuthoritativeWordPageMap(part.map)) throw new WordPageMapClientError("word_map_invalid", false);
    // This client accepts exactly one DOCX part. Bind the artifact to that
    // immutable source fingerprint, not to the service's aggregate request id.
    return { map: part.map, fingerprint: part.fingerprint };
  }
  private async request(init: RequestInit) {
    const token = (await this.options.serviceToken()).trim(); if (!token) throw new WordPageMapClientError("word_map_unauthenticated", false);
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      let response: Response; try { response = await (this.options.fetchImpl ?? fetch)(this.options.endpoint, { ...init, signal: controller.signal, headers: { authorization: `Bearer ${token}`, ...init.headers } }); }
      catch { throw new WordPageMapClientError(controller.signal.aborted ? "word_map_timeout" : "word_map_transport", true); }
      if (!response.ok) throw new WordPageMapClientError(`word_map_http_${response.status}`, response.status === 408 || response.status === 429 || response.status >= 500);
      return response;
    } finally { clearTimeout(timer); }
  }
}
