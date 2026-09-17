import {isManager,json,trustedAccount} from '../_account-contract.js'

export async function onRequestGet(context){
  const account=await trustedAccount(context);if(!isManager(account))return json({error:'admin_required'},403)
  const url=new URL(context.request.url),page=Number(url.searchParams.get('page')??0),limit=Number(url.searchParams.get('limit')??50)
  if(!Number.isSafeInteger(page)||page<0||page>10_000||!Number.isSafeInteger(limit)||limit<1||limit>100)return json({error:'invalid_audit_page'},400)
  const offset=page*limit
  const result=await context.env.VISITORS_DB.prepare("SELECT kind,eventId AS id,bookId,actorName,action,createdAt FROM (SELECT 'review' AS kind,CAST(e.id AS TEXT) AS eventId,e.book_id AS bookId,COALESCE(a.display_name,'مدير') AS actorName,e.decision AS action,e.created_at AS createdAt FROM book_review_events e JOIN accounts a ON a.subject=e.reviewer_subject UNION ALL SELECT 'central' AS kind,CAST(c.id AS TEXT) AS eventId,c.book_id AS bookId,COALESCE(a.display_name,'مدير') AS actorName,c.action AS action,c.created_at AS createdAt FROM central_book_audit_events c JOIN accounts a ON a.subject=c.actor_subject) ORDER BY createdAt DESC,kind,id DESC LIMIT ?1 OFFSET ?2").bind(limit+1,offset).all()
  const rows=result.results??[],hasMore=rows.length>limit
  return json({events:rows.slice(0,limit),page,hasMore})
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET'})
