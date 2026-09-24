import {withPagesFetchRetry} from './pages_fetch_retry'
export interface PagesReleaseConfig { contract:'alkhizana-pages-client/1'; releaseId:string; projects:Array<{name:string;group:'corpus'|'search';baseUrl:string}>; corpusFallback?:'same-origin'; searchFallback?:'same-origin'; directReaderShards?:{project:string;catalogSha256:string;routeSha256:Record<string,string>} }
interface AssetPart { path:string;bytes:number;sha256:string }
interface ProjectAsset { group:string;path:string;bytes:number;sha256:string;project:string;parts:AssetPart[] }
interface ProjectManifest { contract:'alkhizana-pages-project/1';releaseId:string;project:string;group:string;assets:ProjectAsset[] }

const CONFIG='./data/shamela-pages-release.json', manifests=new Map<string,Promise<ProjectManifest>>()
function expectedPagesRelease():string|undefined {
 const value=globalThis.document?.querySelector?.('meta[name="khizana-reader-release"]')?.getAttribute('content')
 if(value==null)return undefined
 if(!/^[a-f0-9]{24}$/.test(value))throw Error('pages_release_marker_invalid')
 return value
}
export function pagesReleaseConfigPath():string {const release=expectedPagesRelease();return release?`${CONFIG}?release=${release}`:CONFIG}
const hash=async(bytes:Uint8Array<ArrayBuffer>)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('')
const SHA=/^[a-f0-9]{64}$/u
const cleanBase=(value:string)=>value.replace(/\/+$/u,'')
const joinUrl=(base:string,path:string)=>`${cleanBase(base)}/${path.replace(/^\/+/, '')}`
let configured:Promise<PagesReleaseConfig|undefined>|undefined

export function isLocalRuntimeHost(host=globalThis.location?.hostname):boolean {return host==='localhost'||host==='127.0.0.1'||host==='[::1]'}
export function pagesReleaseAllowedOnHost(config:PagesReleaseConfig,host=globalThis.location?.hostname):boolean{return !isLocalRuntimeHost(host)||config.projects.every(project=>!/^https?:\/\/(?!localhost(?::|\/)|127\.0\.0\.1(?::|\/)|\[::1\](?::|\/))/u.test(project.baseUrl))}

export function resetPagesDataReleaseForTests(){configured=undefined;manifests.clear()}
/** Resolve a published large book using the already pinned route map, without
 * downloading the unrelated all-author metadata index or project manifest. */
export async function pinnedReaderBatch(bookId:string,fetcher:typeof fetch=globalThis.fetch):Promise<string|undefined>{
 if(!/^\d+$/u.test(bookId))return undefined
 const config=await loadPagesReleaseConfig(fetcher)
 const matches=Object.keys(config?.directReaderShards?.routeSha256??{}).filter(path=>path.endsWith(`/books/${bookId}/route.json`))
 if(matches.length>1)throw Error('pages_reader_batch_ambiguous')
 return matches[0]?.split('/')[0]
}
export async function loadPagesReleaseConfig(fetcher:typeof fetch=globalThis.fetch):Promise<PagesReleaseConfig|undefined>{configured??=(async()=>{try{const response=await fetcher(pagesReleaseConfigPath(),{cache:'no-cache'});if(response.status===404)return undefined;if(!response.ok)throw new Error(`pages_release_config_http_${response.status}`);const value=await response.json() as PagesReleaseConfig;if(value.contract!=='alkhizana-pages-client/1'||!/^[a-f0-9]{24}$/u.test(value.releaseId)||!Array.isArray(value.projects)||(value.corpusFallback!==undefined&&value.corpusFallback!=='same-origin')||(value.searchFallback!==undefined&&value.searchFallback!=='same-origin'))throw new Error('pages_release_config_invalid');const expectedRelease=expectedPagesRelease();if(expectedRelease&&value.releaseId!==expectedRelease)throw Error('pages_release_marker_mismatch');if(value.directReaderShards){const direct=value.directReaderShards;if(!value.projects.some(project=>project.name===direct.project&&project.group==='corpus')||!SHA.test(direct.catalogSha256)||!direct.routeSha256||Object.entries(direct.routeSha256).some(([path,digest])=>!/^batch-\d{4}\/books\/\d+\/route\.json$/u.test(path)||!SHA.test(digest)))throw new Error('pages_release_direct_reader_invalid')}if(!pagesReleaseAllowedOnHost(value))return undefined;return value}catch(error){configured=undefined;throw error}})();return configured}
async function projectManifest(project:PagesReleaseConfig['projects'][number],releaseId:string,fetcher:typeof fetch){let pending=manifests.get(project.name);if(!pending){pending=(async()=>{const response=await fetcher(joinUrl(project.baseUrl,'project-manifest.json'),{cache:'no-cache',mode:'cors'});if(!response.ok)throw new Error(`pages_project_manifest_http_${response.status}`);const value=await response.json() as ProjectManifest;if(value.contract!=='alkhizana-pages-project/1'||value.releaseId!==releaseId||value.project!==project.name)throw new Error('pages_project_manifest_invalid');return value})();pending=pending.catch(error=>{manifests.delete(project.name);throw error});manifests.set(project.name,pending)}return pending}

