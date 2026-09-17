import {json,trustedAccount,trustedMutation,canEditLibrary} from '../_account-contract.js'
import {isCentrallyHidden} from '../_book-intake.js'
import {boundedBytes} from '../../_seo-toc.js'

const valid=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(id)
const publicRow=row=>row?.visibility==='public'&&row.review_status==='approved'
/** No client supplied owner or public flag is used for authorization. */
export async function visibleEditionBook(context,id,account){
 const db=context.env.VISITORS_DB
 if(!valid(id)||await isCentrallyHidden(db,id))return null
 if(/^\d{1,9}$/.test(id)){
  const source=Number(id)>=410000000?String(Number(id)-410000000):id
  if(await isCentrallyHidden(db,String(410000000+Number(source)))||await isCentrallyHidden(db,source)||await isCentrallyHidden(db,'shamela-'+source))return null
 }
 const row=await db.prepare('SELECT id,title,owner_subject,visibility,review_status,mime_type,deleted_at FROM user_books WHERE id=?1').bind(id).first()
 if(row)return !row.deleted_at&&(publicRow(row)||row.owner_subject===account?.subject)?row:null
 // Packaged books have no user_books row. Verify against a bounded build shard.
 if(!context.env.ASSETS)return null
 if(!/^\d{1,9}$/.test(id)){
  const response=await context.env.ASSETS.fetch(new URL('/library/published/manifest.json',context.request.url))
  if(!response.ok||!response.body)return null
  const manifest=JSON.parse(new TextDecoder().decode(await boundedBytes(response.body,4*1024*1024)))
  const work=manifest.schemaVersion===1&&manifest.works?.find(work=>work.id===id&&work.status==='ready'&&work.security?.verdict==='allow')
  return work?{id,title:work.title,visibility:'public',review_status:'approved',packaged:true}:null
 }
 const source=Number(id)>=410000000?String(Number(id)-410000000):id
 const shard=String(Number(source)%64).padStart(2,'0')
 const response=await context.env.ASSETS.fetch(new URL(`/data/seo/books-${shard}.json`,context.request.url))
 if(!response.ok||Number(response.headers.get('content-length'))>1048576)return null
 if(!response.body)return null
 const bytes=await boundedBytes(response.body,1048576)
 const record=JSON.parse(new TextDecoder().decode(bytes)).records?.[source]
 return record?{id,title:record.title,visibility:'public',review_status:'approved',packaged:true}:null
}
export async function onRequest(context){
 const {request,env}=context,url=new URL(request.url)
 if(!['GET','POST'].includes(request.method))return json({error:'method_not_allowed'},405)
 if(request.method==='POST'&&!trustedMutation(request))return json({error:'cross_site_request_rejected'},403)
 try{
  const account=await trustedAccount(context),db=env.VISITORS_DB
  if(request.method==='POST'){
   if(!account)return json({error:'authentication_required'},401)
   if(Number(request.headers.get('content-length'))>1024)return json({error:'invalid_edition'},400)
   if(!request.body)return json({error:'invalid_edition'},400)
   let raw;try{raw=new TextDecoder().decode(await boundedBytes(request.body,1024))}catch{return json({error:'invalid_edition'},400)}
   let body;try{body=JSON.parse(raw)}catch{return json({error:'invalid_edition'},400)}
   if(!body||Object.keys(body).some(k=>!['bookId','parentId'].includes(k))||!valid(body.bookId)||!valid(body.parentId)||body.bookId===body.parentId)return json({error:'invalid_edition'},400)
   const child=await visibleEditionBook(context,body.bookId,account),parent=await visibleEditionBook(context,body.parentId,account)
   if(!child||!parent||child.owner_subject!==account.subject||child.mime_type!=='application/pdf')return json({error:'book_not_found'},404)
   if(publicRow(child)&&!canEditLibrary(account))return json({error:'editor_required'},403)
   if(await db.prepare('SELECT book_id FROM independent_pdf_editions WHERE parent_id=?1 LIMIT 1').bind(body.bookId).first())return json({error:'edition_relation_conflict'},409)
   // Do not silently change an existing edition's group or create chained/cyclic groups.
   const linked=await db.prepare('SELECT parent_id FROM independent_pdf_editions WHERE book_id=?1').bind(body.parentId).first()
   const root=linked?.parent_id??body.parentId
   if(root===body.bookId||!await visibleEditionBook(context,root,account))return json({error:'invalid_edition'},400)
   const inserted=await db.prepare("INSERT INTO independent_pdf_editions(book_id,parent_id,created_by) SELECT ?1,?2,?3 WHERE EXISTS(SELECT 1 FROM user_books WHERE id=?1 AND owner_subject=?3 AND deleted_at IS NULL AND mime_type='application/pdf') ON CONFLICT(book_id) DO NOTHING").bind(body.bookId,root,account.subject).run()
   if(!Number(inserted.meta?.changes)){
    const existing=await db.prepare('SELECT parent_id FROM independent_pdf_editions WHERE book_id=?1').bind(body.bookId).first()
    if(existing?.parent_id!==root)return json({error:'edition_relation_conflict'},409)
   }
   return json({bookId:body.bookId,parentId:root,linked:true})
  }
  const id=url.searchParams.get('id'),page=Number(url.searchParams.get('page')??0)
  if(!valid(id)||!Number.isSafeInteger(page)||page<0||page>10000||[...url.searchParams.keys()].some(k=>!['id','page'].includes(k)))return json({error:'invalid_edition'},400)
  if(!await visibleEditionBook(context,id,account))return json({error:'book_not_found'},404)
  const relation=await db.prepare('SELECT parent_id FROM independent_pdf_editions WHERE book_id=?1').bind(id).first()
  const root=relation?.parent_id??id,parent=await visibleEditionBook(context,root,account)
  // A public PDF must never reveal the identity of its private/withdrawn parent.
  if(!parent)return json({editions:[],hasMore:false,page})
  const result=await db.prepare("SELECT b.id,b.title,b.visibility,b.review_status,m.metadata_json FROM independent_pdf_editions e JOIN user_books b ON b.id=e.book_id LEFT JOIN user_book_metadata m ON m.book_id=b.id WHERE e.parent_id=?1 AND b.deleted_at IS NULL AND ((b.visibility='public' AND b.review_status='approved') OR b.owner_subject=?2) AND NOT EXISTS(SELECT 1 FROM central_book_overrides o WHERE o.book_id=b.id AND (o.visibility<>'public' OR o.logically_deleted_at IS NOT NULL)) ORDER BY b.id LIMIT 51 OFFSET ?3").bind(root,account?.subject??'',page*50).all()
  const rows=result.results??[],editions=rows.slice(0,50).map(row=>{const meta=JSON.parse(row.metadata_json??'{}');return{id:row.id,title:row.title,edition:meta.edition??'',publisher:meta.publisher??'',public:publicRow(row)}})
  return json({parent:{id:root,title:parent.title,public:publicRow(parent),...(parent.packaged?{packaged:true}:{})},editions,hasMore:rows.length>50,page})
 }catch{return json({error:'edition_service_unavailable'},503)}
}
