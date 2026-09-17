import {verifyAccessAssertion} from './_access-jwt.js'
import {nativeSessionAccount} from './_native-auth.js'
import {verifyRegisteredDevice} from './_account-device.js'
import {isAccountBlocked} from './_account-block.js'
import {accessSessionAccount} from './_access-session.js'
import {withAccountCapabilities} from './_account-capabilities.js'

const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}
export const json=(payload,status=200,extra={})=>new Response(JSON.stringify(payload),{status,headers:{...JSON_HEADERS,...extra}})
export function sameOrigin(request){if(request.headers.get('sec-fetch-site')==='cross-site')return false;const origin=request.headers.get('origin');return !origin||origin===new URL(request.url).origin}
export function trustedMutation(request){return sameOrigin(request)&&request.headers.get('x-alkhizana-request')==='account-ui'}
const clean=value=>String(value??'').trim()
export async function trustedAccount(context,options={}){
  const path=new URL(context.request.url).pathname
  const bootstrap=options.allowUnregisteredDevice===true&&((context.request.method==='POST'&&path==='/api/account/devices')||(context.request.method==='GET'&&path==='/api/account/session'))
  const enforce=async account=>account&&!await isAccountBlocked(context,account.subject)&&(context.env.ACCOUNT_TEST_MODE==='true'||bootstrap||await verifyRegisteredDevice(context,account.subject))?withAccountCapabilities(context,account):null
  const native=await nativeSessionAccount(context);if(native)return enforce(native)
  const accessSession=await accessSessionAccount(context);if(accessSession)return enforce(accessSession)
  const testMode=context.env.ACCOUNT_TEST_MODE==='true',assertion=clean(context.request.headers.get('cf-access-jwt-assertion'))
  if(!testMode&&!assertion)return null
  const identity=testMode?{email:clean(context.request.headers.get('x-khizana-test-email')).toLowerCase(),name:clean(context.request.headers.get('x-khizana-test-name'))}:await verifyAccessAssertion(assertion,context.env)
  if(!identity)return null
  const email=identity.email
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email))return null
  const identityKey=testMode?`khizana-test:${email}`:`khizana-access:${clean(context.env.ACCOUNT_ACCESS_DOMAIN).replace(/\/+$/u,'')}:${identity.subject}`
  const subject=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identityKey)).then(bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join(''))
  await context.env.VISITORS_DB.prepare('INSERT INTO accounts(subject,email,display_name) VALUES(?1,?2,?3) ON CONFLICT(subject) DO UPDATE SET email=excluded.email, updated_at=CURRENT_TIMESTAMP').bind(subject,email,identity.name||email.split('@')[0]).run()
  return enforce(await context.env.VISITORS_DB.prepare('SELECT subject,email,display_name AS displayName,role FROM accounts WHERE subject=?1').bind(subject).first())
}
export const publicClaims=account=>({subject:account.subject,role:account.role,displayName:account.displayName,sessionId:`access:${account.subject.slice(0,16)}`})
export const isManager=account=>account?.role==='admin'||account?.role==='super-admin'
export const isSuperAdmin=account=>account?.role==='super-admin'
export const canEditLibrary=account=>isSuperAdmin(account)||account?.role==='editor'
export const safeFileName=value=>(clean(value).replace(/[^\p{L}\p{N}._ -]+/gu,'_').slice(0,120)||'book.bin')
