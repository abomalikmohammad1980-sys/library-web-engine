import {withPagesFetchRetry} from './pages_fetch_retry'
export interface PagesReleaseConfig { contract:'alkhizana-pages-client/1'; releaseId:string; projects:Array<{name:string;group:'corpus'|'search';baseUrl:string}> }
interface AssetPart { path:string;bytes:number;sha256:string }
interface ProjectAsset { group:string;path:string;bytes:number;sha256:string;project:string;parts:AssetPart[] }
interface ProjectManifest { contract:'alkhizana-pages-project/1';releaseId:string;project:string;group:string;assets:ProjectAsset[] }

const CONFIG='./data/shamela-pages-release.json', manifests=new Map<string,Promise<ProjectManifest>>()
const hash=async(bytes:Uint8Array)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',Uint8Array.from(bytes).buffer))].map(x=>x.toString(16).padStart(2,'0')).join('')
const cleanBase=(value:string)=>value.replace(/\/+$/u,'')
const joinUrl=(base:string,path:string)=>`${cleanBase(base)}/${path.replace(/^\/+/, '')}`
let configured:Promise<PagesReleaseConfig|undefined>|undefined

export function isLocalRuntimeHost(host=globalThis.location?.hostname):boolean {return host==='localhost'||host==='127.0.0.1'||host==='[::1]'}
export function pagesReleaseAllowedOnHost(config:PagesReleaseConfig,host=globalThis.location?.hostname):boolean{return !isLocalRuntimeHost(host)||config.projects.every(project=>!/^https?:\/\/(?!localhost(?::|\/)|127\.0\.0\.1(?::|\/)|\[::1\](?::|\/))/u.test(project.baseUrl))}

export function resetPagesDataReleaseForTests(){configured=undefined;manifests.clear()}
export async function loadPagesReleaseConfig(fetcher:typeof fetch=globalThis.fetch):Promise<PagesReleaseConfig|undefined>{configured??=(async()=>{try{const response=await fetcher(CONFIG,{cache:'no-cache'});if(response.status===404)return undefined;if(!response.ok)throw new Error(`pages_release_config_http_${response.status}`);const value=await response.json() as PagesReleaseConfig;if(value.contract!=='alkhizana-pages-client/1'||!/^[a-f0-9]{24}$/u.test(value.releaseId)||!Array.isArray(value.projects))throw new Error('pages_release_config_invalid');if(!pagesReleaseAllowedOnHost(value))return undefined;return value}catch(error){configured=undefined;throw error}})();return configured}
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
    const bytes=new Uint8Array(part.bytes);let length=0
    try{
     for(;;){check();const {done,value}=await bounded(reader.read());check();if(done)break;if(length+value.length>part.bytes)throw Error(`pages_asset_part_integrity:${path}`);bytes.set(value,length);length+=value.length}
     if(length!==part.bytes||await hash(bytes)!==part.sha256)throw Error(`pages_asset_part_integrity:${path}`)
     check();joined.set(bytes,offsets[index]!)
    }finally{signal?.removeEventListener('abort',cancel);await reader.cancel().catch(()=>undefined);reader.releaseLock()}
   }
  }))
  check();if(await hash(joined)!==asset.sha256)throw Error(`pages_asset_reassembly_integrity:${path}`)
  check()
  return new Response(joined,{status:200,headers:{'content-type':'application/json','x-alkhizana-release':config.releaseId,'x-alkhizana-project':project.name}})
 }
 throw Error(`pages_asset_not_mapped:${group}:${path}`)
}
