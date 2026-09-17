import {json,trustedAccount,trustedMutation} from '../_account-contract.js'
import {readProfile,saveProfile} from '../_account-profile.js'
export async function onRequestGet(context){try{const account=await trustedAccount(context);if(!account)return json({error:'account_session_required'},401);return json({profile:await readProfile(context.env.VISITORS_DB,account.subject)})}catch{return json({error:'profile_unavailable'},503)}}
export async function onRequestPatch(context){
 if(!trustedMutation(context.request))return json({error:'cross_site_request_rejected'},403)
 try{
  const account=await trustedAccount(context);if(!account)return json({error:'account_session_required'},401)
  if(!context.request.headers.get('content-type')?.includes('application/json')||!context.request.body)return json({error:'invalid_profile'},400)
  const reader=context.request.body.getReader(),parts=[];let size=0
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096)throw Error('body');parts.push(value)}}catch{await reader.cancel();return json({error:'invalid_profile'},400)}finally{reader.releaseLock()}
  let input;try{const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{return json({error:'invalid_profile'},400)}
  const result=await saveProfile(context.env.VISITORS_DB,account.subject,input);return json(result.profile?{profile:result.profile}:{error:result.error},result.status)
 }catch{return json({error:'profile_unavailable'},503)}
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET, PATCH'})
