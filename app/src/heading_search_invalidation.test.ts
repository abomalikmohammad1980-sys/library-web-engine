import {afterAll,afterEach,expect,it,vi} from 'vitest'
const state=vi.hoisted(()=>({scope:'guest:fixture'}))
vi.mock('./engine/library_store',()=>({currentLibraryIdentityScope:()=>state.scope,listBooks:async()=>[{id:'410000001',title:'كتاب',author:'مؤلف'}],listAuthorRecords:async()=>[],canonicalAuthorName:(value:string)=>value}))
const events=Object.assign(new EventTarget(),{setTimeout})
vi.stubGlobal('window',events)
const {searchAllBooks}=await import('./engine/search_store')
const {configureCentralHeadingSearch}=await import('./central_heading_integration')
afterEach(()=>{configureCentralHeadingSearch(undefined);state.scope='guest:fixture'})
afterAll(()=>vi.unstubAllGlobals())
for(const change of ['library','account'])it(`still cancels heading results on a real ${change} change`,async()=>{
 let release!:()=>void;const wait=new Promise<void>(resolve=>{release=resolve})
 const search=vi.fn(async()=>{await wait;return {hits:[],total:0,totalExact:true,coverageComplete:true,indexedBooks:1}})
 configureCentralHeadingSearch({releaseId:'fixture',coveredBookIds:new Set(['410000001']),client:{search}})
 const pending=searchAllBooks('الحج',{fields:['heading']})
 const assertion=expect(pending).rejects.toThrow('Search superseded')
 await vi.waitFor(()=>expect(search).toHaveBeenCalled())
 if(change==='library')events.dispatchEvent(new Event('library-changed'))
 else state.scope='account:different'
 release();await assertion
})
