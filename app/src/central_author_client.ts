import {currentAccountClaims} from './account_authority'
import {rememberAuthorDisplayName} from './author_display_names'
import {validAuthorStructuredFields,type AuthorStructuredFields} from './author_structured_fields'
export interface CentralAuthorSummary {authorId:string;displayName:string;deathYearHijri:number|null;contemporary:boolean;revision:number}
export interface CentralAuthor extends CentralAuthorSummary {biography:string;source:string;fields?:AuthorStructuredFields}
export interface CentralAuthorDraft {displayName:string;biography:string;source?:string;reason?:string;deathYearHijri?:number|null;contemporary?:boolean;fields?:AuthorStructuredFields}
export const isCentralAuthorId=(id:string)=>/^central-author:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
const invalid=()=>Error('تعذّر التحقق من بيانات المؤلف المركزي.')
export const canEditCentralAuthors=()=>['editor','super-admin'].includes(currentAccountClaims()?.role??'')
async function request(path:string,init:RequestInit={},signal?:AbortSignal){
 const response=await fetch(path,{...init,credentials:'same-origin',cache:'no-store',redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)})
 if(response.status===409)throw Error('غيّر محرر آخر هذه الترجمة؛ حدّث الصفحة قبل إعادة المحاولة.')
 if(!response.ok)throw Error('تعذّر الاتصال بدليل المؤلفين المركزي.')
 const reader=response.body?.getReader();if(!reader)throw invalid();const parts:Uint8Array[]=[];let size=0
 try{for(;;){const result=await reader.read();if(result.done)break;size+=result.value.byteLength;if(size>512*1024)throw invalid();parts.push(result.value)}}catch(error){await reader.cancel();throw error}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
}
function summary(row:any):CentralAuthorSummary{
 if(!row||!isCentralAuthorId(row.authorId??'')||typeof row.displayName!=='string'||!row.displayName.trim()||row.displayName.length>300||!Number.isSafeInteger(row.revision)||row.revision<1||typeof row.contemporary!=='boolean'||!(row.deathYearHijri===null||(Number.isSafeInteger(row.deathYearHijri)&&row.deathYearHijri>=-10000&&row.deathYearHijri<=3000))||(row.contemporary&&row.deathYearHijri!==null))throw invalid()
 return {authorId:row.authorId,displayName:row.displayName,deathYearHijri:row.deathYearHijri,contemporary:row.contemporary,revision:row.revision}
}
export async function loadCentralAuthors(page=0,signal?:AbortSignal,query=''):Promise<{authors:CentralAuthorSummary[];page:number;hasMore:boolean}>{
 if(!Number.isSafeInteger(page)||page<0||page>10000)throw invalid()
 if(query.trim().length>300)throw invalid()
 const value=await request(`/api/library/central-authors?page=${page}&limit=100${query.trim()?'&q='+encodeURIComponent(query.trim()):''}`,{},signal)
 if(!value||!Array.isArray(value.authors)||value.authors.length>100||value.page!==page||typeof value.hasMore!=='boolean'||(value.hasMore&&!value.authors.length))throw invalid()
 const authors=value.authors.map(summary);if(new Set(authors.map((a:CentralAuthorSummary)=>a.authorId)).size!==authors.length)throw invalid()
 return{authors,page,hasMore:value.hasMore}
}
export async function loadCentralAuthor(id:string,signal?:AbortSignal):Promise<CentralAuthor>{
 if(!isCentralAuthorId(id))throw invalid()
 const {author}=await request(`/api/library/central-authors?id=${encodeURIComponent(id)}`,{},signal),base=summary(author)
 if(base.authorId!==id||typeof author.biography!=='string'||author.biography.length>20000||typeof author.source!=='string'||author.source.length>2000||!validAuthorStructuredFields(author.fields??{}))throw invalid()
 if(author.fields?.deathHijri!==undefined&&author.fields.deathHijri!==base.deathYearHijri)throw invalid()
 return{...base,biography:author.biography,source:author.source,fields:author.fields??{}}
}
export async function saveCentralAuthor(draft:CentralAuthorDraft,existing?:CentralAuthor):Promise<{authorId:string;revision:number}>{
 const identity=currentAccountClaims();if(!canEditCentralAuthors()||!identity)throw Error('يلزم حساب محرر موثّق.')
 if(existing&&!isCentralAuthorId(existing.authorId))throw invalid()
 if(!draft.displayName.trim()||draft.displayName.length>300||draft.biography.length>20000||!validAuthorStructuredFields(draft.fields??{}))throw invalid()
 const fields={...existing?.fields,...draft.fields}
 if(draft.deathYearHijri!==undefined&&draft.fields?.deathHijri!==undefined&&draft.deathYearHijri!==draft.fields.deathHijri)throw invalid()
 const death=draft.fields?.deathHijri!==undefined?draft.fields.deathHijri:draft.deathYearHijri!==undefined?draft.deathYearHijri:existing?.deathYearHijri??null
 if(!validAuthorStructuredFields({...fields,deathHijri:death})||(draft.contemporary??existing?.contemporary)&&death!==null)throw invalid()
 const value=await request('/api/admin/central-authors'+(existing?'/'+encodeURIComponent(existing.authorId):''),{method:existing?'PATCH':'POST',headers:{'content-type':'application/json','x-alkhizana-request':'account-ui'},body:JSON.stringify({...draft,...(existing?{expectedVersion:existing.revision}:{})})})
 const active=currentAccountClaims();if(active?.subject!==identity.subject||active.sessionId!==identity.sessionId||!canEditCentralAuthors())throw Error('تغيّرت جلسة الحساب.')
 if(!isCentralAuthorId(value?.authorId??'')||(existing&&value.authorId!==existing.authorId)||value.revision!==(existing?existing.revision+1:1))throw invalid()
 rememberAuthorDisplayName(value.authorId,draft.displayName,value.revision)
 return{authorId:value.authorId,revision:value.revision}
}
