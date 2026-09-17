import assert from 'node:assert/strict'
import {readFile, writeFile, mkdir} from 'node:fs/promises'
import {resolve, dirname, relative, isAbsolute} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {buildSeoIdentities} from './build-seo-identities.mjs'
import {buildSeoListings} from './build-seo-listings.mjs'
const sha = bytes => createHash('sha256').update(bytes).digest('hex')

/** Consume the reviewed deployment's exact shards, not a newer working catalog.
 * Output is a staging artifact only: no upload, no activation, no old-file deletion. */
export async function prepareSeoDataRelease(source, destination) {
  const input = resolve(source, 'data/seo'), output = resolve(destination)
  const relation = relative(resolve(source), output)
  assert(relation && (relation.startsWith('..') || isAbsolute(relation)), 'separate_staging_required')
  const manifestBytes = await readFile(resolve(input, 'manifest.json'))
  const manifest = JSON.parse(manifestBytes), rows = {books: [], authors: []}
  const seen = new Set()
  for (const shard of manifest.shards) {
    assert(/^(books|authors)-\d{2}\.json$/.test(shard.path), 'unexpected_identity_shard')
    assert(!seen.has(shard.path), 'duplicate_identity_shard'); seen.add(shard.path)
    const bytes = await readFile(resolve(input, shard.path))
    assert.equal(bytes.length, shard.bytes, 'source_shard_size')
    assert.equal(sha(bytes), shard.sha256, 'source_shard_checksum')
    const data = JSON.parse(bytes), kind = shard.path.startsWith('books') ? 'books' : 'authors'
    assert.equal(data.generatedAt, manifest.generatedAt, 'source_generation_mismatch')
    for (const [id, record] of Object.entries(data.records)) {
      assert.equal(record.id, id, 'source_record_identity')
      rows[kind].push(record)
    }
  }
  for (const kind of Object.keys(rows)) assert.equal(rows[kind].length, manifest.counts[kind], 'source_count_mismatch')
  const identities = buildSeoIdentities({...rows, generatedAt: manifest.generatedAt})
  const listings = buildSeoListings({...rows, generatedAt: manifest.generatedAt})
  const objects = new Map(identities.objects)
  for (const [name, bytes] of listings.files) objects.set(`seo/listings/${listings.report.releaseId}/${name}`, bytes)
  const descriptor = {contract: 'seo-data-release/1', sourceManifestSha256: sha(manifestBytes), identities: identities.descriptor, listings: {releaseId: listings.report.releaseId, counts: {books: rows.books.length, authors: rows.authors.length, categories: listings.report.categories}}}
  const descriptorBytes = Buffer.from(JSON.stringify(descriptor))
  assert(descriptorBytes.length < 200000, 'release_descriptor_budget')
  // Refuse to silently overwrite a previously prepared candidate.
  await mkdir(output, {recursive: true})
  await writeFile(resolve(output, 'descriptor.json'), descriptorBytes, {flag: 'wx'})
  const inventory = []
  for (const [key, bytes] of objects) {
    const file = resolve(output, 'objects', key)
    await mkdir(dirname(file), {recursive: true}); await writeFile(file, bytes, {flag: 'wx'})
    inventory.push({key, bytes: bytes.length, sha256: sha(bytes)})
  }
  const report = {contract: 'seo-data-staging/1', descriptorSha256: sha(descriptorBytes), pagesAssets: 1, identity: identities.report, listings: listings.report, objects: inventory, uploaded: false, activated: false}
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2), {flag: 'wx'})
  return report
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert(process.argv[2] && process.argv[3], 'source_deployment_and_separate_output_required')
  const report = await prepareSeoDataRelease(process.argv[2], process.argv[3])
  console.log(JSON.stringify({...report, objects: report.objects.length}))
}
