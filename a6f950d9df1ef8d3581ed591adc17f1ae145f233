import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { normalizeArabicAuthorName } from './author-staging-lib.mjs'

describe('author supplement provenance', () => {
  it('contains only high-confidence, dated HTTPS sources and unique identities', async () => {
    const payload = JSON.parse(await readFile(new URL('../app/public/data/author-supplement.json', import.meta.url), 'utf8'))
    const canonicalNames = new Set()
    for (const author of payload.authors) {
      assert.ok(['high', 'review', 'unresolved'].includes(author.metadataConfidence))
      assert.ok(['verified', 'review', 'unresolved'].includes(author.researchStatus))
      if (author.researchStatus === 'verified') assert.ok(author.researchSources.length > 0)
      else assert.deepEqual(author.researchSources, [])
      for (const source of author.researchSources) {
        assert.match(source.url, /^https:\/\//)
        assert.match(source.accessedAt, /^\d{4}-\d{2}-\d{2}$/)
      }
      const canonical = normalizeArabicAuthorName(author.name)
      assert.ok(!canonicalNames.has(canonical), `duplicate canonical name: ${author.name}`)
      canonicalNames.add(canonical)
    }
  })
})
