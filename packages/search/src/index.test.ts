import { describe, expect, it } from 'vitest'
import { ArabicSearchShard, createSearchWorkerHandler, type SearchDocument } from './index'

describe('ArabicSearchShard', () => {
  it('folds Arabic spelling, verifies phrases, and paginates stable results', () => {
    const shard = ArabicSearchShard.build('books/001', [
      { id: 'a', bookId: 'b1', paragraphIndex: 0, text: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّات' },
      { id: 'b', bookId: 'b2', paragraphIndex: 7, text: 'باب: إنما الأعمال بالنيات' },
      { id: 'c', bookId: 'b3', paragraphIndex: 2, text: 'الأعمال الصالحة' },
    ])
    expect(shard.search('انما الاعمال بالنيات', 0, 1)).toMatchObject({ total: 2, offset: 0, limit: 1, hits: [{ id: 'a' }] })
    expect(shard.search('انما الاعمال بالنيات', 1, 1)).toMatchObject({ total: 2, offset: 1, limit: 1, hits: [{ id: 'b' }] })
    expect(ArabicSearchShard.restore(shard.serialize()).search('الاعمال الصالحه').total).toBe(0)
  })

  it('returns a bounded page while counting 10,000 matches in under one second', () => {
    const documents: SearchDocument[] = Array.from({ length: 20_000 }, (_, index) => ({
      id: String(index), bookId: `book-${index % 100}`, paragraphIndex: index,
      text: index % 2 === 0 ? `الموضع ${index}: طلب العلم فريضة` : `الموضع ${index}: باب مختلف`,
    }))
    const shard = ArabicSearchShard.build('benchmark', documents)
    const started = performance.now()
    const page = shard.search('طلب العلم', 9_950, 40)
    const elapsed = performance.now() - started
    expect(page.total).toBe(10_000)
    expect(page.hits).toHaveLength(40)
    expect(page.hits[0]?.id).toBe('19900')
    expect(elapsed).toBeLessThan(1_000)
  })

  it('uses a structured-clone-safe worker protocol', () => {
    const handle = createSearchWorkerHandler()
    expect(handle({ requestId: '1', type: 'build', shardId: 'portable/shard', documents: [{ id: 'p', bookId: 'b', paragraphIndex: 1, text: 'كتاب العلم' }] }).ok).toBe(true)
    const response = handle({ requestId: '2', type: 'search', shardId: 'portable/shard', query: 'العلم', limit: 20 })
    expect(response).toMatchObject({ ok: true, value: { total: 1, hits: [{ id: 'p' }] } })
  })
})
