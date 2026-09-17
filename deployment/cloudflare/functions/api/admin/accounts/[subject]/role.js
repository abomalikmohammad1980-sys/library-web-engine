import {isSuperAdmin,json,trustedAccount,trustedMutation} from '../../../_account-contract.js'
import {decodeRouteId} from '../../../_route-id.js'
async function boundedBody(request){
 if(!request.headers.get('content-type')?.includes('application/json')||!request.body)throw Error('body')
 const reader=request.body.getReader(),parts=[];let size=0
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096)throw Error('body');parts.push(value)}}catch(e){await reader.cancel();throw e}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
}
export async function onRequestPatch(context){
 if(!trustedMutation(context.request))return json({error:'cross_site_request_rejected'},403)
 try{
  const actor=await trustedAccount(context);if(!isSuperAdmin(actor))return json({error:'super_admin_required'},403)
  const subject=decodeRouteId(context.params.subject);if(typeof subject!=='string'||!(/^[a-f0-9]{64}$/.test(subject)||/^password:[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(subject)))return json({error:'invalid_account_id'},400)
  let body;try{body=await boundedBody(context.request)}catch{return json({error:'invalid_account_role'},400)}
  if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['role','expectedVersion','reason'].includes(k))||!['user','admin','editor'].includes(body.role)||!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<0||body.expectedVersion>=2147483647||typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>1000)return json({error:'invalid_account_role'},400)
  const db=context.env.VISITORS_DB,target=await db.prepare('SELECT subject,role,role_version AS roleVersion,EXISTS(SELECT 1 FROM account_credentials c WHERE c.subject=accounts.subject) AS nativeAccount,EXISTS(SELECT 1 FROM account_capabilities c WHERE c.subject=accounts.subject AND editorial=1) AS editorial FROM accounts WHERE subject=?1').bind(subject).first()
  if(!target)return json({error:'account_not_found'},404)
  if(subject===actor.subject||target.role==='super-admin')return json({error:'account_role_protected'},403)
  const effectiveRole=target.role==='user'&&Number(target.editorial)===1?'editor':target.role,storedRole=body.role==='editor'?'user':body.role
  if(target.roleVersion!==body.expectedVersion||effectiveRole===body.role)return json({error:'account_role_conflict'},409)
  const update=db.prepare("UPDATE accounts SET role=?1,role_version=role_version+1,updated_at=CURRENT_TIMESTAMP WHERE subject=?2 AND role_version=?3 AND role=?4 AND subject<>?5 AND role IN ('user','admin') AND EXISTS(SELECT 1 FROM accounts a WHERE a.subject=?5 AND a.role='super-admin') AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE subject=?5 AND blocked=1)").bind(storedRole,subject,body.expectedVersion,target.role,actor.subject)
  const operation=crypto.randomUUID()
  const audit=db.prepare('INSERT INTO account_role_events(id,subject,actor_subject,previous_role,role,revision,reason) SELECT ?1,?2,?3,?4,?5,?6,?7 WHERE changes()=1').bind(operation,subject,actor.subject,target.role,storedRole,body.expectedVersion+1,body.reason.trim())
  const capabilityAudit=db.prepare('INSERT INTO account_capability_events(id,subject,actor_subject,previous_role,role,revision,reason) SELECT id,subject,actor_subject,?2,?3,revision,reason FROM account_role_events WHERE id=?1').bind(operation,effectiveRole,body.role)
  const clear=db.prepare('DELETE FROM account_capabilities WHERE subject=?1 AND EXISTS(SELECT 1 FROM account_capability_events WHERE id=?2)').bind(subject,operation)
  const grant=db.prepare("INSERT INTO account_capabilities(subject,editorial) SELECT ?1,1 WHERE ?2='editor' AND EXISTS(SELECT 1 FROM account_capability_events WHERE id=?3)").bind(subject,body.role,operation)
  const [result]=await db.batch([update,audit,capabilityAudit,clear,grant]);if(Number(result?.meta?.changes)!==1)return json({error:'account_role_conflict'},409)
  return json({accountId:subject,role:body.role,roleVersion:body.expectedVersion+1,canManageRoles:true})
 }catch{return json({error:'account_roles_unavailable'},503)}
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'PATCH'})
