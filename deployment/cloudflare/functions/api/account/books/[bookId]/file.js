import {isManager,json,safeFileName,trustedAccount} from '../../../_account-contract.js'
import {isCentrallyHidden} from '../../../_book-intake.js'

const TYPES=new Map([
  ['.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],['.doc','application/msword'],['.rtf','application/rtf'],['.pdf','application/pdf'],
  ['.epub','application/epub+zip'],['.bok','application/octet-stream'],['.txt','text/plain; charset=utf-8'],['.md','text/markdown; charset=utf-8'],
])
const INLINE=new Set(['.pdf','.txt','.md'])
function delivery(objectKey){let raw=String(objectKey??'').split('/').at(-1)??'book.bin';try{raw=decodeURIComponent(raw)}catch{}const name=safeFileName(raw),extension=/\.[^.]+$/u.exec(name.toLocaleLowerCase('en'))?.[0]??'',mime=TYPES.get(extension)??'application/octet-stream',mode=INLINE.has(extension)?'inline':'attachment',fallback=`book${TYPES.has(extension)?extension:'.bin'}`;return{mime,disposition:`${mode}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`}}

export async function onRequestGet(context){
  const params=new URL(context.request.url).searchParams,assetId=params.get('asset'),wordMap=params.get('wordMap'),htmlResourceId=params.get('htmlResource')
  const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
  if([...params.keys()].some(k=>!['asset','wordMap','htmlResource'].includes(k)||params.getAll(k).length!==1)||params.size>1||wordMap!==null&&wordMap!=='1'||assetId!==null&&!uuid.test(assetId)||htmlResourceId!==null&&!uuid.test(htmlResourceId))return json({error:'invalid_book_asset'},400)
  const account=await trustedAccount(context)
  const sourceQuery='SELECT owner_subject,object_key,mime_type,visibility,review_status,review_version FROM user_books WHERE id=?1 AND deleted_at IS NULL'
  const row=await context.env.VISITORS_DB.prepare(sourceQuery).bind(context.params.bookId).first(),isPublic=row?.visibility==='public'&&row?.review_status==='approved'
  if(!row||!isPublic&&(!account||row.owner_subject!==account.subject&&!isManager(account)))return json({error:'book_not_found'},404)
  if(isPublic&&await isCentrallyHidden(context.env.VISITORS_DB,context.params.bookId))return json({error:'book_not_found'},404)
  let key=row.object_key,asset,htmlResource
  if(wordMap){asset=await context.env.VISITORS_DB.prepare('SELECT object_key FROM user_book_word_bundles WHERE book_id=?1').bind(context.params.bookId).first();if(!asset)return json({error:'book_not_found'},404);key=asset.object_key}
  if(assetId){asset=await context.env.VISITORS_DB.prepare('SELECT object_key,mime_type,kind FROM user_book_assets WHERE asset_id=?1 AND book_id=?2').bind(assetId,context.params.bookId).first();if(!asset)return json({error:'book_not_found'},404);key=asset.object_key}
  if(htmlResourceId){if(!row.mime_type.startsWith('text/html'))return json({error:'book_not_found'},404);htmlResource=await context.env.VISITORS_DB.prepare('SELECT object_key,mime_type FROM user_book_html_resources WHERE resource_id=?1 AND book_id=?2').bind(htmlResourceId,context.params.bookId).first();if(!htmlResource)return json({error:'book_not_found'},404);key=htmlResource.object_key}
  const object=await context.env.LIBRARY_R2.get(key);if(!object)return json({error:'book_object_missing'},404)
  const current=await context.env.VISITORS_DB.prepare(sourceQuery).bind(context.params.bookId).first()
  if(!current||['owner_subject','object_key','visibility','review_status','review_version'].some(field=>current[field]!==row[field])||(isPublic&&await isCentrallyHidden(context.env.VISITORS_DB,context.params.bookId))){
    await object.body?.cancel?.().catch(()=>{})
    return json({error:'book_not_found'},404)
  }
  let {mime,disposition}=delivery(key)
  if(wordMap){mime='application/json';disposition='attachment; filename="pages.json"'}
  if(asset?.kind==='cover'&&['image/jpeg','image/png','image/webp'].includes(asset.mime_type)){mime=asset.mime_type;disposition='inline'}
  if(htmlResource){mime=htmlResource.mime_type;disposition='attachment'}
  return new Response(object.body,{headers:{'content-type':mime,'cache-control':'private, no-store','content-disposition':disposition,'content-security-policy':'sandbox','cross-origin-resource-policy':'same-origin','x-content-type-options':'nosniff'}})
}
