import {afterEach,it,expect,vi} from 'vitest'
const state=vi.hoisted(()=>({remote:vi.fn()}))
vi.mock('./engine/library_store',()=>({canonicalAuthorName:(v:string)=>v,currentLibraryIdentityScope:()=> 'public-fixture',listStoredBooks:async()=>[],listBooks:async()=>[],listAuthorRecords:async()=>[]}))
vi.mock('./shamela_search_client',()=>({shamelaSearchClient:()=>({searchCompleteV2:state.remote})}))
vi.mock('./shamela_author_metadata',()=>({loadShamelaAuthorMetadata:async()=>({authors:[{name:'مؤلف',books:[{sourceBookId:'123',title:'كتاب'}]}]})}))
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();vi.clearAllMocks()})
it('retains all2600 old-index and uploaded matches across mixed provider pages',async()=>{
 vi.stubGlobal('__PUBLIC_BOOK_SEARCH_ENABLED__',true)
 const hits=Array.from({length:1300},(_,i)=>({id:`123:${i}`,bookId:'123',paragraphIndex:i,text:'عالم',matchOffset:0}))
 state.remote.mockImplementation(async(_q,offset,limit)=>({hits:hits.slice(offset,offset+limit),total:1300,coverageComplete:true,unavailableBookIds:[],pendingBookIds:[]}))
 vi.stubGlobal('fetch',async(input:string)=>{const p=new URL(input,'https://example.test').searchParams,offset=Number(p.get('offset'));return Response.json({contract:'public-book-search/1',snapshot:'7',coverageComplete:true,totalDocuments:1300,hits:Array.from({length:100},(_,i)=>({bookId:'uploaded',generation:1,field:'body',ordinal:offset+i,title:'كتاب مرفوع',author:'مؤلف',snippet:'عالم',anchor:{paragraphIndex:offset+i}}))})})
 const {searchAllBooks}=await import('./engine/search_store');const identities=[]
 for(let offset=0;offset<1300;offset+=100){const page=await searchAllBooks('عالم',{fields:['body'],resultOffset:offset,resultLimit:100});expect(page).toHaveLength(200);expect(page.totalOccurrences).toBe(2600);identities.push(...page.map(row=>row.bookId+':'+row.paraIndex))}
 expect(new Set(identities).size).toBe(2600)
})
