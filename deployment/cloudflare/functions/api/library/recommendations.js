import {json,canEditLibrary,trustedAccount,trustedMutation} from '../_account-contract.js'
export function validateRecommendations(value){
 if(!value||!Number.isSafeInteger(value.revision)||value.revision<0||!Array.isArray(value.entries)||value.entries.length>200)throw Error('invalid')
 const ids=new Set()
 for(const entry of value.entries){
  if(!entry||typeof entry.bookId!=='string'||!/^[A-Za-z0-9:_-]{1,200}$/.test(entry.bookId)||ids.has(entry.bookId))throw Error('invalid')
  ids.add(entry.bookId)
  for(const key of ['start','end'])if(typeof entry[key]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(entry[key])||!Number.isFinite(Date.parse(entry[key]))||new Date(entry[key]).toISOString().slice(0,10)!==entry[key])throw Error('invalid')
  if(entry.end<entry.start)throw Error('invalid')
 }
 return {revision:value.revision,entries:value.entries.map(({bookId,start,end})=>({bookId,start,end}))}
}
export async function onRequest(context){
 const {request,env}=context
 if(!['GET','PUT'].includes(request.method))return json({error:'method_not_allowed'},405)
 try{
  if(request.method==='GET')return json(await env.VISITORS_DB.prepare('SELECT revision,entries FROM editorial_recommendations WHERE id=1').first(),200,{'cache-control':'no-store'})
  if(!trustedMutation(request))return json({error:'forbidden'},403)
  const actor=await trustedAccount(context);if(!canEditLibrary(actor))return json({error:'editor_required'},403)
  const reader=request.body?.getReader();if(!reader)return json({error:'invalid'},400)
  let text='',length=0;const decoder=new TextDecoder()
  try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>64000){await reader.cancel();return json({error:'too_large'},413)}text+=decoder.decode(value,{stream:true})}text+=decoder.decode()}finally{reader.releaseLock()}
  let input;try{input=validateRecommendations(JSON.parse(text))}catch{return json({error:'invalid'},400)}
  const result=await env.VISITORS_DB.prepare("UPDATE editorial_recommendations SET entries=?1,revision=revision+1,updated_by=?2,updated_at=CURRENT_TIMESTAMP WHERE id=1 AND revision=?3 AND EXISTS(SELECT 1 FROM accounts a WHERE a.subject=?2 AND (a.role='super-admin' OR (a.role='user' AND EXISTS(SELECT 1 FROM account_capabilities c WHERE c.subject=a.subject AND editorial=1)))) AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE subject=?2 AND blocked=1)").bind(JSON.stringify(input.entries),actor.subject,input.revision).run()
  if(Number(result.meta?.changes)!==1)return json({error:'conflict'},409)
  return json({revision:input.revision+1,entries:JSON.stringify(input.entries)},200,{'cache-control':'no-store'})
 }catch{return json({error:'recommendations_unavailable'},503)}
}
