import {verifyAccessAssertion} from '../_access-jwt.js'
import {trustedAccessName} from '../_access-profile-name.js'
import {updateProviderName} from '../_account-profile.js'
import {registerDevice} from '../_account-device.js'
import {isAccountBlocked} from '../_account-block.js'
import {accessHash,accessRandom,accessSessionCookie,cookieValue,revokeAccessSession,accessStateMatches} from '../_access-session.js'
import {revokeNativeSession,expiredSessionCookie} from '../_native-auth.js'
import {json} from '../_account-contract.js'
import {safeReturnUrl} from './_access-login.js'
export async function onRequestGet(context){
 const state=new URL(context.request.url).searchParams.get('state')||'',cookie=cookieValue(context.request,'__Host-khizana-access-state'),db=context.env?.VISITORS_DB
 if(!db)return json({error:'accounts_unavailable'},503)
 if(!await accessStateMatches(cookie,state))return json({error:'account_login_state_invalid'},400)
 const now=Math.floor(Date.now()/1000),flow=await db.prepare('DELETE FROM account_access_login_states WHERE state_hash=?1 AND expires_at>?2 RETURNING return_url').bind(await accessHash(state),now).first()
 if(!flow)return json({error:'account_login_state_invalid'},400)
 const identity=await verifyAccessAssertion(context.request.headers.get('cf-access-jwt-assertion')||'',context.env,{includeLifetime:true})
 if(!identity)return json({error:'account_access_invalid'},401)
 const subject=await accessHash(`khizana-access:${String(context.env.ACCOUNT_ACCESS_DOMAIN).replace(/\/+$/,'')}:${identity.subject}`)
 const conflict=await db.prepare('SELECT subject FROM accounts WHERE email=?1 COLLATE NOCASE AND subject<>?2').bind(identity.email,subject).first()
 if(conflict)return json({error:'account_identity_conflict',message:'هذا البريد مرتبط بحساب آخر. سجّل بالطريقة الأصلية أو تواصل مع الإدارة.'},409)
 const providerName=await trustedAccessName(identity,context.request.headers.get('cf-access-jwt-assertion')||'',context.env)
 try{await db.prepare('INSERT INTO accounts(subject,email,display_name) VALUES(?1,?2,?3) ON CONFLICT(subject) DO UPDATE SET email=excluded.email, updated_at=CURRENT_TIMESTAMP').bind(subject,identity.email,providerName||identity.email.split('@')[0]).run()}catch(error){if(String(error).includes('UNIQUE'))return json({error:'account_identity_conflict'},409);throw error}
 // Profile migration availability must not turn optional name enrichment into login failure.
 try{await updateProviderName(db,subject,identity.email,providerName)}catch{ /* Preserve stored name and login if profile storage is unavailable. */ }
 if(await isAccountBlocked(context,subject))return json({error:'account_blocked'},403)
 const device=await registerDevice(context,subject,{label:'متصفح الحساب',platform:'web'});if(device.error)return json({error:device.error},403)
 await revokeNativeSession(context);await revokeAccessSession(context)
 const token=accessRandom(),expires=Math.min(now+86400,identity.expiresAt??now+86400)
 await db.prepare('DELETE FROM account_access_sessions WHERE expires_at<?1').bind(now).run()
 await db.prepare('INSERT INTO account_access_sessions(token_hash,subject,device_id,expires_at) VALUES(?1,?2,?3,?4)').bind(await accessHash(token),subject,device.device.deviceId,expires).run()
 const headers=new Headers({location:safeReturnUrl(context.request,flow.return_url),'cache-control':'no-store','referrer-policy':'no-referrer'})
 headers.append('set-cookie',accessSessionCookie(token,expires-now));headers.append('set-cookie',device.cookie);headers.append('set-cookie',expiredSessionCookie());headers.append('set-cookie','__Host-khizana-access-state=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0')
 return new Response(null,{status:302,headers})
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET'})
