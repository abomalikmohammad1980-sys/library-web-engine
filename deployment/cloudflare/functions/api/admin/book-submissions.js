import {ordinaryAccountSql} from '../_account-audience.js'
import {isManager,json,trustedAccount} from '../_account-contract.js'
import {bookListRow} from '../_book-list-contract.js'
const STATUSES=new Set(['all','pending','approved','rejected'])
export async function onRequestGet(context){
  const account=await trustedAccount(context);if(!isManager(account))return json({error:'admin_required'},403)
  const url=new URL(context.request.url),status=url.searchParams.get('status')||'pending',owner=url.searchParams.get('owner')??'',page=Number(url.searchParams.get('page')??0),limit=Number(url.searchParams.get('limit')??50)
  if(!STATUSES.has(status))return json({error:'invalid_review_status'},400)
  if(owner.length>200||owner!==owner.trim())return json({error:'invalid_account_owner'},400)
  if(!Number.isSafeInteger(page)||page<0||page>10_000||!Number.isSafeInteger(limit)||limit<1||limit>100)return json({error:'invalid_review_page'},400)
  const result=await context.env.VISITORS_DB.prepare(`SELECT b.id,b.title,b.author,b.category,b.mime_type AS mimeType,b.byte_length AS byteLength,b.visibility,b.review_status AS reviewStatus,b.review_note AS reviewNote,b.review_version AS reviewVersion,b.created_at AS createdAt,a.email AS ownerEmail FROM user_books b JOIN accounts a ON a.subject=b.owner_subject WHERE b.deleted_at IS NULL AND (?1='all' OR b.review_status=?1) AND (?2='' OR b.owner_subject=?2) AND (?5='' OR b.owner_subject<>?5) AND (?6=0 OR (${ordinaryAccountSql})) ORDER BY CASE b.review_status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,b.updated_at DESC,b.id DESC LIMIT ?3 OFFSET ?4`).bind(status,owner,limit+1,page*limit,url.searchParams.get('excludeSelf')==='1'?account.subject:'',!owner||url.searchParams.get('excludeSelf')==='1'?1:0).all()
  const rows=result.results??[],hasMore=rows.length>limit
  return json({submissions:rows.slice(0,limit).map(bookListRow),page,hasMore})
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET'})