export async function fetchPagesDataAsset(group:'corpus'|'search',path:string,fallbackUrl:string,fetcher:typeof fetch=globalThis.fetch,options:RequestInit={}):Promise<Response>{
 fetcher=withPagesFetchRetry(fetcher)
 const signal=options.signal??undefined
 const check=()=>signal?.throwIfAborted()
 const bounded=<T>(task:Promise<T>)=>new Promise<T>((resolve,reject)=>{
  const abort=()=>reject(signal?.reason??new DOMException('Aborted','AbortError'))
  signal?.addEventListener('abort',abort,{once:true})
  if(signal?.aborted)abort()
  task.then(resolve,reject).finally(()=>signal?.removeEventListener('abort',abort))
 })
 check()
 const config=await bounded(loadPagesReleaseConfig(fetcher))
 if(!config)return fetcher(fallbackUrl,{cache:'force-cache',credentials:'same-origin',...options})
 // In a reader-sidecar-only release, ordinary books stay on the established
 // same-origin route. Do not fetch a multi-megabyte sidecar manifest merely to
 // discover that an original pack is absent from it.
 if(group==='corpus'&&config.corpusFallback==='same-origin'&&!path.startsWith('reader-shards/'))return fetcher(fallbackUrl,{cache:'force-cache',credentials:'same-origin',...options})
 if(group==='search'&&config.searchFallback==='same-origin'&&!config.projects.some(project=>project.group==='search'))return fetcher(fallbackUrl,{cache:'force-cache',credentials:'same-origin',...options})
 // The immutable reader sidecars contain their own authenticated shard/index
 // digests. Pin the tiny route and catalog hashes in the same-origin config so
 // a cold phone need not download the multi-megabyte project manifest first.
 if(group==='corpus'&&path.startsWith('reader-shards/')&&config.directReaderShards){
  const direct=config.directReaderShards,relativePath=path.slice('reader-shards/'.length)
  if(!/^(?:catalog\.json|batch-\d{4}\/books\/\d+\/(?:route\.json|index\.json(?:\.gz)?|pages-\d{4}\.json\.gz))$/u.test(relativePath))throw Error('pages_direct_reader_path_invalid')
  const project=config.projects.find(candidate=>candidate.name===direct.project&&candidate.group==='corpus')!
  const expected=relativePath==='catalog.json'?direct.catalogSha256:direct.routeSha256[relativePath]
  if(relativePath.endsWith('/route.json')&&!expected)throw Error('pages_direct_reader_route_unmapped')
  const response=await bounded(fetcher(joinUrl(project.baseUrl,`releases/${config.releaseId}/${path}`),{cache:'force-cache',mode:'cors',...(signal?{signal}:{})}))
  if(!response.ok||response.headers.get('content-type')?.includes('text/html'))throw Error(`pages_direct_reader_http_${response.status}`)
  if(expected){const bytes=new Uint8Array(await bounded(response.arrayBuffer()));if(await hash(bytes)!==expected)throw Error('pages_direct_reader_integrity');return new Response(bytes,{status:200,headers:{'content-type':'application/json','x-alkhizana-release':config.releaseId,'x-alkhizana-project':project.name}})}
  return response
 }
 for(const project of config.projects.filter(x=>x.group===group&&x.baseUrl)){
  const manifest=await bounded(projectManifest(project,config.releaseId,fetcher)),asset=manifest.assets.find(x=>x.path===path)
  if(!asset)continue
  if(!Number.isSafeInteger(asset.bytes)||asset.bytes<1||asset.parts.some(p=>!Number.isSafeInteger(p.bytes)||p.bytes<1)||asset.parts.reduce((n,p)=>n+p.bytes,0)!==asset.bytes)throw Error('pages_asset_size_invalid')
  const joined=new Uint8Array(asset.bytes),offsets:number[]=[]
  let offset=0,cursor=0
  for(const part of asset.parts){offsets.push(offset);offset+=part.bytes}
  // Bound in-flight buffers on phones; do not retain all parts alongside joined.
  await Promise.all(Array.from({length:Math.min(2,asset.parts.length)},async()=>{
   while(cursor<asset.parts.length){
    check();const index=cursor++,part=asset.parts[index]!
    const response=await bounded(fetcher(joinUrl(project.baseUrl,part.path),{cache:'force-cache',mode:'cors',...(signal?{signal}:{})}))
    if(!response.ok)throw Error(`pages_asset_part_http_${response.status}`)
    const reader=response.body?.getReader();if(!reader)throw Error('pages_asset_body_missing')
    const cancel=()=>{void reader.cancel().catch(()=>undefined)}
    signal?.addEventListener('abort',cancel,{once:true})
    // Each worker owns a disjoint slice of the final allocation. Do not hold
    // a second full part and copy it into joined after verification: on mobile
    // a large BOK pack otherwise peaks at joined + two parts + response bytes.
    const bytes=joined.subarray(offsets[index]!,offsets[index]!+part.bytes);let length=0
    try{
     for(;;){check();const {done,value}=await bounded(reader.read());check();if(done)break;if(length+value.length>part.bytes)throw Error(`pages_asset_part_integrity:${path}`);bytes.set(value,length);length+=value.length}
     if(length!==part.bytes||await hash(bytes)!==part.sha256)throw Error(`pages_asset_part_integrity:${path}`)
     check()
    }finally{signal?.removeEventListener('abort',cancel);await reader.cancel().catch(()=>undefined);reader.releaseLock()}
   }
  }))
  check();if(await hash(joined)!==asset.sha256)throw Error(`pages_asset_reassembly_integrity:${path}`)
  check()
  return new Response(joined,{status:200,headers:{'content-type':'application/json','x-alkhizana-release':config.releaseId,'x-alkhizana-project':project.name}})
 }
 // A sidecar-only corpus project intentionally leaves the already-published
 // original packs at their verified same-origin URLs. Their caller still
 // checks the authoritative pack SHA; this exception is explicit in config.
 if((group==='corpus'&&config.corpusFallback==='same-origin')||(group==='search'&&config.searchFallback==='same-origin'))return fetcher(fallbackUrl,{cache:'force-cache',credentials:'same-origin',...options})
 throw Error(`pages_asset_not_mapped:${group}:${path}`)
}
