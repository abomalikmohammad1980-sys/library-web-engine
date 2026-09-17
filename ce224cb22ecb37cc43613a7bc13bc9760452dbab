import {afterEach,expect,it,vi} from 'vitest'
const state=vi.hoisted(()=>({identity:'a',books:[] as any[],heading:vi.fn(),prepare:vi.fn()}))
vi.mock('./engine/library_store',()=>({currentLibraryIdentityScope:()=>state.identity,listBooks:async()=>state.books}))
vi.mock('./engine/heading_index',()=>({headingIndex:state.heading}))
vi.mock('./engine/search_store',()=>({prepareLocalBookSearchIndex:state.prepare}))
import {installBackgroundSearchIndex} from './background_search_index'
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.clearAllMocks();state.identity='a'})
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
it('does not continue indexing another account after an identity change',async()=>{
 vi.useFakeTimers();vi.stubGlobal('window',new EventTarget())
 state.books=[{id:'one',sourceFormat:'word',data:new Uint8Array([1])},{id:'two',sourceFormat:'word',data:new Uint8Array([1])}]
 state.heading.mockImplementationOnce(async()=>{state.identity='b'})
 const stop=installBackgroundSearchIndex();await vi.advanceTimersByTimeAsync(3300)
 expect(state.heading).toHaveBeenCalledTimes(1);expect(state.prepare).not.toHaveBeenCalled();stop()
})
