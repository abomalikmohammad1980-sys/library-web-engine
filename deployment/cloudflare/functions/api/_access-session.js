const NAME='__Host-khizana-access-session'
const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('')
export const accessHash=async text=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))
export const accessRandom=()=>hex(crypto.getRandomValues(new Uint8Array(32)))
export async function accessStateMatches(expected,actual){
 if(!/^[a-f0-9]{64}$/.test(expected)||!/^[a-f0-9]{64}$/.test(actual))return false
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(expected),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])
 const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(expected))
 return crypto.subtle.verify('HMAC',key,signature,new TextEncoder().encode(actual))
}
export const cookieValue=(request,name)=>request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||''
export const accessSessionCookie=(token,seconds)=>`${NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`
export async function accessSessionAccount(context){
 const token=cookieValue(context.request,NAME),device=cookieValue(context.request,'__Host-khizana-device')
 if(!/^[a-f0-9]{64}$/.test(token)||!/^[a-f0-9]{64}$/.test(device))return null
 return context.env.VISITORS_DB.prepare('SELECT a.subject,a.email,a.display_name AS displayName,a.role FROM account_access_sessions s JOIN accounts a ON a.subject=s.subject JOIN account_devices d ON d.owner_subject=s.subject AND d.device_id=s.device_id WHERE s.token_hash=?1 AND s.expires_at>?2 AND s.device_id=?3 AND d.revoked_at IS NULL').bind(await accessHash(token),Math.floor(Date.now()/1000),await accessHash(device)).first()
}
export async function revokeAccessSession(context){const token=cookieValue(context.request,NAME);if(/^[a-f0-9]{64}$/.test(token))await context.env.VISITORS_DB.prepare('DELETE FROM account_access_sessions WHERE token_hash=?1').bind(await accessHash(token)).run()}
export const hasAccessSession=request=>Boolean(cookieValue(request,NAME))
