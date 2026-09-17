export interface BokActiveRelease{contract:'bok-active-release/1';generation:number;releaseId:string;readerManifestSha256:string;searchManifestSha256:string;artifactRoot:string}
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
export function validateBokActiveRelease(value:unknown):BokActiveRelease|null{
 if(value===null)return null
 const v=value as BokActiveRelease
 if(!v||v.contract!=='bok-active-release/1'||!Number.isSafeInteger(v.generation)||v.generation<1||!hash(v.releaseId)||!hash(v.readerManifestSha256)||!hash(v.searchManifestSha256)||v.artifactRoot!==`/library/bok-releases/${v.releaseId}`)throw Error('bok_active_release_invalid')
 return Object.freeze({...v})
}
let pinned:Promise<BokActiveRelease|null>|undefined,active:BokActiveRelease|null=null
export function bokReleaseEnabled():boolean{return (globalThis as typeof globalThis&{__BOK_RELEASES_ENABLED__?:boolean}).__BOK_RELEASES_ENABLED__===true}
/** Document-lifetime pin shared by reader and search. Failure is sticky and
 * fail-closed; never run an old search index against newly corrected pages. */
export function pinBokActiveRelease(fetcher:typeof fetch=fetch):Promise<BokActiveRelease|null>{
 if(!bokReleaseEnabled())return Promise.resolve(null)
 return pinned??= (async()=>{const response=await fetcher('/api/library/bok-release',{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(15000)})
 if(!response.ok)throw Error('bok_active_release_unavailable')
 const data=await boundedReleaseJson(response,8192) as {release?:unknown}
 active=validateBokActiveRelease(data.release);return active})()
}
export function pinnedBokSearchConfig(){return active?{controlBaseUrl:new URL(`${active.artifactRoot}/packed/control`,location.origin).href,projectBaseUrls:Array.from({length:8},(_,i)=>new URL(`${active!.artifactRoot}/packed/project-${i}`,location.origin).href)}:undefined}
export function pinnedBokSearchManifestHash(){return active?.searchManifestSha256}
export async function boundedReleaseJson(response:Response,maxBytes:number):Promise<unknown>{
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await boundedReleaseBytes(response,maxBytes)))
}
async function boundedReleaseBytes(response:Response,maxBytes:number):Promise<Uint8Array>{
 const reader=response.body?.getReader();if(!reader)throw Error('bok_release_empty')
 const parts:Uint8Array[]=[];let size=0
 try{for(;;){const{value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw Error('bok_release_too_large')}parts.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length}return bytes
}
let readerManifest:Promise<{books:Array<Record<string,unknown>>}>|undefined
export async function activeBokReaderEntry(sourceBookId:string,fetcher:typeof fetch=fetch):Promise<{entry:Record<string,unknown>;root:string}|undefined>{
 const release=await pinBokActiveRelease(fetcher);if(!release)return
 readerManifest??=(async()=>{const response=await fetcher(`${release.artifactRoot}/reader/manifest.json`,{cache:'force-cache'});if(!response.ok)throw Error('bok_reader_manifest_unavailable')
 // Parse only AFTER verifying the descriptor-bound bytes.
 const bytes=await boundedReleaseBytes(response,2*1024*1024)
 const actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.slice().buffer as ArrayBuffer))].map(x=>x.toString(16).padStart(2,'0')).join('');if(actual!==release.readerManifestSha256)throw Error('bok_reader_manifest_mismatch')
 const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as {books:Array<Record<string,unknown>>};if(!Array.isArray(value.books))throw Error('bok_reader_manifest_mismatch')
 return value})()
 const manifest=await readerManifest,entry=manifest.books.find(book=>book.bookId===sourceBookId)
 if(!entry)return
 const counts=entry.counts as {pages?:number;titles?:number}|undefined
 if(entry.workId!==`shamela4.1:${sourceBookId}`||typeof entry.file!=='string'||entry.file!==`books/${sourceBookId}.json`||!hash(entry.sha256)||!Number.isSafeInteger(entry.byteLength)||Number(entry.byteLength)<=0||!counts||!Number.isSafeInteger(counts.pages)||Number(counts.pages)<1||!Number.isSafeInteger(counts.titles)||Number(counts.titles)<0)throw Error('bok_reader_entry_invalid')
 return{entry,root:`${release.artifactRoot}/reader/`}
}
