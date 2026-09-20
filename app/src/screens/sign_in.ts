import { accountErrorArabic, accountReadinessArabic, cloudflareAccessAuthProvider, loadAccountReadiness } from '../account_service'
import { pageContent } from '../components'
import { stateView } from '../state_view'
import { h } from '../ui'
import { uiTemplateText } from '../ui_template_binding'
import { publicPageHero } from '../public_page_hero'
import { accountDeviceErrorArabic, isCurrentAccountDevice, listAccountDevices, registerCurrentAccountDevice, revokeAccountDevice, type AccountDeviceGateway } from '../account_devices'
import type { SyncDevice } from '@library/source-sync'
import { accountEntryReturn } from '../account_entry'
import { icon, type IconName } from '../icons'
import { accountProfilePanel } from '../account_profile_panel'
import {oversightInbox} from '../oversight_panel'

export function signInScreen(): HTMLElement {
  const root = pageContent(publicPageHero({ eyebrow: '', title: 'الدخول إلى الخِزانة', titleId: 'sign-in-title', className: 'page-hero' }))
  const host=h('section',{'aria-live':'polite'});host.append(passwordAccountView(host,false));root.append(host)
  void hydrateAccountEntry(host)
  return root
}

async function hydrateAccountEntry(host:HTMLElement):Promise<void>{
  let sessionCheckFailed=false
  try{
    const claims=await cloudflareAccessAuthProvider.currentSession().catch(error=>{if(error instanceof Error&&/device_limit_reached|device_revoked|account_blocked/.test(error.message))throw error;sessionCheckFailed=true;return null})
    if(claims){host.replaceChildren(authenticatedAccountView(claims.displayName,window.__KHIZANA_SOURCE_SYNC__));return}
    const readiness=await loadAccountReadiness()
    if(readiness.native?.configured){const google=host.querySelector<HTMLButtonElement>('[data-google-login]');if(google)google.hidden=readiness.access.bridgeReady!==true;else host.replaceChildren(passwordAccountView(host,readiness.access.bridgeReady===true));return}
    if(!readiness.ready){host.replaceChildren(stateView({kind:'error',title:'تسجيل الدخول غير متاح مؤقتًا',description:accountReadinessArabic(readiness),actionLabel:'إعادة التحقق',onAction:()=>void hydrateAccountEntry(host)}),h('a',{class:'btn btn--secondary',href:'/'},'المتابعة بصفة ضيف'));return}
    if(sessionCheckFailed)throw new Error('account_session_check_failed')
    host.replaceChildren(stateView({kind:'empty',icon:'person',title:'الدخول الآمن إلى الخِزانة',description:'الحساب يحفظ كتبك بين الجلسات. تبقى كتب الضيف مؤقتة لهذه الجلسة.',actionLabel:'تسجيل الدخول',onAction:()=>void beginSignIn(host)}))
  }catch(error){const reason=error instanceof Error?error.message:'';host.replaceChildren(stateView({kind:'error',title:'تعذّر الدخول إلى الحساب',description:reason==='account_blocked'?accountErrorArabic(error):reason.includes('device_limit_reached')?'بلغ الحساب ثلاثة أجهزة. تواصل مع الإدارة.':reason.includes('device_revoked')?'أُلغي هذا الجهاز. تواصل مع الإدارة.':'لم نستطع فحص جاهزية تسجيل الدخول. يمكنك متابعة القراءة بصفة ضيف.',actionLabel:'المتابعة بصفة ضيف',href:'#/'}))}
}

async function beginSignIn(host:HTMLElement):Promise<void>{
  try{await cloudflareAccessAuthProvider.signIn()}
  catch{await hydrateAccountEntry(host)}
}

