import { afterEach, expect, it, vi } from 'vitest'
import { strToU8 } from 'fflate'
const state = vi.hoisted(() => ({ books: vi.fn(), remote: vi.fn(), broad: vi.fn() }))
vi.mock('./engine/library_store', () => ({ canonicalAuthorName: (v: string) => v, currentLibraryIdentityScope: () => 'user:A', listStoredBooks: state.books, listBooks: async () => [], listAuthorRecords: async () => [] }))
vi.mock('./shamela_search_client', () => ({ shamelaSearchClient: () => ({ searchSeparatedV2: state.remote, searchCompleteV2: state.broad }) }))
vi.mock('./shamela_author_metadata', () => ({ loadShamelaAuthorMetadata: async () => ({ authors: [{ name: 'مؤلف', deathYearHijri: 100, books: [{ sourceBookId: '123', title: 'كتاب' }] }] }) }))
const enable = () => vi.stubGlobal('__KHIZANA_SEARCH_FIELDS__', { complete: true, manifestUrl: 'https://fields.test/manifest.json', manifestSha256: 'a'.repeat(64), sourceIndexSha256: 'b'.repeat(64), packedManifestSha256: 'c'.repeat(64), packedReleaseId: 'test', expectedBooks: 1, expectedSegments: 1 })
const hits = Array.from({ length: 1300 }, (_, i) => ({ id: `123:${i}`, bookId: '123', paragraphIndex: i, text: 'عالم', matchOffset: 0, deathYearHijri: 100, occurrenceCount: 2 }))
function prepare() {
  enable(); state.books.mockResolvedValue([])
  state.remote.mockImplementation(async (_q, _scope, _binding, offset, limit) => ({ hits: hits.slice(offset, offset + limit), totalDocuments: 1300, totalOccurrences: 2600, coverageComplete: true }))
}
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); vi.clearAllMocks() })
it('routes a global field query only to the pinned adapter and pages beyond 40', async () => {
  prepare(); const { searchAllBooks } = await import('./engine/search_store')
  const result = await searchAllBooks('عالم', { fields: ['body'], contentScope: 'foot', resultOffset: 1200, resultLimit: 100 })
  expect(result).toHaveLength(100); expect(result[0]?.paraIndex).toBe(1200)
  expect(result.totalDocuments).toBe(1300); expect(result.totalOccurrences).toBe(2600); expect(result.coverageComplete).toBe(true)
  expect(state.remote.mock.calls.map(call => call[3])).toEqual([0, 500, 1000]); expect(state.broad).not.toHaveBeenCalled()
})
it('merges local structural matches before central pagination without dropping or duplicating rows', async () => {
  prepare(); state.books.mockResolvedValue([{ id: 'local-a', title: 'محلي', author: 'قديم', deathYearHijri: 50, sourceFormat: 'text', fileName: 'a.txt', data: strToU8('عالم'), ownerScope: 'user:A' }])
  const { searchAllBooks } = await import('./engine/search_store')
  const first = await searchAllBooks('عالم', { fields: ['body'], contentScope: 'body', resultLimit: 100 })
  const second = await searchAllBooks('عالم', { fields: ['body'], contentScope: 'body', resultOffset: 100, resultLimit: 100 })
  expect(first[0]?.bookId).toBe('local-a'); expect(first[99]?.paraIndex).toBe(98); expect(second[0]?.paraIndex).toBe(99)
  expect(second.totalDocuments).toBe(1301); expect(second.totalOccurrences).toBe(2601)
})
it('fails closed on adapter errors rather than falling back to unsplit text', async () => {
  prepare(); state.remote.mockRejectedValue(Error('search_field_release_mismatch'))
  const { searchAllBooks } = await import('./engine/search_store')
  await expect(searchAllBooks('عالم', { fields: ['body'], contentScope: 'body' })).rejects.toThrow('search_field_release_mismatch')
  expect(state.broad).not.toHaveBeenCalled()
})

it('applies exclusions to the full scoped stream before page counts', async () => {
  prepare()
  const excluded = hits.map((hit, index) => ({ ...hit, text: index % 2 ? 'عالم مستبعد' : 'عالم' }))
  state.remote.mockImplementation(async (_q, _scope, _binding, offset, limit) => ({ hits: excluded.slice(offset, offset + limit), totalDocuments: 1300, totalOccurrences: 2600, coverageComplete: true }))
  const { searchAllBooks } = await import('./engine/search_store')
  const page = await searchAllBooks('عالم -"مستبعد"', { fields: ['body'], contentScope: 'body', resultOffset: 600, resultLimit: 100 })
  expect(page).toHaveLength(50); expect(page[0]?.paraIndex).toBe(1200)
  expect(page.totalDocuments).toBe(650); expect(page.totalOccurrences).toBe(1300)
})
it('keeps all remote and uploaded paragraphs reachable across mixed provider pages',async()=>{
 prepare();vi.stubGlobal('__PUBLIC_BOOK_SEARCH_ENABLED__',true)
 state.broad.mockImplementation(async(_q,offset,limit)=>({hits:hits.slice(offset,offset+limit),total:1300,coverageComplete:true,unavailableBookIds:[],pendingBookIds:[]}))
 vi.stubGlobal('fetch',async(input:string)=>{const p=new URL(input,'https://example.test').searchParams,offset=Number(p.get('offset'));return Response.json({contract:'public-book-search/1',snapshot:'7',coverageComplete:true,totalDocuments:1300,hits:Array.from({length:100},(_,i)=>({bookId:'uploaded',generation:1,field:'body',ordinal:offset+i,title:'كتاب مرفوع',author:'مؤلف',snippet:'عالم',anchor:{paragraphIndex:offset+i}}))})})
 const {searchAllBooks}=await import('./engine/search_store');const identities=[]
 for(let offset=0;offset<1300;offset+=100){const page=await searchAllBooks('عالم',{fields:['body'],resultOffset:offset,resultLimit:100});expect(page).toHaveLength(200);expect(page.totalOccurrences).toBe(2600);identities.push(...page.map(row=>row.bookId+':'+row.paraIndex))}
 expect(new Set(identities).size).toBe(2600)
})
