import {afterEach,describe,it,expect,vi} from 'vitest'
vi.mock('./engine/library_store',()=>({currentLibraryIdentityScope:()=> 'guest:fixture',getBook:vi.fn(),listBooks:vi.fn(),listAuthorRecords:async()=>[],canonicalAuthorName:(value:string)=>value}))
import {listBooks,getBook,type StoredBook} from './engine/library_store'
import {searchAllBooks,prepareLocalBookSearchIndex} from './engine/search_store'
import {configureCentralHeadingSearch} from './central_heading_integration'
import * as chronology from './search_author_metadata'
afterEach(()=>configureCentralHeadingSearch(undefined))
describe('structural central federation',()=>{
 it('finishes heading search when an unrelated body index is prepared in the background',async()=>{
  vi.mocked(listBooks).mockResolvedValue([{id:'410000001',title:'كتاب',author:'مؤلف'}] as StoredBook[])
  const local={id:'local-fixture',title:'نص',author:'مؤلف',sourceFormat:'text',fileName:'test.txt',data:new TextEncoder().encode('متن محلي'),originalSha256:'fixture'} as StoredBook
  vi.mocked(getBook).mockResolvedValue(local)
  let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve})
  const search=vi.fn(async()=>{await pending;return {total:0,totalExact:true,coverageComplete:true,indexedBooks:1,hits:[]}})
  configureCentralHeadingSearch({releaseId:'fixture',coveredBookIds:new Set(['410000001']),client:{search}})
  const result=searchAllBooks('الحج عرفة',{fields:['heading']})
  await vi.waitFor(()=>expect(search).toHaveBeenCalled())
  await prepareLocalBookSearchIndex(local.id);release()
  await expect(result).resolves.toHaveLength(0)
 })
 it('does not resolve author biographies for thousands of nonmatching metadata cards',async()=>{
  vi.stubGlobal('window',{setTimeout})
  const spy=vi.spyOn(chronology,'searchAuthorChronology')
  try{
   vi.mocked(listBooks).mockResolvedValue(Array.from({length:1000},(_,n)=>({id:`private-${n}`,title:'كتاب',author:'مؤلف',description:'بطاقة غير مطابقة',textToc:[],tags:[]} as unknown as StoredBook)))
   configureCentralHeadingSearch({releaseId:'fixture',coveredBookIds:new Set(),client:{search:vi.fn()}})
   const rows=await searchAllBooks('الحج عرفة',{fields:['heading','tag','category','card']})
   expect(rows).toHaveLength(0);expect(spy).not.toHaveBeenCalled()
  }finally{spy.mockRestore();vi.unstubAllGlobals()}
 })
 it('keeps metadata independent, suppresses covered local TOC and pages exact row totals',async()=>{
  vi.mocked(listBooks).mockResolvedValue([{id:'410000001',title:'النسخ',author:'مؤلف',category:'علوم القرآن',tags:[],fileName:'a.bok',bokToc:[{id:1,title:'النسخ المحلي يجب ألا يظهر'}],bokPages:[]},{id:'private',title:'خاص',author:'مؤلف',tags:[],fileName:'b.txt',textToc:[{title:'النسخ الخاص',paragraphIndex:0}]}] as unknown as StoredBook[])
  const search=vi.fn(async(_query:string,options:any)=>({total:2,totalExact:true,coverageComplete:true,indexedBooks:1,hits:[1,2].slice(options.offset,options.offset+options.limit).map(n=>({rowId:n,bookId:'1',titleId:String(n),parentTitleId:null,title:`النسخ ${n}`,pageIndex:0,pageLabel:'1',partLabel:'1',sequence:n,pageSourceId:'1'}))}))
  configureCentralHeadingSearch({client:{search},coveredBookIds:new Set(['410000001']),releaseId:'fixture'})
  const first=await searchAllBooks('النسخ',{fields:['heading'],resultLimit:2})
  expect(first.map(row=>row.matchText)).toEqual(['النسخ الخاص','النسخ 1']);expect(first.totalOccurrences).toBe(3)
  expect(first.map(row=>row.bookId)).toEqual(['private','410000001'])
  const second=await searchAllBooks('النسخ',{fields:['heading'],resultOffset:2,resultLimit:2})
  expect(second.map(row=>row.matchText)).toEqual(['النسخ 2']);expect(second.totalOccurrences).toBe(3)
  expect(search.mock.calls[0]?.[1].bookIds).toBeUndefined()
  await searchAllBooks('النسخ',{fields:['heading'],bookIds:['410000001']})
  expect(search.mock.calls.at(-1)?.[1].bookIds).toEqual(['1'])
  const fixture=await listBooks();fixture[0]!.description='النسخ في بطاقة الكتاب'
  // Fresh immutable snapshot, as returned by the store after metadata changes.
  vi.mocked(listBooks).mockResolvedValue(fixture.map(book=>({...book})))
  const withCard=await searchAllBooks('النسخ',{fields:['heading','card'],resultLimit:10})
  expect(withCard.filter(row=>row.field==='card')).toHaveLength(1)
  expect(withCard.filter(row=>row.field==='heading')).toHaveLength(3)
  expect(withCard.totalOccurrences).toBe(4)
  const excludedScope=await searchAllBooks('النسخ',{fields:['heading'],bookIds:['private']})
  expect(excludedScope.map(row=>row.matchText)).toEqual(['النسخ الخاص'])
 })
})
