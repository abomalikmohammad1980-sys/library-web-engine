import {ordinaryAccountSql} from '../_account-audience.js'
import{isManager,isSuperAdmin,json,trustedAccount}from'../_account-contract.js'
const SQL=`SELECT a.subject AS accountId,a.display_name AS displayName,a.email,a.role,a.role_version AS roleVersion,EXISTS(SELECT 1 FROM account_credentials c WHERE c.subject=a.subject) AS nativeAccount,COUNT(b.id) AS booksTotal,COALESCE(SUM(CASE WHEN b.review_status='pending' THEN 1 ELSE 0 END),0) AS pending,COALESCE(SUM(CASE WHEN b.review_status='approved' THEN 1 ELSE 0 END),0) AS approved,COALESCE(SUM(CASE WHEN b.review_status='rejected' THEN 1 ELSE 0 END),0) AS rejected FROM accounts a LEFT JOIN user_books b ON b.owner_subject=a.subject AND b.deleted_at IS NULL WHERE ${ordinaryAccountSql} GROUP BY a.subject,a.display_name,a.email,a.role,a.role_version ORDER BY booksTotal DESC,a.created_at DESC,a.subject LIMIT ?1 OFFSET ?2`
const LEGACY_SQL=`SELECT a.subject AS accountId,a.display_name AS displayName,a.email,COUNT(b.id) AS booksTotal,COALESCE(SUM(CASE WHEN b.review_status='pending' THEN 1 ELSE 0 END),0) AS pending,COALESCE(SUM(CASE WHEN b.review_status='approved' THEN 1 ELSE 0 END),0) AS approved,COALESCE(SUM(CASE WHEN b.review_status='rejected' THEN 1 ELSE 0 END),0) AS rejected FROM accounts a LEFT JOIN user_books b ON b.owner_subject=a.subject AND b.deleted_at IS NULL WHERE ${ordinaryAccountSql} GROUP BY a.subject,a.display_name,a.email ORDER BY booksTotal DESC,a.created_at DESC,a.subject LIMIT ?1 OFFSET ?2`
const missingRoleVersion=error=>[error?.message,error?.cause?.message].some(message=>typeof message==='string'&&/\bno such column:\s*(?:a\.)?role_version\b/i.test(message))
const EDITOR_SQL=SQL.replace('a.email,',"a.email,(SELECT COUNT(*) FROM book_reader_reports r WHERE r.reporter_subject=a.subject) AS reportsTotal,").replace('ORDER BY booksTotal DESC',"ORDER BY CASE WHEN COUNT(b.id)>0 OR EXISTS(SELECT 1 FROM oversight_events e WHERE e.actor_subject=a.subject) THEN 0 ELSE 1 END,MAX(COALESCE((SELECT MAX(e.created_at) FROM oversight_events e WHERE e.actor_subject=a.subject),''),COALESCE(MAX(b.created_at),'')) DESC,booksTotal DESC").replace('a.role,a.role_version AS roleVersion',"CASE WHEN a.role='user' AND EXISTS(SELECT 1 FROM account_capabilities c WHERE c.subject=a.subject AND editorial=1) THEN 'editor' ELSE a.role END AS role,a.role_version AS roleVersion")
const missingCapabilities=error=>[error?.message,error?.cause?.message].some(message=>typeof message==='string'&&/\bno such table:\s*account_capabilities\b/i.test(message))
export async function onRequestGet(c){
 const account=await trustedAccount(c);if(!isManager(account))return json({error:'admin_required'},403)
 const url=new URL(c.request.url),page=Number(url.searchParams.get('page')??0),limit=Number(url.searchParams.get('limit')??100)
 if(!Number.isSafeInteger(page)||page<0||page>10_000||!Number.isSafeInteger(limit)||limit<1||limit>100)return json({error:'invalid_account_page'},400)
 try{
  const counted=await c.env.VISITORS_DB.prepare(`SELECT COUNT(*) AS total FROM accounts a WHERE ${ordinaryAccountSql}`).first(),total=counted?.total
  if(!Number.isSafeInteger(total)||total<0)throw Error('invalid_account_total')
  let result,legacy=false
  try{result=await c.env.VISITORS_DB.prepare(EDITOR_SQL).bind(limit+1,page*limit).all()}
  catch(error){if(!missingRoleVersion(error)&&!missingCapabilities(error))throw error;legacy=true;result=await c.env.VISITORS_DB.prepare(LEGACY_SQL).bind(limit+1,page*limit).all()}
  const rows=result.results??[],hasMore=rows.length>limit
  return json({accounts:rows.slice(0,limit).map(({nativeAccount,...row})=>({...row,canManageRoles:!legacy&&isSuperAdmin(account)&&row.accountId!==account.subject&&['user','admin','editor'].includes(row.role)})),page,hasMore,total})
 }catch{return json({error:'account_members_unavailable'},503)}
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET'})
