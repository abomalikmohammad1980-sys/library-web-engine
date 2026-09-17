import {json,trustedAccount,trustedMutation,isManager} from '../_account-contract.js'
import {retryFailedPublicBookIndex} from '../_public-book-event-outbox.js'
import {afterPublicBookMutation} from '../_public-book-index-wake.js'
async function retryBody(request){
 const reader=request.body?.getReader();if(!reader)return null
 const chunks=[];let size=0
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096)return null;chunks.push(value)}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 try{const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length}return JSON.parse(new TextDecoder().decode(bytes))}catch{return null}
}
// Injection is for isolated tests only; production export always uses trustedAccount.
export function createBookIndexingHandler(authenticate=trustedAccount,retry=retryFailedPublicBookIndex){return async context=>{
 const {request,env}=context
 if(!['GET','POST'].includes(request.method))return json({error:'method_not_allowed'},405)
 if(request.method==='POST'&&!trustedMutation(request))return json({error:'cross_site_request_rejected'},403)
 const account=await authenticate(context);if(!isManager(account))return json({error:'admin_required'},403)
 if(env.PUBLIC_BOOK_INGESTION_ENABLED!=='true'||!env.VISITORS_DB)return json({error:'indexing_unavailable'},503)
 const db=env.VISITORS_DB.withSession?.('first-primary')??env.VISITORS_DB
 try{
  if(request.method==='POST'){
   const body=await retryBody(request)
   if(!body||Object.keys(body).some(k=>!['bookId','contentVersion'].includes(k))||typeof body.bookId!=='string'||!body.bookId||body.bookId.length>200||!Number.isSafeInteger(body.contentVersion)||body.contentVersion<1)return json({error:'invalid_retry'},400)
   return await retry(db,body)?afterPublicBookMutation(context,json({queued:true},202)):json({error:'indexing_state_changed'},409)
  }
  const url=new URL(request.url),raw=url.searchParams.get('page')??'1'
  if([...url.searchParams.keys()].some(k=>k!=='page')||url.searchParams.getAll('page').length>1||!/^\d+$/.test(raw)||!Number.isSafeInteger(Number(raw))||Number(raw)<1||Number(raw)>1000000)return json({error:'invalid_page'},400)
  const totals=await db.prepare("SELECT COUNT(*) AS total,COALESCE(SUM(status='ready'),0) AS ready,COALESCE(SUM(status IN ('queued','extracting','indexing')),0) AS processing,COALESCE(SUM(status='failed'),0) AS failed,COALESCE(SUM(status='ocr_pending'),0) AS ocrPending FROM books_index_state").first()
  const pages=Math.max(1,Math.ceil(Number(totals.total)/100)),page=Math.min(Number(raw),pages)
  const result=await db.prepare(`SELECT s.book_id,SUBSTR(COALESCE(b.title,''),1,1000) AS title,s.status,s.content_version,s.updated_at,s.indexed_at,s.toc_source,s.ocr FROM books_index_state s LEFT JOIN user_books b ON b.id=s.book_id ORDER BY s.updated_at DESC,s.book_id LIMIT 100 OFFSET ?1`).bind((page-1)*100).all()
  const rows=(result.results??[]).map(row=>({bookId:row.book_id,title:row.title,status:row.status,contentVersion:row.content_version,updatedAt:row.updated_at,indexedAt:row.indexed_at??null,tocSource:row.toc_source,ocr:row.ocr===1}))
  return json({rows,page,pages,counts:{ready:Number(totals.ready),processing:Number(totals.processing),failed:Number(totals.failed),ocrPending:Number(totals.ocrPending)}})
 }catch{return json({error:'indexing_unavailable'},503)}
}}
export const onRequest=createBookIndexingHandler()
