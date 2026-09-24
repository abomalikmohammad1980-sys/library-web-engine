import {json,isManager,trustedAccount} from '../../../_account-contract.js'
import {publicBookExtras,missingIntakeSchema,isCentrallyHidden} from '../../../_book-intake.js'
import {publicBook} from '../../../library/published-books.js'

export async function onRequest(context){
 if(context.request.method!=='GET')return json({error:'method_not_allowed'},405,{allow:'GET'})
 const id=context.params.bookId
 if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,200}$/.test(id)||new URL(context.request.url).search)return json({error:'invalid_book_id'},400)
 try{
  const account=await trustedAccount(context)
  if(!account)return json({error:'book_not_found'},404)
  const db=context.env.VISITORS_DB
  const row=await db.prepare('SELECT id,title,author,category,mime_type AS mimeType,byte_length AS byteLength,created_at AS createdAt,object_key AS objectKey,review_version AS publicationVersion,owner_subject,visibility,review_status FROM user_books WHERE id=?1 AND deleted_at IS NULL').bind(id).first()
  if(!row||(row.owner_subject!==account.subject&&!isManager(account)))return json({error:'book_not_found'},404)
  if(row.visibility==='public'&&row.review_status==='approved'&&await isCentrallyHidden(db,id))return json({error:'book_not_found'},404)
  let extras={};try{extras=await publicBookExtras(db,id,row.mimeType)}catch(error){if(!missingIntakeSchema(error))throw error}
  return json({schemaVersion:1,book:{...publicBook(row),...extras}},200,{'cache-control':'private, no-store','cross-origin-resource-policy':'same-origin'})
 }catch{return json({error:'account_service_unavailable'},503)}
}
