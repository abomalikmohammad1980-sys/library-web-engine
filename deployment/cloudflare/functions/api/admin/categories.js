import {canEditLibrary,json,trustedAccount,trustedMutation} from '../_account-contract.js'
const guard="EXISTS(SELECT 1 FROM accounts a WHERE a.subject=?4 AND (a.role='super-admin' OR (a.role='user' AND EXISTS(SELECT 1 FROM account_capabilities c WHERE c.subject=a.subject AND editorial=1)))) AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE subject=?4 AND blocked=1)"
async function mutate(context,create){
 if(!trustedMutation(context.request))return json({error:'cross_site_request_rejected'},403)
 try{
  const actor=await trustedAccount(context);if(!canEditLibrary(actor))return json({error:'editor_required'},403)
  if(!context.request.headers.get('content-type')?.includes('application/json'))return json({error:'invalid_category'},400)
  const reader=context.request.body?.getReader();if(!reader)return json({error:'invalid_category'},400)
  const parts=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();return json({error:'invalid_category'},400)}parts.push(value)}}finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length}
  let input;try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{return json({error:'invalid_category'},400)}
  if(!input||Array.isArray(input)||Object.keys(input).some(k=>!(create?['name']:['id','name','expectedVersion']).includes(k))||typeof input.name!=='string'||input.name.length>120||/[<>\u0000-\u001f\u007f]/.test(input.name))return json({error:'invalid_category'},400)
  const name=input.name.normalize('NFC').trim().replace(/\s+/gu,' '),id=create?'subject:'+crypto.randomUUID():input.id,expected=create?0:input.expectedVersion
  if(!name||name.startsWith('subject:')||name.startsWith('__')||name==='غير مصنف'||typeof id!=='string'||!/^subject:[a-zA-Z0-9-]{1,50}$/.test(id)||!Number.isSafeInteger(expected)||expected<0||expected>=2147483646||!create&&expected===0)return json({error:'invalid_category'},400)
  const db=context.env.VISITORS_DB
  const query=create
   ?'INSERT INTO subject_categories(category_id,name,revision,updated_by) SELECT ?1,?2,?3,?4 WHERE '+guard+' AND (SELECT COUNT(*) FROM subject_categories)<1000 AND NOT EXISTS(SELECT 1 FROM subject_category_aliases WHERE alias=?2)'
   :'UPDATE subject_categories SET name=?2,revision=?3,updated_by=?4,updated_at=CURRENT_TIMESTAMP WHERE category_id=?1 AND revision=?5 AND '+guard+' AND NOT EXISTS(SELECT 1 FROM subject_category_aliases WHERE alias=?2 AND category_id<>?1)'
  const stmt=db.prepare(query).bind(id,name,expected+1,actor.subject,...(create?[]:[expected]))
  const result=await stmt.run();if(Number(result.meta?.changes)!==1)return json({error:'category_conflict'},409)
  return json({id,name,revision:expected+1},create?201:200)
 }catch{return json({error:'categories_unavailable'},503)}
}
export const onRequestPost=context=>mutate(context,true)
export const onRequestPatch=context=>mutate(context,false)
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'POST, PATCH'})
