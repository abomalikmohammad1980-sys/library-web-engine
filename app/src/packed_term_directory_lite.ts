/** Experimental, unwired reader. The caller pins a trusted root hash and release. */
export interface LitePart { project: number; archive: string; offset: number; length: number; sha256: string }
export interface LiteEntry { byteLength: number; sha256: string; parts: LitePart[] }
interface Descriptor { id: number; path: string; bytes: number; sha256: string; entries?: number }
interface Root { branches: Descriptor[] }
interface Options { baseUrl: string; rootSha256: string; releaseId: string; fetch?: typeof fetch; maxCacheEntries?: number; maxCacheBytes?: number }
interface Flight { controller: AbortController; promise: Promise<unknown>; users: number; settled: boolean }
const CAP = 512 * 1024, SHA = /^[a-f0-9]{64}$/;
const fail = (code: string): never => { throw new Error(code) };
const integer = (x: unknown, min = 0): x is number => Number.isSafeInteger(x) && (x as number) >= min;
export function liteTermHash(word: string): number { let h = 2166136261; for (let i = 0; i < word.length; i++) { h ^= word.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

export class PackedTermDirectoryLite {
  private cache = new Map<string, { value: unknown; bytes: number }>();
  private flights = new Map<string, Flight>();
  private closed = false;
  private cachedBytes = 0;
  private requests = 0;
  private bytes = 0;
  private fetcher: typeof fetch;
  private entryLimit: number;
  private byteLimit: number;
  constructor(private options: Options) {
    if (!SHA.test(options.rootSha256) || !options.releaseId || !options.baseUrl) fail('lite_config');
    this.entryLimit = options.maxCacheEntries ?? 64;
    this.byteLimit = options.maxCacheBytes ?? 4 * 1024 * 1024;
    if (!integer(this.entryLimit, 1) || this.entryLimit > 128 || !integer(this.byteLimit, 1) || this.byteLimit > 8 * 1024 * 1024) fail('lite_config');
    this.fetcher = options.fetch ?? fetch;
  }
  get stats() { return { requests: this.requests, bytes: this.bytes, cacheEntries: this.cache.size, cacheBytes: this.cachedBytes, inFlight: this.flights.size } }
  dispose() { this.closed = true; for (const f of this.flights.values()) f.controller.abort(); this.cache.clear(); this.cachedBytes = 0 }
  private check(signal?: AbortSignal) { if (this.closed) fail('lite_disposed'); signal?.throwIfAborted() }
  async lookup(word: string, signal?: AbortSignal): Promise<LiteEntry | null> {
    this.check(signal);
    if (typeof word !== 'string' || !word.length || word.length > 4096) fail('lite_word');
    const root = await this.read('manifest.json', this.options.rootSha256, undefined, v => this.root(v), signal);
    const leafId = liteTermHash(word) % 16384, branchId = leafId % 128;
    const descriptor = root.branches[branchId]!;
    const branch = await this.read(descriptor.path, descriptor.sha256, descriptor.bytes, v => this.branch(v, branchId), signal);
    const leaf = branch.find(d => d.id === leafId)!;
    const rows = await this.read(leaf.path, leaf.sha256, leaf.bytes, v => this.leaf(v, leaf), signal);
    this.check(signal);
    const entry = rows.get(word);
    return entry ? { ...entry, parts: entry.parts.map(p => ({ ...p })) } : null;
  }
  private descriptor(v: any, id: number, kind: 'branches' | 'leaves'): Descriptor {
    const path = `${kind}/${String(id).padStart(kind === 'branches' ? 3 : 5, '0')}.json`;
    if (!v || v.id !== id || v.path !== path || !integer(v.bytes, 1) || v.bytes > CAP || typeof v.sha256 !== 'string' || !SHA.test(v.sha256) || (kind === 'leaves' && !integer(v.entries))) fail('lite_schema');
    return v;
  }
  private root(v: any): Root {
    if (v?.releaseId !== this.options.releaseId) fail('lite_release');
    if (v.contract !== 'khizana-term-directory-lite/1' || v.encoding !== 'tuple-single-part/1' || v.hash !== 'fnv1a-utf16/1' || v.leafCount !== 16384 || v.branchCount !== 128 || v.coverageComplete !== true || !SHA.test(v.sourceManifestSha256 ?? '') || !integer(v.termCount, 1)) fail('lite_schema');
    const c = v.sourceCoverage;
    if (!c || !integer(c.segments, 1) || c.segments !== c.expectedSegments || !integer(c.books, 1) || !integer(c.documents, 1) || !integer(c.positions, 1) || !Array.isArray(v.branches) || v.branches.length !== 128) fail('lite_schema');
    return { branches: v.branches.map((d: unknown, i: number) => this.descriptor(d, i, 'branches')) };
  }
  private branch(v: any, id: number): Descriptor[] {
    if (!Array.isArray(v) || v.length !== 128) fail('lite_schema');
    return v.map((d: unknown, i: number) => this.descriptor(d, id + i * 128, 'leaves'));
  }
  private leaf(v: any, descriptor: Descriptor): Map<string, LiteEntry> {
    if (!Array.isArray(v) || v.length !== descriptor.entries) fail('lite_schema');
    const result = new Map<string, LiteEntry>();
    let previous: string | undefined;
    for (const row of v) {
      if (!Array.isArray(row) || (row.length !== 4 && row.length !== 6) || typeof row[0] !== 'string' || !row[0] || row[0].length > 4096 || (previous !== undefined && previous >= row[0]) || liteTermHash(row[0]) % 16384 !== descriptor.id || !SHA.test(row[1]) || !integer(row[2], 1)) fail('lite_schema');
      const tuples = row.length === 6 ? [[row[3], row[4], row[5], row[2], row[1]]] : row[3];
      if (!Array.isArray(tuples) || tuples.length === 0) fail('lite_schema');
      const parts: LitePart[] = tuples.map((p: any) => {
        if (!Array.isArray(p) || p.length !== 5 || !integer(p[0]) || typeof p[1] !== 'string' || !/^\d{1,12}$/.test(p[1]) || !integer(p[2]) || !integer(p[3], 1) || !integer(p[2] + p[3]) || typeof p[4] !== 'string' || !SHA.test(p[4])) fail('lite_schema');
        return { project: p[0], archive: p[1], offset: p[2], length: p[3], sha256: p[4] };
      });
      if (parts.reduce((sum, p) => sum + p.length, 0) !== row[2]) fail('lite_schema');
      result.set(row[0], { sha256: row[1], byteLength: row[2], parts }); previous = row[0];
    }
    return result;
  }
  private async read<T>(path: string, sha: string, size: number | undefined, validate: (v: any) => T, signal?: AbortSignal): Promise<T> {
    this.check(signal);
    const key = `${path}:${sha}`, cached = this.cache.get(key);
    if (cached) { this.cache.delete(key); this.cache.set(key, cached); return cached.value as T }
    let flight = this.flights.get(key);
    if (flight?.controller.signal.aborted) { this.flights.delete(key); flight = undefined }
    if (!flight) {
      if (this.flights.size >= 32) fail('lite_busy');
      const controller = new AbortController();
      flight = { controller, users: 0, settled: false, promise: Promise.resolve() };
      const active = flight;
      active.promise = this.download(path, sha, size, controller).then(({ value, bytes }) => {
        const parsed = validate(value); this.check(controller.signal);
        if (bytes <= this.byteLimit) {
          while (this.cache.size >= this.entryLimit || this.cachedBytes + bytes > this.byteLimit) { const oldest = this.cache.keys().next().value!; this.cachedBytes -= this.cache.get(oldest)!.bytes; this.cache.delete(oldest) }
          this.cache.set(key, { value: parsed, bytes }); this.cachedBytes += bytes;
        }
        return parsed;
      }).finally(() => { active.settled = true; if (this.flights.get(key) === active) this.flights.delete(key) });
      this.flights.set(key, active);
    }
    const active = flight; active.users++;
    return new Promise<T>((resolve, reject) => {
      let done = false;
      const finish = (error: unknown, value?: unknown) => { if (done) return; done = true; signal?.removeEventListener('abort', abort); active.users--; if (!active.users && !active.settled) active.controller.abort(); if (error) reject(error); else resolve(value as T) };
      const abort = () => finish(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
      signal?.addEventListener('abort', abort, { once: true });
      active.promise.then(value => finish(undefined, value), error => finish(error));
      if (signal?.aborted) abort();
    });
  }
  private async download(path: string, sha: string, size: number | undefined, controller: AbortController): Promise<{ value: unknown; bytes: number }> {
    const signal = controller.signal;
    const timer = setTimeout(() => controller.abort(new Error('lite_timeout')), 8000);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const abort = () => { void reader?.cancel(signal.reason).catch(() => undefined) };
    signal.addEventListener('abort', abort, { once: true });
    try {
      this.requests++;
      const response = await this.fetcher(`${this.options.baseUrl.replace(/\/$/, '')}/${path}?v=${this.options.rootSha256}`, { credentials: 'omit', redirect: 'error', cache: 'force-cache', signal });
      signal.throwIfAborted();
      if (!response.ok || !response.body) fail('lite_http');
      reader = response.body!.getReader();
      const declared = response.headers.get('content-length');
      if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > CAP)) fail('lite_size');
      const chunks: Uint8Array[] = []; let bytes = 0;
      for (;;) { const { value, done } = await reader.read(); signal.throwIfAborted(); if (done) break; bytes += value.byteLength; this.bytes += value.byteLength; if (bytes > CAP) fail('lite_size'); chunks.push(value) }
      if (size !== undefined && bytes !== size) fail('lite_size');
      const body = new Uint8Array(bytes); let offset = 0; for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length }
      const actual = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', body)), x => x.toString(16).padStart(2, '0')).join('');
      signal.throwIfAborted(); if (actual !== sha) fail('lite_integrity');
      return { value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)), bytes };
    } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); await reader?.cancel().catch(() => undefined); reader?.releaseLock() }
  }
}
