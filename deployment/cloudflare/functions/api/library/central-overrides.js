import {json} from '../_account-contract.js'
const COLUMNS='book_id AS bookId,title,author,category,visibility,revision,CASE WHEN logically_deleted_at IS NULL THEN 0 ELSE 1 END AS logicallyDeleted,updated_at AS updatedAt'
export async function onRequestGet(context){
 const url=new URL(context.request.url),bookId=url.searchParams.get('bookId')
 if(bookId!==null&&(!/^\d{1,16}$/.test(bookId)||String(Number(bookId))!==bookId||Number(bookId)<=410000000||!Number.isSafeInteger(Number(bookId))))return json({error:'central_overrides_book_id_invalid'},400)
 if(!context.env?.VISITORS_DB)return json({error:'central_overrides_unavailable'},503)
 const db=context.env.VISITORS_DB
 // A single reader needs only its own visibility fence. The unfiltered form
 // remains for catalogue consumers, but cannot make every book open scan all
 // overrides and consume D1 rows read proportionally to editorial history.
 const query=bookId===null?db.prepare(`SELECT ${COLUMNS} FROM central_book_overrides`):db.prepare(`SELECT ${COLUMNS} FROM central_book_overrides WHERE book_id IN (?1,?2)`).bind(bookId,String(Number(bookId)-410000000))
 const result=await query.all()
 const overrides=(result.results??[]).map(row=>({bookId:row.bookId,...(row.title?{title:row.title}:{}),...(row.author?{author:row.author}:{}),category:row.category??null,visibility:row.visibility,revision:Number(row.revision??0),logicallyDeleted:Boolean(row.logicallyDeleted),updatedAt:row.updatedAt}))
 return json({schemaVersion:1,overrides},200,{'cache-control':bookId===null?'public, max-age=30, stale-while-revalidate=120':'no-store'})
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET'})
