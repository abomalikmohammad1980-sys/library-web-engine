import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, mkdir, writeFile, readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {prepareSeoDataRelease} from './prepare-seo-data-release.mjs'
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'khizana-seo-data-')), source = join(root, 'source'), data = join(source, 'data/seo')
  await mkdir(data, {recursive: true})
  const generatedAt = '2026-09-17T00:00:00Z', shards = []
  for (const [kind, records] of [['books', {'1': {id: '1', title: 'كتاب', author: 'مؤلف', authorId: '000020', category: 'علم'}}], ['authors', {'000020': {id: '000020', name: 'مؤلف'}}]]) {
    const path = `${kind}-00.json`, bytes = Buffer.from(JSON.stringify({generatedAt, records}))
    await writeFile(join(data, path), bytes)
    shards.push({path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')})
  }
  await writeFile(join(data, 'manifest.json'), JSON.stringify({generatedAt, counts: {books: 1, authors: 1}, shards}))
  return {root, source, data}
}
test('stage exact reviewed identities and lists outside Pages; one descriptor and no activation', async () => {
  const {root, source} = await fixture(), output = join(root, 'output')
  const report = await prepareSeoDataRelease(source, output)
  assert.equal(report.pagesAssets, 1); assert.equal(report.uploaded, false); assert.equal(report.activated, false)
  for (const item of report.objects) {
    const bytes = await readFile(join(output, 'objects', item.key))
    assert.equal(bytes.length, item.bytes)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256)
  }
  await assert.rejects(prepareSeoDataRelease(source, output), /EEXIST/)
  await assert.rejects(prepareSeoDataRelease(source, join(source, 'nested')), /separate_staging/)
})
test('reject modified deployment shards before producing a release', async () => {
  const {root, source, data} = await fixture()
  await writeFile(join(data, 'books-00.json'), '{}')
  await assert.rejects(prepareSeoDataRelease(source, join(root, 'output')), /source_shard_size/)
})
