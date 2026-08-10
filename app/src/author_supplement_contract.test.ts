import { describe, expect, it } from 'vitest'
import { normalizeSupplementAuthor } from './shamela_catalog'

describe('author supplement provenance gate', () => {
  const author = { name: 'سيد قطب', aliases: [], researchSources: [{ url: 'https://example.test/source', accessedAt: '2026-08-08' }], metadataConfidence: 'high' as const, researchStatus: 'verified' as const }
  it('retains dated HTTPS provenance for a high-confidence record', () => {
    expect(normalizeSupplementAuthor(author)).toMatchObject({ name: 'سيد قطب', metadataConfidence: 'high', researchSources: author.researchSources })
  })
  it('rejects unreviewed confidence and malformed provenance', () => {
    expect(normalizeSupplementAuthor({ ...author, metadataConfidence: 'medium' })).toBeUndefined()
    expect(normalizeSupplementAuthor({ ...author, researchSources: [{ url: 'http://example.test', accessedAt: 'today' }] })).toBeUndefined()
  })
  it('accepts a minimal unresolved name but rejects invented metadata on it', () => {
    const unresolved = { name: 'اسم غير محسوم', aliases: ['أبو فلان'], researchSources: [], metadataConfidence: 'unresolved' as const, researchStatus: 'unresolved' as const }
    expect(normalizeSupplementAuthor(unresolved)).toEqual(unresolved)
    expect(normalizeSupplementAuthor({ ...unresolved, biography: 'نبذة بلا مصدر' })).toBeUndefined()
  })
})
