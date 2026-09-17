import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {identityBucket, SEO_IDENTITY_BUCKETS, SEO_IDENTITY_MAX_BYTES} from '../alpha-publish/functions/_seo-identity.js'
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
/** Pure build helper. Caller supplies only the reviewed packaged-public rows.
 * Two immutable R2 packs + one tiny Pages descriptor, no per-entity assets.
 * Author book lists intentionally belong to separately paginated A5 records. */
export function buildSeoIdentities({books, authors, generatedAt}) {
  assert(Number.isFinite(Date.parse(generatedAt)), 'identity_generation_required')
  const buckets = Array.from({length: SEO_IDENTITY_BUCKETS}, () => ({})), chunks = []
  let offset = 0, maxRecordBytes = 0
  for (const [kind, rows] of [['books', books], ['authors', authors]]) {
    const seen = new Set()
    for (const source of [...rows].sort((a, b) => a.id.localeCompare(b.id))) {
      assert(source.visibility === undefined || source.visibility === 'public', 'identity_not_public')
      assert(source.published !== false && source.isPrivate !== true, 'identity_not_public')
      assert(/^\d{1,12}$/.test(source.id), 'identity_id')
      const id = kind === 'authors' ? source.id.padStart(6, '0') : source.id
      assert(!seen.has(id), 'identity_duplicate'); seen.add(id)
      // Explicit allowlist prevents full book lists, source bodies, or incidental
      // ingestion/account properties from leaking into identity pages.
      const row = {kind, id}
      for (const key of kind === 'books' ? ['title', 'author', 'authorId', 'category', 'deathYearHijri', 'toc', 'updatedAt', 'publishedAt'] : ['name', 'biography', 'deathYearHijri', 'updatedAt']) {
        if (source[key] !== undefined) row[key] = source[key]
      }
      assert(typeof row[kind === 'books' ? 'title' : 'name'] === 'string', 'identity_name')
      const bytes = Buffer.from(JSON.stringify(row))
      assert(bytes.length < SEO_IDENTITY_MAX_BYTES, 'identity_record_over_budget:' + kind + '/' + id)
      buckets[identityBucket(kind, id)][`${kind}:${id}`] = {offset, bytes: bytes.length, sha256: sha(bytes)}
      chunks.push(bytes); offset += bytes.length; maxRecordBytes = Math.max(maxRecordBytes, bytes.length)
    }
  }
  const records = Buffer.concat(chunks), indexChunks = [], ranges = []; offset = 0
  for (const bucket of buckets) {
    const bytes = Buffer.from(JSON.stringify(bucket))
    assert(bytes.length < SEO_IDENTITY_MAX_BYTES, 'identity_bucket_over_budget')
    ranges.push({offset, bytes: bytes.length, sha256: sha(bytes)}); indexChunks.push(bytes); offset += bytes.length
  }
  const index = Buffer.concat(indexChunks)
  const pack = bytes => ({objectKey: `seo/identity/${sha(bytes)}.bin`, bytes: bytes.length, sha256: sha(bytes)})
  const descriptor = {contract: 'seo-identity/1', generatedAt, counts: {books: books.length, authors: authors.length}, index: pack(index), records: pack(records), buckets: ranges}
  const descriptorBytes = Buffer.from(JSON.stringify(descriptor))
  assert(descriptorBytes.length < SEO_IDENTITY_MAX_BYTES, 'identity_descriptor_over_budget')
  return {descriptor, descriptorBytes, objects: new Map([[descriptor.index.objectKey, index], [descriptor.records.objectKey, records]]), report: {pagesAssets: 1, r2Objects: 2, descriptorBytes: descriptorBytes.length, maxRecordBytes, maxIndexReadBytes: Math.max(...ranges.map(r => r.bytes)), totalBytes: index.length + records.length}}
}
