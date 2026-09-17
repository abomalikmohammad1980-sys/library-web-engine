import {accessConfig,safeReturnUrl,unavailable} from './_access-login.js'
import {revokeNativeSession,sessionToken,expiredSessionCookie} from '../_native-auth.js'
import {revokeAccessSession,hasAccessSession,accessSessionCookie} from '../_access-session.js'

export async function onRequestGet(context){
  if(hasAccessSession(context.request)){
    await revokeAccessSession(context);await revokeNativeSession(context)
    const config=accessConfig(context.env),returnUrl=safeReturnUrl(context.request)
    const location=config?`${config.domain}/cdn-cgi/access/logout?redirect_url=${encodeURIComponent(returnUrl)}`:returnUrl
    const headers=new Headers({location,'cache-control':'no-store','referrer-policy':'no-referrer'})
    headers.append('set-cookie',accessSessionCookie('',0));headers.append('set-cookie',expiredSessionCookie())
    return new Response(null,{status:302,headers})
  }
  if(sessionToken(context.request)){await revokeNativeSession(context);return new Response(null,{status:302,headers:{location:safeReturnUrl(context.request),'set-cookie':expiredSessionCookie(),'cache-control':'no-store'}})}
  const config=accessConfig(context.env);if(!config)return unavailable(context.env)
  const location=`${config.domain}/cdn-cgi/access/logout?redirect_url=${encodeURIComponent(safeReturnUrl(context.request))}`
  return new Response(null,{status:302,headers:{location,'cache-control':'no-store','referrer-policy':'no-referrer'}})
}
export const onRequest=()=>new Response(null,{status:405,headers:{allow:'GET'}})
