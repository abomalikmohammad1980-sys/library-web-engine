import {centralHeadingProvider,configureCentralHeadingSearch,type CentralHeadingProvider} from './central_heading_integration'
import {shamelaPublicBookId} from './shamela_public_identity'
import {loadHeadingBookRanges} from './heading_book_ranges'
// Release owner enables only after the R2 integrity gate and public config copy.
export const CENTRAL_HEADING_RELEASE_ENABLED=true
export const CENTRAL_HEADING_CONFIG_SHA='62f0baee0d621d7b45335244bd2a2de4f654a6525a66e83d59b21eb2d646a837'
type Release={contract:string;releaseId:string;baseURL:string;coveredSourceBookIds:string[];rowCount:number;dictionaryBinary:NonNullable<ConstructorParameters<typeof import('./central_heading_search').CentralHeadingSearchClient>[0]['dictionaryBinary']>}
export async function validateCentralHeadingRelease(bytes:Uint8Array):Promise<Release>{
 if(bytes.length>100_000)throw Error('heading_release_budget')
 const digest=await crypto.subtle.digest('SHA-256',bytes as BufferSource),sha=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')
 if(sha!==CENTRAL_HEADING_CONFIG_SHA)throw Error('heading_release_integrity')
 const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as Release
 if(value.contract!=='khizana-heading-client-release/1'||!Array.isArray(value.coveredSourceBookIds)||value.coveredSourceBookIds.length!==8553||new Set(value.coveredSourceBookIds).size!==8553||value.coveredSourceBookIds.some(id=>!/^[1-9]\d*$/.test(id))||value.baseURL!==`/api/search/headings/${value.releaseId}/`||value.dictionaryBinary.sourceManifestSha256!==value.releaseId)throw Error('heading_release_integrity')
 return value
}
let pending:Promise<CentralHeadingProvider>|undefined
export function createHeadingBootstrapTask<T>(load:(signal:AbortSignal)=>Promise<T>,timeoutMs=15_000):()=>Promise<T>{
 let task:Promise<T>|undefined
 return ()=>task??=(async()=>{
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined
  try{return await Promise.race([load(controller.signal),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('heading_release_timeout'))},timeoutMs)})])}
  finally{if(timer!==undefined)clearTimeout(timer)}
 })().catch(error=>{task=undefined;throw error})
}
const fetchRelease=createHeadingBootstrapTask(async signal=>{
 const response=await fetch(new URL('./data/heading-release.json',document.baseURI),{signal})
 if(!response.ok)throw Error(`heading_release_http_${response.status}`)
 if(!response.body)throw Error('heading_release_integrity')
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0
 const cancel=()=>{void reader.cancel().catch(()=>undefined)};signal.addEventListener('abort',cancel,{once:true})
 try{for(;;){signal.throwIfAborted();const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>100_000)throw Error('heading_release_budget');chunks.push(value)}signal.throwIfAborted()}
 catch(error){await reader.cancel().catch(()=>undefined);throw error}finally{signal.removeEventListener('abort',cancel);reader.releaseLock()}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 return validateCentralHeadingRelease(bytes)
})
export async function ensureCentralHeadingProvider(signal?:AbortSignal):Promise<CentralHeadingProvider|undefined>{
 signal?.throwIfAborted()
 if(centralHeadingProvider())return centralHeadingProvider()
 if(!CENTRAL_HEADING_RELEASE_ENABLED)return undefined
 pending??=(async()=>{
  // Independent modules/configuration must not form a serial HTTP waterfall.
  const [release,{CentralHeadingSearchClient},dictionary,{withCatalogHeadingSupplement},bookRanges]=await Promise.all([
   fetchRelease(),import('./central_heading_search'),
   import('./heading_dictionary_release').then(module=>module.headingDictionaryOptions(document.baseURI)),
   import('./heading_catalog_supplement'),
   loadHeadingBookRanges('primary'),
  ])
  const value={releaseId:release.releaseId,coveredBookIds:new Set(release.coveredSourceBookIds.map(shamelaPublicBookId)),client:new CentralHeadingSearchClient({baseURL:new URL(release.baseURL,location.origin).href,planTokens:true,dictionaryBinary:release.dictionaryBinary,...dictionary,rowConcurrency:16,bookRanges})}
  const complete=await withCatalogHeadingSupplement(value)
  configureCentralHeadingSearch(complete);return complete
 })().catch(error=>{pending=undefined;throw error})
 const result=await pending;signal?.throwIfAborted();return result
}
