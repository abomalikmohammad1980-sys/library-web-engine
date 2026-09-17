import {json,trustedMutation} from './_account-contract.js'
import {registerDevice} from './_account-device.js'
import {isAccountBlocked} from './_account-block.js'
import {revokeAccessSession,accessSessionCookie} from './_access-session.js'
const COOKIE='__Host-khizana-session',TTL=30*24*3600
const hex=bytes=>[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('')
export const digest=async value=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)))
export function sessionToken(request){return request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||''}
export async function passwordHash(password,salt){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits'])
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:100000},key,256))
}
export async function passwordMatches(password,salt,expected){
 const actual=await passwordHash(password,salt)
 const key=await crypto.subtle.importKey('raw',new Uint8Array(32),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])
 const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(expected))
 return crypto.subtle.verify('HMAC',key,signature,new TextEncoder().encode(actual))
}
export async function nativeSessionAccount(context){
 const token=sessionToken(context.request);if(!/^[a-f0-9]{64}$/.test(token))return null
 const deviceToken=context.request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-khizana-device='))?.slice('__Host-khizana-device='.length)||''
 if(!/^[a-f0-9]{64}$/.test(deviceToken))return null
 const account=await context.env.VISITORS_DB.prepare('SELECT a.subject,a.email,a.display_name AS displayName,a.role FROM account_sessions s JOIN accounts a ON a.subject=s.subject JOIN account_devices d ON d.owner_subject=s.subject AND d.device_id=s.device_id WHERE s.token_hash=?1 AND s.expires_at>?2 AND s.device_id=?3 AND d.revoked_at IS NULL').bind(await digest(token),Math.floor(Date.now()/1000),await digest(deviceToken)).first()
 return account?{...account,role:account.role==='admin'?'admin':'user',authProvider:'password',emailVerified:false}:null
}
export async function revokeNativeSession(context){const token=sessionToken(context.request);if(/^[a-f0-9]{64}$/.test(token))await context.env.VISITORS_DB.prepare('DELETE FROM account_sessions WHERE token_hash=?1').bind(await digest(token)).run()}
export const expiredSessionCookie=()=>`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
async function limited(context,email){
 const db=context.env.VISITORS_DB,now=Math.floor(Date.now()/1000),window=Math.floor(now/900),ip=context.request.headers.get('cf-connecting-ip')||'unknown'
 for(const [kind,value,max] of [['email',email,10],['ip',ip,60]]){
  const bucket=await digest(`${kind}:${value}:${window}`)
  const row=await db.prepare('INSERT INTO account_auth_limits(bucket,attempts,expires_at) VALUES(?1,1,?2) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(bucket,now+900).first()
  if(!row||row.attempts>max)return true
 }
 await db.prepare('DELETE FROM account_auth_limits WHERE expires_at<?1').bind(now).run()
 return false
}
export async function passwordEntry(context,register=false){
 if(!trustedMutation(context.request))return json({error:'same_origin_required'},403)
 if(!context.env?.VISITORS_DB)return json({error:'accounts_unavailable'},503)
 if(!context.request.headers.get('content-type')?.startsWith('application/json'))return json({error:'invalid_credentials'},400)
 let input;try{const reader=context.request.body?.getReader();let size=0,chunks=[];if(!reader)throw Error();for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw Error()}chunks.push(value)}const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length}input=JSON.parse(new TextDecoder().decode(bytes))}catch{return json({error:'invalid_credentials'},400)}
 const email=typeof input?.email==='string'?input.email.trim().toLowerCase():'',password=input?.password,displayName=typeof input?.displayName==='string'?input.displayName.trim().slice(0,120):''
 if(email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email)||typeof password!=='string'||password.length<8||password.length>128)return json({error:'invalid_credentials'},400)
 if(await limited(context,email))return json({error:'auth_rate_limited'},429,{'retry-after':'900'})
 const db=context.env.VISITORS_DB
 let account
 if(register){
  if(await db.prepare('SELECT subject FROM accounts WHERE email=?1 COLLATE NOCASE').bind(email).first())return json({error:'registration_unavailable'},409)
  const subject='password:'+crypto.randomUUID(),salt=random(),hash=await passwordHash(password,salt)
  try{await db.batch([db.prepare("INSERT INTO accounts(subject,email,display_name,role) VALUES(?1,?2,?3,'user')").bind(subject,email,displayName||email.split('@')[0]),db.prepare('INSERT INTO account_credentials(subject,password_hash,salt) VALUES(?1,?2,?3)').bind(subject,hash,salt)])}catch{return json({error:'registration_unavailable'},409)}
  account={subject}
 }else{
  account=await db.prepare('SELECT a.subject,c.password_hash,c.salt FROM accounts a JOIN account_credentials c ON c.subject=a.subject WHERE a.email=?1 COLLATE NOCASE').bind(email).first()
  const matches=await passwordMatches(password,account?.salt||'absent-account-salt',account?.password_hash||'0'.repeat(64))
  if(!account||!matches)return json({error:'invalid_credentials'},401)
 }
 if(await isAccountBlocked(context,account.subject))return json({error:'account_blocked'},403)
 const device=await registerDevice(context,account.subject,{label:'متصفح الحساب',platform:'web'})
 if(device.error)return json({error:device.error},409)
 const token=random(),now=Math.floor(Date.now()/1000)
 await revokeNativeSession(context)
 await revokeAccessSession(context)
 await db.prepare('DELETE FROM account_sessions WHERE expires_at<?1').bind(now).run()
 await db.prepare('INSERT INTO account_sessions(token_hash,subject,expires_at,device_id) VALUES(?1,?2,?3,?4)').bind(await digest(token),account.subject,now+TTL,device.device.deviceId).run()
 const response=json({authenticated:true,emailVerified:false},register?201:200)
 response.headers.append('set-cookie',`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${TTL}`)
 if(device.cookie)response.headers.append('set-cookie',device.cookie)
 response.headers.append('set-cookie',accessSessionCookie('',0))
 return response
}
