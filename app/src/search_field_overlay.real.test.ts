import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { loadSearchFieldOverlay } from './search_field_overlay'

const directory = resolve('.artifacts/field-overlay-partial130-20260917')
it.skipIf(!existsSync(resolve(directory, 'manifest.json')))('loads all 130 locally proved books without claiming global coverage', async () => {
  const manifest = readFileSync(resolve(directory, 'manifest.json')), index = readFileSync('app/public/library/shamela-search-v2/manifest.json')
  const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
  const fetcher: typeof fetch = async input => {
    const path = new URL(String(input)).pathname.replace(/^\/fields\//u, '')
    if (path !== 'manifest.json' && !/^books\/\d+\.json$/u.test(path)) throw Error('unexpected fixture path')
    return new Response(new Uint8Array(readFileSync(resolve(directory, path))))
  }
  const candidate = await loadSearchFieldOverlay({ manifestUrl: 'https://fixture.test/fields/manifest.json', manifestSha256: hash(manifest), sourceIndexSha256: hash(index), expectedBooks: 8594, expectedSegments: 860 }, fetcher)
  expect(candidate.coverageComplete).toBe(false); expect(candidate.coveredBookIds).toHaveLength(130)
  for (const id of candidate.coveredBookIds) expect(await candidate.book(id)).toBeDefined()
  expect(await candidate.book('999999999')).toBeUndefined()
})

// Explicit opt-in: a missing full candidate must never silently count as a pass.
const fullDirectory = process.env.KHIZANA_FULL_FIELD_OVERLAY
it.skipIf(!fullDirectory)('validates every book in an explicitly supplied complete corpus candidate', async () => {
  const root = resolve(fullDirectory!), manifestBytes = readFileSync(resolve(root, 'manifest.json'))
  const manifest = JSON.parse(manifestBytes.toString('utf8'))
  const indexBytes = readFileSync('app/public/library/shamela-search-v2/manifest.json'), index = JSON.parse(indexBytes.toString('utf8'))
  const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
  expect(manifest.activated).toBe(false)
  expect(manifest.coverageComplete).toBe(true)
  expect(manifest.counts.documents).toBe(index.counts.documents)
  expect(manifest.counts.positions).toBe(index.counts.positions)
  let loadedBooks = 0
  const fetcher: typeof fetch = async input => {
    const path = new URL(String(input)).pathname.replace(/^\/fields\//u, '')
    if (path !== 'manifest.json' && !/^books\/\d+\.json$/u.test(path)) throw Error('unexpected fixture path')
    if (path !== 'manifest.json') loadedBooks++
    return new Response(new Uint8Array(readFileSync(resolve(root, path))))
  }
  const candidate = await loadSearchFieldOverlay({ manifestUrl: 'https://fixture.test/fields/manifest.json', manifestSha256: hash(manifestBytes), sourceIndexSha256: hash(indexBytes), expectedBooks: index.counts.books, expectedSegments: index.segments.length }, fetcher)
  expect(candidate.coverageComplete).toBe(true)
  expect(candidate.coveredBookIds).toHaveLength(index.counts.books)
  for (const id of candidate.coveredBookIds) expect(await candidate.book(id)).toBeDefined()
  expect(loadedBooks).toBe(index.counts.books)
}, 300000)
