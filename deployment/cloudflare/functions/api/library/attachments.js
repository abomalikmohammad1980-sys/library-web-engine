import {json,trustedAccount,trustedMutation,isManager,safeFileName} from '../_account-contract.js'
import {assetDigest} from '../_book-intake.js'
import {boundedForm,reserveQuota,releaseQuota} from '../account/books.js'
const MAX_BYTES=50*1024*1024
const validId=id=>typeof id==='string'&&/^att-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)
const validAuthor=key=>key===''||/^(?:shamela-author-\d{1,6}|shamela:\d{1,6}|central-author:[a-f0-9-]{36}|local:[A-Za-z0-9_-]{1,150})$/.test(key)
const plain=(value,max)=>typeof value==='string'&&value.length<=max&&!/[<>\u0000-\u001f\u007f]/.test(value)
const fields='id,title,description,category,author_key AS authorKey,file_name AS fileName,format,byte_length AS byteLength,sha256,state,revision'
async function smallJson(request){
 if(Number(request.headers.get('content-length'))>4096||!request.body)return null
 const reader=request.body.getReader(),chunks=[];let size=0
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096)return null;chunks.push(value)}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{return null}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
}
export async function archiveFormat(file){
 if(!(file instanceof File)||file.size<1||file.size>MAX_BYTES)return null
 const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer()),starts=s=>s.every((b,i)=>bytes[i]===b)
 if(/\.zip$/i.test(file.name)&&(starts([80,75,3,4])||starts([80,75,5,6])||starts([80,75,7,8])))return 'zip'
 if(/\.rar$/i.test(file.name)&&(starts([82,97,114,33,26,7,0])||starts([82,97,114,33,26,7,1,0])))return 'rar'
 return null
}
async function list(context){
 const p=new URL(context.request.url).searchParams
 if([...p.keys()].some(k=>!['category','author','mine','review','after'].includes(k)||p.getAll(k).length!==1))return json({error:'invalid_attachment_query'},400)
 const category=p.get('category')??'',author=p.get('author')??'',after=p.get('after')??'',mine=p.get('mine'),review=p.get('review')
 if(!plain(category,120)||!validAuthor(author)||after&&!validId(after)||mine!==null&&mine!=='1'||review!==null&&review!=='pending'||mine&&review||!category&&!author&&!mine&&!review)return json({error:'invalid_attachment_query'},400)
 let subject
 if(mine||review){const account=await trustedAccount(context);if(!account)return json({error:'authentication_required'},401);if(review&&!isManager(account))return json({error:'manager_required'},403);subject=account.subject}
 const where=[mine?'owner_subject=?1':"state='"+(review?'pending':'public')+"'"]
 const args=mine?[subject]:[]
 const add=(sql,value)=>{args.push(value);where.push(sql+'?'+args.length)}
 if(category)add('category=',category);if(author)add('author_key=',author);if(after)add('id>',after)
 const result=await context.env.VISITORS_DB.prepare(`SELECT ${fields} FROM download_attachments WHERE ${where.join(' AND ')} ORDER BY id LIMIT 51`).bind(...args).all()
 const rows=result.results??[],items=rows.slice(0,50)
 return json({attachments:items,next:rows.length>50?items.at(-1).id:null},200,{'cache-control':'no-store'})
}
async function submit(context){
 if(!trustedMutation(context.request))return json({error:'cross_site_request_rejected'},403)
 const account=await trustedAccount(context);if(!account)return json({error:'authentication_required'},401)
 let form;try{form=await boundedForm(context.request)}catch{return json({error:'attachment_upload_invalid'},400)}
 if([...form.keys()].some(k=>!['file','title','description','category','authorKey','uploadId'].includes(k)||form.getAll(k).length!==1))return json({error:'attachment_metadata_invalid'},400)
 const file=form.get('file'),title=String(form.get('title')??'').trim(),description=String(form.get('description')??'').trim(),category=String(form.get('category')??'').trim(),authorKey=String(form.get('authorKey')??'').trim(),id=String(form.get('uploadId')??'')
 if(!validId(id)||!title||!plain(title,300)||!plain(description,5000)||!plain(category,120)||!validAuthor(authorKey)||!category&&!authorKey)return json({error:'attachment_metadata_invalid'},400)
 const format=await archiveFormat(file);if(!format)return json({error:'attachment_type_invalid'},415)
 const digest=await assetDigest(file),db=context.env.VISITORS_DB
 const existing=await db.prepare('SELECT owner_subject,sha256,title,description,category,author_key FROM download_attachments WHERE id=?1').bind(id).first()
 if(existing)return existing.owner_subject===account.subject&&existing.sha256===digest&&existing.title===title&&existing.description===description&&existing.category===category&&existing.author_key===authorKey?json({id},200):json({error:'attachment_conflict'},409)
 if(!await reserveQuota(context.env,account.subject,file.size))return json({error:'account_storage_quota_exceeded'},409)
 const name=safeFileName(file.name.replace(/\.(zip|rar)$/i,'')).slice(0,115)+'.'+format,key=`private/${account.subject}/attachments/${id}/${crypto.randomUUID()}/${name}`
 let committed=false,commitAttempted=false,cleanupSafe=true
 try{
  await context.env.LIBRARY_R2.put(key,file.stream(),{httpMetadata:{contentType:format==='zip'?'application/zip':'application/vnd.rar'}})
  const current=await trustedAccount(context)
  if(!current||current.subject!==account.subject)throw Error('attachment_session_changed')
  commitAttempted=true;cleanupSafe=false
  const [insert]=await db.batch([
   db.prepare("INSERT INTO download_attachments(id,owner_subject,title,description,category,author_key,file_name,format,object_key,byte_length,sha256) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11 WHERE NOT EXISTS(SELECT 1 FROM account_blocks WHERE subject=?2 AND blocked=1) ON CONFLICT(id) DO NOTHING").bind(id,account.subject,title,description,category,authorKey,name,format,key,file.size,digest),
   db.prepare("INSERT INTO download_attachment_events(attachment_id,actor_subject,decision,revision) SELECT ?1,?2,'submit',0 WHERE changes()=1").bind(id,account.subject),
  ])
  committed=Number(insert?.meta?.changes)===1
  cleanupSafe=!committed
  return committed?json({id,state:'pending',revision:0},201):json({error:'attachment_conflict'},409)
 }catch(error){
  // A failed response does not establish that the atomic transaction rolled back.
  // Only an authoritative read can authorize deleting this attempt's object.
  if(commitAttempted){
   try{
    const stored=await db.prepare('SELECT object_key FROM download_attachments WHERE id=?1').bind(id).first()
    committed=stored?.object_key===key
    cleanupSafe=!committed
   }catch{
    // Retain both bytes and quota when commit status is unknown. Never guess.
    console.error(JSON.stringify({event:'attachment_commit_reconciliation_required',attachmentId:id}))
    return json({error:'attachment_status_uncertain',id},503)
   }
   if(committed)return json({id,state:'pending',revision:0},201)
  }
  throw error
 }finally{
  if(!committed&&cleanupSafe){await context.env.LIBRARY_R2.delete(key);await releaseQuota(context.env,account.subject,file.size)}
 }
}
async function review(context){
 if(!trustedMutation(context.request))return json({error:'cross_site_request_rejected'},403)
 const account=await trustedAccount(context);if(!account)return json({error:'authentication_required'},401)
 const body=await smallJson(context.request)
 if(!body||Object.keys(body).some(k=>!['id','state','revision'].includes(k))||!validId(body.id)||!['public','withdrawn'].includes(body.state)||!Number.isSafeInteger(body.revision)||body.revision<0)return json({error:'attachment_metadata_invalid'},400)
 if(body.state==='public'&&!isManager(account))return json({error:'manager_required'},403)
 const db=context.env.VISITORS_DB,ownerClause=isManager(account)?" AND EXISTS(SELECT 1 FROM accounts WHERE subject=?4 AND role IN ('admin','super-admin'))":' AND owner_subject=?4'
 const [update]=await db.batch([
  db.prepare(`UPDATE download_attachments SET state=?1,revision=revision+1 WHERE id=?2 AND revision=?3${ownerClause} AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE subject=?4 AND blocked=1)`).bind(body.state,body.id,body.revision,account.subject),
  db.prepare('INSERT INTO download_attachment_events(attachment_id,actor_subject,decision,revision) SELECT ?1,?2,?3,?4 WHERE changes()=1').bind(body.id,account.subject,body.state,body.revision+1),
 ])
 return Number(update?.meta?.changes)===1?json({id:body.id,state:body.state,revision:body.revision+1}):json({error:'attachment_conflict'},409)
}
export async function onRequest(context){
 try{
  if(context.request.method==='GET')return await list(context)
  if(context.request.method==='POST')return await submit(context)
  if(context.request.method==='PATCH')return await review(context)
  return json({error:'method_not_allowed'},405,{allow:'GET, POST, PATCH'})
 }catch{return json({error:'attachments_unavailable'},503)}
}
