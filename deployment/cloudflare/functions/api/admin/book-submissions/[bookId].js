import {isManager,json,trustedAccount,trustedMutation} from '../../_account-contract.js'

export async function onRequestPatch(context){
  if(!trustedMutation(context.request))return json({error:'cross_site_request_rejected'},403)
  const account=await trustedAccount(context);if(!isManager(account))return json({error:'admin_required'},403)
  const bookId=String(context.params.bookId??'').trim(),body=await context.request.json().catch(()=>null),decision=body?.decision,expectedVersion=body?.reviewVersion,noteText=String(body?.note??'').trim()
  if(!bookId||bookId.length>200)return json({error:'invalid_book_id'},400)
  if(!['publish','private','reject'].includes(decision))return json({error:'invalid_review_decision'},400)
  if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0)return json({error:'invalid_review_version'},400)
  if(noteText.length>1000)return json({error:'invalid_review_note'},400)
  const metadata=body?.metadata
  if(metadata!==undefined&&(!metadata||typeof metadata!=='object'||Array.isArray(metadata)||Object.keys(metadata).some(key=>!['title','author','category'].includes(key))||['title','author','category'].some(key=>typeof metadata[key]!=='string'||metadata[key].trim().length>(key==='title'?300:200))||!metadata.title.trim()||!metadata.author.trim()))return json({error:'invalid_book_metadata'},400)
  const book=await context.env.VISITORS_DB.prepare('SELECT id,review_status,visibility,review_note,review_version,title,author,category FROM user_books WHERE id=?1 AND deleted_at IS NULL').bind(bookId).first()
  if(!book)return json({error:'book_not_found'},404)
  const status=decision==='reject'?'rejected':'approved',visibility=decision==='publish'?'public':'private',note=noteText||null,currentVersion=Number(book.review_version??0)
  if(expectedVersion!==currentVersion)return json({error:'review_conflict',reviewVersion:currentVersion},409)
  const title=metadata?metadata.title.trim():book.title,author=metadata?metadata.author.trim():book.author,category=metadata?(metadata.category.trim()||null):book.category
  if(book.review_status===status&&book.visibility===visibility&&(book.review_note??null)===note&&book.title===title&&book.author===author&&(book.category??null)===(category??null))return json({id:bookId,reviewStatus:status,visibility,reviewVersion:currentVersion,unchanged:true})
  const nextVersion=currentVersion+1
  const update=context.env.VISITORS_DB.prepare('UPDATE user_books SET review_status=?1,visibility=?2,review_note=?3,reviewed_by=?4,review_version=?5,title=?8,author=?9,category=?10,updated_at=CURRENT_TIMESTAMP WHERE id=?6 AND review_version=?7 AND deleted_at IS NULL').bind(status,visibility,note,account.subject,nextVersion,bookId,currentVersion,title,author,category??null)
  const audit=context.env.VISITORS_DB.prepare('INSERT OR IGNORE INTO book_review_events(book_id,reviewer_subject,decision,note,review_version) SELECT ?1,?2,?3,?4,?5 FROM user_books WHERE id=?1 AND review_version=?5 AND reviewed_by=?2 AND review_status=?6 AND visibility=?7').bind(bookId,account.subject,decision,note,nextVersion,status,visibility)
  const statements=[update]
  if(metadata&&book.author!==author)statements.push(context.env.VISITORS_DB.prepare("UPDATE user_book_metadata SET central_author_id=NULL,metadata_json=json_remove(metadata_json,'$.authorId','$.centralAuthorId','$.authors','$.deathYearHijri','$.contemporary') WHERE book_id=?1 AND changes()=1").bind(bookId))
  statements.push(audit)
  const [updated]=await context.env.VISITORS_DB.batch(statements);if(Number(updated?.meta?.changes??0)!==1)return json({error:'review_conflict'},409)
  return json({id:bookId,reviewStatus:status,visibility,reviewVersion:nextVersion})
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'PATCH'})
