import {readFileSync} from 'node:fs'
import {transformSync} from 'esbuild'
import {expect,it,vi} from 'vitest'
import {createReaderIdlePrewarm,readerPrewarmRouteEligible} from './reader_idle_prewarm'
import {validRouteShape} from './route_shape'
import {legacyHashToPath,locationRouteHash} from './path_location'
const tick=()=>new Promise(resolve=>setTimeout(resolve,0))
function fixture(hash:string){
 const text=readFileSync(new URL('./router.ts',import.meta.url),'utf8')
 // Execute real parseHash/preloadRoute/render/renderReader/finishRoute. Only
 // module transport and DOM shell boundaries are deterministic substitutes.
 const code=transformSync(text.replace(/^import\b[^\r\n]*$/gm,'').replace(/^export\s*\{[^\r\n]+from[^\r\n]+$/gm,'').replaceAll('export ','').replace(/import\('\.\/screens\/([^']+)'\)/g,"loadScreen('$1')"),{loader:'ts'}).code
 const node=(kind:string,...children:unknown[])=>({kind,children,get firstElementChild(){return this.children[0]},replaceChildren(...next:unknown[]){this.children=next}})
 // Apply the same legacy-link migration as the app entry point. Subsequent
 // render/idle eligibility is driven by the History API pathname, not a fake hash.
 const location={pathname:'/',search:'',get hash(){return ''},set hash(value:string){const url=new URL(legacyHashToPath(value),'https://fixture.invalid');this.pathname=url.pathname;this.search=url.search},reload:vi.fn()};location.hash=hash
 const root=node('root'),queue:Array<()=>void>=[],loads:string[]=[],opened:string[]=[],failures=new Set<string>()
 const readerScreen=vi.fn((id:string)=>node('reader',id)),loadScreen=vi.fn(async(name:string)=>{
  loads.push(name);if(failures.has(name))throw Error('offline')
  if(name==='reader')return{readerScreen}
  return new Proxy({},{get:(_target,key)=>key==='then'?undefined:()=>node(String(key))})
 })
 const deps={validRouteShape,legacyHashToPath,locationRouteHash,routeLocation:{get hash(){return locationRouteHash(location)}},hydrateSubjectCategories:vi.fn(async()=>{}),hydrateAuthorDisplayNames:vi.fn(async()=>{}),prepareRouteScroll:()=>vi.fn(),bindPageMeta:()=>vi.fn(),readerLoadingPaper:()=>node('reader-loading'),loadScreen,createReaderIdlePrewarm,readerPrewarmRouteEligible,location,document:{visibilityState:'visible',getElementById:()=>root},window:{requestIdleCallback:(cb:()=>void)=>queue.push(cb)},history:{replaceState:vi.fn(),state:null},sessionStorage:{},recordBookOpened:(id:string)=>opened.push(id),resolveCanonicalBookDeepLink:()=>undefined,canonicalShamelaBookId:(id:string)=>id,decodeRouteParam:decodeURIComponent,canonicalReaderHash:(id:string)=>`#/reader/${id}`,resolveBookAlias:(_s:unknown,id:string)=>id,accountLandingRoute:()=> 'home',focusRouteContent:vi.fn(),routeDocumentTitle:(name:string)=>name,markModuleLoaded:vi.fn(),shouldReloadStaleModule:()=>false,markReaderChunkLoaded:vi.fn(),shouldReloadReaderChunk:()=>false,beginRouteResourceScope:vi.fn(),appFrame:(content:unknown)=>content,globalRemembrance:()=>node('remembrance'),stateView:(state:unknown)=>node('state',state),restoreSelectedSiteLanguage:vi.fn(),setSourceDocumentTitle:vi.fn(),h:(kind:string,_props:unknown,...children:unknown[])=>node(kind,...children)}
 const api=new Function(...Object.keys(deps),code+';return{render,parseHash,preloadRoute}')( ...Object.values(deps))
 return{api,deps,queue,loads,root,readerScreen,opened,failures}
}
it.each(['#/people/000384','#/author/shamela-384','#/authors'])('real router never prewarms reader for %s, but a book click still renders it',async hash=>{
 const f=fixture(hash);f.api.render();await tick();expect(f.loads).not.toContain('reader');expect(f.queue).toHaveLength(0)
 f.deps.location.hash='#/book/local-book';f.api.render(true);await tick()
 expect(f.loads.filter(x=>x==='reader')).toHaveLength(1);expect(f.readerScreen).toHaveBeenCalledWith('local-book');expect(f.opened).toEqual(['local-book']);expect(f.root.children.some((x:any)=>x.kind==='reader')).toBe(true)
})
it('an idle callback queued on home rechecks the new people route instead of importing reader',async()=>{
 const f=fixture('#/');f.api.render();await tick();expect(f.queue).toHaveLength(1)
 f.deps.location.hash='#/people/000267';f.api.render();await tick();f.queue.shift()!();await tick();expect(f.loads).not.toContain('reader')
})
it('unknown routes show not-found, and a failed author screen shows retry without reader warmup',async()=>{
 const f=fixture('#/unknown');expect(f.api.parseHash('#/unknown').name).toBe('not-found');f.api.render();await tick();expect(f.loads).not.toContain('home')
 f.deps.location.hash='#/author/a';f.failures.add('library');f.api.render();await tick();f.queue.splice(0).forEach(cb=>cb());await tick();expect(f.loads).not.toContain('reader');expect(f.root.children.some((x:any)=>x.kind==='state'&&x.children[0].actionLabel==='إعادة المحاولة')).toBe(true)
})
it('leaving a reader while metadata is pending never records or mounts the stale reader',async()=>{
 const f=fixture('#/book/local-book');let release!:()=>void
 const preloadedReaders=f.loads.filter(name=>name==='reader').length
 f.deps.hydrateSubjectCategories.mockImplementationOnce(()=>new Promise<void>(resolve=>{release=resolve}))
 f.api.render();f.deps.location.hash='#/people/000267';f.api.render();await tick()
 expect(f.root.children.some((x:any)=>x.kind==='peopleScreen')).toBe(true)
 release();await tick()
 expect(f.opened).toEqual([]);expect(f.loads.filter(name=>name==='reader')).toHaveLength(preloadedReaders)
 expect(f.root.children.some((x:any)=>x.kind==='peopleScreen')).toBe(true)
})
it('leaving a pending reader import for a person prevents stale reader DOM',async()=>{
 const f=fixture('#/people/000384');f.api.render();await tick();let release!:(value:unknown)=>void
 f.deps.loadScreen.mockImplementationOnce(()=>new Promise(r=>release=r));f.deps.location.hash='#/book/local-book';f.api.render();await tick()
 f.deps.location.hash='#/people/000267';f.api.render();await tick();release({readerScreen:f.readerScreen});await tick();expect(f.readerScreen).not.toHaveBeenCalled();expect(f.root.children.some((x:any)=>x.kind==='peopleScreen')).toBe(true)
})
