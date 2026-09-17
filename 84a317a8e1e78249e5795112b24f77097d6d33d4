import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest'
import type {StoredBook} from './engine/library_store'

const mocks=vi.hoisted(()=>({claims:{sessionId:'one',subject:'admin'},versions:vi.fn(),mutate:vi.fn()}))
vi.mock('./account_authority',()=>({currentAccountClaims:()=>mocks.claims,hasAccountPermission:()=>true}))
vi.mock('./account_service',()=>({loadCentralBookVersions:mocks.versions,mutateCentralBook:mocks.mutate,accountErrorArabic:()=> 'failed'}))
vi.mock('./central_book_action',()=>({centralBookRecordId:(id:string)=>id}))
vi.mock('./icons',()=>({icon:()=>null}))
vi.mock('./ui',()=>({h:(tag:string,attrs:object|null,...children:unknown[])=>new ElementStub(tag,attrs,children)}))

// Only the DOM operations used by selection; no real accounts or server writes.
class ElementStub{
 children:any[];textContent='';value='';checked=false;disabled=false;hidden=false;removed=false
 onclick?:()=>void;onchange?:()=>void
 constructor(public tag:string,attrs:object|null={},children:unknown[]=[]){Object.assign(this,attrs);this.children=children}
 append(...children:unknown[]){this.children.push(...children)}
 prepend(child:unknown){this.children.unshift(child)}
 addEventListener(){}
 remove(){this.removed=true}
}
import {publishedGridSelection} from './published_grid_selection'
const book=(id:string)=>({id,title:id,managedSource:'published'} as StoredBook)
function setup(){
 const selection=publishedGridSelection(),a=new ElementStub('article'),b=new ElementStub('article')
 selection.reset([book('a'),book('b')]);selection.decorate(a as unknown as HTMLElement,book('a'));selection.decorate(b as unknown as HTMLElement,book('b'))
 const host=selection.host as unknown as ElementStub
 host.children[0].onclick()
 return {selection,a,b,host,remove:()=>host.children[6].onclick()}
}
beforeEach(()=>{
 vi.clearAllMocks();mocks.claims={sessionId:'one',subject:'admin'}
 mocks.versions.mockResolvedValue(new Map());mocks.mutate.mockResolvedValue({})
 vi.stubGlobal('confirm',()=>true);vi.stubGlobal('window',{dispatchEvent:vi.fn()})
})
afterEach(()=>vi.unstubAllGlobals())
describe('published list bulk actions',()=>{
 it('selects only decorated cards, not undisplayed results',()=>{
  const selection=publishedGridSelection(),card=new ElementStub('article')
  selection.reset([book('a'),book('b')]);selection.decorate(card as unknown as HTMLElement,book('a'))
  const host=selection.host as unknown as ElementStub;host.children[0].onclick()
  expect(host.children[2].textContent).toBe('1 كتاب محدد')
  expect(card.children[0].checked).toBe(true)
 })
 it('keeps cards while server confirmation is pending',async()=>{
  let resolve!:()=>void
  mocks.mutate.mockReturnValueOnce(new Promise<void>(r=>{resolve=r}))
  const {a,remove}=setup();remove()
  await vi.waitFor(()=>expect(mocks.mutate).toHaveBeenCalledTimes(1))
  expect(a.removed).toBe(false);resolve()
  await vi.waitFor(()=>expect(a.removed).toBe(true))
 })
 it('keeps the confirmed targets when filters change during version loading',async()=>{
  let resolve!:(value:Map<string,number>)=>void
  mocks.versions.mockReturnValue(new Promise(r=>{resolve=r}))
  const {selection,remove}=setup();remove();selection.reset([book('b')]);resolve(new Map())
  await vi.waitFor(()=>expect(mocks.mutate).toHaveBeenCalledTimes(2))
  expect(mocks.mutate.mock.calls.map(call=>call[0])).toEqual(['a','b'])
 })
 it('removes only confirmed deletions and retains failed cards and selection',async()=>{
  mocks.mutate.mockImplementation(async(id:string)=>{if(id==='b')throw Error('conflict')})
  const {a,b,host,remove}=setup();remove()
  await vi.waitFor(()=>expect(host.children[7].textContent).toContain('failed'))
  expect(a.removed).toBe(true);expect(b.removed).toBe(false)
  expect(host.children[2].textContent).toBe('1 كتاب محدد')
 })
 it('keeps success feedback visible after deleting the last cards',async()=>{
  const {a,b,host,remove}=setup();remove()
  await vi.waitFor(()=>expect(host.children[7].textContent).toContain('حذف 2'))
  expect(a.removed&&b.removed).toBe(true);expect(host.hidden).toBe(false)
  expect(host.children[2].textContent).toBe('0 كتاب محدد')
 })
 it('does not continue a confirmed batch after the account changes',async()=>{
  let resolve!:(value:Map<string,number>)=>void
  mocks.versions.mockReturnValue(new Promise(r=>{resolve=r}))
  const {selection,a,remove}=setup();remove();mocks.claims={sessionId:'two',subject:'other'}
  selection.reset([book('a')]);resolve(new Map());await new Promise(r=>setTimeout(r,0))
  expect(mocks.mutate).not.toHaveBeenCalled();expect(a.removed).toBe(false)
 })
})
