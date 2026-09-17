import {json} from '../_account-contract.js'
import {accessConfigStatus} from './_access-login.js'

export async function onRequestGet(context){
  const access=accessConfigStatus(context.env)
  const bindings={visitorsDb:Boolean(context.env?.VISITORS_DB),libraryR2:Boolean(context.env?.LIBRARY_R2)}
  let nativeConfigured=false
  let bridgeReady=false
  if(access.configured&&typeof context.env?.VISITORS_DB?.prepare==='function')try{await context.env.VISITORS_DB.prepare('SELECT s.token_hash,l.state_hash FROM account_access_sessions s LEFT JOIN account_access_login_states l ON l.state_hash=s.token_hash LIMIT 1').first();bridgeReady=true}catch{}
  if(bindings.visitorsDb&&typeof context.env.VISITORS_DB.prepare==='function')try{await context.env.VISITORS_DB.prepare('SELECT c.subject,s.device_id,d.revoked_at,b.blocked,l.attempts FROM account_credentials c LEFT JOIN account_sessions s ON s.subject=c.subject LEFT JOIN account_devices d ON d.owner_subject=c.subject LEFT JOIN account_blocks b ON b.subject=c.subject LEFT JOIN account_auth_limits l ON l.bucket=c.subject LIMIT 1').first();nativeConfigured=true}catch{}
  // Both providers now use device and block tables; Access configuration cannot
  // substitute for deploying the runtime schema.
  const ready=nativeConfigured&&bindings.visitorsDb&&bindings.libraryR2
  return json({
    ready,
    access:{configured:access.configured,bridgeReady},
    ...(nativeConfigured?{native:{configured:true}}:{}),
    message:ready
      ?'منظومة الحسابات جاهزة.'
      :'منظومة الحسابات غير جاهزة الآن.',
  },ready?200:503)
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET'})
