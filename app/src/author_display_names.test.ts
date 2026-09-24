import {afterEach,describe,expect,it,vi} from 'vitest'
import {bindAuthorDisplayName,canonicalAuthorIdentity,currentAuthorName,hydrateAuthorDisplayNames,projectBookAuthorNames,rememberAuthorDisplayName,resetAuthorDisplayNamesForTests} from './author_display_names'
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();resetAuthorDisplayNamesForTests()})
const page=(names:unknown[],extra={})=>new Response(JSON.stringify({schemaVersion:1,version:'1:2:0',page:0,hasMore:false,names,...extra}))
describe('author names follow identities, never shared spelling',()=>{
 it('updates mounted identity text without remounting or replacing a draft',()=>{
  const label={dataset:{} as Record<string,string>,textContent:'قديم'} as unknown as HTMLElement
  const draft={value:'مسودة لم تحفظ'}
  bindAuthorDisplayName(label,'shamela:51','قديم')
  vi.stubGlobal('document',{querySelectorAll:vi.fn(()=>[label])})
  const book=projectBookAuthorNames({author:'قديم',authorId:'51'})
  rememberAuthorDisplayName('shamela:51','اسم جديد',3)
  expect(label.textContent).toBe('اسم جديد');expect(book.author).toBe('اسم جديد');expect(draft.value).toBe('مسودة لم تحفظ')
 })
 it('projects primary/coauthor identities without changing source data or anonymous names',()=>{
  rememberAuthorDisplayName('shamela:51','الاسم الجديد',2)
  const data=new Uint8Array([1,2]);const original={author:'القديم',authorId:'shamela-author-51',data,authors:[{name:'القديم',id:'shamela-51'},{name:'القديم',id:'shamela-52'},{name:'القديم'}]}
  const view=projectBookAuthorNames(original)
  expect(view.author).toBe('الاسم الجديد');expect(view.authors[0]!.name).toBe('الاسم الجديد');expect(view.authors[1]!.name).toBe('القديم');expect(original.author).toBe('القديم');expect(view.data).toBe(data)
  expect(projectBookAuthorNames({author:'القديم'}).author).toBe('القديم')
  expect(canonicalAuthorIdentity('local:shamela-author-51')).toBe('shamela:51')
  expect(canonicalAuthorIdentity('tarajm:51')).toBe('tarajm:51')
 })
 it('hydrates sparse names once and preserves central author IDs',async()=>{
  const id='central-author:00000000-0000-4000-8000-000000000000';const fetch=vi.fn(async()=>page([{authorId:id,displayName:'المصحح',revision:2}]))
  vi.stubGlobal('fetch',fetch);await Promise.all([hydrateAuthorDisplayNames(),hydrateAuthorDisplayNames()]);await hydrateAuthorDisplayNames()
  expect(fetch).toHaveBeenCalledTimes(1);expect(currentAuthorName(id,'قديم')).toBe('المصحح')
 })
 it('loads a 501-name registry in two bounded pages rather than six 100-name scans',async()=>{
  const first=Array.from({length:500},(_,index)=>({authorId:`shamela:${index+1}`,displayName:`المؤلف ${index+1}`,revision:1}))
  const fetch=vi.fn(async(input:string,_options?:RequestInit)=>input.includes('page=0')?page(first,{hasMore:true}):page([{authorId:'shamela:501',displayName:'المؤلف 501',revision:1}],{page:1}))
  vi.stubGlobal('fetch',fetch)
  await hydrateAuthorDisplayNames()
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(fetch.mock.calls.every(([url])=>url.includes('limit=500'))).toBe(true)
  expect(fetch.mock.calls.every(([,options])=>options?.cache==='default')).toBe(true)
  expect(currentAuthorName('shamela:501','قديم')).toBe('المؤلف 501')
 })
 it('does not repaginate the D1 author registry on every route within five minutes',async()=>{
  const clock=vi.spyOn(Date,'now').mockReturnValue(1_000_000)
  const fetch=vi.fn(async()=>page([{authorId:'shamela:51',displayName:'المصحح',revision:2}]))
  vi.stubGlobal('fetch',fetch)
  await hydrateAuthorDisplayNames()
  clock.mockReturnValue(1_000_000+4*60_000)
  await hydrateAuthorDisplayNames()
  expect(fetch).toHaveBeenCalledTimes(1)
  clock.mockReturnValue(1_000_000+5*60_000+1)
  await hydrateAuthorDisplayNames()
  await vi.waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2))
 })
 it('backs off after failure rather than blocking every navigation',async()=>{
  const fetch=vi.fn(async()=>{throw Error('offline')});vi.stubGlobal('fetch',fetch)
  await expect(hydrateAuthorDisplayNames()).rejects.toThrow('offline');await hydrateAuthorDisplayNames();expect(fetch).toHaveBeenCalledTimes(1)
 })
 it('does not replace a successful save with a stale inflight snapshot',async()=>{
  let finish!:(value:Response)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve})))
  const task=hydrateAuthorDisplayNames();rememberAuthorDisplayName('shamela:51','أحدث',3);finish(page([{authorId:'shamela:51',displayName:'قديم',revision:2}]))
  await task;expect(currentAuthorName('51','fallback')).toBe('أحدث')
 })
 it('rejects malformed names without applying partial snapshot',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>page([{authorId:'shamela:51',displayName:'صحيح',revision:1},{authorId:'bad/id',displayName:'غيرصحيح',revision:1}])))
  await expect(hydrateAuthorDisplayNames()).rejects.toThrow('author_names_invalid');expect(currentAuthorName('51','الأصل')).toBe('الأصل')
 })
})
