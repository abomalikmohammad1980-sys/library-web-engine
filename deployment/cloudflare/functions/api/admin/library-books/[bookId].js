import {isSuperAdmin,canEditLibrary,json,trustedAccount,trustedMutation} from '../../_account-contract.js'
const clean=value=>String(value??'').trim()
export async function onRequestPatch(context){
  if(!trustedMutation(context.request))return json({error:'cross_site_request_rejected'},403)
  const account=await trustedAccount(context);if(!canEditLibrary(account))return json({error:'editor_required'},403)
  const bookId=clean(context.params.bookId),body=await context.request.json().catch(()=>null),action=body?.action
  if(!bookId||bookId.length>200||!['update','delete','restore'].includes(action))return json({error:'invalid_central_book_mutation'},400)
  const editor=!isSuperAdmin(account)
  if(editor&&(action!=='update'||body.visibility!==undefined&&body.visibility!=='public'||Object.keys(body).some(key=>!['action','expectedVersion','title','author','category','visibility','note'].includes(key))))return json({error:'editor_action_forbidden'},403)
  const expectedVersion=body?.expectedVersion,title=body?.title===undefined?null:clean(body.title),author=body?.author===undefined?null:clean(body.author),categoryProvided=Object.prototype.hasOwnProperty.call(body??{},'category'),category=categoryProvided?(body.category===null?null:clean(body.category)):null,requestedVisibility=clean(body?.visibility)||'public',note=clean(body?.note).slice(0,1000)||null
  if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0)return json({error:'invalid_central_book_version'},400)
  if((title!==null&&(!title||title.length>300))||(author!==null&&(!author||author.length>200))||(category!==null&&(!category||category.length>120))||!['public','unlisted','hidden'].includes(requestedVisibility))return json({error:'invalid_central_book_metadata'},400)
  const visibility=action==='delete'?'hidden':requestedVisibility,deletedAt=action==='delete'?new Date().toISOString():null
  const existing=await context.env.VISITORS_DB.prepare('SELECT revision,visibility,logically_deleted_at FROM central_book_overrides WHERE book_id=?1').bind(bookId).first(),currentVersion=Number(existing?.revision??0)
  if(editor&&existing&&(existing.visibility!=='public'||existing.logically_deleted_at))return json({error:'editor_action_forbidden'},403)
  // A repeated delete is already satisfied; do not invent a conflict or audit it twice.
  const deletedReply=row=>action==='delete'&&row?.visibility==='hidden'&&row.logically_deleted_at&&Number(row.revision)>=expectedVersion?json({id:bookId,action,visibility:'hidden',logicallyDeleted:true,revision:Number(row.revision),unchanged:true}):null
  const alreadyDeleted=deletedReply(existing);if(alreadyDeleted)return alreadyDeleted
  if(currentVersion!==expectedVersion)return json({error:'central_book_conflict',revision:currentVersion},409)
  const nextVersion=currentVersion+1
  const upsert=context.env.VISITORS_DB.prepare("INSERT INTO central_book_overrides(book_id,title,author,category,visibility,logically_deleted_at,updated_by,revision) VALUES(?1,?2,?3,?4,?5,?6,?7,?8) ON CONFLICT(book_id) DO UPDATE SET title=COALESCE(excluded.title,central_book_overrides.title),author=COALESCE(excluded.author,central_book_overrides.author),category=CASE WHEN ?9=1 THEN excluded.category ELSE central_book_overrides.category END,visibility=excluded.visibility,logically_deleted_at=excluded.logically_deleted_at,updated_by=excluded.updated_by,revision=excluded.revision,updated_at=CURRENT_TIMESTAMP WHERE central_book_overrides.revision=?10 AND (?11=0 OR (central_book_overrides.visibility='public' AND central_book_overrides.logically_deleted_at IS NULL))").bind(bookId,title,author,category,visibility,deletedAt,account.subject,nextVersion,categoryProvided?1:0,currentVersion,editor?1:0)
  const audit=context.env.VISITORS_DB.prepare('INSERT OR IGNORE INTO central_book_audit_events(book_id,actor_subject,action,title,author,category,visibility,note,revision) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9 WHERE changes()=1').bind(bookId,account.subject,action,title,author,category,visibility,note,nextVersion)
  const [updated]=await context.env.VISITORS_DB.batch([upsert,audit]);if(Number(updated?.meta?.changes??0)!==1){const latest=await context.env.VISITORS_DB.prepare('SELECT revision,visibility,logically_deleted_at FROM central_book_overrides WHERE book_id=?1').bind(bookId).first();const confirmed=deletedReply(latest);if(confirmed)return confirmed;return json({error:'central_book_conflict',revision:Number(latest?.revision??currentVersion)},409)}
  return json({id:bookId,action,visibility,logicallyDeleted:action==='delete',revision:nextVersion})
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'PATCH'})
