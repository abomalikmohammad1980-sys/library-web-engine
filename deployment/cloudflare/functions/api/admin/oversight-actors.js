import {administrativeAccountSql} from '../_account-audience.js'
import {json,isSuperAdmin,trustedAccount} from '../_account-contract.js'
export async function onRequestGet(context){
 const actor=await trustedAccount(context);if(!isSuperAdmin(actor))return json({error:'super_admin_required'},403)
 const page=Number(new URL(context.request.url).searchParams.get('page')??0)
 if(!Number.isSafeInteger(page)||page<0||page>10000)return json({error:'invalid_page'},400)
 try{
  const result=await context.env.VISITORS_DB.prepare(`SELECT a.subject AS id,a.display_name AS name FROM accounts a WHERE a.subject<>? AND ${administrativeAccountSql} ORDER BY a.display_name,a.subject LIMIT 101 OFFSET ?`).bind(actor.subject,page*100).all()
  return json({actors:(result.results??[]).slice(0,100),page,hasMore:(result.results??[]).length>100})
 }catch{return json({error:'oversight_actors_unavailable'},503)}
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET'})
