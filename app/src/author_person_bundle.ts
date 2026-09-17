import type {ShamelaAuthorIndexEntry} from './shamela_author_index'
import type {StructuredBiography} from './author_people'
type Asset={path:string;sha256:string;bytes:number}
export type AuthorPersonRelease={contract:'khizana-author-person-release/1';generation:string;shards:Record<string,Asset>}
export type AuthorPersonBundle={contract:'khizana-author-person/1';generation:string;entry:ShamelaAuthorIndexEntry;coverage:{shamela:'available'|'unavailable';tarajm:'available'|'unavailable'|'unmapped'};tarajm:{biography?:StructuredBiography;peopleHrefByTarajmId:Array<[string,string]>};relationNames:string[];relationCatalog:Array<{authorId:string;name:string}>}
const HEX=/^[a-f0-9]{64}$/
function cancellable<T>(task:Promise<T>,signal:AbortSignal):Promise<T>{
 return new Promise((resolve,reject)=>{const abort=()=>reject(signal.reason??new DOMException('Aborted','AbortError'));if(signal.aborted){abort();return}signal.addEventListener('abort',abort,{once:true});task.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort))})
}
/** Standalone opt-in loader; no screen imports it until its generated release is reviewed.
 * A verified static bundle is NEVER a replacement for the live override baseline.
 */
export function createAuthorPersonLoader(release:AuthorPersonRelease,base='./data/author-persons/'){
 if(release.contract!=='khizana-author-person-release/1'||!HEX.test(release.generation))throw Error('author_person_release')
 const people=new Map<string,Promise<AuthorPersonBundle|undefined>>()
 const indexes=new Map<string,Promise<Record<string,Asset>>>()
 async function verified(asset:Asset|undefined,kind:'indexes'|'persons',signal:AbortSignal):Promise<unknown>{
  const cap=kind==='indexes'?32768:512*1024
  if(!asset||!HEX.test(asset.sha256)||asset.path!==`${kind}/${asset.sha256}.json`||!Number.isInteger(asset.bytes)||asset.bytes<1||asset.bytes>cap)throw Error('author_person_asset')
  const response=await fetch(base+asset.path,{cache:'force-cache',signal});if(!response.ok)throw Error(`author_person_http_${response.status}`)
  const reader=response.body?.getReader();if(!reader)throw Error('author_person_integrity')
  const chunks:Uint8Array[]=[];let size=0
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>asset.bytes||size>cap)throw Error('author_person_size');chunks.push(value)}}finally{void reader.cancel().catch(()=>{});reader.releaseLock()}
  if(size!==asset.bytes)throw Error('author_person_integrity')
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('')
  if(digest!==asset.sha256)throw Error('author_person_integrity');return JSON.parse(new TextDecoder().decode(bytes))
 }
 function bounded<T>(run:(signal:AbortSignal)=>Promise<T>):Promise<T>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('author_person_deadline')),12000)
  return cancellable(Promise.resolve().then(()=>run(controller.signal)),controller.signal).finally(()=>clearTimeout(timer))
 }
 function index(key:string):Promise<Record<string,Asset>>{
  let task=indexes.get(key)
  if(!task){task=bounded(async signal=>{const value=await verified(release.shards[key],'indexes',signal) as {contract:string;generation:string;entries:Record<string,Asset>};if(value.contract!=='khizana-author-person-shard/1'||value.generation!==release.generation||!value.entries||typeof value.entries!=='object'||Array.isArray(value.entries)||Object.keys(value.entries).some(id=>!/^\d{1,6}$/.test(id)||String(Number(id)%64)!==key))throw Error('author_person_revision');return value.entries}).catch(error=>{indexes.delete(key);throw error});indexes.set(key,task);if(indexes.size>8)indexes.delete(indexes.keys().next().value!)}
  return task
 }
 async function read(id:string,signal:AbortSignal):Promise<AuthorPersonBundle|undefined>{
  const entries=await index(String(Number(id)%64));if(signal.aborted)throw signal.reason
  const asset=entries[id];if(!asset)return undefined
  const value=await verified(asset,'persons',signal) as AuthorPersonBundle
  if(value.contract!=='khizana-author-person/1'||value.generation!==release.generation||value.entry?.authorId!==id||value.entry.id!==`shamela-${id}`||typeof value.entry.name!=='string'||!value.entry.name.trim()||!Array.isArray(value.entry.books)||value.entry.bookCount!==value.entry.books.length||!['available','unavailable'].includes(value.coverage?.shamela)||!['available','unavailable','unmapped'].includes(value.coverage?.tarajm)||!Array.isArray(value.relationNames)||!Array.isArray(value.relationCatalog)||!Array.isArray(value.tarajm?.peopleHrefByTarajmId))throw Error('author_person_identity')
  if(value.coverage.shamela==='available'&&(!value.entry.biography||value.entry.biographyProvenance?.sourceUrl!==`https://shamela.ws/author/${id}`)||value.coverage.tarajm==='available'&&!value.tarajm.biography)throw Error('author_person_coverage')
  return value
 }
 return{load(id:string,signal?:AbortSignal):Promise<AuthorPersonBundle|undefined>{
  if(!/^\d{1,6}$/.test(id)||Number(id)<1)return Promise.reject(Error('author_person_identity'))
  if(signal?.aborted)return Promise.reject(signal.reason??new DOMException('Aborted','AbortError'))
  id=String(Number(id));let task=people.get(id)
  if(!task){task=bounded(s=>read(id,s)).catch(error=>{people.delete(id);throw error});people.set(id,task);if(people.size>16)people.delete(people.keys().next().value!)}
  return signal?cancellable(task,signal):task
 }}
}
