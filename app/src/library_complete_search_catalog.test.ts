import {afterEach,it,expect,vi} from 'vitest'
const state=vi.hoisted(()=>({read:vi.fn(),scope:'A'}))
vi.mock('./account_authority',()=>({currentAccountClaims:()=>({subject:state.scope}),requireAccountPermission:vi.fn()}))
vi.mock('./session_identity',()=>({identityScope:(x:any)=>`user:${x.userId}`,guestSessionIdentity:()=>({kind:'guest',sessionId:'test'})}))
vi.mock('./shamela_pack_seed',()=>({readCompleteShamelaLibraryCatalog:state.read,materializeAvailableShamelaCatalogBooks:(x:any)=>x,loadCentralBookOverrides:async()=>[],applyCentralOverridesToBookList:(x:any)=>x}))
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();vi.clearAllMocks();state.scope='A'})
function setup(extra:unknown[]=[]){
 const local={id:'private',title:'خاص',author:'أ',data:[],ownerScope:'user:A'}
 vi.stubGlobal('indexedDB',{open:()=>{const req:any={result:{transaction:()=>({objectStore:()=>({getAll:()=>{const r:any={result:[local,...extra]};queueMicrotask(()=>r.onsuccess());return r}})})}};queueMicrotask(()=>req.onsuccess());return req}})
 return local
}
it('preserves legacy partial fallback but rejects it for strict concurrent consumers and retry',async()=>{
 setup();state.read.mockRejectedValue(Error('offline'));const {listBooks}=await import('./engine/library_store')
 const legacy=listBooks(),strict=listBooks({requireCompleteCatalog:true})
 await expect(strict).rejects.toThrow('search_catalog_unavailable');expect((await legacy).map(b=>b.id)).toEqual(['private'])
 await expect(listBooks({requireCompleteCatalog:true})).rejects.toThrow('search_catalog_unavailable')
 expect(state.read).toHaveBeenCalledTimes(2)
})
it('strict success preserves private and other published records alongside the verified central corpus',async()=>{
 setup([{id:'published-non-shamela',title:'منشور آخر',author:'ب',data:[],managedSource:'published'}]);state.read.mockResolvedValue([{entry:{id:'central',title:'عام',author:'أ',data:[],managedSource:'published'}}]);const {listBooks}=await import('./engine/library_store')
 expect((await listBooks({requireCompleteCatalog:true})).map(b=>b.id)).toEqual(['central','private','published-non-shamela'])
 expect((await listBooks({requireCompleteCatalog:true})).length).toBe(3);expect(state.read).toHaveBeenCalledTimes(1)
})
it('does not deliver identity A records to a strict consumer after switching to B',async()=>{
 setup();let finish!:(x:unknown[])=>void;state.read.mockImplementation(()=>new Promise(resolve=>{finish=resolve}));const {listBooks}=await import('./engine/library_store')
 const pending=expect(listBooks({requireCompleteCatalog:true})).rejects.toThrow('search_catalog_identity_changed')
 await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));state.scope='B';finish([]);await pending
})
