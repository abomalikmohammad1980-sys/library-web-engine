import {json,trustedAccount,trustedMutation} from '../_account-contract.js'
export async function onRequestGet(context){
 const account=await trustedAccount(context);if(!account)return json({error:'authentication_required'},401)
 try{const row=await context.env.VISITORS_DB.prepare('SELECT birth_year AS birthYear,consent,revision FROM account_demographics WHERE subject=?1').bind(account.subject).first()
 return json({demographics:row?{...row,consent:Boolean(row.consent)}:{birthYear:null,consent:false,revision:0}})}catch{return json({error:'demographics_unavailable'},503)}
}
export async function onRequestPatch(context){
 if(!trustedMutation(context.request))return json({error:'cross_site_request_rejected'},403)
 const account=await trustedAccount(context);if(!account)return json({error:'authentication_required'},401)
 try{
  const reader=context.request.body?.getReader();if(!reader)return json({error:'invalid_demographics'},400)
  const chunks=[];let size=0
  try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>1024)return json({error:'invalid_demographics'},400);chunks.push(p.value)}}finally{await reader.cancel().catch(()=>{})}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  let body;try{body=JSON.parse(new TextDecoder().decode(bytes))}catch{return json({error:'invalid_demographics'},400)}
  if(!body||typeof body!=='object')return json({error:'invalid_demographics'},400)
  const year=body.birthYear,consent=body.consent,version=body.expectedVersion,current=new Date().getUTCFullYear()
  if(typeof consent!=='boolean'||!Number.isSafeInteger(version)||version<0||version>2147483646||consent&&(!Number.isSafeInteger(year)||year<current-120||year>current)||!consent&&year!==null)return json({error:'invalid_demographics'},400)
  const db=context.env.VISITORS_DB,result=version===0
   ?await db.prepare('INSERT INTO account_demographics(subject,birth_year,consent,revision) VALUES(?1,?2,?3,1) ON CONFLICT(subject) DO NOTHING').bind(account.subject,consent?year:null,Number(consent)).run()
   :await db.prepare('UPDATE account_demographics SET birth_year=?2,consent=?3,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE subject=?1 AND revision=?4').bind(account.subject,consent?year:null,Number(consent),version).run()
  if(Number(result.meta?.changes)!==1)return json({error:'demographics_conflict'},409)
  return json({demographics:{birthYear:consent?year:null,consent,revision:version+1}})
 }catch{return json({error:'demographics_unavailable'},503)}
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET, PATCH'})
