import {json,trustedAccount,trustedMutation} from '../_account-contract.js'
import {boundedQuoteJson,quoteActor,quotePage,quoteSource,visibleQuote} from '../_public-quotes.js'
export async function onRequestPost(context){
 if(!trustedMutation(context.request))return json({error:'cross_site_request_rejected'},403)
 try{
  const account=await trustedAccount(context);if(!account)return json({error:'authentication_required'},401)
  let body;try{if(!context.request.headers.get('content-type')?.includes('application/json'))throw Error('body');body=await boundedQuoteJson(context.request.body)}catch{return json({error:'invalid_quote'},400)}
  if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['text','bookId','pageIndex','sharePublic','sourceBatchId'].includes(k))||body.sharePublic!==true||typeof body.text!=='string'||!body.text.trim()||body.text.length>2000||/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body.text)||!Number.isSafeInteger(body.pageIndex)||body.pageIndex<0||body.pageIndex>1000000)return json({error:'invalid_quote'},400)
  const source=await quoteSource(context.env,body.bookId,body.pageIndex,body.sourceBatchId);if(!source)return json({error:'quote_public_book_required'},400)
  const text=body.text.trim(),hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([body.bookId,body.pageIndex,text]))),fingerprint=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join(''),id=crypto.randomUUID(),db=context.env.VISITORS_DB
  const result=await db.prepare(`INSERT INTO public_quotes(id,owner_subject,text,book_id,source_kind,source_id,book_title,page_index,fingerprint) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9 WHERE ${quoteActor} AND (SELECT COUNT(*) FROM public_quotes WHERE owner_subject=?2)<1000 AND (SELECT COUNT(*) FROM public_quotes WHERE owner_subject=?2 AND created_at>=datetime('now','-1 minute'))<20 AND NOT EXISTS(SELECT 1 FROM central_book_overrides WHERE (book_id=?4 OR book_id=?6) AND (visibility<>'public' OR logically_deleted_at IS NOT NULL)) AND (?5<>'submitted' OR EXISTS(SELECT 1 FROM user_books WHERE id=?6 AND visibility='public' AND review_status='approved' AND deleted_at IS NULL)) ON CONFLICT(owner_subject,fingerprint) DO NOTHING`).bind(id,account.subject,text,body.bookId,source.kind,source.id,source.title,body.pageIndex,fingerprint).run()
  if(Number(result.meta?.changes)===1)return json({id},201)
  const existing=await db.prepare(`SELECT q.id FROM public_quotes q WHERE q.fingerprint=?1 AND q.owner_subject=?2 AND ${quoteActor} AND ${visibleQuote}`).bind(fingerprint,account.subject).first()
  return existing?json({id:existing.id},200):json({error:'quote_not_saved'},409)
 }catch{return json({error:'quotes_unavailable'},503)}
}
export async function onRequestDelete(context){
 if(!trustedMutation(context.request))return json({error:'cross_site_request_rejected'},403)
 try{const account=await trustedAccount(context);if(!account)return json({error:'authentication_required'},401)
  const p=new URL(context.request.url).searchParams,id=p.get('id');if(p.size!==1||p.getAll('id').length!==1||!id||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id))return json({error:'invalid_quote_id'},400)
  const r=await context.env.VISITORS_DB.prepare(`DELETE FROM public_quotes WHERE id=?1 AND owner_subject=?2 AND ${quoteActor}`).bind(id,account.subject).run()
  return Number(r.meta?.changes)===1?json({id,deleted:true}):json({error:'quote_not_found'},404)
 }catch{return json({error:'quotes_unavailable'},503)}
}
export async function onRequestGet(context){try{const account=await trustedAccount(context);return account?await quotePage(context,account.subject):json({error:'authentication_required'},401)}catch{return json({error:'quotes_unavailable'},503)}}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET, POST, DELETE'})
