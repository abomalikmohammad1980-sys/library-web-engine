import {isManager,json,trustedAccount,trustedMutation} from '../../../_account-contract.js'
import {decodeRouteId} from '../../../_route-id.js'

async function targetAccount(context){
  const subject=decodeRouteId(context.params.subject)
  if(typeof subject!=='string'||!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,239}$/.test(subject))throw Error('invalid_account_id')
  return context.env.VISITORS_DB.prepare('SELECT subject,role FROM accounts WHERE subject=?1').bind(subject).first()
}
export async function onRequestGet(context){
 try{
  const actor=await trustedAccount(context)
  if(!isManager(actor))return json({error:'admin_required'},403)
  const target=await targetAccount(context)
  if(!target)return json({error:'account_not_found'},404)
  const db=context.env.VISITORS_DB
  const row=await db.prepare('SELECT blocked,reason,version FROM account_blocks WHERE subject=?1').bind(target.subject).first()
  const events=await db.prepare('SELECT e.id,e.blocked,e.reason,e.version,e.created_at AS createdAt,COALESCE(a.display_name,a.email) AS actorName FROM account_block_events e JOIN accounts a ON a.subject=e.actor_subject WHERE e.subject=?1 ORDER BY e.version DESC LIMIT 20').bind(target.subject).all()
  return json({subject:target.subject,blocked:Number(row?.blocked)===1,reason:row?.reason??'',version:Number(row?.version??0),canChange:target.subject!==actor.subject&&target.role==='user',events:(events.results??[]).map(event=>({...event,blocked:Number(event.blocked)===1}))})
 }catch(error){return json({error:error?.message==='invalid_account_id'?'invalid_account_id':'account_block_unavailable'},error?.message==='invalid_account_id'?400:503)}
}
export async function onRequestPatch(context){
  if(!trustedMutation(context.request))return json({error:'cross_site_request_rejected'},403)
 try{
  const actor=await trustedAccount(context)
  if(!isManager(actor))return json({error:'admin_required'},403)
  const target=await targetAccount(context)
  if(!target)return json({error:'account_not_found'},404)
  if(target.subject===actor.subject||target.role!=='user')return json({error:'account_manager_protected'},403)
  const input=await context.request.json().catch(()=>null)
  if(!input||typeof input.blocked!=='boolean'||!Number.isSafeInteger(input.version)||input.version<0||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>1000)return json({error:'invalid_account_block'},400)
  const db=context.env.VISITORS_DB,operation=crypto.randomUUID(),blocked=Number(input.blocked),reason=input.reason.trim()
  const changes=await db.batch([
    db.prepare("INSERT INTO account_blocks(subject,blocked,reason,version,last_operation,updated_by) SELECT ?1,?2,?3,1,?4,?5 WHERE EXISTS(SELECT 1 FROM accounts WHERE subject=?1 AND role='user') AND (?6=0 OR EXISTS(SELECT 1 FROM account_blocks WHERE subject=?1 AND version=?6)) ON CONFLICT(subject) DO UPDATE SET blocked=excluded.blocked,reason=excluded.reason,version=account_blocks.version+1,last_operation=excluded.last_operation,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP WHERE account_blocks.version=?6").bind(target.subject,blocked,reason,operation,actor.subject,input.version),
    db.prepare('INSERT INTO account_block_events(id,subject,actor_subject,blocked,reason,version) SELECT last_operation,subject,updated_by,blocked,reason,version FROM account_blocks WHERE subject=?1 AND last_operation=?2').bind(target.subject,operation),
    db.prepare('DELETE FROM account_sessions WHERE subject=?1 AND EXISTS(SELECT 1 FROM account_blocks WHERE subject=?1 AND last_operation=?2 AND blocked=1)').bind(target.subject,operation),
    db.prepare('DELETE FROM account_access_sessions WHERE subject=?1 AND EXISTS(SELECT 1 FROM account_blocks WHERE subject=?1 AND last_operation=?2 AND blocked=1)').bind(target.subject,operation),
  ])
  if(Number(changes[0]?.meta?.changes)!==1)return json({error:'account_block_conflict'},409)
  return json({subject:target.subject,blocked:input.blocked,version:input.version+1,reason})
 }catch(error){return json({error:error?.message==='invalid_account_id'?'invalid_account_id':'account_block_unavailable'},error?.message==='invalid_account_id'?400:503)}
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET, PATCH'})
