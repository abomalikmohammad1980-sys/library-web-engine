import {plainSeoText} from '../../app/src/page_meta_model.ts'
// Reads only already-public metadata. No owner, session, object key or private text is selected.
// Refresh on every request: additions/edits/deletions need no redeployment or stale index cache.
export async function refreshPublicSeoRecord(db,kind,id,record){
 if(!db)return record
 if(kind==='books'){
  const publicId=/^\d+$/.test(id)?String(410000000+Number(id)):id
  const override=await db.prepare('SELECT title,author,category,visibility,logically_deleted_at,updated_at FROM central_book_overrides WHERE book_id IN (?1,?2,?3) ORDER BY revision DESC LIMIT 1').bind(publicId,id,'shamela-'+id).first()
  if(override&&(override.visibility!=='public'||override.logically_deleted_at))return undefined
  if(!record){
   const row=await db.prepare("SELECT id,title,author,category,updated_at FROM user_books WHERE id=?1 AND visibility='public' AND review_status='approved' AND deleted_at IS NULL LIMIT 1").bind(id).first()
   if(!row)return undefined
   record={id:row.id,title:plainSeoText(row.title),author:plainSeoText(row.author),category:plainSeoText(row.category??''),updatedAt:row.updated_at}
  }
  if(override)record={...record,...(override.title?{title:plainSeoText(override.title)}:{}),...(override.author?{author:plainSeoText(override.author),...(plainSeoText(override.author)!==record.author?{authorId:undefined,deathYearHijri:undefined}:{})}:{}),category:plainSeoText(override.category??''),updatedAt:override.updated_at}
  return record
 }
 if(!record)return undefined
 const override=await db.prepare('SELECT display_name,biography,fields_json,updated_at FROM author_overrides WHERE author_id IN (?1,?2) AND disabled=0 ORDER BY updated_at DESC LIMIT 1').bind('shamela:'+Number(id),id).first()
 if(!override)return record
 const fields=JSON.parse(override.fields_json||'{}')
 return {...record,name:plainSeoText(override.display_name),biography:plainSeoText(override.biography).slice(0,1800),...(Number.isSafeInteger(fields.deathYearHijri)?{deathYearHijri:fields.deathYearHijri}:{}),updatedAt:override.updated_at}
}
