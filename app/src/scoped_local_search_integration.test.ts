import {afterEach,it,expect,vi} from 'vitest'
import {zipSync,strToU8} from 'fflate'
import type {StoredBook} from './engine/library_store'
const state=vi.hoisted(()=>({scope:'user:A',books:vi.fn(),remote:vi.fn()}))
vi.mock('./engine/library_store',()=>({canonicalAuthorName:(value:string)=>value,currentLibraryIdentityScope:()=>state.scope,listStoredBooks:state.books,listBooks:vi.fn(()=>{throw Error('catalog forbidden')}),listAuthorRecords:async()=>[]}))
vi.mock('./shamela_search_client',()=>({shamelaSearchClient:()=>({searchCompleteV2:state.remote})}))
vi.mock('./shamela_author_metadata',()=>({loadShamelaAuthorMetadata:()=>{throw Error('metadata forbidden')}}))
afterEach(()=>{vi.doUnmock('./engine/scoped_content_index');vi.resetModules();vi.clearAllMocks();state.scope='user:A'})
const book=(x:Partial<StoredBook>={}):StoredBook=>({id:'local-a',title:'عنوان',author:'مؤلف',sourceFormat:'text',fileName:'a.txt',data:strToU8('عالم عالم'),ownerScope:'user:A',...x} as StoredBook)
const options={fields:['body'] as ['body'],contentScope:'body' as const,bookIds:['local-a']}
function word(){const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';return book({sourceFormat:'word',fileName:'a.docx',data:zipSync({'word/document.xml':strToU8(`<w:document xmlns:w="${ns}"><w:body><w:p><w:r><w:t>عالم مستبعد</w:t></w:r><w:r><w:footnoteReference w:id="7"/></w:r><w:r><w:footnoteReference w:id="8"/></w:r></w:p></w:body></w:document>`),'word/footnotes.xml':strToU8(`<w:footnotes xmlns:w="${ns}"><w:footnote w:id="7"><w:p><w:r><w:t>عالم عالم</w:t></w:r></w:p></w:footnote><w:footnote w:id="8"><w:p><w:r><w:t>عالم آخر</w:t></w:r></w:p></w:footnote><w:footnote w:id="9"><w:p><w:r><w:t>عالم يتيم</w:t></w:r></w:p></w:footnote></w:footnotes>`)})})}
it('counts before pagination and returns body text only without catalog or remote calls',async()=>{
 state.books.mockResolvedValue([book()]);const {searchAllBooks}=await import('./engine/search_store')
 const result=await searchAllBooks('عالم',{...options,resultOffset:0,resultLimit:1});expect(result).toHaveLength(1);expect(result.totalOccurrences).toBe(2);expect(result.coverageComplete).toBe(true);expect(result[0]?.occurrenceCount).toBe(2)
 expect(await searchAllBooks('عالم',{...options,contentScope:'foot'})).toHaveLength(0);expect(state.remote).not.toHaveBeenCalled()
})
it('keeps distinct Word notes sharing one anchor separate, retains missing anchors and segment-local exclusions',async()=>{
 state.books.mockResolvedValue([word()]);const {searchAllBooks}=await import('./engine/search_store')
 const result=await searchAllBooks('عالم -"مستبعد"',{...options,contentScope:'foot',fields:['body','heading','tag'],resultLimit:2})
 expect(result).toHaveLength(2);expect(result.totalOccurrences).toBe(4);expect(result[0]?.paraIndex).toBe(result[1]?.paraIndex);expect(new Set(result.map(x=>x.resultKey)).size).toBe(2);expect(result.every(x=>x.field==='body')).toBe(true)
 const rest=await searchAllBooks('عالم',{...options,contentScope:'foot',resultOffset:2,resultLimit:1});expect(rest[0]?.paraIndex).toBe(-1);expect(rest[0]?.pageIndex).toBeUndefined();expect(rest.totalOccurrences).toBe(4)
 expect(await searchAllBooks('عالم آخر عالم',{...options,contentScope:'foot'})).toHaveLength(0)
})
it('applies metadata filters without leaking structural hits into selected text',async()=>{
 state.books.mockResolvedValue([book({author:'آخر',category:'فقه',tags:[{name:'عالم',source:'manual'}] as any})]);const {searchAllBooks}=await import('./engine/search_store')
 const result=await searchAllBooks('عالم',{...options,authors:['غيره']});expect(result).toHaveLength(0);expect(result.coverageComplete).toBe(true)
})
it('marks legacy unclassified sources unavailable instead of concluding an exact zero',async()=>{
 state.books.mockResolvedValue([book({sourceFormat:'pdf',fileName:'a.pdf',extractedText:'عالم'})]);const {searchAllBooks}=await import('./engine/search_store');const result=await searchAllBooks('عالم',options)
 expect(result).toHaveLength(0);expect(result.coverageComplete).toBe(false);expect(result.unavailableBookIds).toEqual(['local-a'])
})
it('rejects global, unknown, another identity and central selections before any search',async()=>{
 state.books.mockResolvedValue([book(),book({id:'410000123',sourceKind:'shamela4.1'})]);const {searchAllBooks}=await import('./engine/search_store')
 for(const bookIds of [undefined,[],['unknown'],['account-b-private'],['410000123'],['local-a','unknown']])await expect(searchAllBooks('عالم',{...options,bookIds})).rejects.toThrow('search_content_scope_index_unavailable')
 expect(state.remote).not.toHaveBeenCalled()
})
it('rejects identity changes across the stored-books await',async()=>{
 let finish!:(x:StoredBook[])=>void;state.books.mockImplementation(()=>new Promise(resolve=>{finish=resolve}));const {searchAllBooks}=await import('./engine/search_store')
 const pending=expect(searchAllBooks('عالم',options)).rejects.toThrow('Search superseded');await Promise.resolve();state.scope='user:B';finish([book()]);await pending
})
it('rejects a late scoped extractor result after switching identities',async()=>{
 state.books.mockResolvedValue([book()]);let finish!:(x:unknown)=>void
 vi.doMock('./engine/scoped_content_index',()=>({scopedContentIndex:()=>new Promise(resolve=>{finish=resolve})}))
 const {searchAllBooks}=await import('./engine/search_store'),pending=expect(searchAllBooks('عالم',options)).rejects.toThrow('Search superseded')
 await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));state.scope='user:B';finish({segments:[{key:'one',text:'عالم',kind:'body',anchorIndex:0}],complete:true,issues:[]});await pending
})
