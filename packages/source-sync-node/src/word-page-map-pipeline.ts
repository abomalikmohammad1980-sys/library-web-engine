import { createHash } from "node:crypto";
import type { AuthoritativeWordPageMap, WordMapResult } from "./word-page-map-service.js";

export interface WordMapSourcePart { fingerprint: string; bytes: number }
export interface StoredAuthoritativeWordMap {
  schemaVersion: 1; bookId: string; sourceRevisionId: string; sourceParts: WordMapSourcePart[];
  mapFingerprint: string; engine: "microsoft-word-com"; maps: AuthoritativeWordPageMap[]; createdAt: string;
}
export interface WordMapArtifactStore {
  /** Must compare revision and every source-part fingerprint and write the complete artifact in one transaction. */
  commitIfCurrent(input: { bookId: string; sourceRevisionId: string; expectedParts: readonly WordMapSourcePart[];
    artifact: StoredAuthoritativeWordMap }): Promise<boolean>;
}
export interface WordMapInternalClient { build(parts: readonly Uint8Array[], signal: AbortSignal): Promise<WordMapResult> }

export class WordMapPipelineError extends Error {
  constructor(readonly code: "invalid_source" | "word_map_unavailable" | "stale_source", readonly retryable: boolean) {
    super(code); this.name = "WordMapPipelineError";
  }
}

const partIdentity = (bytes: Uint8Array): WordMapSourcePart => ({
  fingerprint: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.byteLength
});
const sameParts = (a: readonly WordMapSourcePart[], b: readonly WordMapSourcePart[]): boolean =>
  a.length === b.length && a.every((value, index) => value.fingerprint === b[index]?.fingerprint && value.bytes === b[index]?.bytes);

export class WordPageMapPipeline {
  constructor(private readonly client: WordMapInternalClient, private readonly store: WordMapArtifactStore,
    private readonly policy: { timeoutMs: number; maxAttempts: number; retryDelayMs: number }, private readonly now = () => new Date()) {
    if (policy.timeoutMs < 1 || policy.maxAttempts < 1 || policy.retryDelayMs < 0) throw new WordMapPipelineError("invalid_source", false);
  }

  async process(input: { bookId: string; sourceRevisionId: string; parts: readonly Uint8Array[] }): Promise<StoredAuthoritativeWordMap> {
    if (!input.bookId.trim() || !input.sourceRevisionId.trim() || !input.parts.length)
      throw new WordMapPipelineError("invalid_source", false);
    const expectedParts = input.parts.map(partIdentity);
    let result: WordMapResult | undefined;
    for (let attempt = 1; attempt <= this.policy.maxAttempts; attempt++) {
      const controller = new AbortController(); let timer: NodeJS.Timeout | undefined;
      const expired = new Promise<never>((_, reject) => { timer = setTimeout(() => {
        controller.abort(); reject(new WordMapPipelineError("word_map_unavailable", true));
      }, this.policy.timeoutMs); });
      try { result = await Promise.race([this.client.build(input.parts, controller.signal), expired]); break; }
      catch (error) {
        if (error instanceof WordMapPipelineError && !error.retryable) throw error;
        if (attempt === this.policy.maxAttempts) throw new WordMapPipelineError("word_map_unavailable", true);
        await new Promise(resolve => setTimeout(resolve, this.policy.retryDelayMs));
      } finally { if (timer) clearTimeout(timer); }
    }
    if (!result?.authoritative || result.parts.length !== expectedParts.length
      || !sameParts(result.parts.map(part => ({ fingerprint: part.fingerprint, bytes: part.bytes })), expectedParts)
      || !sameParts(input.parts.map(partIdentity), expectedParts)) throw new WordMapPipelineError("stale_source", false);
    const artifact: StoredAuthoritativeWordMap = { schemaVersion: 1, bookId: input.bookId, sourceRevisionId: input.sourceRevisionId,
      sourceParts: expectedParts, mapFingerprint: result.fingerprint, engine: result.engine,
      maps: result.parts.map(part => part.map), createdAt: this.now().toISOString() };
    if (!await this.store.commitIfCurrent({ bookId: input.bookId, sourceRevisionId: input.sourceRevisionId, expectedParts, artifact }))
      throw new WordMapPipelineError("stale_source", false);
    return artifact;
  }
}

/** Internal-only HTTP adapter. Pass a loopback/private URL; never expose its token to browsers. */
export class InternalWordMapHttpClient implements WordMapInternalClient {
  constructor(private readonly endpoint: string, private readonly authToken: string, private readonly fetchImpl: typeof fetch = fetch) {
    const url = new URL(endpoint);
    if (!/^https:$/.test(url.protocol) && !(url.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(url.hostname)))
      throw new WordMapPipelineError("invalid_source", false);
    if (authToken.length < 32) throw new WordMapPipelineError("invalid_source", false);
  }
  async build(parts: readonly Uint8Array[], signal: AbortSignal): Promise<WordMapResult> {
    const response = await this.fetchImpl(this.endpoint, { method: "POST", signal,
      headers: { authorization: `Bearer ${this.authToken}`, "content-type": "application/json" },
      body: JSON.stringify({ parts: parts.map(part => Buffer.from(part).toString("base64")) }) });
    if (!response.ok) throw new WordMapPipelineError("word_map_unavailable", response.status >= 500 || response.status === 429);
    return await response.json() as WordMapResult;
  }
}