function passwordAccountView(host:HTMLElement,accessReady:boolean):HTMLElement{
 const nameAction=(button:HTMLButtonElement,label:string,glyph:IconName):void=>{button.setAttribute('aria-label',label);button.title=label;button.replaceChildren(icon(glyph,22))}
 const email=h('input',{type:'email'}) as HTMLInputElement
 Object.assign(email,{name:'email',autocomplete:'username',required:true,maxLength:254})
 const password=h('input',{type:'password'}) as HTMLInputElement
 Object.assign(password,{name:'password',autocomplete:'current-password',required:true,minLength:8,maxLength:128})
 const name=h('input',{type:'text'}) as HTMLInputElement
 Object.assign(name,{name:'displayName',autocomplete:'name',maxLength:120})
 const message=h('p',{role:'status','aria-live':'polite'})
 const submit=h('button',{type:'submit',class:'btn btn--primary'},'دخول') as HTMLButtonElement
 const toggle=h('button',{type:'button',class:'btn btn--secondary'},'إنشاء حساب جديد') as HTMLButtonElement
 nameAction(submit,'دخول','arrow-back');nameAction(toggle,'إنشاء حساب جديد','plus')
 let registering=false
 const nameLabel=h('label',null,'الاسم',name);nameLabel.hidden=true
 const actions=h('div',{class:'account-entry-form__actions'},submit,toggle)
 const form=h('form',{class:'state-view account-entry-form'},h('h2',null,'الدخول بالبريد'),nameLabel,h('label',null,'البريد الإلكتروني',email),h('label',null,'كلمة المرور (8 أحرف على الأقل)',password),message,actions)
 toggle.onclick=()=>{registering=!registering;nameLabel.hidden=!registering;nameAction(submit,registering?'إنشاء الحساب':'دخول',registering?'check':'arrow-back');nameAction(toggle,registering?'لدي حساب بالفعل':'إنشاء حساب جديد',registering?'person':'plus');password.autocomplete=registering?'new-password':'current-password'}
 form.onsubmit=async event=>{event.preventDefault();submit.disabled=true;toggle.disabled=true;message.textContent='جارٍ التحقق…';try{
  const response=await fetch(`/api/account/${registering?'register':'password-login'}`,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-alkhizana-request':'account-ui'},body:JSON.stringify({email:email.value,password:password.value,displayName:name.value})})
  if(!response.ok){const payload=await response.json().catch(()=>({}));message.textContent=response.status>=500?'خدمة الحسابات متوقفة مؤقتًا؛ أعد المحاولة لاحقًا. لم نتحقق من كلمة المرور.':payload.error==='account_blocked'?accountErrorArabic(new Error('account_blocked')):payload.error==='device_revoked'?'أُلغي هذا الجهاز. تواصل مع الإدارة.':payload.error==='device_limit_reached'?'بلغ الحساب ثلاثة أجهزة. تواصل مع الإدارة.':response.status===429?'محاولات كثيرة. أعد المحاولة بعد ربع ساعة.':registering?'تعذر إنشاء الحساب بهذا البريد. جرّب الدخول بحسابك الموجود.':'البريد أو كلمة المرور غير صحيحين.';return}
  password.value='';await hydrateAccountEntry(host);const returnTo=accountEntryReturn(routeLocation.hash);if(returnTo)routeLocation.hash=returnTo
 }catch{message.textContent='تعذر الاتصال. أعد المحاولة.'}finally{submit.disabled=false;toggle.disabled=false}}
 const access=h('button',{type:'button',class:'btn btn--secondary',dataset:{googleLogin:''},title:'تسجيل الدخول باستخدام Google','aria-label':'تسجيل الدخول باستخدام Google'},h('span',{class:'account-entry-form__google','aria-hidden':'true'},'G')) as HTMLButtonElement;access.hidden=!accessReady;access.onclick=()=>void beginSignIn(host);actions.append(access)
 return form
}

function authenticatedAccountView(displayName?:string,gateway?:AccountDeviceGateway):HTMLElement{
  const signOut=h('button',{class:'btn btn--secondary',type:'button'},'تسجيل الخروج') as HTMLButtonElement
  signOut.onclick=()=>void cloudflareAccessAuthProvider.signOut()
  return h('section',{class:'state-view'},h('h2',null,uiTemplateText('020859db294d941f',{p1:displayName??''})),h('p',null,'كتب هذا الحساب محفوظة ويمكن إرسالها إلى الإدارة للنشر العام.'),h('div',{class:'state-view__actions'},h('a',{class:'btn btn--primary',href:'#/me'},'فتح مساحتي'),signOut),accountProfilePanel(),accountDevicesPanel(gateway),oversightInbox())
}

function accountDevicesPanel(gateway?:AccountDeviceGateway):HTMLElement{
  const host=h('section',{class:'account-devices','aria-labelledby':'account-devices-title'},h('h3',{id:'account-devices-title'},'أجهزة الحساب'),h('p',{role:'status','aria-live':'polite'},'جارٍ تحميل الأجهزة…'))
  const refresh=async():Promise<void>=>{try{const devices=await listAccountDevices(gateway);renderAccountDevices(host,gateway,devices,refresh)}catch(error){host.replaceChildren(h('h3',{id:'account-devices-title'},'أجهزة الحساب'),h('p',{role:'alert'},accountDeviceErrorArabic(error)))} }
  void refresh();return host
}

function renderAccountDevices(host:HTMLElement,gateway:AccountDeviceGateway|undefined,devices:SyncDevice[],refresh:()=>Promise<void>):void{
  const current=devices.find(device=>isCurrentAccountDevice(device,gateway))
  const list=h('div',{class:'account-devices__list'},...devices.map(device=>{const revoke=h('button',{class:'btn btn--secondary',type:'button',disabled:device.revokedAt!==null},device.revokedAt?'ملغى':'إلغاء الجهاز') as HTMLButtonElement;revoke.onclick=async()=>{revoke.disabled=true;try{await revokeAccountDevice(gateway,device.deviceId);await refresh()}catch(error){revoke.disabled=false;host.querySelector('[data-device-message]')?.replaceChildren(accountDeviceErrorArabic(error))}};return h('article',{class:'account-devices__item'},h('strong',{dataset:{noTranslate:''}},device.label),h('small',{dataset:{noTranslate:''}},device.platform),isCurrentAccountDevice(device,gateway)?h('span',null,'هذا الجهاز'):h('span',null,device.revokedAt?'ملغى':'نشط'),revoke)}))
  const message=h('p',{role:'status','aria-live':'polite',dataset:{deviceMessage:''}})
  const register=h('button',{class:'btn btn--primary',type:'button'},'تسجيل هذا الجهاز') as HTMLButtonElement
  register.hidden=Boolean(current);register.onclick=async()=>{register.disabled=true;try{await registerCurrentAccountDevice(gateway,'هذا الجهاز',navigator.platform||'web');if(host.isConnected)routeLocation.hash='#/'}catch(error){message.setAttribute('role','alert');message.textContent=accountDeviceErrorArabic(error);register.disabled=false}}
  host.replaceChildren(h('h3',{id:'account-devices-title'},'أجهزة الحساب'),list,register,message)
}
import {routeLocation} from "../path_location"
