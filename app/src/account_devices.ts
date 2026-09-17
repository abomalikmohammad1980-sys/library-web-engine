import { SourceSyncHttpClient, SourceSyncHttpError, type SyncDevice } from '@library/source-sync'
import {installTrustedRuntimeClaims} from './account_authority'

export const ACCOUNT_ACTIVE_DEVICE_LIMIT=3
export interface AccountDeviceGateway {baseUrl?:string;deviceId?:string;token?:()=>Promise<string|null>}
export type AccountDevice=SyncDevice&{isCurrent?:boolean}
export function isCurrentAccountDevice(device:AccountDevice,gateway?:AccountDeviceGateway):boolean{return device.revokedAt===null&&(gateway?Boolean(gateway.deviceId)&&device.deviceId===gateway.deviceId:device.isCurrent===true)}
const BROWSER_DEVICE_KEY='alkhizana:account-device-id:v1'

function client(gateway:AccountDeviceGateway):SourceSyncHttpClient{
  if(!gateway.baseUrl||!gateway.token)throw new Error('account_devices_not_configured')
  return new SourceSyncHttpClient(gateway.baseUrl,gateway.token)
}

function validDevice(value:unknown):value is AccountDevice{
  if(!value||typeof value!=='object')return false
  const item=value as Partial<AccountDevice>
  return typeof item.deviceId==='string'&&Boolean(item.deviceId)&&item.deviceId.length<=200
    &&typeof item.label==='string'&&Boolean(item.label.trim())&&item.label.length<=120
    &&typeof item.platform==='string'&&Boolean(item.platform.trim())&&item.platform.length<=40
    &&typeof item.createdAt==='string'&&typeof item.lastSeenAt==='string'
    &&(item.revokedAt===null||typeof item.revokedAt==='string')
    &&(item.isCurrent===undefined||typeof item.isCurrent==='boolean')
}

async function pages<T>(path='',init?:RequestInit):Promise<T>{const response=await fetch(`/api/account/devices${path}`,{...init,credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',...init?.headers,...(init?.method?{'x-alkhizana-request':'account-ui'}:{})}});if(!response.ok){if(response.status===401||response.status===403)installTrustedRuntimeClaims(null);const payload=await response.json().catch(()=>null);throw new Error(String(payload?.error??'account_devices_unavailable'))}return response.json()}
function validated(value:unknown):SyncDevice[]{if(!Array.isArray(value)||value.some(item=>!validDevice(item)))throw new Error('account_devices_response_invalid');return value}
export function currentBrowserAccountDeviceId(target:Pick<Storage,'getItem'|'setItem'>=localStorage):string{const prior=target.getItem(BROWSER_DEVICE_KEY)?.trim();if(prior&&prior.length<=160)return prior;const id=crypto.randomUUID();target.setItem(BROWSER_DEVICE_KEY,id);return id}

export async function listAccountDevices(gateway?:AccountDeviceGateway):Promise<SyncDevice[]>{
  if(!gateway)return validated(await pages(''))
  const response=await client(gateway).devices()
  if(response.notModified)throw new Error('account_devices_response_invalid')
  return validated(response.value)
}

export async function registerCurrentAccountDevice(gateway:AccountDeviceGateway|undefined,label:string,platform:string):Promise<SyncDevice>{
  const deviceId=gateway?.deviceId??currentBrowserAccountDeviceId(),input={deviceId,label:label.trim()||'هذا الجهاز',platform:platform.trim()||'web'}
  if(gateway)return client(gateway).registerDevice(input)
  const device=await pages<SyncDevice>('',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)})
  if(!validDevice(device))throw new Error('account_devices_response_invalid')
  localStorage.setItem(BROWSER_DEVICE_KEY,device.deviceId)
  return device
}

export async function revokeAccountDevice(gateway:AccountDeviceGateway|undefined,deviceId:string):Promise<void>{
  if(gateway)await client(gateway).revokeDevice(deviceId);else await pages(`/${encodeURIComponent(deviceId)}/revoke`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'})
}

export function accountDeviceErrorArabic(error:unknown):string{
  const code=error instanceof SourceSyncHttpError?error.code:error instanceof Error?error.message:''
  if(code==='device_limit_reached')return'بلغ حسابك الحد الأقصى وهو ثلاثة أجهزة. ألغِ جهازًا قديمًا ثم أعد تسجيل هذا الجهاز.'
  if(code==='device_revoked')return'سبق إلغاء هذا الجهاز ولا يمكن إعادة تفعيله تلقائيًا.'
  if(code==='authentication_required')return'انتهت صلاحية الدخول على هذا الجهاز. سجّل الدخول من جديد أو استخدم جهازًا معتمدًا.'
  if(code==='account_devices_not_configured')return'إدارة الأجهزة غير مرتبطة بالحساب في هذا الإصدار بعد.'
  if(code==='account_devices_response_invalid')return'وصلت قائمة أجهزة غير صالحة؛ لم نغيّر أي جهاز.'
  return'تعذّر تحديث أجهزة الحساب الآن. لم تتغير الأجهزة المسجلة.'
}
