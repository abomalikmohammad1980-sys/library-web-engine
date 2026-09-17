import {ordinaryAccountSql} from '../_account-audience.js'
import {isManager,json,trustedAccount} from '../_account-contract.js'

const SQL=`SELECT
  (SELECT COUNT(*) FROM accounts a WHERE ${ordinaryAccountSql}) AS accountsTotal,
  (SELECT COUNT(*) FROM account_device_limit_events WHERE created_at>=datetime('now','-1 day')) AS deviceLimitRejections24h,
  COUNT(*) AS booksTotal,
  COALESCE(SUM(CASE WHEN review_status='pending' THEN 1 ELSE 0 END),0) AS pending,
  COALESCE(SUM(CASE WHEN review_status='approved' THEN 1 ELSE 0 END),0) AS approved,
  COALESCE(SUM(CASE WHEN review_status='rejected' THEN 1 ELSE 0 END),0) AS rejected,
  COALESCE(SUM(CASE WHEN visibility='public' AND review_status='approved' THEN 1 ELSE 0 END),0) AS publicBooks,
  COALESCE(SUM(CASE WHEN visibility='private' THEN 1 ELSE 0 END),0) AS privateBooks
FROM user_books b JOIN accounts a ON a.subject=b.owner_subject WHERE b.deleted_at IS NULL AND ${ordinaryAccountSql}`

export async function onRequestGet(context){
  const account=await trustedAccount(context);if(!isManager(account))return json({error:'admin_required'},403)
  const row=await context.env.VISITORS_DB.prepare(SQL).first()
  return json({stats:row??{accountsTotal:0,booksTotal:0,pending:0,approved:0,rejected:0,publicBooks:0,privateBooks:0}})
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET'})
