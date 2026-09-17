import {json,safeFileName,trustedAccount,trustedMutation,canEditLibrary} from '../_account-contract.js'
import {intakeExtras,assetDigest} from '../_book-intake.js'
import {bookListRow} from '../_book-list-contract.js'
import {safeWordUpload} from '../_word-upload-safety.js'
const MAX_BYTES=64*1024*1024
async function boundedForm(request){
 const limit=MAX_BYTES+1024*1024,declared=Number(request.headers.get('content-length'))
 if(declared>limit)throw Error('upload_limit')
 if(!request.body)throw Error('invalid_form')
 const reader=request.body.getReader();let size=0
 const body=new ReadableStream({async pull(controller){try{const {done,value}=await reader.read();if(done){controller.close();return}size+=value.byteLength;if(size>limit){await reader.cancel();controller.error(Error('upload_limit'));return}controller.enqueue(value)}catch(error){controller.error(error)}},cancel(reason){return reader.cancel(reason)}})
 return new Response(body,{headers:{'content-type':request.headers.get('content-type')??''}}).formData()
}
const DEFAULT_ACCOUNT_BYTES=500*1024*1024,DEFAULT_ACCOUNT_BOOKS=10_000
const BOOK_TYPES=new Map([
  ['.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],['.doc','application/msword'],['.rtf','application/rtf'],['.pdf','application/pdf'],
  ['.epub','application/epub+zip'],['.bok','application/octet-stream'],['.txt','text/plain; charset=utf-8'],['.md','text/markdown; charset=utf-8'],
])
const extensionOf=name=>/\.[^.]+$/u.exec(String(name).toLocaleLowerCase('en'))?.[0]??''
const startsWith=(bytes,signature)=>signature.every((value,index)=>bytes[index]===value)
async function validatedBookType(file){const extension=extensionOf(file.name),mime=BOOK_TYPES.get(extension);if(!mime)return null;const bytes=new Uint8Array(await file.slice(0,512).arrayBuffer())
  if(extension==='.pdf'&&!startsWith(bytes,[0x25,0x50,0x44,0x46,0x2d]))return null
  if((extension==='.docx'||extension==='.epub')&&!startsWith(bytes,[0x50,0x4b,0x03,0x04]))return null
  if(extension==='.doc'&&!startsWith(bytes,[0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]))return null
  if(extension==='.rtf'&&new TextDecoder().decode(bytes.slice(0,5)).toLowerCase()!=='{\\rtf')return null
  if((extension==='.txt'||extension==='.md')&&bytes.includes(0))return null
  if(!await safeWordUpload(file))return null
  return mime
}
const positiveLimit=(value,fallback)=>{const parsed=Number(value);return Number.isSafeInteger(parsed)&&parsed>0?parsed:fallback}
// Hash bounded chunks: a maximum-size upload must not allocate a second 64 MiB buffer.
async function sourceId(subject,file){const hashes=[];for(let offset=0;offset<file.size;offset+=1024*1024){const digest=await crypto.subtle.digest('SHA-256',await file.slice(offset,offset+1024*1024).arrayBuffer());hashes.push(Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join(''))}const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([subject,extensionOf(file.name),file.size,hashes])));return 'src-'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')}
async function existingSource(env,subject,id,includeVersion=false){return env.VISITORS_DB.prepare(`SELECT id,visibility,review_status AS reviewStatus,deleted_at AS deletedAt${includeVersion?',review_version AS reviewVersion,title,author,category':''} FROM user_books WHERE owner_subject=?1 AND id=?2`).bind(subject,id).first()}
function sourceResponse(book){return book.deletedAt?json({error:'account_book_previously_deleted'},409):json({id:book.id,visibility:book.visibility,reviewStatus:book.reviewStatus})}
async function reserveQuota(env,subject,bytes){const maxBytes=positiveLimit(env.ACCOUNT_MAX_STORAGE_BYTES,DEFAULT_ACCOUNT_BYTES),maxBooks=positiveLimit(env.ACCOUNT_MAX_BOOKS,DEFAULT_ACCOUNT_BOOKS),create=env.VISITORS_DB.prepare('INSERT OR IGNORE INTO account_storage_usage(subject) VALUES(?1)').bind(subject),reserve=env.VISITORS_DB.prepare('UPDATE account_storage_usage SET used_bytes=used_bytes+?1,book_count=book_count+1,updated_at=CURRENT_TIMESTAMP WHERE subject=?2 AND used_bytes+?1<=?3 AND book_count<?4').bind(bytes,subject,maxBytes,maxBooks),results=await env.VISITORS_DB.batch([create,reserve]);return Number(results[1]?.meta?.changes??0)===1}
async function releaseQuota(env,subject,bytes){await env.VISITORS_DB.prepare('UPDATE account_storage_usage SET used_bytes=MAX(0,used_bytes-?1),book_count=MAX(0,book_count-1),updated_at=CURRENT_TIMESTAMP WHERE subject=?2').bind(bytes,subject).run()}
async function cleanupAttempt(env,subject,bytes,keys){
 let pending=[...keys]
 for(let attempt=0;attempt<2&&pending.length;attempt++){const failed=[];for(const key of pending)try{await env.LIBRARY_R2.delete(key)}catch{failed.push(key)}pending=failed}
 let quotaFailed=false;try{await releaseQuota(env,subject,bytes)}catch{quotaFailed=true}
 if(pending.length||quotaFailed){console.error('account_book_cleanup_pending',JSON.stringify({objectKeys:pending,quotaFailed,subject,bytes}));return false}
 return true
}
export async function onRequestGet(context){const account=await trustedAccount(context);if(!account)return json({error:'authentication_required'},401);const url=new URL(context.request.url),page=Number(url.searchParams.get('page')??0),limit=Number(url.searchParams.get('limit')??50);if(!Number.isSafeInteger(page)||page<0||page>10_000||!Number.isSafeInteger(limit)||limit<1||limit>100)return json({error:'invalid_books_page'},400);const result=await context.env.VISITORS_DB.prepare('SELECT id,title,author,category,mime_type AS mimeType,byte_length AS byteLength,visibility,review_status AS reviewStatus,review_note AS reviewNote,created_at AS createdAt FROM user_books WHERE owner_subject=?1 AND deleted_at IS NULL ORDER BY created_at DESC,id DESC LIMIT ?2 OFFSET ?3').bind(account.subject,limit+1,page*limit).all(),rows=result.results??[],hasMore=rows.length>limit;return json({books:rows.slice(0,limit).map(bookListRow),page,hasMore})}
export async function onRequestPost(context){
  return createBookSubmission(context)
}
export async function createBookSubmission(context,{publishNew=false}={}){
  if(!trustedMutation(context.request))return json({error:'cross_site_request_rejected'},403)
  const account=await trustedAccount(context);if(!account)return json({error:'authentication_required'},401)
  if(publishNew&&!canEditLibrary(account))return json({error:'editor_required'},403)
  let form;try{form=await boundedForm(context.request)}catch(error){return error?.message==='upload_limit'?json({error:'account_book_too_large'},413):json({error:'invalid_book_submission'},400)}
  const file=form.get('file'),title=String(form.get('title')??'').trim(),author=String(form.get('author')??'').trim(),category=String(form.get('category')??'').trim()
  if(!(file instanceof File)||!title||title.length>300||!author||author.length>200||category.length>120||file.size<1)return json({error:'invalid_book_submission'},400)
  if(file.size>MAX_BYTES)return json({error:'account_book_too_large'},413)
  const mime=await validatedBookType(file);if(!mime)return json({error:'invalid_book_type'},415)
  let extras={metadata:null,assets:[]}
  if(publishNew||[...form.keys()].some(key=>!['file','title','author','category'].includes(key))){try{extras=await intakeExtras(form,validatedBookType)}catch(error){return json({error:error.message==='invalid_book_type'?'invalid_book_type':error.message==='invalid_word_bundle'?'invalid_word_bundle':'invalid_book_metadata'},400)}}
  const totalBytes=file.size+extras.assets.reduce((n,a)=>n+a.file.size,0)
  if(totalBytes>MAX_BYTES)return json({error:'account_book_too_large'},413)
  const authorId=extras.metadata?.centralAuthorId??null
  if(authorId){
   const centralAuthor=await context.env.VISITORS_DB.prepare('SELECT author_id,death_year_hijri FROM central_authors WHERE author_id=?1 AND hidden_at IS NULL').bind(authorId).first()
   if(!centralAuthor)return json({error:'central_author_not_found'},400)
   if(centralAuthor.death_year_hijri!==null&&centralAuthor.death_year_hijri!==undefined){extras.metadata.deathYearHijri=centralAuthor.death_year_hijri;extras.metadata.contemporary=false}
   else if(extras.metadata.contemporary&&extras.metadata.deathYearHijri!==undefined)return json({error:'invalid_book_metadata'},400)
  }
  const sourceKey=await sourceId(account.subject,file)
  const bundleDigest=extras.wordBundle?await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([sourceKey,extras.wordBundle]))):null
  const id=bundleDigest?'src-'+[...new Uint8Array(bundleDigest)].map(b=>b.toString(16).padStart(2,'0')).join(''):sourceKey,existing=await existingSource(context.env,account.subject,id,publishNew)
  const existingResponse=book=>publishNew&&!book.deletedAt?(book.visibility!=='public'||book.reviewStatus!=='approved'?json({error:'existing_book_requires_review'},409):book.title!==title||book.author!==author||(book.category??'')!==category?json({error:'existing_book_metadata_conflict'},409):json({id:book.id,visibility:book.visibility,reviewStatus:book.reviewStatus,reviewVersion:book.reviewVersion})):sourceResponse(book)
  if(existing?.id===id){
   if((extras.metadata||extras.assets.length)&&!existing.deletedAt){
    const saved=await context.env.VISITORS_DB.prepare('SELECT metadata_json FROM user_book_metadata WHERE book_id=?1').bind(id).first(),stored=await context.env.VISITORS_DB.prepare('SELECT kind,part_number,byte_length,sha256 FROM user_book_assets WHERE book_id=?1 ORDER BY kind,part_number').bind(id).all()
    const normalAssets=extras.assets.filter(a=>a.kind!=='word-map')
    if(saved?.metadata_json!==JSON.stringify(extras.metadata??{schemaVersion:1})||(stored.results??[]).length!==normalAssets.length)return json({error:'existing_book_metadata_conflict'},409)
    for(const asset of normalAssets){const hash=await assetDigest(asset.file);if(!(stored.results??[]).some(a=>a.kind===asset.kind&&a.part_number===asset.partNumber&&a.byte_length===asset.file.size&&a.sha256===hash))return json({error:'existing_book_metadata_conflict'},409)}
    if(extras.wordBundle){const storedMap=await context.env.VISITORS_DB.prepare('SELECT manifest_json FROM user_book_word_bundles WHERE book_id=?1').bind(id).first();if(storedMap?.manifest_json!==JSON.stringify(extras.wordBundle))return json({error:'existing_book_metadata_conflict'},409)}
   }
   return existingResponse(existing)
  }
  if(!await reserveQuota(context.env,account.subject,totalBytes))return json({error:'account_storage_quota_exceeded'},409)
  // Each concurrent attempt owns its temporary object; a loser must never delete the winner's file.
  const key=`private/${account.subject}/${id}/${crypto.randomUUID()}/${safeFileName(file.name)}`
  const uploaded=[]
  try{uploaded.push(key);await context.env.LIBRARY_R2.put(key,file.stream(),{httpMetadata:{contentType:mime},customMetadata:{owner:account.subject,bookId:id}})
   for(const asset of extras.assets){asset.id=crypto.randomUUID();asset.name=safeFileName(asset.file.name);asset.key=`private/${account.subject}/${id}/${asset.id}/${asset.name}`;asset.sha=await assetDigest(asset.file);uploaded.push(asset.key);await context.env.LIBRARY_R2.put(asset.key,asset.file.stream(),{httpMetadata:{contentType:asset.mime},customMetadata:{owner:account.subject,bookId:id}})}
  }catch(error){if(!await cleanupAttempt(context.env,account.subject,totalBytes,uploaded))return json({error:'account_book_cleanup_pending'},503);throw error}
  let inserted
  try{
    if(publishNew){
      const db=context.env.VISITORS_DB
      const create=db.prepare(`INSERT INTO user_books(id,owner_subject,title,author,category,object_key,mime_type,byte_length,visibility,review_status,reviewed_by,review_version) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,'public','approved',?2,1 WHERE EXISTS(SELECT 1 FROM accounts a WHERE a.subject=?2 AND (a.role='super-admin' OR (a.role='user' AND EXISTS(SELECT 1 FROM account_capabilities c WHERE c.subject=a.subject AND editorial=1)))) AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE subject=?2 AND blocked=1) ${authorId?"AND EXISTS(SELECT 1 FROM central_authors WHERE author_id=?9 AND hidden_at IS NULL)":""} ON CONFLICT(id) DO NOTHING`).bind(id,account.subject,title,author,category||null,key,mime,file.size,...(authorId?[authorId]:[]))
      const audit=db.prepare("INSERT INTO book_review_events(book_id,reviewer_subject,decision,note,review_version) SELECT ?1,?2,'publish','إنشاء كتاب مركزي',1 WHERE changes()=1").bind(id,account.subject)
      const statements=[create,audit]
      if(extras.metadata||extras.assets.length){
       statements.push(db.prepare('INSERT INTO user_book_metadata(book_id,metadata_json,central_author_id,storage_bytes) SELECT ?1,CASE WHEN ?3 IS NOT NULL AND (SELECT death_year_hijri FROM central_authors WHERE author_id=?3) IS NOT NULL THEN json_set(?2,\'$.deathYearHijri\',(SELECT death_year_hijri FROM central_authors WHERE author_id=?3),\'$.contemporary\',json(\'false\')) ELSE ?2 END,?3,?4 WHERE EXISTS(SELECT 1 FROM user_books WHERE id=?1 AND object_key=?5)').bind(id,JSON.stringify(extras.metadata??{schemaVersion:1}),authorId,totalBytes,key))
       for(const a of extras.assets)statements.push(assetStatement(db,id,a,key,extras.wordBundle))
      }
      ;[inserted]=await db.batch(statements)
    }else if(extras.metadata||extras.assets.length){
      const db=context.env.VISITORS_DB
      const create=db.prepare('INSERT INTO user_books(id,owner_subject,title,author,category,object_key,mime_type,byte_length) SELECT ?1,?2,?3,?4,?5,?6,?7,?8 WHERE EXISTS(SELECT 1 FROM accounts WHERE subject=?2) AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE subject=?2 AND blocked=1) ON CONFLICT(id) DO NOTHING').bind(id,account.subject,title,author,category||null,key,mime,file.size)
      const metadata=db.prepare('INSERT INTO user_book_metadata(book_id,metadata_json,central_author_id,storage_bytes) SELECT ?1,?2,?3,?4 WHERE EXISTS(SELECT 1 FROM user_books WHERE id=?1 AND object_key=?5)').bind(id,JSON.stringify(extras.metadata??{schemaVersion:1}),authorId,totalBytes,key)
      ;[inserted]=await db.batch([create,metadata,...extras.assets.map(a=>assetStatement(db,id,a,key,extras.wordBundle))])
    }else inserted=await context.env.VISITORS_DB.prepare('INSERT INTO user_books(id,owner_subject,title,author,category,object_key,mime_type,byte_length) VALUES(?1,?2,?3,?4,?5,?6,?7,?8) ON CONFLICT(id) DO NOTHING').bind(id,account.subject,title,author,category||null,key,mime,file.size).run()
  }
  catch(error){if(!await cleanupAttempt(context.env,account.subject,totalBytes,uploaded))return json({error:'account_book_cleanup_pending'},503);throw error}
  if(Number(inserted?.meta?.changes)===0){if(!await cleanupAttempt(context.env,account.subject,totalBytes,uploaded))return json({error:'account_book_cleanup_pending'},503);const winner=await existingSource(context.env,account.subject,id,publishNew);return winner?.id===id?((publishNew||extras.wordBundle)&&(extras.metadata||extras.assets.length)?json({error:'existing_book_metadata_conflict'},409):existingResponse(winner)):json({error:'account_book_retry_required'},503)}
  return afterPublicBookMutation(context,json(publishNew?{id,visibility:'public',reviewStatus:'approved',reviewVersion:1}:{id,visibility:'private',reviewStatus:'pending'},201))
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET, POST'})
function assetStatement(db,id,a,key,manifest){
 if(a.kind==='word-map')return db.prepare('INSERT INTO user_book_word_bundles(book_id,manifest_json,object_key,byte_length,sha256) SELECT ?1,?2,?3,?4,?5 WHERE EXISTS(SELECT 1 FROM user_books WHERE id=?1 AND object_key=?6)').bind(id,JSON.stringify(manifest),a.key,a.file.size,a.sha,key)
 return db.prepare('INSERT INTO user_book_assets(asset_id,book_id,kind,part_number,object_key,file_name,mime_type,byte_length,sha256) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9 WHERE EXISTS(SELECT 1 FROM user_books WHERE id=?2 AND object_key=?10)').bind(a.id,id,a.kind,a.partNumber,a.key,a.name,a.mime,a.file.size,a.sha,key)
}
import {afterPublicBookMutation} from '../_public-book-index-wake.js'
