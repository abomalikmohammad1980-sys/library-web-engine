import {json,trustedAccount,trustedMutation} from '../../_account-contract.js'
import {missingIntakeSchema} from '../../_book-intake.js'
import {missingWordBundleSchema} from '../../_word-bundle.js'
import {boundedQuoteJson} from '../../_public-quotes.js'

const clean=value=>String(value??'').trim()

export async function onRequestDelete(context){
  if(!trustedMutation(context.request))return json({error:'cross_site_request_rejected'},403)
  const account=await trustedAccount(context);if(!account)return json({error:'authentication_required'},401)
  const bookId=clean(context.params.bookId);if(!bookId||bookId.length>200)return json({error:'invalid_book_id'},400)
  const row=await context.env.VISITORS_DB.prepare('SELECT id,owner_subject,object_key,byte_length,visibility,review_status,deleted_at,deletion_object_removed_at,quota_released_at FROM user_books WHERE id=?1 AND owner_subject=?2').bind(bookId,account.subject).first()
  if(!row)return json({error:'book_not_found'},404)
  if(!row.deleted_at&&row.visibility==='public'&&row.review_status==='approved')return json({error:'published_book_must_be_withdrawn'},409)
  if(!row.deleted_at){
    // Approval can race the initial read. Acquire the deletion tombstone only
    // while the original remains non-public; never delete R2 after losing CAS.
    const marked=await context.env.VISITORS_DB.prepare("UPDATE user_books SET deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND owner_subject=?2 AND deleted_at IS NULL AND NOT(visibility='public' AND review_status='approved')").bind(bookId,account.subject).run()
    if(Number(marked?.meta?.changes)!==1)return json({error:'published_book_must_be_withdrawn'},409)
  }
  let keys=[row.object_key],storageBytes=Number(row.byte_length)||0
  try{const metadata=await context.env.VISITORS_DB.prepare('SELECT storage_bytes FROM user_book_metadata WHERE book_id=?1').bind(bookId).first();if(metadata){storageBytes=metadata.storage_bytes;const assets=await context.env.VISITORS_DB.prepare('SELECT object_key FROM user_book_assets WHERE book_id=?1').bind(bookId).all();keys.push(...(assets.results??[]).map(a=>a.object_key))}}catch(error){if(!missingIntakeSchema(error))throw error}
  try{const map=await context.env.VISITORS_DB.prepare('SELECT object_key FROM user_book_word_bundles WHERE book_id=?1').bind(bookId).first();if(map)keys.push(map.object_key)}catch(error){if(!missingWordBundleSchema(error))throw error}
  if(!row.deletion_object_removed_at)try{for(const key of keys)await context.env.LIBRARY_R2.delete(key)}catch{return json({error:'account_book_deletion_pending'},503)}
  const markObject=context.env.VISITORS_DB.prepare('UPDATE user_books SET deletion_object_removed_at=COALESCE(deletion_object_removed_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND owner_subject=?2').bind(bookId,account.subject)
  const releaseQuota=context.env.VISITORS_DB.prepare('UPDATE account_storage_usage SET used_bytes=MAX(0,used_bytes-?1),book_count=MAX(0,book_count-1),updated_at=CURRENT_TIMESTAMP WHERE subject=?2 AND EXISTS(SELECT 1 FROM user_books WHERE id=?3 AND owner_subject=?2 AND quota_released_at IS NULL)').bind(storageBytes,account.subject,bookId)
  const markReleased=context.env.VISITORS_DB.prepare('UPDATE user_books SET quota_released_at=COALESCE(quota_released_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND owner_subject=?2').bind(bookId,account.subject)
  await context.env.VISITORS_DB.batch([markObject,releaseQuota,markReleased])
  return json({id:bookId,deleted:true})
}
export async function onRequestPatch(context){
  if(!trustedMutation(context.request))return json({error:'cross_site_request_rejected'},403)
  const account=await trustedAccount(context);if(!account)return json({error:'authentication_required'},401)
  const id=clean(context.params.bookId);if(!id||id.length>200)return json({error:'invalid_book_id'},400)
  let body
  try{body=await boundedQuoteJson(context.request.body,8192)}catch{return json({error:'invalid_book_metadata'},400)}
  const valid=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[<>\u0000-\u001f\u007f]/.test(v)
  if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['title','author','category','reviewVersion'].includes(k))||!valid(body.title,300)||!valid(body.author,200)||!valid(body.category,200)||!Number.isSafeInteger(body.reviewVersion)||body.reviewVersion<0)return json({error:'invalid_book_metadata'},400)
  const db=context.env.VISITORS_DB
  const row=await db.prepare('SELECT author,visibility FROM user_books WHERE id=?1 AND owner_subject=?2 AND deleted_at IS NULL').bind(id,account.subject).first()
  if(!row)return json({error:'book_not_found'},404)
  if(row.visibility==='public')return json({error:'published_book_must_be_withdrawn'},409)
  const statements=[db.prepare("UPDATE user_books SET title=?1,author=?2,category=?3,review_version=review_version+1,review_status='pending',review_note='',reviewed_by=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?4 AND owner_subject=?5 AND deleted_at IS NULL AND visibility='private' AND review_version=?6").bind(body.title.trim(),body.author.trim(),body.category.trim(),id,account.subject,body.reviewVersion)]
  // Clear stale author links only after a successful compare-and-swap, in the same transaction.
  if(row.author!==body.author.trim())statements.push(db.prepare("UPDATE user_book_metadata SET central_author_id=NULL,metadata_json=json_remove(metadata_json,'$.authorId','$.centralAuthorId','$.authors','$.deathYearHijri','$.contemporary') WHERE book_id=?1 AND changes()=1").bind(id))
  const result=await db.batch(statements)
  if(Number(result[0]?.meta?.changes)!==1)return json({error:'account_review_conflict'},409)
  return json({id,title:body.title.trim(),author:body.author.trim(),category:body.category.trim(),reviewVersion:body.reviewVersion+1,reviewStatus:'pending'})
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'DELETE, PATCH'})
