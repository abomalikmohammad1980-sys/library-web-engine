import {SHAMELA_AUTHOR_METADATA_SHA} from './shamela_author_metadata'
import type {ShamelaAuthorIndexEntry} from './shamela_author_index'
export const SHAMELA_BIOGRAPHY_MANIFEST_SHA='e7c669fa5bb1f72ee5c13761a2cd18f57b3b750cda8c7533bfefd598bb16b2ac'
type Asset={authorId:string;id:string;path:string;bytes:number;sha256:string}
type Manifest={contract:string;metadataSha256:string;authorCount:number;biographyCount:number;assets:Asset[];unavailableAuthorIds:string[]}
let manifestTask:Promise<Manifest>|undefined
const cache=new Map<string,Promise<ShamelaAuthorIndexEntry>>()
async function verified(path:string,sha:string,max:number):Promise<unknown>{
 const response=await fetch(`./data/${path}`,{cache:'force-cache',signal:AbortSignal.timeout(15000)})
 if(!response.ok)throw Error('shamela_biography_unavailable')
 const reader=response.body?.getReader();if(!reader)throw Error('shamela_biography_integrity');const chunks:Uint8Array[]=[];let size=0
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('shamela_biography_integrity');chunks.push(value)}}finally{await reader.cancel();reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')
 if(digest!==sha)throw Error('shamela_biography_integrity');return JSON.parse(new TextDecoder().decode(bytes))
}
function manifest():Promise<Manifest>{return manifestTask??=verified(`shamela-biographies.manifest.json?v=${SHAMELA_BIOGRAPHY_MANIFEST_SHA}`,SHAMELA_BIOGRAPHY_MANIFEST_SHA,1024*1024).then(value=>{
 const m=value as Manifest,ids=[...m.assets.map(a=>a.authorId),...m.unavailableAuthorIds]
 if(m.contract!=='khizana-shamela-biographies/1'||m.metadataSha256!==SHAMELA_AUTHOR_METADATA_SHA||m.authorCount!==3174||m.biographyCount!==2716||m.assets.length!==2716||ids.length!==3174||new Set(ids).size!==3174||m.assets.some(a=>a.path!==`shamela-biographies/${a.sha256}.json`||!/^[a-f0-9]{64}$/.test(a.sha256)||a.bytes<1||a.bytes>128*1024))throw Error('shamela_biography_integrity')
 return m
}).catch(error=>{manifestTask=undefined;throw error})}
/** Enrich only the selected identity. Missing source is explicit, network failure is not missing. */
export function preloadShamelaBiographyManifest():Promise<void>{return manifest().then(()=>undefined)}
export async function withShamelaBiography(entry:ShamelaAuthorIndexEntry):Promise<ShamelaAuthorIndexEntry>{
 const m=await manifest(),asset=m.assets.find(a=>a.authorId===entry.authorId)
 if(!asset){if(!m.unavailableAuthorIds.includes(entry.authorId))throw Error('shamela_biography_identity');const {biography,biographyProvenance,...metadata}=entry;return metadata}
 if(asset.id!==entry.id)throw Error('shamela_biography_identity')
 let task=cache.get(entry.authorId)
 if(!task){task=verified(asset.path,asset.sha256,asset.bytes).then(value=>{const body=value as {contract:string;authorId:string;id:string;biography:string;biographyProvenance:ShamelaAuthorIndexEntry['biographyProvenance']};if(body.contract!=='khizana-shamela-biography/1'||body.authorId!==entry.authorId||body.id!==entry.id||typeof body.biography!=='string'||body.biographyProvenance?.sourceUrl!==`https://shamela.ws/author/${entry.authorId}`)throw Error('shamela_biography_identity');return {...entry,biography:body.biography,biographyProvenance:body.biographyProvenance}}).catch(error=>{cache.delete(entry.authorId);throw error});cache.set(entry.authorId,task);if(cache.size>16)cache.delete(cache.keys().next().value!)}
 return task
}
export function resetShamelaBiographyForTests(){manifestTask=undefined;cache.clear()}
