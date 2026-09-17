import {json,trustedAccount,trustedMutation,canEditLibrary} from '../_account-contract.js'
import {boundedDraftBody,validDraftKey} from '../_bok-text-drafts.js'
import {accessHash,cookieValue} from '../_access-session.js'
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),jobId=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v)
const publicJob=row=>row?{id:row.id,bookId:row.book_id,status:row.status,releaseId:row.release_id??null,failureCode:row.failure_code??null,createdAt:row.created_at}:null
export async function onRequest(context){
 const {request,env}=context,db=env.VISITORS_DB,url=new URL(request.url)
 if(!['GET','POST'].includes(request.method))return json({error:'method_not_allowed'},405)
 if(request.method==='POST'&&!trustedMutation(request))return json({error:'cross_site_request_rejected'},403)
 const account=await trustedAccount(context);if(!canEditLibrary(account))return json({error:'editor_required'},403)
 const editingEnabled=env.BOK_TEXT_EDITING_ENABLED==='1',submissionEnabled=editingEnabled&&env.BOK_PUBLICATION_JOBS_ENABLED==='1'
 if(request.method==='GET'){
  if(!url.search)return json({editingEnabled,submissionEnabled,automaticPublication:false})
  if(!submissionEnabled)return json({error:'bok_publication_not_enabled'},503)
  const id=url.searchParams.get('id'),bookId=url.searchParams.get('bookId')
  if([...url.searchParams.keys()].some(k=>!['id','bookId'].includes(k))||Boolean(id)===Boolean(bookId)||id&&!jobId(id)||bookId&&!validDraftKey(bookId,'a'.repeat(64),0))return json({error:'invalid_job'},400)
  const row=id?await db.prepare('SELECT * FROM bok_publication_jobs WHERE id=?1 AND owner_subject=?2').bind(id,account.subject).first():await db.prepare('SELECT * FROM bok_publication_jobs WHERE book_id=?1 AND owner_subject=?2 ORDER BY created_at DESC,id DESC LIMIT 1').bind(bookId,account.subject).first()
  return json({job:publicJob(row)})
 }
 if(!submissionEnabled)return json({error:'bok_publication_not_enabled'},503)
 const body=await boundedDraftBody(request)
 if(!body||Object.keys(body).some(k=>!['id','bookId','sourceHash','reviews'].includes(k))||!jobId(body.id)||!validDraftKey(body.bookId,body.sourceHash,0)||!Array.isArray(body.reviews)||body.reviews.length<1||body.reviews.length>128)return json({error:'invalid_review'},400)
 const seen=new Set()
 for(const r of body.reviews){if(!r||Object.keys(r).some(k=>!['pageId','revision','baseHash','text'].includes(k))||!validDraftKey(body.bookId,body.sourceHash,r.pageId)||seen.has(r.pageId)||!hash(r.baseHash)||!Number.isSafeInteger(r.revision)||r.revision<1||typeof r.text!=='string'||r.text.length>100000||r.text.includes('\0'))return json({error:'invalid_review'},400);seen.add(r.pageId)}
 const reviews=JSON.stringify([...body.reviews].sort((a,b)=>a.pageId-b.pageId));if(new TextEncoder().encode(reviews).length>524288)return json({error:'review_too_large'},413)
 const requestHash=await accessHash(JSON.stringify([body.bookId,body.sourceHash,JSON.parse(reviews)]))
 const native=cookieValue(request,'__Host-khizana-session'),access=cookieValue(request,'__Host-khizana-access-session'),device=cookieValue(request,'__Host-khizana-device'),isNative=hash(native),token=isNative?native:access
 if(!hash(token)||!hash(device))return json({error:'session_required'},403)
 const table=isNative?'account_sessions':'account_access_sessions'
 const editorial=isNative?"a.role<>'admin' AND EXISTS(SELECT 1 FROM account_capabilities c WHERE c.subject=a.subject AND c.editorial=1)":"(a.role='super-admin' OR (a.role='user' AND EXISTS(SELECT 1 FROM account_capabilities c WHERE c.subject=a.subject AND c.editorial=1)))"
 const result=await db.prepare(`INSERT INTO bok_publication_jobs(id,owner_subject,book_id,source_hash,request_sha256,reviews_json)
 SELECT ?1,a.subject,?2,?3,?4,?5 FROM ${table} s JOIN accounts a ON a.subject=s.subject JOIN account_devices d ON d.owner_subject=a.subject AND d.device_id=s.device_id
 WHERE s.token_hash=?6 AND s.device_id=?7 AND s.expires_at>unixepoch() AND a.subject=?8 AND d.revoked_at IS NULL AND ${editorial}
 AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE b.subject=a.subject AND b.blocked=1)
 AND NOT EXISTS(SELECT 1 FROM json_each(?5) j WHERE NOT EXISTS(SELECT 1 FROM bok_text_drafts t WHERE t.book_id=?2 AND t.source_hash=?3 AND t.page_id=json_extract(j.value,'$.pageId') AND t.revision=json_extract(j.value,'$.revision') AND t.base_hash=json_extract(j.value,'$.baseHash') AND t.text=json_extract(j.value,'$.text')))
 ON CONFLICT(id) DO NOTHING`).bind(body.id,body.bookId,body.sourceHash,requestHash,reviews,await accessHash(token),await accessHash(device),account.subject).run()
 const row=await db.prepare('SELECT * FROM bok_publication_jobs WHERE id=?1 AND owner_subject=?2').bind(body.id,account.subject).first()
 if(!row||row.request_sha256!==requestHash)return json({error:'bok_review_changed'},409)
 return json({job:publicJob(row),published:false,idempotent:Number(result.meta?.changes)!==1},Number(result.meta?.changes)?202:200)
}
