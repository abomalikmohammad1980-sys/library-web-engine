import {json} from '../_account-contract.js'
import {accessConfigStatus} from './_access-login.js'

// Cache only short-lived failures, never identities or successful authorization.
const failures=new WeakMap()
export function readinessFailure(error){
 const message=String(error?.message??error)
 if(/daily row (?:read|write) limit|exceeded D1.*free tier/i.test(message))return 'database_quota_exhausted'
 if(/no such (?:table|column)/i.test(message))return 'schema_missing'
 return 'temporarily_unavailable'
}

export async function onRequestGet(context){
  const access=accessConfigStatus(context.env)
  const bindings={visitorsDb:Boolean(context.env?.VISITORS_DB),libraryR2:Boolean(context.env?.LIBRARY_R2)}
  let nativeConfigured=false
  let bridgeReady=false
  let reason='bindings_missing'
  const db=context.env?.VISITORS_DB
  if(typeof db?.prepare==='function'&&bindings.libraryR2){
    const cached=failures.get(db)
    if(cached&&cached.until>Date.now())reason=cached.reason
    else try{
      // Validate column contracts without joining or reading account records.
      await db.prepare('SELECT c.subject,s.device_id,d.revoked_at,b.blocked,l.attempts FROM account_credentials c LEFT JOIN account_sessions s ON s.subject=c.subject LEFT JOIN account_devices d ON d.owner_subject=c.subject LEFT JOIN account_blocks b ON b.subject=c.subject LEFT JOIN account_auth_limits l ON l.bucket=c.subject WHERE 0').first()
      // A real bounded read also detects the daily D1 limit. Schema-only SQL
      // may still succeed while actual logins are unavailable.
      await db.prepare('SELECT 1 AS available FROM accounts LIMIT 1').first()
      nativeConfigured=true
      if(access.configured)try{await db.prepare('SELECT s.token_hash,l.state_hash FROM account_access_sessions s LEFT JOIN account_access_login_states l ON l.state_hash=s.token_hash WHERE 0').first();bridgeReady=true}catch{}
    }catch(error){reason=readinessFailure(error);failures.set(db,{reason,until:Date.now()+30000})}
  }
  // Both providers now use device and block tables; Access configuration cannot
  // substitute for deploying the runtime schema.
  const ready=nativeConfigured&&bindings.visitorsDb&&bindings.libraryR2
  return json({
    ready,
    ...(!ready?{reason,retryAfterSeconds:30}:{}),
    access:{configured:access.configured,bridgeReady},
    ...(nativeConfigured?{native:{configured:true}}:{}),
    message:ready
      ?'منظومة الحسابات جاهزة.'
      :'منظومة الحسابات غير جاهزة الآن.',
  },ready?200:503,ready?{}:{'retry-after':'30'})
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET'})
