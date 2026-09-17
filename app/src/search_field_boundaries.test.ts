import { describe, expect, it } from 'vitest'
import { SearchFieldBoundaries } from './search_field_boundaries'

describe('source-bound body/foot postings consumer (not globally activated)', () => {
  const index = () => new SearchFieldBoundaries([['21633:1', 2, 7, 11]])
  it('excludes synthetic title but preserves actual body and foot occurrences', () => {
    expect(index().phraseStarts('21633:1', [[0, 2, 5, 7, 9]], 'body')).toEqual([2, 5])
    expect(index().phraseStarts('21633:1', [[0, 2, 5, 7, 9]], 'foot')).toEqual([7, 9])
  })
  it('cannot join a phrase across title/body or body/foot boundaries', () => {
    expect(index().phraseStarts('21633:1', [[1, 3, 6, 8], [2, 4, 7, 9]], 'body')).toEqual([3])
    expect(index().phraseStarts('21633:1', [[1, 3, 6, 8], [2, 4, 7, 9]], 'foot')).toEqual([8])
  })
  it('counts repeated words exactly and never joins non-adjacent matches', () => {
    expect(index().phraseStarts('21633:1', [[2, 3, 4, 6], [2, 3, 4, 6]], 'body')).toEqual([2, 3])
    expect(index().phraseStarts('21633:1', [[2], [4]], 'body')).toEqual([])
  })
  it('distinguishes verified empty field from absent evidence', () => {
    expect(new SearchFieldBoundaries([['1:0', 0, 3, 3]]).phraseStarts('1:0', [[1]], 'foot')).toEqual([])
    expect(() => index().phraseStarts('999:0', [[0]], 'body')).toThrow('search_field_boundary_missing')
  })
  it('fails closed for malformed boundaries or corrupted postings', () => {
    expect(() => new SearchFieldBoundaries([['1:0', 4, 3, 9]])).toThrow()
    expect(() => new SearchFieldBoundaries([['1:0', 0, 1, 1], ['1:0', 0, 1, 1]])).toThrow()
    for (const positions of [[-1], [11], [2, 2], [1.5], [NaN]]) expect(() => index().phraseStarts('21633:1', [positions], 'body')).toThrow('search_field_posting_invalid')
  })
  it('snapshots source boundaries so later mutation cannot alter field ownership', () => {
    const row: [string, number, number, number] = ['1:0', 2, 7, 11], selected = new SearchFieldBoundaries([row]); row[1] = 0
    expect(selected.phraseStarts('1:0', [[0, 2]], 'body')).toEqual([2])
  })
})
