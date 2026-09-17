import {json} from '../_account-contract.js'
import {validCentralAuthorId} from '../_central-author-contract.js'
export async function onRequestGet(context){
 const p=new URL(context.request.url).searchParams,id=p.get('id'),page=Number(p.get('page')??0),limit=Number(p.get('limit')??20)
 if([...p.keys()].some(k=>!['id','page','limit'].includes(k)||p.getAll(k).length!==1)||!validCentralAuthorId(id)||!Number.isSafeInteger(page)||page<0||page>10000||!Number.isSafeInteger(limit)||limit<1||limit>100)return json({error:'invalid_author_books_page'},400)
 try{const result=await context.env.VISITORS_DB.prepare("SELECT b.id,b.title,b.author,b.category,b.mime_type AS mimeType,b.byte_length AS byteLength FROM user_books b JOIN user_book_metadata m ON m.book_id=b.id WHERE m.central_author_id=?1 AND b.visibility='public' AND b.review_status='approved' AND b.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM central_book_overrides o WHERE o.book_id=b.id AND (o.visibility<>'public' OR o.logically_deleted_at IS NOT NULL)) ORDER BY b.created_at DESC,b.id DESC LIMIT ?2 OFFSET ?3").bind(id,limit+1,page*limit).all();const rows=result.results??[];return json({books:rows.slice(0,limit),page,hasMore:rows.length>limit})}catch{return json({error:'author_books_unavailable'},503)}
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET'})
