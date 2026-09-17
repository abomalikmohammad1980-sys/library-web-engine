import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile, readdir} from 'node:fs/promises'
import {buildSeoIdentities} from './build-seo-identities.mjs'
import {readSeoIdentity} from '../alpha-publish/functions/_seo-identity.js'
const generatedAt = '2026-09-17T00:00:00Z'
const input = {generatedAt, books: [{id: '21633', title: 'كتاب', author: 'مؤلف', authorId: '000020', category: 'علم'}], authors: [{id: '000020', name: 'مؤلف', biography: 'ترجمة', books: Array.from({length: 10000}, (_, i) => ({id: String(i), title: 'كتاب طويل'}))}]}
function storage(artifact, transform = b => b) {
  const reads = []
  return {reads, async get(key, {range}) {
    reads.push({key, ...range}); const all = artifact.objects.get(key)
    if (!all) return null
    return {body: new Response(transform(all.subarray(range.offset, range.offset + range.length))).body}
  }}
}
test('identity preserves metadata, drops author books, caps two reads, canonicalizes author id', async () => {
  const artifact = buildSeoIdentities(input), bucket = storage(artifact)
  assert.equal(artifact.report.pagesAssets, 1); assert.equal(artifact.objects.size, 2)
  const book = await readSeoIdentity(bucket, artifact.descriptor, 'books', '21633')
  assert.equal(book.title, 'كتاب'); assert.match(book.contentVersion, /^[a-f0-9]{64}$/)
  const author = await readSeoIdentity(bucket, artifact.descriptor, 'authors', '20')
  assert.equal(author.name, 'مؤلف'); assert.equal(author.books, undefined)
  assert.equal(bucket.reads.length, 4); assert(bucket.reads.every(r => r.length < 200000))
  assert.equal(await readSeoIdentity(bucket, artifact.descriptor, 'books', '999999'), null)
  assert.equal(bucket.reads.length, 5)
})
test('identity digest changes only changed entity and immutable packs are deterministic', () => {
  const first = buildSeoIdentities(input), second = buildSeoIdentities({...input, books: [{...input.books[0], title: 'تعديل'}]})
  assert.notEqual(first.descriptor.records.objectKey, second.descriptor.records.objectKey)
  assert.deepEqual(first.descriptor, buildSeoIdentities(input).descriptor)
})
test('fail closed for corrupt, oversized, missing packs and oversized input', async () => {
  const artifact = buildSeoIdentities(input)
  await assert.rejects(readSeoIdentity(storage(artifact, b => Buffer.alloc(b.length)), artifact.descriptor, 'books', '21633'), /checksum/)
  await assert.rejects(readSeoIdentity(storage(artifact, b => Buffer.concat([b, Buffer.from('x')])), artifact.descriptor, 'books', '21633'), /range_ignored/)
  await assert.rejects(readSeoIdentity({get: async () => null}, artifact.descriptor, 'books', '21633'), /missing_pack/)
  assert.throws(() => buildSeoIdentities({...input, authors: [{id: '000020', name: 'x', biography: 'x'.repeat(200000)}]}), /over_budget/)
  assert.throws(() => buildSeoIdentities({...input, books: [{...input.books[0], visibility: 'private'}]}), /not_public/)
})
test('frozen batch34 catalog: all identities within budget, authors with large lists split safely', async t => {
  const directory = '.artifacts/batch34/deploy/pages-dist/data/seo'
  let names
  try { names = await readdir(directory) } catch { t.skip('frozen batch34 unavailable'); return }
  const rows = {books: [], authors: []}
  for (const kind of Object.keys(rows)) for (const name of names.filter(n => new RegExp(`^${kind}-\\d+\\.json$`).test(n))) {
    const shard = JSON.parse(await readFile(`${directory}/${name}`, 'utf8'))
    rows[kind].push(...Object.values(shard.records))
  }
  assert(rows.books.length > 8000); assert(rows.authors.length > 3000)
  const artifact = buildSeoIdentities({...rows, generatedAt}), bucket = storage(artifact)
  for (const kind of Object.keys(rows)) for (const expected of rows[kind]) {
    const actual = await readSeoIdentity(bucket, artifact.descriptor, kind, expected.id)
    assert.equal(actual.id, expected.id); assert.equal(actual[kind === 'books' ? 'title' : 'name'], expected[kind === 'books' ? 'title' : 'name'])
  }
  assert(bucket.reads.every(r => r.length < 200000))
  t.diagnostic(JSON.stringify({...artifact.report, counts: artifact.descriptor.counts}))
})
