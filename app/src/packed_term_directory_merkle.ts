/** Standalone experiment. descriptor MUST come from an authenticated release manifest,
 * never from the leaf response. Construction pins a private copy for this client. */
import { liteTermHash, type LiteEntry, type LitePart } from './packed_term_directory_lite';
export interface MerkleDescriptor {
  contract: string; encoding: string; releaseId: string; sourceManifestSha256: string;
  sourceCoverage: { segments: number; expectedSegments: number; books: number; documents: number; positions: number };
  coverageComplete: boolean; termCount: number; leafCount: number; proofDepth: number;
  rootSha256: string; leafPath: string;
}
const CAP = 512 * 1024, HEADER = 465, SHA = /^[a-f0-9]{64}$/;
const fail = (s: string): never => { throw new Error(`merkle_${s}`) };
const integer = (x: unknown, min = 0): x is number => Number.isSafeInteger(x) && (x as number) >= min;
const hash = async (bytes: Uint8Array) => new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer));
const concat = (...parts: Uint8Array[]) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let pos = 0; for (const p of parts) { out.set(p, pos); pos += p.length } return out };
const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
function validateDescriptor(d: MerkleDescriptor, release: string) {
  if (d.releaseId !== release || !release) fail('release');
  const c = d.sourceCoverage;
  if (d.contract !== 'khizana-term-directory-merkle/1' || d.encoding !== 'binary-proof14+original-json/1' || d.leafCount !== 16384 || d.proofDepth !== 14 || d.leafPath !== 'leaves/{id}.bin' || !SHA.test(d.rootSha256) || !SHA.test(d.sourceManifestSha256) || d.coverageComplete !== true || !integer(d.termCount) || !c || !integer(c.segments, 1) || c.segments !== c.expectedSegments || !integer(c.books, 1) || !integer(c.documents, 1) || !integer(c.positions, 1)) fail('descriptor');
}
export async function verifyMerkleLeaf(body: Uint8Array, id: number, d: MerkleDescriptor, release: string): Promise<Map<string, LiteEntry>> {
  validateDescriptor(d, release);
  if (!integer(id) || id >= 16384 || body.length < HEADER || body.length > CAP) fail('size');
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  if (new TextDecoder().decode(body.subarray(0, 8)) !== 'KHTMRK01' || view.getUint32(8) !== id || view.getUint32(12) !== body.length - HEADER || body[16] !== 14) fail('envelope');
  const context = await hash(new TextEncoder().encode(JSON.stringify({ contract: 'khizana-term-merkle-context/1', releaseId: d.releaseId, sourceManifestSha256: d.sourceManifestSha256, sourceCoverage: d.sourceCoverage, coverageComplete: true, termCount: d.termCount, leafCount: 16384 })));
  const identity = new Uint8Array(4); new DataView(identity.buffer).setUint32(0, id);
  let digest = await hash(concat(new Uint8Array([0]), context, identity, await hash(body.subarray(HEADER))));
  let position = id;
  for (let level = 0; level < 14; level++) { const sibling = body.subarray(17 + level * 32, 49 + level * 32); digest = await hash(concat(new Uint8Array([1]), ...(position & 1 ? [sibling, digest] : [digest, sibling]))); position >>>= 1 }
  if (hex(digest) !== d.rootSha256) fail('integrity');
  const rows: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body.subarray(HEADER)));
  if (!Array.isArray(rows)) fail('schema');
  const result = new Map<string, LiteEntry>(); let previous: string | undefined;
  for (const row of rows as any[]) {
    // Stored legacy tokens can exceed the query limit. The complete leaf is
    // already bounded by CAP and authenticated above; rejecting such a token
    // would also hide unrelated valid words in the same verified leaf.
    if (!Array.isArray(row) || ![4, 6].includes(row.length) || typeof row[0] !== 'string' || !row[0] || (previous !== undefined && previous >= row[0]) || liteTermHash(row[0]) % 16384 !== id || typeof row[1] !== 'string' || !SHA.test(row[1]) || !integer(row[2], 1)) fail('schema');
    const tuples = row.length === 6 ? [[row[3], row[4], row[5], row[2], row[1]]] : row[3];
    if (!Array.isArray(tuples) || !tuples.length) fail('schema');
    const parts: LitePart[] = tuples.map((p: any) => {
      if (!Array.isArray(p) || p.length !== 5 || !integer(p[0]) || p[0] > 7 || typeof p[1] !== 'string' || !/^\d{1,12}$/.test(p[1]) || !integer(p[2]) || !integer(p[3], 1) || !integer(p[2] + p[3]) || typeof p[4] !== 'string' || !SHA.test(p[4])) fail('schema');
      return { project: p[0], archive: p[1], offset: p[2], length: p[3], sha256: p[4] };
    });
    if (parts.reduce((n, p) => n + p.length, 0) !== row[2]) fail('schema');
    result.set(row[0], { sha256: row[1], byteLength: row[2], parts }); previous = row[0];
  }
  return result;
}
interface Flight { controller: AbortController; promise: Promise<Map<string, LiteEntry>>; users: number; settled: boolean }
interface Options { baseUrl: string; descriptor: MerkleDescriptor; releaseId: string; fetch?: typeof fetch; maxCacheEntries?: number; maxCacheBytes?: number }
export class PackedTermDirectoryMerkle {
  private descriptor: MerkleDescriptor;
  private cache = new Map<number, { rows: Map<string, LiteEntry>; bytes: number }>();
  private flights = new Map<number, Flight>();
  private cacheBytes = 0; private closed = false;
  private entryLimit: number; private byteLimit: number;
  private readonly baseUrl: string;
  private readonly releaseId: string;
  private readonly fetcher: typeof fetch;
  constructor(options: Options) {
    this.descriptor = JSON.parse(JSON.stringify(options.descriptor)); validateDescriptor(this.descriptor, options.releaseId);
    this.entryLimit = options.maxCacheEntries ?? 64; this.byteLimit = options.maxCacheBytes ?? 4 * 1024 * 1024;
    if (!options.baseUrl || !integer(this.entryLimit, 1) || this.entryLimit > 128 || !integer(this.byteLimit, 1) || this.byteLimit > 8 * 1024 * 1024) fail('config');
    this.baseUrl = options.baseUrl.replace(/\/$/, ''); this.releaseId = options.releaseId; this.fetcher = options.fetch ?? fetch;
  }
  dispose() { this.closed = true; for (const f of this.flights.values()) f.controller.abort(); this.cache.clear(); this.cacheBytes = 0 }
  async lookup(word: string, signal?: AbortSignal): Promise<LiteEntry | null> {
    signal?.throwIfAborted(); if (this.closed) fail('disposed');
    if (typeof word !== 'string' || !word || word.length > 4096) fail('word');
    const id = liteTermHash(word) % 16384; const cached = this.cache.get(id);
    let rows: Map<string, LiteEntry>;
    if (cached) { this.cache.delete(id); this.cache.set(id, cached); rows = cached.rows }
    else {
      let f = this.flights.get(id); if (f?.controller.signal.aborted) { this.flights.delete(id); f = undefined }
      if (!f) {
        if (this.flights.size >= 32) fail('busy');
        const controller = new AbortController(); const active: Flight = { controller, users: 0, settled: false, promise: Promise.resolve(new Map()) };
        active.promise = this.download(id, controller).finally(() => { active.settled = true; if (this.flights.get(id) === active) this.flights.delete(id) });
        this.flights.set(id, active); f = active;
      }
      const active = f; active.users++;
      rows = await new Promise<Map<string, LiteEntry>>((resolve, reject) => {
        let done = false;
        const finish = (error: unknown, value?: Map<string, LiteEntry>) => { if (done) return; done = true; signal?.removeEventListener('abort', abort); active.users--; if (!active.users && !active.settled) active.controller.abort(); if (error) reject(error); else resolve(value!) };
        const abort = () => finish(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
        signal?.addEventListener('abort', abort, { once: true }); active.promise.then(v => finish(null, v), e => finish(e)); if (signal?.aborted) abort();
      });
    }
    signal?.throwIfAborted(); if (this.closed) fail('disposed');
    const entry = rows.get(word); return entry ? { ...entry, parts: entry.parts.map(p => ({ ...p })) } : null;
  }
  private async download(id: number, controller: AbortController) {
    const signal = controller.signal, timer = setTimeout(() => controller.abort(new Error('merkle_timeout')), 8000);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const abort = () => { void reader?.cancel(signal.reason).catch(() => undefined) }; signal.addEventListener('abort', abort, { once: true });
    try {
      const response = await this.fetcher(`${this.baseUrl}/leaves/${String(id).padStart(5, '0')}.bin`, { signal, credentials: 'omit', redirect: 'error', cache: 'force-cache' });
      signal.throwIfAborted(); if (response.status !== 200 || !response.body) fail('http');
      const declared = response.headers.get('content-length'); if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > CAP)) fail('size');
      reader = response.body!.getReader(); const chunks: Uint8Array[] = []; let count = 0;
      for (;;) { const { value, done } = await reader.read(); signal.throwIfAborted(); if (done) break; count += value.length; if (count > CAP) fail('size'); chunks.push(value) }
      const rows = await verifyMerkleLeaf(concat(...chunks), id, this.descriptor, this.releaseId); signal.throwIfAborted();
      if (count <= this.byteLimit) { while (this.cache.size >= this.entryLimit || this.cacheBytes + count > this.byteLimit) { const first = this.cache.keys().next().value!; this.cacheBytes -= this.cache.get(first)!.bytes; this.cache.delete(first) } this.cache.set(id, { rows, bytes: count }); this.cacheBytes += count }
      return rows;
    } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); await reader?.cancel().catch(() => undefined); reader?.releaseLock() }
  }
}
