import {describe,it,expect,vi,afterEach} from 'vitest'
const state=vi.hoisted(()=>({claims:{subject:'admin',sessionId:'one',role:'super-admin'}}))
vi.mock('./account_authority',()=>({currentAccountClaims:()=>state.claims}))
vi.mock('./resource_lifecycle',()=>({captureRouteResourceScope:()=>({disposed:false,add:()=>{}})}))
vi.mock('./page_jump',()=>({pageJump:()=>({element:new ElementStub(),update:()=>{}})}))
vi.mock('./ui',()=>({h:(_tag:string,_attrs:unknown,...children:unknown[])=>new ElementStub(children)}))
class ElementStub{children:unknown[];textContent='';disabled=false;onclick?:()=>void;constructor(children:unknown[]=[]){this.children=children}append(...children:unknown[]){this.children.push(...children)}replaceChildren(...children:unknown[]){this.children=children}}
import {parseIndexingPage,adminIndexingPanel,indexingStatusLabels} from './admin_indexing_panel'
afterEach(()=>vi.unstubAllGlobals())
const row={bookId:'x',title:'كتاب',status:'failed',contentVersion:1,updatedAt:1,indexedAt:null,tocSource:'none',ocr:false}
describe('admin indexing response',()=>{
 it('accepts bounded truthful state and rejects malformed statuses/oversized pages',()=>{
  const page={page:1,pages:2,counts:{ready:1,processing:2,failed:3,ocrPending:0},rows:[row]}
  expect(parseIndexingPage(page).rows[0].status).toBe('failed')
  expect(()=>parseIndexingPage({...page,rows:Array(101).fill(row)})).toThrow()
  expect(()=>parseIndexingPage({...page,rows:[{...row,status:'almost_ready'}]})).toThrow()
  expect(()=>parseIndexingPage({...page,rows:[{...row,ocr:'yes'}]})).toThrow()
 })
 it('discards response after account session changes and makes no editor request',async()=>{
  state.claims={subject:'admin',sessionId:'one',role:'super-admin'}
  vi.stubGlobal('window',{addEventListener:vi.fn(),removeEventListener:vi.fn()})
  let respond!:(value:Response)=>void
  const fetcher=vi.fn(()=>new Promise<Response>(resolve=>respond=resolve));vi.stubGlobal('fetch',fetcher)
  const host=adminIndexingPanel() as unknown as ElementStub
  state.claims={subject:'admin',sessionId:'two',role:'super-admin'}
  respond(new Response(JSON.stringify({page:1,pages:1,counts:{ready:0,processing:0,failed:1,ocrPending:0},rows:[row]})))
  await new Promise(resolve=>setTimeout(resolve,20))
  expect(JSON.stringify(host)).not.toContain('كتاب')
  state.claims={subject:'editor',sessionId:'one',role:'editor'};adminIndexingPanel();expect(fetcher).toHaveBeenCalledTimes(1)
 })
 it('accepts scanned bookmark-only metadata without inventing failure or OCR completion',()=>{
  const data=parseIndexingPage({page:1,pages:1,counts:{ready:0,processing:0,failed:0,ocrPending:1},rows:[{...row,status:'ocr_pending',indexedAt:123,tocSource:'pdf_bookmarks'}]})
  expect(data.rows[0].ocr).toBe(false);expect(data.counts.failed).toBe(0)
  expect(indexingStatusLabels.ocr_pending).toBe('مصوّر — بلا نص قابل للبحث')
 })
 it('does not render a retry button for scanned completed metadata',async()=>{
  state.claims={subject:'admin',sessionId:'one',role:'super-admin'};vi.stubGlobal('window',{addEventListener:vi.fn(),removeEventListener:vi.fn()})
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({page:1,pages:1,counts:{ready:0,processing:0,failed:0,ocrPending:1},rows:[{...row,status:'ocr_pending',indexedAt:123}]}))))
  const host=adminIndexingPanel();await new Promise(resolve=>setTimeout(resolve,20))
  expect(JSON.stringify(host)).toContain('مصوّر — بلا نص قابل للبحث');expect(JSON.stringify(host)).not.toContain('إعادة المحاولة')
 })
})
