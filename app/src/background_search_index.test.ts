import {beforeEach,afterEach,expect,it,vi} from 'vitest'
const state=vi.hoisted(()=>({identity:'a',route:{hash:'#/library'},books:[] as any[],stored:vi.fn(),heading:vi.fn(),prepare:vi.fn()}))
vi.mock('./path_location',()=>({routeLocation:state.route}))
vi.mock('./engine/library_store',()=>({currentLibraryIdentityScope:()=>state.identity,listStoredBooks:state.stored,listBooks:()=>{throw Error('background_must_not_fetch_public_catalog')}}))
vi.mock('./engine/heading_index',()=>({headingIndex:state.heading}))
vi.mock('./engine/search_store',()=>({prepareLocalBookSearchIndex:state.prepare}))
import {installBackgroundSearchIndex} from './background_search_index'
beforeEach(()=>{state.route.hash='#/library';state.stored.mockReset().mockImplementation(async()=>state.books);vi.stubGlobal('document',Object.assign(new EventTarget(),{visibilityState:'visible'}));state.heading.mockReset().mockResolvedValue({complete:true});state.prepare.mockReset().mockResolvedValue(undefined)})
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.clearAllMocks();state.identity='a'})
it('automatically retries a failed revision instead of recording it as prepared',async()=>{
 vi.useFakeTimers();vi.stubGlobal('window',new EventTarget())
 state.books=[{id:'retry',sourceFormat:'word',data:new Uint8Array([1])}]
 state.heading.mockResolvedValue({complete:true});state.prepare.mockRejectedValueOnce(Error('offline')).mockResolvedValue(undefined)
 const stop=installBackgroundSearchIndex();await vi.advanceTimersByTimeAsync(6500)
 expect(state.prepare).toHaveBeenCalledTimes(2)
 window.dispatchEvent(new Event('library-changed'));await vi.advanceTimersByTimeAsync(3300)
 expect(state.prepare).toHaveBeenCalledTimes(2);stop()
})
it('prepares local files once per revision, skips remote books and never extracts PDF text',async()=>{
 vi.useFakeTimers();vi.stubGlobal('window',new EventTarget())
 state.books=[{id:'word',sourceFormat:'word',data:new Uint8Array([1]),originalSha256:'a'},{id:'pdf',sourceFormat:'pdf',data:new Uint8Array([1])},{id:'remote',data:new Uint8Array()}]
 const stop=installBackgroundSearchIndex()
 await vi.advanceTimersByTimeAsync(3300)
 expect(state.heading).toHaveBeenCalledTimes(2)
 expect(state.prepare.mock.calls.map(call=>call[0])).toEqual(['word'])
 window.dispatchEvent(new Event('library-changed'));await vi.advanceTimersByTimeAsync(3300)
 expect(state.heading).toHaveBeenCalledTimes(2)
 state.books[0].originalSha256='b'
 window.dispatchEvent(new Event('library-changed'));await vi.advanceTimersByTimeAsync(3300)
 expect(state.heading).toHaveBeenCalledTimes(3)
 stop()
})
it('retries incomplete outlines automatically without treating successful body indexing as complete coverage',async()=>{
 vi.useFakeTimers();vi.stubGlobal('window',new EventTarget())
 state.books=[{id:'incomplete',sourceFormat:'word',data:new Uint8Array([1])}]
 state.heading.mockResolvedValueOnce({complete:false}).mockResolvedValue({complete:true})
 const stop=installBackgroundSearchIndex();await vi.advanceTimersByTimeAsync(6500)
 expect(state.heading).toHaveBeenCalledTimes(2);expect(state.prepare).toHaveBeenCalledTimes(2)
 window.dispatchEvent(new Event('library-changed'));await vi.advanceTimersByTimeAsync(3300)
 expect(state.heading).toHaveBeenCalledTimes(2);stop()
})
it('bounds corrupt outline retries and resumes after connectivity returns, never reading PDF body text',async()=>{
 vi.useFakeTimers();vi.stubGlobal('window',new EventTarget())
 state.books=[{id:'pdf',sourceFormat:'pdf',data:new Uint8Array([1])}]
 state.heading.mockResolvedValue({complete:false})
 const stop=installBackgroundSearchIndex();await vi.advanceTimersByTimeAsync(15000)
 expect(state.heading).toHaveBeenCalledTimes(3);expect(state.prepare).not.toHaveBeenCalled()
 state.heading.mockResolvedValue({complete:true});window.dispatchEvent(new Event('online'))
 await vi.advanceTimersByTimeAsync(3300);expect(state.heading).toHaveBeenCalledTimes(4);stop()
})
it('does not continue indexing another account after an identity change',async()=>{
 vi.useFakeTimers();vi.stubGlobal('window',new EventTarget())
 state.books=[{id:'one',sourceFormat:'word',data:new Uint8Array([1])},{id:'two',sourceFormat:'word',data:new Uint8Array([1])}]
 state.heading.mockImplementationOnce(async()=>{state.identity='b'})
 const stop=installBackgroundSearchIndex();await vi.advanceTimersByTimeAsync(3300)
 expect(state.heading).toHaveBeenCalledTimes(1);expect(state.prepare).not.toHaveBeenCalled();stop()
})
it('never clones the stored library on reader startup, including library and online events',async()=>{
 vi.useFakeTimers();vi.stubGlobal('window',new EventTarget());state.route.hash='#/reader/2146'
 const stop=installBackgroundSearchIndex()
 window.dispatchEvent(new Event('library-changed'));window.dispatchEvent(new Event('online'))
 await vi.advanceTimersByTimeAsync(10000)
 expect(state.stored).not.toHaveBeenCalled();expect(state.heading).not.toHaveBeenCalled();stop()
})
it('rechecks the route before a pending scan and resumes on returning to the library',async()=>{
 vi.useFakeTimers();vi.stubGlobal('window',new EventTarget());state.books=[]
 const stop=installBackgroundSearchIndex();state.route.hash='#/reader/2146'
 await vi.advanceTimersByTimeAsync(3300);expect(state.stored).not.toHaveBeenCalled()
 state.route.hash='#/library';window.dispatchEvent(new Event('popstate'))
 await vi.advanceTimersByTimeAsync(3300);expect(state.stored).toHaveBeenCalledTimes(1);stop()
})
it('pauses hidden tabs before reading stored bytes and resumes when visible',async()=>{
 vi.useFakeTimers();vi.stubGlobal('window',new EventTarget());state.books=[]
 const stop=installBackgroundSearchIndex();Object.assign(document,{visibilityState:'hidden'})
 document.dispatchEvent(new Event('visibilitychange'));await vi.advanceTimersByTimeAsync(3300)
 expect(state.stored).not.toHaveBeenCalled()
 Object.assign(document,{visibilityState:'visible'});document.dispatchEvent(new Event('visibilitychange'))
 await vi.advanceTimersByTimeAsync(3300);expect(state.stored).toHaveBeenCalledTimes(1);stop()
})
it('stops further parsing when navigating to a reader during a scan',async()=>{
 vi.useFakeTimers();vi.stubGlobal('window',new EventTarget())
 state.books=[{id:'one',sourceFormat:'word',data:new Uint8Array([1])},{id:'two',sourceFormat:'word',data:new Uint8Array([1])}]
 state.heading.mockImplementationOnce(async()=>{state.route.hash='#/reader/2146';window.dispatchEvent(new Event('popstate'));return {complete:true}})
 const stop=installBackgroundSearchIndex();await vi.advanceTimersByTimeAsync(10000)
 expect(state.heading).toHaveBeenCalledTimes(1);expect(state.prepare).not.toHaveBeenCalled();stop()
})

it('does not clone or parse stored books while the import dialog is open; resumes after close',async()=>{
 vi.useFakeTimers();vi.stubGlobal('window',new EventTarget());let open=true;
 Object.assign(document,{querySelector:()=>open?{}:null});state.books=[{id:'local-word',sourceFormat:'word',data:new Uint8Array([1])}];
 const stop=installBackgroundSearchIndex();await vi.advanceTimersByTimeAsync(10000);
 expect(state.stored).not.toHaveBeenCalled();expect(state.heading).not.toHaveBeenCalled();
 open=false;window.dispatchEvent(new Event('alkhizana:import-activity'));await vi.advanceTimersByTimeAsync(3300);
 expect(state.heading).toHaveBeenCalledOnce();stop();
})

it('cancels a scheduled scan when the dialog opens before its timer fires',async()=>{
 vi.useFakeTimers();vi.stubGlobal('window',new EventTarget());let open=false;
 Object.assign(document,{querySelector:()=>open?{}:null});const stop=installBackgroundSearchIndex();
 open=true;window.dispatchEvent(new Event('alkhizana:import-activity'));await vi.advanceTimersByTimeAsync(10000);
 expect(state.stored).not.toHaveBeenCalled();stop();
})
