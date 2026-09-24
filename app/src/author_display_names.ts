import {localizedAuthorDisplayName} from './author_locale_display'

/** Read-time identity projection: never modifies stored book bytes or matches names. */
interface NameRow {authorId:string;displayName:string;revision:number}
// Public editorial names rarely change, but a 30-second full pagination
// reread can repeatedly scan the same D1 registry on every navigation.
const AUTHOR_NAMES_REFRESH_MS=5*60_000
const AUTHOR_NAMES_PAGE_SIZE=500
let names=new Map<string,NameRow>(),expires=0,pending:Promise<void>|undefined,generation=0,hasSnapshot=false
export function canonicalAuthorIdentity(value?:string):string {
 const id=value?.trim()??''
 const shamela=/^(?:(?:shamela:|shamela-|shamela-author-|local:shamela-author-))?(\d+)$/.exec(id)
 return shamela?`shamela:${Number(shamela[1])}`:id
}
export function currentAuthorName(id:string|undefined,fallback:string):string{return names.get(canonicalAuthorIdentity(id))?.displayName??fallback}
const bookViews=new WeakMap<object,object>()
export function projectBookAuthorNames<T extends {author:string;authorId?:string;authors?:Array<{name:string;id?:string}>}>(book:T):T {
 if(!book.authorId&&!book.authors?.some(ref=>ref.id))return book
 const cached=bookViews.get(book);if(cached)return cached as T
 const original=book.author,view={...book}
 Object.defineProperty(view,'author',{enumerable:true,configurable:true,get:()=>currentAuthorName(book.authorId,original)})
 if(book.authors)view.authors=book.authors.map(ref=>{const id=ref.id??(ref.name.trim()===original.trim()?book.authorId:undefined);if(!id)return ref;const copy={...ref,id};Object.defineProperty(copy,'name',{enumerable:true,configurable:true,get:()=>currentAuthorName(id,ref.name)});return copy})
 bookViews.set(book,view);return view
}
/** Updates only marked text nodes, never remounts a form or touches a draft. */
function notifyNames(){
 if(typeof document!=='undefined')for(const element of document.querySelectorAll<HTMLElement>('[data-author-identity]')){const fallback=element.dataset.authorOriginal??element.textContent??'';element.dataset.authorOriginal=fallback;const canonical=currentAuthorName(element.dataset.authorIdentity,fallback),locale=typeof localStorage==='undefined'?'ar':localStorage.getItem('khizana:site-language')??'ar';element.textContent=localizedAuthorDisplayName(element.dataset.authorIdentity,canonical,locale)}
 if(typeof window!=='undefined')window.dispatchEvent(new Event('author-names-changed'))
}
export function bindAuthorDisplayName<T extends HTMLElement>(element:T,id:string|undefined,fallback:string):T{if(id){element.dataset.authorIdentity=id;element.dataset.authorOriginal=fallback;const canonical=currentAuthorName(id,fallback),locale=typeof localStorage==='undefined'?'ar':localStorage.getItem('khizana:site-language')??'ar';element.textContent=localizedAuthorDisplayName(id,canonical,locale)}return element}
export function repaintAuthorDisplayNames():void{notifyNames()}
export function rememberAuthorDisplayName(authorId:string,displayName:string,revision:number):void {
 const id=canonicalAuthorIdentity(authorId),old=names.get(id)
 if(!id||!displayName.trim()||displayName.length>300||!Number.isSafeInteger(revision)||revision<1||old&&old.revision>revision)return
 names.set(id,{authorId:id,displayName:displayName.trim(),revision});generation++;expires=0
 notifyNames()
}
export async function hydrateAuthorDisplayNames():Promise<void>{
 if(Date.now()<expires)return
 if(pending)return hasSnapshot?undefined:pending
 const ticket=generation
 pending=(async()=>{
  const next=new Map<string,NameRow>();let version:string|undefined
  const signal=AbortSignal.timeout(4000)
  for(let page=0;page<100;page++){
   const response=await fetch(`/api/library/author-names?page=${page}&limit=${AUTHOR_NAMES_PAGE_SIZE}`,{credentials:'same-origin',cache:'default',redirect:'error',signal})
   if(!response.ok)throw Error('author_names_unavailable')
   const reader=response.body?.getReader();if(!reader)throw Error('author_names_invalid')
   const chunks:Uint8Array[]=[];let size=0
   try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>524288)throw Error('author_names_oversized');chunks.push(part.value)}}catch(error){await reader.cancel();throw error}finally{reader.releaseLock()}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
   const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
   if(value.schemaVersion!==1||value.page!==page||typeof value.hasMore!=='boolean'||typeof value.version!=='string'||!/^\d+:\d+:\d+$/.test(value.version)||!Array.isArray(value.names)||value.names.length>AUTHOR_NAMES_PAGE_SIZE||version&&version!==value.version)throw Error('author_names_invalid')
   version=value.version
   for(const row of value.names){if(typeof row.authorId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,199}$/.test(row.authorId)||typeof row.displayName!=='string'||!row.displayName.trim()||row.displayName.length>300||!Number.isSafeInteger(row.revision)||row.revision<1)throw Error('author_names_invalid');const id=canonicalAuthorIdentity(row.authorId);if(next.has(id))throw Error('author_names_duplicate');next.set(id,row)}
   if(!value.hasMore){if(ticket===generation){names=next;hasSnapshot=true;expires=Date.now()+AUTHOR_NAMES_REFRESH_MS;notifyNames()}return}
   if(value.names.length!==AUTHOR_NAMES_PAGE_SIZE)throw Error('author_names_invalid')
  }
  throw Error('author_names_limit')
 })().catch(error=>{expires=Date.now()+15000;throw error}).finally(()=>{pending=undefined})
 if(hasSnapshot){void pending.catch(()=>undefined);return}
 return pending
}
export function resetAuthorDisplayNamesForTests(){names=new Map();expires=0;generation++;pending=undefined;hasSnapshot=false}
