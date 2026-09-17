import {json} from '../_account-contract.js'

const clean=value=>String(value??'').trim()
export function accessConfigStatus(env){
  const domain=clean(env?.ACCOUNT_ACCESS_DOMAIN).replace(/\/$/u,'')
  const aud=clean(env?.ACCOUNT_ACCESS_AUD)
  const domainReady=/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/iu.test(domain)
  const audReady=/^[a-f0-9]{32,128}$/iu.test(aud)
  const missing=[]
  if(!domainReady)missing.push('ACCOUNT_ACCESS_DOMAIN')
  if(!audReady)missing.push('ACCOUNT_ACCESS_AUD')
  return{configured:missing.length===0,missing,domainReady,audReady,...(missing.length?{}:{config:{domain,aud}})}
}
export function accessConfig(env){
  return accessConfigStatus(env).config??null
}
export function safeReturnUrl(request,storedValue){
  const url=new URL(request.url),value=storedValue??(url.searchParams.get('returnTo')||'/#/me'),fallback=new URL('/#/me',url).href
  try{
    let decoded=value
    for(let i=0;i<3;i++){
      if(/[\\\u0000-\u001f\u007f]/u.test(decoded)||decoded.startsWith('//'))return fallback
      const next=decodeURIComponent(decoded);if(next===decoded)break;decoded=next
    }
    if(storedValue===undefined&&!value.startsWith('/'))return fallback
    const target=new URL(value,url)
    return target.origin===url.origin?target.href:fallback
  }catch{return fallback}
}
export function unavailable(env){
  const status=accessConfigStatus(env)
  return json({error:'account_auth_not_configured',message:'تسجيل الدخول غير مفعّل بعد. يلزم ضبط إعدادات Cloudflare Access في بيئة Pages.',missing:status.missing},503)
}
