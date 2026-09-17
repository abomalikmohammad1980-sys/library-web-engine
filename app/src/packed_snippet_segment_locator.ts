/** Experimental, opt-in locator adapter. Not imported by production search.
 * Caller supplies a descriptor from an already SHA-verified packed manifest. */
export interface SnippetPackedEntry {byteLength:number;sha256:string;parts:Array<{archive:string;project:number;offset:number;length:number;sha256:string}>}
interface Descriptor {contract:string;releaseId:string;sourceManifestSha256:string;coverageComplete:boolean;path:string;sha256:string;byteLength:number;segments:number;maxShardBytes:number}
interface Options {enabled:true;releaseId:string;sourceManifestSha256:string;baseUrl:string;fetch:typeof fetch;descriptor:Descriptor;indexBucketCount:number;indexFiles:ReadonlyArray<{id:string;byteLength:number}>}
interface Resource {path:string;sha256:string;byteLength:number}
type Directory=Map<string,Resource>
const integer=(n:unknown):n is number=>Number.isSafeInteger(n)&&Number(n)>=0
const sha=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s)
const pathPattern=/^segments\/([A-Za-z0-9_-]{1,80})\/snippets\/(\d{4})\.json$/
const failure=(name:string):never=>{throw Error(`snippet_locator_${name}`)}
const abort=()=>new DOMException('Search superseded','AbortError')
function bucket(path:string,count:number){let value=2166136261;for(let i=0;i<path.length;i++){value^=path.charCodeAt(i);value=Math.imul(value,16777619)}return String((value>>>0)%count).padStart(4,'0')}
function validateEntry(value:any,archives:any[]):SnippetPackedEntry{
 if(!value||!integer(value.byteLength)||!value.byteLength||!sha(value.sha256)||!Array.isArray(value.parts)||!value.parts.length||value.parts.length>128)failure('entry')
 let total=0
 for(const p of value.parts){const archive=archives.find(a=>a[0]===p?.project&&a[1]===p?.archive);if(!archive||!integer(p.offset)||!integer(p.length)||!p.length||!sha(p.sha256)||!Number.isSafeInteger(p.offset+p.length)||p.offset+p.length>archive[2])failure('part');total+=p.length}
 if(!Number.isSafeInteger(total)||total!==value.byteLength)failure('entry_length')
 return structuredClone(value)
}
export class PackedSnippetSegmentLocator {
 private options:Options|undefined
 private cache=new Map<string,Uint8Array>();private cacheBytes=0
 private disposed=false
 private inflight=new Map<string,{controller:AbortController;promise:Promise<Uint8Array>;waiters:number}>()
 constructor(options?:Options){if(options?.enabled)this.options={...structuredClone({...options,fetch:undefined}),fetch:options.fetch} as Options}
 private config():Options{
  const o=this.options!,d=o.descriptor
  if(d.contract!=='khizana-snippet-segment-directory-descriptor/1'||d.releaseId!==o.releaseId||d.sourceManifestSha256!==o.sourceManifestSha256||!sha(o.sourceManifestSha256)||!d.coverageComplete||!sha(d.sha256)||d.path!==`snippet-locator-segments/directory-${d.sha256}.json`||!integer(d.byteLength)||d.byteLength<1||d.byteLength>1024*1024||!integer(d.segments)||d.segments<1||!integer(d.maxShardBytes)||d.maxShardBytes<1||d.maxShardBytes>1024*1024||!integer(o.indexBucketCount)||o.indexBucketCount<1||o.indexFiles.length!==o.indexBucketCount||new Set(o.indexFiles.map(f=>f.id)).size!==o.indexBucketCount||o.indexFiles.some(f=>!/^\d{4}$/.test(f.id)||!integer(f.byteLength)||f.byteLength<1))failure('descriptor')
  const url=new URL(o.baseUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)failure('origin')
  return o
 }
 private key(r:Resource){const o=this.options!;return `${o.releaseId}:${o.sourceManifestSha256}:${r.path}:${r.sha256}`}
 private async resource(r:Resource,signal?:AbortSignal):Promise<Uint8Array>{
  signal?.throwIfAborted();const key=this.key(r),cached=this.cache.get(key)
  if(cached){this.cache.delete(key);this.cache.set(key,cached);return cached}
  let task=this.inflight.get(key)
  if(task?.controller.signal.aborted){this.inflight.delete(key);task=undefined}
  if(!task){
   if(this.inflight.size>=64)failure('inflight_budget')
   const controller=new AbortController(),o=this.options!,timer=setTimeout(()=>controller.abort(),15000)
   const promise=(async()=>{
    const response=await o.fetch(new URL(r.path,o.baseUrl.endsWith('/')?o.baseUrl:`${o.baseUrl}/`),{signal:controller.signal,cache:'force-cache',redirect:'error'})
    if(!response.ok||!response.body)failure('http')
    const reader=response.body!.getReader(),parts:Uint8Array[]=[];let size=0
    try{for(;;){controller.signal.throwIfAborted();const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>r.byteLength)failure('integrity_size');parts.push(next.value)}}finally{await reader.cancel().catch(()=>undefined);reader.releaseLock()}
    if(size!==r.byteLength)failure('integrity_size');const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');controller.signal.throwIfAborted();if(digest!==r.sha256)failure('integrity_sha')
    while(this.cache.size>=64||this.cacheBytes+bytes.length>4*1024*1024){const oldest=this.cache.keys().next().value;if(oldest===undefined)break;this.cacheBytes-=this.cache.get(oldest)!.length;this.cache.delete(oldest)}
    this.cache.set(key,bytes);this.cacheBytes+=bytes.length;return bytes
   })().finally(()=>{clearTimeout(timer);if(this.inflight.get(key)?.controller===controller)this.inflight.delete(key)})
   task={controller,promise,waiters:0};this.inflight.set(key,task)
  }
  task.waiters++;const shared=task
  return new Promise((resolve,reject)=>{
   let done=false
   const finish=(value:Uint8Array|undefined,error?:unknown)=>{if(done)return;done=true;signal?.removeEventListener('abort',cancel);shared.waiters--;if(shared.waiters===0&&this.inflight.get(key)===shared)shared.controller.abort();if(error!==undefined)reject(error);else resolve(value!)}
   const cancel=()=>finish(undefined,abort());signal?.addEventListener('abort',cancel,{once:true});shared.promise.then(value=>finish(value),error=>finish(undefined,error));if(signal?.aborted)cancel()
  })
 }
 private async directory(signal?:AbortSignal):Promise<Directory>{
  const o=this.options!,d=o.descriptor,value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await this.resource(d,signal)))
  if(value.contract!=='khizana-snippet-segment-directory/1'||value.releaseId!==o.releaseId||value.sourceManifestSha256!==o.sourceManifestSha256||value.coverageComplete!==true||!Array.isArray(value.entries)||value.entries.length!==d.segments)failure('directory_schema')
  const result:Directory=new Map()
  for(const row of value.entries){if(!Array.isArray(row)||row.length!==3||typeof row[0]!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(row[0])||result.has(row[0])||!sha(row[1])||!integer(row[2])||row[2]<1||row[2]>d.maxShardBytes)failure('directory_row');result.set(row[0],{path:`snippet-locator-segments/${row[1]}.json`,sha256:row[1],byteLength:row[2]})}
  return result
 }
 private async segment(name:string,r:Resource,signal?:AbortSignal):Promise<Map<string,SnippetPackedEntry>>{
  const o=this.options!,value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await this.resource(r,signal)))
  if(value.contract!=='khizana-snippet-locator/1'||value.releaseId!==o.releaseId||value.sourceManifestSha256!==o.sourceManifestSha256||!Array.isArray(value.segments)||value.segments.length!==1||value.segments[0]!==name||!integer(value.bucketCount)||value.bucketCount<1||value.bucketCount>10000||!Array.isArray(value.archives)||!Array.isArray(value.rows)||value.rows.length>value.bucketCount)failure('segment_schema')
  if(value.archives.some((a:any)=>!Array.isArray(a)||a.length!==3||!integer(a[0])||typeof a[1]!=='string'||!/^\d{6}$/.test(a[1])||!integer(a[2])))failure('archive_schema')
  const result=new Map<string,SnippetPackedEntry>()
  for(const row of value.rows){if(!Array.isArray(row)||row[0]!==0||!integer(row[1])||row[1]>=value.bucketCount)failure('segment_row');let entry:any
   if(row.length===6){if(!integer(row[2]))failure('archive_index');const a=value.archives[row[2]];if(!a)failure('archive_index');entry={byteLength:row[4],sha256:row[5],parts:[{project:a[0],archive:a[1],offset:row[3],length:row[4],sha256:row[5]}]}}
   else if(row.length===3)entry=row[2];else failure('row_width')
   const path=`segments/${name}/snippets/${String(row[1]).padStart(4,'0')}.json`;if(result.has(path))failure('duplicate');result.set(path,validateEntry(entry,value.archives))
  }
  return result
 }
 async resolveCohort(paths:readonly string[],legacy:(path:string,signal?:AbortSignal)=>Promise<SnippetPackedEntry>,{signal,legacyCachedBuckets=new Set<string>()}:{signal?:AbortSignal;legacyCachedBuckets?:ReadonlySet<string>}={}):Promise<Map<string,SnippetPackedEntry>>{
  if(this.disposed)throw abort()
  signal?.throwIfAborted();const unique=[...new Set(paths)],fallback=async()=>new Map(await Promise.all(unique.map(async path=>[path,await legacy(path,signal)] as const)))
  if(!this.options)return fallback()
  if(unique.length>64)return fallback()
  const o=this.config(),matches=unique.map(p=>pathPattern.exec(p));if(matches.some(m=>!m))return fallback()
  const segments=[...new Set(matches.map(m=>m![1]!))],indexIds=new Set(unique.map(p=>bucket(p,o.indexBucketCount)).filter(id=>!legacyCachedBuckets.has(id))),baseline=o.indexFiles.filter(f=>indexIds.has(f.id)).reduce((n,f)=>n+f.byteLength,0)
  const directoryCached=this.cache.has(this.key(o.descriptor)),directoryCost=directoryCached?0:o.descriptor.byteLength
  // Conservative preflight uses declared maximum, not a directory downloaded
  // speculatively. No change to candidate order or snippet matching follows.
  if(segments.length+(directoryCached?0:1)>=indexIds.size||directoryCost+segments.length*o.descriptor.maxShardBytes>=baseline)return fallback()
  const directory=await this.directory(signal),bySegment=new Map<string,Map<string,SnippetPackedEntry>>()
  await Promise.all(segments.map(async name=>{const resource=directory.get(name);if(!resource)failure('segment_missing');bySegment.set(name,await this.segment(name,resource!,signal))}))
  signal?.throwIfAborted();return new Map(unique.map((path,i)=>{const entry=bySegment.get(matches[i]![1]!)!.get(path);if(!entry)failure('key_missing');return[path,structuredClone(entry!)]}))
 }
 dispose():void{this.disposed=true;for(const task of this.inflight.values())task.controller.abort();this.cache.clear();this.cacheBytes=0}
}
