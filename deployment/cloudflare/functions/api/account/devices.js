import{json,trustedAccount,trustedMutation}from'../_account-contract.js'
import{registerDevice,requestAccountDeviceId}from'../_account-device.js'
export async function onRequestGet(c){const a=await trustedAccount(c);if(!a)return json({error:'authentication_required'},401);const r=await c.env.VISITORS_DB.prepare('SELECT device_id AS deviceId,label,platform,created_at AS createdAt,last_seen_at AS lastSeenAt,revoked_at AS revokedAt FROM account_devices WHERE owner_subject=?1 ORDER BY revoked_at IS NOT NULL,created_at DESC,device_id').bind(a.subject).all();const currentId=await requestAccountDeviceId(c.request);return json((r.results??[]).map(device=>({...device,isCurrent:currentId!==null&&device.deviceId===currentId&&device.revokedAt===null})))}
export async function onRequestPost(c){
  if(!trustedMutation(c.request))return json({error:'cross_site_request_rejected'},403)
  const a=await trustedAccount(c,{allowUnregisteredDevice:true});if(!a)return json({error:'authentication_required'},401)
  const b=await c.request.json().catch(()=>null)
  if(!b||!String(b.label??'').trim()||!String(b.platform??'').trim())return json({error:'invalid_device'},400)
  const result=await registerDevice(c,a.subject,b)
  return result.error?json({error:result.error},409):json(result.device,200,{'set-cookie':result.cookie})
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET, POST'})
