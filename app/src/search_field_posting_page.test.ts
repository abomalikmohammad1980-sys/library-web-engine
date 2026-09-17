import { expect, it, vi } from 'vitest'
import { SearchFieldBoundaries } from './search_field_boundaries'
import { searchFieldPostingPage } from './search_field_posting_page'
const options = () => ({ query: 'علم', scope: 'body' as const, offset: 0, limit: 1,
  boundaries: new SearchFieldBoundaries([['1:0', 1, 3, 4], ['2:0', 1, 2, 3], ['3:0', 1, 2, 3]]),
  candidates: [{ id: '1:0', deathYearHijri: 100, positionsByQueryWord: [[0, 1, 2, 3]] }, { id: '2:0', deathYearHijri: 200, positionsByQueryWord: [[0, 2]] }, { id: '3:0', deathYearHijri: 300, positionsByQueryWord: [[1]] }],
  coverage: { complete: true, unavailableBookIds: [] },
  hydrate: vi.fn(async (id: string) => id === '1:0' ? { fullText: 'علم\n\nعلم علم\n\nعلم', range: [5, 12] as const } : { fullText: 'باب\n\nعلم\n\nشرح', range: [5, 8] as const }),
})
it('filters fields before total and paragraph pagination, hydrating only selected rows', async () => {
  const input = options(), first = await searchFieldPostingPage(input)
  expect(first.totalDocuments).toBe(2); expect(first.totalOccurrences).toBe(3); expect(first.hits.map(x => x.id)).toEqual(['1:0'])
  expect(first.hits[0]?.occurrenceCount).toBe(2); expect(input.hydrate).toHaveBeenCalledTimes(1)
  const next = await searchFieldPostingPage({ ...input, offset: 1 })
  expect(next.hits.map(x => x.id)).toEqual(['3:0']); expect(next.totalDocuments).toBe(2)
})
it('missing document evidence and incomplete release never become complete negative results', async () => {
  const input = options()
  input.candidates.push({ id: '4:0', deathYearHijri: 400, positionsByQueryWord: [[1]] })
  const found = await searchFieldPostingPage(input)
  expect(found.coverageComplete).toBe(false); expect(found.unavailableBookIds).toEqual(['4'])
  expect((await searchFieldPostingPage({ ...options(), coverage: { complete: false, unavailableBookIds: [] } })).coverageComplete).toBe(false)
})
it('source mismatch or cancellation cannot silently return a partial successful page', async () => {
  const input = options(); input.hydrate = vi.fn(async () => ({ fullText: 'نص مختلف', range: [0, 8] as const }))
  await expect(searchFieldPostingPage(input)).rejects.toThrow('search_field_source_posting_mismatch')
  const controller = new AbortController(); controller.abort()
  await expect(searchFieldPostingPage({ ...options(), signal: controller.signal })).rejects.toThrow()
})

it('accepts a bounded release-pinned book provider before counting and pagination', async () => {
  const input = options(), book = vi.fn(async (id: string) => id === '2' ? undefined : input.boundaries)
  const found = await searchFieldPostingPage({ ...input, boundaries: { book }, offset: 1 })
  expect(book.mock.calls.map(call => call[0])).toEqual(['1', '2', '3'])
  expect(found.hits.map(hit => hit.id)).toEqual(['3:0'])
  expect(found.totalOccurrences).toBe(3)
  expect(found.totalDocuments).toBe(2)
  expect(found.coverageComplete).toBe(false)
  expect(found.unavailableBookIds).toEqual(['2'])
  expect(input.hydrate).toHaveBeenCalledTimes(1)
})

it('does not hydrate or return a partial count after provider failure or cancellation', async () => {
  const input = options(), controller = new AbortController()
  await expect(searchFieldPostingPage({ ...input, boundaries: { book: async () => { throw Error('search_field_overlay_checksum') } } })).rejects.toThrow('search_field_overlay_checksum')
  await expect(searchFieldPostingPage({ ...input, signal: controller.signal, boundaries: { book: async () => { controller.abort(); return input.boundaries } } })).rejects.toThrow()
  expect(input.hydrate).not.toHaveBeenCalled()
})

it('keeps all 1300 matching paragraphs reachable in 100-row pages', async () => {
  const rows = Array.from({ length: 1300 }, (_, index) => [`1:${index}`, 1, 2, 2] as const)
  const boundaries = new SearchFieldBoundaries(rows)
  const candidates = rows.map(([id]) => ({ id, positionsByQueryWord: [[1]] }))
  const hydrate = vi.fn(async () => ({ fullText: 'باب علم', range: [4, 7] as const }))
  const found = new Set<string>()
  for (let offset = 0; offset < 1300; offset += 100) {
    const page = await searchFieldPostingPage({ query: 'علم', scope: 'body', offset, limit: 100, boundaries, candidates, coverage: { complete: true, unavailableBookIds: [] }, hydrate })
    expect(page.totalDocuments).toBe(1300)
    expect(page.hits).toHaveLength(100)
    for (const hit of page.hits) { expect(found.has(hit.id)).toBe(false); found.add(hit.id) }
  }
  expect(found.size).toBe(1300)
  expect(hydrate).toHaveBeenCalledTimes(1300)
})
