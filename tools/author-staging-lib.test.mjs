import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { matchCatalogAuthor, mergeHighConfidence, normalizeArabicAuthorName, parseRequestedAuthor } from './author-staging-lib.mjs'

describe('author staging', () => {
  it('normalizes Arabic and matches a unique full-name expansion', () => {
    assert.equal(normalizeArabicAuthorName('عُمَرُ الأَشْقَر'), 'عمر الاشقر')
    assert.deepEqual(matchCatalogAuthor(parseRequestedAuthor('عمر الأشقر'), [{ id: '1', name: 'عمر سليمان الأشقر', aliases: [] }]), { kind: 'existing', author: { id: '1', name: 'عمر سليمان الأشقر', aliases: [] }, method: 'unique-ordered-token-alias' })
  })
  it('matches a kunya alias but refuses an ambiguous shared alias', () => {
    const request = parseRequestedAuthor('إبراهيم القوصي (خبيب السوداني)')
    assert.equal(matchCatalogAuthor(request, [{ id: '1', name: 'إبراهيم القوصي', aliases: ['خبيب السوداني'] }]).kind, 'existing')
    assert.equal(matchCatalogAuthor(parseRequestedAuthor('أبو عبد الله'), [{ id: '1', name: 'أ', aliases: ['أبو عبد الله'] }, { id: '2', name: 'ب', aliases: ['أبو عبد الله'] }]).kind, 'review')
  })
  it('is idempotent and never duplicates a canonical name or alias', () => {
    const base = [{ id: '1', name: 'سعيد حوى', aliases: [] }]
    const additions = [{ id: '2', name: 'سعيد حوّى', aliases: [] }, { id: '3', name: 'سيد قطب', aliases: ['سيد إبراهيم قطب'] }]
    const once = mergeHighConfidence(base, additions)
    assert.deepEqual(mergeHighConfidence(once, additions), once)
    assert.deepEqual(once.map(item => item.name), ['سعيد حوى', 'سيد قطب'])
  })
})
