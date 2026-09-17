import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {expect,it,vi} from 'vitest'
const source=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8')
function worker(redirected=false){
 const listeners=new Map<string,(event:any)=>void>(),match=vi.fn(async(key:unknown)=>{
  if(key!=='./index.html')return undefined
  const response=new Response('offline-shell',{headers:{'content-type':'text/html','x-release':'verified'}})
  if(redirected)Object.defineProperty(response,'redirected',{value:true})
  return response
 })
 runInNewContext(source,{self:{location:{origin:'https://khzanah.com'},addEventListener:(key:string,fn:any)=>listeners.set(key,fn)},caches:{match},fetch:async()=>{throw Error('offline')},Request,Response,URL})
 return {match,request(path:string){let result:Promise<Response>|undefined;const request=new Request('https://khzanah.com'+path);Object.defineProperty(request,'mode',{value:'navigate'});listeners.get('fetch')!({request,respondWith:(p:Promise<Response>)=>{result=p},waitUntil:()=>{}});return result}}
}
it('opens clean public and private application paths with the installed shell offline',async()=>{
 for(const path of ['/books/21633?pageIndex=3','/authors/000020','/search?q=x','/settings','/quran']){
  const sw=worker();expect(await (await sw.request(path)!).text()).toBe('offline-shell');expect(sw.match).toHaveBeenCalledWith('./index.html')
 }
})
it('never substitutes the app shell for data, API, sitemap, robots or file navigation',async()=>{
 for(const path of ['/api/test','/data/test.json','/library/test.json','/quran/test.json','/sitemap.xml','/robots.txt','/assets/test.js']){
  const sw=worker(),result=sw.request(path);if(result)await result.catch(()=>undefined)
  expect(sw.match).not.toHaveBeenCalledWith('./index.html')
 }
})
it('removes cached shell redirect history so offline reload can use it',async()=>{
 const sw=worker(true),response=await sw.request('/books/151179?pageIndex=1')!
 expect(response.redirected).toBe(false)
 expect(response.status).toBe(200)
 expect(response.headers.get('content-type')).toBe('text/html')
 expect(response.headers.get('x-release')).toBe('verified')
 expect(await response.text()).toBe('offline-shell')
})
