import {accessConfig,safeReturnUrl,unavailable} from './_access-login.js'
import {accessHash,accessRandom} from '../_access-session.js'
import {json,sameOrigin} from '../_account-contract.js'
export async function onRequestGet(context){
 const config=accessConfig(context.env);if(!config)return unavailable(context.env)
 if(!sameOrigin(context.request))return json({error:'same_origin_required'},403)
 if(!context.env.VISITORS_DB)return json({error:'accounts_unavailable'},503)
 const state=accessRandom(),now=Math.floor(Date.now()/1000),db=context.env.VISITORS_DB
 await db.prepare('DELETE FROM account_access_login_states WHERE expires_at<?1').bind(now).run()
 await db.prepare('INSERT INTO account_access_login_states(state_hash,return_url,expires_at) VALUES(?1,?2,?3)').bind(await accessHash(state),safeReturnUrl(context.request),now+600).run()
 const callback=new URL('/api/account/access-callback',context.request.url);callback.searchParams.set('state',state)
 // The protected application route lets Access generate its hostname/kid/meta
 // login URL. AUD is a token audience, not the login application's path segment.
 return new Response(null,{status:302,headers:{location:callback.href,'set-cookie':`__Host-khizana-access-state=${state}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`,'cache-control':'no-store','referrer-policy':'no-referrer'}})
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET'})
