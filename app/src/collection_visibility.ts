import {shamelaPublicBookId,shamelaSourceBookId} from './shamela_public_identity'

export interface CollectionVisibilityOverride {bookId:string;visibility:'public'|'unlisted'|'hidden';logicallyDeleted:boolean}
/** Keep each Shamela visibility fence on the indexed two-ID D1 query. */
export function collectionVisibilityUrl(book:{id:string;sourceKind?:string;sourceBookId?:string}):string{
 const base='/api/library/central-overrides'
 if(book.sourceKind!=='shamela4.1'||!book.sourceBookId)return base
 const source=shamelaSourceBookId(book.id)
 if(source!==book.sourceBookId)return base
 return `${base}?bookId=${encodeURIComponent(shamelaPublicBookId(source))}`
}
/** Fail closed on oversized, malformed or ambiguous visibility data. */
export async function readCollectionVisibility(response:Response,signal:AbortSignal):Promise<CollectionVisibilityOverride[]>{
 const limit=1024*1024
 if(!response.ok||!response.body)throw Error('collection_public_visibility_unavailable')
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0
 const active=()=>{if(signal.aborted)throw new DOMException('Cancelled','AbortError')}
 const cancel=()=>{void reader.cancel().catch(()=>{})}
 signal.addEventListener('abort',cancel,{once:true})
 try{
  active()
  const length=response.headers.get('content-length')
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>limit))throw Error('collection_public_visibility_size')
  for(;;){active();const {done,value}=await reader.read();active();if(done)break;size+=value.length;if(size>limit)throw Error('collection_public_visibility_size');chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  const payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
  if(payload?.schemaVersion!==1||!Array.isArray(payload.overrides)||payload.overrides.length>10000)throw Error('collection_public_visibility_invalid')
  const seen=new Set<string>()
  for(const row of payload.overrides){
   if(!row||typeof row.bookId!=='string'||!row.bookId||row.bookId.length>200||seen.has(row.bookId)||!['public','unlisted','hidden'].includes(row.visibility)||typeof row.logicallyDeleted!=='boolean')throw Error('collection_public_visibility_invalid')
   seen.add(row.bookId)
  }
  return payload.overrides
 }finally{signal.removeEventListener('abort',cancel);await reader.cancel().catch(()=>{});reader.releaseLock()}
}
