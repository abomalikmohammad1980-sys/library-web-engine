/** Public display records only. These are not hydrated StoredBooks or search entries. */
import {isCentralAuthorId} from './central_author_client'
import {currentAuthorName} from './author_display_names'
export interface PublishedCatalogBook {id:string;title:string;author:string;centralAuthorId?:string;category:string|null;mimeType:string;byteLength:number;createdAt:string;fileUrl:string}
export interface PublishedCatalogSnapshot {books:PublishedCatalogBook[];revision:string|null;nextCursor:string|null;complete:boolean;error:string|null}
type Fetcher=(input:string,init?:RequestInit)=>Promise<Response>
const MAX_PAGE_BYTES=256*1024,MAX_BOOKS=100_000
const fail=(code='invalid_catalog_page'):never=>{throw new Error(code)}
const object=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:fail()
function boundedString(value:unknown,max:number,empty=false):string{if(typeof value!=='string'||value.length>max||(!empty&&!value.trim())||/[\u0000-\u001f]/.test(value))return fail();return value}
function parseBook(value:unknown):PublishedCatalogBook{
 const row=object(value),id=boundedString(row.id,200)
 if(!/^[A-Za-z0-9_-]+$/.test(id)||row.visibility!==undefined&&row.visibility!=='public'||row.reviewStatus!==undefined&&row.reviewStatus!=='approved'||row.review_status!==undefined&&row.review_status!=='approved')return fail()
 const fileUrl=`/api/account/books/${encodeURIComponent(id)}/file`
 if(row.fileUrl!==fileUrl||!Number.isSafeInteger(row.byteLength)||Number(row.byteLength)<1||Number(row.byteLength)>64*1024*1024)return fail()
 const createdAt=boundedString(row.createdAt,40)
 if(!/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?:\.\d{1,6})?Z?$/.test(createdAt))return fail()
 if(row.centralAuthorId!==undefined&&row.centralAuthorId!==null&&(typeof row.centralAuthorId!=='string'||!isCentralAuthorId(row.centralAuthorId)))return fail()
 return {id,title:boundedString(row.title,300),author:boundedString(row.author,200),...(typeof row.centralAuthorId==='string'?{centralAuthorId:row.centralAuthorId}:{}),category:row.category===null?null:boundedString(row.category,120,true),mimeType:boundedString(row.mimeType,150),byteLength:Number(row.byteLength),createdAt,fileUrl}
}
async function boundedJson(response:Response,signal?:AbortSignal):Promise<unknown>{
 if(!response.headers.get('content-type')?.toLowerCase().includes('application/json'))return fail()
 if(Number(response.headers.get('content-length'))>MAX_PAGE_BYTES||!response.body)return fail()
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let bytes=0
 try{while(true){if(signal?.aborted)return fail('catalog_aborted');const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>MAX_PAGE_BYTES)return fail();chunks.push(part.value)}}catch(error){await reader.cancel().catch(()=>undefined);throw error}finally{reader.releaseLock()}
 const data=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data))
}
export function createPublishedBooksCatalogClient(options:{fetch?:Fetcher}={}){
 const fetcher=options.fetch??fetch
 let books=new Map<string,PublishedCatalogBook>(),revision:string|null=null,cursor:string|null=null,complete=false,error:string|null=null,inflight:Promise<PublishedCatalogSnapshot>|undefined
 const seen=new Set<string>()
 const snapshot=():PublishedCatalogSnapshot=>({books:[...books.values()].map(book=>({...book,author:currentAuthorName(book.centralAuthorId,book.author)})),revision,nextCursor:cursor,complete,error})
 async function load(signal?:AbortSignal):Promise<PublishedCatalogSnapshot>{
  if(complete)return snapshot()
  error=null
  try{
   for(let restart=0;restart<=1;restart++){
    if(signal?.aborted)return fail('catalog_aborted')
    const url='/api/library/published-books?limit=100'+(cursor?`&cursor=${encodeURIComponent(cursor)}`:'')
    const response=await fetcher(url,{credentials:'omit',cache:'no-store',redirect:'error',...(signal?{signal}:{})})
    if(signal?.aborted)return fail('catalog_aborted')
    if(response.status===409){await response.body?.cancel();books=new Map();revision=null;cursor=null;seen.clear();if(restart===1)return fail('catalog_changed');continue}
    if(!response.ok){await response.body?.cancel();return fail(`catalog_http_${response.status}`)}
    const raw=object(await boundedJson(response,signal))
    if(raw.schemaVersion!==1||typeof raw.revision!=='string'||!/^[a-f0-9]{64}$/.test(raw.revision)||!Array.isArray(raw.books)||raw.books.length>100||typeof raw.hasMore!=='boolean')return fail()
    if(revision!==null&&revision!==raw.revision)return fail('catalog_revision_mismatch')
    const next=raw.nextCursor
    if(next!==null&&(typeof next!=='string'||!/^[A-Za-z0-9_-]{1,800}$/.test(next)))return fail()
    if(raw.hasMore!==(next!==null)||raw.hasMore&&raw.books.length===0||typeof next==='string'&&seen.has(next))return fail()
    const incoming=new Map<string,PublishedCatalogBook>()
    for(const value of raw.books){const book=parseBook(value),prior=incoming.get(book.id)??books.get(book.id);if(prior&&JSON.stringify(prior)!==JSON.stringify(book))return fail('catalog_conflicting_id');incoming.set(book.id,book)}
    if(books.size+[...incoming.keys()].filter(id=>!books.has(id)).length>MAX_BOOKS)return fail('catalog_limit_exceeded')
    if(signal?.aborted)return fail('catalog_aborted')
    for(const [id,book]of incoming)books.set(id,book)
    revision=raw.revision;cursor=next as string|null;complete=!raw.hasMore;if(cursor)seen.add(cursor)
    return snapshot()
   }
  }catch(cause){error=signal?.aborted?'catalog_aborted':cause instanceof Error&&/^(catalog_|invalid_catalog_page)/.test(cause.message)?cause.message:'invalid_catalog_page'}
  return snapshot()
 }
 return {snapshot,next(signal?:AbortSignal):Promise<PublishedCatalogSnapshot>{if(inflight)return inflight;const task=load(signal).finally(()=>{if(inflight===task)inflight=undefined});inflight=task;return task}}
}
