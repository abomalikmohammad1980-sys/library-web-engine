import {parseAuthorOverrideIssue,type AuthorOverrideIssue} from './author_override_validation'
import {rememberAuthorDisplayName} from './author_display_names'
import {validAuthorStructuredFields,type AuthorStructuredFields} from './author_structured_fields'
export class AuthorOverrideValidationError extends Error {
 constructor(readonly issue:AuthorOverrideIssue|null){super('invalid_author_override')}
}
export interface AuthorOverride {authorId:string;displayName:string;biography:string;source:string;revision:number;updatedAt:string;fields?:AuthorStructuredFields}
export interface AuthorOverrideDraft {expectedVersion:number;displayName:string;biography:string;source:string;reason:string;fields?:AuthorStructuredFields}
export type AuthorOverrideBaseline={row:AuthorOverride|null}|{unavailable:boolean}
interface Options {fetch?:typeof fetch;signal?:AbortSignal}
const validId=(id:string)=>/^[A-Za-z0-9][A-Za-z0-9:_-]{0,199}$/.test(id)
const fail=()=>new Error('invalid_author_response')
async function request(path:string,options:Options,init:RequestInit={}){
 const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(8000)]):AbortSignal.timeout(8000)
 signal.throwIfAborted()
 return (options.fetch??fetch)(path,{...init,credentials:'same-origin',cache:'no-store',redirect:'error',signal})
}
async function body(response:Response,signal?:AbortSignal):Promise<Record<string,unknown>>{
 if(!response.body)throw fail()
 const reader=response.body.getReader(),parts:Uint8Array[]=[];let size=0
 const abort=()=>{void reader.cancel().catch(()=>undefined)};signal?.addEventListener('abort',abort,{once:true})
 try{signal?.throwIfAborted();for(;;){const {done,value}=await reader.read();signal?.throwIfAborted();if(done)break;size+=value.byteLength;if(size>131072)throw fail();parts.push(value)}}catch(error){await reader.cancel();throw error}finally{signal?.removeEventListener('abort',abort);reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength}
 const value:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
 if(!value||typeof value!=='object'||Array.isArray(value))throw fail();return value as Record<string,unknown>
}
export interface AuthorOverrideHistoryEntry {revision:number;displayName:string;biography:string;source:string;reason:string;createdAt:string;fields?:AuthorStructuredFields}
export interface AuthorOverrideHistoryPage {history:AuthorOverrideHistoryEntry[];hasMore:boolean;nextBeforeVersion:number|null}
export async function loadAuthorOverrideHistory(id:string,beforeVersion=2147483647,options:Options={}):Promise<AuthorOverrideHistoryPage>{
 if(!validId(id))throw new Error('invalid_author_id')
 if(!Number.isSafeInteger(beforeVersion)||beforeVersion<1||beforeVersion>2147483647)throw fail()
 const signal=AbortSignal.any([...(options.signal?[options.signal]:[]),AbortSignal.timeout(8000)])
 // One full narrative per page keeps even worst-case escaped text within 128 KiB.
 const response=await request(`/api/admin/authors/${encodeURIComponent(id)}?limit=1&beforeVersion=${beforeVersion}`,{...options,signal},{method:'GET'})
 if(response.status===401||response.status===403)throw new Error('super_admin_required')
 if(!response.ok)throw new Error('author_overrides_unavailable')
 if(!response.headers.get('content-type')?.includes('application/json'))throw fail()
 const payload=await body(response,signal)
 if(payload.authorId!==id||!Array.isArray(payload.history)||payload.history.length>1||typeof payload.hasMore!=='boolean')throw fail()
 const history=payload.history.map(value=>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw fail()
  const row=value as Record<string,unknown>
  if(!Number.isSafeInteger(row.revision)||Number(row.revision)<1||Number(row.revision)>=beforeVersion)throw fail()
  for(const [key,max] of [['displayName',300],['biography',20000],['source',2000],['reason',1000],['createdAt',100]] as const)if(typeof row[key]!=='string'||(!['biography','source','reason'].includes(key)&&!row[key].trim())||row[key].length>max)throw fail()
  if(row.fields!==undefined&&!validAuthorStructuredFields(row.fields))throw fail()
  return {revision:Number(row.revision),displayName:String(row.displayName),biography:String(row.biography),source:String(row.source),reason:String(row.reason),createdAt:String(row.createdAt),...(row.fields!==undefined?{fields:row.fields as AuthorStructuredFields}:{})}
 })
 const next=history[0]?.revision
 if(payload.hasMore?history.length!==1||payload.nextBeforeVersion!==next:payload.nextBeforeVersion!==null)throw fail()
 signal.throwIfAborted();return {history,hasMore:payload.hasMore,nextBeforeVersion:payload.hasMore?next!:null}
}
export async function loadAuthorStructuredOverrides(options:Options={}):Promise<Array<{authorId:string;fields:AuthorStructuredFields}>>{
 const signal=AbortSignal.any([...(options.signal?[options.signal]:[]),AbortSignal.timeout(20000)]),rows:Array<{authorId:string;fields:AuthorStructuredFields}>=[],seen=new Set<string>()
 for(let page=0;page<=10000;page++){
  const response=await request('/api/library/author-overrides?limit=1&page='+page,{...options,signal});if(!response.ok)throw Error('author_overrides_unavailable')
  const value=await body(response,signal)
  if(value.schemaVersion!==1||value.page!==page||typeof value.hasMore!=='boolean'||!Array.isArray(value.overrides)||value.overrides.length>1||value.hasMore&&!value.overrides.length)throw fail()
  for(const row of value.overrides){if(!row||!validId(row.authorId)||seen.has(row.authorId)||!validAuthorStructuredFields(row.fields??{}))throw fail();seen.add(row.authorId);rows.push({authorId:row.authorId,fields:row.fields??{}})}
  if(!value.hasMore)return rows
 }
 throw fail()
}
export async function loadAuthorChronologyOverrides(options:Options={}):Promise<Array<{authorId:string;deathHijri:number|null;contemporary?:boolean}>>{
 return (await loadAuthorStructuredOverrides(options)).filter(row=>Object.hasOwn(row.fields,'deathHijri')||row.fields.contemporary).map(row=>({authorId:row.authorId,deathHijri:row.fields.deathHijri??null,...(typeof row.fields.contemporary==='boolean'?{contemporary:row.fields.contemporary}:{})}))
}
export async function loadAuthorOverride(id:string,options:Options={}):Promise<AuthorOverride|null>{
 if(!validId(id))throw new Error('invalid_author_id')
 const signal=AbortSignal.any([...(options.signal?[options.signal]:[]),AbortSignal.timeout(8000)])
 const response=await request(`/api/library/author-overrides?id=${encodeURIComponent(id)}`,{...options,signal})
 if(response.status===404)return null
 if(!response.ok)throw new Error('author_overrides_unavailable')
 const payload=await body(response,signal),row=payload.override as Partial<AuthorOverride>|undefined
 if(payload.schemaVersion!==1||!row||row.authorId!==id||!Number.isSafeInteger(row.revision)||row.revision!<1)throw fail()
 for(const [key,max] of [['displayName',300],['biography',20000],['source',2000],['updatedAt',100]] as const)if(typeof row[key]!=='string'||(!['source','biography'].includes(key)&&!row[key]!.trim())||row[key]!.length>max)throw fail()
 options.signal?.throwIfAborted()
 if(row.fields!==undefined&&!validAuthorStructuredFields(row.fields))throw fail()
 return {authorId:id,displayName:row.displayName!,biography:row.biography!,source:row.source!,revision:row.revision!,updatedAt:row.updatedAt!,...(row.fields?{fields:row.fields}:{})}
}
export async function saveAuthorOverride(id:string,draft:AuthorOverrideDraft,options:Options={}):Promise<number>{
 if(!validId(id))throw new Error('invalid_author_id')
 const response=await request(`/api/admin/authors/${encodeURIComponent(id)}`,options,{method:'PATCH',headers:{'content-type':'application/json','x-alkhizana-request':'account-ui'},body:JSON.stringify(draft)})
 if(response.status===409)throw new Error('author_override_conflict')
 if(response.status===403||response.status===401)throw new Error('super_admin_required')
 if(response.status===400){
  let issue:AuthorOverrideIssue|null=null
  try{const payload=await body(response,options.signal);if(payload.error==='invalid_author_override')issue=parseAuthorOverrideIssue(payload.details)}catch{}
  throw new AuthorOverrideValidationError(issue)
 }
 if(!response.ok)throw new Error('author_overrides_unavailable')
 const payload=await body(response);if(payload.authorId!==id||payload.revision!==draft.expectedVersion+1)throw fail()
 options.signal?.throwIfAborted();rememberAuthorDisplayName(id,draft.displayName,Number(payload.revision));return Number(payload.revision)
}
