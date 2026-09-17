import {json,safeFileName} from '../_account-contract.js'
import {publicBookExtras,missingIntakeSchema} from '../_book-intake.js'

const PUBLIC = "visibility='public' AND review_status='approved' AND deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM central_book_overrides o WHERE o.book_id=user_books.id AND (o.visibility<>'public' OR o.logically_deleted_at IS NOT NULL))"
// All existing approval transitions append a review event and advance review_version.
// Logical deletion changes the public count. This is a pagination epoch, not an
// immutable content snapshot or a promise to preserve owner-deletable originals.
const REVISION = `SELECT COUNT(*) AS count,COALESCE(SUM(review_version),0) AS versions,COALESCE(SUM(byte_length),0) AS bytes,COALESCE(MAX(updated_at),'') AS updated,COALESCE(MAX(id),'') AS lastId,(SELECT COALESCE(MAX(id),0) FROM book_review_events) AS reviewEvent,(SELECT COALESCE(SUM(revision),0) FROM central_book_overrides) AS centralVersion FROM user_books WHERE ${PUBLIC}`
const FIELDS="id,COALESCE((SELECT o.title FROM central_book_overrides o WHERE o.book_id=user_books.id),title) AS title,COALESCE((SELECT o.author FROM central_book_overrides o WHERE o.book_id=user_books.id),author) AS author,CASE WHEN EXISTS(SELECT 1 FROM central_book_overrides o WHERE o.book_id=user_books.id) THEN (SELECT o.category FROM central_book_overrides o WHERE o.book_id=user_books.id) ELSE category END AS category,mime_type AS mimeType,byte_length AS byteLength,created_at AS createdAt,object_key AS objectKey,review_version AS publicationVersion"
const PAGE = `SELECT ${FIELDS} FROM user_books WHERE ${PUBLIC} AND (?1='' OR created_at<?1 OR (created_at=?1 AND id<?2)) ORDER BY created_at DESC,id DESC LIMIT ?3`
const FORMATS=new Map([['docx','word'],['doc','word'],['rtf','word'],['pdf','pdf'],['epub','epub'],['bok','shamela-bok'],['txt','text'],['md','markdown']])
export function publicBook(row){
  let name=String(row.objectKey??'').split('/').at(-1)??''
  try{name=decodeURIComponent(name)}catch{name=''}
  if(!name||/[/\\\u0000-\u001f\u007f]/.test(name)||/^\.+$/.test(name))name='book.bin'
  const fileName=safeFileName(name),extension=/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1]??''
  return {id:row.id,title:row.title,author:row.author,category:row.category??null,mimeType:row.mimeType,byteLength:row.byteLength,createdAt:row.createdAt,fileUrl:`/api/account/books/${encodeURIComponent(row.id)}/file`,fileName,sourceFormat:FORMATS.get(extension)??null,publicationVersion:Number.isSafeInteger(row.publicationVersion)&&row.publicationVersion>=0?row.publicationVersion:0}
}
const sha = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('')
function encodeCursor(value){return btoa(JSON.stringify(value)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}
function decodeCursor(raw){
  if(!/^[A-Za-z0-9_-]{1,800}$/.test(raw))throw Error('cursor')
  const value=JSON.parse(atob(raw.replace(/-/g,'+').replace(/_/g,'/')))
  if(!value||value.v!==1||!/^[a-f0-9]{64}$/.test(value.revision)||typeof value.created!=='string'||!/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?:\.\d{1,6})?Z?$/.test(value.created)||typeof value.id!=='string'||!/^[A-Za-z0-9_-]{1,200}$/.test(value.id))throw Error('cursor')
  return value
}

export async function onRequest(context){
  if(context.request.method!=='GET')return json({error:'method_not_allowed'},405,{allow:'GET'})
  let limit,cursor,id
  try{
    const params=new URL(context.request.url).searchParams
    if([...params.keys()].some(key=>!['limit','cursor','id'].includes(key)||params.getAll(key).length!==1))throw Error('query')
    if(params.has('id')){
      id=params.get('id')
      if(params.size!==1||!/^[A-Za-z0-9_-]{1,200}$/.test(id))throw Error('id')
    }
    const rawLimit=params.get('limit')??'50'
    if(!/^[1-9]\d{0,2}$/.test(rawLimit)||(limit=Number(rawLimit))>100)throw Error('limit')
    cursor=params.has('cursor')?decodeCursor(params.get('cursor')):null
  }catch{return json({error:'invalid_catalog_page'},400)}
  if(!context.env?.VISITORS_DB)return json({error:'published_catalog_unavailable'},503)
  try{
    const db=context.env.VISITORS_DB
    if(id){
      const [result]=await db.batch([db.prepare(`SELECT ${FIELDS} FROM user_books WHERE ${PUBLIC} AND id=?1 LIMIT 1`).bind(id)])
      const row=result.results?.[0]
      let extras={};if(row)try{extras=await publicBookExtras(db,id)}catch(error){if(!missingIntakeSchema(error))throw error}
      return row?json({schemaVersion:1,book:{...publicBook(row),...extras}},200,{'cache-control':'no-store','cross-origin-resource-policy':'same-origin'}):json({error:'book_not_found'},404,{'cache-control':'no-store'})
    }
    // D1 batch is transactional: page and epoch observe the same database snapshot.
    const [state,result]=await db.batch([db.prepare(REVISION),db.prepare(PAGE).bind(cursor?.created??'',cursor?.id??'',limit+1)])
    const revision=await sha(JSON.stringify(state.results?.[0]??{}))
    if(cursor&&cursor.revision!==revision)return json({error:'catalog_changed',restartRequired:true},409)
    const rows=result.results??[],hasMore=rows.length>limit
    const books=rows.slice(0,limit).map(publicBook)
    if(books.length)try{
      const linked=await db.prepare(`SELECT book_id,central_author_id FROM user_book_metadata WHERE book_id IN (${books.map((_,i)=>'?'+(i+1)).join(',')}) AND central_author_id IS NOT NULL`).bind(...books.map(b=>b.id)).all()
      const byId=new Map((linked.results??[]).map(r=>[r.book_id,r.central_author_id]));for(const book of books)if(byId.has(book.id))book.centralAuthorId=byId.get(book.id)
    }catch(error){if(!missingIntakeSchema(error))throw error}
    const last=books.at(-1),nextCursor=hasMore&&last?encodeCursor({v:1,revision,created:last.createdAt,id:last.id}):null
    return json({schemaVersion:1,revision,books,nextCursor,hasMore},200,{'cache-control':'no-store','cross-origin-resource-policy':'same-origin'})
  }catch{return json({error:'published_catalog_unavailable'},503)}
}
