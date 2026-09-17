// Immutable packaged-public identity reader. Private/upload records use their
// separate eligibility-fenced database path, never this frozen catalog.
export const SEO_IDENTITY_MAX_BYTES = 200_000
export const SEO_IDENTITY_BUCKETS = 256
export function identityBucket(kind, id) {
  let hash = 2166136261
  for (const char of `${kind}:${id}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0
  return hash % SEO_IDENTITY_BUCKETS
}
const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('')
async function digest(bytes) { return hex(await crypto.subtle.digest('SHA-256', bytes)) }
function validRange(part, total) {
  return part && Number.isSafeInteger(total) && total >= 0 && Number.isSafeInteger(part.offset) && part.offset >= 0 && Number.isSafeInteger(part.bytes) && part.bytes > 0 && part.bytes < SEO_IDENTITY_MAX_BYTES && part.offset + part.bytes <= total && /^[a-f0-9]{64}$/.test(part.sha256)
}
async function readPart(bucket, pack, part) {
  if (!pack || !/^seo\/identity\/[a-f0-9]{64}\.bin$/.test(pack.objectKey) || !validRange(part, pack.bytes)) throw new Error('seo_identity_invalid_range')
  const object = await bucket.get(pack.objectKey, {range: {offset: part.offset, length: part.bytes}})
  if (!object?.body) throw new Error('seo_identity_missing_pack')
  // Bound consumption even if a backend accidentally ignores the range.
  const reader = object.body.getReader(), chunks = []; let size = 0
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break
      size += value.byteLength
      if (size > part.bytes) throw new Error('seo_identity_range_ignored')
      chunks.push(value)
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
  if (size !== part.bytes) throw new Error('seo_identity_short_read')
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  if (await digest(bytes) !== part.sha256) throw new Error('seo_identity_checksum')
  return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes))
}
export async function readSeoIdentity(bucket, descriptor, kind, id) {
  if (!['books', 'authors'].includes(kind) || !/^\d{1,12}$/.test(id)) return null
  if (kind === 'authors') id = id.padStart(6, '0')
  if (!descriptor || descriptor.contract !== 'seo-identity/1' || descriptor.buckets?.length !== SEO_IDENTITY_BUCKETS) throw new Error('seo_identity_descriptor')
  const index = await readPart(bucket, descriptor.index, descriptor.buckets[identityBucket(kind, id)])
  const part = index[`${kind}:${id}`]
  if (!part) return null
  const record = await readPart(bucket, descriptor.records, part)
  if (record.id !== id || record.kind !== kind || Object.hasOwn(record, 'books')) throw new Error('seo_identity_record')
  const {kind: ignored, ...identity} = record
  return {...identity, contentVersion: part.sha256}
}
